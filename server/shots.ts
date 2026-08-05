import { randomUUID } from 'node:crypto';
import { Router } from 'express';
import { pool } from './db';
import { isEntityLockedForNonAdmin } from './workflow';
import { asyncHandler, readNumber, readString, requireProjectAccessFromRequest, requireProjectWriteAccess, requireProjectWriteAccessFromRequest, UUID_PATTERN } from './apiUtils';
import { ensureShotStorageStructure, removeShotStorageStructure } from './storage';

export const shotsRouter = Router();

const selectShot = `SELECT sh.id, sh.project_id AS "projectId", sh.scene_id AS "sceneId", sc.scene_code AS "sceneCode",
  sh.shot_code AS "shotCode", sh.duration_sec::float8 AS "durationSec", sh.shot_type AS "shotType",
  sh.camera_movement AS "cameraMovement", sh.description, coalesce(sh.dialogue, '') AS dialogue,
  sh.current_stage AS "currentStage", sh.assignee_id AS "assigneeId", sh.status,
  sh.latest_version_id AS "latestVersionId", sh.thumbnail_url AS "thumbnailUrl",
  coalesce(array_remove(array_agg(sa.asset_id), NULL), '{}') AS "assetIds"`;

const selectTask = `SELECT id, project_id AS "projectId", title, entity_type AS "entityType", entity_id AS "entityId",
  pipeline_stage AS "pipelineStage", assignee_id AS "assigneeId", status, priority, due_date AS "dueDate",
  requirements, prerequisite_task_id AS "prerequisiteTaskId", latest_version_id AS "latestVersionId",
  created_at AS "createdAt" FROM tasks`;

const selectScene = `SELECT sc.id, sc.project_id AS "projectId", sc.scene_code AS "sceneCode", sc.name,
  sc.description, count(sh.id)::int AS "shotCount"
  FROM scenes sc LEFT JOIN shots sh ON sh.scene_id = sc.id`;

const normalizeShotImport = (shot: any, index: number, fallbackAssigneeId: string) => ({
  sceneCode: readString(shot?.sceneCode, 'SC01').toUpperCase(),
  shotCode: readString(shot?.shotCode, `SH${String(index + 1).padStart(3, '0')}`).toUpperCase(),
  description: readString(shot?.description, '导入镜头描述'),
  durationSec: readNumber(shot?.durationSec, 5),
  shotType: readString(shot?.shotType, '中景'),
  cameraMovement: readString(shot?.cameraMovement, '固定镜头'),
  assigneeId: readString(shot?.assigneeId, fallbackAssigneeId),
});

shotsRouter.get('/', asyncHandler(async (request, response) => {
  const projectId = await requireProjectAccessFromRequest(request, response); if (!projectId) return;
  const result = await pool.query(`${selectShot} FROM shots sh JOIN scenes sc ON sc.id = sh.scene_id LEFT JOIN shot_assets sa ON sa.shot_id = sh.id WHERE sh.project_id = $1 GROUP BY sh.id, sc.scene_code ORDER BY sh.sort_order ASC, sh.shot_code ASC`, [projectId]);
  response.json({ shots: result.rows });
}));


shotsRouter.post('/', asyncHandler(async (request, response) => {
  const projectId = await requireProjectWriteAccessFromRequest(request, response); if (!projectId) return;
  const sceneCode = readString(request.body?.sceneCode, 'SC01').toUpperCase();
  const shotCode = readString(request.body?.shotCode).toUpperCase();
  if (!/^[A-Z0-9._-]{1,40}$/.test(sceneCode) || !/^[A-Z0-9._-]{1,40}$/.test(shotCode)) { response.status(400).json({ error: '场次或镜头编号无效。' }); return; }
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const scene = await client.query(`INSERT INTO scenes (id, project_id, scene_code, name, description) VALUES ($1,$2,$3,$4,$5) ON CONFLICT (project_id, scene_code) DO UPDATE SET scene_code = EXCLUDED.scene_code RETURNING id`, [randomUUID(), projectId, sceneCode, readString(request.body?.sceneName, `场次 ${sceneCode}`), readString(request.body?.sceneDescription)]);
    const shot = await client.query(`WITH inserted AS (INSERT INTO shots (id, project_id, scene_id, shot_code, duration_sec, shot_type, camera_movement, description, dialogue, current_stage, assignee_id, status, thumbnail_url) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,'视频生成',$10,$11,$12) RETURNING *) ${selectShot} FROM inserted sh JOIN scenes sc ON sc.id = sh.scene_id LEFT JOIN shot_assets sa ON sa.shot_id = sh.id GROUP BY sh.id, sh.project_id, sh.scene_id, sc.scene_code, sh.shot_code, sh.duration_sec, sh.shot_type, sh.camera_movement, sh.description, sh.dialogue, sh.current_stage, sh.assignee_id, sh.status, sh.latest_version_id, sh.thumbnail_url`, [randomUUID(), projectId, scene.rows[0].id, shotCode, readNumber(request.body?.durationSec, 5), readString(request.body?.shotType, '中景'), readString(request.body?.cameraMovement, '固定镜头'), readString(request.body?.description, '新建镜头描述'), readString(request.body?.dialogue), readString(request.body?.assigneeId, request.authUser!.id), readString(request.body?.status, '未开始'), readString(request.body?.thumbnailUrl)]);
    const shotId = shot.rows[0].id;
    await client.query(`INSERT INTO tasks (id, project_id, title, entity_type, entity_id, pipeline_stage, assignee_id, status, priority, due_date, requirements) VALUES ($1,$2,$3,'shot',$4,'视频生成',$5,'制作中','中',now()::date + 2,$6)`, [randomUUID(), projectId, `${sceneCode} / ${shotCode} - 视频生成`, shotId, readString(request.body?.assigneeId, request.authUser!.id), `${sceneCode} / ${shotCode} 的视频生成阶段制作要求`]);
    await client.query('COMMIT'); response.status(201).json({ shot: shot.rows[0] });
  } catch (e:any) { await client.query('ROLLBACK'); if (e?.code === '23505') { response.status(409).json({ error: '镜头编号已经存在。' }); return; } throw e; } finally { client.release(); }
}));

shotsRouter.post('/bulk', asyncHandler(async (request, response) => {
  const projectId = await requireProjectWriteAccessFromRequest(request, response); if (!projectId) return;
  const requestedShots = Array.isArray(request.body?.shots) ? request.body.shots : [];
  if (!requestedShots.length || requestedShots.length > 500) { response.status(400).json({ error: '镜头导入数据无效。' }); return; }
  const shots = requestedShots.map((shot: any, index: number) => normalizeShotImport(shot, index, request.authUser!.id));
  if (shots.some(shot => !/^[A-Z0-9._-]{1,40}$/.test(shot.sceneCode) || !/^[A-Z0-9._-]{1,40}$/.test(shot.shotCode))) { response.status(400).json({ error: '场次或镜头编号无效。' }); return; }
  if (new Set(shots.map(shot => shot.shotCode)).size !== shots.length) { response.status(400).json({ error: '同一次请求中存在重复镜头编号。' }); return; }

  const client = await pool.connect();
  const createdDirectories: string[] = [];
  try {
    await client.query('BEGIN');
    const project = await client.query<{ code: string }>('SELECT code FROM projects WHERE id = $1', [projectId]);
    if (!project.rowCount) { response.status(404).json({ error: '项目不存在。' }); await client.query('ROLLBACK'); return; }
    const projectCode = project.rows[0].code;
    const importedShotIds: string[] = [];
    const importedSceneCodes = new Set<string>();

    for (const shot of shots) {
      importedSceneCodes.add(shot.sceneCode);
      const scene = await client.query(
        `INSERT INTO scenes (id, project_id, scene_code, name, description)
         VALUES ($1, $2, $3, $4, $5)
         ON CONFLICT (project_id, scene_code) DO UPDATE SET scene_code = EXCLUDED.scene_code
         RETURNING id`,
        [randomUUID(), projectId, shot.sceneCode, `场次 ${shot.sceneCode}`, '从镜头表导入的场次'],
      );
      const shotId = randomUUID();
      const savedShot = await client.query<{ id: string }>(
        `INSERT INTO shots (id, project_id, scene_id, shot_code, duration_sec, shot_type, camera_movement, description, dialogue, current_stage, assignee_id, status, thumbnail_url)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,'','视频生成',$9,'未开始',$10)
         ON CONFLICT (project_id, shot_code) DO UPDATE SET
           scene_id = EXCLUDED.scene_id,
           duration_sec = EXCLUDED.duration_sec,
           shot_type = EXCLUDED.shot_type,
           camera_movement = EXCLUDED.camera_movement,
           description = EXCLUDED.description,
           current_stage = '视频生成',
           assignee_id = EXCLUDED.assignee_id
         RETURNING id`,
        [shotId, projectId, scene.rows[0].id, shot.shotCode, shot.durationSec, shot.shotType, shot.cameraMovement, shot.description, shot.assigneeId, 'https://images.unsplash.com/photo-1518709268805-4e9042af9f23?w=600&auto=format&fit=crop&q=80'],
      );
      const savedShotId = savedShot.rows[0].id;
      importedShotIds.push(savedShotId);
      const directory = await ensureShotStorageStructure({ projectCode, shotId: savedShotId, shotCode: shot.shotCode, sceneCode: shot.sceneCode });
      if (directory.createdRoot) createdDirectories.push(shot.shotCode);
      await client.query(
        `INSERT INTO tasks (id, project_id, title, entity_type, entity_id, pipeline_stage, assignee_id, status, priority, due_date, requirements)
         SELECT $1,$2,$3,'shot',$4,'视频生成',$5,'制作中','中',now()::date + 2,$6
         WHERE NOT EXISTS (SELECT 1 FROM tasks WHERE project_id = $2 AND entity_type = 'shot' AND entity_id = $4 AND pipeline_stage = '视频生成')`,
        [randomUUID(), projectId, `${shot.sceneCode} / ${shot.shotCode} - 视频生成`, savedShotId, shot.assigneeId, `${shot.sceneCode} / ${shot.shotCode} 的视频生成阶段制作要求`],
      );
    }

    await client.query('COMMIT');
    const scenesResult = await pool.query(`${selectScene} WHERE sc.project_id = $1 AND sc.scene_code = ANY($2::text[]) GROUP BY sc.id ORDER BY sc.sort_order ASC, sc.scene_code ASC`, [projectId, [...importedSceneCodes]]);
    const shotsResult = await pool.query(`${selectShot} FROM shots sh JOIN scenes sc ON sc.id = sh.scene_id LEFT JOIN shot_assets sa ON sa.shot_id = sh.id WHERE sh.id = ANY($1::uuid[]) GROUP BY sh.id, sc.scene_code ORDER BY sh.sort_order ASC, sh.shot_code ASC`, [importedShotIds]);
    const tasksResult = await pool.query(`${selectTask} WHERE project_id = $1 AND entity_type = 'shot' AND entity_id = ANY($2::uuid[]) AND pipeline_stage = '视频生成' ORDER BY created_at DESC`, [projectId, importedShotIds]);
    response.status(201).json({ scenes: scenesResult.rows, shots: shotsResult.rows, tasks: tasksResult.rows });
  } catch (e: any) {
    await client.query('ROLLBACK');
    const projectCode = await pool.query<{ code: string }>('SELECT code FROM projects WHERE id = $1', [projectId]).then(r => r.rows[0]?.code).catch(() => null);
    if (projectCode) await Promise.all(createdDirectories.map(shotCode => removeShotStorageStructure(projectCode, shotCode).catch(() => undefined)));
    throw e;
  } finally { client.release(); }
}));

shotsRouter.patch('/:id', asyncHandler(async (request, response) => {
  const id = request.params.id; if (!UUID_PATTERN.test(id)) { response.status(400).json({ error: '镜头 ID 无效。' }); return; }
  const access = await pool.query('SELECT project_id,status FROM shots WHERE id=$1', [id]); if (!access.rowCount) { response.status(404).json({ error: '镜头不存在。' }); return; }
  if (!await requireProjectWriteAccess(access.rows[0].project_id, request.authUser!.id, request.authUser!.role)) { response.status(403).json({ error: '您不是该项目的成员。' }); return; }
  if (isEntityLockedForNonAdmin(access.rows[0].status) && request.authUser!.role !== 'admin') { response.status(403).json({ error: '最终版已锁定，仅管理员可继续修改。' }); return; }
  let sceneId: string | null = null;
  const sceneCode = typeof request.body?.sceneCode === 'string' ? request.body.sceneCode.trim().toUpperCase() : '';
  if (sceneCode) {
    if (!/^[A-Z0-9._-]{1,40}$/.test(sceneCode)) { response.status(400).json({ error: '场次编号无效。' }); return; }
    const scene = await pool.query(`INSERT INTO scenes (id, project_id, scene_code, name, description) VALUES ($1,$2,$3,$4,$5) ON CONFLICT (project_id, scene_code) DO UPDATE SET scene_code = EXCLUDED.scene_code RETURNING id`, [randomUUID(), access.rows[0].project_id, sceneCode, `场次 ${sceneCode}`, '批量编辑创建的场次']);
    sceneId = scene.rows[0].id;
  }
  await pool.query(`UPDATE shots SET scene_id=coalesce($2,scene_id), assignee_id=coalesce($3,assignee_id), status=coalesce($4,status), description=coalesce($5,description) WHERE id=$1`, [id, sceneId, request.body?.assigneeId ?? null, request.body?.status ?? null, request.body?.description ?? null]);
  const result = await pool.query(`${selectShot} FROM shots sh JOIN scenes sc ON sc.id=sh.scene_id LEFT JOIN shot_assets sa ON sa.shot_id=sh.id WHERE sh.id=$1 GROUP BY sh.id, sc.scene_code`, [id]); response.json({ shot: result.rows[0] });
}));
shotsRouter.delete('/:id', asyncHandler(async (request, response) => { const id=request.params.id; const access=await pool.query('SELECT project_id,status FROM shots WHERE id=$1',[id]); if(!access.rowCount){response.status(404).json({error:'镜头不存在。'});return;} if(!await requireProjectWriteAccess(access.rows[0].project_id,request.authUser!.id,request.authUser!.role)){response.status(403).json({error:'您不是该项目的成员。'});return;} if(isEntityLockedForNonAdmin(access.rows[0].status)&&request.authUser!.role!=='admin'){response.status(403).json({error:'最终版已锁定，仅管理员可继续修改。'});return;} await pool.query('DELETE FROM shots WHERE id=$1',[id]); response.status(204).end(); }));
