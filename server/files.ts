import { randomUUID } from 'node:crypto';
import { execFile } from 'node:child_process';
import { stat } from 'node:fs/promises';
import { promisify } from 'node:util';
import path from 'node:path';
import { Router } from 'express';
import type { NextFunction, Request, RequestHandler, Response } from 'express';
import multer from 'multer';
import type { UserRole } from '../src/types';
import { config } from './config';
import { pool } from './db';
import {
  createManagedStorageKey,
  moveIntoStorage,
  moveToTrash,
  removeFileIfPresent,
  resolveWithinStorage,
  sha256File,
} from './storage';
import { recordAuditLog } from './audit';

const execFileAsync = promisify(execFile);

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const ENTITY_TYPES = new Set(['shot', 'asset']);
const FILE_TYPES = new Set(['review', 'source']);
const ALLOWED_EXTENSIONS = new Set([
  'mp4', 'mov', 'webm', 'mkv', 'avi',
  'png', 'jpg', 'jpeg', 'webp', 'gif', 'tif', 'tiff',
  'pdf', 'txt', 'json', 'csv', 'xlsx', 'docx',
  'wav', 'mp3', 'aac',
  'exr', 'dpx', 'psd', 'psb', 'ai',
  'aep', 'prproj', 'drp', 'blend', 'c4d', 'ma', 'mb',
  'fbx', 'obj', 'abc', 'usd', 'usda', 'usdc',
  'zip', '7z', 'rar',
]);

const EXTENSION_MIME_PREFIXES = new Map<string, string[]>([
  ['mp4', ['video/mp4']], ['mov', ['video/quicktime']], ['webm', ['video/webm']], ['mkv', ['video/']], ['avi', ['video/']],
  ['png', ['image/png']], ['jpg', ['image/jpeg']], ['jpeg', ['image/jpeg']], ['webp', ['image/webp']], ['gif', ['image/gif']], ['tif', ['image/tiff']], ['tiff', ['image/tiff']],
  ['pdf', ['application/pdf']], ['txt', ['text/plain']], ['json', ['application/json', 'text/plain']], ['csv', ['text/csv', 'application/vnd.ms-excel', 'text/plain']],
  ['xlsx', ['application/vnd.openxmlformats-officedocument.spreadsheetml.sheet']], ['docx', ['application/vnd.openxmlformats-officedocument.wordprocessingml.document']],
  ['wav', ['audio/wav', 'audio/x-wav']], ['mp3', ['audio/mpeg']], ['aac', ['audio/aac', 'audio/']],
  ['zip', ['application/zip', 'application/x-zip-compressed']], ['7z', ['application/x-7z-compressed']], ['rar', ['application/vnd.rar', 'application/x-rar-compressed']],
]);
const DESIGN_SOURCE_EXTENSIONS = new Set(['exr', 'dpx', 'psd', 'psb', 'ai', 'aep', 'prproj', 'drp', 'blend', 'c4d', 'ma', 'mb', 'fbx', 'obj', 'abc', 'usd', 'usda', 'usdc']);

const validateMimeForExtension = (extension: string, mimeType: string): string | null => {
  const normalizedMimeType = (mimeType || 'application/octet-stream').toLowerCase();
  const allowedPrefixes = EXTENSION_MIME_PREFIXES.get(extension);
  if (allowedPrefixes?.some(prefix => normalizedMimeType.startsWith(prefix))) return null;
  if (DESIGN_SOURCE_EXTENSIONS.has(extension) && ['application/octet-stream', 'application/x-empty'].includes(normalizedMimeType)) return null;
  return `文件扩展名 .${extension} 与浏览器上报的 MIME 类型 ${normalizedMimeType} 不一致。`;
};

const scanUploadForThreats = async (filePath: string): Promise<'not_configured' | 'clean'> => {
  if (!config.virusScanCommand) return 'not_configured';
  const [command, ...args] = config.virusScanCommand.split(' ').filter(Boolean);
  await execFileAsync(command, [...args, filePath], { timeout: 120_000 });
  return 'clean';
};

interface ProjectAccess {
  code: string;
  projectRole: UserRole;
}

interface FileRow {
  id: string;
  projectId: string;
  name: string;
  fileType: 'review' | 'source';
  extension: string;
  sizeBytes: string;
  storageKey: string | null;
  nasPath: string | null;
  mimeType: string | null;
  sha256: string | null;
  entityType: 'shot' | 'asset' | null;
  entityId: string | null;
  entityCode: string | null;
  versionNumber: string | null;
  uploadedAt: string;
  uploaderId: string | null;
  uploaderName: string | null;
}

const asyncHandler = (
  handler: (request: Request, response: Response, next: NextFunction) => Promise<void>,
): RequestHandler => (request, response, next) => {
  handler(request, response, next).catch(next);
};

const upload = multer({
  dest: path.join(config.storageRoot, '.tmp'),
  limits: {
    fileSize: config.maxUploadBytes,
    files: 1,
    fields: 12,
    fieldSize: 64 * 1024,
  },
  fileFilter: (_request, file, callback) => {
    const extension = path.extname(file.originalname).slice(1).toLowerCase();
    if (!extension || !ALLOWED_EXTENSIONS.has(extension)) {
      callback(new Error(`不支持 .${extension || '未知'} 文件，请联系管理员调整允许类型。`));
      return;
    }
    callback(null, true);
  },
});

const acceptSingleUpload: RequestHandler = (request, response, next) => {
  upload.single('file')(request, response, (error) => {
    if (!error) {
      next();
      return;
    }
    if (error instanceof multer.MulterError && error.code === 'LIMIT_FILE_SIZE') {
      response.status(413).json({
        error: `文件超过服务器限制（最大 ${Math.floor(config.maxUploadBytes / 1024 / 1024)} MB）。`,
      });
      return;
    }
    response.status(400).json({ error: error.message || '无法接收上传文件。' });
  });
};

const getProjectAccess = async (
  projectId: string,
  userId: string,
  systemRole: UserRole,
): Promise<ProjectAccess | null> => {
  const result = await pool.query<{ code: string; projectRole: UserRole | null }>(
    `SELECT p.code, pm.project_role AS "projectRole"
       FROM projects p
       LEFT JOIN project_members pm
         ON pm.project_id = p.id AND pm.user_id = $2
      WHERE p.id = $1`,
    [projectId, userId],
  );
  if (!result.rowCount) return null;
  if (!result.rows[0].projectRole && systemRole !== 'admin') return null;
  return {
    code: result.rows[0].code,
    projectRole: result.rows[0].projectRole || 'admin',
  };
};

const mapFile = (row: FileRow) => ({
  ...row,
  sizeBytes: Number(row.sizeBytes),
  storageKind: row.storageKey ? 'managed' : 'nas',
  contentUrl: row.storageKey ? `/api/files/${row.id}/content` : null,
});

const selectFileColumns = `
  SELECT f.id, f.project_id AS "projectId", f.name,
         f.file_type AS "fileType", f.extension,
         f.size_bytes::text AS "sizeBytes",
         f.storage_key AS "storageKey", f.nas_path AS "nasPath",
         f.mime_type AS "mimeType", f.sha256,
         f.entity_type AS "entityType", f.entity_id AS "entityId",
         f.entity_code AS "entityCode", f.version_number AS "versionNumber",
         f.uploaded_at AS "uploadedAt", f.uploader_id AS "uploaderId",
         u.name AS "uploaderName"
    FROM project_files f
    LEFT JOIN users u ON u.id = f.uploader_id
`;

export const filesRouter = Router();

filesRouter.get('/', asyncHandler(async (request, response) => {
  const projectId = typeof request.query.projectId === 'string' ? request.query.projectId : '';
  if (!UUID_PATTERN.test(projectId)) {
    response.status(400).json({ error: '项目 ID 无效。' });
    return;
  }
  const access = await getProjectAccess(
    projectId,
    request.authUser!.id,
    request.authUser!.role,
  );
  if (!access) {
    response.status(403).json({ error: '您不是该项目的成员。' });
    return;
  }

  const result = await pool.query<FileRow>(
    `${selectFileColumns}
      WHERE f.project_id = $1 AND f.deleted_at IS NULL
      ORDER BY f.uploaded_at DESC`,
    [projectId],
  );
  response.json({ files: result.rows.map(mapFile) });
}));

filesRouter.post('/upload', acceptSingleUpload, asyncHandler(async (request, response) => {
  const temporaryPath = request.file?.path;
  let finalPath: string | null = null;

  try {
    if (!request.file || !temporaryPath) {
      response.status(400).json({ error: '请选择要上传的文件。' });
      return;
    }

    const projectId = typeof request.body.projectId === 'string' ? request.body.projectId : '';
    const fileType = typeof request.body.fileType === 'string' ? request.body.fileType : '';
    const entityType = typeof request.body.entityType === 'string' && request.body.entityType
      ? request.body.entityType
      : null;
    const entityId = typeof request.body.entityId === 'string'
      ? request.body.entityId.trim().slice(0, 120)
      : null;
    const entityCode = typeof request.body.entityCode === 'string'
      ? request.body.entityCode.trim().slice(0, 100)
      : null;
    const versionNumber = typeof request.body.versionNumber === 'string'
      ? request.body.versionNumber.trim().slice(0, 60)
      : null;

    if (!UUID_PATTERN.test(projectId) || !FILE_TYPES.has(fileType)) {
      response.status(400).json({ error: '项目或文件用途无效。' });
      return;
    }
    if (entityType && !ENTITY_TYPES.has(entityType)) {
      response.status(400).json({ error: '关联类型必须是镜头或资产。' });
      return;
    }

    const access = await getProjectAccess(
      projectId,
      request.authUser!.id,
      request.authUser!.role,
    );
    if (!access) {
      response.status(403).json({ error: '您不是该项目的成员。' });
      return;
    }
    if (access.projectRole === 'client') {
      response.status(403).json({ error: '客户成员不能上传或登记项目文件。' });
      return;
    }

    const fileId = randomUUID();
    const extension = path.extname(request.file.originalname).slice(1).toLowerCase();
    const mimeError = validateMimeForExtension(extension, request.file.mimetype);
    if (mimeError) {
      response.status(400).json({ error: mimeError });
      return;
    }
    const scanStatus = await scanUploadForThreats(temporaryPath);
    const storageKey = createManagedStorageKey({
      projectCode: access.code,
      entityType,
      entityCode,
      versionNumber,
      originalName: request.file.originalname,
    });
    const checksum = await sha256File(temporaryPath);
    finalPath = await moveIntoStorage(temporaryPath, storageKey);

    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      const result = await client.query<FileRow>(
        `WITH inserted AS (
          INSERT INTO project_files (
            id, project_id, name, file_type, extension, size_bytes,
            storage_key, mime_type, sha256, entity_type, entity_id,
            entity_code, version_number, uploader_id
          ) VALUES (
            $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14
          )
          RETURNING *
        )
        SELECT i.id, i.project_id AS "projectId", i.name,
               i.file_type AS "fileType", i.extension,
               i.size_bytes::text AS "sizeBytes",
               i.storage_key AS "storageKey", i.nas_path AS "nasPath",
               i.mime_type AS "mimeType", i.sha256,
               i.entity_type AS "entityType", i.entity_id AS "entityId",
               i.entity_code AS "entityCode", i.version_number AS "versionNumber",
               i.uploaded_at AS "uploadedAt", i.uploader_id AS "uploaderId",
               u.name AS "uploaderName"
          FROM inserted i
          LEFT JOIN users u ON u.id = i.uploader_id`,
        [
          fileId,
          projectId,
          request.file.originalname.slice(0, 500),
          fileType,
          extension,
          request.file.size,
          storageKey,
          request.file.mimetype.slice(0, 200),
          checksum,
          entityType,
          entityId || null,
          entityCode || null,
          versionNumber || null,
          request.authUser!.id,
        ],
      );
      await recordAuditLog(client, request, {
        action: 'file.upload',
        projectId,
        entityType: 'file',
        entityId: fileId,
        details: { name: request.file.originalname, sizeBytes: request.file.size, checksum, mimeType: request.file.mimetype, scanStatus },
      });
      await client.query('COMMIT');
      response.status(201).json({ file: mapFile(result.rows[0]) });
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  } catch (error) {
    if (finalPath) await removeFileIfPresent(finalPath).catch(() => undefined);
    throw error;
  } finally {
    if (temporaryPath) await removeFileIfPresent(temporaryPath).catch(() => undefined);
  }
}));

filesRouter.post('/nas', asyncHandler(async (request, response) => {
  const projectId = typeof request.body?.projectId === 'string' ? request.body.projectId : '';
  const name = typeof request.body?.name === 'string' ? request.body.name.trim() : '';
  const nasPath = typeof request.body?.nasPath === 'string' ? request.body.nasPath.trim() : '';
  const entityType = typeof request.body?.entityType === 'string' && request.body.entityType
    ? request.body.entityType
    : null;
  const entityCode = typeof request.body?.entityCode === 'string'
    ? request.body.entityCode.trim().slice(0, 100)
    : null;
  const versionNumber = typeof request.body?.versionNumber === 'string'
    ? request.body.versionNumber.trim().slice(0, 60)
    : null;

  if (
    !UUID_PATTERN.test(projectId) ||
    !name ||
    name.length > 500 ||
    !nasPath ||
    nasPath.length > 2000 ||
    (entityType && !ENTITY_TYPES.has(entityType))
  ) {
    response.status(400).json({ error: '共享文件信息无效。' });
    return;
  }
  if (!nasPath.startsWith('\\\\') && !/^[A-Za-z]:\\/.test(nasPath)) {
    response.status(400).json({ error: '请填写 UNC 路径（如 \\\\NAS\\项目）或服务器磁盘绝对路径。' });
    return;
  }

  const access = await getProjectAccess(
    projectId,
    request.authUser!.id,
    request.authUser!.role,
  );
  if (!access) {
    response.status(403).json({ error: '您不是该项目的成员。' });
    return;
  }
  if (access.projectRole === 'client') {
    response.status(403).json({ error: '客户成员不能上传或登记项目文件。' });
    return;
  }

  const fileId = randomUUID();
  const extension = path.extname(name).slice(1).toLowerCase().slice(0, 20);
  const result = await pool.query<FileRow>(
    `WITH inserted AS (
      INSERT INTO project_files (
        id, project_id, name, file_type, extension, nas_path,
        entity_type, entity_code, version_number, uploader_id
      ) VALUES ($1, $2, $3, 'source', $4, $5, $6, $7, $8, $9)
      RETURNING *
    )
    SELECT i.id, i.project_id AS "projectId", i.name,
           i.file_type AS "fileType", i.extension,
           i.size_bytes::text AS "sizeBytes",
           i.storage_key AS "storageKey", i.nas_path AS "nasPath",
           i.mime_type AS "mimeType", i.sha256,
           i.entity_type AS "entityType", i.entity_id AS "entityId",
           i.entity_code AS "entityCode", i.version_number AS "versionNumber",
           i.uploaded_at AS "uploadedAt", i.uploader_id AS "uploaderId",
           u.name AS "uploaderName"
      FROM inserted i
      LEFT JOIN users u ON u.id = i.uploader_id`,
    [
      fileId,
      projectId,
      name,
      extension,
      nasPath,
      entityType,
      entityCode || null,
      versionNumber || null,
      request.authUser!.id,
    ],
  );
  await pool.query(
    `INSERT INTO audit_logs (
      actor_id, project_id, action, entity_type, entity_id, details, ip_address
    ) VALUES ($1, $2, 'file.nas.register', 'file', $3, $4::jsonb, $5)`,
    [
      request.authUser!.id,
      projectId,
      fileId,
      JSON.stringify({ name, nasPath }),
      request.ip || null,
    ],
  );
  response.status(201).json({ file: mapFile(result.rows[0]) });
}));

filesRouter.get('/:fileId/content', asyncHandler(async (request, response, next) => {
  const fileId = request.params.fileId;
  if (!UUID_PATTERN.test(fileId)) {
    response.status(400).json({ error: '文件 ID 无效。' });
    return;
  }
  const result = await pool.query<FileRow>(
    `${selectFileColumns}
      WHERE f.id = $1 AND f.deleted_at IS NULL`,
    [fileId],
  );
  const file = result.rows[0];
  if (!file || !file.storageKey) {
    response.status(404).json({ error: '文件不存在或不是服务器托管文件。' });
    return;
  }
  const access = await getProjectAccess(
    file.projectId,
    request.authUser!.id,
    request.authUser!.role,
  );
  if (!access) {
    response.status(403).json({ error: '您没有查看该文件的权限。' });
    return;
  }

  const absolutePath = resolveWithinStorage(file.storageKey);
  await stat(absolutePath);
  const disposition = request.query.download === '1' ? 'attachment' : 'inline';
  response.setHeader(
    'Content-Disposition',
    `${disposition}; filename*=UTF-8''${encodeURIComponent(file.name)}`,
  );
  response.type(file.extension || 'application/octet-stream');
  response.sendFile(absolutePath, (error) => {
    if (error && !response.headersSent) next(error);
  });
}));

filesRouter.delete('/:fileId', asyncHandler(async (request, response) => {
  const fileId = request.params.fileId;
  if (!UUID_PATTERN.test(fileId)) {
    response.status(400).json({ error: '文件 ID 无效。' });
    return;
  }
  const result = await pool.query<FileRow>(
    `${selectFileColumns}
      WHERE f.id = $1 AND f.deleted_at IS NULL`,
    [fileId],
  );
  const file = result.rows[0];
  if (!file) {
    response.status(404).json({ error: '文件不存在。' });
    return;
  }
  const access = await getProjectAccess(
    file.projectId,
    request.authUser!.id,
    request.authUser!.role,
  );
  if (!access) {
    response.status(403).json({ error: '您没有管理该文件的权限。' });
    return;
  }
  const canDelete = file.uploaderId === request.authUser!.id ||
    request.authUser!.role === 'admin' ||
    ['admin', 'director'].includes(access.projectRole);
  if (!canDelete) {
    response.status(403).json({ error: '只有上传者或项目管理员可以移除该文件。' });
    return;
  }

  let trashKey: string | null = null;
  if (file.storageKey) trashKey = await moveToTrash(file.storageKey, file.id);
  try {
    await pool.query(
      `UPDATE project_files
          SET deleted_at = now(), storage_key = coalesce($2, storage_key)
        WHERE id = $1`,
      [file.id, trashKey],
    );
    await pool.query(
      `INSERT INTO audit_logs (
        actor_id, project_id, action, entity_type, entity_id, details, ip_address
      ) VALUES ($1, $2, 'file.remove', 'file', $3, $4::jsonb, $5)`,
      [
        request.authUser!.id,
        file.projectId,
        file.id,
        JSON.stringify({ name: file.name, recoverable: Boolean(trashKey) }),
        request.ip || null,
      ],
    );
  } catch (error) {
    if (trashKey && file.storageKey) {
      await moveIntoStorage(resolveWithinStorage(trashKey), file.storageKey).catch(() => undefined);
    }
    throw error;
  }
  response.status(204).end();
}));
