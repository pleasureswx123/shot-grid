import React, { useState } from 'react';
import { useApp } from '../../context/AppContext';
import {
  Box, Plus, Search, Check, Folder, Sparkles, X, ChevronRight, User, Image,
  Link as LinkIcon, FileSpreadsheet
} from 'lucide-react';
import { Asset, AssetCategory } from '../../types';
import { TaskDetailCard } from '../tasks/TaskDetailCard';

interface AssetsViewProps {
  onOpenNewAsset: () => void;
  onOpenImportAssets: () => void;
  onOpenNewVersion: (taskId?: string) => void;
}

export const AssetsView: React.FC<AssetsViewProps> = ({
  onOpenNewAsset,
  onOpenImportAssets,
  onOpenNewVersion,
}) => {
  const { assets, users, shots, tasks, versions, selectedAssetId, setSelectedAssetId, setSelectedShotId, setActiveTab, deleteAsset } = useApp();

  const [selectedCategory, setSelectedCategory] = useState<string>('ALL');
  const [searchQuery, setSearchQuery] = useState<string>('');

  const categories: Array<{ id: string; label: string }> = [
    { id: 'ALL', label: '全部资产' },
    { id: '角色', label: '角色' },
    { id: '场景', label: '场景' },
    { id: '道具', label: '道具' },
    { id: '服装', label: '服装' },
    { id: '载具', label: '载具' },
    { id: '生物', label: '生物' },
    { id: '风格参考', label: '风格参考' }
  ];

  const filteredAssets = assets.filter(a => {
    const matchCat = selectedCategory === 'ALL' || a.category === selectedCategory;
    const matchQuery = searchQuery.trim() === '' || a.name.toLowerCase().includes(searchQuery.toLowerCase()) || a.description.toLowerCase().includes(searchQuery.toLowerCase());
    return matchCat && matchQuery;
  });

  const activeAsset = assets.find(a => a.id === selectedAssetId);
  const activeAssetShots = shots.filter(s => activeAsset?.usedInShotIds.includes(s.id) || s.assetIds.includes(activeAsset?.id || ''));
  const activeAssetVersions = versions.filter(v => v.entityId === activeAsset?.id);
  const activeAssetTasks = tasks.filter(task => task.entityType === 'asset' && task.entityId === activeAsset?.id);
  const handleDeleteAsset = async () => {
    if (!activeAsset) return;
    const message = `确定删除资产 ${activeAsset.name}？\n\n` +
      `将影响 ${activeAssetShots.length} 个正在使用该资产的镜头、${activeAssetVersions.length} 个版本。\n` +
      '删除后会进入回收站，可由管理员恢复。';
    if (!window.confirm(message)) return;
    try {
      await deleteAsset(activeAsset.id, activeAssetShots.length > 0);
      setSelectedAssetId(null);
    } catch {
      // API error is reported by context.
    }
  };

  return (
    <div className="p-6 space-y-6 max-w-7xl mx-auto text-slate-100">
      {/* Header Toolbar */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-slate-900 border border-slate-800 rounded-xl p-4">
        {/* Search & Category Pills */}
        <div className="flex flex-wrap items-center gap-3">
          <div className="relative w-56">
            <Search className="w-3.5 h-3.5 absolute left-3 top-2.5 text-slate-400" />
            <input
              type="text"
              placeholder="搜索资产名称/说明..."
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              className="w-full bg-slate-800 border border-slate-700 rounded-lg pl-8 pr-3 py-1.5 text-xs text-slate-200 focus:outline-none focus:border-indigo-500"
            />
          </div>

          <div className="flex space-x-1 bg-slate-800 p-1 rounded-lg border border-slate-700 overflow-x-auto">
            {categories.map(c => (
              <button
                key={c.id}
                onClick={() => setSelectedCategory(c.id)}
                className={`px-2.5 py-1 rounded text-xs font-semibold whitespace-nowrap transition ${
                  selectedCategory === c.id ? 'bg-indigo-600 text-white' : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                {c.label}
              </button>
            ))}
          </div>
        </div>

        <div className="flex items-center gap-2 self-start md:self-auto">
          <button
            onClick={onOpenImportAssets}
            className="px-3.5 py-1.5 bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-200 rounded-lg text-xs font-semibold flex items-center space-x-1.5 transition"
          >
            <FileSpreadsheet className="w-4 h-4 text-emerald-400" />
            <span>导入资产表</span>
          </button>
          <button
            onClick={onOpenNewAsset}
            className="px-3.5 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg text-xs font-semibold flex items-center space-x-1.5 shadow-md shadow-indigo-600/30 transition"
          >
            <Plus className="w-4 h-4" />
            <span>新建资产</span>
          </button>
        </div>
      </div>

      {/* Assets Grid Table */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden shadow-lg">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="border-b border-slate-800 bg-slate-800/50 text-slate-400 font-semibold uppercase tracking-wider py-3">
                <th className="p-3 pl-4">资产名称</th>
                <th className="p-3">类型</th>
                <th className="p-3">缩略图</th>
                <th className="p-3">负责人</th>
                <th className="p-3">状态</th>
                <th className="p-3">最新版本</th>
                <th className="p-3">使用镜头数</th>
                <th className="p-3 text-right pr-4">操作</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60">
              {filteredAssets.map(a => {
                const assignee = users.find(u => u.id === a.assigneeId);
                const latestVer = versions.find(v => v.id === a.latestVersionId);

                return (
                  <tr
                    key={a.id}
                    onClick={() => setSelectedAssetId(a.id)}
                    className="hover:bg-slate-800/50 transition cursor-pointer group"
                  >
                    <td className="p-3 pl-4 font-bold text-white text-sm">
                      {a.name}
                    </td>
                    <td className="p-3">
                      <span className="px-2 py-0.5 bg-indigo-500/20 text-indigo-300 border border-indigo-500/30 rounded text-[11px]">
                        {a.category}
                      </span>
                    </td>
                    <td className="p-3">
                      <div className="w-16 h-12 bg-black rounded border border-slate-700 overflow-hidden">
                        <img src={a.thumbnailUrl} alt={a.name} className="w-full h-full object-cover group-hover:scale-105 transition" />
                      </div>
                    </td>
                    <td className="p-3 text-slate-300">{assignee?.name || '未分配'}</td>
                    <td className="p-3">
                      <span className={`px-2 py-0.5 text-[11px] font-semibold rounded ${
                        a.status === '已定稿' || a.status === '已锁定'
                          ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                          : 'bg-amber-500/10 text-amber-400 border border-amber-500/20'
                      }`}>
                        {a.status}
                      </span>
                    </td>
                    <td className="p-3 font-mono text-indigo-300 font-bold">
                      {latestVer?.versionNumber || 'V001'}
                    </td>
                    <td className="p-3 font-mono text-amber-400 font-bold">
                      {a.usageCount || activeAssetShots.length} 镜头
                    </td>
                    <td className="p-3 text-right pr-4">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setSelectedAssetId(a.id);
                        }}
                        className="px-2.5 py-1 bg-slate-800 hover:bg-indigo-600 text-slate-200 hover:text-white rounded transition text-[11px]"
                      >
                        查看定稿档案
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Asset Detail Drawer */}
      {activeAsset && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex justify-end animate-fadeIn">
          <div className="w-full max-w-2xl bg-slate-900 border-l border-slate-800 h-full flex flex-col text-slate-100 overflow-y-auto p-6 space-y-6 shadow-2xl">
            {/* Drawer Header */}
            <div className="flex items-center justify-between border-b border-slate-800 pb-4">
              <div className="flex items-center space-x-3">
                <span className="text-xl font-bold text-white">{activeAsset.name}</span>
                <span className="px-2.5 py-0.5 text-xs bg-indigo-500/20 text-indigo-300 rounded font-semibold">
                  {activeAsset.category}
                </span>
                <span className="px-2.5 py-0.5 text-xs bg-emerald-500/20 text-emerald-300 rounded font-semibold">
                  {activeAsset.status}
                </span>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={handleDeleteAsset}
                  className="px-2.5 py-1.5 text-xs bg-rose-500/10 hover:bg-rose-500/20 text-rose-300 border border-rose-500/30 rounded transition"
                >
                  删除资产
                </button>
                <button
                  onClick={() => setSelectedAssetId(null)}
                  className="p-1.5 text-slate-400 hover:text-white hover:bg-slate-800 rounded transition"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            {/* Asset Image Banner */}
            <div className="relative rounded-xl overflow-hidden border border-slate-800 aspect-video bg-black">
              <img src={activeAsset.thumbnailUrl} alt={activeAsset.name} className="w-full h-full object-cover" />
            </div>

            {/* Description & Prompt Template */}
            <section className="space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="text-xs font-bold text-white">任务详情</h3>
                <span className="text-[10px] text-slate-500">共 {activeAssetTasks.length} 项</span>
              </div>
              {activeAssetTasks.length > 0
                ? activeAssetTasks.map(task => <TaskDetailCard key={task.id} task={task} />)
                : <div className="rounded-xl border border-dashed border-slate-700 p-5 text-center text-xs text-slate-500">该资产暂无任务</div>}
            </section>

            <div className="space-y-3 bg-slate-800/40 p-4 rounded-xl border border-slate-800 text-xs">
              <div>
                <span className="text-slate-500 font-semibold block mb-1">资产设定说明</span>
                <p className="text-slate-200 leading-relaxed">{activeAsset.description}</p>
              </div>

              {activeAsset.promptTemplate && (
                <div className="pt-2 border-t border-slate-800">
                  <span className="text-slate-500 font-semibold block mb-1">AI定稿提示词模板 (Prompt)</span>
                  <p className="text-emerald-300 font-mono bg-black/60 p-2.5 rounded border border-slate-800 select-all">
                    {activeAsset.promptTemplate}
                  </p>
                </div>
              )}
            </div>

            {/* Used In Shots List */}
            <div className="space-y-3">
              <h3 className="text-xs font-bold text-white uppercase tracking-wider">
                使用该资产的镜头 ({activeAssetShots.length})
              </h3>
              <div className="grid grid-cols-2 gap-3">
                {activeAssetShots.map(s => (
                  <div
                    key={s.id}
                    onClick={() => {
                      setSelectedShotId(s.id);
                      setActiveTab('shots');
                    }}
                    className="p-2.5 bg-slate-800/60 hover:bg-slate-800 rounded-lg border border-slate-700/60 cursor-pointer flex items-center space-x-3 transition"
                  >
                    <img src={s.thumbnailUrl} alt={s.shotCode} className="w-12 h-9 object-cover rounded border border-slate-700" />
                    <div>
                      <div className="text-xs font-bold text-indigo-300 font-mono">{s.shotCode}</div>
                      <div className="text-[10px] text-slate-400 truncate max-w-[120px]">{s.description}</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Version History */}
            <div className="space-y-3">
              <h3 className="text-xs font-bold text-white uppercase tracking-wider">历史设计版本</h3>
              <div className="space-y-2">
                {activeAssetVersions.map(v => (
                  <div key={v.id} className="p-3 bg-slate-800/60 rounded-lg border border-slate-700/60 flex items-center justify-between text-xs">
                    <div className="flex items-center space-x-3">
                      <span className="font-bold text-indigo-300 font-mono">{v.versionNumber}</span>
                      <span className="text-slate-300">{v.changelog}</span>
                    </div>
                    <span className="text-emerald-400 font-semibold">{v.status}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
