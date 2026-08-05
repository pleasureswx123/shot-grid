import type { NextFunction, Request, RequestHandler, Response } from 'express';
import { canSubmitVersion, canViewProject, getProjectPermissionContext } from './permissions';

export const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export const asyncHandler = (
  handler: (request: Request, response: Response, next: NextFunction) => Promise<void>,
): RequestHandler => (request, response, next) => {
  handler(request, response, next).catch(next);
};

export const requireProjectAccess = async (
  projectId: string,
  userId: string,
  systemRole: string,
): Promise<boolean> => {
  const context = await getProjectPermissionContext(projectId, userId, systemRole);
  return canViewProject(context);
};

export const requireProjectWriteAccess = async (
  projectId: string,
  userId: string,
  systemRole: string,
): Promise<boolean> => {
  const context = await getProjectPermissionContext(projectId, userId, systemRole);
  return canSubmitVersion(context);
};

const readProjectIdFromRequest = (request: Request): string => (
  typeof request.query.projectId === 'string'
    ? request.query.projectId
    : typeof request.body?.projectId === 'string'
      ? request.body.projectId
      : ''
);

export const requireProjectAccessFromRequest = async (
  request: Request,
  response: Response,
): Promise<string | null> => {
  const projectId = readProjectIdFromRequest(request);
  if (!UUID_PATTERN.test(projectId)) {
    response.status(400).json({ error: '项目 ID 无效。' });
    return null;
  }
  const ok = await requireProjectAccess(projectId, request.authUser!.id, request.authUser!.role);
  if (!ok) {
    response.status(403).json({ error: '您不是该项目的成员。' });
    return null;
  }
  return projectId;
};

export const readString = (value: unknown, fallback = ''): string =>
  typeof value === 'string' ? value.trim() : fallback;

export const readNumber = (value: unknown, fallback = 0): number => {
  const numberValue = Number(value);
  return Number.isFinite(numberValue) ? numberValue : fallback;
};

export const requireProjectWriteAccessFromRequest = async (
  request: Request,
  response: Response,
): Promise<string | null> => {
  const projectId = readProjectIdFromRequest(request);
  if (!UUID_PATTERN.test(projectId)) {
    response.status(400).json({ error: '项目 ID 无效。' });
    return null;
  }
  const ok = await requireProjectWriteAccess(projectId, request.authUser!.id, request.authUser!.role);
  if (!ok) {
    response.status(403).json({ error: '您没有写入该项目的权限。' });
    return null;
  }
  return projectId;
};
