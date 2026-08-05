import { randomUUID } from 'node:crypto';
import { Router } from 'express';
import { pool } from './db';
import { asyncHandler, readString, requireProjectAccessFromRequest, UUID_PATTERN, requireProjectAccess } from './apiUtils';

export const scenesRouter = Router();

scenesRouter.get('/', asyncHandler(async (request, response) => {
  const projectId = await requireProjectAccessFromRequest(request, response);
  if (!projectId) return;
  const result = await pool.query(
    `SELECT sc.id, sc.project_id AS "projectId", sc.scene_code AS "sceneCode", sc.name,
            sc.description, count(sh.id)::int AS "shotCount"
       FROM scenes sc LEFT JOIN shots sh ON sh.scene_id = sc.id
      WHERE sc.project_id = $1
      GROUP BY sc.id
      ORDER BY sc.sort_order ASC, sc.scene_code ASC`,
    [projectId],
  );
  response.json({ scenes: result.rows });
}));

scenesRouter.post('/', asyncHandler(async (request, response) => {
  const projectId = await requireProjectAccessFromRequest(request, response);
  if (!projectId) return;
  const sceneCode = readString(request.body?.sceneCode).toUpperCase();
  const name = readString(request.body?.name, `场次 ${sceneCode}`);
  if (!/^[A-Z0-9._-]{1,40}$/.test(sceneCode) || !name) {
    response.status(400).json({ error: '场次编号或名称无效。' });
    return;
  }
  const result = await pool.query(
    `INSERT INTO scenes (id, project_id, scene_code, name, description)
     VALUES ($1, $2, $3, $4, $5)
     ON CONFLICT (project_id, scene_code) DO UPDATE SET name = EXCLUDED.name
     RETURNING id, project_id AS "projectId", scene_code AS "sceneCode", name, description, 0 AS "shotCount"`,
    [randomUUID(), projectId, sceneCode, name, readString(request.body?.description)],
  );
  response.status(201).json({ scene: result.rows[0] });
}));

scenesRouter.patch('/:id', asyncHandler(async (request, response) => {
  const id = request.params.id;
  if (!UUID_PATTERN.test(id)) { response.status(400).json({ error: '场次 ID 无效。' }); return; }
  const access = await pool.query('SELECT project_id FROM scenes WHERE id = $1', [id]);
  if (!access.rowCount) { response.status(404).json({ error: '场次不存在。' }); return; }
  if (!await requireProjectAccess(access.rows[0].project_id, request.authUser!.id, request.authUser!.role)) {
    response.status(403).json({ error: '您不是该项目的成员。' }); return;
  }
  const result = await pool.query(
    `UPDATE scenes SET name = coalesce($2, name), description = coalesce($3, description)
      WHERE id = $1 RETURNING id, project_id AS "projectId", scene_code AS "sceneCode", name, description`,
    [id, request.body?.name ?? null, request.body?.description ?? null],
  );
  response.json({ scene: result.rows[0] });
}));

scenesRouter.delete('/:id', asyncHandler(async (request, response) => {
  const id = request.params.id;
  const access = await pool.query('SELECT project_id FROM scenes WHERE id = $1', [id]);
  if (!access.rowCount) { response.status(404).json({ error: '场次不存在。' }); return; }
  if (!await requireProjectAccess(access.rows[0].project_id, request.authUser!.id, request.authUser!.role)) {
    response.status(403).json({ error: '您不是该项目的成员。' }); return;
  }
  await pool.query('DELETE FROM scenes WHERE id = $1', [id]);
  response.status(204).end();
}));
