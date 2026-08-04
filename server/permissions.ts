import type { RequestHandler } from 'express';
import type { UserRole } from '../src/types';

export const requireRole = (...roles: UserRole[]): RequestHandler =>
  (request, response, next) => {
    if (!request.authUser) {
      response.status(401).json({ error: '请先登录。' });
      return;
    }
    if (!roles.includes(request.authUser.role)) {
      response.status(403).json({ error: '当前账号没有执行该操作的权限。' });
      return;
    }
    next();
  };

