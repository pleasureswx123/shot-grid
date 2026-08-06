import test from 'node:test';
import assert from 'node:assert/strict';
import { applyVersionStatusEffects, assertTaskStatusTransition, assertVersionStatusTransition, isEntityLockedForNonAdmin } from './workflow';

const version = { id: 'version-1', task_id: 'task-1', entity_type: 'shot' as const, entity_id: 'shot-1' };

const createClient = (entityTasks: Array<{ pipeline_stage: string; status: string; has_final: boolean }> = []) => {
  const queries: Array<{ sql: string; params?: unknown[] }> = [];
  return {
    queries,
    async query(sql: string, params?: unknown[]) {
      queries.push({ sql, params });
      if (sql.includes('SELECT pipeline_stage, status')) return { rows: entityTasks, rowCount: entityTasks.length };
      return { rows: [], rowCount: 0 };
    },
  };
};

test('版本状态机允许审核通过、退回和最终版合法流转', () => {
  assert.equal(assertVersionStatusTransition('待审核', '已通过'), '已通过');
  assert.equal(assertVersionStatusTransition('待审核', '已退回'), '已退回');
  assert.equal(assertVersionStatusTransition('已通过', '最终版'), '最终版');
});

test('版本状态机拒绝反向和跳跃流转', () => {
  assert.throws(() => assertVersionStatusTransition('已通过', '待审核'), /禁止版本状态/);
  assert.throws(() => assertVersionStatusTransition('已退回', '待审核'), /禁止版本状态/);
  assert.throws(() => assertVersionStatusTransition('最终版', '已通过'), /禁止版本状态/);
  assert.throws(() => assertVersionStatusTransition('待审核', '最终版'), /禁止版本状态/);
});

test('任务状态机限制任务合法流转', () => {
  assert.equal(assertTaskStatusTransition('未开始', '制作中'), '制作中');
  assert.equal(assertTaskStatusTransition('制作中', '待审核'), '待审核');
  assert.equal(assertTaskStatusTransition('待审核', '修改中'), '修改中');
  assert.equal(assertTaskStatusTransition('待审核', '已完成'), '已完成');
  assert.equal(assertTaskStatusTransition('制作中', '已阻塞'), '已阻塞');
  assert.throws(() => assertTaskStatusTransition('已完成', '制作中'), /禁止任务状态/);
});

test('审核退回会让任务进入修改中并让镜头回到制作中', async () => {
  const client = createClient([{ pipeline_stage: '视频生成', status: '修改中', has_final: false }]);
  await applyVersionStatusEffects(client as any, version, '已退回');
  assert.deepEqual(client.queries.map(query => query.params), [
    ['修改中', 'task-1'], ['shot', 'shot-1'], ['视频生成', '制作中', 'shot-1'],
  ]);
});

test('审核通过会完成当前任务、按全部依赖解除阻塞并重算资产状态', async () => {
  const client = createClient([
    { pipeline_stage: '概念设计', status: '已完成', has_final: false },
    { pipeline_stage: '修改', status: '未开始', has_final: false },
  ]);
  await applyVersionStatusEffects(client as any, { ...version, entity_type: 'asset', entity_id: 'asset-1' }, '已通过');
  const unblock = client.queries.find(query => query.sql.includes('UPDATE tasks downstream'))!;
  assert.deepEqual(unblock.params, ['task-1']);
  assert.match(unblock.sql, /NOT EXISTS[\s\S]*prerequisite\.status<>'已完成'/);
  assert.deepEqual(client.queries.at(-1)?.params, ['未开始', 'asset-1']);
});

test('一个阶段通过不会提前把整个镜头标记为已完成', async () => {
  const client = createClient([
    { pipeline_stage: '台本', status: '已完成', has_final: false },
    { pipeline_stage: '视觉准备', status: '未开始', has_final: false },
  ]);
  await applyVersionStatusEffects(client as any, version, '已通过');
  assert.deepEqual(client.queries.at(-1)?.params, ['视觉准备', '未开始', 'shot-1']);
});

test('重新提交会由派生状态计算保持实体审核中', async () => {
  const client = createClient([
    { pipeline_stage: '视频生成', status: '待审核', has_final: false },
    { pipeline_stage: '剪辑', status: '已阻塞', has_final: false },
  ]);
  const { recomputeEntityWorkflow } = await import('./workflow');
  await recomputeEntityWorkflow(client as any, 'shot', 'shot-1');
  assert.deepEqual(client.queries.at(-1)?.params, ['视频生成', '审核中', 'shot-1']);
});

test('最终版仅在全部任务完成后锁定关联实体且非管理员锁定检查生效', async () => {
  const client = createClient([
    { pipeline_stage: '定稿', status: '已完成', has_final: true },
  ]);
  await applyVersionStatusEffects(client as any, { ...version, entity_type: 'asset', entity_id: 'asset-1' }, '最终版');
  assert.deepEqual(client.queries.at(-1)?.params, ['已锁定', 'asset-1']);
  assert.equal(isEntityLockedForNonAdmin('已锁定'), true);
  assert.equal(isEntityLockedForNonAdmin('已定稿'), false);
});
