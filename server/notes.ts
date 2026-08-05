import { randomUUID } from 'node:crypto';
import { Router } from 'express';
import { AUDIT_EVENTS, recordAuditLog } from './audit';
import { pool } from './db';
import { UUID_PATTERN, asyncHandler, readNumber, readString } from './apiUtils';
import { canCommentReview, canReviewVersion, canSubmitVersion, canViewProject, getProjectPermissionContext } from './permissions';

export const versionNotesRouter = Router({ mergeParams: true });
export const notesRouter = Router();

const selectNotes = `
  SELECT
    n.id,
    n.version_id AS "versionId",
    n.reviewer_id AS "reviewerId",
    n.content,
    n.timestamp_sec::float8 AS "timestampSec",
    n.annotation_data_url AS "annotationDataUrl",
    n.annotations,
    n.is_mandatory AS "isMandatory",
    n.status,
    n.reply_content AS "replyContent",
    n.replied_at AS "repliedAt",
    n.created_at AS "createdAt"
  FROM notes n
`;

const getVersionProjectId = async (versionId: string): Promise<string | null> => {
  if (!UUID_PATTERN.test(versionId)) return null;
  const result = await pool.query<{ project_id: string }>(
    `SELECT t.project_id
     FROM versions v
     JOIN tasks t ON t.id = v.task_id
     WHERE v.id = $1 AND v.deleted_at IS NULL AND t.deleted_at IS NULL`,
    [versionId],
  );
  return result.rows[0]?.project_id || null;
};

const getNoteProjectId = async (noteId: string): Promise<string | null> => {
  if (!UUID_PATTERN.test(noteId)) return null;
  const result = await pool.query<{ project_id: string }>(
    `SELECT t.project_id
     FROM notes n
     JOIN versions v ON v.id = n.version_id
     JOIN tasks t ON t.id = v.task_id
     WHERE n.id = $1 AND n.deleted_at IS NULL AND v.deleted_at IS NULL AND t.deleted_at IS NULL`,
    [noteId],
  );
  return result.rows[0]?.project_id || null;
};

const requireCapability = async (
  projectId: string,
  userId: string,
  systemRole: string,
  capability: 'view' | 'comment' | 'reply' | 'resolve',
) => {
  const context = await getProjectPermissionContext(projectId, userId, systemRole);
  const ok = capability === 'view'
    ? canViewProject(context)
    : capability === 'comment'
      ? canCommentReview(context)
      : capability === 'reply'
        ? canSubmitVersion(context)
        : canReviewVersion(context);
  return ok ? null : { status: 403, error: '您没有执行该批注操作的权限。' };
};

const fetchNote = async (noteId: string) => {
  const result = await pool.query(`${selectNotes} WHERE n.id = $1 AND n.deleted_at IS NULL`, [noteId]);
  return result.rows[0];
};

versionNotesRouter.get('/', asyncHandler(async (request, response) => {
  const versionId = request.params.versionId;
  const projectId = await getVersionProjectId(versionId);
  if (!projectId) {
    response.status(UUID_PATTERN.test(versionId) ? 404 : 400).json({ error: UUID_PATTERN.test(versionId) ? '版本不存在。' : '版本 ID 无效。' });
    return;
  }
  const accessError = await requireCapability(projectId, request.authUser!.id, request.authUser!.role, 'view');
  if (accessError) {
    response.status(accessError.status).json({ error: accessError.error });
    return;
  }

  const result = await pool.query(
    `${selectNotes} WHERE n.version_id = $1 AND n.deleted_at IS NULL ORDER BY n.created_at DESC`,
    [versionId],
  );
  response.json({ notes: result.rows });
}));

versionNotesRouter.post('/', asyncHandler(async (request, response) => {
  const versionId = request.params.versionId;
  const projectId = await getVersionProjectId(versionId);
  if (!projectId) {
    response.status(UUID_PATTERN.test(versionId) ? 404 : 400).json({ error: UUID_PATTERN.test(versionId) ? '版本不存在。' : '版本 ID 无效。' });
    return;
  }
  const accessError = await requireCapability(projectId, request.authUser!.id, request.authUser!.role, 'comment');
  if (accessError) {
    response.status(accessError.status).json({ error: accessError.error });
    return;
  }

  const id = randomUUID();
  await pool.query(
    `INSERT INTO notes (
       id, version_id, reviewer_id, content, timestamp_sec, annotation_data_url,
       annotations, is_mandatory, status, reply_content, replied_at
     ) VALUES ($1, $2, $3, $4, $5, $6, $7::jsonb, $8, $9, $10, $11)`,
    [
      id,
      versionId,
      request.authUser!.id,
      readString(request.body?.content),
      readNumber(request.body?.timestampSec, 0),
      readString(request.body?.annotationDataUrl),
      JSON.stringify(request.body?.annotations ?? null),
      request.body?.isMandatory !== false,
      readString(request.body?.status, '待处理'),
      typeof request.body?.replyContent === 'string' ? readString(request.body.replyContent) : null,
      typeof request.body?.replyContent === 'string' ? new Date() : null,
    ],
  );
  await recordAuditLog(pool, request, { action: AUDIT_EVENTS.NOTE_CREATE, projectId, entityType: 'note', entityId: id, details: { versionId, isMandatory: request.body?.isMandatory !== false, status: readString(request.body?.status, '待处理') } });
  response.status(201).json({ note: await fetchNote(id) });
}));

notesRouter.patch('/:noteId', asyncHandler(async (request, response) => {
  const noteId = request.params.noteId;
  const projectId = await getNoteProjectId(noteId);
  if (!projectId) {
    response.status(UUID_PATTERN.test(noteId) ? 404 : 400).json({ error: UUID_PATTERN.test(noteId) ? '批注不存在。' : '批注 ID 无效。' });
    return;
  }
  const changesStatus = typeof request.body?.status === 'string';
  const changesReply = typeof request.body?.replyContent === 'string';
  const accessError = await requireCapability(
    projectId,
    request.authUser!.id,
    request.authUser!.role,
    changesStatus ? 'resolve' : changesReply ? 'reply' : 'comment',
  );
  if (accessError) {
    response.status(accessError.status).json({ error: accessError.error });
    return;
  }

  const before = await fetchNote(noteId);
  await pool.query(
    `UPDATE notes
     SET content = COALESCE($2, content),
         timestamp_sec = COALESCE($3, timestamp_sec),
         annotation_data_url = COALESCE($4, annotation_data_url),
         annotations = COALESCE($5::jsonb, annotations),
         is_mandatory = COALESCE($6, is_mandatory),
         status = COALESCE($7, status),
         reply_content = COALESCE($8, reply_content),
         replied_at = CASE WHEN $8 IS NULL THEN replied_at ELSE now() END,
         updated_at = now()
     WHERE id = $1 AND deleted_at IS NULL`,
    [
      noteId,
      typeof request.body?.content === 'string' ? readString(request.body.content) : null,
      request.body?.timestampSec === undefined ? null : readNumber(request.body.timestampSec, 0),
      typeof request.body?.annotationDataUrl === 'string' ? readString(request.body.annotationDataUrl) : null,
      request.body?.annotations === undefined ? null : JSON.stringify(request.body.annotations),
      typeof request.body?.isMandatory === 'boolean' ? request.body.isMandatory : null,
      typeof request.body?.status === 'string' ? readString(request.body.status) : null,
      typeof request.body?.replyContent === 'string' ? readString(request.body.replyContent) : null,
    ],
  );
  const note = await fetchNote(noteId);
  await recordAuditLog(pool, request, { action: changesStatus ? AUDIT_EVENTS.NOTE_RESOLVE : changesReply ? AUDIT_EVENTS.NOTE_REPLY : AUDIT_EVENTS.NOTE_UPDATE, projectId, entityType: 'note', entityId: noteId, details: { versionId: note.versionId, before, changes: request.body, after: note } });
  response.json({ note });
}));
