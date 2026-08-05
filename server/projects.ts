import { randomUUID } from 'node:crypto';
import { Router } from 'express';
import type { NextFunction, Request, RequestHandler, Response } from 'express';
import type { UserRole } from '../src/types';
import { pool } from './db';
import { requireRole } from './permissions';
import {
  ensureProjectStorageStructure,
  ensureShotStorageStructure,
  PROJECT_DIRECTORY_STRUCTURE,
  removeProjectStorageStructure,
  removeShotStorageStructure,
  resolveWithinStorage,
} from './storage';

const PROJECT_ROLES: UserRole[] = ['admin', 'director', 'creator', 'client'];
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const asyncHandler = (
  handler: (request: Request, response: Response, next: NextFunction) => Promise<void>,
): RequestHandler => (request, response, next) => {
  handler(request, response, next).catch(next);
};


const canReadProject = async (projectId: string, userId: string, systemRole: UserRole) => {
  if (systemRole === 'admin') return true;
  const result = await pool.query(
    `SELECT 1
       FROM project_members
      WHERE project_id = $1
        AND user_id = $2`,
    [projectId, userId],
  );
  return Boolean(result.rowCount);
};

const canManageProject = async (projectId: string, userId: string, systemRole: UserRole) => {
  if (systemRole === 'admin') return true;
  const result = await pool.query(
    `SELECT 1
       FROM project_members
      WHERE project_id = $1
        AND user_id = $2
        AND project_role IN ('admin', 'director')`,
    [projectId, userId],
  );
  return Boolean(result.rowCount);
};

const canWriteProject = async (projectId: string, userId: string, systemRole: UserRole) => {
  if (systemRole === 'admin') return true;
  const result = await pool.query(
    `SELECT 1
       FROM project_members
      WHERE project_id = $1
        AND user_id = $2
        AND project_role IN ('admin', 'director', 'creator')`,
    [projectId, userId],
  );
  return Boolean(result.rowCount);
};

export const projectsRouter = Router();

projectsRouter.get('/', asyncHandler(async (request, response) => {
  const result = await pool.query(
    `SELECT p.id, p.name, p.code, p.project_type AS "type",
            p.aspect_ratio AS "aspectRatio",
            p.total_duration_min::float8 AS "totalDurationMin",
            p.delivery_date AS "deliveryDate",
            p.director_id AS "directorId", p.status,
            p.current_phase AS "currentPhase",
            p.storage_key AS "storageKey",
            coalesce(pm.project_role, 'admin') AS "projectRole",
            count(DISTINCT s.id)::int AS "totalShots",
            count(DISTINCT s.id) FILTER (
              WHERE s.status IN ('已完成', '已锁定')
            )::int AS "completedShots"
       FROM projects p
       LEFT JOIN project_members pm
         ON pm.project_id = p.id AND pm.user_id = $1
       LEFT JOIN shots s ON s.project_id = p.id
      WHERE pm.user_id IS NOT NULL OR $2 = 'admin'
      GROUP BY p.id, pm.project_role
      ORDER BY p.updated_at DESC`,
    [request.authUser!.id, request.authUser!.role],
  );
  response.json({
    projects: result.rows.map(project => ({
      ...project,
      storagePath: resolveWithinStorage(project.storageKey),
      storageDirectories: [...PROJECT_DIRECTORY_STRUCTURE],
    })),
  });
}));

projectsRouter.post(
  '/',
  requireRole('admin', 'director'),
  asyncHandler(async (request, response) => {
    const name = typeof request.body?.name === 'string' ? request.body.name.trim() : '';
    const code = typeof request.body?.code === 'string'
      ? request.body.code.trim().toUpperCase()
      : '';
    const type = typeof request.body?.type === 'string' ? request.body.type.trim() : '';
    const aspectRatio = typeof request.body?.aspectRatio === 'string'
      ? request.body.aspectRatio.trim()
      : '16:9';

    if (!name || name.length > 200 || !/^[A-Z0-9_-]{2,40}$/.test(code)) {
      response.status(400).json({ error: '项目名称或项目代号无效。' });
      return;
    }

    const projectId = randomUUID();
    const client = await pool.connect();
    let createdStorageKey: string | null = null;
    try {
      await client.query('BEGIN');
      const storageKey = code;
      const created = await client.query(
        `INSERT INTO projects (
          id, name, code, project_type, aspect_ratio, director_id, status,
          current_phase, storage_key
        ) VALUES ($1, $2, $3, $4, $5, $6, '筹备中', '筹备中', $7)
        RETURNING id, name, code, project_type AS "type",
                  aspect_ratio AS "aspectRatio", status,
                  current_phase AS "currentPhase",
                  storage_key AS "storageKey"`,
        [projectId, name, code, type, aspectRatio, request.authUser!.id, storageKey],
      );
      const ownerProjectRole = request.authUser!.role === 'admin' ? 'admin' : 'director';
      await client.query(
        `INSERT INTO project_members (project_id, user_id, project_role)
         VALUES ($1, $2, $3)`,
        [projectId, request.authUser!.id, ownerProjectRole],
      );
      const soundTaskId = randomUUID();
      await client.query(
        `INSERT INTO tasks (
          id, project_id, title, entity_type, entity_id, pipeline_stage,
          assignee_id, status, priority, due_date, requirements
        ) VALUES
          ($1, $2, $3, 'project', $2, '声音', $4, '未开始', '高', now()::date + 12, $5),
          ($6, $2, $7, 'project', $2, '成片', $4, '未开始', '高', now()::date + 14, $8)`,
        [
          soundTaskId,
          projectId,
          `${name} - 整片声音制作`,
          request.authUser!.id,
          '覆盖整部影片的对白、音效、环境声、音乐与最终混音。',
          randomUUID(),
          `${name} - 成片合成与交付`,
          '覆盖整部影片的最终画面、声音合成、质检、输出与交付。',
        ],
      );
      await client.query(
        `INSERT INTO audit_logs (
          actor_id, project_id, action, entity_type, entity_id, details, ip_address
        ) VALUES ($1, $2, 'project.create', 'project', $3, $4::jsonb, $5)`,
        [
          request.authUser!.id,
          projectId,
          projectId,
          JSON.stringify({ name, code, storageKey }),
          request.ip || null,
        ],
      );
      const storage = await ensureProjectStorageStructure({
        projectId,
        projectCode: code,
        projectName: name,
        requireNewRoot: true,
      });
      createdStorageKey = storage.storageKey;
      await client.query('COMMIT');
      response.status(201).json({
        project: {
          ...created.rows[0],
          storagePath: storage.absolutePath,
          storageDirectories: storage.directories,
        },
      });
    } catch (error: any) {
      await client.query('ROLLBACK');
      if (createdStorageKey) {
        await removeProjectStorageStructure(createdStorageKey).catch(() => undefined);
      }
      if (error?.code === '23505') {
        response.status(409).json({ error: '项目代号已经存在。' });
        return;
      }
      if (error?.code === 'EEXIST') {
        response.status(409).json({
          error: `本地项目目录 ${code} 已存在，请更换项目代号或联系管理员导入现有目录。`,
        });
        return;
      }
      throw error;
    } finally {
      client.release();
    }
  }),
);

projectsRouter.post('/:projectId/storage/shots', asyncHandler(async (request, response) => {
  const projectId = request.params.projectId;
  const requestedShots = Array.isArray(request.body?.shots) ? request.body.shots : [];
  if (!UUID_PATTERN.test(projectId) || !requestedShots.length || requestedShots.length > 500) {
    response.status(400).json({ error: '项目或镜头目录请求无效。' });
    return;
  }
  if (!await canReadProject(projectId, request.authUser!.id, request.authUser!.role)) {
    response.status(403).json({ error: '您没有在该项目创建镜头目录的权限。' });
    return;
  }

  const shots = requestedShots.map((shot: any) => ({
    shotId: typeof shot?.shotId === 'string' ? shot.shotId.trim().slice(0, 120) : '',
    shotCode: typeof shot?.shotCode === 'string' ? shot.shotCode.trim().toUpperCase() : '',
    sceneCode: typeof shot?.sceneCode === 'string' ? shot.sceneCode.trim().toUpperCase() : '',
  }));
  if (shots.some(shot =>
    !/^[A-Z0-9._-]{1,80}$/.test(shot.shotCode) ||
    !/^[A-Z0-9._-]{1,80}$/.test(shot.sceneCode)
  )) {
    response.status(400).json({
      error: '镜头编号或场次编号只能包含字母、数字、点、下划线和连字符。',
    });
    return;
  }
  if (new Set(shots.map(shot => shot.shotCode)).size !== shots.length) {
    response.status(400).json({ error: '同一次请求中存在重复镜头编号。' });
    return;
  }

  const projectResult = await pool.query<{ code: string }>(
    'SELECT code FROM projects WHERE id = $1',
    [projectId],
  );
  if (!projectResult.rowCount) {
    response.status(404).json({ error: '项目不存在。' });
    return;
  }

  const directories: Awaited<ReturnType<typeof ensureShotStorageStructure>>[] = [];
  const createdDirectories: Array<{ shotCode: string }> = [];
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    for (const shot of shots) {
      const directory = await ensureShotStorageStructure({
        projectCode: projectResult.rows[0].code,
        shotId: shot.shotId,
        shotCode: shot.shotCode,
        sceneCode: shot.sceneCode,
      });
      directories.push(directory);
      if (directory.createdRoot) createdDirectories.push({ shotCode: shot.shotCode });
    }
    await client.query(
      `INSERT INTO audit_logs (
        actor_id, project_id, action, entity_type, entity_id, details, ip_address
      ) VALUES ($1, $2, 'storage.shots.ensure', 'project', $3, $4::jsonb, $5)`,
      [
        request.authUser!.id,
        projectId,
        projectId,
        JSON.stringify({
          count: directories.length,
          shots: shots.map(shot => ({ shotCode: shot.shotCode, sceneCode: shot.sceneCode })),
        }),
        request.ip || null,
      ],
    );
    await client.query('COMMIT');
    response.status(201).json({ directories });
  } catch (error) {
    await client.query('ROLLBACK');
    await Promise.all(createdDirectories.map(directory =>
      removeShotStorageStructure(projectResult.rows[0].code, directory.shotCode).catch(() => undefined)
    ));
    throw error;
  } finally {
    client.release();
  }
}));

projectsRouter.get('/:projectId/members', asyncHandler(async (request, response) => {
  const projectId = request.params.projectId;
  if (!UUID_PATTERN.test(projectId)) {
    response.status(400).json({ error: '项目 ID 无效。' });
    return;
  }
  const access = await pool.query(
    'SELECT 1 FROM project_members WHERE project_id = $1 AND user_id = $2',
    [projectId, request.authUser!.id],
  );
  if (!access.rowCount && request.authUser!.role !== 'admin') {
    response.status(403).json({ error: '您不是该项目的成员。' });
    return;
  }

  const result = await pool.query(
    `SELECT u.id, u.name, u.email, u.role, u.department, u.avatar,
            u.is_active AS "isActive", pm.project_role AS "projectRole",
            pm.joined_at AS "joinedAt"
       FROM project_members pm
       JOIN users u ON u.id = pm.user_id
      WHERE pm.project_id = $1
      ORDER BY pm.joined_at ASC`,
    [projectId],
  );
  response.json({ members: result.rows });
}));

projectsRouter.post('/:projectId/members', asyncHandler(async (request, response) => {
  const projectId = request.params.projectId;
  const userId = typeof request.body?.userId === 'string' ? request.body.userId : '';
  const projectRole = request.body?.projectRole as UserRole;

  if (!UUID_PATTERN.test(projectId) || !UUID_PATTERN.test(userId) || !PROJECT_ROLES.includes(projectRole)) {
    response.status(400).json({ error: '成员或项目角色无效。' });
    return;
  }
  if (!await canManageProject(projectId, request.authUser!.id, request.authUser!.role)) {
    response.status(403).json({ error: '您没有管理该项目成员的权限。' });
    return;
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const userExists = await client.query(
      'SELECT 1 FROM users WHERE id = $1 AND is_active = true',
      [userId],
    );
    if (!userExists.rowCount) {
      await client.query('ROLLBACK');
      response.status(404).json({ error: '员工账号不存在或已停用。' });
      return;
    }

    const result = await client.query(
      `INSERT INTO project_members (project_id, user_id, project_role)
       VALUES ($1, $2, $3)
       ON CONFLICT (project_id, user_id)
       DO UPDATE SET project_role = EXCLUDED.project_role
       RETURNING project_id AS "projectId", user_id AS "userId",
                 project_role AS "projectRole", joined_at AS "joinedAt"`,
      [projectId, userId, projectRole],
    );
    await client.query(
      `INSERT INTO audit_logs (
        actor_id, project_id, action, entity_type, entity_id, details, ip_address
      ) VALUES ($1, $2, 'project.member.upsert', 'user', $3, $4::jsonb, $5)`,
      [
        request.authUser!.id,
        projectId,
        userId,
        JSON.stringify({ projectRole }),
        request.ip || null,
      ],
    );
    await client.query('COMMIT');
    response.status(201).json({ member: result.rows[0] });
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}));

projectsRouter.delete('/:projectId/members/:userId', asyncHandler(async (request, response) => {
  const { projectId, userId } = request.params;
  if (!UUID_PATTERN.test(projectId) || !UUID_PATTERN.test(userId)) {
    response.status(400).json({ error: '项目或成员 ID 无效。' });
    return;
  }
  if (!await canManageProject(projectId, request.authUser!.id, request.authUser!.role)) {
    response.status(403).json({ error: '您没有管理该项目成员的权限。' });
    return;
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const membership = await client.query<{ project_role: UserRole }>(
      `SELECT project_role
         FROM project_members
        WHERE project_id = $1 AND user_id = $2
        FOR UPDATE`,
      [projectId, userId],
    );
    if (!membership.rowCount) {
      await client.query('ROLLBACK');
      response.status(404).json({ error: '该员工不是项目成员。' });
      return;
    }

    if (['admin', 'director'].includes(membership.rows[0].project_role)) {
      const managerCount = await client.query<{ count: string }>(
        `SELECT count(*)::text AS count
           FROM project_members
          WHERE project_id = $1
            AND project_role IN ('admin', 'director')`,
        [projectId],
      );
      if (Number(managerCount.rows[0].count) <= 1) {
        await client.query('ROLLBACK');
        response.status(409).json({ error: '不能移除项目最后一名管理员或总监。' });
        return;
      }
    }

    await client.query(
      'DELETE FROM project_members WHERE project_id = $1 AND user_id = $2',
      [projectId, userId],
    );
    await client.query(
      `INSERT INTO audit_logs (
        actor_id, project_id, action, entity_type, entity_id, ip_address
      ) VALUES ($1, $2, 'project.member.remove', 'user', $3, $4)`,
      [request.authUser!.id, projectId, userId, request.ip || null],
    );
    await client.query('COMMIT');
    response.status(204).end();
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}));

projectsRouter.get('/:projectId/versions', asyncHandler(async (request, response) => {
  const projectId = request.params.projectId;
  if (!UUID_PATTERN.test(projectId)) {
    response.status(400).json({ error: '项目 ID 无效。' });
    return;
  }
  if (!await canReadProject(projectId, request.authUser!.id, request.authUser!.role)) {
    response.status(403).json({ error: '您不是该项目的成员。' });
    return;
  }
  const result = await pool.query(
    `SELECT id, task_id AS "taskId", entity_type AS "entityType", entity_id AS "entityId",
            version_number AS "versionNumber", file_id AS "fileId", file_url AS "fileUrl",
            file_type AS "fileType", thumbnail_url AS "thumbnailUrl", uploader_id AS "uploaderId",
            created_at AS "createdAt", changelog, status, ai_params AS "aiParams"
       FROM versions
      WHERE task_id IN (SELECT id FROM tasks WHERE project_id=$1)
      ORDER BY created_at DESC`,
    [projectId],
  );
  response.json({ versions: result.rows });
}));
