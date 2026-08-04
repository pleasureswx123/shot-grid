import React, { useState, useRef } from 'react';
import { useApp } from '../../context/AppContext';
import {
  Play, Pause, Clock, CheckCircle2, XCircle, RotateCcw,
  Sparkles, Layers, Sliders, ChevronRight, Plus, Eye,
  Copy, FileVideo, MessageSquare
} from 'lucide-react';
import { Version, VersionStatus } from '../../types';
import { CanvasAnnotator } from '../common/CanvasAnnotator';

export const ReviewView: React.FC = () => {
  const {
    currentUser, reviewLists, selectedReviewListId, setSelectedReviewListId,
    versions, shots, notes, updateVersionStatus, addNote, createReviewList
  } = useApp();

  const currentPlaylist = reviewLists.find(rl => rl.id === selectedReviewListId) || reviewLists[0];
  const playlistVersions = versions.filter(v => currentPlaylist?.versionIds.includes(v.id)) ;
  const displayVersions = playlistVersions.length > 0 ? playlistVersions : versions.slice(0, 4);

  // Active version being reviewed
  const [activeVersionIndex, setActiveVersionIndex] = useState(0);
  const activeVersion = displayVersions[activeVersionIndex] || displayVersions[0];
  const activeShot = shots.find(s => s.id === activeVersion?.entityId);
  const activeNotes = notes.filter(n => n.versionId === activeVersion?.id);

  // Compare mode: 'single' | 'ab_compare'
  const [reviewMode, setReviewMode] = useState<'single' | 'ab_compare'>('single');
  const [compareVersionId, setCompareVersionId] = useState<string>(
    versions.find(v => v.entityId === activeVersion?.entityId && v.id !== activeVersion?.id)?.id || ''
  );
  const compareVersion = versions.find(v => v.id === compareVersionId);

  // Video playback
  const videoRef = useRef<HTMLVideoElement>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTimeSec, setCurrentTimeSec] = useState(0);
  const [showCanvasOverlay, setShowCanvasOverlay] = useState(true);

  // New Note state
  const [newNoteText, setNewNoteText] = useState('');
  const [isMandatory, setIsMandatory] = useState(true);
  const [lastAnnotationData, setLastAnnotationData] = useState<string | null>(null);

  // New Playlist Modal state
  const [showNewPlaylistModal, setShowNewPlaylistModal] = useState(false);
  const [newPlaylistTitle, setNewPlaylistTitle] = useState('');

  const togglePlay = () => {
    if (videoRef.current) {
      if (isPlaying) videoRef.current.pause();
      else videoRef.current.play();
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
    if (!newNoteText.trim() || !activeVersion) return;
    const timeSec = videoRef.current ? Math.round(videoRef.current.currentTime * 100) / 100 : 0;
    const mins = Math.floor(timeSec / 60);
    const secs = (timeSec % 60).toFixed(2);
    const timeStr = `00:${mins < 10 ? '0' : ''}${mins}:${secs.padStart(5, '0')}`;

    addNote({
      versionId: activeVersion.id,
      reviewerId: currentUser.id,
      content: newNoteText,
      timestampSec: timeSec,
      timestampText: timeStr,
      annotationDataUrl: lastAnnotationData || undefined,
      isMandatory,
      status: '待处理'
    });
    setNewNoteText('');
    setLastAnnotationData(null);
  };

  const handleCreatePlaylist = () => {
    if (!newPlaylistTitle.trim()) return;
    const allPendingVersionIds = versions.filter(v => v.status === '待审核').map(v => v.id);
    createReviewList(
      newPlaylistTitle,
      new Date().toISOString().split('T')[0],
      allPendingVersionIds.length > 0 ? allPendingVersionIds : [versions[0].id],
      '新建导演在线集中审核单'
    );
    setNewPlaylistTitle('');
    setShowNewPlaylistModal(false);
  };

  if (!activeVersion) {
    return (
      <div className="flex h-[calc(100vh-3.5rem)] flex-col items-center justify-center bg-slate-950 px-6 text-center text-slate-100">
        <div className="mb-4 rounded-2xl border border-slate-800 bg-slate-900 p-4">
          <FileVideo className="h-9 w-9 text-slate-600" />
        </div>
        <h2 className="text-base font-semibold">当前项目还没有审核版本</h2>
        <p className="mt-2 max-w-md text-xs leading-6 text-slate-500">
          新项目不会继承其他项目的镜头和版本。请先创建镜头并提交版本，之后即可在这里创建审核单。
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-[calc(100vh-3.5rem)] bg-slate-950 text-slate-100 overflow-hidden">
      {/* Top Bar: Playlist Selector & Mode Switch */}
      <div className="h-12 bg-slate-900 border-b border-slate-800 px-4 flex items-center justify-between shrink-0">
        <div className="flex items-center space-x-3">
          <span className="text-xs font-semibold text-slate-400">当前审核单:</span>
          <select
            value={selectedReviewListId || ''}
            onChange={e => setSelectedReviewListId(e.target.value)}
            className="bg-slate-800 border border-slate-700 rounded-lg px-3 py-1 text-xs text-slate-200 font-bold focus:outline-none focus:border-indigo-500"
          >
            {reviewLists.map(rl => (
              <option key={rl.id} value={rl.id}>
                {rl.title} ({rl.date})
              </option>
            ))}
          </select>

          <button
            onClick={() => setShowNewPlaylistModal(true)}
            className="px-2.5 py-1 bg-slate-800 hover:bg-slate-700 border border-slate-700 rounded text-xs text-slate-300 font-medium flex items-center space-x-1 transition"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>创建新审核单</span>
          </button>
        </div>

        {/* View Mode Switcher: Single Canvas vs A/B Compare */}
        <div className="flex items-center space-x-3">
          <div className="flex bg-slate-800 p-1 rounded-lg border border-slate-700 text-xs">
            <button
              onClick={() => setReviewMode('single')}
              className={`px-3 py-1 rounded font-semibold transition ${
                reviewMode === 'single' ? 'bg-indigo-600 text-white' : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              单屏画板批注
            </button>
            <button
              onClick={() => setReviewMode('ab_compare')}
              className={`px-3 py-1 rounded font-semibold transition ${
                reviewMode === 'ab_compare' ? 'bg-indigo-600 text-white' : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              A/B 侧边多版本对比
            </button>
          </div>
        </div>
      </div>

      {/* Main Review Area: Left Playlist, Center Player, Right Notes */}
      <div className="flex-1 flex overflow-hidden">
        {/* LEFT COLUMN: Pending Versions Playlist */}
        <div className="w-64 bg-slate-900/80 border-r border-slate-800 flex flex-col shrink-0 select-none">
          <div className="p-3 border-b border-slate-800 text-xs font-bold text-slate-400 uppercase tracking-wider flex items-center justify-between">
            <span>待审版本列表 ({displayVersions.length})</span>
            <span className="text-[10px] text-indigo-400 font-mono">ShotGrid Review</span>
          </div>

          <div className="flex-1 overflow-y-auto p-2 space-y-2">
            {displayVersions.map((v, idx) => {
              const shot = shots.find(s => s.id === v.entityId);
              const isSelected = idx === activeVersionIndex;

              return (
                <div
                  key={v.id}
                  onClick={() => setActiveVersionIndex(idx)}
                  className={`p-2.5 rounded-xl border transition cursor-pointer flex space-x-3 ${
                    isSelected
                      ? 'bg-indigo-600/20 border-indigo-500 text-white shadow-md'
                      : 'bg-slate-800/40 border-slate-800/80 hover:bg-slate-800/80 text-slate-300'
                  }`}
                >
                  <div className="relative w-16 h-12 rounded bg-black overflow-hidden flex-shrink-0">
                    <img src={v.thumbnailUrl} alt={v.versionNumber} className="w-full h-full object-cover" />
                    <span className="absolute bottom-1 right-1 px-1 py-0.2 bg-black/80 rounded text-[9px] font-bold text-indigo-300 font-mono">
                      {v.versionNumber}
                    </span>
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-indigo-300 font-mono">
                        {v.entityId.toUpperCase()}
                      </span>
                      <span className={`text-[10px] px-1.5 py-0.2 rounded font-semibold ${
                        v.status === '已通过' || v.status === '最终版'
                          ? 'bg-emerald-500/20 text-emerald-300'
                          : v.status === '已退回'
                          ? 'bg-rose-500/20 text-rose-300'
                          : 'bg-amber-500/20 text-amber-300'
                      }`}>
                        {v.status}
                      </span>
                    </div>
                    <p className="text-[10px] text-slate-400 line-clamp-1 mt-0.5">
                      {shot?.description || v.changelog}
                    </p>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* CENTER COLUMN: Video / Canvas Player */}
        <div className="flex-1 flex flex-col bg-slate-950 p-4 overflow-hidden relative">
          {reviewMode === 'single' ? (
            /* Single Canvas Mode */
            <div className="flex-1 relative bg-black rounded-xl border border-slate-800 overflow-hidden flex items-center justify-center">
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
              ) : (
                <img src={activeVersion?.fileUrl} alt="review" className="w-full h-full object-contain" />
              )}

              {/* Drawing Canvas Overlay */}
              {showCanvasOverlay && (
                <CanvasAnnotator
                  width={800}
                  height={450}
                  onSaveAnnotation={dataUrl => setLastAnnotationData(dataUrl)}
                  onClear={() => setLastAnnotationData(null)}
                />
              )}

              {/* Control Bar Overlay */}
              {activeVersion && activeVersion.fileType === 'video' && (
                <div className="absolute bottom-0 inset-x-0 p-3 bg-gradient-to-t from-black/95 via-black/60 to-transparent z-30 flex items-center justify-between text-xs font-mono">
                  <div className="flex items-center space-x-3">
                    <button onClick={togglePlay} className="p-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-full transition">
                      {isPlaying ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4 ml-0.5" />}
                    </button>
                    <span className="text-slate-200 font-bold">
                      {Math.floor(currentTimeSec / 60)}:{(currentTimeSec % 60).toFixed(2).padStart(5, '0')} / {activeShot?.durationSec || 6}s
                    </span>
                  </div>

                  <div className="flex items-center space-x-2">
                    <span className="text-[11px] text-slate-400">
                      模型: <strong className="text-emerald-300 font-normal">{activeVersion.aiParams?.modelName || 'Kling 1.5 Pro'}</strong>
                    </span>
                  </div>
                </div>
              )}
            </div>
          ) : (
            /* A/B Version Comparison Mode */
            <div className="flex-1 grid grid-cols-2 gap-4 overflow-hidden">
              {/* Left Screen (A: Current Version) */}
              <div className="bg-black rounded-xl border border-indigo-500/50 p-2 relative flex flex-col">
                <div className="text-xs font-mono text-indigo-300 mb-1 flex justify-between font-bold">
                  <span>版本 A (当前): {activeVersion?.versionNumber}</span>
                  <span>{activeVersion?.aiParams?.modelName}</span>
                </div>
                <div className="flex-1 relative rounded overflow-hidden">
                  <img src={activeVersion?.fileUrl || activeVersion?.thumbnailUrl} alt="A" className="w-full h-full object-contain" />
                </div>
              </div>

              {/* Right Screen (B: Comparison Version) */}
              <div className="bg-black rounded-xl border border-slate-800 p-2 relative flex flex-col">
                <div className="text-xs font-mono text-amber-300 mb-1 flex justify-between font-bold">
                  <span>版本 B (对比): {compareVersion?.versionNumber || '选择版本...'}</span>
                  <select
                    value={compareVersionId}
                    onChange={e => setCompareVersionId(e.target.value)}
                    className="bg-slate-800 border border-slate-700 text-[10px] text-slate-200 rounded px-2 py-0.5"
                  >
                    {versions.filter(v => v.id !== activeVersion?.id).map(v => (
                      <option key={v.id} value={v.id}>
                        {v.entityId.toUpperCase()} {v.versionNumber} ({v.createdAt})
                      </option>
                    ))}
                  </select>
                </div>
                <div className="flex-1 relative rounded overflow-hidden">
                  {compareVersion ? (
                    <img src={compareVersion.fileUrl || compareVersion.thumbnailUrl} alt="B" className="w-full h-full object-contain" />
                  ) : (
                    <div className="text-center py-20 text-slate-600 text-xs">请选择对比的历史版本</div>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>

        {/* RIGHT COLUMN: Review Notes & AI Prompt Details */}
        <div className="w-80 bg-slate-900/80 border-l border-slate-800 flex flex-col shrink-0 p-4 space-y-4 overflow-y-auto select-none">
          <div className="border-b border-slate-800 pb-2">
            <h3 className="text-sm font-bold text-white flex items-center space-x-2">
              <MessageSquare className="w-4 h-4 text-indigo-400" />
              <span>集评意见与时间点画板</span>
            </h3>
            <p className="text-[10px] text-slate-400 mt-0.5">
              点击时间点可直接将播放器定位至对应画面。
            </p>
          </div>

          {/* New Note Form */}
          <div className="space-y-2 bg-slate-800/40 p-3 rounded-xl border border-slate-800">
            <textarea
              value={newNoteText}
              onChange={e => setNewNoteText(e.target.value)}
              placeholder="输入审核意见 (画板标注将随意见自动保存)..."
              className="w-full bg-slate-900 border border-slate-800 rounded-lg p-2.5 text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-indigo-500 h-16 resize-none"
            />
            <div className="flex items-center justify-between">
              <label className="flex items-center space-x-1 text-[11px] text-slate-400 cursor-pointer">
                <input
                  type="checkbox"
                  checked={isMandatory}
                  onChange={e => setIsMandatory(e.target.checked)}
                  className="rounded bg-slate-900 text-indigo-600"
                />
                <span>必须修改</span>
              </label>
              <button
                onClick={handleAddNote}
                disabled={!newNoteText.trim()}
                className="px-3 py-1 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white text-xs font-semibold rounded transition"
              >
                打分批注
              </button>
            </div>
          </div>

          {/* Notes List */}
          <div className="space-y-2.5">
            {activeNotes.map(n => (
              <div key={n.id} className="p-3 bg-slate-800/60 rounded-xl border border-slate-700/60 space-y-1.5 text-xs">
                <div className="flex items-center justify-between">
                  <button
                    onClick={() => n.timestampSec !== undefined && jumpToTime(n.timestampSec)}
                    className="px-2 py-0.5 bg-indigo-600/30 hover:bg-indigo-600 text-indigo-300 hover:text-white rounded text-[10px] font-mono font-bold transition flex items-center space-x-1"
                  >
                    <Clock className="w-3 h-3" />
                    <span>{n.timestampText || '00:00.00'}</span>
                  </button>
                  <span className={`text-[10px] px-1.5 py-0.2 rounded font-semibold ${
                    n.isMandatory ? 'bg-rose-500/20 text-rose-300' : 'bg-slate-700 text-slate-400'
                  }`}>
                    {n.isMandatory ? '必须修改' : '建议'}
                  </span>
                </div>
                <p className="text-slate-200 leading-relaxed">{n.content}</p>
                <div className="text-[10px] text-slate-500 text-right">{n.createdAt}</div>
              </div>
            ))}
          </div>

          {/* AI Prompt Collapsible Details */}
          {activeVersion?.aiParams && (
            <div className="pt-3 border-t border-slate-800 space-y-1 text-xs">
              <span className="text-[10px] text-slate-500 font-semibold block">版本 AI 提示词</span>
              <p className="text-[11px] font-mono text-emerald-300 bg-black/60 p-2.5 rounded border border-slate-800 line-clamp-3 select-all">
                {activeVersion.aiParams.prompt}
              </p>
            </div>
          )}
        </div>
      </div>

      {/* Bottom Sticky Action Bar (The 4 core decision buttons explicitly defined in prompt Section III-5) */}
      {activeVersion && (
        <div className="h-14 bg-slate-900 border-t border-slate-800 px-6 flex items-center justify-between shrink-0">
          <div className="flex items-center space-x-3 text-xs font-mono">
            <span className="text-slate-400">镜头号:</span>
            <span className="text-indigo-400 font-bold">{activeVersion.entityId.toUpperCase()}</span>
            <span className="text-slate-500">•</span>
            <span className="text-slate-400">版本号:</span>
            <span className="text-emerald-400 font-bold">{activeVersion.versionNumber}</span>
          </div>

          <div className="flex items-center space-x-3">
            <button
              onClick={() => updateVersionStatus(activeVersion.id, '已退回')}
              className="px-4 py-2 bg-rose-600/20 hover:bg-rose-600 text-rose-300 hover:text-white border border-rose-500/30 rounded-lg text-xs font-bold transition flex items-center space-x-1.5"
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
              className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg text-xs font-bold transition flex items-center space-x-1.5 shadow-lg shadow-indigo-600/30"
            >
              <CheckCircle2 className="w-4 h-4" />
              <span>通过</span>
            </button>

            <button
              onClick={() => updateVersionStatus(activeVersion.id, '最终版')}
              className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-xs font-black transition flex items-center space-x-1.5 shadow-lg shadow-emerald-600/30"
            >
              <Sparkles className="w-4 h-4" />
              <span>设为最终版本</span>
            </button>
          </div>
        </div>
      )}

      {/* New Playlist Modal */}
      {showNewPlaylistModal && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-6 w-full max-w-md space-y-4 text-slate-100 shadow-2xl">
            <h3 className="text-sm font-bold text-white">创建集中审核单 (Review Playlist)</h3>
            <input
              type="text"
              placeholder="例如：7月28日导演全片视频精审"
              value={newPlaylistTitle}
              onChange={e => setNewPlaylistTitle(e.target.value)}
              className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-xs text-slate-200 focus:outline-none focus:border-indigo-500"
            />
            <div className="flex justify-end space-x-2 pt-2">
              <button
                onClick={() => setShowNewPlaylistModal(false)}
                className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded text-xs"
              >
                取消
              </button>
              <button
                onClick={handleCreatePlaylist}
                className="px-4 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded text-xs font-bold"
              >
                确认创建
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
