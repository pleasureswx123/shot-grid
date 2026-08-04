import { Router } from 'express';
import type { NextFunction, Request, RequestHandler, Response } from 'express';
import { pool } from './db';

const asyncHandler = (
  handler: (request: Request, response: Response, next: NextFunction) => Promise<void>,
): RequestHandler => (request, response, next) => {
  handler(request, response, next).catch(next);
};

export const usersRouter = Router();

usersRouter.get('/', asyncHandler(async (_request, response) => {
  const result = await pool.query(
    `SELECT id, name, email, role, department, avatar
       FROM users
      WHERE is_active = true
      ORDER BY department ASC, name ASC`,
  );
  response.json({ users: result.rows });
}));

