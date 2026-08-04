export type UserRole = 'admin' | 'director' | 'creator' | 'client';

export interface User {
  id: string;
  name: string;
  avatar: string;
  role: UserRole;
  department: string;
  email?: string;
}

export type EntityType = 'project' | 'shot' | 'asset';

export type ShotStatus = '未开始' | '制作中' | '审核中' | '已完成' | '已锁定';

export type AssetCategory = '角色' | '场景' | '道具' | '服装' | '载具' | '生物' | '风格参考';

export type AssetStatus = '未开始' | '制作中' | '审核中' | '已定稿' | '已锁定';

export type ShotPipelineStage = '视频生成';
export type ProjectPipelineStage = '声音' | '成片';
export type AssetPipelineStage = '需求' | '概念设计' | '修改' | '定稿';
export type TaskPipelineStage =
  | ShotPipelineStage
  | ProjectPipelineStage
  | AssetPipelineStage;

export type TaskStatus = '未开始' | '制作中' | '待审核' | '修改中' | '已完成' | '已阻塞';

export type TaskPriority = '高' | '中' | '低';

export type VersionStatus = '待审核' | '已通过' | '已退回' | '最终版';

export interface AIGenerationParams {
  modelName: string;         // e.g. Runway Gen-3, Kling 1.5, Midjourney V6, Luma, Hailuo
  modelVersion?: string;     // e.g. v1.5 Pro
  prompt: string;            // 完整提示词
  negativePrompt?: string;
  firstFrameUrl?: string;    // 首帧
  lastFrameUrl?: string;     // 尾帧
  refVideoUrl?: string;      // 参考视频
  durationSec?: number;
  resolution?: string;       // e.g. 3840x2160
  aspectRatio?: string;      // e.g. 16:9
  seed?: string | number;
  cameraMotion?: string;     // e.g. 缓慢推进, 环绕摇镜
  generationCost?: number;   // 生成费用 ($ or ¥)
  isPostProcessed?: boolean; // 是否经过后期修复
  rawGenerationUrl?: string; // 原始生成文件
  nasPath?: string;          // NAS源文件路径 e.g. \\NAS\NOMUD\EP01\SC03\SH010\video\v004\
}

export interface Version {
  id: string;
  taskId: string;
  entityType: EntityType;
  entityId: string;
  versionNumber: string;    // e.g. V001, V002
  fileUrl: string;          // MP4 video or PNG image
  fileType: 'video' | 'image';
  thumbnailUrl: string;
  uploaderId: string;
  createdAt: string;
  changelog: string;        // 修改说明
  status: VersionStatus;
  aiParams?: AIGenerationParams;
}

export interface NoteAnnotation {
  id: string;
  type: 'brush' | 'circle' | 'arrow' | 'rect' | 'text';
  points?: number[];
  x?: number;
  y?: number;
  width?: number;
  height?: number;
  text?: string;
  color: string;
}

export interface Note {
  id: string;
  versionId: string;
  reviewerId: string;
  content: string;
  timestampSec?: number;    // 视频时间点 e.g. 2.12
  timestampText?: string;   // e.g. "00:02.12"
  annotationDataUrl?: string; // Canvas drawings data URL
  annotations?: NoteAnnotation[];
  isMandatory: boolean;     // 是否必须修改
  status: '待处理' | '已解决';
  replyContent?: string;
  repliedAt?: string;
  createdAt: string;
}

export interface Task {
  id: string;
  title: string;
  entityType: EntityType;
  entityId: string;
  pipelineStage: TaskPipelineStage;
  assigneeId: string;
  status: TaskStatus;
  priority: TaskPriority;
  dueDate: string;
  requirements: string;
  prerequisiteTaskId?: string; // 前置任务
  latestVersionId?: string;
  createdAt: string;
}

export interface Shot {
  id: string;
  shotCode: string;          // e.g. SH001
  projectId: string;
  sceneId: string;           // e.g. SC01
  sceneCode: string;         // e.g. SC01
  durationSec: number;
  shotType: string;          // 景别: 特写, 中近景, 远景等
  cameraMovement: string;    // 运镜: 缓慢推进, 甩镜头等
  description: string;
  dialogue?: string;
  currentStage: ShotPipelineStage;
  assigneeId: string;
  status: ShotStatus;
  latestVersionId?: string;
  thumbnailUrl: string;
  assetIds: string[];        // 关联资产
}

export interface Asset {
  id: string;
  projectId: string;
  name: string;
  category: AssetCategory;
  thumbnailUrl: string;
  assigneeId: string;
  status: AssetStatus;
  latestVersionId?: string;
  usageCount: number;        // 使用镜头数
  usedInShotIds: string[];   // 使用该资产的镜头列表
  description: string;
  referenceImages: string[];
  promptTemplate?: string;
  approvedVersionId?: string;
}

export interface ImportedAssetData {
  name: string;
  category: AssetCategory;
  description: string;
  promptTemplate?: string;
  thumbnailUrl?: string;
  assignee?: string;
}

export interface Scene {
  id: string;
  projectId: string;
  sceneCode: string;         // e.g. SC01
  name: string;
  description: string;
  shotCount: number;
}

export interface Project {
  id: string;
  name: string;
  code: string;              // e.g. NOMUD
  type: string;              // e.g. AI科幻短片, AI动画
  aspectRatio: string;       // e.g. 16:9, 2.39:1
  totalDurationMin: number;
  deliveryDate: string;
  directorId: string;
  members: string[];         // user ids
  status: '进行中' | '已完成' | '筹备中';
  currentPhase: string;      // e.g. 视频生成中, 后期剪辑中
  totalShots: number;
  completedShots: number;
  pendingReviewShots: number;
  revisingShots: number;
  blockedShots: number;
  storageKey?: string;
  storagePath?: string;
  storageDirectories?: string[];
}

export interface ReviewList {
  id: string;
  projectId: string;
  title: string;             // e.g. 7月28日视频审核
  date: string;
  versionIds: string[];
  description?: string;
  createdAt: string;
}

export interface ProjectFile {
  id: string;
  name: string;
  fileType: 'review' | 'source'; // 网页审核文件 vs NAS源文件
  extension: string;
  sizeMb: number;
  url: string;
  nasPath?: string;
  entityType: EntityType;
  entityId: string;
  entityCode: string;
  versionNumber?: string;
  uploadedAt: string;
  uploaderId: string;
}

export interface ChatMessage {
  id: string;
  channelId: string;
  senderId: string;
  content: string;
  mediaType?: 'none' | 'image' | 'video';
  mediaUrl?: string;
  mediaName?: string;
  mediaSizeMb?: number;
  editedMediaUrl?: string; // 经过批注/编辑后的图片URL
  annotationDataUrl?: string;
  referencedEntity?: {
    type: 'shot' | 'asset' | 'task';
    id: string;
    code: string;
    title?: string;
  };
  createdAt: string;
  likes?: string[]; // user IDs who liked this message
  replyCount?: number;
}

export interface DepartmentChannel {
  id: string;
  name: string;
  department: string;
  description: string;
  icon: string; // lucide icon name or emoji
  unreadCount: number;
  isPrivate?: boolean;
  memberIds?: string[];
}
