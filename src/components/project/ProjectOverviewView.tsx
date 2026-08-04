import React, { useState } from 'react';
import { useApp } from '../../context/AppContext';
import {
  Film, CheckCircle2, Clock, AlertTriangle, Lock, Calendar,
  Users, Folder, Layers, Sparkles, PieChart, ArrowUpRight, Volume2, Clapperboard,
  HardDrive
} from 'lucide-react';
import { useWorkspace } from '../../context/WorkspaceContext';
import { ProjectMembersPanel } from './ProjectMembersPanel';

interface ProjectOverviewViewProps {
  onOpenNewVersion: (taskId?: string) => void;
}

export const ProjectOverviewView: React.FC<ProjectOverviewViewProps> = ({ onOpenNewVersion }) => {
  const {
    project, currentUser, users, scenes, shots, assets, tasks, reviewLists,
    setActiveTab, setSelectedShotId, updateTaskStatus,
  } = useApp();
  const { members } = useWorkspace();
  const [subTab, setSubTab] = useState<'overview' | 'scenes' | 'shots' | 'finishing' | 'assets' | 'reviews' | 'members'>('overview');
  const projectTasks = tasks.filter(task =>
    task.entityType === 'project' && task.entityId === project.id
  );
  const storageSections = Array.from(new Set(
    (project.storageDirectories || []).map(directory => directory.split('/')[0]),
  ));
  const canManageTasks = currentUser.role === 'admin' || currentUser.role === 'director';

  const progressPercent = project.totalShots > 0
    ? Math.round((project.completedShots / project.totalShots) * 100)
    : 0;

  return (
    <div className="p-6 space-y-6 max-w-7xl mx-auto text-slate-100">
      {/* Top Banner & Stat Cards */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-6 space-y-5">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-800 pb-5">
          <div>
            <div className="flex items-center space-x-3">
              <h1 className="text-2xl font-black tracking-tight text-white">{project.name}</h1>
              <span className="px-2.5 py-0.5 text-xs font-semibold bg-indigo-500/20 text-indigo-300 border border-indigo-500/30 rounded-full">
                {project.type}
              </span>
              <span className="px-2.5 py-0.5 text-xs bg-slate-800 text-slate-300 border border-slate-700 rounded-full">
                {project.status}
              </span>
            </div>
            <p className="text-xs text-slate-400 mt-1.5 flex items-center space-x-4 font-mono">
              <span>代号: {project.code}</span>
              <span>•</span>
              <span>画幅: {project.aspectRatio}</span>
              <span>•</span>
              <span>总时长: {project.totalDurationMin} 分钟</span>
              <span>•</span>
              <span className="text-amber-400 font-semibold flex items-center space-x-1">
                <Calendar className="w-3.5 h-3.5 inline mr-1" />
                交付时间: {project.deliveryDate}
              </span>
            </p>
            <div className="mt-3 inline-flex max-w-full items-center gap-2 rounded-lg border border-emerald-500/20 bg-emerald-500/5 px-3 py-2 text-[11px] text-emerald-200">
              <HardDrive className="h-3.5 w-3.5 shrink-0" />
              <span className="text-emerald-400 font-semibold">本地项目目录</span>
              <span className="truncate font-mono" title={project.storagePath || project.storageKey}>
                {project.storagePath || project.storageKey || project.code}
              </span>
            </div>
          </div>

          <div className="flex items-center space-x-3">
            <button
              onClick={() => setActiveTab('shots')}
              className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold rounded-lg shadow-md transition"
            >
              打开镜头矩阵
            </button>
            <button
              onClick={() => setActiveTab('review')}
              className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 text-xs font-semibold rounded-lg transition"
            >
              进行版本审核
            </button>
          </div>
        </div>

        {/* 8 Stats Bar */}
        <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-3">
          <div className="bg-slate-800/50 p-3 rounded-lg border border-slate-700/50">
            <div className="text-[11px] text-slate-400">当前项目阶段</div>
            <div className="text-sm font-bold text-indigo-300 mt-1 truncate">{project.currentPhase}</div>
          </div>

          <div className="bg-slate-800/50 p-3 rounded-lg border border-slate-700/50">
            <div className="text-[11px] text-slate-400">总镜头数</div>
            <div className="text-xl font-black text-white mt-0.5">{project.totalShots}</div>
          </div>

          <div className="bg-slate-800/50 p-3 rounded-lg border border-slate-700/50">
            <div className="text-[11px] text-emerald-400">已完成镜头</div>
            <div className="text-xl font-black text-emerald-400 mt-0.5">{project.completedShots}</div>
          </div>

          <div className="bg-slate-800/50 p-3 rounded-lg border border-slate-700/50">
            <div className="text-[11px] text-amber-400">待审核镜头</div>
            <div className="text-xl font-black text-amber-400 mt-0.5">{project.pendingReviewShots}</div>
          </div>

          <div className="bg-slate-800/50 p-3 rounded-lg border border-slate-700/50">
            <div className="text-[11px] text-orange-400">修改中镜头</div>
            <div className="text-xl font-black text-orange-400 mt-0.5">{project.revisingShots}</div>
          </div>

          <div className="bg-slate-800/50 p-3 rounded-lg border border-slate-700/50">
            <div className="text-[11px] text-rose-400">阻塞镜头</div>
            <div className="text-xl font-black text-rose-400 mt-0.5">{project.blockedShots}</div>
          </div>

          <div className="bg-slate-800/50 p-3 rounded-lg border border-slate-700/50 col-span-2 sm:col-span-1">
            <div className="text-[11px] text-slate-400">整体完成度</div>
            <div className="text-xl font-black text-indigo-400 mt-0.5">{progressPercent}%</div>
          </div>
        </div>

        {/* Progress Bar */}
        <div className="space-y-1.5">
          <div className="flex justify-between text-xs text-slate-400 font-mono">
            <span>项目镜头进度监控</span>
            <span>{project.completedShots} / {project.totalShots} 镜头已终审锁定</span>
          </div>
          <div className="w-full h-2.5 bg-slate-800 rounded-full overflow-hidden flex">
            <div className="bg-emerald-500 h-full transition-all duration-500" style={{ width: `${(project.completedShots / project.totalShots) * 100}%` }} title="已完成" />
            <div className="bg-amber-500 h-full transition-all duration-500" style={{ width: `${(project.pendingReviewShots / project.totalShots) * 100}%` }} title="待审核" />
            <div className="bg-orange-500 h-full transition-all duration-500" style={{ width: `${(project.revisingShots / project.totalShots) * 100}%` }} title="修改中" />
            <div className="bg-rose-500 h-full transition-all duration-500" style={{ width: `${(project.blockedShots / project.totalShots) * 100}%` }} title="阻塞" />
          </div>
        </div>
      </div>

      {/* Navigation Sub-Tabs */}
      <div className="flex space-x-2 border-b border-slate-800 pb-2">
        {[
          { id: 'overview', label: '项目概况' },
          { id: 'scenes', label: `场次 (${scenes.length})` },
          { id: 'shots', label: `镜头 (${shots.length})` },
          { id: 'finishing', label: `整片任务 (${projectTasks.length})` },
          { id: 'assets', label: `资产 (${assets.length})` },
          { id: 'reviews', label: `审核单 (${reviewLists.length})` },
          { id: 'members', label: `成员 (${members.length})` }
        ].map(t => (
          <button
            key={t.id}
            onClick={() => setSubTab(t.id as any)}
            className={`px-4 py-2 rounded-lg text-xs font-semibold transition ${
              subTab === t.id
                ? 'bg-indigo-600 text-white'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* Sub-tab 1: Overview */}
      {subTab === 'overview' && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 space-y-4">
            <h3 className="text-sm font-bold text-white flex items-center space-x-2">
              <Layers className="w-4 h-4 text-indigo-400" />
              <span>场次故事结构与镜头统计</span>
            </h3>
            <div className="space-y-3">
              {scenes.map(sc => {
                const scShots = shots.filter(s => s.sceneCode === sc.sceneCode);
                return (
                  <div key={sc.id} className="p-3.5 bg-slate-800/60 rounded-lg border border-slate-700/60 space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-slate-200 text-xs">{sc.sceneCode} - {sc.name}</span>
                      <span className="text-[11px] text-indigo-400 font-mono">{scShots.length} 镜头</span>
                    </div>
                    <p className="text-xs text-slate-400">{sc.description}</p>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 space-y-4">
            <h3 className="text-sm font-bold text-white flex items-center space-x-2">
              <Folder className="w-4 h-4 text-indigo-400" />
              <span>核心核心资产列表</span>
            </h3>
            <div className="space-y-3">
              {assets.map(a => (
                <div key={a.id} className="p-3 bg-slate-800/60 rounded-lg border border-slate-700/60 flex items-center justify-between">
                  <div className="flex items-center space-x-3">
                    <img src={a.thumbnailUrl} alt={a.name} className="w-10 h-10 object-cover rounded border border-slate-700" />
                    <div>
                      <div className="text-xs font-semibold text-slate-200">{a.name}</div>
                      <div className="text-[10px] text-slate-400">{a.category} • 关联 {a.usageCount} 个镜头</div>
                    </div>
                  </div>
                  <span className="text-xs font-mono px-2 py-0.5 bg-emerald-500/10 text-emerald-400 rounded">
                    {a.status}
                  </span>
                </div>
              ))}
            </div>
          </div>

          <div className="md:col-span-2 bg-slate-900 border border-slate-800 rounded-xl p-5 space-y-4">
            <div className="flex items-center justify-between gap-4">
              <h3 className="text-sm font-bold text-white flex items-center space-x-2">
                <HardDrive className="w-4 h-4 text-emerald-400" />
                <span>本地项目文件架构</span>
              </h3>
              <span className="text-[10px] text-slate-500">
                创建项目时自动生成 · 由局域网服务器统一管理
              </span>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-2">
              {storageSections.map(section => (
                <div
                  key={section}
                  className="rounded-lg border border-slate-700/60 bg-slate-800/60 px-3 py-2.5 font-mono text-[11px] text-emerald-200"
                >
                  {section}
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Sub-tab 2: Scenes */}
      {subTab === 'scenes' && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {scenes.map(sc => (
            <div key={sc.id} className="bg-slate-900 border border-slate-800 rounded-xl p-5 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-sm font-bold text-indigo-300 font-mono">{sc.sceneCode}</span>
                <span className="text-xs bg-slate-800 px-2 py-0.5 rounded text-slate-300">{sc.shotCount} 个镜头</span>
              </div>
              <h3 className="text-base font-bold text-white">{sc.name}</h3>
              <p className="text-xs text-slate-400 leading-relaxed">{sc.description}</p>
            </div>
          ))}
        </div>
      )}

      {/* Sub-tab 3: Shots Quick List */}
      {subTab === 'shots' && (
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-bold text-white">所有镜头列表 ({shots.length})</h3>
            <button
              onClick={() => setActiveTab('shots')}
              className="text-xs text-indigo-400 hover:underline flex items-center space-x-1"
            >
              <span>转到完整镜头管理</span>
              <ArrowUpRight className="w-3.5 h-3.5" />
            </button>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {shots.map(s => (
              <div
                key={s.id}
                onClick={() => { setSelectedShotId(s.id); setActiveTab('shots'); }}
                className="bg-slate-800/60 hover:bg-slate-800 border border-slate-700/60 rounded-xl p-3 flex space-x-3 cursor-pointer transition"
              >
                <img src={s.thumbnailUrl} alt={s.shotCode} className="w-20 h-16 object-cover rounded-lg border border-slate-700" />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-indigo-300 font-mono">{s.shotCode}</span>
                    <span className="text-[10px] text-slate-400">{s.durationSec}s</span>
                  </div>
                  <p className="text-xs text-slate-300 line-clamp-1 mt-1">{s.description}</p>
                  <span className="inline-block text-[10px] bg-slate-700 text-slate-300 px-1.5 py-0.2 rounded mt-2">
                    {s.status}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Sub-tab 4: Project-level finishing tasks */}
      {subTab === 'finishing' && (
        <div className="space-y-4">
          <div className="rounded-xl border border-indigo-500/20 bg-indigo-500/5 px-4 py-3 text-xs text-indigo-200">
            声音与成片属于整片级任务，各项目只保留一项，不再按镜头重复创建。
          </div>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {projectTasks.map(task => {
              const assignee = users.find(user => user.id === task.assigneeId);
              const TaskIcon = task.pipelineStage === '声音' ? Volume2 : Clapperboard;
              return (
                <div key={task.id} className="bg-slate-900 border border-slate-800 rounded-xl p-5 space-y-4">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex items-start gap-3">
                      <div className="p-2.5 rounded-lg bg-indigo-500/10 text-indigo-300">
                        <TaskIcon className="w-5 h-5" />
                      </div>
                      <div>
                        <div className="text-[10px] uppercase tracking-widest text-indigo-400 font-bold">
                          整片级 · {task.pipelineStage}
                        </div>
                        <h3 className="text-sm font-bold text-white mt-1">{task.title}</h3>
                      </div>
                    </div>
                    <span className="text-[11px] text-slate-400 font-mono">{task.dueDate}</span>
                  </div>
                  <p className="text-xs text-slate-400 leading-relaxed">{task.requirements}</p>
                  <div className="flex items-center justify-between gap-3 border-t border-slate-800 pt-3">
                    <div className="text-xs text-slate-400">
                      负责人：<span className="text-slate-200">{assignee?.name || '待分配'}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <select
                        aria-label={`更新${task.title}状态`}
                        value={task.status}
                        disabled={!canManageTasks}
                        onChange={event => updateTaskStatus(task.id, event.target.value as typeof task.status)}
                        className="bg-slate-800 border border-slate-700 rounded-lg px-2 py-1.5 text-[11px] text-slate-200 disabled:opacity-60"
                      >
                        <option value="未开始">未开始</option>
                        <option value="制作中">制作中</option>
                        <option value="待审核">待审核</option>
                        <option value="修改中">修改中</option>
                        <option value="已完成">已完成</option>
                        <option value="已阻塞">已阻塞</option>
                      </select>
                      <button
                        onClick={() => onOpenNewVersion(task.id)}
                        className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg text-[11px] font-semibold transition"
                      >
                        提交整片版本
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Sub-tab 5: Assets */}
      {subTab === 'assets' && (
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
          {assets.map(a => (
            <div key={a.id} className="bg-slate-900 border border-slate-800 rounded-xl p-4 space-y-3">
              <img src={a.thumbnailUrl} alt={a.name} className="w-full h-36 object-cover rounded-lg border border-slate-700" />
              <div className="flex items-center justify-between">
                <span className="text-sm font-bold text-white">{a.name}</span>
                <span className="text-[10px] bg-indigo-500/20 text-indigo-300 px-2 py-0.5 rounded">{a.category}</span>
              </div>
              <p className="text-xs text-slate-400 line-clamp-2">{a.description}</p>
            </div>
          ))}
        </div>
      )}

      {/* Sub-tab 6: Reviews */}
      {subTab === 'reviews' && (
        <div className="space-y-4">
          {reviewLists.map(rl => (
            <div key={rl.id} className="bg-slate-900 border border-slate-800 rounded-xl p-5 flex items-center justify-between">
              <div>
                <h3 className="text-sm font-bold text-white">{rl.title}</h3>
                <p className="text-xs text-slate-400 mt-1">{rl.description}</p>
                <div className="text-[11px] text-slate-500 font-mono mt-2">
                  日期: {rl.date} • 包含 {rl.versionIds.length} 个镜头版本
                </div>
              </div>
              <button
                onClick={() => setActiveTab('review')}
                className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg text-xs font-semibold transition"
              >
                开始在线审核
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Sub-tab 7: Members */}
      {subTab === 'members' && (
        <ProjectMembersPanel />
      )}
    </div>
  );
};
