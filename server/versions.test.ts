import assert from 'node:assert/strict';
import test from 'node:test';
import { serializeVersionForRole } from './versionSerialization';
import type { ProjectRole } from './permissions';

test('version serialization exposes generation secrets only to internal project roles', () => {
  const aiParams = {
    prompt: 'internal prompt',
    generationCost: 42,
    seed: 9876,
    nasPath: '\\\\NAS\\project\\source.exr',
    sourceFilePath: '/mnt/nas/project/source.exr',
  };
  const version = { id: 'version-1', aiParams };

  for (const projectRole of ['creator', 'director', 'admin'] satisfies ProjectRole[]) {
    const serialized = serializeVersionForRole(version, { systemRole: projectRole, projectRole });
    assert.deepEqual(serialized, version);
  }

  const clientVersion = serializeVersionForRole(version, { systemRole: 'client', projectRole: 'client' });
  assert.deepEqual(clientVersion, { id: 'version-1' });
  assert.equal(JSON.stringify(clientVersion).includes('internal prompt'), false);
  assert.equal(JSON.stringify(clientVersion).includes('/mnt/nas'), false);
});
