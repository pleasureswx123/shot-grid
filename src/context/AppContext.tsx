import React, { createContext, useContext, useState, useEffect } from 'react';
import {
  Project, User, Scene, Shot, Asset, Task, Version, Note, ReviewList, ProjectFile,
  UserRole, ShotStatus, AssetStatus, TaskStatus, VersionStatus, AIGenerationParams, AssetCategory,
  DepartmentChannel, ChatMessage, ImportedAssetData
} from '../types';
import {
  mockProject, mockUsers, mockScenes, mockAssets, mockShots,
  mockTasks, mockVersions, mockNotes, mockReviewLists, mockFiles,
  mockChannels, mockChatMessages
} from '../data/mockData';

export type MainTab = 'workbench' | 'project' | 'shots' | 'assets' | 'review' | 'files' | 'communication';

interface AppContextType {
  currentUser: User;
  activeTab: MainTab;
  setActiveTab: (tab: MainTab) => void;
  
  project: Project;
  users: User[];
  scenes: Scene[];
  shots: Shot[];
  assets: Asset[];
  tasks: Task[];
  versions: Version[];
  notes: Note[];
  reviewLists: ReviewList[];
  files: ProjectFile[];
  channels: DepartmentChannel[];
  chatMessages: ChatMessage[];

  // Selected item states for detail drawers/modals
  selectedShotId: string | null;
  setSelectedShotId: (id: string | null) => void;
  selectedAssetId: string | null;
  setSelectedAssetId: (id: string | null) => void;
  selectedReviewListId: string | null;
  setSelectedReviewListId: (id: string | null) => void;

  // Actions
  addShot: (shotData: Partial<Shot>) => Promise<void>;
  updateShots: (
    shotIds: string[],
    updates: Partial<Pick<Shot, 'sceneCode' | 'assigneeId' | 'status'>>,
  ) => void;
  deleteShot: (shotId: string) => void;
  deleteShots: (shotIds: string[]) => void;
  addAsset: (assetData: Partial<Asset>) => void;
  importAssetsFromData: (importedAssets: ImportedAssetData[]) => {
    createdCount: number;
    skippedCount: number;
  };
  addVersion: (versionData: Omit<Version, 'id' | 'createdAt'>) => Promise<void>;
  uploadVersionFile: (file: File, metadata: { taskId: string; versionNumber: string; fileType: 'video' | 'image' }) => Promise<ProjectFile>;
  updateVersionStatus: (versionId: string, status: VersionStatus) => void;
  addNote: (noteData: Omit<Note, 'id' | 'createdAt'>) => Promise<void>;
  updateTaskStatus: (taskId: string, status: TaskStatus) => void;
  createReviewList: (title: string, date: string, versionIds: string[], description?: string) => Promise<void>;
  importShotsFromData: (importedShots: Array<{ sceneCode: string; shotCode: string; description: string; durationSec: number; shotType: string; cameraMovement: string; assetNames?: string }>) => Promise<void>;
  sendChatMessage: (msg: Omit<ChatMessage, 'id' | 'createdAt'>) => void;
  updateChatMessageMedia: (messageId: string, editedMediaUrl: string) => void;
  toggleLikeMessage: (messageId: string, userId: string) => void;
  createDepartmentChannel: (channel: Omit<DepartmentChannel, 'id' | 'unreadCount'>) => void;
  resetToDefaultData: () => void;
}

const IS_DEMO_MODE = (import.meta as unknown as { env?: { VITE_DEMO_MODE?: string } }).env?.VITE_DEMO_MODE === 'true';
const PROJECT_FINISHING_STAGES = ['声音', '成片'] as const;

const getProjectTaskDueDate = (project: Project, daysBeforeDelivery: number): string => {
  const deliveryDate = new Date(`${project.deliveryDate}T12:00:00`);
  if (!Number.isNaN(deliveryDate.getTime())) {
    deliveryDate.setDate(deliveryDate.getDate() - daysBeforeDelivery);
    return deliveryDate.toISOString().split('T')[0];
  }
  return new Date(Date.now() + (14 - daysBeforeDelivery) * 86400000)
    .toISOString()
    .split('T')[0];
};

export const createProjectFinishingTasks = (project: Project): Task[] => {
  const soundTaskId = `t_${project.id}_project_sound`;
  return [
    {
      id: soundTaskId,
      title: `${project.name} - 整片声音制作`,
      entityType: 'project',
      entityId: project.id,
      pipelineStage: '声音',
      assigneeId: project.directorId,
      status: '未开始',
      priority: '高',
      dueDate: getProjectTaskDueDate(project, 2),
      requirements: '覆盖整部影片的对白、音效、环境声、音乐与最终混音。',
      createdAt: new Date().toISOString(),
    },
    {
      id: `t_${project.id}_project_final`,
      title: `${project.name} - 成片合成与交付`,
      entityType: 'project',
      entityId: project.id,
      pipelineStage: '成片',
      assigneeId: project.directorId,
      status: '未开始',
      priority: '高',
      dueDate: getProjectTaskDueDate(project, 0),
      requirements: '覆盖整部影片的最终画面、声音合成、质检、输出与交付。',
      createdAt: new Date().toISOString(),
    },
  ];
};

export interface ProjectLocalState {
  scenes: Scene[];
  shots: Shot[];
  assets: Asset[];
  tasks: Task[];
  versions: Version[];
  notes: Note[];
  reviewLists: ReviewList[];
  files: ProjectFile[];
  channels: DepartmentChannel[];
  chatMessages: ChatMessage[];
}

const createDefaultProjectState = (project: Project): ProjectLocalState => {
  if (IS_DEMO_MODE && project.code === mockProject.code) {
    return {
      scenes: mockScenes,
      shots: mockShots,
      assets: mockAssets,
      tasks: [...mockTasks, ...createProjectFinishingTasks(project)],
      versions: mockVersions,
      notes: mockNotes,
      reviewLists: mockReviewLists,
      files: mockFiles,
      channels: mockChannels,
      chatMessages: mockChatMessages,
    };
  }

  return {
    scenes: [],
    shots: [],
    assets: [],
    tasks: createProjectFinishingTasks(project),
    versions: [],
    notes: [],
    reviewLists: [],
    files: [],
    channels: [{
      id: `c_general_${project.id}`,
      name: '项目群聊',
      department: '全体项目成员',
      description: `${project.name} 的项目沟通频道`,
      icon: 'MessageSquare',
      unreadCount: 0,
    }],
    chatMessages: [],
  };
};

const normalizeSceneCode = (value: string | undefined): string =>
  (value || 'SC01').trim().toUpperCase() || 'SC01';

const createLocalId = (prefix: string): string => {
  const randomPart = globalThis.crypto?.randomUUID?.() ||
    `${Date.now().toString(36)}_${Math.random().toString(36).slice(2)}`;
  return `${prefix}_${randomPart}`;
};

export const normalizeScenesAndTasks = (
  project: Project,
  state: ProjectLocalState,
): ProjectLocalState => {
  const scenesByCode = new Map<string, Scene>();

  for (const scene of state.scenes) {
    const sceneCode = normalizeSceneCode(scene.sceneCode);
    if (!scenesByCode.has(sceneCode)) {
      scenesByCode.set(sceneCode, {
        ...scene,
        sceneCode,
        shotCount: 0,
      });
    }
  }

  const shots = state.shots.map(shot => {
    const sceneCode = normalizeSceneCode(shot.sceneCode);
    let scene = scenesByCode.get(sceneCode);
    if (!scene) {
      scene = {
        id: createLocalId('sc'),
        projectId: project.id,
        sceneCode,
        name: `场次 ${sceneCode}`,
        description: '新导入场次',
        shotCount: 0,
      };
      scenesByCode.set(sceneCode, scene);
    }
    scene.shotCount += 1;
    return {
      ...shot,
      sceneCode,
      sceneId: scene.id,
      currentStage: '视频生成' as const,
    };
  });

  const shotsById = new Map(shots.map(shot => [shot.id, shot]));
  const defaultProjectTasks = createProjectFinishingTasks(project);
  const projectTasksByStage = new Map(
    defaultProjectTasks.map(task => [task.pipelineStage, task] as const),
  );
  const finishingTaskIdMap = new Map<string, string>();

  for (const stage of PROJECT_FINISHING_STAGES) {
    const defaultTask = projectTasksByStage.get(stage)!;
    const existingProjectTasks = state.tasks.filter(task =>
      task.entityType === 'project' &&
      task.entityId === project.id &&
      task.pipelineStage === stage
    );
    const canonicalTask = existingProjectTasks[0];
    if (canonicalTask) {
      projectTasksByStage.set(stage, {
        ...defaultTask,
        ...canonicalTask,
        entityType: 'project',
        entityId: project.id,
        title: defaultTask.title,
      });
    }

    state.tasks
      .filter(task =>
        task.pipelineStage === stage &&
        (
          task.entityType === 'shot' ||
          (task.entityType === 'project' && task.entityId === project.id)
        )
      )
      .forEach(task => finishingTaskIdMap.set(task.id, canonicalTask?.id || defaultTask.id));
  }

  const shotTaskIdMap = new Map<string, { taskId: string; shotId: string }>();
  const shotTasks: Task[] = shots.map(shot => {
    const legacyTasks = state.tasks.filter(task =>
      task.entityType === 'shot' &&
      task.entityId === shot.id &&
      !PROJECT_FINISHING_STAGES.includes(
        task.pipelineStage as typeof PROJECT_FINISHING_STAGES[number],
      )
    );
    const existingVideoTask = legacyTasks.find(task => task.pipelineStage === '视频生成');
    const bestLegacyTask = existingVideoTask ||
      legacyTasks.find(task => task.status !== '未开始') ||
      legacyTasks[0];
    const defaultTask = createShotPipelineTasks(
      shot.id,
      shot.sceneCode,
      shot.shotCode,
      shot.assigneeId,
    )[0];
    const canonicalTask: Task = bestLegacyTask
      ? {
          ...defaultTask,
          ...bestLegacyTask,
          entityType: 'shot',
          entityId: shot.id,
          pipelineStage: '视频生成',
          title: `${shot.sceneCode} / ${shot.shotCode} - 视频生成`,
        }
      : defaultTask;

    legacyTasks.forEach(task => {
      shotTaskIdMap.set(task.id, { taskId: canonicalTask.id, shotId: shot.id });
    });
    return canonicalTask;
  });
  const shotTaskByShotId = new Map(
    shotTasks.map(task => [task.entityId, task] as const),
  );

  const tasks = state.tasks.filter(task => {
    if (task.entityType === 'shot') return false;
    if (!PROJECT_FINISHING_STAGES.includes(
      task.pipelineStage as typeof PROJECT_FINISHING_STAGES[number],
    )) return true;
    return task.entityType !== 'project';
  });

  const versions = state.versions.map(version => {
    const projectTaskId = finishingTaskIdMap.get(version.taskId);
    if (projectTaskId) {
      return {
        ...version,
        taskId: projectTaskId,
        entityType: 'project' as const,
        entityId: project.id,
      };
    }
    const shotTaskTarget = shotTaskIdMap.get(version.taskId) ||
      (
        version.entityType === 'shot' && shotTaskByShotId.has(version.entityId)
          ? {
              taskId: shotTaskByShotId.get(version.entityId)!.id,
              shotId: version.entityId,
            }
          : undefined
      );
    if (!shotTaskTarget) return version;
    return {
      ...version,
      taskId: shotTaskTarget.taskId,
      entityType: 'shot' as const,
      entityId: shotTaskTarget.shotId,
    };
  });

  const latestVersionByTaskId = new Map<string, Version>();
  versions.forEach(version => {
    const current = latestVersionByTaskId.get(version.taskId);
    if (!current || String(version.createdAt).localeCompare(String(current.createdAt)) > 0) {
      latestVersionByTaskId.set(version.taskId, version);
    }
  });
  shotTasks.forEach(task => {
    const latestVersion = latestVersionByTaskId.get(task.id);
    tasks.push(latestVersion
      ? { ...task, latestVersionId: latestVersion.id }
      : task
    );
  });
  projectTasksByStage.forEach(task => {
    const latestVersion = latestVersionByTaskId.get(task.id);
    tasks.push(latestVersion
      ? { ...task, latestVersionId: latestVersion.id }
      : task
    );
  });

  return {
    ...state,
    scenes: Array.from(scenesByCode.values())
      .sort((left, right) => left.sceneCode.localeCompare(right.sceneCode, undefined, { numeric: true })),
    shots,
    tasks,
    versions,
  };
};

const sanitizeProjectState = (
  project: Project,
  state: ProjectLocalState,
): ProjectLocalState => {
  if (project.code === mockProject.code) {
    return normalizeScenesAndTasks(project, state);
  }

  const scenes = state.scenes.filter(item => item.projectId === project.id);
  const shots = state.shots.filter(item => item.projectId === project.id);
  const assets = state.assets.filter(item => item.projectId === project.id);
  const entityIds = new Set([...shots.map(item => item.id), ...assets.map(item => item.id)]);
  const tasks = state.tasks.filter(item =>
    entityIds.has(item.entityId) ||
    (item.entityType === 'project' && item.entityId === project.id)
  );
  const versions = state.versions.filter(item =>
    entityIds.has(item.entityId) ||
    (item.entityType === 'project' && item.entityId === project.id)
  );
  const versionIds = new Set(versions.map(item => item.id));
  const notes = state.notes.filter(item => versionIds.has(item.versionId));
  const reviewLists = state.reviewLists
    .filter(item => item.projectId === project.id)
    .map(item => ({
      ...item,
      versionIds: item.versionIds.filter(versionId => versionIds.has(versionId)),
    }));
  const files = state.files.filter(item =>
    entityIds.has(item.entityId) ||
    (item.entityType === 'project' && item.entityId === project.id)
  );
  const mockChannelIds = new Set(mockChannels.map(item => item.id));
  const projectChannels = state.channels.filter(item => !mockChannelIds.has(item.id));
  const channels = projectChannels.length
    ? projectChannels
    : createDefaultProjectState(project).channels;
  const channelIds = new Set(channels.map(item => item.id));
  const chatMessages = state.chatMessages.filter(item => channelIds.has(item.channelId));

  return normalizeScenesAndTasks(project, {
    scenes,
    shots,
    assets,
    tasks,
    versions,
    notes,
    reviewLists,
    files,
    channels,
    chatMessages,
  });
};

const readInitialProjectState = (project: Project): ProjectLocalState =>
  normalizeScenesAndTasks(project, createDefaultProjectState(project));

const parseApiError = async (response: Response, fallback: string): Promise<string> => {
  try {
    const body = await response.json();
    if (typeof body?.error === 'string') return body.error;
  } catch {
    // Keep fallback message.
  }
  return fallback;
};

const apiRequest = async <T,>(path: string, options: RequestInit = {}): Promise<T> => {
  const response = await fetch(path, {
    credentials: 'same-origin',
    ...options,
    headers: {
      ...(options.body ? { 'Content-Type': 'application/json' } : {}),
      ...options.headers,
    },
  });
  if (!response.ok) {
    throw new Error(await parseApiError(response, `服务端请求失败（${response.status}）`));
  }
  if (response.status === 204) return undefined as T;
  return response.json() as Promise<T>;
};


export const createShotPipelineTasks = (
  shotId: string,
  sceneCode: string,
  shotCode: string,
  assigneeId: string,
): Task[] => {
  const pipelineStages = ['视频生成'] as const;

  return pipelineStages.map((stage, index) => ({
    id: `t_${shotId}_${index}`,
    title: `${sceneCode} / ${shotCode} - ${stage}`,
    entityType: 'shot',
    entityId: shotId,
    pipelineStage: stage,
    assigneeId,
    status: '制作中',
    priority: '中',
    dueDate: new Date(Date.now() + (index + 1) * 86400000 * 2).toISOString().split('T')[0],
    requirements: `${sceneCode} / ${shotCode} 的${stage}阶段制作要求`,
    createdAt: new Date().toISOString(),
  }));
};

export const createAssetPipelineTasks = (
  assetId: string,
  assetName: string,
  assigneeId: string,
): Task[] => {
  const stages = ['需求', '概念设计', '修改', '定稿'] as const;
  return stages.map((stage, index) => ({
    id: `t_${assetId}_${index}`,
    title: `${assetName} - ${stage}`,
    entityType: 'asset',
    entityId: assetId,
    pipelineStage: stage,
    assigneeId,
    status: index === 0 ? '已完成' : (index === 1 ? '制作中' : '未开始'),
    priority: '中',
    dueDate: new Date(Date.now() + (index + 1) * 86400000 * 2)
      .toISOString()
      .split('T')[0],
    requirements: `${assetName} ${stage}设计制作`,
    prerequisiteTaskId: index > 0 ? `t_${assetId}_${index - 1}` : undefined,
    createdAt: new Date().toISOString(),
  }));
};

const getShotMetrics = (currentShots: Shot[]) => ({
  totalShots: currentShots.length,
  completedShots: currentShots.filter(shot =>
    shot.status === '已完成' || shot.status === '已锁定'
  ).length,
  pendingReviewShots: currentShots.filter(shot => shot.status === '审核中').length,
  revisingShots: currentShots.filter(shot => shot.status === '制作中').length,
});

const AppContext = createContext<AppContextType | undefined>(undefined);

interface AppProviderProps {
  children: React.ReactNode;
  currentUser: User;
  initialProject: Project;
  initialUsers: User[];
}

export const AppProvider: React.FC<AppProviderProps> = ({
  children,
  currentUser,
  initialProject,
  initialUsers
}) => {
  const [initialLocalState] = useState<ProjectLocalState>(() => readInitialProjectState(initialProject));
  const [activeTab, setActiveTab] = useState<MainTab>('workbench');

  const [project, setProject] = useState<Project>(() => ({
    ...initialProject,
    ...getShotMetrics(initialLocalState.shots),
  }));
  const [users, setUsers] = useState<User[]>(() => [
    currentUser,
    ...initialUsers.filter(user => user.id !== currentUser.id),
    ...(IS_DEMO_MODE && initialProject.code === mockProject.code
      ? mockUsers.filter(user => user.id !== currentUser.id)
      : [])
  ]);
  const [scenes, setScenes] = useState<Scene[]>(initialLocalState.scenes);
  const [shots, setShots] = useState<Shot[]>(initialLocalState.shots);
  const [assets, setAssets] = useState<Asset[]>(initialLocalState.assets);
  const [tasks, setTasks] = useState<Task[]>(initialLocalState.tasks);
  const [versions, setVersions] = useState<Version[]>(initialLocalState.versions);
  const [notes, setNotes] = useState<Note[]>(initialLocalState.notes);
  const [reviewLists, setReviewLists] = useState<ReviewList[]>(initialLocalState.reviewLists);
  const [files, setFiles] = useState<ProjectFile[]>(initialLocalState.files);
  const [channels, setChannels] = useState<DepartmentChannel[]>(initialLocalState.channels);
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>(initialLocalState.chatMessages);

  const [selectedShotId, setSelectedShotId] = useState<string | null>(null);
  const [selectedAssetId, setSelectedAssetId] = useState<string | null>(null);
  const [selectedReviewListId, setSelectedReviewListId] = useState<string | null>(
    initialLocalState.reviewLists[0]?.id || null,
  );

  useEffect(() => {
    setProject(previous => ({
      ...previous,
      ...initialProject,
      totalShots: previous.totalShots,
      completedShots: previous.completedShots,
      pendingReviewShots: previous.pendingReviewShots,
      revisingShots: previous.revisingShots,
    }));
  }, [initialProject]);

  useEffect(() => {
    setUsers([
      currentUser,
      ...initialUsers.filter(user => user.id !== currentUser.id),
      ...(IS_DEMO_MODE && initialProject.code === mockProject.code
        ? mockUsers.filter(user =>
          user.id !== currentUser.id &&
          !initialUsers.some(initialUser => initialUser.id === user.id)
        )
        : [])
    ]);
  }, [currentUser, initialProject.code, initialUsers]);

  const refreshProjectData = async (): Promise<void> => {
    const query = `projectId=${encodeURIComponent(project.id)}`;
    const [sceneBody, shotBody, assetBody, taskBody, versionBody, reviewBody, channelBody, messageBody] = await Promise.all([
      apiRequest<{ scenes: Scene[] }>(`/api/scenes?${query}`),
      apiRequest<{ shots: Shot[] }>(`/api/shots?${query}`),
      apiRequest<{ assets: Asset[] }>(`/api/assets?${query}`),
      apiRequest<{ tasks: Task[] }>(`/api/tasks?${query}`),
      apiRequest<{ versions: Version[] }>(`/api/projects/${project.id}/versions`),
      apiRequest<{ reviewLists: ReviewList[] }>(`/api/projects/${project.id}/review-lists`),
      apiRequest<{ channels: DepartmentChannel[] }>(`/api/chat/channels?${query}`),
      apiRequest<{ chatMessages: ChatMessage[] }>(`/api/chat/messages?${query}`),
    ]);
    const noteBodies = await Promise.all(versionBody.versions.map(version =>
      apiRequest<{ notes: Note[] }>(`/api/versions/${version.id}/notes`)
    ));
    setScenes(sceneBody.scenes);
    setShots(shotBody.shots);
    setAssets(assetBody.assets);
    setTasks(taskBody.tasks);
    setVersions(versionBody.versions);
    setNotes(noteBodies.flatMap(body => body.notes));
    setReviewLists(reviewBody.reviewLists);
    setFiles([]);
    setChannels(channelBody.channels);
    setChatMessages(messageBody.chatMessages);
    updateProjectMetrics(shotBody.shots);
  };

  useEffect(() => {
    if (IS_DEMO_MODE && initialProject.code === mockProject.code) return;
    refreshProjectData().catch(error => console.warn('Failed to load project data:', error));
  }, [project.id, initialProject.code]);


  // Recalculate project shot metrics
  const updateProjectMetrics = (currentShots: Shot[]) => {
    setProject(prev => ({
      ...prev,
      ...getShotMetrics(currentShots),
    }));
  };

  const ensureShotDirectories = async (
    shotEntries: Array<{ shotId: string; shotCode: string; sceneCode: string }>,
  ): Promise<void> => {
    const response = await fetch(`/api/projects/${project.id}/storage/shots`, {
      method: 'POST',
      credentials: 'same-origin',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ shots: shotEntries }),
    });
    if (response.ok) return;
    let message = `无法创建镜头目录（${response.status}）`;
    try {
      const body = await response.json();
      if (typeof body?.error === 'string') message = body.error;
    } catch {
      // Keep the HTTP fallback message.
    }
    throw new Error(message);
  };

  // Add Shot with Pipeline Task Template
  const addShot = async (shotData: Partial<Shot>): Promise<void> => {
    const shotCode = (shotData.shotCode || `SH${String(shots.length + 1).padStart(3, '0')}`)
      .trim()
      .toUpperCase();
    const sceneCode = normalizeSceneCode(shotData.sceneCode);
    const body = await apiRequest<{ shot: Shot }>('/api/shots', {
      method: 'POST',
      body: JSON.stringify({ ...shotData, projectId: project.id, shotCode, sceneCode }),
    });
    await ensureShotDirectories([{ shotId: body.shot.id, shotCode, sceneCode }]);
    await refreshProjectData();
  };


  const updateShots = (
    shotIds: string[],
    updates: Partial<Pick<Shot, 'sceneCode' | 'assigneeId' | 'status'>>,
  ) => {
    if (currentUser.role !== 'admin' && currentUser.role !== 'director') return;
    const selectedIds = new Set(shotIds);
    if (!selectedIds.size) return;

    const nextSceneCode = updates.sceneCode
      ? normalizeSceneCode(updates.sceneCode)
      : undefined;
    const scenesByCode = new Map<string, Scene>(
      scenes.map(scene => [normalizeSceneCode(scene.sceneCode), { ...scene }] as const),
    );
    if (nextSceneCode && !scenesByCode.has(nextSceneCode)) {
      scenesByCode.set(nextSceneCode, {
        id: createLocalId('sc'),
        projectId: project.id,
        sceneCode: nextSceneCode,
        name: `场次 ${nextSceneCode}`,
        description: '批量编辑创建的场次',
        shotCount: 0,
      });
    }

    const nextShots = shots.map(shot => {
      if (!selectedIds.has(shot.id)) return shot;
      const sceneCode = nextSceneCode || shot.sceneCode;
      const scene = scenesByCode.get(sceneCode);
      return {
        ...shot,
        ...(updates.assigneeId ? { assigneeId: updates.assigneeId } : {}),
        ...(updates.status ? { status: updates.status } : {}),
        ...(nextSceneCode && scene
          ? { sceneCode: nextSceneCode, sceneId: scene.id }
          : {}),
      };
    });
    const shotCounts = new Map<string, number>();
    nextShots.forEach(shot => {
      const sceneCode = normalizeSceneCode(shot.sceneCode);
      shotCounts.set(sceneCode, (shotCounts.get(sceneCode) || 0) + 1);
    });

    setShots(nextShots);
    setScenes(
      Array.from(scenesByCode.values())
        .map(scene => ({
          ...scene,
          shotCount: shotCounts.get(normalizeSceneCode(scene.sceneCode)) || 0,
        }))
        .sort((left, right) =>
          left.sceneCode.localeCompare(right.sceneCode, undefined, { numeric: true })
        ),
    );
    setTasks(previous => previous.map(task => {
      if (task.entityType !== 'shot' || !selectedIds.has(task.entityId)) return task;
      const shot = nextShots.find(item => item.id === task.entityId);
      if (!shot) return task;
      return {
        ...task,
        title: `${shot.sceneCode} / ${shot.shotCode} - ${task.pipelineStage}`,
        ...(updates.assigneeId ? { assigneeId: updates.assigneeId } : {}),
      };
    }));
    updateProjectMetrics(nextShots);
  };

  const deleteShots = async (shotIds: string[]) => {
    if (currentUser.role !== 'admin' && currentUser.role !== 'director') return;
    await Promise.all(shotIds.map(shotId => apiRequest<void>(`/api/shots/${shotId}`, { method: 'DELETE' })));
    await refreshProjectData();
  };


  const deleteShot = (shotId: string) => { void deleteShots([shotId]); };

  // Add Asset with Pipeline Task Template
  const addAsset = async (assetData: Partial<Asset>) => {
    await apiRequest<{ asset: Asset }>('/api/assets', {
      method: 'POST',
      body: JSON.stringify({ ...assetData, projectId: project.id }),
    });
    await refreshProjectData();
  };


  const importAssetsFromData = (importedData: ImportedAssetData[]) => {
    const existingNames = new Set(
      assets.map(asset => asset.name.trim().toLocaleLowerCase('zh-CN')),
    );
    const importedAssets: Asset[] = [];
    const importedTasks: Task[] = [];
    let skippedCount = 0;

    importedData.forEach(item => {
      const name = item.name.trim();
      const normalizedName = name.toLocaleLowerCase('zh-CN');
      if (!name || existingNames.has(normalizedName)) {
        skippedCount += 1;
        return;
      }
      existingNames.add(normalizedName);

      const assigneeQuery = item.assignee?.trim().toLocaleLowerCase('zh-CN');
      const matchedAssignee = assigneeQuery
        ? users.find(user =>
            user.id.toLocaleLowerCase('zh-CN') === assigneeQuery ||
            user.name.trim().toLocaleLowerCase('zh-CN') === assigneeQuery ||
            user.email?.trim().toLocaleLowerCase('zh-CN') === assigneeQuery
          )
        : undefined;
      const assetId = createLocalId('a');
      const asset: Asset = {
        id: assetId,
        projectId: project.id,
        name,
        category: item.category,
        thumbnailUrl: item.thumbnailUrl?.trim() ||
          'https://images.unsplash.com/photo-1581092160607-ee22621dd758?w=600&auto=format&fit=crop&q=80',
        assigneeId: matchedAssignee?.id || currentUser.id,
        status: '制作中',
        usageCount: 0,
        usedInShotIds: [],
        description: item.description.trim() || `${name}资产设定`,
        referenceImages: item.thumbnailUrl?.trim() ? [item.thumbnailUrl.trim()] : [],
        promptTemplate: item.promptTemplate?.trim() || '',
      };
      importedAssets.push(asset);
      importedTasks.push(...createAssetPipelineTasks(
        asset.id,
        asset.name,
        asset.assigneeId,
      ));
    });

    if (importedAssets.length) {
      setAssets(previous => [...importedAssets, ...previous]);
      setTasks(previous => [...importedTasks, ...previous]);
    }
    return {
      createdCount: importedAssets.length,
      skippedCount,
    };
  };


  const uploadVersionFile = async (file: File, metadata: { taskId: string; versionNumber: string; fileType: 'video' | 'image' }) => {
    const task = tasks.find(item => item.id === metadata.taskId);
    if (!task) throw new Error('请选择有效任务。');
    const formData = new FormData();
    formData.append('file', file);
    formData.append('projectId', project.id);
    formData.append('fileType', 'review');
    formData.append('versionNumber', metadata.versionNumber);
    if (task.entityType !== 'project') {
      formData.append('entityType', task.entityType);
      formData.append('entityId', task.entityId);
    }
    const response = await fetch('/api/files/upload', { method: 'POST', credentials: 'same-origin', body: formData });
    if (!response.ok) throw new Error(await parseApiError(response, `文件上传失败（${response.status}）`));
    const body = await response.json() as { file: ProjectFile };
    return body.file;
  };

  // Add new Version
  const addVersion = async (versionData: Omit<Version, 'id' | 'createdAt'>) => {
    await apiRequest<{ version: Version }>('/api/versions', {
      method: 'POST',
      body: JSON.stringify(versionData),
    });
    await refreshProjectData();
  };


  // Approve / Reject / Update Version Status
  const updateVersionStatus = (versionId: string, status: VersionStatus) => {
    void apiRequest<{ version: Version }>(`/api/versions/${versionId}/status`, {
      method: 'PATCH',
      body: JSON.stringify({ status }),
    }).catch(error => console.warn('Failed to update version status:', error));
    const version = versions.find(v => v.id === versionId);
    if (!version) return;

    setVersions(prev => prev.map(v => v.id === versionId ? { ...v, status } : v));

    const task = tasks.find(t => t.id === version.taskId);
    if (!task) return;

    // Determine new task status based on version approval
    let newTaskStatus: TaskStatus = '制作中';
    if (status === '已通过' || status === '最终版') {
      newTaskStatus = '已完成';
    } else if (status === '已退回') {
      newTaskStatus = '修改中';
    } else if (status === '待审核') {
      newTaskStatus = '待审核';
    }

    // Update Task
    setTasks(prev => {
      const updatedTasks = prev.map(t => {
        if (t.id === task.id) {
          return { ...t, status: newTaskStatus };
        }
        // Unblock dependent task if this task is now completed
        if (t.prerequisiteTaskId === task.id && (status === '已通过' || status === '最终版')) {
          return { ...t, status: '制作中' as TaskStatus };
        }
        return t;
      });
      return updatedTasks;
    });

    // Update Entity Status
    if (version.entityType === 'shot') {
      setShots(prev => {
        const updated = prev.map(s => {
          if (s.id === version.entityId) {
            let sStatus: ShotStatus = '制作中';
            if (status === '已通过') sStatus = '已完成';
            else if (status === '最终版') sStatus = '已锁定';
            else if (status === '已退回') sStatus = '制作中';
            else if (status === '待审核') sStatus = '审核中';
            return { ...s, status: sStatus };
          }
          return s;
        });
        updateProjectMetrics(updated);
        return updated;
      });
    } else if (version.entityType === 'asset') {
      setAssets(prev => prev.map(a => {
        if (a.id === version.entityId) {
          let aStatus: AssetStatus = '制作中';
          if (status === '已通过') aStatus = '已定稿';
          else if (status === '最终版') aStatus = '已锁定';
          else if (status === '已退回') aStatus = '制作中';
          else if (status === '待审核') aStatus = '审核中';
          return {
            ...a,
            status: aStatus,
            approvedVersionId: status === '已通过' || status === '最终版' ? versionId : a.approvedVersionId
          };
        }
        return a;
      }));
    }
  };

  // Add Note
  const addNote = async (noteData: Omit<Note, 'id' | 'createdAt'>) => {
    const body = await apiRequest<{ note: Note }>(`/api/versions/${noteData.versionId}/notes`, {
      method: 'POST',
      body: JSON.stringify(noteData),
    });
    setNotes(previous => [body.note, ...previous.filter(note => note.id !== body.note.id)]);
  };


  // Update Task Status
  const updateTaskStatus = (taskId: string, status: TaskStatus) => {
    setTasks(prev => prev.map(t => t.id === taskId ? { ...t, status } : t));
  };

  // Create Review List (Playlist)
  const createReviewList = async (title: string, date: string, versionIds: string[], description?: string) => {
    const body = await apiRequest<{ reviewList: ReviewList }>(`/api/projects/${project.id}/review-lists`, {
      method: 'POST',
      body: JSON.stringify({ title, date, versionIds, description }),
    });
    setReviewLists(prev => [body.reviewList, ...prev.filter(item => item.id !== body.reviewList.id)]);
    setSelectedReviewListId(body.reviewList.id);
  };

  // Batch import shots from parsed Excel / CSV array
  const importShotsFromData = async (importedData: Array<{ sceneCode: string; shotCode: string; description: string; durationSec: number; shotType: string; cameraMovement: string; assetNames?: string }>): Promise<void> => {
    const body = await apiRequest<{ scenes: Scene[]; shots: Shot[]; tasks: Task[] }>('/api/shots/bulk', {
      method: 'POST',
      body: JSON.stringify({
        projectId: project.id,
        shots: importedData.map((item, index) => ({
          sceneCode: normalizeSceneCode(item.sceneCode),
          shotCode: (item.shotCode || `SH${String(shots.length + index + 1).padStart(3, '0')}`)
            .trim()
            .toUpperCase(),
          description: item.description || '导入镜头描述',
          durationSec: Number(item.durationSec) || 5,
          shotType: item.shotType || '中景',
          cameraMovement: item.cameraMovement || '固定镜头',
          assigneeId: currentUser.id,
        })),
      }),
    });

    const sceneMap = new Map<string, Scene>(scenes.map(scene => [scene.id, scene]));
    body.scenes.forEach(scene => sceneMap.set(scene.id, scene));

    const shotMap = new Map<string, Shot>(shots.map(shot => [shot.id, shot]));
    body.shots.forEach(shot => shotMap.set(shot.id, shot));

    const taskMap = new Map<string, Task>(tasks.map(task => [task.id, task]));
    body.tasks.forEach(task => taskMap.set(task.id, task));

    const nextShots = Array.from(shotMap.values()).sort((left, right) =>
      left.shotCode.localeCompare(right.shotCode, undefined, { numeric: true })
    );
    const shotCounts = new Map<string, number>();
    nextShots.forEach(shot => {
      const sceneCode = normalizeSceneCode(shot.sceneCode);
      shotCounts.set(sceneCode, (shotCounts.get(sceneCode) || 0) + 1);
    });

    setScenes(Array.from(sceneMap.values())
      .map(scene => ({ ...scene, shotCount: shotCounts.get(normalizeSceneCode(scene.sceneCode)) || scene.shotCount || 0 }))
      .sort((left, right) => left.sceneCode.localeCompare(right.sceneCode, undefined, { numeric: true })));
    setShots(nextShots);
    setTasks(Array.from(taskMap.values()).sort((left, right) => right.createdAt.localeCompare(left.createdAt)));
    updateProjectMetrics(nextShots);
  };

  // Communication Methods
  const sendChatMessage = async (msgData: Omit<ChatMessage, 'id' | 'createdAt'>) => {
    const body = await apiRequest<{ message: ChatMessage }>('/api/chat/messages', {
      method: 'POST',
      body: JSON.stringify(msgData),
    });
    setChatMessages(prev => [...prev, body.message]);
  };


  const updateChatMessageMedia = (messageId: string, editedMediaUrl: string) => {
    setChatMessages(prev => prev.map(m => m.id === messageId ? { ...m, editedMediaUrl } : m));
  };

  const toggleLikeMessage = (messageId: string, userId: string) => {
    setChatMessages(prev => prev.map(m => {
      if (m.id === messageId) {
        const likes = m.likes || [];
        const exists = likes.includes(userId);
        return {
          ...m,
          likes: exists ? likes.filter(id => id !== userId) : [...likes, userId]
        };
      }
      return m;
    }));
  };

  const createDepartmentChannel = (channelData: Omit<DepartmentChannel, 'id' | 'unreadCount'>) => {
    const newChan: DepartmentChannel = {
      ...channelData,
      id: `c_${Date.now().toString(36)}`,
      unreadCount: 0
    };
    setChannels(prev => [...prev, newChan]);
  };

  // Reset to default sample state
  const resetToDefaultData = () => {
    const defaults = createDefaultProjectState(initialProject);
    setProject(initialProject);
    setScenes(defaults.scenes);
    setShots(defaults.shots);
    setAssets(defaults.assets);
    setTasks(defaults.tasks);
    setVersions(defaults.versions);
    setNotes(defaults.notes);
    setReviewLists(defaults.reviewLists);
    setFiles(defaults.files);
    setChannels(defaults.channels);
    setChatMessages(defaults.chatMessages);
    setSelectedShotId(null);
    setSelectedAssetId(null);
    setSelectedReviewListId(defaults.reviewLists[0]?.id || null);
  };

  return (
    <AppContext.Provider
      value={{
        currentUser,
        activeTab,
        setActiveTab,
        project,
        users,
        scenes,
        shots,
        assets,
        tasks,
        versions,
        notes,
        reviewLists,
        files,
        channels,
        chatMessages,
        selectedShotId,
        setSelectedShotId,
        selectedAssetId,
        setSelectedAssetId,
        selectedReviewListId,
        setSelectedReviewListId,
        addShot,
        updateShots,
        deleteShot,
        deleteShots,
        addAsset,
        importAssetsFromData,
        addVersion,
        uploadVersionFile,
        updateVersionStatus,
        addNote,
        updateTaskStatus,
        createReviewList,
        importShotsFromData,
        sendChatMessage,
        updateChatMessageMedia,
        toggleLikeMessage,
        createDepartmentChannel,
        resetToDefaultData
      }}
    >
      {children}
    </AppContext.Provider>
  );
};

export const useApp = () => {
  const context = useContext(AppContext);
  if (!context) {
    throw new Error('useApp must be used within an AppProvider');
  }
  return context;
};
