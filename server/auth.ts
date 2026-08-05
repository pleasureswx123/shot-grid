import { Router } from 'express';
import type { NextFunction, Request, RequestHandler, Response } from 'express';
import type { UserRole } from '../src/types';
import { config } from './config';
import { pool } from './db';
import {
  createSessionToken,
  hashSessionToken,
  verifyPassword,
} from './security';
import { recordAuditLog } from './audit';

const SESSION_COOKIE = 'shotgrid_session';
const LOGIN_WINDOW_MS = 15 * 60 * 1000;
const MAX_LOGIN_FAILURES = 10;
const loginAttempts = new Map<string, { failures: number; resetAt: number }>();

interface UserRow {
  id: string;
  name: string;
  email: string;
  password_hash: string;
  role: UserRole;
  department: string;
  avatar: string | null;
}

const asyncHandler = (
  handler: (request: Request, response: Response, next: NextFunction) => Promise<void>,
): RequestHandler => (request, response, next) => {
  handler(request, response, next).catch(next);
};

const getCookie = (request: Request, name: string): string | undefined => {
  const cookieHeader = request.headers.cookie;
  if (!cookieHeader) return undefined;

  for (const item of cookieHeader.split(';')) {
    const separator = item.indexOf('=');
    if (separator < 0) continue;
    const key = item.slice(0, separator).trim();
    if (key === name) {
      return decodeURIComponent(item.slice(separator + 1).trim());
    }
  }
  return undefined;
};

const publicUser = (user: UserRow) => ({
  id: user.id,
  name: user.name,
  email: user.email,
  role: user.role,
  department: user.department,
  avatar: user.avatar,
});

const setSessionCookie = (response: Response, token: string): void => {
  response.cookie(SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: 'lax',
    secure: config.sessionCookieSecure,
    path: '/',
    maxAge: config.sessionTtlHours * 60 * 60 * 1000,
  });
};

const clearSessionCookie = (response: Response): void => {
  response.clearCookie(SESSION_COOKIE, {
    httpOnly: true,
    sameSite: 'lax',
    secure: config.sessionCookieSecure,
    path: '/',
  });
};

const loginRateLimit = (request: Request, response: Response, next: NextFunction): void => {
  const key = request.ip || 'unknown';
  const now = Date.now();
  const current = loginAttempts.get(key);

  if (current && current.resetAt > now && current.failures >= MAX_LOGIN_FAILURES) {
    response.setHeader('Retry-After', Math.ceil((current.resetAt - now) / 1000));
    response.status(429).json({ error: '登录尝试过多，请稍后再试。' });
    return;
  }
  if (current && current.resetAt <= now) loginAttempts.delete(key);
  next();
};

const recordLoginFailure = (request: Request): void => {
  const key = request.ip || 'unknown';
  const now = Date.now();
  const current = loginAttempts.get(key);
  if (!current || current.resetAt <= now) {
    loginAttempts.set(key, { failures: 1, resetAt: now + LOGIN_WINDOW_MS });
    return;
  }
  current.failures += 1;
};

export const loadAuthenticatedUser: RequestHandler = asyncHandler(async (request, _response, next) => {
  const token = getCookie(request, SESSION_COOKIE);
  if (!token) {
    next();
    return;
  }

  const tokenHash = hashSessionToken(token);
  const result = await pool.query<UserRow>(
    `SELECT u.id, u.name, u.email, u.password_hash, u.role, u.department, u.avatar
       FROM sessions s
       JOIN users u ON u.id = s.user_id
      WHERE s.token_hash = $1
        AND s.expires_at > now()
        AND u.is_active = true`,
    [tokenHash],
  );

  if (!result.rowCount) {
    next();
    return;
  }

  request.authUser = publicUser(result.rows[0]);
  request.sessionTokenHash = tokenHash;
  await pool.query(
    `UPDATE sessions
        SET last_seen_at = now()
      WHERE token_hash = $1
        AND last_seen_at < now() - interval '5 minutes'`,
    [tokenHash],
  );
  next();
});

export const requireAuth: RequestHandler = (request, response, next) => {
  if (!request.authUser) {
    response.status(401).json({ error: '请先登录。' });
    return;
  }
  next();
};

export const authRouter = Router();

authRouter.post('/login', loginRateLimit, asyncHandler(async (request, response) => {
  const email = typeof request.body?.email === 'string'
    ? request.body.email.trim().toLowerCase()
    : '';
  const password = typeof request.body?.password === 'string' ? request.body.password : '';

  if (!email || !password || password.length > 1024) {
    response.status(400).json({ error: '请输入有效的邮箱和密码。' });
    return;
  }

  const result = await pool.query<UserRow>(
    `SELECT id, name, email, password_hash, role, department, avatar
       FROM users
      WHERE lower(email) = $1 AND is_active = true`,
    [email],
  );

  const user = result.rows[0];
  const dummyHash = `scrypt$${'A'.repeat(22)}$${'A'.repeat(86)}`;
  const passwordMatches = await verifyPassword(password, user?.password_hash || dummyHash);

  if (!user || !passwordMatches) {
    recordLoginFailure(request);
    response.status(401).json({ error: '邮箱或密码错误。' });
    return;
  }

  loginAttempts.delete(request.ip || 'unknown');
  const token = createSessionToken();
  const tokenHash = hashSessionToken(token);

  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await client.query(
      `INSERT INTO sessions (
        token_hash, user_id, ip_address, user_agent, expires_at
      ) VALUES ($1, $2, $3, $4, now() + ($5 * interval '1 hour'))`,
      [
        tokenHash,
        user.id,
        request.ip || null,
        request.get('user-agent') || null,
        config.sessionTtlHours,
      ],
    );
    await recordAuditLog(client, request, {
      action: 'auth.login',
      actorId: user.id,
      entityType: 'user',
      entityId: user.id,
      details: { email: user.email },
    });
    await client.query('COMMIT');
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }

  setSessionCookie(response, token);
  response.json({ user: publicUser(user) });
}));

authRouter.get('/me', requireAuth, (request, response) => {
  response.json({ user: request.authUser });
});

authRouter.post('/logout', requireAuth, asyncHandler(async (request, response) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    if (request.sessionTokenHash) {
      await client.query('DELETE FROM sessions WHERE token_hash = $1', [request.sessionTokenHash]);
    }
    await recordAuditLog(client, request, {
      action: 'auth.logout',
      entityType: 'user',
      entityId: request.authUser!.id,
    });
    await client.query('COMMIT');
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
  clearSessionCookie(response);
  response.status(204).end();
}));
