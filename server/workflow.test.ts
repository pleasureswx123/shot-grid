import test from 'node:test';
import assert from 'node:assert/strict';
import { applyVersionStatusEffects, assertTaskStatusTransition, assertVersionStatusTransition, isEntityLockedForNonAdmin } from './workflow';

const version = { id: 'version-1', task_id: 'task-1', entity_type: 'shot' as const, entity_id: 'shot-1' };

const createClient = () => {
  const queries: Array<{ sql: string; params?: unknown[] }> = [];
  return {
    queries,
    async query(sql: string, params?: unknown[]) {
      queries.push({ sql, params });
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
  const client = createClient();
  await applyVersionStatusEffects(client as any, version, '已退回');
  assert.deepEqual(client.queries.map(query => query.params), [['修改中', 'task-1'], ['制作中', 'shot-1']]);
});

test('审核通过会完成任务并将资产置为已定稿', async () => {
  const client = createClient();
  await applyVersionStatusEffects(client as any, { ...version, entity_type: 'asset', entity_id: 'asset-1' }, '已通过');
  assert.deepEqual(client.queries.map(query => query.params), [['已完成', 'task-1'], ['已定稿', 'version-1', 'asset-1']]);
});

test('最终版会锁定关联实体且非管理员锁定检查生效', async () => {
  const client = createClient();
  await applyVersionStatusEffects(client as any, { ...version, entity_type: 'asset', entity_id: 'asset-1' }, '最终版');
  assert.deepEqual(client.queries.map(query => query.params), [['已完成', 'task-1'], ['已锁定', 'version-1', 'asset-1']]);
  assert.equal(isEntityLockedForNonAdmin('已锁定'), true);
  assert.equal(isEntityLockedForNonAdmin('已定稿'), false);
});
