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
