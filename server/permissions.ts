import type { RequestHandler } from 'express';
import type { UserRole } from '../src/types';

export type ProjectRole = UserRole;

export interface ProjectPermissionContext {
  systemRole: UserRole | string;
  projectRole?: ProjectRole | null;
}

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

const isSystemAdmin = ({ systemRole }: ProjectPermissionContext): boolean => systemRole === 'admin';
const projectRoleIs = (context: ProjectPermissionContext, roles: ProjectRole[]): boolean =>
  Boolean(context.projectRole && roles.includes(context.projectRole));

export const canViewProject = (context: ProjectPermissionContext): boolean =>
  isSystemAdmin(context) || projectRoleIs(context, ['admin', 'director', 'creator', 'client']);

export const canEditProject = (context: ProjectPermissionContext): boolean =>
  isSystemAdmin(context) || projectRoleIs(context, ['admin', 'director']);

export const canManageMembers = (context: ProjectPermissionContext): boolean =>
  isSystemAdmin(context) || projectRoleIs(context, ['admin', 'director']);

export const canCreateTask = (context: ProjectPermissionContext): boolean =>
  isSystemAdmin(context) || projectRoleIs(context, ['admin', 'director', 'creator']);

export const canSubmitVersion = (context: ProjectPermissionContext): boolean =>
  isSystemAdmin(context) || projectRoleIs(context, ['admin', 'director', 'creator']);

export const canReviewVersion = (context: ProjectPermissionContext): boolean =>
  isSystemAdmin(context) || projectRoleIs(context, ['admin', 'director', 'client']);

export const canCreateReviewList = (context: ProjectPermissionContext): boolean =>
  isSystemAdmin(context) || projectRoleIs(context, ['admin', 'director']);

export const canCommentReview = (context: ProjectPermissionContext): boolean =>
  isSystemAdmin(context) || projectRoleIs(context, ['admin', 'director', 'creator', 'client']);

export const canDeleteFile = (context: ProjectPermissionContext): boolean =>
  isSystemAdmin(context) || projectRoleIs(context, ['admin', 'director']);

export const getProjectPermissionContext = async (
  projectId: string,
  userId: string,
  systemRole: UserRole | string,
): Promise<ProjectPermissionContext> => {
  if (systemRole === 'admin') return { systemRole, projectRole: 'admin' };
  const { pool } = await import('./db');
  const result = await pool.query<{ project_role: ProjectRole }>(
    'SELECT project_role FROM project_members WHERE project_id = $1 AND user_id = $2',
    [projectId, userId],
  );
  return { systemRole, projectRole: result.rows[0]?.project_role ?? null };
};
