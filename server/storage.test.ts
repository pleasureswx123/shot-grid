import assert from 'node:assert/strict';
import path from 'node:path';
import test from 'node:test';
import {
  createManagedStorageKey,
  getProjectDirectoryKeys,
  getProjectStorageKey,
  getShotDirectoryKeys,
  getShotStorageKey,
  PROJECT_DIRECTORY_STRUCTURE,
  SHOT_DIRECTORY_STRUCTURE,
  resolveWithinStorage,
  sanitizeFileName,
  sanitizeStorageSegment,
} from './storage';

test('sanitizeFileName removes path separators and Windows-reserved characters', () => {
  assert.equal(sanitizeFileName('../镜头:01?.mp4'), '.._镜头_01_.mp4');
  assert.equal(sanitizeFileName('CON'), '_CON');
});

test('sanitizeStorageSegment produces a portable directory name', () => {
  assert.equal(sanitizeStorageSegment('SH 010 / 最终'), 'SH_010_');
  assert.equal(sanitizeStorageSegment('..'), 'general');
});

test('resolveWithinStorage rejects traversal and accepts a child path', () => {
  assert.throws(() => resolveWithinStorage('../outside.txt'));
  const result = resolveWithinStorage('PROJECT/shot/SH010/file.mp4');
  assert.equal(path.isAbsolute(result), true);
});

test('project storage structure contains the production top-level areas', () => {
  assert.equal(getProjectStorageKey('nomud'), 'NOMUD');
  const keys = getProjectDirectoryKeys('NOMUD');
  assert.equal(keys.length, PROJECT_DIRECTORY_STRUCTURE.length);
  assert.equal(keys.includes('NOMUD/00_Project/Imports'), true);
  assert.equal(keys.includes('NOMUD/01_Assets/Characters'), true);
  assert.equal(keys.includes('NOMUD/02_Shots'), true);
  assert.equal(keys.includes('NOMUD/03_Audio/Mix'), true);
  assert.equal(keys.includes('NOMUD/04_Deliverables/Final'), true);
  assert.equal(keys.includes('NOMUD/05_Exchange/Incoming'), true);
});

test('managed files are routed into project asset, shot, or project folders', () => {
  const shotKey = createManagedStorageKey({
    projectCode: 'NOMUD',
    entityType: 'shot',
    entityCode: 'SH010',
    versionNumber: 'V003',
    originalName: 'preview.mp4',
  });
  const assetKey = createManagedStorageKey({
    projectCode: 'NOMUD',
    entityType: 'asset',
    entityCode: 'CHAR001',
    versionNumber: 'V001',
    originalName: 'design.psd',
  });
  const projectKey = createManagedStorageKey({
    projectCode: 'NOMUD',
    originalName: 'brief.pdf',
  });

  assert.match(shotKey, /^NOMUD\/02_Shots\/SH010\/V003\//);
  assert.match(assetKey, /^NOMUD\/01_Assets\/CHAR001\/V001\//);
  assert.match(projectKey, /^NOMUD\/00_Project\/Files\/unversioned\//);
});

test('each shot receives its own standard local directory structure', () => {
  assert.equal(getShotStorageKey('NOMUD', 'sh010'), 'NOMUD/02_Shots/SH010');
  const keys = getShotDirectoryKeys('NOMUD', 'SH010');
  assert.equal(keys.length, SHOT_DIRECTORY_STRUCTURE.length);
  assert.equal(keys.includes('NOMUD/02_Shots/SH010/01_Inputs'), true);
  assert.equal(keys.includes('NOMUD/02_Shots/SH010/02_Generations'), true);
  assert.equal(keys.includes('NOMUD/02_Shots/SH010/04_Versions'), true);
  assert.equal(keys.includes('NOMUD/02_Shots/SH010/06_Source'), true);
});
