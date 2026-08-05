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
    if (version.entity_type === 'shot') await client.query('UPDATE shots SET status=$1 WHERE id=$2', ['制作中', version.entity_id]);
    if (version.entity_type === 'asset') await client.query('UPDATE assets SET status=$1 WHERE id=$2', ['审核中', version.entity_id]);
    return;
  }

  if (status === '已通过') {
    await client.query('UPDATE tasks SET status=$1 WHERE id=$2', ['已完成', version.task_id]);
    if (version.entity_type === 'shot') await client.query('UPDATE shots SET status=$1 WHERE id=$2', ['已完成', version.entity_id]);
    if (version.entity_type === 'asset') await client.query('UPDATE assets SET status=$1, approved_version_id=$2 WHERE id=$3', ['已定稿', version.id, version.entity_id]);
    return;
  }

  if (status === '最终版') {
    await client.query('UPDATE tasks SET status=$1 WHERE id=$2', ['已完成', version.task_id]);
    if (version.entity_type === 'shot') await client.query('UPDATE shots SET status=$1, latest_version_id=$2 WHERE id=$3', ['已锁定', version.id, version.entity_id]);
    if (version.entity_type === 'asset') await client.query('UPDATE assets SET status=$1, approved_version_id=$2 WHERE id=$3', ['已锁定', version.id, version.entity_id]);
  }
};

export const isEntityLockedForNonAdmin = (status: string | null | undefined): boolean => status === '已锁定';
