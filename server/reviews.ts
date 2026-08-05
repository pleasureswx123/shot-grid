import { randomUUID } from 'node:crypto';
import { Router } from 'express';
import type { PoolClient } from 'pg';
import { pool } from './db';
import { UUID_PATTERN, asyncHandler, readString } from './apiUtils';
import { canCreateReviewList, canEditProject, canViewProject, getProjectPermissionContext } from './permissions';

export const projectReviewListsRouter = Router({ mergeParams: true });
export const reviewListsRouter = Router();

type ReviewListStatus = '草稿' | '待审核' | '审核中' | '已完成' | '已归档';
const COMPLETING_VERSION_STATUSES = ['已通过', '最终版'];

const selectReviewLists = `
  SELECT
    rl.id,
    rl.project_id AS "projectId",
    rl.title,
    rl.review_date AS date,
    rl.description,
    rl.status,
    rl.round_number AS "roundNumber",
    rl.due_at AS "dueAt",
    rl.created_by AS "createdBy",
    rl.submitted_by AS "submittedBy",
    rl.submitted_at AS "submittedAt",
    rl.completed_at AS "completedAt",
    rl.created_at AS "createdAt",
    COALESCE((
      SELECT array_agg(rlv.version_id ORDER BY rlv.sort_order)
      FROM review_list_versions rlv
      WHERE rlv.review_list_id = rl.id
    ), '{}'::uuid[]) AS "versionIds",
    COALESCE((
      SELECT jsonb_agg(jsonb_build_object(
        'userId', rlp.user_id,
        'role', rlp.participant_role,
        'hasCompleted', rlp.has_completed,
        'completedAt', rlp.completed_at
      ) ORDER BY rlp.created_at)
      FROM review_list_participants rlp
      WHERE rlp.review_list_id = rl.id
    ), '[]'::jsonb) AS participants
  FROM review_lists rl
`;

const requireProjectRouteAccess = async (
  projectId: string,
  userId: string,
  systemRole: string,
  capability: 'view' | 'create' | 'edit' | 'delete' = 'view',
): Promise<{ ok: true; isAdmin: boolean } | { ok: false; status: number; error: string }> => {
  if (!UUID_PATTERN.test(projectId)) return { ok: false, status: 400, error: '项目 ID 无效。' };
  const context = await getProjectPermissionContext(projectId, userId, systemRole);
  const ok = capability === 'view'
    ? canViewProject(context)
    : capability === 'create'
      ? canCreateReviewList(context)
      : canEditProject(context);
  if (!ok) return { ok: false, status: 403, error: '您没有操作该审核单的权限。' };
  return { ok: true, isAdmin: systemRole === 'admin' || context.projectRole === 'admin' || context.projectRole === 'director' };
};

const getReviewListProjectId = async (id: string): Promise<string | null> => {
  if (!UUID_PATTERN.test(id)) return null;
  const result = await pool.query<{ project_id: string }>('SELECT project_id FROM review_lists WHERE id = $1', [id]);
  return result.rows[0]?.project_id || null;
};

const assertVersionsInProject = async (projectId: string, versionIds: string[]): Promise<boolean> => {
  if (versionIds.some(versionId => !UUID_PATTERN.test(versionId))) return false;
  if (!versionIds.length) return true;
  const result = await pool.query<{ id: string }>(
    `SELECT v.id FROM versions v JOIN tasks t ON t.id = v.task_id WHERE t.project_id = $1 AND v.id = ANY($2::uuid[])`,
    [projectId, versionIds],
  );
  return result.rowCount === new Set(versionIds).size;
};

const fetchReviewList = async (id: string) => {
  const result = await pool.query(`${selectReviewLists} WHERE rl.id = $1 GROUP BY rl.id`, [id]);
  return result.rows[0];
};

const syncCompletion = async (id: string) => {
  const result = await pool.query<{ incomplete_versions: string; incomplete_participants: string; status: ReviewListStatus }>(
    `SELECT rl.status,
      COUNT(rlv.version_id) FILTER (WHERE v.status IS NULL OR v.status <> ALL($2::text[])) AS incomplete_versions,
      COUNT(rlp.user_id) FILTER (WHERE rlp.has_completed = false AND rlp.participant_role <> '观察者') AS incomplete_participants
     FROM review_lists rl
     LEFT JOIN review_list_versions rlv ON rlv.review_list_id = rl.id
     LEFT JOIN versions v ON v.id = rlv.version_id
     LEFT JOIN review_list_participants rlp ON rlp.review_list_id = rl.id
     WHERE rl.id = $1
     GROUP BY rl.id`,
    [id, COMPLETING_VERSION_STATUSES],
  );
  const row = result.rows[0];
  if (row && !['草稿', '已完成', '已归档'].includes(row.status) && Number(row.incomplete_versions) === 0 && Number(row.incomplete_participants) === 0) {
    await pool.query(`UPDATE review_lists SET status = '已完成', completed_at = COALESCE(completed_at, now()), updated_at = now() WHERE id = $1`, [id]);
  }
};

const upsertParticipants = async (client: PoolClient, id: string, participants: unknown) => {
  if (!Array.isArray(participants)) return;
  await client.query('DELETE FROM review_list_participants WHERE review_list_id = $1', [id]);
  for (const participant of participants) {
    const userId = typeof participant?.userId === 'string' ? participant.userId : '';
    const role = ['审核人', '客户', '观察者'].includes(participant?.role) ? participant.role : '审核人';
    if (UUID_PATTERN.test(userId)) {
      await client.query('INSERT INTO review_list_participants (review_list_id, user_id, participant_role, has_completed) VALUES ($1, $2, $3, $4)', [id, userId, role, Boolean(participant?.hasCompleted)]);
    }
  }
};

projectReviewListsRouter.get('/', asyncHandler(async (request, response) => {
  const projectId = request.params.projectId;
  const access = await requireProjectRouteAccess(projectId, request.authUser!.id, request.authUser!.role, 'view');
  if (access.ok !== true) return void response.status(access.status).json({ error: access.error });
  const result = await pool.query(`${selectReviewLists} WHERE rl.project_id = $1 GROUP BY rl.id ORDER BY rl.review_date DESC, rl.created_at DESC`, [projectId]);
  response.json({ reviewLists: result.rows });
}));

projectReviewListsRouter.post('/', asyncHandler(async (request, response) => {
  const projectId = request.params.projectId;
  const access = await requireProjectRouteAccess(projectId, request.authUser!.id, request.authUser!.role, 'create');
  if (access.ok !== true) return void response.status(access.status).json({ error: access.error });
  const versionIds = Array.isArray(request.body?.versionIds) ? request.body.versionIds.filter((value: unknown): value is string => typeof value === 'string') : [];
  if (!await assertVersionsInProject(projectId, versionIds)) return void response.status(400).json({ error: '审核单包含不属于当前项目的版本。' });
  const id = randomUUID();
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await client.query(
      `INSERT INTO review_lists (id, project_id, title, review_date, description, created_by, round_number, due_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
      [id, projectId, readString(request.body?.title, '审核列表'), readString(request.body?.date, new Date().toISOString().slice(0, 10)), readString(request.body?.description), request.authUser!.id, Number(request.body?.roundNumber) || 1, request.body?.dueAt || null],
    );
    for (const [index, versionId] of versionIds.entries()) await client.query('INSERT INTO review_list_versions (review_list_id, version_id, sort_order) VALUES ($1, $2, $3)', [id, versionId, index]);
    await upsertParticipants(client, id, request.body?.participants);
    await client.query('COMMIT');
  } catch (error) { await client.query('ROLLBACK'); throw error; } finally { client.release(); }
  response.status(201).json({ reviewList: await fetchReviewList(id) });
}));

reviewListsRouter.patch('/:id', asyncHandler(async (request, response) => {
  const id = request.params.id;
  const projectId = await getReviewListProjectId(id);
  if (!projectId) return void response.status(UUID_PATTERN.test(id) ? 404 : 400).json({ error: UUID_PATTERN.test(id) ? '审核单不存在。' : '审核单 ID 无效。' });
  const access = await requireProjectRouteAccess(projectId, request.authUser!.id, request.authUser!.role, 'edit');
  if (access.ok !== true) return void response.status(access.status).json({ error: access.error });
  const current = await fetchReviewList(id);
  const changingVersions = Array.isArray(request.body?.versionIds);
  if (changingVersions && current.status !== '草稿' && !access.isAdmin && current.createdBy !== request.authUser!.id) return void response.status(403).json({ error: '进入待审核后，只有管理员或发起人可修改版本列表。' });
  const versionIds = changingVersions ? request.body.versionIds.filter((value: unknown): value is string => typeof value === 'string') : undefined;
  if (versionIds && !await assertVersionsInProject(projectId, versionIds)) return void response.status(400).json({ error: '审核单包含不属于当前项目的版本。' });
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await client.query(
      `UPDATE review_lists SET title = COALESCE($2, title), review_date = COALESCE($3, review_date), description = COALESCE($4, description), round_number = COALESCE($5, round_number), due_at = COALESCE($6, due_at), updated_at = now() WHERE id = $1`,
      [id, typeof request.body?.title === 'string' ? readString(request.body.title, '审核列表') : null, typeof request.body?.date === 'string' ? readString(request.body.date) : null, typeof request.body?.description === 'string' ? readString(request.body.description) : null, Number(request.body?.roundNumber) || null, request.body?.dueAt || null],
    );
    if (versionIds) {
      await client.query('DELETE FROM review_list_versions WHERE review_list_id = $1', [id]);
      for (const [index, versionId] of versionIds.entries()) await client.query('INSERT INTO review_list_versions (review_list_id, version_id, sort_order) VALUES ($1, $2, $3)', [id, versionId, index]);
    }
    await upsertParticipants(client, id, request.body?.participants);
    await client.query('COMMIT');
  } catch (error) { await client.query('ROLLBACK'); throw error; } finally { client.release(); }
  await syncCompletion(id);
  response.json({ reviewList: await fetchReviewList(id) });
}));

reviewListsRouter.post('/:id/submit', asyncHandler(async (request, response) => {
  const id = request.params.id;
  const projectId = await getReviewListProjectId(id);
  if (!projectId) return void response.status(UUID_PATTERN.test(id) ? 404 : 400).json({ error: UUID_PATTERN.test(id) ? '审核单不存在。' : '审核单 ID 无效。' });
  const access = await requireProjectRouteAccess(projectId, request.authUser!.id, request.authUser!.role, 'edit');
  if (access.ok !== true) return void response.status(access.status).json({ error: access.error });
  await pool.query(`UPDATE review_lists SET status = CASE WHEN EXISTS (SELECT 1 FROM review_list_participants WHERE review_list_id = $1) THEN '待审核' ELSE '审核中' END, submitted_by = $2, submitted_at = COALESCE(submitted_at, now()), updated_at = now() WHERE id = $1 AND status = '草稿'`, [id, request.authUser!.id]);
  await syncCompletion(id);
  response.json({ reviewList: await fetchReviewList(id) });
}));

reviewListsRouter.post('/:id/participants/:userId/complete', asyncHandler(async (request, response) => {
  const { id, userId } = request.params;
  const projectId = await getReviewListProjectId(id);
  if (!projectId || !UUID_PATTERN.test(userId)) return void response.status(400).json({ error: '审核单或参与人 ID 无效。' });
  const view = await requireProjectRouteAccess(projectId, request.authUser!.id, request.authUser!.role, 'view');
  if (view.ok !== true) return void response.status(view.status).json({ error: view.error });
  const edit = await requireProjectRouteAccess(projectId, request.authUser!.id, request.authUser!.role, 'edit');
  if (request.authUser!.id !== userId && edit.ok !== true) return void response.status(403).json({ error: '只能完成自己的审核，或由管理员代为完成。' });
  const completed = request.body?.hasCompleted !== false;
  await pool.query(`UPDATE review_list_participants SET has_completed = $3, completed_at = CASE WHEN $3 THEN now() ELSE NULL END WHERE review_list_id = $1 AND user_id = $2`, [id, userId, completed]);
  await pool.query(`UPDATE review_lists SET status = '审核中', updated_at = now() WHERE id = $1 AND status = '待审核'`, [id]);
  await syncCompletion(id);
  response.json({ reviewList: await fetchReviewList(id) });
}));

reviewListsRouter.post('/:id/complete', asyncHandler(async (request, response) => {
  const id = request.params.id;
  const projectId = await getReviewListProjectId(id);
  if (!projectId) return void response.status(UUID_PATTERN.test(id) ? 404 : 400).json({ error: UUID_PATTERN.test(id) ? '审核单不存在。' : '审核单 ID 无效。' });
  const access = await requireProjectRouteAccess(projectId, request.authUser!.id, request.authUser!.role, 'edit');
  if (access.ok !== true) return void response.status(access.status).json({ error: access.error });
  await syncCompletion(id);
  const reviewList = await fetchReviewList(id);
  if (reviewList.status !== '已完成') return void response.status(409).json({ error: '所有版本通过或最终版，且审核参与人完成后才能完成审核单。' });
  response.json({ reviewList });
}));

reviewListsRouter.post('/:id/archive', asyncHandler(async (request, response) => {
  const id = request.params.id;
  const projectId = await getReviewListProjectId(id);
  if (!projectId) return void response.status(UUID_PATTERN.test(id) ? 404 : 400).json({ error: UUID_PATTERN.test(id) ? '审核单不存在。' : '审核单 ID 无效。' });
  const access = await requireProjectRouteAccess(projectId, request.authUser!.id, request.authUser!.role, 'edit');
  if (access.ok !== true) return void response.status(access.status).json({ error: access.error });
  await pool.query(`UPDATE review_lists SET status = '已归档', updated_at = now() WHERE id = $1 AND status = ANY($2::text[])`, [id, ['已完成', '审核中', '待审核']]);
  response.json({ reviewList: await fetchReviewList(id) });
}));

reviewListsRouter.delete('/:id', asyncHandler(async (request, response) => {
  const id = request.params.id;
  const projectId = await getReviewListProjectId(id);
  if (!projectId) return void response.status(UUID_PATTERN.test(id) ? 404 : 400).json({ error: UUID_PATTERN.test(id) ? '审核单不存在。' : '审核单 ID 无效。' });
  const access = await requireProjectRouteAccess(projectId, request.authUser!.id, request.authUser!.role, 'delete');
  if (access.ok !== true) return void response.status(access.status).json({ error: access.error });
  await pool.query('DELETE FROM review_lists WHERE id = $1', [id]);
  response.status(204).end();
}));
