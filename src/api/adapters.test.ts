import assert from 'node:assert/strict';
import test from 'node:test';
import * as assetsApi from './assets';
import * as filesApi from './files';
import * as shotsApi from './shots';
import * as tasksApi from './tasks';

test('production API adapters address database-backed project data by project id', async () => {
  const seen: string[] = [];
  const originalFetch = globalThis.fetch;
  globalThis.fetch = (async (input: RequestInfo | URL) => {
    seen.push(String(input));
    return new Response(JSON.stringify({ shots: [], assets: [], files: [] }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  }) as typeof fetch;
  try {
    await shotsApi.listShots('project A');
    await assetsApi.listAssets('project A');
    await filesApi.listFiles('project A');
  } finally {
    globalThis.fetch = originalFetch;
  }

  assert.deepEqual(seen, [
    '/api/shots?projectId=project%20A',
    '/api/assets?projectId=project%20A',
    '/api/files?projectId=project%20A',
  ]);
});

test('write adapters call server APIs instead of local browser storage', async () => {
  const calls: Array<{ url: string; method: string; body?: string }> = [];
  const originalFetch = globalThis.fetch;
  globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
    calls.push({ url: String(input), method: init?.method || 'GET', body: init?.body as string | undefined });
    return new Response(JSON.stringify({ shot: {}, asset: {}, task: {} }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  }) as typeof fetch;
  try {
    await shotsApi.updateShot('shot-1', { status: '制作中' });
    await assetsApi.createAsset({ projectId: 'project-1', name: '资产' });
    await tasksApi.updateTask('task-1', { status: '待审核' });
  } finally {
    globalThis.fetch = originalFetch;
  }

  assert.deepEqual(calls.map(call => [call.method, call.url]), [
    ['PATCH', '/api/shots/shot-1'],
    ['POST', '/api/assets'],
    ['PATCH', '/api/tasks/task-1'],
  ]);
  assert.match(calls[0].body || '', /制作中/);
});
