import { randomUUID } from 'node:crypto';
import type { PoolClient } from 'pg';

export const SHOT_TASK_TEMPLATE = [
  { stage: '台本', dueInDays: 2 },
  { stage: '视觉准备', dueInDays: 4 },
  { stage: '视频生成', dueInDays: 6 },
  { stage: '剪辑', dueInDays: 8 },
  { stage: '声音', dueInDays: 10 },
  { stage: '成片', dueInDays: 12 },
] as const;

export const ASSET_TASK_TEMPLATE = [
  { stage: '需求', dueInDays: 2 },
  { stage: '概念设计', dueInDays: 4 },
  { stage: '修改', dueInDays: 6 },
  { stage: '定稿', dueInDays: 8 },
] as const;

type Template = readonly { stage: string; dueInDays: number }[];

export async function insertTaskChain(client: PoolClient, options: {
  projectId: string;
  entityType: 'shot' | 'asset';
  entityId: string;
  label: string;
  assigneeId: string;
  template: Template;
  firstStatus?: '未开始' | '制作中';
}): Promise<void> {
  let prerequisiteTaskId: string | null = null;
  for (const [index, item] of options.template.entries()) {
    const existing = await client.query<{ id: string }>(
      `SELECT id FROM tasks WHERE project_id=$1 AND entity_type=$2 AND entity_id=$3
       AND pipeline_stage=$4 AND deleted_at IS NULL`,
      [options.projectId, options.entityType, options.entityId, item.stage],
    );
    if (existing.rowCount) {
      const existingId = existing.rows[0].id;
      await client.query('UPDATE tasks SET prerequisite_task_id=$2 WHERE id=$1', [existingId, prerequisiteTaskId]);
      await client.query('DELETE FROM task_dependencies WHERE task_id=$1', [existingId]);
      if (prerequisiteTaskId) await client.query(
        'INSERT INTO task_dependencies (task_id,prerequisite_task_id) VALUES ($1,$2)',
        [existingId, prerequisiteTaskId],
      );
      prerequisiteTaskId = existingId;
      continue;
    }
    const id = randomUUID();
    await client.query(
      `INSERT INTO tasks (id,project_id,title,entity_type,entity_id,pipeline_stage,assignee_id,status,priority,due_date,requirements,prerequisite_task_id)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,'中',now()::date + $9,$10,$11)`,
      [id, options.projectId, `${options.label} - ${item.stage}`, options.entityType, options.entityId,
        item.stage, options.assigneeId, index === 0 ? (options.firstStatus || '未开始') : '已阻塞',
        item.dueInDays, `${options.label} 的${item.stage}阶段制作要求`, prerequisiteTaskId],
    );
    if (prerequisiteTaskId) await client.query(
      'INSERT INTO task_dependencies (task_id,prerequisite_task_id) VALUES ($1,$2)',
      [id, prerequisiteTaskId],
    );
    prerequisiteTaskId = id;
  }
}
