import assert from 'node:assert/strict';
import test from 'node:test';
import type { Project, Scene, Shot, Task } from '../types';
import {
  createShotPipelineTasks,
  createAssetPipelineTasks,
  createProjectFinishingTasks,
  normalizeScenesAndTasks,
  type ProjectLocalState,
} from './AppContext';

const project: Project = {
  id: 'project-test',
  name: '测试项目',
  code: 'TEST',
  type: '短片',
  aspectRatio: '16:9',
  totalDurationMin: 0,
  deliveryDate: '',
  directorId: 'user-1',
  members: ['user-1'],
  status: '筹备中',
  currentPhase: '筹备中',
  totalShots: 0,
  completedShots: 0,
  pendingReviewShots: 0,
  revisingShots: 0,
  blockedShots: 0,
};

const createScene = (id: string): Scene => ({
  id,
  projectId: project.id,
  sceneCode: 'SC01',
  name: '场次 SC01',
  description: '测试场次',
  shotCount: 1,
});

const createShot = (id: string, sceneId: string, shotCode: string): Shot => ({
  id,
  projectId: project.id,
  sceneId,
  sceneCode: 'sc01',
  shotCode,
  durationSec: 5,
  shotType: '中景',
  cameraMovement: '固定镜头',
  description: '测试镜头',
  currentStage: '视频生成',
  assigneeId: 'user-1',
  status: '未开始',
  thumbnailUrl: '',
  assetIds: [],
});

test('duplicate scene records are merged and shots point to one canonical scene', () => {
  const shots = [
    createShot('shot-1', 'scene-1', 'SH001'),
    createShot('shot-2', 'scene-2', 'SH002'),
  ];
  const tasks: Task[] = [{
    id: 'task-1',
    title: 'SH001 - 台本',
    entityType: 'shot',
    entityId: 'shot-1',
    pipelineStage: '台本' as any,
    assigneeId: 'user-1',
    status: '制作中',
    priority: '中',
    dueDate: '2026-07-30',
    requirements: '',
    createdAt: '2026-07-28',
  }];
  const state: ProjectLocalState = {
    scenes: [createScene('scene-1'), createScene('scene-2')],
    shots,
    tasks,
    assets: [],
    versions: [],
    notes: [],
    reviewLists: [],
    files: [],
    channels: [],
    chatMessages: [],
  };

  const normalized = normalizeScenesAndTasks(project, state);
  assert.equal(normalized.scenes.length, 1);
  assert.equal(normalized.scenes[0].sceneCode, 'SC01');
  assert.equal(normalized.scenes[0].shotCount, 2);
  assert.equal(normalized.shots[0].sceneId, normalized.shots[1].sceneId);
  const shotTasks = normalized.tasks.filter(task => task.entityType === 'shot');
  assert.equal(shotTasks.length, 2);
  assert.equal(shotTasks[0].title, 'SC01 / SH001 - 视频生成');
  assert.equal(shotTasks[0].pipelineStage, '视频生成');
});

test('pipeline tasks carry the scene and shot code', () => {
  const tasks = createShotPipelineTasks('shot-1', 'SC03', 'SH021', 'user-1');
  assert.equal(tasks.length, 1);
  assert.equal(tasks[0].title, 'SC03 / SH021 - 视频生成');
  assert.equal(tasks[0].pipelineStage, '视频生成');
  assert.equal(tasks[0].prerequisiteTaskId, undefined);
});

test('new assets receive the complete asset production task template', () => {
  const tasks = createAssetPipelineTasks('asset-1', '主角驾驶服', 'user-1');
  assert.deepEqual(
    tasks.map(task => task.pipelineStage),
    ['需求', '概念设计', '修改', '定稿'],
  );
  assert.equal(tasks[0].status, '已完成');
  assert.equal(tasks[1].status, '制作中');
  assert.equal(tasks[1].prerequisiteTaskId, tasks[0].id);
});

test('legacy per-shot sound and final tasks migrate to one pair of project tasks', () => {
  const shot = {
    ...createShot('shot-1', 'scene-1', 'SH001'),
    currentStage: '声音' as any,
  };
  const legacyTasks: Task[] = [
    {
      id: 'legacy-sound',
      title: 'SH001 - 声音',
      entityType: 'shot',
      entityId: shot.id,
      pipelineStage: '声音',
      assigneeId: 'user-1',
      status: '未开始',
      priority: '中',
      dueDate: '2026-07-30',
      requirements: '',
      createdAt: '2026-07-28',
    },
    {
      id: 'legacy-final',
      title: 'SH001 - 成片',
      entityType: 'shot',
      entityId: shot.id,
      pipelineStage: '成片',
      assigneeId: 'user-1',
      status: '未开始',
      priority: '中',
      dueDate: '2026-07-31',
      requirements: '',
      createdAt: '2026-07-28',
    },
  ];
  const state: ProjectLocalState = {
    scenes: [createScene('scene-1')],
    shots: [shot],
    tasks: legacyTasks,
    versions: [{
      id: 'version-sound',
      taskId: 'legacy-sound',
      entityType: 'shot',
      entityId: shot.id,
      versionNumber: 'V001',
      fileUrl: '',
      fileType: 'video',
      thumbnailUrl: '',
      uploaderId: 'user-1',
      createdAt: '2026-07-28',
      changelog: '',
      status: '待审核',
    }],
    assets: [],
    notes: [],
    reviewLists: [],
    files: [],
    channels: [],
    chatMessages: [],
  };

  const normalized = normalizeScenesAndTasks(project, state);
  const projectTasks = normalized.tasks.filter(task => task.entityType === 'project');
  assert.equal(normalized.shots[0].currentStage, '视频生成');
  assert.equal(projectTasks.length, 2);
  assert.deepEqual(projectTasks.map(task => task.pipelineStage).sort(), ['声音', '成片']);
  assert.equal(normalized.tasks.some(task =>
    task.entityType === 'shot' && (task.pipelineStage === '声音' || task.pipelineStage === '成片')
  ), false);
  assert.equal(normalized.versions[0].entityType, 'project');
  assert.equal(normalized.versions[0].entityId, project.id);
  assert.equal(normalized.tasks.filter(task => task.entityType === 'shot').length, 1);
  assert.equal(
    normalized.tasks.find(task => task.entityType === 'shot')?.pipelineStage,
    '视频生成',
  );
});

test('project sound and final tasks keep project entity fields for version review flow', () => {
  const projectTasks = createProjectFinishingTasks(project);
  assert.deepEqual(projectTasks.map(task => task.pipelineStage).sort(), ['声音', '成片']);
  for (const task of projectTasks) {
    assert.equal(task.entityType, 'project');
    assert.equal(task.entityId, project.id);
  }

  const soundTask = projectTasks.find(task => task.pipelineStage === '声音')!;
  const soundVersion = {
    id: 'version-project-sound',
    taskId: soundTask.id,
    entityType: soundTask.entityType,
    entityId: soundTask.entityId,
    versionNumber: 'V001',
    fileUrl: 'sound.mp4',
    fileType: 'video' as const,
    thumbnailUrl: '',
    uploaderId: 'user-1',
    createdAt: '2026-08-05',
    changelog: '整片声音初版',
    status: '待审核' as const,
  };

  assert.equal(soundVersion.entityType, 'project');
  assert.equal(soundVersion.entityId, project.id);
  assert.equal(soundVersion.taskId, soundTask.id);

  const reviewedTask = {
    ...soundTask,
    latestVersionId: soundVersion.id,
    status: soundVersion.status === '待审核' ? '待审核' as const : soundTask.status,
  };
  const approvedTask = {
    ...reviewedTask,
    status: '已完成' as const,
  };

  assert.equal(reviewedTask.status, '待审核');
  assert.equal(approvedTask.status, '已完成');
});
