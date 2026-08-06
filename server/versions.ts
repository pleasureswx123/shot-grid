import { randomUUID } from 'node:crypto';
import { Response, Router } from 'express';
import { pool } from './db';
import { asyncHandler, readString, requireProjectAccessFromRequest, UUID_PATTERN } from './apiUtils';
import { validateEntityBelongsToProject } from './entityValidation';
import { AUDIT_EVENTS, recordAuditLog } from './audit';
import { canReviewVersion, canSubmitVersion, getProjectPermissionContext } from './permissions';
import { serializeVersionForRole } from './versionSerialization';
import { applyVersionStatusEffects, assertVersionStatusTransition, isEntityLockedForNonAdmin, recalculateEntityStatus } from './workflow';

export const versionsRouter = Router();

export const versionSelect = `SELECT id, task_id AS "taskId", entity_type AS "entityType", entity_id AS "entityId", version_number AS "versionNumber", file_url AS "fileUrl", file_type AS "fileType", thumbnail_url AS "thumbnailUrl", uploader_id AS "uploaderId", created_at AS "createdAt", changelog, status, ai_params AS "aiParams" FROM versions`;

const normalizeFileUrl = (fileId: unknown, fileUrl: unknown) => {
  if (typeof fileId === 'string' && UUID_PATTERN.test(fileId)) return `/api/files/${fileId}/content`;
  return readString(fileUrl);
};

const APPROVAL_STATUSES = new Set(['已通过', '最终版']);

const getBlockingMandatoryNotes = async (versionId: string, query = pool.query.bind(pool)) => {
  const result = await query(
    `SELECT id FROM notes WHERE version_id=$1 AND deleted_at IS NULL AND is_mandatory=true AND status='待处理' ORDER BY created_at ASC`,
    [versionId],
  );
  return result.rows.map(row => String(row.id));
};

const respondWithBlockingMandatoryNotes = (res: Response, noteIds: string[]) => {
  res.status(409).json({
    error: '仍有必改意见未解决，无法通过版本。',
    code: 'UNRESOLVED_MANDATORY_NOTES',
    details: {
      unresolvedMandatoryCount: noteIds.length,
      noteIds,
    },
  });
};

versionsRouter.get('/', asyncHandler(async (req, res) => {
  const projectId = await requireProjectAccessFromRequest(req, res);
  if (!projectId) return;
  const context = await getProjectPermissionContext(projectId, req.authUser!.id, req.authUser!.role);
  const r = await pool.query(`${versionSelect} WHERE deleted_at IS NULL AND task_id IN (SELECT id FROM tasks WHERE project_id=$1 AND deleted_at IS NULL) ORDER BY created_at DESC`, [projectId]);
  res.json({ versions: r.rows.map(version => serializeVersionForRole(version, context)) });
}));

versionsRouter.get('/:id', asyncHandler(async (req, res) => {
  const result = await pool.query(`${versionSelect} WHERE id=$1 AND deleted_at IS NULL`, [req.params.id]);
  if (!result.rowCount) { res.status(404).json({ error: '版本不存在。' }); return; }
  const project = await pool.query('SELECT t.project_id FROM versions v JOIN tasks t ON t.id=v.task_id WHERE v.id=$1 AND t.deleted_at IS NULL', [req.params.id]);
  if (!project.rowCount) { res.status(404).json({ error: '版本不存在。' }); return; }
  const context = await getProjectPermissionContext(project.rows[0].project_id, req.authUser!.id, req.authUser!.role);
  if (!context.projectRole) { res.status(403).json({ error: '您不是该项目的成员。' }); return; }
  res.json({ version: serializeVersionForRole(result.rows[0], context) });
}));

versionsRouter.post('/', asyncHandler(async (req, res) => {
  const task = await pool.query('SELECT project_id,entity_type,entity_id FROM tasks WHERE id=$1 AND deleted_at IS NULL', [req.body?.taskId]);
  if (!task.rowCount) { res.status(404).json({ error: '任务不存在。' }); return; }
  const { project_id: projectId, entity_type: entityType, entity_id: entityId } = task.rows[0];
  if (!canSubmitVersion(await getProjectPermissionContext(projectId, req.authUser!.id, req.authUser!.role))) { res.status(403).json({ error: '您没有提交版本的权限。' }); return; }
  const validationError = validateEntityBelongsToProject(entityType, entityId, projectId);
  if (validationError) { res.status(400).json({ error: validationError }); return; }

  const fileId = typeof req.body?.fileId === 'string' && UUID_PATTERN.test(req.body.fileId) ? req.body.fileId : null;
  if (fileId) {
    res.status(409).json({ error: '审核文件已在上传事务中创建版本，请勿再次提交版本记录。' });
    return;
  }
  const fileUrl = normalizeFileUrl(null, req.body?.fileUrl);
  if (!fileUrl) { res.status(400).json({ error: '请先上传文件或提供文件 URL。' }); return; }

  const id = randomUUID();
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await client.query(`INSERT INTO versions (id,task_id,entity_type,entity_id,version_number,file_url,file_type,thumbnail_url,uploader_id,changelog,status,ai_params) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12::jsonb)`, [id, req.body.taskId, entityType, entityId, readString(req.body?.versionNumber, 'V001'), fileUrl, readString(req.body?.fileType, 'image'), readString(req.body?.thumbnailUrl), req.authUser!.id, readString(req.body?.changelog), readString(req.body?.status, '待审核'), JSON.stringify(req.body?.aiParams ?? null)]);
    await client.query('UPDATE tasks SET latest_version_id=$1,status=$2 WHERE id=$3', [id, '待审核', req.body.taskId]);
    if (entityType !== 'project') {
      await client.query(`UPDATE ${entityType === 'shot' ? 'shots' : 'assets'} SET latest_version_id=$1,thumbnail_url=coalesce(nullif($2,''),thumbnail_url) WHERE id=$3`, [id, readString(req.body?.thumbnailUrl), entityId]);
      await recalculateEntityStatus(client, entityType, entityId);
    }
    const r = await client.query(`${versionSelect} WHERE id=$1 AND deleted_at IS NULL`, [id]);
    await recordAuditLog(client, req, { action: AUDIT_EVENTS.VERSION_SUBMIT, projectId, entityType: 'version', entityId: id, details: { taskId: req.body.taskId, entityType, entityId, versionNumber: readString(req.body?.versionNumber, 'V001'), fileId, status: readString(req.body?.status, '待审核') } });
    await client.query('COMMIT');
    const context = await getProjectPermissionContext(projectId, req.authUser!.id, req.authUser!.role);
    res.status(201).json({ version: serializeVersionForRole(r.rows[0], context) });
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}));

versionsRouter.patch('/:id/status', asyncHandler(async (req, res) => {
  const a = await pool.query('SELECT t.project_id,v.task_id,v.entity_type,v.entity_id,v.status FROM versions v JOIN tasks t ON t.id=v.task_id WHERE v.id=$1 AND v.deleted_at IS NULL', [req.params.id]);
  if (!a.rowCount) { res.status(404).json({ error: '版本不存在。' }); return; }
  if (!canReviewVersion(await getProjectPermissionContext(a.rows[0].project_id, req.authUser!.id, req.authUser!.role))) { res.status(403).json({ error: '您没有审核版本的权限。' }); return; }
  const validationError = validateEntityBelongsToProject(a.rows[0].entity_type, a.rows[0].entity_id, a.rows[0].project_id);
  if (validationError) { res.status(400).json({ error: validationError }); return; }
  const requestedStatus = typeof req.body?.status === 'string' ? req.body.status.trim() : a.rows[0].status;
  let nextStatus;
  try {
    nextStatus = assertVersionStatusTransition(a.rows[0].status, requestedStatus);
  } catch (error) {
    res.status(400).json({ error: error instanceof Error ? error.message : '版本状态流转无效。' });
    return;
  }
  if (APPROVAL_STATUSES.has(nextStatus)) {
    const blockingNoteIds = await getBlockingMandatoryNotes(req.params.id);
    if (blockingNoteIds.length > 0) {
      respondWithBlockingMandatoryNotes(res, blockingNoteIds);
      return;
    }
  }
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const r = await client.query(`WITH updated AS (UPDATE versions SET status=$2 WHERE id=$1 AND deleted_at IS NULL RETURNING *) ${versionSelect.replace('FROM versions', 'FROM updated')}`, [req.params.id, nextStatus]);
    if (nextStatus !== a.rows[0].status) {
      await applyVersionStatusEffects(client, { id: req.params.id, task_id: a.rows[0].task_id, entity_type: a.rows[0].entity_type, entity_id: a.rows[0].entity_id }, nextStatus);
      await recordAuditLog(client, req, {
        action: nextStatus === '最终版' ? AUDIT_EVENTS.VERSION_FINAL_SET : AUDIT_EVENTS.REVIEW_STATUS_CHANGE,
        projectId: a.rows[0].project_id,
        entityType: 'version',
        entityId: req.params.id,
        details: { from: a.rows[0].status, to: nextStatus },
      });
    }
    await client.query('COMMIT');
    const context = await getProjectPermissionContext(a.rows[0].project_id, req.authUser!.id, req.authUser!.role);
    res.json({ version: serializeVersionForRole(r.rows[0], context) });
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}));

versionsRouter.patch('/:id', asyncHandler(async (req, res) => {
  const a = await pool.query('SELECT t.project_id,v.task_id,v.entity_type,v.entity_id,v.status FROM versions v JOIN tasks t ON t.id=v.task_id WHERE v.id=$1 AND v.deleted_at IS NULL', [req.params.id]);
  if (!a.rowCount) { res.status(404).json({ error: '版本不存在。' }); return; }
  if (!canReviewVersion(await getProjectPermissionContext(a.rows[0].project_id, req.authUser!.id, req.authUser!.role))) { res.status(403).json({ error: '您没有审核版本的权限。' }); return; }
  if (a.rows[0].status === '最终版' && req.authUser!.role !== 'admin') { res.status(403).json({ error: '最终版已锁定，仅管理员可继续修改。' }); return; }
  const validationError = validateEntityBelongsToProject(a.rows[0].entity_type, a.rows[0].entity_id, a.rows[0].project_id);
  if (validationError) { res.status(400).json({ error: validationError }); return; }
  if (isEntityLockedForNonAdmin(a.rows[0].status) && req.authUser!.role !== 'admin') { res.status(403).json({ error: '最终版已锁定，仅管理员可继续修改。' }); return; }
  const requestedStatus = typeof req.body?.status === 'string' ? req.body.status.trim() : a.rows[0].status;
  let nextStatus;
  try { nextStatus = assertVersionStatusTransition(a.rows[0].status, requestedStatus); } catch (error) { res.status(400).json({ error: error instanceof Error ? error.message : '版本状态流转无效。' }); return; }
  if (APPROVAL_STATUSES.has(nextStatus)) {
    const blockingNoteIds = await getBlockingMandatoryNotes(req.params.id);
    if (blockingNoteIds.length > 0) {
      respondWithBlockingMandatoryNotes(res, blockingNoteIds);
      return;
    }
  }
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const r = await client.query(`WITH updated AS (UPDATE versions SET status=$2 WHERE id=$1 AND deleted_at IS NULL RETURNING *) ${versionSelect.replace('FROM versions', 'FROM updated')}`, [req.params.id, nextStatus]);
    if (nextStatus !== a.rows[0].status) {
      await applyVersionStatusEffects(client, { id: req.params.id, task_id: a.rows[0].task_id, entity_type: a.rows[0].entity_type, entity_id: a.rows[0].entity_id }, nextStatus);
      await recordAuditLog(client, req, { action: nextStatus === '最终版' ? AUDIT_EVENTS.VERSION_FINAL_SET : AUDIT_EVENTS.VERSION_STATUS_CHANGE, projectId: a.rows[0].project_id, entityType: 'version', entityId: req.params.id, details: { from: a.rows[0].status, to: nextStatus } });
    }
    await client.query('COMMIT');
    const context = await getProjectPermissionContext(a.rows[0].project_id, req.authUser!.id, req.authUser!.role);
    res.json({ version: serializeVersionForRole(r.rows[0], context) });
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}));
