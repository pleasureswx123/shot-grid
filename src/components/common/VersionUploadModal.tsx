import React, { useState } from 'react';
import { useApp } from '../../context/AppContext';
import { X, Sparkles, Upload, FileVideo, FileImage, HardDrive } from 'lucide-react';
import { EntityType, Version } from '../../types';

interface VersionUploadModalProps {
  initialTaskId?: string;
  onClose: () => void;
}

export const VersionUploadModal: React.FC<VersionUploadModalProps> = ({ initialTaskId, onClose }) => {
  const { tasks, shots, assets, currentUser, addVersion } = useApp();

  const activeTask = tasks.find(t => t.id === initialTaskId) || tasks[0];
  
  const [taskId, setTaskId] = useState<string>(activeTask?.id || '');
  const selectedTask = tasks.find(t => t.id === taskId) || activeTask;

  const [versionNumber, setVersionNumber] = useState<string>('V003');
  const [fileType, setFileType] = useState<'video' | 'image'>('video');
  const [fileUrl, setFileUrl] = useState<string>('https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerBlazes.mp4');
  const [thumbnailUrl, setThumbnailUrl] = useState<string>('https://images.unsplash.com/photo-1518709268805-4e9042af9f23?w=600&auto=format&fit=crop&q=80');
  const [changelog, setChangelog] = useState<string>('修改了人物表情过渡与镜头光晕效果。');

  // AI Parameters
  const [modelName, setModelName] = useState<string>('Kling 1.5 Pro');
  const [prompt, setPrompt] = useState<string>('Cinematic shot, astronaut waking up inside dark spaceship pod, volumetric emergency red pulsing light --ar 2.39:1');
  const [seed, setSeed] = useState<string>('88491204');
  const [cameraMotion, setCameraMotion] = useState<string>('缓慢推进 (Push In)');
  const [generationCost, setGenerationCost] = useState<number>(12.5);
  const [nasPath, setNasPath] = useState<string>(`\\\\NAS\\\\NOMUD\\\\EP01\\\\SC03\\\\${selectedTask?.entityId || 'SH010'}\\\\video\\\\v003\\\\`);

  const sampleVideos = [
    { name: 'ForBiggerBlazes (科幻警报火焰)', url: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerBlazes.mp4', thumb: 'https://images.unsplash.com/photo-1518709268805-4e9042af9f23?w=600&auto=format&fit=crop&q=80' },
    { name: 'ElephantsDream (机器人舱室)', url: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ElephantsDream.mp4', thumb: 'https://images.unsplash.com/photo-1581092160607-ee22621dd758?w=600&auto=format&fit=crop&q=80' },
    { name: 'ForBiggerEscapes (宇宙奔跑)', url: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerEscapes.mp4', thumb: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=600&auto=format&fit=crop&q=80' }
  ];

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedTask) return;

    addVersion({
      taskId: selectedTask.id,
      entityType: selectedTask.entityType,
      entityId: selectedTask.entityId,
      versionNumber,
      fileUrl,
      fileType,
      thumbnailUrl,
      uploaderId: currentUser.id,
      changelog,
      status: '待审核',
      aiParams: {
        modelName,
        prompt,
        seed,
        cameraMotion,
        generationCost,
        nasPath,
        resolution: '3840x2160',
        aspectRatio: '2.39:1'
      }
    });

    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 w-full max-w-2xl text-slate-100 max-h-[90vh] overflow-y-auto shadow-2xl space-y-5">
        <div className="flex items-center justify-between border-b border-slate-800 pb-3">
          <div className="flex items-center space-x-2">
            <Sparkles className="w-5 h-5 text-indigo-400" />
            <h2 className="text-base font-bold text-white">提交新版本 (Submit Version)</h2>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-white p-1 rounded">
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4 text-xs">
          {/* Target Task */}
          <div className="space-y-1">
            <label className="text-slate-400 font-semibold">选择所属制作任务</label>
            <select
              value={taskId}
              onChange={e => setTaskId(e.target.value)}
              className="w-full bg-slate-800 border border-slate-700 rounded-lg p-2 text-xs text-slate-200 focus:outline-none focus:border-indigo-500"
            >
              {tasks.map(t => (
                <option key={t.id} value={t.id}>
                  [{t.entityType === 'project' ? '整片' : t.entityType === 'shot' ? '镜头' : '资产'}] {t.title} ({t.pipelineStage})
                </option>
              ))}
            </select>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1">
              <label className="text-slate-400 font-semibold">版本编号</label>
              <input
                type="text"
                value={versionNumber}
                onChange={e => setVersionNumber(e.target.value)}
                className="w-full bg-slate-800 border border-slate-700 rounded-lg p-2 text-xs text-slate-200 font-mono font-bold"
              />
            </div>

            <div className="space-y-1">
              <label className="text-slate-400 font-semibold">文件类型</label>
              <select
                value={fileType}
                onChange={e => setFileType(e.target.value as any)}
                className="w-full bg-slate-800 border border-slate-700 rounded-lg p-2 text-xs text-slate-200"
              >
                <option value="video">MP4 视频文件</option>
                <option value="image">PNG / JPG 图像文件</option>
              </select>
            </div>
          </div>

          {/* Quick Preset Media */}
          <div className="space-y-1.5">
            <label className="text-slate-400 font-semibold">使用高清试看媒体数据</label>
            <div className="grid grid-cols-3 gap-2">
              {sampleVideos.map((s, idx) => (
                <button
                  key={idx}
                  type="button"
                  onClick={() => {
                    setFileUrl(s.url);
                    setThumbnailUrl(s.thumb);
                  }}
                  className={`p-2 rounded-lg border text-left flex flex-col space-y-1 transition ${
                    fileUrl === s.url ? 'bg-indigo-600/20 border-indigo-500 text-white' : 'bg-slate-800/60 border-slate-700 text-slate-300'
                  }`}
                >
                  <img src={s.thumb} alt={s.name} className="w-full h-12 object-cover rounded" />
                  <span className="text-[10px] truncate">{s.name}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Changelog */}
          <div className="space-y-1">
            <label className="text-slate-400 font-semibold">本次修改说明 (Changelog)</label>
            <textarea
              value={changelog}
              onChange={e => setChangelog(e.target.value)}
              className="w-full bg-slate-800 border border-slate-700 rounded-lg p-2 text-xs text-slate-200 h-14 resize-none"
            />
          </div>

          {/* Collapsible AI Parameters */}
          <div className="bg-slate-800/40 p-4 rounded-xl border border-slate-800 space-y-3">
            <span className="font-bold text-indigo-300 text-xs block">AI 影视生成参数 (仅供内部/复现场景)</span>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-[10px] text-slate-500 block">生成算法模型</label>
                <select
                  value={modelName}
                  onChange={e => setModelName(e.target.value)}
                  className="w-full bg-slate-800 border border-slate-700 rounded p-1.5 text-xs text-slate-200 mt-0.5"
                >
                  <option value="Kling 1.5 Pro">可灵 Kling 1.5 Pro</option>
                  <option value="Runway Gen-3">Runway Gen-3 Alpha</option>
                  <option value="Midjourney V6">Midjourney V6 (静态首帧)</option>
                  <option value="Luma Dream Machine">Luma Dream Machine</option>
                  <option value="Hailuo MiniMax">海螺 MiniMax</option>
                </select>
              </div>

              <div>
                <label className="text-[10px] text-slate-500 block">Seed 随机种子</label>
                <input
                  type="text"
                  value={seed}
                  onChange={e => setSeed(e.target.value)}
                  className="w-full bg-slate-800 border border-slate-700 rounded p-1.5 text-xs text-slate-200 font-mono mt-0.5"
                />
              </div>
            </div>

            <div>
              <label className="text-[10px] text-slate-500 block">完整提示词 (Prompt)</label>
              <textarea
                value={prompt}
                onChange={e => setPrompt(e.target.value)}
                className="w-full bg-slate-800 border border-slate-700 rounded p-2 text-xs font-mono text-emerald-300 h-16 resize-none mt-0.5"
              />
            </div>

            <div>
              <label className="text-[10px] text-slate-500 block">NAS 远端源文件路径</label>
              <input
                type="text"
                value={nasPath}
                onChange={e => setNasPath(e.target.value)}
                className="w-full bg-slate-800 border border-slate-700 rounded p-1.5 text-xs font-mono text-slate-300 mt-0.5"
              />
            </div>
          </div>

          <div className="flex justify-end space-x-2 pt-2 border-t border-slate-800">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded text-xs font-semibold"
            >
              取消
            </button>
            <button
              type="submit"
              className="px-5 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded text-xs font-bold shadow-lg shadow-indigo-600/30"
            >
              提交版本审核
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
