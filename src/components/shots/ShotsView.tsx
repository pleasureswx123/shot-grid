import React, { useState, useMemo } from 'react';
import { useApp } from '../../context/AppContext';
import {
  Table as TableIcon, LayoutGrid, Film, Plus, FileSpreadsheet, Download,
  Search, Filter, ChevronRight, Eye, Sparkles, User, Layers, Trash2, Pencil, X
} from 'lucide-react';
import { Shot, ShotStatus } from '../../types';
import { ShotDetailDrawer } from './ShotDetailDrawer';
import * as XLSX from 'xlsx';

interface ShotsViewProps {
  onOpenNewShot: () => void;
  onOpenImportExcel: () => void;
  onOpenNewVersion: (taskId?: string) => void;
}

export const ShotsView: React.FC<ShotsViewProps> = ({
  onOpenNewShot,
  onOpenImportExcel,
  onOpenNewVersion
}) => {
  const {
    currentUser, shots, scenes, assets, users, tasks, versions,
    selectedShotId, setSelectedShotId, updateShots, deleteShot, deleteShots
  } = useApp();
  const canManageShots = currentUser.role === 'admin' || currentUser.role === 'director';

  // Filters state
  const [selectedSceneCode, setSelectedSceneCode] = useState<string>('ALL');
  const [selectedStatus, setSelectedStatus] = useState<string>('ALL');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [selectedShotIds, setSelectedShotIds] = useState<string[]>([]);
  const [showBulkEdit, setShowBulkEdit] = useState(false);
  const [bulkSceneCode, setBulkSceneCode] = useState('');
  const [bulkAssigneeId, setBulkAssigneeId] = useState('');
  
  // View mode: 'table' | 'card' | 'storyboard'
  const [viewMode, setViewMode] = useState<'table' | 'card' | 'storyboard'>('table');

  // Filtered Shots
  const filteredShots = useMemo(() => {
    return shots.filter(s => {
      const matchScene = selectedSceneCode === 'ALL' || s.sceneCode === selectedSceneCode;
      const matchStatus = selectedStatus === 'ALL' || s.status === selectedStatus;
      const matchSearch = searchQuery.trim() === '' ||
        s.shotCode.toLowerCase().includes(searchQuery.toLowerCase()) ||
        s.description.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (s.dialogue && s.dialogue.toLowerCase().includes(searchQuery.toLowerCase()));
      return matchScene && matchStatus && matchSearch;
    });
  }, [shots, selectedSceneCode, selectedStatus, searchQuery]);
  const selectedShotIdSet = useMemo(() => new Set(selectedShotIds), [selectedShotIds]);
  const allFilteredSelected = filteredShots.length > 0 &&
    filteredShots.every(shot => selectedShotIdSet.has(shot.id));

  // Status Badge Component
  const getStatusBadge = (status: ShotStatus) => {
    switch (status) {
      case '未开始': return <span className="px-2 py-0.5 text-[11px] bg-slate-800 text-slate-400 rounded">未开始</span>;
      case '制作中': return <span className="px-2 py-0.5 text-[11px] bg-blue-500/10 text-blue-400 border border-blue-500/20 rounded font-medium">制作中</span>;
      case '审核中': return <span className="px-2 py-0.5 text-[11px] bg-amber-500/10 text-amber-400 border border-amber-500/20 rounded font-semibold animate-pulse">审核中</span>;
      case '已完成': return <span className="px-2 py-0.5 text-[11px] bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 rounded font-medium">已完成</span>;
      case '已锁定': return <span className="px-2 py-0.5 text-[11px] bg-purple-500/10 text-purple-400 border border-purple-500/20 rounded font-bold">已锁定</span>;
    }
  };

  // Export to Excel / CSV
  const handleExportShots = () => {
    const exportData = filteredShots.map(s => {
      const assignee = users.find(u => u.id === s.assigneeId);
      const latestVer = versions.find(v => v.id === s.latestVersionId);
      return {
        '镜头编号': s.shotCode,
        '场次': s.sceneCode,
        '时长(秒)': s.durationSec,
        '景别': s.shotType,
        '运镜': s.cameraMovement,
        '当前环节': s.currentStage,
        '负责人': assignee?.name || '',
        '状态': s.status,
        '最新版本': latestVer?.versionNumber || '无',
        '镜头描述': s.description,
        '台词': s.dialogue || ''
      };
    });

    const worksheet = XLSX.utils.json_to_sheet(exportData);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, '镜头列表');
    XLSX.writeFile(workbook, `AI影视镜头表_${new Date().toISOString().split('T')[0]}.xlsx`);
  };

  const handleDeleteShot = (shot: Shot, event: React.MouseEvent) => {
    event.stopPropagation();
    const relatedTasks = tasks.filter(task =>
      task.entityType === 'shot' && task.entityId === shot.id
    ).length;
    const relatedVersions = versions.filter(version =>
      version.entityType === 'shot' && version.entityId === shot.id
    ).length;
    const confirmed = window.confirm(
      `确定删除镜头 ${shot.shotCode}？\n\n` +
      `将影响 ${relatedTasks} 个任务、${relatedVersions} 个版本及相关审核记录。\n` +
      '删除后会进入回收站，可由管理员恢复。',
    );
    if (confirmed) {
      deleteShot(shot.id);
      setSelectedShotIds(previous => previous.filter(id => id !== shot.id));
    }
  };

  const toggleShotSelection = (shotId: string) => {
    setSelectedShotIds(previous =>
      previous.includes(shotId)
        ? previous.filter(id => id !== shotId)
        : [...previous, shotId]
    );
  };

  const toggleAllFilteredShots = () => {
    const filteredIds = new Set(filteredShots.map(shot => shot.id));
    setSelectedShotIds(previous => {
      if (allFilteredSelected) return previous.filter(id => !filteredIds.has(id));
      return Array.from(new Set([...previous, ...filteredIds]));
    });
  };

  const handleBulkDelete = () => {
    const selectedIds = new Set(selectedShotIds);
    const relatedTasks = tasks.filter(task =>
      task.entityType === 'shot' && selectedIds.has(task.entityId)
    ).length;
    const relatedVersions = versions.filter(version =>
      version.entityType === 'shot' && selectedIds.has(version.entityId)
    ).length;
    const confirmed = window.confirm(
      `确定删除选中的 ${selectedIds.size} 个镜头？\n\n` +
      `将影响 ${relatedTasks} 个任务、${relatedVersions} 个版本及相关审核记录。\n` +
      '删除后会进入回收站，可由管理员恢复。',
    );
    if (!confirmed) return;
    deleteShots(selectedShotIds);
    setSelectedShotIds([]);
  };

  const applyBulkEdit = () => {
    const updates: Partial<Pick<Shot, 'sceneCode' | 'assigneeId'>> = {};
    if (bulkSceneCode.trim()) updates.sceneCode = bulkSceneCode.trim();
    if (bulkAssigneeId) updates.assigneeId = bulkAssigneeId;
    if (!Object.keys(updates).length) return;

    updateShots(selectedShotIds, updates);
    setSelectedShotIds([]);
    setShowBulkEdit(false);
    setBulkSceneCode('');
    setBulkAssigneeId('');
  };

  return (
    <div className="p-6 space-y-6 max-w-7xl mx-auto text-slate-100">
      {/* Top Filter & Toolbar */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-slate-900 border border-slate-800 rounded-xl p-4">
        {/* Left Filter Group */}
        <div className="flex flex-wrap items-center gap-3">
          {/* Search Box */}
          <div className="relative w-56">
            <Search className="w-3.5 h-3.5 absolute left-3 top-2.5 text-slate-400" />
            <input
              type="text"
              placeholder="搜索镜头号/描述/台词..."
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              className="w-full bg-slate-800 border border-slate-700 rounded-lg pl-8 pr-3 py-1.5 text-xs text-slate-200 focus:outline-none focus:border-indigo-500"
            />
          </div>

          {/* Scene Filter */}
          <div className="flex items-center space-x-1.5 text-xs">
            <span className="text-slate-400">场次:</span>
            <select
              value={selectedSceneCode}
              onChange={e => setSelectedSceneCode(e.target.value)}
              className="bg-slate-800 border border-slate-700 rounded-lg px-2.5 py-1.5 text-xs text-slate-200 focus:outline-none focus:border-indigo-500"
            >
              <option value="ALL">全部场次 ({scenes.length})</option>
              {scenes.map(sc => (
                <option key={sc.id} value={sc.sceneCode}>
                  {sc.sceneCode} - {sc.name}
                </option>
              ))}
            </select>
          </div>

          {/* Status Filter */}
          <div className="flex items-center space-x-1.5 text-xs">
            <span className="text-slate-400">状态:</span>
            <select
              value={selectedStatus}
              onChange={e => setSelectedStatus(e.target.value)}
              className="bg-slate-800 border border-slate-700 rounded-lg px-2.5 py-1.5 text-xs text-slate-200 focus:outline-none focus:border-indigo-500"
            >
              <option value="ALL">全部状态</option>
              <option value="未开始">未开始</option>
              <option value="制作中">制作中</option>
              <option value="审核中">审核中</option>
              <option value="已完成">已完成</option>
              <option value="已锁定">已锁定</option>
            </select>
          </div>
        </div>

        {/* Right Toolbar: View Modes & Import/Export */}
        <div className="flex items-center space-x-3">
          {/* 3 View Mode Switches */}
          <div className="flex bg-slate-800 p-1 rounded-lg border border-slate-700">
            <button
              onClick={() => setViewMode('table')}
              className={`px-2.5 py-1 rounded text-xs font-semibold flex items-center space-x-1 transition ${
                viewMode === 'table' ? 'bg-indigo-600 text-white' : 'text-slate-400 hover:text-slate-200'
              }`}
              title="表格模式 (适合总监/制片)"
            >
              <TableIcon className="w-3.5 h-3.5" />
              <span>表格</span>
            </button>
            <button
              onClick={() => setViewMode('card')}
              className={`px-2.5 py-1 rounded text-xs font-semibold flex items-center space-x-1 transition ${
                viewMode === 'card' ? 'bg-indigo-600 text-white' : 'text-slate-400 hover:text-slate-200'
              }`}
              title="卡片模式 (适合美术/视频生成)"
            >
              <LayoutGrid className="w-3.5 h-3.5" />
              <span>卡片</span>
            </button>
            <button
              onClick={() => setViewMode('storyboard')}
              className={`px-2.5 py-1 rounded text-xs font-semibold flex items-center space-x-1 transition ${
                viewMode === 'storyboard' ? 'bg-indigo-600 text-white' : 'text-slate-400 hover:text-slate-200'
              }`}
              title="故事板模式 (按照成片顺序)"
            >
              <Film className="w-3.5 h-3.5" />
              <span>故事板</span>
            </button>
          </div>

          <div className="h-4 w-px bg-slate-800" />

          {/* Import / Export / Add buttons */}
          <button
            onClick={onOpenImportExcel}
            className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 rounded-lg text-xs font-medium flex items-center space-x-1.5 transition"
          >
            <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-400" />
            <span>导入台本/镜头表</span>
          </button>

          <button
            onClick={handleExportShots}
            className="p-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 rounded-lg text-xs transition"
            title="导出为Excel"
          >
            <Download className="w-4 h-4" />
          </button>

          <button
            onClick={onOpenNewShot}
            className="px-3.5 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg text-xs font-semibold flex items-center space-x-1.5 shadow-md shadow-indigo-600/30 transition"
          >
            <Plus className="w-4 h-4" />
            <span>新建镜头</span>
          </button>
        </div>
      </div>

      {canManageShots && selectedShotIds.length > 0 && (
        <div className="flex flex-col gap-3 rounded-xl border border-indigo-500/30 bg-indigo-500/10 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-3 text-xs">
            <span className="font-semibold text-indigo-200">已选择 {selectedShotIds.length} 个镜头</span>
            <button
              onClick={() => setSelectedShotIds([])}
              className="text-slate-400 hover:text-white"
            >
              清除选择
            </button>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setShowBulkEdit(true)}
              className="inline-flex items-center gap-1.5 rounded-lg bg-indigo-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-indigo-500"
            >
              <Pencil className="h-3.5 w-3.5" />
              批量编辑
            </button>
            <button
              onClick={handleBulkDelete}
              className="inline-flex items-center gap-1.5 rounded-lg border border-rose-500/30 bg-rose-500/15 px-3 py-1.5 text-xs font-semibold text-rose-300 hover:bg-rose-600 hover:text-white"
            >
              <Trash2 className="h-3.5 w-3.5" />
              批量删除
            </button>
          </div>
        </div>
      )}

      {/* VIEW MODE 1: Table Mode */}
      {viewMode === 'table' && (
        <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden shadow-lg">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="border-b border-slate-800 bg-slate-800/50 text-slate-400 font-semibold uppercase tracking-wider py-3">
                  {canManageShots && (
                    <th className="w-10 p-3 pl-4">
                      <input
                        type="checkbox"
                        checked={allFilteredSelected}
                        onChange={toggleAllFilteredShots}
                        aria-label="选择当前筛选结果中的全部镜头"
                        className="h-3.5 w-3.5 rounded border-slate-600 bg-slate-800 text-indigo-600"
                      />
                    </th>
                  )}
                  <th className="p-3 pl-4">镜头ID</th>
                  <th className="p-3">画面画面预览</th>
                  <th className="p-3">场次</th>
                  <th className="p-3">时长</th>
                  <th className="p-3">景别/运镜</th>
                  <th className="p-3">当前环节</th>
                  <th className="p-3">负责人</th>
                  <th className="p-3">状态</th>
                  <th className="p-3">最新版本</th>
                  <th className="p-3">包含资产</th>
                  <th className="p-3 text-right pr-4">操作</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60">
                {filteredShots.map(s => {
                  const assignee = users.find(u => u.id === s.assigneeId);
                  const latestVer = versions.find(v => v.id === s.latestVersionId);
                  const shotAssetsList = assets.filter(a => s.assetIds.includes(a.id));

                  return (
                    <tr
                      key={s.id}
                      className={`transition group ${
                        selectedShotIdSet.has(s.id)
                          ? 'bg-indigo-500/10'
                          : 'hover:bg-slate-800/50'
                      }`}
                    >
                      {canManageShots && (
                        <td className="p-3 pl-4">
                          <input
                            type="checkbox"
                            checked={selectedShotIdSet.has(s.id)}
                            onChange={() => toggleShotSelection(s.id)}
                            aria-label={`选择 ${s.shotCode}`}
                            className="h-3.5 w-3.5 rounded border-slate-600 bg-slate-800 text-indigo-600"
                          />
                        </td>
                      )}
                      <td className="p-3 pl-4 font-bold text-indigo-300 font-mono text-sm">
                        {s.shotCode}
                      </td>
                      <td className="p-3">
                        <div className="relative w-20 h-12 bg-black rounded border border-slate-700 overflow-hidden">
                          <img src={s.thumbnailUrl} alt={s.shotCode} className="w-full h-full object-cover group-hover:scale-105 transition" />
                        </div>
                      </td>
                      <td className="p-3 font-semibold text-slate-300 font-mono">{s.sceneCode}</td>
                      <td className="p-3 font-mono text-amber-400 font-bold">{s.durationSec}s</td>
                      <td className="p-3 text-slate-300">
                        <div>{s.shotType}</div>
                        <div className="text-[10px] text-slate-500">{s.cameraMovement}</div>
                      </td>
                      <td className="p-3 font-mono text-indigo-300">{s.currentStage}</td>
                      <td className="p-3 text-slate-300">{assignee?.name || '未分配'}</td>
                      <td className="p-3">{getStatusBadge(s.status)}</td>
                      <td className="p-3">
                        {latestVer ? (
                          <span className="px-2 py-0.5 bg-indigo-500/20 text-indigo-300 border border-indigo-500/30 rounded font-mono font-bold text-[11px]">
                            {latestVer.versionNumber}
                          </span>
                        ) : (
                          <span className="text-slate-600 text-[11px]">暂无提交</span>
                        )}
                      </td>
                      <td className="p-3">
                        <div className="flex -space-x-1.5 overflow-hidden">
                          {shotAssetsList.map(a => (
                            <img
                              key={a.id}
                              src={a.thumbnailUrl}
                              alt={a.name}
                              title={`${a.category}: ${a.name}`}
                              className="inline-block h-6 w-6 rounded-full ring-2 ring-slate-900 object-cover"
                            />
                          ))}
                        </div>
                      </td>
                      <td className="p-3 text-right pr-4">
                        <div className="inline-flex items-center gap-1">
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              setSelectedShotId(s.id);
                            }}
                            className="px-2.5 py-1 bg-slate-800 hover:bg-indigo-600 text-slate-200 hover:text-white rounded transition text-[11px] font-medium"
                          >
                            打开详情
                          </button>
                          {canManageShots && (
                            <button
                              onClick={(event) => handleDeleteShot(s, event)}
                              title={`删除 ${s.shotCode}`}
                              aria-label={`删除 ${s.shotCode}`}
                              className="rounded p-1.5 text-slate-500 transition hover:bg-rose-500/15 hover:text-rose-300"
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* VIEW MODE 2: Card Mode */}
      {viewMode === 'card' && (
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
          {filteredShots.map(s => {
            const assignee = users.find(u => u.id === s.assigneeId);
            const latestVer = versions.find(v => v.id === s.latestVersionId);

            return (
              <div
                key={s.id}
                className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden hover:border-indigo-500/60 transition shadow-lg group space-y-2.5 p-3"
              >
                <div className="relative aspect-video rounded-lg overflow-hidden bg-black">
                  <img src={s.thumbnailUrl} alt={s.shotCode} className="w-full h-full object-cover group-hover:scale-105 transition" />
                  <div className="absolute top-2 left-2 px-2 py-0.5 bg-black/80 backdrop-blur-md rounded text-xs font-bold text-indigo-300 font-mono border border-slate-700">
                    {s.shotCode}
                  </div>
                  <div className="absolute top-2 right-2">
                    {getStatusBadge(s.status)}
                  </div>
                  <div className="absolute bottom-2 right-2 px-2 py-0.5 bg-black/80 rounded text-[10px] text-amber-400 font-mono font-bold">
                    {s.durationSec}s
                  </div>
                </div>

                <div className="space-y-1">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-semibold text-slate-300">{s.sceneCode} • {s.shotType}</span>
                    {latestVer && (
                      <span className="text-[10px] bg-indigo-600/30 text-indigo-300 px-1.5 py-0.2 rounded font-mono font-bold">
                        {latestVer.versionNumber}
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-slate-400 line-clamp-2 leading-relaxed">{s.description}</p>
                </div>

                <div className="pt-2 border-t border-slate-800 flex items-center justify-between text-[11px] text-slate-400">
                  <span>负责人: {assignee?.name || '未分配'}</span>
                  <div className="flex items-center gap-2">
                    <span className="text-indigo-400 font-mono">{s.currentStage}</span>
                    <button
                      onClick={() => setSelectedShotId(s.id)}
                      className="rounded bg-slate-800 px-2 py-1 text-[10px] font-medium text-slate-200 hover:bg-indigo-600 hover:text-white"
                    >
                      打开详情
                    </button>
                    {canManageShots && (
                      <button
                        onClick={(event) => handleDeleteShot(s, event)}
                        title={`删除 ${s.shotCode}`}
                        aria-label={`删除 ${s.shotCode}`}
                        className="rounded p-1 text-slate-600 transition hover:bg-rose-500/15 hover:text-rose-300"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* VIEW MODE 3: Storyboard Mode */}
      {viewMode === 'storyboard' && (
        <div className="space-y-6">
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 text-xs text-slate-300 flex items-center justify-between font-mono">
            <span>成片故事板展示 (共 {filteredShots.length} 镜头)</span>
            <span className="text-amber-400 font-bold">
              总时长: {filteredShots.reduce((acc, curr) => acc + curr.durationSec, 0)} 秒
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredShots.map((s, idx) => (
              <div
                key={s.id}
                className="bg-slate-900 border border-slate-800 rounded-xl p-4 space-y-3 hover:border-indigo-500/50 transition"
              >
                <div className="flex items-center justify-between text-xs font-mono">
                  <span className="text-slate-500 font-bold">#{idx + 1}</span>
                  <span className="text-indigo-400 font-bold">{s.shotCode}</span>
                  <div className="flex items-center gap-2">
                    <span className="text-amber-400">{s.durationSec}s</span>
                    {canManageShots && (
                      <button
                        onClick={(event) => handleDeleteShot(s, event)}
                        title={`删除 ${s.shotCode}`}
                        aria-label={`删除 ${s.shotCode}`}
                        className="rounded p-1 text-slate-600 transition hover:bg-rose-500/15 hover:text-rose-300"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    )}
                  </div>
                </div>

                <div className="relative aspect-video rounded-lg overflow-hidden bg-black">
                  <img src={s.thumbnailUrl} alt={s.shotCode} className="w-full h-full object-cover" />
                  <div className="absolute bottom-2 left-2 px-2 py-0.5 bg-black/80 rounded text-[10px] text-slate-300 font-mono">
                    {s.cameraMovement}
                  </div>
                </div>

                <div className="space-y-1 text-xs">
                  <p className="text-slate-200 line-clamp-2">{s.description}</p>
                  {s.dialogue && (
                    <p className="text-indigo-300 text-[11px] italic">"{s.dialogue}"</p>
                  )}
                </div>
                <div className="flex justify-end border-t border-slate-800 pt-3">
                  <button
                    onClick={() => setSelectedShotId(s.id)}
                    className="rounded bg-slate-800 px-2.5 py-1 text-[11px] font-medium text-slate-200 hover:bg-indigo-600 hover:text-white"
                  >
                    打开详情
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {showBulkEdit && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 p-4 backdrop-blur-sm">
          <div className="w-full max-w-lg overflow-hidden rounded-2xl border border-slate-700 bg-slate-900 shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-800 px-5 py-4">
              <div>
                <h2 className="text-sm font-semibold text-white">批量编辑镜头</h2>
                <p className="mt-1 text-xs text-slate-400">
                  正在编辑 {selectedShotIds.length} 个镜头；留空的字段不会修改。
                </p>
              </div>
              <button
                onClick={() => setShowBulkEdit(false)}
                className="rounded-lg p-2 text-slate-400 hover:bg-slate-800 hover:text-white"
                aria-label="关闭批量编辑"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="grid grid-cols-1 gap-4 p-5 sm:grid-cols-2">
              <label className="text-xs text-slate-400">
                移动到场次
                <input
                  list="bulk-scene-options"
                  value={bulkSceneCode}
                  onChange={event => setBulkSceneCode(event.target.value)}
                  placeholder="不修改"
                  className="mt-1.5 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2.5 text-sm text-white outline-none focus:border-indigo-500"
                />
                <datalist id="bulk-scene-options">
                  {scenes.map(scene => (
                    <option key={scene.id} value={scene.sceneCode}>{scene.name}</option>
                  ))}
                </datalist>
              </label>

              <label className="text-xs text-slate-400">
                负责人
                <select
                  value={bulkAssigneeId}
                  onChange={event => setBulkAssigneeId(event.target.value)}
                  className="mt-1.5 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2.5 text-sm text-white outline-none focus:border-indigo-500"
                >
                  <option value="">不修改</option>
                  {users.map(user => (
                    <option key={user.id} value={user.id}>{user.name} · {user.department}</option>
                  ))}
                </select>
              </label>


            </div>

            <div className="flex justify-end gap-2 border-t border-slate-800 bg-slate-950/40 px-5 py-4">
              <button
                onClick={() => setShowBulkEdit(false)}
                className="rounded-lg px-4 py-2 text-xs font-medium text-slate-300 hover:bg-slate-800"
              >
                取消
              </button>
              <button
                onClick={applyBulkEdit}
                disabled={!bulkSceneCode.trim() && !bulkAssigneeId}
                className="rounded-lg bg-indigo-600 px-4 py-2 text-xs font-semibold text-white hover:bg-indigo-500 disabled:cursor-not-allowed disabled:opacity-50"
              >
                应用到 {selectedShotIds.length} 个镜头
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Shot Detail Drawer */}
      {selectedShotId && (
        <ShotDetailDrawer
          shotId={selectedShotId}
          onClose={() => setSelectedShotId(null)}
          onOpenNewVersion={onOpenNewVersion}
        />
      )}
    </div>
  );
};
