import React, { useState, useRef } from 'react';
import { useApp } from '../../context/AppContext';
import {
  X, Play, Pause, Volume2, Sparkles, Check, XCircle, Clock,
  ChevronDown, ChevronUp, FileSpreadsheet, Plus, CornerDownRight,
  User, Film, Layers, Share2, Info, CheckCircle2, Copy
} from 'lucide-react';
import { Shot, Version, VersionStatus } from '../../types';

interface ShotDetailDrawerProps {
  shotId: string;
  onClose: () => void;
  onOpenNewVersion: (taskId?: string) => void;
}

export const ShotDetailDrawer: React.FC<ShotDetailDrawerProps> = ({ shotId, onClose, onOpenNewVersion }) => {
  const {
    currentUser, shots, scenes, assets, users, tasks, versions, notes,
    updateVersionStatus, addNote, updateTaskStatus
  } = useApp();

  const shot = shots.find(s => s.id === shotId);
  if (!shot) return null;

  const scene = scenes.find(sc => sc.id === shot.sceneId) || scenes.find(sc => sc.sceneCode === shot.sceneCode);
  const shotTasks = tasks.filter(t => t.entityId === shot.id);
  const shotVersions = versions.filter(v => v.entityId === shot.id);
  
  // Active version
  const [activeVersionId, setActiveVersionId] = useState<string>(
    shot.latestVersionId || shotVersions[0]?.id || ''
  );
  const activeVersion = versions.find(v => v.id === activeVersionId) || shotVersions[0];

  const versionNotes = notes.filter(n => n.versionId === activeVersion?.id);

  // Video player ref
  const videoRef = useRef<HTMLVideoElement>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTimeSec, setCurrentTimeSec] = useState(0);
  const [showAIParams, setShowAIParams] = useState(false);

  // New Note state
  const [newNoteContent, setNewNoteContent] = useState('');
  const [isMandatoryNote, setIsMandatoryNote] = useState(true);
  const [copiedPath, setCopiedPath] = useState(false);

  const shotAssets = assets.filter(a => shot.assetIds.includes(a.id));
  const assignee = users.find(u => u.id === shot.assigneeId);

  const togglePlay = () => {
    if (videoRef.current) {
      if (isPlaying) {
        videoRef.current.pause();
      } else {
        videoRef.current.play();
      }
      setIsPlaying(!isPlaying);
    }
  };

  const jumpToTime = (timeSec: number) => {
    if (videoRef.current) {
      videoRef.current.currentTime = timeSec;
      setCurrentTimeSec(timeSec);
      if (!isPlaying) {
        videoRef.current.play();
        setIsPlaying(true);
      }
    }
  };

  const handleAddNote = () => {
    if (!newNoteContent.trim() || !activeVersion) return;
    const timeSec = videoRef.current ? Math.round(videoRef.current.currentTime * 100) / 100 : 0;
    const mins = Math.floor(timeSec / 60);
    const secs = (timeSec % 60).toFixed(2);
    const timeStr = `00:${mins < 10 ? '0' : ''}${mins}:${secs.padStart(5, '0')}`;

    addNote({
      versionId: activeVersion.id,
      reviewerId: currentUser.id,
      content: newNoteContent,
      timestampSec: timeSec,
      timestampText: timeStr,
      isMandatory: isMandatoryNote,
      status: '待处理'
    });
    setNewNoteContent('');
  };

  const copyNasPath = (path?: string) => {
    if (!path) return;
    navigator.clipboard.writeText(path);
    setCopiedPath(true);
    setTimeout(() => setCopiedPath(false), 2000);
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex justify-end animate-fadeIn">
      <div className="w-full max-w-5xl bg-slate-900 border-l border-slate-800 h-full flex flex-col text-slate-100 overflow-hidden shadow-2xl">
        {/* Drawer Header */}
        <div className="h-14 px-6 border-b border-slate-800 flex items-center justify-between bg-slate-900/90">
          <div className="flex items-center space-x-3">
            <span className="text-lg font-black text-indigo-400 font-mono tracking-tight">{shot.shotCode}</span>
            <span className="text-sm font-bold text-slate-200 line-clamp-1">{shot.description}</span>
            <span className="px-2.5 py-0.5 text-xs bg-indigo-500/10 text-indigo-300 border border-indigo-500/20 rounded font-medium">
              状态：{shot.status}
            </span>
          </div>

          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Drawer Content Body */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {/* Top Section: Video Player & Shot Info */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Player Column (2 cols) */}
            <div className="lg:col-span-2 space-y-3">
              <div className="relative bg-black rounded-xl overflow-hidden border border-slate-800 shadow-xl aspect-video flex items-center justify-center group">
                {activeVersion && activeVersion.fileType === 'video' ? (
                  <video
                    ref={videoRef}
                    src={activeVersion.fileUrl}
                    poster={activeVersion.thumbnailUrl}
                    onTimeUpdate={() => {
                      if (videoRef.current) setCurrentTimeSec(videoRef.current.currentTime);
                    }}
                    className="w-full h-full object-contain"
                  />
                ) : activeVersion ? (
                  <img src={activeVersion.fileUrl} alt={shot.shotCode} className="w-full h-full object-contain" />
                ) : (
                  <div className="text-slate-500 text-xs flex flex-col items-center">
                    <Film className="w-10 h-10 mb-2 opacity-50" />
                    <span>暂无提交的版本画面</span>
                  </div>
                )}

                {/* Video Controls Overlay */}
                {activeVersion && activeVersion.fileType === 'video' && (
                  <div className="absolute bottom-0 inset-x-0 p-3 bg-gradient-to-t from-black/90 via-black/40 to-transparent opacity-90 transition flex items-center justify-between text-xs font-mono">
                    <div className="flex items-center space-x-3">
                      <button onClick={togglePlay} className="p-1.5 bg-indigo-600 text-white rounded-full hover:bg-indigo-500 transition">
                        {isPlaying ? <Pause className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5 ml-0.5" />}
                      </button>
                      <span className="text-slate-200">
                        {Math.floor(currentTimeSec / 60)}:{(currentTimeSec % 60).toFixed(2).padStart(5, '0')} / {shot.durationSec}s
                      </span>
                    </div>
                    {activeVersion.aiParams?.modelName && (
                      <span className="px-2 py-0.5 bg-slate-800/80 text-indigo-300 rounded border border-slate-700 text-[10px]">
                        AI: {activeVersion.aiParams.modelName}
                      </span>
                    )}
                  </div>
                )}
              </div>
            </div>

            {/* Right Info Column (1 col) */}
            <div className="bg-slate-800/40 border border-slate-800 rounded-xl p-4 space-y-3.5 text-xs">
              <h3 className="font-bold text-white text-sm border-b border-slate-800 pb-2 flex items-center justify-between">
                <span>镜头基础属性</span>
                <span className="text-[10px] text-slate-400 font-mono">ID: {shot.id}</span>
              </h3>

              <div className="grid grid-cols-2 gap-3 text-slate-300">
                <div>
                  <span className="text-slate-500 block text-[10px]">所属场次</span>
                  <span className="font-semibold">{shot.sceneCode} ({scene?.name || '未知'})</span>
                </div>
                <div>
                  <span className="text-slate-500 block text-[10px]">镜头时长</span>
                  <span className="font-semibold text-amber-400 font-mono">{shot.durationSec} 秒</span>
                </div>
                <div>
                  <span className="text-slate-500 block text-[10px]">景别 (Shot Type)</span>
                  <span className="font-semibold">{shot.shotType}</span>
                </div>
                <div>
                  <span className="text-slate-500 block text-[10px]">运镜 (Camera Motion)</span>
                  <span className="font-semibold">{shot.cameraMovement}</span>
                </div>
                <div>
                  <span className="text-slate-500 block text-[10px]">负责人</span>
                  <span className="font-semibold text-indigo-300">{assignee?.name || '未分配'}</span>
                </div>
                <div>
                  <span className="text-slate-500 block text-[10px]">当前环节</span>
                  <span className="font-semibold text-emerald-400 font-mono">{shot.currentStage}</span>
                </div>
              </div>

              {shot.dialogue && (
                <div className="pt-2 border-t border-slate-800">
                  <span className="text-slate-500 block text-[10px]">台词与表演</span>
                  <p className="text-slate-200 mt-1 italic bg-slate-900/60 p-2 rounded border border-slate-800">
                    "{shot.dialogue}"
                  </p>
                </div>
              )}

              {/* Asset tags */}
              <div className="pt-2 border-t border-slate-800 space-y-1.5">
                <span className="text-slate-500 block text-[10px]">关联资产 ({shotAssets.length})</span>
                <div className="flex flex-wrap gap-1.5">
                  {shotAssets.map(a => (
                    <span key={a.id} className="px-2 py-0.5 bg-slate-800 border border-slate-700 text-slate-300 rounded text-[10px]">
                      {a.category}: {a.name}
                    </span>
                  ))}
                </div>
              </div>
            </div>
          </div>

          {/* Middle Section: Versions Strip */}
          <div className="bg-slate-800/40 border border-slate-800 rounded-xl p-4 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <h3 className="font-bold text-white text-xs">历史迭代版本 (Versions)</h3>
                <span className="text-[10px] text-slate-400 font-mono">共 {shotVersions.length} 个版本</span>
              </div>
              <button
                onClick={() => onOpenNewVersion()}
                className="px-2.5 py-1 bg-indigo-600/80 hover:bg-indigo-600 text-white rounded text-xs font-semibold flex items-center space-x-1 transition"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>上传新版本</span>
              </button>
            </div>

            <div className="flex space-x-3 overflow-x-auto pb-1">
              {shotVersions.map(v => {
                const isActive = v.id === activeVersion?.id;
                return (
                  <button
                    key={v.id}
                    onClick={() => setActiveVersionId(v.id)}
                    className={`flex-shrink-0 w-36 bg-slate-900 rounded-lg p-2 border transition text-left space-y-1.5 ${
                      isActive
                        ? 'border-indigo-500 ring-1 ring-indigo-500/50 bg-slate-800'
                        : 'border-slate-800 hover:border-slate-700'
                    }`}
                  >
                    <div className="relative h-16 rounded overflow-hidden bg-black">
                      <img src={v.thumbnailUrl} alt={v.versionNumber} className="w-full h-full object-cover" />
                      <span className={`absolute top-1 left-1 px-1.5 py-0.2 rounded text-[10px] font-bold font-mono ${
                        v.status === '已通过' || v.status === '最终版'
                          ? 'bg-emerald-600 text-white'
                          : v.status === '已退回'
                          ? 'bg-rose-600 text-white'
                          : 'bg-indigo-600 text-white'
                      }`}>
                        {v.versionNumber}
                      </span>
                    </div>
                    <div className="flex items-center justify-between text-[10px]">
                      <span className="text-slate-300 font-medium truncate">{v.status}</span>
                      <span className="text-slate-500">{v.createdAt.split(' ')[0]}</span>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Bottom Grid: Production Info (Left) & Review Notes (Right) */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Left: Production Materials & AI Generation Params */}
            <div className="bg-slate-800/40 border border-slate-800 rounded-xl p-4 space-y-4">
              <h3 className="font-bold text-white text-xs flex items-center justify-between border-b border-slate-800 pb-2">
                <span className="flex items-center space-x-2">
                  <Sparkles className="w-4 h-4 text-indigo-400" />
                  <span>制作资料 & AI生成参数</span>
                </span>
                <span className="text-[10px] text-indigo-300 bg-indigo-500/10 px-2 py-0.5 rounded font-mono">
                  {activeVersion?.aiParams?.modelName || '默认生成'}
                </span>
              </h3>

              {/* Collapsible AI Parameters */}
              {activeVersion?.aiParams && (
                <div className="bg-slate-900 border border-slate-800 rounded-lg p-3 space-y-2.5 text-xs">
                  <div className="flex items-center justify-between cursor-pointer" onClick={() => setShowAIParams(!showAIParams)}>
                    <span className="font-semibold text-slate-200">AI模型与提示词细节</span>
                    {showAIParams ? <ChevronUp className="w-4 h-4 text-slate-400" /> : <ChevronDown className="w-4 h-4 text-slate-400" />}
                  </div>

                  <div className="space-y-2 pt-2 border-t border-slate-800">
                    <div>
                      <span className="text-[10px] text-slate-500 block">完整提示词 (Prompt)</span>
                      <p className="text-xs font-mono text-emerald-300 bg-black/50 p-2 rounded border border-slate-800 mt-0.5 select-all">
                        {activeVersion.aiParams.prompt}
                      </p>
                    </div>

                    <div className="grid grid-cols-2 gap-2 text-[11px]">
                      <div>
                        <span className="text-slate-500">模型版本:</span>{' '}
                        <span className="text-slate-200 font-mono">{activeVersion.aiParams.modelName}</span>
                      </div>
                      <div>
                        <span className="text-slate-500">Seed 随机种子:</span>{' '}
                        <span className="text-slate-200 font-mono">{activeVersion.aiParams.seed || 'N/A'}</span>
                      </div>
                      <div>
                        <span className="text-slate-500">分辨率:</span>{' '}
                        <span className="text-slate-200 font-mono">{activeVersion.aiParams.resolution || '3840x2160'}</span>
                      </div>
                      <div>
                        <span className="text-slate-500">生成费用:</span>{' '}
                        <span className="text-amber-400 font-mono">¥{activeVersion.aiParams.generationCost || '12.0'}</span>
                      </div>
                    </div>

                    {activeVersion.aiParams.nasPath && (
                      <div className="pt-2 border-t border-slate-800">
                        <span className="text-[10px] text-slate-500 block">NAS 源文件存储路径</span>
                        <div className="flex items-center justify-between bg-black/60 p-1.5 rounded font-mono text-[10px] text-slate-300 mt-0.5">
                          <span className="truncate mr-2">{activeVersion.aiParams.nasPath}</span>
                          <button
                            onClick={() => copyNasPath(activeVersion.aiParams?.nasPath)}
                            className="px-2 py-0.5 bg-slate-800 hover:bg-slate-700 rounded text-indigo-300 transition flex-shrink-0"
                          >
                            {copiedPath ? '已复制' : '复制路径'}
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Shot Script Description */}
              <div className="space-y-1">
                <span className="text-[10px] text-slate-500 uppercase tracking-wider font-semibold">台本镜头描述</span>
                <p className="text-xs text-slate-200 leading-relaxed bg-slate-900 p-3 rounded-lg border border-slate-800">
                  {shot.description}
                </p>
              </div>
            </div>

            {/* Right: Review Notes & Timestamp Comments */}
            <div className="bg-slate-800/40 border border-slate-800 rounded-xl p-4 space-y-4">
              <h3 className="font-bold text-white text-xs flex items-center justify-between border-b border-slate-800 pb-2">
                <span>审核批注意见 ({versionNotes.length})</span>
                <span className="text-[10px] text-slate-400">点击时间点可直接跳帧</span>
              </h3>

              {/* Note Input Box */}
              <div className="space-y-2">
                <textarea
                  value={newNoteContent}
                  onChange={e => setNewNoteContent(e.target.value)}
                  placeholder="在此输入精准审核意见 (自动关联当前视频时间点)..."
                  className="w-full bg-slate-900 border border-slate-800 rounded-lg p-2.5 text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-indigo-500 h-16 resize-none"
                />
                <div className="flex items-center justify-between">
                  <label className="flex items-center space-x-1.5 text-xs text-slate-400 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={isMandatoryNote}
                      onChange={e => setIsMandatoryNote(e.target.checked)}
                      className="rounded bg-slate-900 border-slate-700 text-indigo-600"
                    />
                    <span>必须修改 (Mandatory)</span>
                  </label>
                  <button
                    onClick={handleAddNote}
                    disabled={!newNoteContent.trim()}
                    className="px-3 py-1 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white text-xs font-semibold rounded transition"
                  >
                    发送意见
                  </button>
                </div>
              </div>

              {/* Notes List */}
              <div className="space-y-2.5 max-h-56 overflow-y-auto pr-1">
                {versionNotes.length === 0 ? (
                  <div className="text-center py-6 text-slate-500 text-xs">暂无审核意见，画面质量达标。</div>
                ) : (
                  versionNotes.map(note => (
                    <div key={note.id} className="p-2.5 bg-slate-900 rounded-lg border border-slate-800 space-y-1 text-xs">
                      <div className="flex items-center justify-between">
                        <button
                          onClick={() => note.timestampSec !== undefined && jumpToTime(note.timestampSec)}
                          className="px-2 py-0.5 bg-indigo-600/30 hover:bg-indigo-600 text-indigo-300 hover:text-white rounded text-[10px] font-mono font-bold transition flex items-center space-x-1"
                        >
                          <Clock className="w-3 h-3" />
                          <span>{note.timestampText || '00:00.00'}</span>
                        </button>
                        <span className={`text-[10px] px-1.5 py-0.2 rounded font-semibold ${
                          note.isMandatory ? 'bg-rose-500/20 text-rose-300' : 'bg-slate-800 text-slate-400'
                        }`}>
                          {note.isMandatory ? '必须修改' : '建议'}
                        </span>
                      </div>
                      <p className="text-slate-200 mt-1">{note.content}</p>
                      <div className="text-[10px] text-slate-500 text-right">{note.createdAt}</div>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Drawer Bottom Action Bar (The 4 core decision buttons as explicitly defined) */}
        {activeVersion && (
          <div className="h-16 px-6 bg-slate-900 border-t border-slate-800 flex items-center justify-between sticky bottom-0 z-10">
            <div className="text-xs text-slate-400 font-mono">
              当前审核版本: <span className="text-indigo-400 font-bold">{activeVersion.versionNumber}</span> ({activeVersion.status})
            </div>

            <div className="flex items-center space-x-3">
              <button
                onClick={() => updateVersionStatus(activeVersion.id, '已退回')}
                className="px-4 py-2 bg-rose-600/20 hover:bg-rose-600 text-rose-300 hover:text-white border border-rose-500/30 rounded-lg text-xs font-semibold transition flex items-center space-x-1.5"
              >
                <XCircle className="w-4 h-4" />
                <span>退回修改</span>
              </button>

              <button
                onClick={() => updateVersionStatus(activeVersion.id, '待审核')}
                className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 rounded-lg text-xs font-semibold transition"
              >
                稍后决定
              </button>

              <button
                onClick={() => updateVersionStatus(activeVersion.id, '已通过')}
                className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg text-xs font-semibold transition flex items-center space-x-1.5 shadow-lg shadow-indigo-600/30"
              >
                <Check className="w-4 h-4" />
                <span>通过审核</span>
              </button>

              <button
                onClick={() => updateVersionStatus(activeVersion.id, '最终版')}
                className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-xs font-bold transition flex items-center space-x-1.5 shadow-lg shadow-emerald-600/30"
              >
                <CheckCircle2 className="w-4 h-4" />
                <span>设为最终版本</span>
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
