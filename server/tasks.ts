import { randomUUID } from 'node:crypto';
import { Router } from 'express';
import { AUDIT_EVENTS, recordAuditLog } from './audit';
import { pool } from './db';
import { asyncHandler, readString, requireProjectAccessFromRequest, requireProjectWriteAccess, requireProjectWriteAccessFromRequest } from './apiUtils';
import { isApiEntityType, validateEntityBelongsToProject } from './entityValidation';
import { assertTaskStatusTransition } from './workflow';

export const tasksRouter = Router();

const selectTask = `SELECT t.id,t.project_id AS "projectId",t.title,t.entity_type AS "entityType",t.entity_id AS "entityId",
  t.pipeline_stage AS "pipelineStage",t.assignee_id AS "assigneeId",t.status,t.priority,t.due_date AS "dueDate",
  t.requirements,t.prerequisite_task_id AS "prerequisiteTaskId",t.latest_version_id AS "latestVersionId",t.created_at AS "createdAt",
  coalesce((SELECT array_agg(d.prerequisite_task_id ORDER BY d.created_at, d.prerequisite_task_id)
    FROM task_dependencies d WHERE d.task_id=t.id), '{}') AS "prerequisiteTaskIds"
  FROM tasks t`;

const readPrerequisiteIds = (body: any): string[] => {
  const requested = Array.isArray(body?.prerequisiteTaskIds)
    ? body.prerequisiteTaskIds
    : body?.prerequisiteTaskId ? [body.prerequisiteTaskId] : [];
  const ids = (requested as unknown[]).filter((value): value is string => typeof value === 'string' && value.length > 0);
  return [...new Set(ids)];
};

const replaceDependencies = async (client: any, taskId: string, projectId: string, prerequisiteIds: string[]) => {
  if (prerequisiteIds.includes(taskId)) throw new Error('任务不能依赖自身。');
  if (prerequisiteIds.length) {
    const prerequisites = await client.query(
      'SELECT id FROM tasks WHERE id=ANY($1::uuid[]) AND project_id=$2 AND deleted_at IS NULL',
      [prerequisiteIds, projectId],
    );
    if (prerequisites.rowCount !== prerequisiteIds.length) throw new Error('前置任务不存在或不属于当前项目。');
  }
  await client.query('DELETE FROM task_dependencies WHERE task_id=$1', [taskId]);
  for (const prerequisiteId of prerequisiteIds) {
    await client.query(
      'INSERT INTO task_dependencies (task_id,prerequisite_task_id) VALUES ($1,$2)',
      [taskId, prerequisiteId],
    );
  }
  // Keep the deprecated column populated for old clients during the transition.
  await client.query('UPDATE tasks SET prerequisite_task_id=$2 WHERE id=$1', [taskId, prerequisiteIds[0] ?? null]);
};

tasksRouter.get('/', asyncHandler(async (req, res) => {
  const projectId = await requireProjectAccessFromRequest(req, res); if (!projectId) return;
  const result = await pool.query(`${selectTask} WHERE t.project_id=$1 AND t.deleted_at IS NULL ORDER BY t.updated_at DESC`, [projectId]);
  res.json({ tasks: result.rows });
}));

tasksRouter.post('/', asyncHandler(async (req, res) => {
  const projectId = await requireProjectWriteAccessFromRequest(req, res); if (!projectId) return;
  const entityType = req.body?.entityType;
  const entityId = readString(req.body?.entityId);
  if (!isApiEntityType(entityType)) { res.status(400).json({ error: '任务实体类型无效。' }); return; }
  const validationError = validateEntityBelongsToProject(entityType, entityId, projectId);
  if (validationError) { res.status(400).json({ error: validationError }); return; }
  if (entityType === 'shot' || entityType === 'asset') {
    const table = entityType === 'shot' ? 'shots' : 'assets';
    const entity = await pool.query(`SELECT 1 FROM ${table} WHERE id=$1 AND project_id=$2 AND deleted_at IS NULL`, [entityId, projectId]);
    if (!entity.rowCount) { res.status(400).json({ error: `${entityType === 'shot' ? '镜头' : '资产'}不属于该项目。` }); return; }
  }
  const id = randomUUID();
  const title = readString(req.body?.title, '新任务');
  const assigneeId = readString(req.body?.assigneeId, req.authUser!.id);
  const status = readString(req.body?.status, '未开始');
  const dueDate = readString(req.body?.dueDate) || null;
  const prerequisiteIds = readPrerequisiteIds(req.body);
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await client.query(
      `INSERT INTO tasks (id,project_id,title,entity_type,entity_id,pipeline_stage,assignee_id,status,priority,due_date,requirements)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)`,
      [id, projectId, title, entityType, entityId, readString(req.body?.pipelineStage), assigneeId, status, readString(req.body?.priority, '中'), dueDate, readString(req.body?.requirements)],
    );
    await replaceDependencies(client, id, projectId, prerequisiteIds);
    const result = await client.query(`${selectTask} WHERE t.id=$1`, [id]);
    await recordAuditLog(client, req, { action: AUDIT_EVENTS.TASK_CREATE, projectId, entityType: 'task', entityId: id, details: { title, taskEntityType: entityType, taskEntityId: entityId, assigneeId, status, dueDate, prerequisiteTaskIds: prerequisiteIds } });
    await client.query('COMMIT');
    res.status(201).json({ task: result.rows[0] });
  } catch (error) { await client.query('ROLLBACK'); throw error; } finally { client.release(); }
}));

tasksRouter.patch('/:id', asyncHandler(async (req, res) => {
  const id = req.params.id;
  const found = await pool.query('SELECT project_id,entity_type,entity_id,status,assignee_id,due_date FROM tasks WHERE id=$1 AND deleted_at IS NULL', [id]);
  if (!found.rowCount) { res.status(404).json({ error: '任务不存在。' }); return; }
  const previous = found.rows[0];
  if (!await requireProjectWriteAccess(previous.project_id, req.authUser!.id, req.authUser!.role)) { res.status(403).json({ error: '您不是该项目的成员。' }); return; }
  let nextStatus = req.body?.status ?? null;
  if (typeof nextStatus === 'string') {
    try { nextStatus = assertTaskStatusTransition(previous.status, nextStatus.trim()); }
    catch (error) { res.status(400).json({ error: error instanceof Error ? error.message : '任务状态流转无效。' }); return; }
  }
  const nextAssignee = req.body?.assigneeId ?? null;
  const nextDueDate = req.body?.dueDate ?? null;
  const dependenciesProvided = req.body?.prerequisiteTaskIds !== undefined || req.body?.prerequisiteTaskId !== undefined;
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await client.query('UPDATE tasks SET status=coalesce($2,status),assignee_id=coalesce($3,assignee_id),due_date=coalesce($4,due_date) WHERE id=$1', [id, nextStatus, nextAssignee, nextDueDate]);
    if (dependenciesProvided) await replaceDependencies(client, id, previous.project_id, readPrerequisiteIds(req.body));
    const result = await client.query(`${selectTask} WHERE t.id=$1`, [id]);
    const updated = result.rows[0];
    if (nextStatus !== null && updated.status !== previous.status) await recordAuditLog(client, req, { action: AUDIT_EVENTS.TASK_STATUS_CHANGE, projectId: previous.project_id, entityType: 'task', entityId: id, details: { from: previous.status, to: updated.status } });
    if (nextAssignee !== null && updated.assigneeId !== previous.assignee_id) await recordAuditLog(client, req, { action: AUDIT_EVENTS.TASK_ASSIGNEE_CHANGE, projectId: previous.project_id, entityType: 'task', entityId: id, details: { from: previous.assignee_id, to: updated.assigneeId } });
    if (nextDueDate !== null && String(updated.dueDate) !== String(previous.due_date)) await recordAuditLog(client, req, { action: AUDIT_EVENTS.TASK_DUE_DATE_CHANGE, projectId: previous.project_id, entityType: 'task', entityId: id, details: { from: previous.due_date, to: updated.dueDate } });
    await client.query('COMMIT'); res.json({ task: updated });
  } catch (error) { await client.query('ROLLBACK'); throw error; } finally { client.release(); }
}));
