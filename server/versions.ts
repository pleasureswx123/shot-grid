import { randomUUID } from 'node:crypto';
import { Router } from 'express';
import { pool } from './db';
import { asyncHandler, readString, requireProjectAccess, requireProjectAccessFromRequest, UUID_PATTERN } from './apiUtils';
import { validateEntityBelongsToProject } from './entityValidation';

export const versionsRouter = Router();

export const versionSelect = `SELECT id, task_id AS "taskId", entity_type AS "entityType", entity_id AS "entityId", version_number AS "versionNumber", file_id AS "fileId", file_url AS "fileUrl", file_type AS "fileType", thumbnail_url AS "thumbnailUrl", uploader_id AS "uploaderId", created_at AS "createdAt", changelog, status, ai_params AS "aiParams" FROM versions`;

const normalizeFileUrl = (fileId: unknown, fileUrl: unknown) => {
  if (typeof fileId === 'string' && UUID_PATTERN.test(fileId)) return `/api/files/${fileId}/content`;
  return readString(fileUrl);
};

versionsRouter.get('/', asyncHandler(async (req, res) => {
  const projectId = await requireProjectAccessFromRequest(req, res);
  if (!projectId) return;
  const r = await pool.query(`${versionSelect} WHERE task_id IN (SELECT id FROM tasks WHERE project_id=$1) ORDER BY created_at DESC`, [projectId]);
  res.json({ versions: r.rows });
}));

versionsRouter.post('/', asyncHandler(async (req, res) => {
  const task = await pool.query('SELECT project_id,entity_type,entity_id FROM tasks WHERE id=$1', [req.body?.taskId]);
  if (!task.rowCount) { res.status(404).json({ error: '任务不存在。' }); return; }
  const { project_id: projectId, entity_type: entityType, entity_id: entityId } = task.rows[0];
  if (!await requireProjectAccess(projectId, req.authUser!.id, req.authUser!.role)) { res.status(403).json({ error: '您不是该项目的成员。' }); return; }
  const validationError = validateEntityBelongsToProject(entityType, entityId, projectId);
  if (validationError) { res.status(400).json({ error: validationError }); return; }

  const fileId = typeof req.body?.fileId === 'string' && UUID_PATTERN.test(req.body.fileId) ? req.body.fileId : null;
  const fileUrl = normalizeFileUrl(fileId, req.body?.fileUrl);
  if (!fileUrl) { res.status(400).json({ error: '请先上传文件或提供文件 URL。' }); return; }
  if (fileId) {
    const file = await pool.query('SELECT 1 FROM project_files WHERE id=$1 AND project_id=$2 AND deleted_at IS NULL', [fileId, projectId]);
    if (!file.rowCount) { res.status(400).json({ error: '文件不存在或不属于当前项目。' }); return; }
  }

  const id = randomUUID();
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await client.query(`INSERT INTO versions (id,task_id,entity_type,entity_id,version_number,file_id,file_url,file_type,thumbnail_url,uploader_id,changelog,status,ai_params) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13::jsonb)`, [id, req.body.taskId, entityType, entityId, readString(req.body?.versionNumber, 'V001'), fileId, fileUrl, readString(req.body?.fileType, 'image'), readString(req.body?.thumbnailUrl), req.authUser!.id, readString(req.body?.changelog), readString(req.body?.status, '待审核'), JSON.stringify(req.body?.aiParams ?? null)]);
    await client.query('UPDATE tasks SET latest_version_id=$1,status=$2 WHERE id=$3', [id, '待审核', req.body.taskId]);
    if (entityType !== 'project') await client.query(`UPDATE ${entityType === 'shot' ? 'shots' : 'assets'} SET latest_version_id=$1,status=$2,thumbnail_url=coalesce(nullif($3,''),thumbnail_url) WHERE id=$4`, [id, '审核中', readString(req.body?.thumbnailUrl), entityId]);
    const r = await client.query(`${versionSelect} WHERE id=$1`, [id]);
    await client.query('COMMIT');
    res.status(201).json({ version: r.rows[0] });
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}));

versionsRouter.patch('/:id/status', asyncHandler(async (req, res) => {
  const a = await pool.query('SELECT t.project_id,v.entity_type,v.entity_id FROM versions v JOIN tasks t ON t.id=v.task_id WHERE v.id=$1', [req.params.id]);
  if (!a.rowCount) { res.status(404).json({ error: '版本不存在。' }); return; }
  if (!await requireProjectAccess(a.rows[0].project_id, req.authUser!.id, req.authUser!.role)) { res.status(403).json({ error: '您不是该项目的成员。' }); return; }
  const validationError = validateEntityBelongsToProject(a.rows[0].entity_type, a.rows[0].entity_id, a.rows[0].project_id);
  if (validationError) { res.status(400).json({ error: validationError }); return; }
  const r = await pool.query(`WITH updated AS (UPDATE versions SET status=coalesce($2,status) WHERE id=$1 RETURNING *) ${versionSelect.replace('FROM versions', 'FROM updated')}`, [req.params.id, req.body?.status ?? null]);
  res.json({ version: r.rows[0] });
}));

versionsRouter.patch('/:id', asyncHandler(async (req, res) => {
  const a = await pool.query('SELECT t.project_id,v.entity_type,v.entity_id FROM versions v JOIN tasks t ON t.id=v.task_id WHERE v.id=$1', [req.params.id]);
  if (!a.rowCount) { res.status(404).json({ error: '版本不存在。' }); return; }
  if (!await requireProjectAccess(a.rows[0].project_id, req.authUser!.id, req.authUser!.role)) { res.status(403).json({ error: '您不是该项目的成员。' }); return; }
  const validationError = validateEntityBelongsToProject(a.rows[0].entity_type, a.rows[0].entity_id, a.rows[0].project_id);
  if (validationError) { res.status(400).json({ error: validationError }); return; }
  const r = await pool.query(`WITH updated AS (UPDATE versions SET status=coalesce($2,status) WHERE id=$1 RETURNING *) ${versionSelect.replace('FROM versions', 'FROM updated')}`, [req.params.id, req.body?.status ?? null]);
  res.json({ version: r.rows[0] });
}));
