import type { Request, RequestHandler } from 'express';
import type { Pool, PoolClient } from 'pg';
import { pool } from './db';

export const AUDIT_EVENTS = {
  PROJECT_CREATE: 'project.create',
  PROJECT_UPDATE: 'project.update',
  MEMBER_ADD: 'member.add',
  MEMBER_REMOVE: 'member.remove',
  SHOT_CREATE: 'shot.create',
  SHOT_BULK_IMPORT: 'shot.bulk.import',
  SHOT_UPDATE: 'shot.update',
  SHOT_DELETE: 'shot.delete',
  SHOT_RESTORE: 'shot.restore',
  SHOT_ASSETS_CHANGE: 'shot.assets.change',
  ASSET_CREATE: 'asset.create',
  ASSET_UPDATE: 'asset.update',
  ASSET_DELETE: 'asset.delete',
  ASSET_RESTORE: 'asset.restore',
  ASSET_APPROVED_VERSION_CHANGE: 'asset.approved_version.change',
  TASK_CREATE: 'task.create',
  TASK_DELETE: 'task.delete',
  TASK_RESTORE: 'task.restore',
  TASK_STATUS_CHANGE: 'task.status.change',
  TASK_ASSIGNEE_CHANGE: 'task.assignee.change',
  TASK_DUE_DATE_CHANGE: 'task.dueDate.change',
  VERSION_SUBMIT: 'version.submit',
  VERSION_DELETE: 'version.delete',
  VERSION_RESTORE: 'version.restore',
  VERSION_STATUS_CHANGE: 'version.status.change',
  VERSION_FINAL_SET: 'version.final.set',
  REVIEW_STATUS_CHANGE: 'review.status.change',
  NOTE_CREATE: 'note.create',
  NOTE_DELETE: 'note.delete',
  NOTE_RESTORE: 'note.restore',
  NOTE_UPDATE: 'note.update',
  NOTE_RESOLVE: 'note.resolve',
  NOTE_REPLY: 'note.reply',
  REVIEW_LIST_DELETE: 'review_list.delete',
  REVIEW_LIST_RESTORE: 'review_list.restore',
  FILE_UPLOAD: 'file.upload',
  FILE_NAS_REGISTER: 'file.nas.register',
  FILE_DELETE: 'file.delete',
  FILE_RESTORE: 'file.restore',
  FILE_DOWNLOAD: 'file.download',
} as const;

export type AuditEvent = typeof AUDIT_EVENTS[keyof typeof AUDIT_EVENTS];

export const getClientIp = (request: Request): string | null =>
  request.ip || request.socket.remoteAddress || null;

export const getForwardedClientIps = (request: Request): string[] => {
  const forwardedFor = request.get('x-forwarded-for');
  return forwardedFor
    ? forwardedFor.split(',').map(value => value.trim()).filter(Boolean)
    : [];
};

export const accessLogger: RequestHandler = (request, response, next) => {
  const startedAt = process.hrtime.bigint();
  response.on('finish', () => {
    const durationMs = Number(process.hrtime.bigint() - startedAt) / 1_000_000;
    console.log(JSON.stringify({
      type: 'access',
      timestamp: new Date().toISOString(),
      method: request.method,
      path: request.originalUrl,
      statusCode: response.statusCode,
      durationMs: Number(durationMs.toFixed(2)),
      clientIp: getClientIp(request),
      forwardedFor: getForwardedClientIps(request),
      userId: request.authUser?.id ?? null,
      userAgent: request.get('user-agent') ?? null,
    }));
  });
  next();
};

export const recordAuditLog = async (
  db: Pool | PoolClient,
  request: Request,
  input: {
    action: string;
    actorId?: string | null;
    projectId?: string | null;
    entityType?: string | null;
    entityId?: string | null;
    details?: Record<string, unknown>;
  },
): Promise<void> => {
  await db.query(
    `INSERT INTO audit_logs (
      actor_id, project_id, action, entity_type, entity_id, details, ip_address
    ) VALUES ($1, $2, $3, $4, $5, $6::jsonb, $7)`,
    [
      input.actorId ?? request.authUser?.id ?? null,
      input.projectId ?? null,
      input.action,
      input.entityType ?? null,
      input.entityId ?? null,
      JSON.stringify({
        ...(input.details ?? {}),
        forwardedFor: getForwardedClientIps(request),
        userAgent: request.get('user-agent') ?? null,
      }),
      getClientIp(request),
    ],
  );
};
