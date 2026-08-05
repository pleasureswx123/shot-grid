import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { after, before, beforeEach, describe, test } from 'node:test';
import { createServer } from 'node:http';

const testDatabaseUrl = process.env.TEST_DATABASE_URL;
const runIntegration = Boolean(testDatabaseUrl);

process.env.NODE_ENV = 'production';
process.env.DATABASE_URL = testDatabaseUrl || process.env.DATABASE_URL || 'postgresql://invalid/shotgrid_light_test_missing';
process.env.SESSION_COOKIE_SECURE = 'false';

const maybeDescribe = runIntegration ? describe : describe.skip;

maybeDescribe('review list workflow', () => {
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
    client: randomUUID(),
    creator: randomUUID(),
    project: randomUUID(),
    asset: randomUUID(),
    task: randomUUID(),
    versionA: randomUUID(),
    versionB: randomUUID(),
  };
  const cookies = new Map<string, string>();

  const request = async (method: string, url: string, asUser: string, body?: unknown) => {
    const response = await fetch(`${baseUrl}${url}`, {
      method,
      headers: { 'content-type': 'application/json', cookie: cookies.get(asUser) || '' },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    const text = await response.text();
    return { response, data: text ? JSON.parse(text) : null };
  };

  const insertUser = async (id: string, role: string) => {
    await pool.query(`INSERT INTO users (id, name, email, password_hash, role, department) VALUES ($1, $2, $3, 'hash', $4, '测试')`, [id, role, `${id}@example.test`, role]);
    const token = createSessionToken();
    await pool.query(`INSERT INTO sessions (token_hash, user_id, expires_at) VALUES ($1, $2, now() + interval '1 hour')`, [hashSessionToken(token), id]);
    cookies.set(id, `shotgrid_session=${encodeURIComponent(token)}`);
  };

  before(async () => {
    ({ pool, closeDatabase } = await import('./db'));
    ({ runMigrations } = await import('./migrate'));
    ({ createApp } = await import('./app'));
    ({ createSessionToken, hashSessionToken } = await import('./security'));
    await runMigrations();
    const app = await createApp();
    server = createServer(app);
    await new Promise<void>((resolve) => server!.listen(0, '127.0.0.1', resolve));
    const address = server.address();
    assert.ok(address && typeof address === 'object');
    baseUrl = `http://127.0.0.1:${address.port}`;
  });

  beforeEach(async () => {
    await pool.query('TRUNCATE review_list_participants, review_list_versions, review_lists, notes, versions, tasks, assets, project_members, projects, sessions, users RESTART IDENTITY CASCADE');
    await insertUser(ids.admin, 'admin');
    await insertUser(ids.director, 'director');
    await insertUser(ids.client, 'client');
    await insertUser(ids.creator, 'creator');
    await pool.query(`INSERT INTO projects (id, name, code, project_type, director_id, storage_key) VALUES ($1, '审核项目', $2, '短片', $3, $2)`, [ids.project, `REV_${Date.now()}`, ids.director]);
    await pool.query(`INSERT INTO project_members (project_id, user_id, project_role) VALUES ($1,$2,'admin'),($1,$3,'director'),($1,$4,'client'),($1,$5,'creator')`, [ids.project, ids.admin, ids.director, ids.client, ids.creator]);
    await pool.query(`INSERT INTO assets (id, project_id, name, category) VALUES ($1, $2, '审核资产', '道具')`, [ids.asset, ids.project]);
    await pool.query(`INSERT INTO tasks (id, project_id, title, entity_type, entity_id, pipeline_stage) VALUES ($1, $2, '审核任务', 'asset', $3, '概念设计')`, [ids.task, ids.project, ids.asset]);
    await pool.query(`INSERT INTO versions (id, task_id, entity_type, entity_id, version_number, file_url, file_type) VALUES ($1,$2,'asset',$3,'V001','https://example.test/a.png','image'),($4,$2,'asset',$3,'V002','https://example.test/b.png','image')`, [ids.versionA, ids.task, ids.asset, ids.versionB]);
  });

  after(async () => {
    await new Promise<void>((resolve, reject) => server?.close(error => error ? reject(error) : resolve()));
    await closeDatabase?.();
  });

  test('creates, submits, completes, archives, and rejects illegal edits', async () => {
    const created = await request('POST', `/api/projects/${ids.project}/review-lists`, ids.director, {
      title: '第 1 轮审核',
      date: '2026-08-05',
      versionIds: [ids.versionA],
      roundNumber: 1,
      dueAt: '2026-08-06T10:00:00Z',
      participants: [{ userId: ids.client, role: '客户', hasCompleted: false }],
    });
    assert.equal(created.response.status, 201);
    assert.equal(created.data.reviewList.status, '草稿');
    assert.equal(created.data.reviewList.participants[0].userId, ids.client);

    const submitted = await request('POST', `/api/review-lists/${created.data.reviewList.id}/submit`, ids.director);
    assert.equal(submitted.response.status, 200);
    assert.equal(submitted.data.reviewList.status, '待审核');

    const illegalEdit = await request('PATCH', `/api/review-lists/${created.data.reviewList.id}`, ids.creator, { versionIds: [ids.versionA, ids.versionB] });
    assert.equal(illegalEdit.response.status, 403);

    const prematureComplete = await request('POST', `/api/review-lists/${created.data.reviewList.id}/complete`, ids.director);
    assert.equal(prematureComplete.response.status, 409);

    await pool.query(`UPDATE versions SET status = '已通过' WHERE id = $1`, [ids.versionA]);
    const participantDone = await request('POST', `/api/review-lists/${created.data.reviewList.id}/participants/${ids.client}/complete`, ids.client);
    assert.equal(participantDone.response.status, 200);
    assert.equal(participantDone.data.reviewList.status, '已完成');
    assert.ok(participantDone.data.reviewList.completedAt);

    const archived = await request('POST', `/api/review-lists/${created.data.reviewList.id}/archive`, ids.director);
    assert.equal(archived.response.status, 200);
    assert.equal(archived.data.reviewList.status, '已归档');
  });
});
