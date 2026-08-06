import { Router } from 'express';
import { pool } from './db';
import { asyncHandler, readNumber, readString, requireProjectAccessFromRequest } from './apiUtils';

export type SearchResultType = 'shot' | 'asset' | 'file';

const SEARCH_TYPES = new Set<SearchResultType>(['shot', 'asset', 'file']);
const DEFAULT_TYPES: SearchResultType[] = ['shot', 'asset', 'file'];
const MAX_LIMIT = 50;

const parseTypes = (value: unknown): SearchResultType[] => {
  if (typeof value !== 'string' || !value.trim()) return DEFAULT_TYPES;
  const types = value.split(',').map(type => type.trim()).filter((type): type is SearchResultType => SEARCH_TYPES.has(type as SearchResultType));
  return types.length ? [...new Set(types)] : DEFAULT_TYPES;
};

const clampLimit = (value: unknown): number => {
  const limit = Math.trunc(readNumber(value, 10));
  if (!Number.isFinite(limit)) return 10;
  return Math.min(Math.max(limit, 1), MAX_LIMIT);
};

export const searchRouter = Router();

searchRouter.get('/', asyncHandler(async (request, response) => {
  const projectId = await requireProjectAccessFromRequest(request, response);
  if (!projectId) return;

  const q = readString(request.query.q);
  const types = parseTypes(request.query.types);
  const limit = clampLimit(request.query.limit);

  if (!q) {
    response.json({ query: q, types, limit, results: { shots: [], assets: [], files: [] } });
    return;
  }

  const term = `%${q.replace(/[\\%_]/g, match => `\\${match}`)}%`;
  const results = { shots: [] as unknown[], assets: [] as unknown[], files: [] as unknown[] };

  if (types.includes('shot')) {
    const shots = await pool.query(
      `SELECT id, 'shot' AS type, shot_code AS title, description AS subtitle, dialogue AS detail
         FROM shots
        WHERE project_id = $1 AND deleted_at IS NULL
          AND (shot_code ILIKE $2 ESCAPE '\\' OR description ILIKE $2 ESCAPE '\\' OR dialogue ILIKE $2 ESCAPE '\\')
        ORDER BY updated_at DESC, shot_code ASC
        LIMIT $3`,
      [projectId, term, limit],
    );
    results.shots = shots.rows;
  }

  if (types.includes('asset')) {
    const assets = await pool.query(
      `SELECT id, 'asset' AS type, name AS title, category AS subtitle, description AS detail
         FROM assets
        WHERE project_id = $1 AND deleted_at IS NULL
          AND (name ILIKE $2 ESCAPE '\\' OR description ILIKE $2 ESCAPE '\\' OR category ILIKE $2 ESCAPE '\\')
        ORDER BY updated_at DESC, name ASC
        LIMIT $3`,
      [projectId, term, limit],
    );
    results.assets = assets.rows;
  }

  if (types.includes('file')) {
    const files = await pool.query(
      `SELECT id, 'file' AS type, name AS title, entity_code AS subtitle, nas_path AS detail, entity_type AS "entityType", entity_id AS "entityId"
         FROM project_files
        WHERE project_id = $1 AND deleted_at IS NULL
          AND (name ILIKE $2 ESCAPE '\\' OR entity_code ILIKE $2 ESCAPE '\\' OR nas_path ILIKE $2 ESCAPE '\\')
        ORDER BY uploaded_at DESC, name ASC
        LIMIT $3`,
      [projectId, term, limit],
    );
    results.files = files.rows;
  }

  response.json({ query: q, types, limit, results });
}));
