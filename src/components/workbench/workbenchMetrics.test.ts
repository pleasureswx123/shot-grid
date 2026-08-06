import assert from 'node:assert/strict';
import test from 'node:test';
import type { ReviewList, Task, User, Version } from '../../types';
import { getDateKeyInTimeZone, getMyDueTasks, getPendingReviewTasks, getRecentProjectVersions } from './workbenchMetrics';

const task = (id: string, overrides: Partial<Task> = {}): Task => ({
  id, title: id, entityType: 'shot', entityId: 'shot-1', pipelineStage: '视频生成',
  assigneeId: 'creator', status: '待审核', priority: '中', dueDate: '2026-08-06',
  requirements: '', createdAt: '2026-08-01', ...overrides,
});
const version = (id: string, taskId: string, createdAt = '2026-08-06T10:00:00Z'): Version => ({
  id, taskId, entityType: 'shot', entityId: 'shot-1', versionNumber: 'V001', fileUrl: '',
  fileType: 'video', thumbnailUrl: '', uploaderId: 'creator', createdAt, changelog: '', status: '待审核',
});
const user = (id: string, role: User['role']): User => ({ id, role, name: id, avatar: '', department: '' });
const review = (overrides: Partial<ReviewList> = {}): ReviewList => ({
  id: 'review-1', projectId: 'project-1', title: 'review', date: '2026-08-06', versionIds: ['v1'],
  status: '审核中', roundNumber: 1, participants: [], createdAt: '2026-08-06T09:00:00Z', ...overrides,
});

test('project timezone determines the current date at a UTC day boundary', () => {
  const instant = new Date('2026-08-05T16:30:00Z');
  assert.equal(getDateKeyInTimeZone(instant, 'Asia/Shanghai'), '2026-08-06');
  assert.equal(getDateKeyInTimeZone(instant, 'America/Los_Angeles'), '2026-08-05');
});

test('today and overdue tasks only include unfinished tasks assigned to the current user', () => {
  const tasks = [
    task('today'), task('overdue', { dueDate: '2026-08-05' }),
    task('complete', { status: '已完成' }), task('other-user', { assigneeId: 'other' }),
  ];
  const result = getMyDueTasks(tasks, 'creator', new Date('2026-08-05T16:30:00Z'));
  assert.deepEqual(result.dueToday.map(item => item.id), ['today']);
  assert.deepEqual(result.overdue.map(item => item.id), ['overdue']);
});

test('recent project submissions are limited to 24 hours and sorted by createdAt', () => {
  const versions = [version('older', 't1', '2026-08-05T09:59:59Z'), version('first', 't1', '2026-08-06T09:00:00Z'), version('latest', 't1', '2026-08-06T10:00:00Z')];
  assert.deepEqual(getRecentProjectVersions(versions, new Date('2026-08-06T10:00:00Z')).map(item => item.id), ['latest', 'first']);
});

test('pending reviews require an open list and an unfinished matching participant role', () => {
  const tasks = [task('t1'), task('t2')];
  const versions = [version('v1', 't1'), version('v2', 't2')];
  const lists = [
    review({ participants: [{ userId: 'director', role: '审核人', hasCompleted: false }] }),
    review({ id: 'completed', versionIds: ['v2'], status: '已完成', participants: [{ userId: 'director', role: '审核人', hasCompleted: false }] }),
  ];
  assert.deepEqual(getPendingReviewTasks(tasks, versions, lists, user('director', 'director')).map(item => item.id), ['t1']);
  assert.deepEqual(getPendingReviewTasks(tasks, versions, lists, user('creator', 'creator')), []);
});

test('client participants see their assigned review while observers and completed participants do not', () => {
  const lists = [review({ participants: [{ userId: 'client', role: '客户', hasCompleted: false }] })];
  assert.equal(getPendingReviewTasks([task('t1')], [version('v1', 't1')], lists, user('client', 'client')).length, 1);
  assert.equal(getPendingReviewTasks([task('t1')], [version('v1', 't1')], [review({ participants: [{ userId: 'client', role: '观察者', hasCompleted: false }] })], user('client', 'client')).length, 0);
  assert.equal(getPendingReviewTasks([task('t1')], [version('v1', 't1')], [review({ participants: [{ userId: 'client', role: '客户', hasCompleted: true }] })], user('client', 'client')).length, 0);
});
