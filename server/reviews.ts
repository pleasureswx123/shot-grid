import { randomUUID } from 'node:crypto';
import { Router } from 'express';
import { pool } from './db';
import { UUID_PATTERN, asyncHandler, readString } from './apiUtils';
import { canCreateReviewList, canEditProject, canViewProject, getProjectPermissionContext } from './permissions';

export const projectReviewListsRouter = Router({ mergeParams: true });
export const reviewListsRouter = Router();

const selectReviewLists = `
  SELECT
    rl.id,
    rl.project_id AS "projectId",
    rl.title,
    rl.review_date AS date,
    rl.description,
    rl.created_at AS "createdAt",
    COALESCE(
      array_agg(rlv.version_id ORDER BY rlv.sort_order) FILTER (WHERE rlv.version_id IS NOT NULL),
      '{}'::uuid[]
    ) AS "versionIds"
  FROM review_lists rl
  LEFT JOIN review_list_versions rlv ON rlv.review_list_id = rl.id
`;

const requireProjectRouteAccess = async (
  projectId: string,
  userId: string,
  systemRole: string,
  capability: 'view' | 'create' | 'edit' | 'delete' = 'view',
): Promise<{ ok: true } | { ok: false; status: number; error: string }> => {
  if (!UUID_PATTERN.test(projectId)) return { ok: false, status: 400, error: '项目 ID 无效。' };
  const context = await getProjectPermissionContext(projectId, userId, systemRole);
  const ok = capability === 'view'
    ? canViewProject(context)
    : capability === 'create'
      ? canCreateReviewList(context)
      : canEditProject(context);
  if (!ok) return { ok: false, status: 403, error: '您没有操作该审核单的权限。' };
  return { ok: true };
};

const getReviewListProjectId = async (id: string): Promise<string | null> => {
  if (!UUID_PATTERN.test(id)) return null;
  const result = await pool.query<{ project_id: string }>(
    'SELECT project_id FROM review_lists WHERE id = $1',
    [id],
  );
  return result.rows[0]?.project_id || null;
};

const assertVersionsInProject = async (projectId: string, versionIds: string[]): Promise<boolean> => {
  if (versionIds.some(versionId => !UUID_PATTERN.test(versionId))) return false;
  if (!versionIds.length) return true;
  const result = await pool.query<{ id: string }>(
    `SELECT v.id
     FROM versions v
     JOIN tasks t ON t.id = v.task_id
     WHERE t.project_id = $1 AND v.id = ANY($2::uuid[])`,
    [projectId, versionIds],
  );
  return result.rowCount === new Set(versionIds).size;
};

const fetchReviewList = async (id: string) => {
  const result = await pool.query(
    `${selectReviewLists} WHERE rl.id = $1 GROUP BY rl.id`,
    [id],
  );
  return result.rows[0];
};

projectReviewListsRouter.get('/', asyncHandler(async (request, response) => {
  const projectId = request.params.projectId;
  const access = await requireProjectRouteAccess(projectId, request.authUser!.id, request.authUser!.role, 'view');
  if (access.ok !== true) {
    response.status(access.status).json({ error: access.error });
    return;
  }

  const result = await pool.query(
    `${selectReviewLists} WHERE rl.project_id = $1 GROUP BY rl.id ORDER BY rl.review_date DESC, rl.created_at DESC`,
    [projectId],
  );
  response.json({ reviewLists: result.rows });
}));

projectReviewListsRouter.post('/', asyncHandler(async (request, response) => {
  const projectId = request.params.projectId;
  const access = await requireProjectRouteAccess(projectId, request.authUser!.id, request.authUser!.role, 'create');
  if (access.ok !== true) {
    response.status(access.status).json({ error: access.error });
    return;
  }

  const versionIds = Array.isArray(request.body?.versionIds)
    ? request.body.versionIds.filter((value: unknown): value is string => typeof value === 'string')
    : [];
  if (!await assertVersionsInProject(projectId, versionIds)) {
    response.status(400).json({ error: '审核单包含不属于当前项目的版本。' });
    return;
  }

  const id = randomUUID();
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await client.query(
      `INSERT INTO review_lists (id, project_id, title, review_date, description, created_by)
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [
        id,
        projectId,
        readString(request.body?.title, '审核列表'),
        readString(request.body?.date, new Date().toISOString().slice(0, 10)),
        readString(request.body?.description),
        request.authUser!.id,
      ],
    );
    for (const [index, versionId] of versionIds.entries()) {
      await client.query(
        'INSERT INTO review_list_versions (review_list_id, version_id, sort_order) VALUES ($1, $2, $3)',
        [id, versionId, index],
      );
    }
    await client.query('COMMIT');
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }

  response.status(201).json({ reviewList: await fetchReviewList(id) });
}));

reviewListsRouter.patch('/:id', asyncHandler(async (request, response) => {
  const id = request.params.id;
  const projectId = await getReviewListProjectId(id);
  if (!projectId) {
    response.status(UUID_PATTERN.test(id) ? 404 : 400).json({ error: UUID_PATTERN.test(id) ? '审核单不存在。' : '审核单 ID 无效。' });
    return;
  }
  const access = await requireProjectRouteAccess(projectId, request.authUser!.id, request.authUser!.role, 'edit');
  if (access.ok !== true) {
    response.status(access.status).json({ error: access.error });
    return;
  }

  const versionIds = Array.isArray(request.body?.versionIds)
    ? request.body.versionIds.filter((value: unknown): value is string => typeof value === 'string')
    : undefined;
  if (versionIds && !await assertVersionsInProject(projectId, versionIds)) {
    response.status(400).json({ error: '审核单包含不属于当前项目的版本。' });
    return;
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await client.query(
      `UPDATE review_lists
       SET title = COALESCE($2, title),
           review_date = COALESCE($3, review_date),
           description = COALESCE($4, description),
           updated_at = now()
       WHERE id = $1`,
      [
        id,
        typeof request.body?.title === 'string' ? readString(request.body.title, '审核列表') : null,
        typeof request.body?.date === 'string' ? readString(request.body.date) : null,
        typeof request.body?.description === 'string' ? readString(request.body.description) : null,
      ],
    );
    if (versionIds) {
      await client.query('DELETE FROM review_list_versions WHERE review_list_id = $1', [id]);
      for (const [index, versionId] of versionIds.entries()) {
        await client.query(
          'INSERT INTO review_list_versions (review_list_id, version_id, sort_order) VALUES ($1, $2, $3)',
          [id, versionId, index],
        );
      }
    }
    await client.query('COMMIT');
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }

  response.json({ reviewList: await fetchReviewList(id) });
}));

reviewListsRouter.delete('/:id', asyncHandler(async (request, response) => {
  const id = request.params.id;
  const projectId = await getReviewListProjectId(id);
  if (!projectId) {
    response.status(UUID_PATTERN.test(id) ? 404 : 400).json({ error: UUID_PATTERN.test(id) ? '审核单不存在。' : '审核单 ID 无效。' });
    return;
  }
  const access = await requireProjectRouteAccess(projectId, request.authUser!.id, request.authUser!.role, 'delete');
  if (access.ok !== true) {
    response.status(access.status).json({ error: access.error });
    return;
  }
  await pool.query('DELETE FROM review_lists WHERE id = $1', [id]);
  response.status(204).end();
}));
