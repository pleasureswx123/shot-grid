import { randomUUID } from 'node:crypto';
import { Router } from 'express';
import type { NextFunction, Request, RequestHandler, Response } from 'express';
import type { UserRole } from '../src/types';
import { pool } from './db';
import { requireRole } from './permissions';
import { hashPassword } from './security';

const VALID_ROLES: UserRole[] = ['admin', 'director', 'creator', 'client'];

const asyncHandler = (
  handler: (request: Request, response: Response, next: NextFunction) => Promise<void>,
): RequestHandler => (request, response, next) => {
  handler(request, response, next).catch(next);
};

export const adminRouter = Router();
adminRouter.use(requireRole('admin'));

adminRouter.get('/users', asyncHandler(async (_request, response) => {
  const result = await pool.query(
    `SELECT id, name, email, role, department, avatar,
            is_active AS "isActive", created_at AS "createdAt"
       FROM users
      ORDER BY is_active DESC, name ASC`,
  );
  response.json({ users: result.rows });
}));


adminRouter.get('/audit-logs', asyncHandler(async (request, response) => {
  const limit = Math.min(Number.parseInt(String(request.query.limit || '100'), 10) || 100, 500);
  const action = typeof request.query.action === 'string' ? request.query.action : '';
  const projectId = typeof request.query.projectId === 'string' ? request.query.projectId : '';
  const actorId = typeof request.query.actorId === 'string' ? request.query.actorId : '';
  const from = typeof request.query.from === 'string' ? request.query.from : '';
  const to = typeof request.query.to === 'string' ? request.query.to : '';
  const conditions: string[] = [];
  const values: unknown[] = [];
  const add = (condition: string, value: unknown) => { values.push(value); conditions.push(condition.replace('?', `$${values.length}`)); };
  if (action) add('al.action = ?', action);
  if (projectId) add('al.project_id = ?::uuid', projectId);
  if (actorId) add('al.actor_id = ?::uuid', actorId);
  if (from) add('al.created_at >= ?::timestamptz', from);
  if (to) add('al.created_at <= ?::timestamptz', to);
  values.push(limit);
  const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
  const result = await pool.query(
    `SELECT al.id, al.actor_id AS "actorId", u.name AS "actorName",
            al.project_id AS "projectId", p.name AS "projectName",
            al.action, al.entity_type AS "entityType", al.entity_id AS "entityId",
            al.details, al.ip_address::text AS "ipAddress", al.created_at AS "createdAt"
       FROM audit_logs al
       LEFT JOIN users u ON u.id = al.actor_id
       LEFT JOIN projects p ON p.id = al.project_id
       ${where}
      ORDER BY al.created_at DESC
      LIMIT $${values.length}`,
    values,
  );
  response.json({ auditLogs: result.rows });
}));

adminRouter.post('/users', asyncHandler(async (request, response) => {
  const name = typeof request.body?.name === 'string' ? request.body.name.trim() : '';
  const email = typeof request.body?.email === 'string'
    ? request.body.email.trim().toLowerCase()
    : '';
  const department = typeof request.body?.department === 'string'
    ? request.body.department.trim()
    : '';
  const password = typeof request.body?.password === 'string' ? request.body.password : '';
  const role = request.body?.role as UserRole;

  if (!name || name.length > 120 || !email.includes('@') || email.length > 255) {
    response.status(400).json({ error: '姓名或邮箱格式无效。' });
    return;
  }
  if (!VALID_ROLES.includes(role)) {
    response.status(400).json({ error: '用户角色无效。' });
    return;
  }
  if (password.length < 10 || password.length > 1024) {
    response.status(400).json({ error: '初始密码必须为 10 至 1024 个字符。' });
    return;
  }

  const passwordHash = await hashPassword(password);
  const id = randomUUID();
  const client = await pool.connect();

  try {
    await client.query('BEGIN');
    const created = await client.query(
      `INSERT INTO users (id, name, email, password_hash, role, department)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING id, name, email, role, department, avatar,
                 is_active AS "isActive", created_at AS "createdAt"`,
      [id, name, email, passwordHash, role, department],
    );
    await client.query(
      `INSERT INTO audit_logs (
        actor_id, action, entity_type, entity_id, details, ip_address
      ) VALUES ($1, 'user.create', 'user', $2, $3::jsonb, $4)`,
      [
        request.authUser!.id,
        id,
        JSON.stringify({ name, email, role, department }),
        request.ip || null,
      ],
    );
    await client.query('COMMIT');
    response.status(201).json({ user: created.rows[0] });
  } catch (error: any) {
    await client.query('ROLLBACK');
    if (error?.code === '23505') {
      response.status(409).json({ error: '该邮箱已经存在。' });
      return;
    }
    throw error;
  } finally {
    client.release();
  }
}));
