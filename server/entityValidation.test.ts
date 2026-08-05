import assert from 'node:assert/strict';
import test from 'node:test';
import { readFile } from 'node:fs/promises';
import { isApiEntityType, validateEntityBelongsToProject } from './entityValidation';

test('entity type validation accepts project shot and asset only', () => {
  assert.equal(isApiEntityType('project'), true);
  assert.equal(isApiEntityType('shot'), true);
  assert.equal(isApiEntityType('asset'), true);
  assert.equal(isApiEntityType('sequence'), false);
});

test('project entity tasks must use the project id as entity id', () => {
  assert.equal(validateEntityBelongsToProject('project', 'project-1', 'project-1'), null);
  assert.equal(
    validateEntityBelongsToProject('project', 'shot-1', 'project-1'),
    '项目级任务的 entityId 必须等于所属项目。',
  );
  assert.equal(validateEntityBelongsToProject('shot', 'shot-1', 'project-1'), null);
  assert.equal(validateEntityBelongsToProject('asset', 'asset-1', 'project-1'), null);
});

test('new and upgrade migrations allow project shot and asset task entities', async () => {
  const initial = await readFile('server/migrations/001_initial_schema.sql', 'utf8');
  const upgrade = await readFile('server/migrations/004_project_entity_tasks.sql', 'utf8');

  assert.match(initial, /CREATE TABLE tasks[\s\S]*entity_type varchar\(20\) NOT NULL CHECK \(entity_type IN \('project', 'shot', 'asset'\)\)/);
  assert.match(initial, /CREATE TABLE versions[\s\S]*entity_type varchar\(20\) NOT NULL CHECK \(entity_type IN \('project', 'shot', 'asset'\)\)/);
  assert.match(upgrade, /ADD CONSTRAINT tasks_entity_type_check[\s\S]*'project', 'shot', 'asset'/);
  assert.match(upgrade, /ADD CONSTRAINT versions_entity_type_check[\s\S]*'project', 'shot', 'asset'/);
});
