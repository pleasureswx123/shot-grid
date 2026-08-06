import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { mkdir, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { after, before, beforeEach, describe, test } from 'node:test';
import { createServer } from 'node:http';

const testDatabaseUrl = process.env.TEST_DATABASE_URL;
const runIntegration = Boolean(testDatabaseUrl);

process.env.NODE_ENV = 'production';
process.env.DATABASE_URL = testDatabaseUrl || process.env.DATABASE_URL || 'postgresql://invalid/shotgrid_light_test_missing';
process.env.STORAGE_ROOT = path.join(tmpdir(), `shotgrid-light-test-storage-${randomUUID()}`);
process.env.MAX_UPLOAD_MB = '1';
process.env.SESSION_COOKIE_SECURE = 'false';

const maybeDescribe = runIntegration ? describe : describe.skip;

maybeDescribe('server API integration routes', () => {
  let baseUrl = '';
  let server: ReturnType<typeof createServer> | null = null;
  let pool: import('pg').Pool;
  let closeDatabase: () => Promise<void>;
  let runMigrations: () => Promise<void>;
  let createApp: () => Promise<import('express').Express>;
  let createSessionToken: () => string;
  let hashSessionToken: (token: string) => string;

  const ids = {
    admin: randomUUID(),
    director: randomUUID(),
    creator: randomUUID(),
    client: randomUUID(),
    outsider: randomUUID(),
    project: randomUUID(),
    secondProject: randomUUID(),
  };
  const cookies = new Map<string, string>();
  let createdShotId = '';
  let createdAssetId = '';
  let createdTaskId = '';
  let createdVersionId = '';
  let createdChannelId = '';
  let creatorFileId = '';

  const request = async (method: string, url: string, asUser: string, body?: unknown, headers: HeadersInit = {}) => {
    const response = await fetch(`${baseUrl}${url}`, {
      method,
      headers: body instanceof FormData ? { cookie: cookies.get(asUser) || '', ...headers } : { 'content-type': 'application/json', cookie: cookies.get(asUser) || '', ...headers },
      body: body instanceof FormData ? body : body === undefined ? undefined : JSON.stringify(body),
    });
    const text = await response.text();
    const data = text ? JSON.parse(text) : null;
    return { response, data };
  };


  const createReviewVersion = async () => {
    const asset = await request('POST', '/api/assets', ids.creator, { projectId: ids.project, name: `审核资产 ${Date.now()} ${Math.random()}`, category: '道具' });
    assert.equal(asset.response.status, 201);
    const task = await request('POST', '/api/tasks', ids.creator, { projectId: ids.project, entityType: 'asset', entityId: asset.data.asset.id, title: '审核任务', pipelineStage: '概念设计' });
    assert.equal(task.response.status, 201);
    const version = await request('POST', '/api/versions', ids.creator, { taskId: task.data.task.id, versionNumber: 'V001', fileUrl: 'https://example.test/review.png', fileType: 'image', changelog: '首版' });
    assert.equal(version.response.status, 201);
    return version.data.version.id as string;
  };

  const insertUser = async (id: string, role: string, email: string) => {
    await pool.query(
      `INSERT INTO users (id, name, email, password_hash, role, department, is_active)
       VALUES ($1, $2, $3, 'test-hash', $4, '测试', true)`,
      [id, `Test ${role}`, email, role],
    );
    const token = createSessionToken();
    await pool.query(
      `INSERT INTO sessions (token_hash, user_id, ip_address, user_agent, expires_at)
       VALUES ($1, $2, '127.0.0.1', 'node-test', now() + interval '1 hour')`,
      [hashSessionToken(token), id],
    );
    cookies.set(id, `shotgrid_session=${encodeURIComponent(token)}`);
  };

  before(async () => {
    ({ pool, closeDatabase } = await import('./db'));
    ({ runMigrations } = await import('./migrate'));
    ({ createApp } = await import('./app'));
    ({ createSessionToken, hashSessionToken } = await import('./security'));
    await mkdir(process.env.STORAGE_ROOT!, { recursive: true });
    await runMigrations();
    const app = await createApp();
    server = createServer(app);
    await new Promise<void>((resolve) => server!.listen(0, '127.0.0.1', resolve));
    const address = server.address();
    assert.ok(address && typeof address === 'object');
    baseUrl = `http://127.0.0.1:${address.port}`;
  });

  beforeEach(async () => {
    await pool.query('BEGIN');
    try {
      await pool.query('TRUNCATE audit_logs, chat_message_likes, chat_messages, channel_members, department_channels, review_list_participants, review_list_versions, review_lists, notes, versions, project_files, tasks, shot_assets, shots, assets, scenes, project_members, projects, sessions, users RESTART IDENTITY CASCADE');
      await insertUser(ids.admin, 'admin', 'api-admin@example.test');
      await insertUser(ids.director, 'director', 'api-director@example.test');
      await insertUser(ids.creator, 'creator', 'api-creator@example.test');
      await insertUser(ids.client, 'client', 'api-client@example.test');
      await insertUser(ids.outsider, 'creator', 'api-outsider@example.test');
      await pool.query(`INSERT INTO projects (id, name, code, project_type, director_id, storage_key) VALUES ($1, '集成测试项目', $2, '短片', $3, $2), ($4, '隔离项目', $5, '短片', $6, $5)`, [ids.project, `APITEST_${Date.now()}`, ids.admin, ids.secondProject, `OTHER_${Date.now()}`, ids.admin]);
      await pool.query(`INSERT INTO project_members (project_id, user_id, project_role) VALUES ($1,$2,'admin'),($1,$3,'director'),($1,$4,'creator'),($1,$5,'client'),($6,$7,'creator')`, [ids.project, ids.admin, ids.director, ids.creator, ids.client, ids.secondProject, ids.outsider]);
      await pool.query('COMMIT');
    } catch (error) {
      await pool.query('ROLLBACK');
      throw error;
    }
  });

  after(async () => {
    await new Promise<void>((resolve, reject) => server?.close(error => error ? reject(error) : resolve()));
    await closeDatabase?.();
    await rm(process.env.STORAGE_ROOT!, { recursive: true, force: true });
  });

  test('enforces project membership and client write restrictions', async () => {
    const denied = await request('GET', `/api/shots?projectId=${ids.project}`, ids.outsider);
    assert.equal(denied.response.status, 403);

    const clientCreate = await request('POST', '/api/shots', ids.client, { projectId: ids.project, sceneCode: 'SC01', shotCode: 'CLIENT_DENIED' });
    assert.equal(clientCreate.response.status, 403);
  });

  test('redacts AI generation secrets from the same version for clients only', async () => {
    const asset = await request('POST', '/api/assets', ids.creator, { projectId: ids.project, name: '权限版本资产', category: '道具' });
    const task = await request('POST', '/api/tasks', ids.creator, { projectId: ids.project, entityType: 'asset', entityId: asset.data.asset.id, title: '权限测试任务', pipelineStage: '概念设计' });
    const aiParams = {
      prompt: 'internal prompt',
      generationCost: 42,
      seed: 9876,
      nasPath: '\\\\NAS\\project\\source.exr',
      sourceFilePath: '/mnt/nas/project/source.exr',
    };
    const created = await request('POST', '/api/versions', ids.creator, { taskId: task.data.task.id, fileUrl: 'https://example.test/review.png', fileType: 'image', aiParams });
    assert.equal(created.response.status, 201);

    for (const userId of [ids.creator, ids.director, ids.admin]) {
      const detail = await request('GET', `/api/versions/${created.data.version.id}`, userId);
      assert.equal(detail.response.status, 200);
      assert.deepEqual(detail.data.version.aiParams, aiParams);
    }

    const clientDetail = await request('GET', `/api/versions/${created.data.version.id}`, ids.client);
    assert.equal(clientDetail.response.status, 200);
    assert.equal('aiParams' in clientDetail.data.version, false);
    for (const secret of ['prompt', 'generationCost', 'seed', 'nasPath', 'sourceFilePath']) {
      assert.equal(JSON.stringify(clientDetail.data).includes(secret), false);
    }

    const clientList = await request('GET', `/api/versions?projectId=${ids.project}`, ids.client);
    assert.equal(clientList.response.status, 200);
    assert.equal('aiParams' in clientList.data.versions[0], false);
  });

  test('covers shot CRUD and duplicate shotCode failure', async () => {
    const created = await request('POST', '/api/shots', ids.creator, { projectId: ids.project, sceneCode: 'SC01', shotCode: 'SH001', description: '原始描述' });
    assert.equal(created.response.status, 201);
    createdShotId = created.data.shot.id;

    const duplicate = await request('POST', '/api/shots', ids.creator, { projectId: ids.project, sceneCode: 'SC01', shotCode: 'SH001' });
    assert.equal(duplicate.response.status, 409);

    const updated = await request('PATCH', `/api/shots/${createdShotId}`, ids.creator, { status: '制作中', description: '更新描述' });
    assert.equal(updated.response.status, 200);
    assert.equal(updated.data.shot.status, '制作中');

    const removed = await request('DELETE', `/api/shots/${createdShotId}`, ids.creator);
    assert.equal(removed.response.status, 204);
  });

  test('covers asset CRUD and client write restriction', async () => {
    const clientCreate = await request('POST', '/api/assets', ids.client, { projectId: ids.project, name: '客户资产', category: '道具' });
    assert.equal(clientCreate.response.status, 403);

    const created = await request('POST', '/api/assets', ids.creator, { projectId: ids.project, name: '测试资产', category: '道具' });
    assert.equal(created.response.status, 201);
    createdAssetId = created.data.asset.id;

    const updated = await request('PATCH', `/api/assets/${createdAssetId}`, ids.creator, { status: '已定稿' });
    assert.equal(updated.response.status, 200);
    assert.equal(updated.data.asset.status, '已定稿');

    const removed = await request('DELETE', `/api/assets/${createdAssetId}`, ids.creator);
    assert.equal(removed.response.status, 204);
  });

  test('creates complete ordered task chains for single shots and assets', async () => {
    const shot = await request('POST', '/api/shots', ids.creator, { projectId: ids.project, sceneCode: 'CHAIN', shotCode: 'CHAIN001' });
    assert.equal(shot.response.status, 201);
    const shotTasks = await pool.query('SELECT id,pipeline_stage,status,prerequisite_task_id FROM tasks WHERE entity_id=$1 ORDER BY due_date', [shot.data.shot.id]);
    assert.deepEqual(shotTasks.rows.map(row => row.pipeline_stage), ['台本', '视觉准备', '视频生成', '剪辑', '声音', '成片']);
    assert.equal(shotTasks.rows[0].status, '未开始');
    shotTasks.rows.slice(1).forEach((row, index) => { assert.equal(row.status, '已阻塞'); assert.equal(row.prerequisite_task_id, shotTasks.rows[index].id); });

    const asset = await request('POST', '/api/assets', ids.creator, { projectId: ids.project, name: '链路资产', category: '道具' });
    assert.equal(asset.response.status, 201);
    const assetTasks = await pool.query('SELECT id,pipeline_stage,status,prerequisite_task_id FROM tasks WHERE entity_id=$1 ORDER BY due_date', [asset.data.asset.id]);
    assert.deepEqual(assetTasks.rows.map(row => row.pipeline_stage), ['需求', '概念设计', '修改', '定稿']);
    assert.equal(assetTasks.rows[0].status, '制作中');
    assetTasks.rows.slice(1).forEach((row, index) => { assert.equal(row.status, '已阻塞'); assert.equal(row.prerequisite_task_id, assetTasks.rows[index].id); });
  });

  test('bulk imports are idempotent and roll back incomplete asset chains', async () => {
    const body = { projectId: ids.project, assets: [{ name: '批量链路资产', category: '角色' }] };
    assert.equal((await request('POST', '/api/assets/bulk', ids.creator, body)).response.status, 201);
    assert.equal((await request('POST', '/api/assets/bulk', ids.creator, body)).response.status, 201);
    const count = await pool.query(`SELECT count(*)::int AS count FROM tasks t JOIN assets a ON a.id=t.entity_id WHERE a.name='批量链路资产' AND t.deleted_at IS NULL`);
    assert.equal(count.rows[0].count, 4);

    const failed = await request('POST', '/api/assets/bulk', ids.creator, { projectId: ids.project, assets: [{ name: '应回滚资产', category: '无效分类' }] });
    assert.equal(failed.response.status, 500);
    const rolledBack = await pool.query(`SELECT count(*)::int AS count FROM assets WHERE name='应回滚资产'`);
    assert.equal(rolledBack.rows[0].count, 0);
  });

  test('bulk shot import saves dialogue, resolves typed assets, deduplicates separators, and rolls back', async () => {
    const existing = await request('POST', '/api/assets', ids.creator, { projectId: ids.project, name: '阿青', category: '角色' });
    assert.equal(existing.response.status, 201);
    const imported = await request('POST', '/api/shots/bulk', ids.creator, {
      projectId: ids.project,
      shots: [{ sceneCode: 'SC01', shotCode: 'IMPORT01', dialogue: '快走！', characterAssets: '阿青， 阿青;机器人', sceneAssets: '基地、走廊', propAssets: '', otherAssets: '道具:阿青|风格参考:赛博朋克' }],
    });
    assert.equal(imported.response.status, 201);
    assert.equal(imported.data.shots[0].dialogue, '快走！');
    assert.deepEqual(imported.data.importReport.reusedAssets, [{ name: '阿青', category: '角色' }]);
    assert.equal(imported.data.importReport.createdAssets.length, 5);
    const linked = await pool.query(`SELECT a.name,a.category FROM shot_assets sa JOIN assets a ON a.id=sa.asset_id WHERE sa.shot_id=$1 ORDER BY a.category,a.name`, [imported.data.shots[0].id]);
    assert.equal(linked.rowCount, 6);
    assert.equal(linked.rows.filter(row => row.name === '阿青').length, 2, 'same name remains distinct across asset types');

    const before = await pool.query('SELECT count(*)::int AS count FROM assets');
    const failed = await request('POST', '/api/shots/bulk', ids.creator, {
      projectId: ids.project,
      shots: [
        { sceneCode: 'SC02', shotCode: 'ROLLBACK01', characterAssets: '不应保留' },
        { sceneCode: 'SC02', shotCode: 'ROLLBACK02', durationSec: -1 },
      ],
    });
    assert.equal(failed.response.status, 500);
    assert.equal((await pool.query(`SELECT count(*)::int AS count FROM shots WHERE shot_code LIKE 'ROLLBACK%'`)).rows[0].count, 0);
    assert.equal((await pool.query('SELECT count(*)::int AS count FROM assets')).rows[0].count, before.rows[0].count);
  });

  test('updates task status, rejects invalid entityType, creates versions, review notes, and chat messages', async () => {
    const asset = await request('POST', '/api/assets', ids.creator, { projectId: ids.project, name: '版本资产', category: '道具' });
    createdAssetId = asset.data.asset.id;

    const invalidTask = await request('POST', '/api/tasks', ids.creator, { projectId: ids.project, entityType: 'file', entityId: createdAssetId });
    assert.equal(invalidTask.response.status, 400);

    const task = await request('POST', '/api/tasks', ids.creator, { projectId: ids.project, entityType: 'asset', entityId: createdAssetId, title: '资产任务', pipelineStage: '概念设计' });
    assert.equal(task.response.status, 201);
    createdTaskId = task.data.task.id;

    const taskStatus = await request('PATCH', `/api/tasks/${createdTaskId}`, ids.creator, { status: '待审核' });
    assert.equal(taskStatus.response.status, 200);
    assert.equal(taskStatus.data.task.status, '待审核');

    const version = await request('POST', '/api/versions', ids.creator, { taskId: createdTaskId, versionNumber: 'V001', fileUrl: 'https://example.test/review.png', fileType: 'image', changelog: '首版' });
    assert.equal(version.response.status, 201);
    createdVersionId = version.data.version.id;

    const note = await request('POST', `/api/versions/${createdVersionId}/notes`, ids.client, { content: '需要调整颜色', timestampSec: 1.5 });
    assert.equal(note.response.status, 201);
    assert.equal(note.data.note.content, '需要调整颜色');

    const channel = await request('POST', '/api/chat/channels', ids.creator, { projectId: ids.project, name: `集成频道 ${Date.now()}` });
    assert.equal(channel.response.status, 201);
    createdChannelId = channel.data.channel.id;

    const message = await request('POST', '/api/chat/messages', ids.creator, { channelId: createdChannelId, content: '提交审核' });
    assert.equal(message.response.status, 201);
    assert.equal(message.data.message.content, '提交审核');
  });

  test('blocks approving versions with unresolved mandatory notes', async () => {
    const versionId = await createReviewVersion();
    const note = await request('POST', `/api/versions/${versionId}/notes`, ids.client, { content: '必须修正构图', isMandatory: true });
    assert.equal(note.response.status, 201);

    const blocked = await request('PATCH', `/api/versions/${versionId}/status`, ids.client, { status: '已通过' });
    assert.equal(blocked.response.status, 409);
    assert.equal(blocked.data.code, 'UNRESOLVED_MANDATORY_NOTES');
    assert.equal(blocked.data.details.unresolvedMandatoryCount, 1);
    assert.deepEqual(blocked.data.details.noteIds, [note.data.note.id]);
  });

  test('allows approving versions after all mandatory notes are resolved', async () => {
    const versionId = await createReviewVersion();
    const note = await request('POST', `/api/versions/${versionId}/notes`, ids.client, { content: '必须修正颜色', isMandatory: true });
    assert.equal(note.response.status, 201);
    const resolved = await request('PATCH', `/api/notes/${note.data.note.id}`, ids.creator, { status: '已解决' });
    assert.equal(resolved.response.status, 200);

    const approved = await request('PATCH', `/api/versions/${versionId}/status`, ids.client, { status: '已通过' });
    assert.equal(approved.response.status, 200);
    assert.equal(approved.data.version.status, '已通过');
  });

  test('allows approving versions with unresolved normal notes', async () => {
    const versionId = await createReviewVersion();
    const note = await request('POST', `/api/versions/${versionId}/notes`, ids.client, { content: '可以考虑更亮', isMandatory: false });
    assert.equal(note.response.status, 201);

    const approved = await request('PATCH', `/api/versions/${versionId}/status`, ids.client, { status: '已通过' });
    assert.equal(approved.response.status, 200);
    assert.equal(approved.data.version.status, '已通过');
  });

  test('rejects invalid upload entityType, oversized upload, and deleting another creator file', async () => {
    const clientForm = new FormData();
    clientForm.set('projectId', ids.project);
    clientForm.set('fileType', 'review');
    clientForm.set('file', new Blob(['client'], { type: 'text/plain' }), 'client.txt');
    const clientUpload = await request('POST', '/api/files/upload', ids.client, clientForm);
    assert.equal(clientUpload.response.status, 403);

    const invalidForm = new FormData();
    invalidForm.set('projectId', ids.project);
    invalidForm.set('fileType', 'review');
    invalidForm.set('entityType', 'sequence');
    invalidForm.set('file', new Blob(['ok'], { type: 'text/plain' }), 'ok.txt');
    const invalid = await request('POST', '/api/files/upload', ids.creator, invalidForm);
    assert.equal(invalid.response.status, 400);

    const bigForm = new FormData();
    bigForm.set('projectId', ids.project);
    bigForm.set('fileType', 'review');
    bigForm.set('file', new Blob([new Uint8Array(1024 * 1024 + 1)], { type: 'text/plain' }), 'big.txt');
    const tooLarge = await request('POST', '/api/files/upload', ids.creator, bigForm);
    assert.equal(tooLarge.response.status, 413);

    const owner = await request('POST', '/api/assets', ids.creator, { projectId: ids.project, name: '源文件资产', category: '道具' });
    const okForm = new FormData();
    okForm.set('projectId', ids.project);
    okForm.set('fileType', 'source');
    okForm.set('entityType', 'asset');
    okForm.set('entityId', owner.data.asset.id);
    okForm.set('file', new Blob(['owned by creator'], { type: 'text/plain' }), 'owned.txt');
    const uploaded = await request('POST', '/api/files/upload', ids.creator, okForm);
    assert.equal(uploaded.response.status, 201);
    creatorFileId = uploaded.data.file.id;

    const deleteByClient = await request('DELETE', `/api/files/${creatorFileId}`, ids.client);
    assert.equal(deleteByClient.response.status, 403);
  });

  test('atomically owns review files by UUID and rejects missing or cross-project ownership', async () => {
    const unowned = new FormData();
    unowned.set('projectId', ids.project);
    unowned.set('fileType', 'review');
    unowned.set('file', new Blob(['review'], { type: 'text/plain' }), 'review.txt');
    assert.equal((await request('POST', '/api/files/upload', ids.creator, unowned)).response.status, 400);

    const foreignAsset = await request('POST', '/api/assets', ids.outsider, { projectId: ids.secondProject, name: '外部资产', category: '道具' });
    const crossed = new FormData();
    crossed.set('projectId', ids.project);
    crossed.set('fileType', 'source');
    crossed.set('entityType', 'asset');
    crossed.set('entityId', foreignAsset.data.asset.id);
    crossed.set('file', new Blob(['source'], { type: 'text/plain' }), 'source.txt');
    assert.equal((await request('POST', '/api/files/upload', ids.creator, crossed)).response.status, 400);

    const asset = await request('POST', '/api/assets', ids.creator, { projectId: ids.project, name: '审核归属资产', category: '道具' });
    const task = await request('POST', '/api/tasks', ids.creator, { projectId: ids.project, entityType: 'asset', entityId: asset.data.asset.id, title: '审核归属任务', pipelineStage: '概念设计' });
    const review = new FormData();
    review.set('projectId', ids.project);
    review.set('fileType', 'review');
    review.set('taskId', task.data.task.id);
    review.set('entityType', 'asset');
    review.set('entityId', asset.data.asset.id);
    review.set('versionNumber', 'V007');
    review.set('versionFileType', 'image');
    review.set('file', new Blob(['review'], { type: 'text/plain' }), 'review.txt');
    const created = await request('POST', '/api/files/upload', ids.creator, review);
    assert.equal(created.response.status, 201);
    const linked = await pool.query('SELECT f.version_id,v.version_number FROM project_files f JOIN versions v ON v.id=f.version_id WHERE f.id=$1', [created.data.file.id]);
    assert.equal(linked.rows[0].version_number, 'V007');
    assert.ok(linked.rows[0].version_id);
  });
});
