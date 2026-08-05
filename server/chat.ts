import { randomUUID } from 'node:crypto';
import { Router } from 'express';
import type { Request, Response } from 'express';
import { pool } from './db';
import { asyncHandler, readNumber, readString, requireProjectAccess, requireProjectAccessFromRequest, UUID_PATTERN } from './apiUtils';

const DEFAULT_MESSAGE_LIMIT = 50;
const MAX_MESSAGE_LIMIT = 100;

export const chatRouter = Router();

const readMessageLimit = (value: unknown): number =>
  Math.min(Math.max(Math.trunc(readNumber(value, DEFAULT_MESSAGE_LIMIT)), 1), MAX_MESSAGE_LIMIT);

const toMediaSizeBytes = (mediaSizeMb: unknown): number | null => {
  const mediaSize = readNumber(mediaSizeMb, 0);
  return mediaSize > 0 ? Math.round(mediaSize * 1024 * 1024) : null;
};

const sendChannelAccessDenied = (response: Response) => {
  response.status(403).json({ error: '您无权访问该聊天频道。' });
};

const getAccessibleChannel = async (channelId: string, request: Request, response: Response) => {
  if (!UUID_PATTERN.test(channelId)) {
    response.status(400).json({ error: '频道 ID 无效。' });
    return null;
  }

  const result = await pool.query(
    `SELECT c.id, c.project_id AS "projectId", c.is_private AS "isPrivate"
       FROM department_channels c
      WHERE c.id = $1`,
    [channelId],
  );
  if (!result.rowCount) {
    response.status(404).json({ error: '频道不存在。' });
    return null;
  }

  const channel = result.rows[0] as { id: string; projectId: string; isPrivate: boolean };
  const hasProjectAccess = await requireProjectAccess(
    channel.projectId,
    request.authUser!.id,
    request.authUser!.role,
  );
  if (!hasProjectAccess) {
    response.status(403).json({ error: '您不是该项目的成员。' });
    return null;
  }

  if (channel.isPrivate && request.authUser!.role !== 'admin') {
    const memberResult = await pool.query(
      'SELECT 1 FROM channel_members WHERE channel_id = $1 AND user_id = $2',
      [channelId, request.authUser!.id],
    );
    if (!memberResult.rowCount) {
      sendChannelAccessDenied(response);
      return null;
    }
  }

  return channel;
};

chatRouter.get('/channels', asyncHandler(async (request, response) => {
  const projectId = await requireProjectAccessFromRequest(request, response);
  if (!projectId) return;

  const result = await pool.query(
    `SELECT c.id, c.name, c.department, c.description, c.icon,
            c.is_private AS "isPrivate",
            0 AS "unreadCount",
            coalesce(array_agg(cm.user_id) FILTER (WHERE cm.user_id IS NOT NULL), '{}') AS "memberIds"
       FROM department_channels c
       LEFT JOIN channel_members cm ON cm.channel_id = c.id
      WHERE c.project_id = $1
        AND (
          c.is_private = false
          OR $3 = 'admin'
          OR EXISTS (
            SELECT 1 FROM channel_members self
             WHERE self.channel_id = c.id AND self.user_id = $2
          )
        )
      GROUP BY c.id
      ORDER BY c.created_at ASC`,
    [projectId, request.authUser!.id, request.authUser!.role],
  );
  response.json({ channels: result.rows });
}));

chatRouter.post('/channels', asyncHandler(async (request, response) => {
  const projectId = await requireProjectAccessFromRequest(request, response);
  if (!projectId) return;

  const id = randomUUID();
  const name = readString(request.body?.name, '项目群聊');
  const department = readString(request.body?.department, '全体项目成员');
  const description = readString(request.body?.description);
  const icon = readString(request.body?.icon, 'MessageSquare');
  const isPrivate = Boolean(request.body?.isPrivate);
  const requestedMemberIds = Array.isArray(request.body?.memberIds)
    ? request.body.memberIds.filter((item: unknown): item is string => typeof item === 'string' && UUID_PATTERN.test(item))
    : [];
  const memberIds = Array.from(new Set([request.authUser!.id, ...requestedMemberIds]));

  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await client.query(
      `INSERT INTO department_channels (id, project_id, name, department, description, icon, is_private, created_by)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
      [id, projectId, name, department, description, icon, isPrivate, request.authUser!.id],
    );
    if (isPrivate) {
      await client.query(
        `INSERT INTO channel_members (channel_id, user_id)
         SELECT $1, pm.user_id
           FROM project_members pm
          WHERE pm.project_id = $2 AND pm.user_id = ANY($3::uuid[])
         ON CONFLICT DO NOTHING`,
        [id, projectId, memberIds],
      );
    }
    await client.query('COMMIT');
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }

  response.status(201).json({
    channel: { id, name, department, description, icon, unreadCount: 0, isPrivate, memberIds: isPrivate ? memberIds : [] },
  });
}));

chatRouter.get('/channels/:channelId/members', asyncHandler(async (request, response) => {
  const channel = await getAccessibleChannel(request.params.channelId, request, response);
  if (!channel) return;

  const result = await pool.query(
    `SELECT u.id, u.name, u.avatar, u.role, u.department, u.email, cm.joined_at AS "joinedAt"
       FROM channel_members cm
       JOIN users u ON u.id = cm.user_id
      WHERE cm.channel_id = $1
      ORDER BY u.name ASC`,
    [request.params.channelId],
  );
  response.json({ members: result.rows });
}));

chatRouter.get('/messages', asyncHandler(async (request, response) => {
  const channelId = typeof request.query.channelId === 'string' ? request.query.channelId : '';
  const projectId = typeof request.query.projectId === 'string' ? request.query.projectId : '';
  const before = typeof request.query.before === 'string' ? request.query.before : '';
  const limit = readMessageLimit(request.query.limit);

  if (channelId) {
    const channel = await getAccessibleChannel(channelId, request, response);
    if (!channel) return;
  } else if (!await requireProjectAccess(projectId, request.authUser!.id, request.authUser!.role)) {
    response.status(403).json({ error: '您不是该项目的成员。' });
    return;
  }

  const values: unknown[] = [request.authUser!.id, request.authUser!.role, limit];
  const filters = ['m.deleted_at IS NULL'];
  if (channelId) {
    values.push(channelId);
    filters.push(`m.channel_id = $${values.length}`);
  } else {
    values.push(projectId);
    filters.push(`c.project_id = $${values.length}`);
  }
  if (before) {
    values.push(before);
    filters.push(`m.created_at < $${values.length}::timestamptz`);
  }

  const result = await pool.query(
    `SELECT * FROM (
       SELECT m.id, m.channel_id AS "channelId", m.sender_id AS "senderId", m.content,
              m.media_type AS "mediaType", m.media_url AS "mediaUrl", m.media_name AS "mediaName",
              (m.media_size_bytes::float8 / 1048576) AS "mediaSizeMb",
              m.edited_media_url AS "editedMediaUrl", m.referenced_entity AS "referencedEntity",
              m.created_at AS "createdAt",
              coalesce(array_agg(l.user_id) FILTER (WHERE l.user_id IS NOT NULL), '{}') AS likes
         FROM chat_messages m
         JOIN department_channels c ON c.id = m.channel_id
         LEFT JOIN chat_message_likes l ON l.message_id = m.id
        WHERE ${filters.join(' AND ')}
          AND (
            c.is_private = false
            OR $2 = 'admin'
            OR EXISTS (SELECT 1 FROM channel_members cm WHERE cm.channel_id = c.id AND cm.user_id = $1)
          )
        GROUP BY m.id
        ORDER BY m.created_at DESC
        LIMIT $3
     ) page
     ORDER BY "createdAt" ASC`,
    values,
  );
  response.json({ chatMessages: result.rows });
}));

chatRouter.post('/messages', asyncHandler(async (request, response) => {
  const channel = await getAccessibleChannel(readString(request.body?.channelId), request, response);
  if (!channel) return;

  const id = randomUUID();
  const mediaSizeBytes = toMediaSizeBytes(request.body?.mediaSizeMb);
  const result = await pool.query(
    `INSERT INTO chat_messages (
       id, channel_id, sender_id, content, media_type, media_url, media_name,
       media_size_bytes, edited_media_url, referenced_entity
     ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10::jsonb)
     RETURNING id, channel_id AS "channelId", sender_id AS "senderId", content,
       media_type AS "mediaType", media_url AS "mediaUrl", media_name AS "mediaName",
       (media_size_bytes::float8 / 1048576) AS "mediaSizeMb", edited_media_url AS "editedMediaUrl",
       referenced_entity AS "referencedEntity", created_at AS "createdAt", '{}'::uuid[] AS likes`,
    [
      id,
      request.body.channelId,
      request.authUser!.id,
      readString(request.body?.content),
      readString(request.body?.mediaType, 'none'),
      readString(request.body?.mediaUrl) || null,
      readString(request.body?.mediaName) || null,
      mediaSizeBytes,
      readString(request.body?.editedMediaUrl) || null,
      JSON.stringify(request.body?.referencedEntity ?? null),
    ],
  );
  response.status(201).json({ message: result.rows[0] });
}));

chatRouter.patch('/messages/:id/media', asyncHandler(async (request, response) => {
  const result = await pool.query(
    `SELECT m.channel_id AS "channelId"
       FROM chat_messages m
      WHERE m.id = $1 AND m.deleted_at IS NULL`,
    [request.params.id],
  );
  if (!result.rowCount) {
    response.status(404).json({ error: '消息不存在。' });
    return;
  }
  const channel = await getAccessibleChannel(result.rows[0].channelId, request, response);
  if (!channel) return;

  await pool.query('UPDATE chat_messages SET edited_media_url = $2 WHERE id = $1', [
    request.params.id,
    readString(request.body?.editedMediaUrl),
  ]);
  response.status(204).end();
}));

chatRouter.post('/messages/:id/likes', asyncHandler(async (request, response) => {
  const result = await pool.query(
    `SELECT m.channel_id AS "channelId"
       FROM chat_messages m
      WHERE m.id = $1 AND m.deleted_at IS NULL`,
    [request.params.id],
  );
  if (!result.rowCount) {
    response.status(404).json({ error: '消息不存在。' });
    return;
  }
  const channel = await getAccessibleChannel(result.rows[0].channelId, request, response);
  if (!channel) return;

  await pool.query(
    'INSERT INTO chat_message_likes (message_id, user_id) VALUES ($1, $2) ON CONFLICT DO NOTHING',
    [request.params.id, request.authUser!.id],
  );
  response.status(204).end();
}));

chatRouter.delete('/messages/:id/likes', asyncHandler(async (request, response) => {
  const result = await pool.query(
    `SELECT m.channel_id AS "channelId"
       FROM chat_messages m
      WHERE m.id = $1 AND m.deleted_at IS NULL`,
    [request.params.id],
  );
  if (!result.rowCount) {
    response.status(404).json({ error: '消息不存在。' });
    return;
  }
  const channel = await getAccessibleChannel(result.rows[0].channelId, request, response);
  if (!channel) return;

  await pool.query('DELETE FROM chat_message_likes WHERE message_id = $1 AND user_id = $2', [
    request.params.id,
    request.authUser!.id,
  ]);
  response.status(204).end();
}));
