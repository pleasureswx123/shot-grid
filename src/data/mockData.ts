import { Project, User, Scene, Shot, Asset, Task, Version, Note, ReviewList, ProjectFile, DepartmentChannel, ChatMessage } from '../types';

export const mockUsers: User[] = [
  {
    id: 'u1',
    name: '苟总 (Director)',
    avatar: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150&auto=format&fit=crop&q=80',
    role: 'director',
    department: '导演组',
    email: 'director@studio.ai'
  },
  {
    id: 'u2',
    name: '张三 (AI视频总监)',
    avatar: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=150&auto=format&fit=crop&q=80',
    role: 'creator',
    department: 'AI视频生成组',
    email: 'zhangsan@studio.ai'
  },
  {
    id: 'u3',
    name: '李四 (剪辑/声音)',
    avatar: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=150&auto=format&fit=crop&q=80',
    role: 'creator',
    department: '剪辑特效组',
    email: 'lisi@studio.ai'
  },
  {
    id: 'u4',
    name: '王五 (概念美术)',
    avatar: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=150&auto=format&fit=crop&q=80',
    role: 'creator',
    department: '概念美术组',
    email: 'wangwu@studio.ai'
  },
  {
    id: 'u5',
    name: '系统管理员',
    avatar: 'https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=150&auto=format&fit=crop&q=80',
    role: 'admin',
    department: '技术运维组',
    email: 'admin@studio.ai'
  },
  {
    id: 'u6',
    name: '腾讯影业 (外部客户)',
    avatar: 'https://images.unsplash.com/photo-1519085360753-af0119f7cbe7?w=150&auto=format&fit=crop&q=80',
    role: 'client',
    department: '出品方代表',
    email: 'client@tencent.com'
  }
];

export const mockProject: Project = {
  id: 'p1',
  name: '《NoMud: 舱室逃逸》',
  code: 'NOMUD',
  type: 'AI科幻动作短片',
  aspectRatio: '2.39:1',
  totalDurationMin: 8.5,
  deliveryDate: '2026-09-15',
  directorId: 'u1',
  members: ['u1', 'u2', 'u3', 'u4', 'u5', 'u6'],
  status: '进行中',
  currentPhase: '视频生成与动态审核',
  totalShots: 24,
  completedShots: 11,
  pendingReviewShots: 5,
  revisingShots: 6,
  blockedShots: 2
};

export const mockScenes: Scene[] = [
  {
    id: 'sc1',
    projectId: 'p1',
    sceneCode: 'SC01',
    name: '控制室红光警报',
    description: '太空站中央指挥室发生气压骤降，红色应急灯光闪烁，仪器仪表飞速跳动。',
    shotCount: 8
  },
  {
    id: 'sc2',
    projectId: 'p1',
    sceneCode: 'SC02',
    name: '长廊逃生冲刺',
    description: '主人公苟翱天穿过失压的玻璃过道，背景是浩瀚星空与陨石碎片撞击的火花。',
    shotCount: 10
  },
  {
    id: 'sc3',
    projectId: 'p1',
    sceneCode: 'SC03',
    name: '舱室内苟翱天惊醒',
    description: '低温休眠舱液压阀爆开，雾气升腾，苟翱天大口呼吸从睡眠中惊醒。',
    shotCount: 6
  }
];

export const mockAssets: Asset[] = [
  {
    id: 'a1',
    projectId: 'p1',
    name: '苟翱天',
    category: '角色',
    thumbnailUrl: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=600&auto=format&fit=crop&q=80',
    assigneeId: 'u4',
    status: '已定稿',
    latestVersionId: 'v_a1_8',
    usageCount: 18,
    usedInShotIds: ['sh001', 'sh002', 'sh003', 'sh010', 'sh011'],
    description: '男性航天指挥官，35岁，眼神坚毅，左脸颊有微弱的赛博金属接口痕迹。',
    referenceImages: [
      'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=600&auto=format&fit=crop&q=80',
      'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=600&auto=format&fit=crop&q=80'
    ],
    promptTemplate: 'Cinematic portrait of male astronaut in sci-fi suit, sharp facial features, cybernetic temple port, volumetric rim lighting, 8k render, octane style --ar 2.39:1',
    approvedVersionId: 'v_a1_8'
  },
  {
    id: 'a2',
    projectId: 'p1',
    name: 'NoMud主控舱室',
    category: '场景',
    thumbnailUrl: 'https://images.unsplash.com/photo-1518709268805-4e9042af9f23?w=600&auto=format&fit=crop&q=80',
    assigneeId: 'u4',
    status: '制作中',
    latestVersionId: 'v_a2_12',
    usageCount: 14,
    usedInShotIds: ['sh001', 'sh003', 'sh010'],
    description: '带有重工业质感与高科技全息显示屏的太空舱，主色调为深冷蓝与警示红色亮光。',
    referenceImages: [
      'https://images.unsplash.com/photo-1518709268805-4e9042af9f23?w=600&auto=format&fit=crop&q=80'
    ],
    promptTemplate: 'Inside futuristic spaceship cockpit, glowing red warning holograms, metallic pipelines, mist, cinematic lighting, 8k resolution --ar 2.39:1'
  },
  {
    id: 'a3',
    projectId: 'p1',
    name: '逃生推进器',
    category: '道具',
    thumbnailUrl: 'https://images.unsplash.com/photo-1581092160607-ee22621dd758?w=600&auto=format&fit=crop&q=80',
    assigneeId: 'u4',
    status: '已定稿',
    latestVersionId: 'v_a3_3',
    usageCount: 6,
    usedInShotIds: ['sh002', 'sh005'],
    description: '单人肩扛式短距脉冲推进器，附带碳纤维固定扣与防爆气压表。',
    referenceImages: [
      'https://images.unsplash.com/photo-1581092160607-ee22621dd758?w=600&auto=format&fit=crop&q=80'
    ],
    promptTemplate: 'Sci-fi personal thruster backpack, worn carbon fiber finish, glowing thruster nozzles, industrial design'
  },
  {
    id: 'a4',
    projectId: 'p1',
    name: '尖叫鸡防爆挂饰',
    category: '道具',
    thumbnailUrl: 'https://images.unsplash.com/photo-1563089145-599997674d42?w=600&auto=format&fit=crop&q=80',
    assigneeId: 'u4',
    status: '已定稿',
    latestVersionId: 'v_a4_1',
    usageCount: 4,
    usedInShotIds: ['sh010'],
    description: '系在操控台旁边的复古黄色尖叫鸡橡胶玩具，带有彩蛋性质的荒诞反差。',
    referenceImages: [
      'https://images.unsplash.com/photo-1563089145-599997674d42?w=600&auto=format&fit=crop&q=80'
    ],
    promptTemplate: 'Screaming rubber yellow chicken toy dangling inside sci-fi spaceship cockpit, hilarious contrast, shallow depth of field'
  }
];

export const mockVersions: Version[] = [
  {
    id: 'v10_3',
    taskId: 't_sh010_video',
    entityType: 'shot',
    entityId: 'sh010',
    versionNumber: 'V003',
    fileUrl: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerBlazes.mp4',
    fileType: 'video',
    thumbnailUrl: 'https://images.unsplash.com/photo-1518709268805-4e9042af9f23?w=600&auto=format&fit=crop&q=80',
    uploaderId: 'u2',
    createdAt: '2026-07-27 16:30',
    changelog: '修改了人物转头速度与背景烟雾浓度，优化了红光频闪幅度。',
    status: '待审核',
    aiParams: {
      mediaType: 'video',
      modelName: 'Kling 1.5 Pro',
      modelVersion: '1.5-Pro High Quality',
      prompt: 'Cinematic wide shot, male commander Gou Aotian wakes up inside休眠舱, steam rushing out, red emergency light pulsing slowly, camera slow push in, 24fps film motion',
      negativePrompt: 'blurry, low quality, jitter, smooth skin, cartoon',
      firstFrameUrl: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=600&auto=format&fit=crop&q=80',
      lastFrameUrl: 'https://images.unsplash.com/photo-1518709268805-4e9042af9f23?w=600&auto=format&fit=crop&q=80',
      durationSec: 6,
      resolution: '3840x2160',
      aspectRatio: '2.39:1',
      seed: 88491204,
      cameraMotion: '缓慢推进 (Zoom In)',
      generationCost: 12.5,
      isPostProcessed: true,
      rawGenerationUrl: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerBlazes.mp4',
      nasPath: '\\\\NAS\\NOMUD\\EP01\\SC03\\SH010\\video\\v003\\SH010_Kling_4K.mp4'
    }
  },
  {
    id: 'v10_2',
    taskId: 't_sh010_video',
    entityType: 'shot',
    entityId: 'sh010',
    versionNumber: 'V002',
    fileUrl: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerEscapes.mp4',
    fileType: 'video',
    thumbnailUrl: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=600&auto=format&fit=crop&q=80',
    uploaderId: 'u2',
    createdAt: '2026-07-26 11:20',
    changelog: '调整动作平滑度，修正人物眼神发散问题。',
    status: '已退回',
    aiParams: {
      mediaType: 'video',
      modelName: 'Runway Gen-3 Alpha',
      prompt: 'Astronaut waking up abruptly in sci-fi cabin, lens flare, slow motion',
      seed: 1948201,
      nasPath: '\\\\NAS\\NOMUD\\EP01\\SC03\\SH010\\video\\v002\\'
    }
  },
  {
    id: 'v10_1',
    taskId: 't_sh010_video',
    entityType: 'shot',
    entityId: 'sh010',
    versionNumber: 'V001',
    fileUrl: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerFun.mp4',
    fileType: 'video',
    thumbnailUrl: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=600&auto=format&fit=crop&q=80',
    uploaderId: 'u2',
    createdAt: '2026-07-25 09:15',
    changelog: '首次测试视频生成效果。',
    status: '已退回',
    aiParams: {
      mediaType: 'video',
      modelName: 'Luma Dream Machine',
      prompt: 'Sci-fi wake up shot in dark pod',
      seed: 772105,
      nasPath: '\\\\NAS\\NOMUD\\EP01\\SC03\\SH010\\video\\v001\\'
    }
  },
  {
    id: 'v001_3',
    taskId: 't_sh001_video',
    entityType: 'shot',
    entityId: 'sh001',
    versionNumber: 'V003',
    fileUrl: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ElephantsDream.mp4',
    fileType: 'video',
    thumbnailUrl: 'https://images.unsplash.com/photo-1518709268805-4e9042af9f23?w=600&auto=format&fit=crop&q=80',
    uploaderId: 'u2',
    createdAt: '2026-07-27 14:10',
    changelog: '已按导演要求减少控制台过曝，提升火花质感。',
    status: '待审核',
    aiParams: {
      mediaType: 'video',
      modelName: 'Hailuo MiniMax',
      prompt: 'Spaceship control room alarm flashing, Sparks flying, cinematic lighting, 2.39:1',
      seed: 9284012,
      nasPath: '\\\\NAS\\NOMUD\\EP01\\SC01\\SH001\\video\\v003\\'
    }
  },
  {
    id: 'v002_6',
    taskId: 't_sh002_video',
    entityType: 'shot',
    entityId: 'sh002',
    versionNumber: 'V006',
    fileUrl: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4',
    fileType: 'video',
    thumbnailUrl: 'https://images.unsplash.com/photo-1581092160607-ee22621dd758?w=600&auto=format&fit=crop&q=80',
    uploaderId: 'u2',
    createdAt: '2026-07-27 17:00',
    changelog: '优化玻璃反光与陨石碎片轨迹。',
    status: '待审核',
    aiParams: {
      mediaType: 'video',
      modelName: 'Runway Gen-3',
      prompt: 'Space corridor sprinting with thruster attached, camera tracking alongside, asteroid strike outside window',
      seed: 559124,
      nasPath: '\\\\NAS\\NOMUD\\EP01\\SC01\\SH002\\video\\v006\\'
    }
  },
  {
    id: 'v_a1_8',
    taskId: 't_a1_design',
    entityType: 'asset',
    entityId: 'a1',
    versionNumber: 'V008',
    fileUrl: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=1000&auto=format&fit=crop&q=80',
    fileType: 'image',
    thumbnailUrl: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=600&auto=format&fit=crop&q=80',
    uploaderId: 'u4',
    createdAt: '2026-07-24 15:00',
    changelog: '定稿版本：补充了三视图与脸部微细节赛博接口。',
    status: '已通过',
    aiParams: {
      mediaType: 'image',
      modelName: 'Midjourney V6',
      prompt: 'Sci-fi male commander Gou Aotian concept art, front side back views, highly detailed',
      seed: 33901,
      nasPath: '\\\\NAS\\NOMUD\\ASSETS\\CHARACTERS\\GouAotian\\v008\\'
    }
  }
];

export const mockShots: Shot[] = [
  {
    id: 'sh010',
    shotCode: 'SH010',
    projectId: 'p1',
    sceneId: 'sc3',
    sceneCode: 'SC03',
    durationSec: 6,
    shotType: '中近景 (Medium Close)',
    cameraMovement: '缓慢推进 (Push In)',
    description: '舱室内苟翱天惊醒，低温休眠舱液压阀爆开，红光充斥镜头。',
    dialogue: '（呼吸急促，低沉咳嗽）...系统...发生什么事了？！',
    currentStage: '视频生成',
    assigneeId: 'u2',
    status: '审核中',
    latestVersionId: 'v10_3',
    thumbnailUrl: 'https://images.unsplash.com/photo-1518709268805-4e9042af9f23?w=600&auto=format&fit=crop&q=80',
    assetIds: ['a1', 'a2', 'a4']
  },
  {
    id: 'sh001',
    shotCode: 'SH001',
    projectId: 'p1',
    sceneId: 'sc1',
    sceneCode: 'SC01',
    durationSec: 5,
    shotType: '全景 (Wide)',
    cameraMovement: '快速甩镜头 (Whip Pan)',
    description: '控制室主警报闪烁，仪表盘剧烈晃动，电火花爆开。',
    dialogue: '警告：舱室失压倒计时00:45！',
    currentStage: '视频生成',
    assigneeId: 'u2',
    status: '制作中',
    latestVersionId: 'v001_3',
    thumbnailUrl: 'https://images.unsplash.com/photo-1518709268805-4e9042af9f23?w=600&auto=format&fit=crop&q=80',
    assetIds: ['a2']
  },
  {
    id: 'sh002',
    shotCode: 'SH002',
    projectId: 'p1',
    sceneId: 'sc1',
    sceneCode: 'SC01',
    durationSec: 4,
    shotType: '特写 (Close Up)',
    cameraMovement: '固定镜头 (Static)',
    description: '逃生推进器仪表盘倒计时显示，红色指针跃至临界值。',
    currentStage: '视频生成',
    assigneeId: 'u3',
    status: '审核中',
    latestVersionId: 'v002_6',
    thumbnailUrl: 'https://images.unsplash.com/photo-1581092160607-ee22621dd758?w=600&auto=format&fit=crop&q=80',
    assetIds: ['a3']
  },
  {
    id: 'sh003',
    shotCode: 'SH003',
    projectId: 'p1',
    sceneId: 'sc2',
    sceneCode: 'SC02',
    durationSec: 7,
    shotType: '远景 (Extreme Long)',
    cameraMovement: '环绕航拍 (Orbit)',
    description: '过道被太空碎片撞击爆破，苟翱天向舱门绝地冲刺。',
    currentStage: '视频生成',
    assigneeId: 'u3',
    status: '制作中',
    latestVersionId: undefined,
    thumbnailUrl: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=600&auto=format&fit=crop&q=80',
    assetIds: ['a1', 'a2', 'a3']
  },
  {
    id: 'sh004',
    shotCode: 'SH004',
    projectId: 'p1',
    sceneId: 'sc2',
    sceneCode: 'SC02',
    durationSec: 3,
    shotType: '特写 (Close Up)',
    cameraMovement: '跟摇 (Tilt Up)',
    description: '苟翱天咬牙按下推进器启动阀，蓝色火焰爆出。',
    currentStage: '视频生成',
    assigneeId: 'u3',
    status: '已完成',
    thumbnailUrl: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=600&auto=format&fit=crop&q=80',
    assetIds: ['a1', 'a3']
  },
  {
    id: 'sh005',
    shotCode: 'SH005',
    projectId: 'p1',
    sceneId: 'sc3',
    sceneCode: 'SC03',
    durationSec: 8,
    shotType: '中景 (Medium)',
    cameraMovement: '缓拉镜头 (Pull Out)',
    description: '逃生舱成功脱离飞船爆炸圈，驶入黑暗深空。',
    currentStage: '视频生成',
    assigneeId: 'u1',
    status: '已锁定',
    thumbnailUrl: 'https://images.unsplash.com/photo-1518709268805-4e9042af9f23?w=600&auto=format&fit=crop&q=80',
    assetIds: ['a2', 'a3']
  }
];

export const mockTasks: Task[] = [
  {
    id: 't_sh010_video',
    title: 'SH010 - AI视频生成',
    entityType: 'shot',
    entityId: 'sh010',
    pipelineStage: '视频生成',
    assigneeId: 'u2',
    status: '待审核',
    priority: '高',
    dueDate: '2026-07-28',
    requirements: '需要保证苟翱天惊醒时人物转头平滑，烟雾气流有物理阻尼感，红光频闪节奏保持2Hz。',
    latestVersionId: 'v10_3',
    createdAt: '2026-07-25'
  },
  {
    id: 't_sh001_video',
    title: 'SH001 - AI视频生成',
    entityType: 'shot',
    entityId: 'sh001',
    pipelineStage: '视频生成',
    assigneeId: 'u2',
    status: '待审核',
    priority: '高',
    dueDate: '2026-07-28',
    requirements: '控制台仪表晃动镜头，电火花炸裂效果要自然。',
    latestVersionId: 'v001_3',
    createdAt: '2026-07-26'
  },
  {
    id: 't_sh002_video',
    title: 'SH002 - AI视频生成',
    entityType: 'shot',
    entityId: 'sh002',
    pipelineStage: '视频生成',
    assigneeId: 'u2',
    status: '待审核',
    priority: '中',
    dueDate: '2026-07-28',
    requirements: '推进器气压表特写，数字倒计时清晰。',
    latestVersionId: 'v002_6',
    createdAt: '2026-07-26'
  },
  {
    id: 't_a2_concept',
    title: 'NoMud主控舱室 - 概念美术改动',
    entityType: 'asset',
    entityId: 'a2',
    pipelineStage: '修改',
    assigneeId: 'u4',
    status: '修改中',
    priority: '高',
    dueDate: '2026-07-29',
    requirements: '根据导演意见，增加舱壁机械管线的铁锈与磨损质感。',
    latestVersionId: 'v_a2_12',
    createdAt: '2026-07-23'
  }
];

export const mockNotes: Note[] = [
  {
    id: 'n10_1',
    versionId: 'v10_3',
    reviewerId: 'u1',
    content: '人物转头速度在00:01.25处有些生硬，需要减慢约25%，另外00:03.10处的烟雾有轻微帧率跃动。',
    timestampSec: 1.25,
    timestampText: '00:01.25',
    isMandatory: true,
    status: '待处理',
    createdAt: '2026-07-27 17:15'
  },
  {
    id: 'n10_2',
    versionId: 'v10_3',
    reviewerId: 'u1',
    content: '背景中悬挂的尖叫鸡彩蛋效果非常好！保留这个视觉梗。',
    timestampSec: 3.10,
    timestampText: '00:03.10',
    isMandatory: false,
    status: '已解决',
    createdAt: '2026-07-27 17:18'
  },
  {
    id: 'n001_1',
    versionId: 'v001_3',
    reviewerId: 'u1',
    content: '仪表盘左上角火花光效稍微过曝，可适当拉低HDR亮度。',
    timestampSec: 2.50,
    timestampText: '00:02.50',
    isMandatory: true,
    status: '待处理',
    createdAt: '2026-07-27 18:00'
  }
];

export const mockReviewLists: ReviewList[] = [
  {
    id: 'rl1',
    projectId: 'p1',
    title: '7月28日导演全片视频精审单',
    date: '2026-07-28',
    versionIds: ['v10_3', 'v001_3', 'v002_6'],
    description: '针对SC01与SC03核心高潮镜头的视频生成质量集体汇审。',
    status: '审核中',
    roundNumber: 2,
    dueAt: '2026-07-29T10:00:00Z',
    createdBy: 'u2',
    submittedBy: 'u2',
    submittedAt: '2026-07-27T19:30:00Z',
    completedAt: null,
    participants: [
      { userId: 'u1', role: '审核人', hasCompleted: true, completedAt: '2026-07-28T09:10:00Z' },
      { userId: 'u4', role: '客户', hasCompleted: false, completedAt: null },
    ],
    createdAt: '2026-07-27 19:00'
  },
  {
    id: 'rl2',
    projectId: 'p1',
    title: '7月25日美术资产批准汇审',
    date: '2026-07-25',
    versionIds: ['v_a1_8'],
    description: '苟翱天角色定稿设计与三视图终审。',
    status: '已完成',
    roundNumber: 1,
    dueAt: '2026-07-26T10:00:00Z',
    createdBy: 'u1',
    submittedBy: 'u1',
    submittedAt: '2026-07-25T10:30:00Z',
    completedAt: '2026-07-25T18:00:00Z',
    participants: [
      { userId: 'u1', role: '审核人', hasCompleted: true, completedAt: '2026-07-25T17:00:00Z' },
    ],
    createdAt: '2026-07-25 10:00'
  }
];

export const mockFiles: ProjectFile[] = [
  {
    id: 'f1',
    name: 'SH010_Kling_4K_Review.mp4',
    fileType: 'review',
    extension: 'mp4',
    sizeMb: 42.5,
    url: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerBlazes.mp4',
    entityType: 'shot',
    entityId: 'sh010',
    entityCode: 'SH010',
    versionNumber: 'V003',
    uploadedAt: '2026-07-27 16:30',
    uploaderId: 'u2'
  },
  {
    id: 'f2',
    name: 'SH010_V003_Master_4K.exr',
    fileType: 'source',
    extension: 'exr',
    sizeMb: 1240.0,
    url: '#',
    nasPath: '\\\\NAS\\NOMUD\\EP01\\SC03\\SH010\\video\\v003\\SH010_4K_Master.exr',
    entityType: 'shot',
    entityId: 'sh010',
    entityCode: 'SH010',
    versionNumber: 'V003',
    uploadedAt: '2026-07-27 16:35',
    uploaderId: 'u2'
  },
  {
    id: 'f3',
    name: 'GouAotian_ModelSheet_V008.psd',
    fileType: 'source',
    extension: 'psd',
    sizeMb: 350.8,
    url: '#',
    nasPath: '\\\\NAS\\NOMUD\\ASSETS\\CHARACTERS\\GouAotian\\v008\\GouAotian_ModelSheet.psd',
    entityType: 'asset',
    entityId: 'a1',
    entityCode: '苟翱天',
    versionNumber: 'V008',
    uploadedAt: '2026-07-24 15:05',
    uploaderId: 'u4'
  },
  {
    id: 'f4',
    name: 'SH001_Hailuo_Review.mp4',
    fileType: 'review',
    extension: 'mp4',
    sizeMb: 38.2,
    url: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ElephantsDream.mp4',
    entityType: 'shot',
    entityId: 'sh001',
    entityCode: 'SH001',
    versionNumber: 'V003',
    uploadedAt: '2026-07-27 14:10',
    uploaderId: 'u2'
  }
];

export const mockChannels: DepartmentChannel[] = [
  {
    id: 'c_all',
    name: '全公司大堂沟通',
    department: '全公司',
    description: '全员项目公告、重要进度节点与跨部门事项交流',
    icon: 'Megaphone',
    unreadCount: 2
  },
  {
    id: 'c_directing',
    name: '导演主控室',
    department: '导演组',
    description: '苟总与各部门负责人审片、镜头叙事、表演指导交流',
    icon: 'Film',
    unreadCount: 0
  },
  {
    id: 'c_concept',
    name: '概念美术交流',
    department: '概念美术组',
    description: '角色造型、场景氛围、道具精美三视图与Midjourney提示词讨论',
    icon: 'Palette',
    unreadCount: 1
  },
  {
    id: 'c_aivideo',
    name: 'AI视频生成研发',
    department: 'AI视频生成组',
    description: '可灵 Kling 1.5、Runway Gen-3、Hailuo 生成质量与动态控制',
    icon: 'Sparkles',
    unreadCount: 3
  },
  {
    id: 'c_editing',
    name: '剪辑特效与声音',
    department: '剪辑特效组',
    description: '时间轴合成、音效渲染、视频帧率调优与色彩平差交流',
    icon: 'Scissors',
    unreadCount: 0
  }
];

export const mockChatMessages: ChatMessage[] = [
  {
    id: 'msg_1',
    channelId: 'c_aivideo',
    senderId: 'u2',
    content: '各位，针对镜头 #SH001 我用 Hailuo 跑了新的一版视频，大家看看重力失控后的漂浮质感怎样！',
    mediaType: 'video',
    mediaUrl: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ElephantsDream.mp4',
    mediaName: 'SH001_Hailuo_Test_V003.mp4',
    mediaSizeMb: 38.2,
    referencedEntity: {
      type: 'shot',
      id: 'sh001',
      code: 'SH001',
      title: '太空舱玻璃破裂'
    },
    createdAt: '2026-07-27 14:15',
    likes: ['u1', 'u3']
  },
  {
    id: 'msg_2',
    channelId: 'c_aivideo',
    senderId: 'u1',
    content: '整体灯光层次很好！但是 00:03 秒处，控制台右侧的物理碎片轨迹有些不自然，大家可以在图上帮我圈出批注一下，稍后跑可灵1.5重构下首尾帧。',
    mediaType: 'image',
    mediaUrl: 'https://images.unsplash.com/photo-1518709268805-4e9042af9f23?w=800&auto=format&fit=crop&q=80',
    mediaName: 'SH001_Keyframe_Frame3.png',
    mediaSizeMb: 4.5,
    referencedEntity: {
      type: 'shot',
      id: 'sh001',
      code: 'SH001',
      title: '太空舱玻璃破裂'
    },
    createdAt: '2026-07-27 14:22',
    likes: ['u2']
  },
  {
    id: 'msg_3',
    channelId: 'c_concept',
    senderId: 'u4',
    content: '资产 #a1 苟翱天的战服定稿参考图更新了！增加了胸前红外告警指示灯，请视频组制作时在 Prompt 强加上 `red glowing tactical chest light`。',
    mediaType: 'image',
    mediaUrl: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=800&auto=format&fit=crop&q=80',
    mediaName: 'GouAotian_TacticalSuit_Ref.png',
    mediaSizeMb: 6.1,
    referencedEntity: {
      type: 'asset',
      id: 'a1',
      code: '苟翱天',
      title: '男主角设定'
    },
    createdAt: '2026-07-27 15:10',
    likes: ['u1', 'u2', 'u3']
  },
  {
    id: 'msg_4',
    channelId: 'c_all',
    senderId: 'u1',
    content: '通知：7月28日下午16:00整将举行全片EP01粗剪视频集评会，请剪辑组和视频生成组提前将最终版本的视频上传至集评列表中！',
    mediaType: 'none',
    createdAt: '2026-07-27 16:00',
    likes: ['u2', 'u3', 'u4', 'u5']
  }
];
