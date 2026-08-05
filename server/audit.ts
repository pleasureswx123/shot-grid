import type { Request, RequestHandler } from 'express';
import type { Pool, PoolClient } from 'pg';
import { pool } from './db';

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
