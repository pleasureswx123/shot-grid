import type { PoolClient, Pool } from 'pg';

export type VersionStatus = '待审核' | '已通过' | '已退回' | '最终版';
export type TaskStatus = '未开始' | '制作中' | '待审核' | '修改中' | '已完成' | '已阻塞';
export type WorkflowEntityType = 'project' | 'shot' | 'asset';

const versionTransitions: Record<VersionStatus, VersionStatus[]> = {
  待审核: ['已通过', '已退回'],
  已通过: ['最终版'],
  已退回: [],
  最终版: [],
};

const taskTransitions: Record<TaskStatus, TaskStatus[]> = {
  未开始: ['制作中', '已阻塞'],
  制作中: ['待审核', '已阻塞'],
  待审核: ['修改中', '已完成'],
  修改中: ['待审核', '已阻塞'],
  已完成: [],
  已阻塞: ['未开始', '制作中', '修改中'],
};

export const versionStatuses = Object.keys(versionTransitions) as VersionStatus[];
export const taskStatuses = Object.keys(taskTransitions) as TaskStatus[];

const isVersionStatus = (status: string): status is VersionStatus => versionStatuses.includes(status as VersionStatus);
const isTaskStatus = (status: string): status is TaskStatus => taskStatuses.includes(status as TaskStatus);

export const assertVersionStatusTransition = (from: string, to: string): VersionStatus => {
  if (!isVersionStatus(to)) throw new Error(`版本状态无效：${to}`);
  if (!isVersionStatus(from)) throw new Error(`当前版本状态无效：${from}`);
  if (from === to) return to;
  if (!versionTransitions[from].includes(to)) throw new Error(`禁止版本状态从「${from}」流转到「${to}」。`);
  return to;
};

export const assertTaskStatusTransition = (from: string, to: string): TaskStatus => {
  if (!isTaskStatus(to)) throw new Error(`任务状态无效：${to}`);
  if (!isTaskStatus(from)) throw new Error(`当前任务状态无效：${from}`);
  if (from === to) return to;
  if (!taskTransitions[from].includes(to)) throw new Error(`禁止任务状态从「${from}」流转到「${to}」。`);
  return to;
};

export const applyVersionStatusEffects = async (
  client: PoolClient | Pool,
  version: { id: string; task_id: string; entity_type: WorkflowEntityType; entity_id: string },
  status: VersionStatus,
): Promise<void> => {
  if (status === '已退回') {
    await client.query('UPDATE tasks SET status=$1 WHERE id=$2', ['修改中', version.task_id]);
    await recomputeEntityWorkflow(client, version.entity_type, version.entity_id);
    return;
  }

  if (status === '已通过' || status === '最终版') {
    await client.query('UPDATE tasks SET status=$1 WHERE id=$2', ['已完成', version.task_id]);
    await client.query(
      `UPDATE tasks downstream
       SET status='未开始'
       WHERE downstream.status='已阻塞' AND downstream.deleted_at IS NULL
         AND EXISTS (
           SELECT 1 FROM task_dependencies dependency
           WHERE dependency.task_id=downstream.id AND dependency.prerequisite_task_id=$1
         )
         AND NOT EXISTS (
           SELECT 1 FROM task_dependencies dependency
           JOIN tasks prerequisite ON prerequisite.id=dependency.prerequisite_task_id
           WHERE dependency.task_id=downstream.id
             AND (prerequisite.status<>'已完成' OR prerequisite.deleted_at IS NOT NULL)
         )`,
      [version.task_id],
    );
    if (version.entity_type === 'shot' && status === '最终版') {
      await client.query('UPDATE shots SET latest_version_id=$1 WHERE id=$2', [version.id, version.entity_id]);
    }
    if (version.entity_type === 'asset') {
      await client.query('UPDATE assets SET approved_version_id=$1 WHERE id=$2', [version.id, version.entity_id]);
    }
    await recomputeEntityWorkflow(client, version.entity_type, version.entity_id);
  }
};

export type EntityStatus = '未开始' | '制作中' | '审核中' | '已完成' | '已定稿' | '已锁定';

/**
 * Derive an entity status from all of its live tasks. The order here is
 * intentional: an explicit entity lock wins, then review, active work, full
 * completion, and finally the initial state. A blocked task is active work.
 */
export const deriveEntityStatus = (
  entityType: Exclude<WorkflowEntityType, 'project'>,
  tasks: Array<{ status: TaskStatus }>,
  isLocked: boolean,
): EntityStatus => {
  if (isLocked) return '已锁定';
  if (tasks.some(task => task.status === '待审核')) return '审核中';
  if (tasks.some(task => ['制作中', '修改中', '已阻塞'].includes(task.status))) return '制作中';
  if (tasks.length > 0 && tasks.every(task => task.status === '已完成')) return entityType === 'shot' ? '已完成' : '已定稿';
  return '未开始';
};

export const recalculateEntityStatus = async (
  client: PoolClient | Pool,
  entityType: WorkflowEntityType,
  entityId: string,
): Promise<void> => {
  if (entityType === 'project') return;
  const table = entityType === 'shot' ? 'shots' : 'assets';
  const entity = await client.query(`SELECT status FROM ${table} WHERE id=$1 AND deleted_at IS NULL`, [entityId]);
  if (!entity.rowCount) return;
  const result = await client.query(
    `SELECT pipeline_stage, status FROM tasks
     WHERE entity_type=$1 AND entity_id=$2 AND deleted_at IS NULL
     ORDER BY CASE WHEN status='已阻塞' THEN 1 ELSE 0 END, updated_at, id`,
    [entityType, entityId],
  );
  const tasks = result.rows as Array<{ pipeline_stage: string; status: TaskStatus }>;
  const current = tasks.find(task => task.status !== '已完成') ?? tasks[tasks.length - 1];
  const derivedStatus = deriveEntityStatus(entityType, tasks, entity.rows[0].status === '已锁定');
  if (entityType === 'shot') {
    await client.query('UPDATE shots SET current_stage=coalesce($1,current_stage),status=$2 WHERE id=$3', [current?.pipeline_stage ?? null, derivedStatus, entityId]);
  } else {
    await client.query('UPDATE assets SET status=$1 WHERE id=$2', [derivedStatus, entityId]);
  }
};

// Transitional alias for callers outside the workflow routes.
export const recomputeEntityWorkflow = recalculateEntityStatus;

export const isEntityLockedForNonAdmin = (status: string | null | undefined): boolean => status === '已锁定';
