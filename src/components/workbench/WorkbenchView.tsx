import React, { useState } from 'react';
import { useApp } from '../../context/AppContext';
import {
  Clock, AlertTriangle, CheckCircle2, PlayCircle, Lock,
  PlusCircle, Sparkles, ChevronRight, User, Calendar
} from 'lucide-react';
import { TaskPipelineStage } from '../../types';
import { TaskDetailCard } from '../tasks/TaskDetailCard';
import { getMyDueTasks, getPendingReviewTasks, getRecentProjectVersions } from './workbenchMetrics';

interface WorkbenchViewProps {
  onOpenNewVersion: (taskId?: string) => void;
}

export const WorkbenchView: React.FC<WorkbenchViewProps> = ({ onOpenNewVersion }) => {
  const { currentUser, tasks, shots, versions, reviewLists, setSelectedShotId, setActiveTab } = useApp();
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null);
  const [stageFilter, setStageFilter] = useState<TaskPipelineStage | '全部'>('全部');
  const canViewInternal = currentUser.role !== 'client';

  // Filter tasks based on current user
  const internalTasks = canViewInternal ? tasks : [];
  const myMakingTasks = internalTasks.filter(t => t.assigneeId === currentUser.id && t.status === '制作中');
  const myRevisingTasks = internalTasks.filter(t => t.assigneeId === currentUser.id && t.status === '修改中');
  const myBlockedTasks = internalTasks.filter(t => t.assigneeId === currentUser.id && t.status === '已阻塞');
  
  // “待我审核”只来自当前用户尚未完成参与的开放审核单。
  const pendingReviewTasks = getPendingReviewTasks(tasks, versions, reviewLists, currentUser);
  
  // All my active tasks
  const myAllTasks = internalTasks.filter(t => t.assigneeId === currentUser.id && (stageFilter === '全部' || t.pipelineStage === stageFilter));

  const { dueToday, overdue } = getMyDueTasks(internalTasks, currentUser.id);

  // 项目口径：最近 24 小时内的全部项目提交，按提交时间倒序。
  const recentProjectVersions = getRecentProjectVersions(versions);
  const recentVersionsForDisplay = recentProjectVersions.slice(0, 5);

  const getStatusBadge = (status: string) => {
    switch (status) {
      case '未开始': return <span className="px-2 py-0.5 text-xs bg-slate-800 text-slate-400 rounded">未开始</span>;
      case '制作中': return <span className="px-2 py-0.5 text-xs bg-blue-500/10 text-blue-400 border border-blue-500/20 rounded">制作中</span>;
      case '待审核': return <span className="px-2 py-0.5 text-xs bg-amber-500/10 text-amber-400 border border-amber-500/20 rounded">待审核</span>;
      case '修改中': return <span className="px-2 py-0.5 text-xs bg-orange-500/10 text-orange-400 border border-orange-500/20 rounded">修改中</span>;
      case '已完成': return <span className="px-2 py-0.5 text-xs bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 rounded">已完成</span>;
      case '已阻塞': return <span className="px-2 py-0.5 text-xs bg-rose-500/10 text-rose-400 border border-rose-500/20 rounded">已阻塞</span>;
      default: return null;
    }
  };

  return (
    <div className="p-6 space-y-6 text-slate-100 max-w-7xl mx-auto">
      {/* Top Banner */}
      <div className="flex items-center justify-between bg-gradient-to-r from-slate-900 via-indigo-950/40 to-slate-900 border border-slate-800 rounded-xl p-5 shadow-lg">
        <div className="flex items-center space-x-4">
          <img src={currentUser.avatar} alt={currentUser.name} className="w-14 h-14 rounded-full object-cover border-2 border-indigo-500/50 shadow-md" />
          <div>
            <div className="flex items-center space-x-2">
              <h1 className="text-xl font-bold text-white">欢迎回来，{currentUser.name}</h1>
              <span className="text-xs px-2 py-0.5 bg-indigo-500/20 text-indigo-300 rounded font-medium border border-indigo-500/30">
                {currentUser.department}
              </span>
            </div>
            <p className="text-xs text-slate-400 mt-1">
              当前制作视角：只展示与您工作相关的任务与审核意见，高效推进影视镜头迭代。
            </p>
          </div>
        </div>

        {canViewInternal && <button
          onClick={() => onOpenNewVersion()}
          className="flex items-center space-x-2 px-4 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg text-xs font-semibold shadow-lg shadow-indigo-600/30 transition"
        >
          <Sparkles className="w-4 h-4" />
          <span>提交新生成版本 (Version)</span>
        </button>}
      </div>

      {/* 6 Metric Cards */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-3.5 space-y-1">
          <div className="flex items-center justify-between text-xs text-slate-400">
            <span>我的制作任务</span>
            <PlayCircle className="w-4 h-4 text-blue-400" />
          </div>
          <div className="text-2xl font-extrabold text-white">{myMakingTasks.length}</div>
          <div className="text-[10px] text-blue-400">正在生成与制作</div>
        </div>

        <div className="bg-slate-900 border border-slate-800 rounded-xl p-3.5 space-y-1">
          <div className="flex items-center justify-between text-xs text-slate-400">
            <span>待修改任务</span>
            <AlertTriangle className="w-4 h-4 text-orange-400" />
          </div>
          <div className="text-2xl font-extrabold text-white">{myRevisingTasks.length}</div>
          <div className="text-[10px] text-orange-400">导演意见已下发</div>
        </div>

        <div className="bg-slate-900 border border-slate-800 rounded-xl p-3.5 space-y-1">
          <div className="flex items-center justify-between text-xs text-slate-400">
            <span>待我审核</span>
            <CheckCircle2 className="w-4 h-4 text-amber-400" />
          </div>
          <div className="text-2xl font-extrabold text-white">{pendingReviewTasks.length}</div>
          <div className="text-[10px] text-amber-400">等待集评打分</div>
        </div>

        <div className="bg-slate-900 border border-slate-800 rounded-xl p-3.5 space-y-1">
          <div className="flex items-center justify-between text-xs text-slate-400">
            <span>今日截止</span>
            <Clock className="w-4 h-4 text-rose-400" />
          </div>
          <div className="text-2xl font-extrabold text-white">
            {dueToday.length}
          </div>
          <div className="text-[10px] text-rose-400">另有逾期 {overdue.length} 项</div>
        </div>

        <div className="bg-slate-900 border border-slate-800 rounded-xl p-3.5 space-y-1">
          <div className="flex items-center justify-between text-xs text-slate-400">
            <span>被阻塞任务</span>
            <Lock className="w-4 h-4 text-purple-400" />
          </div>
          <div className="text-2xl font-extrabold text-white">{myBlockedTasks.length}</div>
          <div className="text-[10px] text-purple-400">等待前置任务解锁</div>
        </div>

        <div className="bg-slate-900 border border-slate-800 rounded-xl p-3.5 space-y-1">
          <div className="flex items-center justify-between text-xs text-slate-400">
            <span>项目最近提交</span>
            <Sparkles className="w-4 h-4 text-emerald-400" />
          </div>
          <div className="text-2xl font-extrabold text-white">{recentProjectVersions.length}</div>
          <div className="text-[10px] text-emerald-400">项目近24小时</div>
        </div>
      </div>

      {/* Main Grid: My Task List & Recent Activity */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column (2 cols): My Task List */}
        <div className="lg:col-span-2 bg-slate-900 border border-slate-800 rounded-xl p-5 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-bold text-white flex items-center space-x-2">
              <PlayCircle className="w-4 h-4 text-indigo-400" />
              <span>我的制作任务清单 ({myAllTasks.length})</span>
            </h2>
            <div className="flex items-center gap-2">
              <label htmlFor="task-stage-filter" className="text-xs text-slate-400">阶段</label>
              <select id="task-stage-filter" value={stageFilter} onChange={event => setStageFilter(event.target.value as TaskPipelineStage | '全部')} className="rounded border border-slate-700 bg-slate-800 px-2 py-1 text-xs text-slate-200">
                {['全部', '台本', '视觉准备', '视频生成', '剪辑', '声音', '成片', '需求', '概念设计', '修改', '定稿'].map(stage => <option key={stage}>{stage}</option>)}
              </select>
            </div>
          </div>

          {myAllTasks.length === 0 ? (
            <div className="text-center py-10 text-slate-500 text-xs">
              您当前没有分配的活跃制作任务，请切换角色或在镜头管理中分配任务。
            </div>
          ) : (
            <div className="space-y-4">
              {selectedTaskId && tasks.find(task => task.id === selectedTaskId) && (
                <TaskDetailCard task={tasks.find(task => task.id === selectedTaskId)!} />
              )}
              <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="border-b border-slate-800 text-slate-400 font-medium pb-2">
                    <th className="py-2 px-3">任务名称</th>
                    <th className="py-2 px-3">制作环节</th>
                    <th className="py-2 px-3">优先级</th>
                    <th className="py-2 px-3">状态</th>
                    <th className="py-2 px-3">截止时间</th>
                    <th className="py-2 px-3 text-right">操作</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60">
                  {myAllTasks.map(task => {
                    const shot = shots.find(s => s.id === task.entityId);
                    const isProjectTask = task.entityType === 'project';
                    return (
                      <tr
                        key={task.id}
                        onClick={() => setSelectedTaskId(task.id)}
                        className={`cursor-pointer transition ${selectedTaskId === task.id ? 'bg-indigo-500/10' : 'hover:bg-slate-800/40'}`}
                      >
                        <td className="py-3 px-3">
                          <div className="font-semibold text-slate-200">{task.title}</div>
                          {shot && (
                            <div className="text-[10px] text-slate-400 mt-0.5 line-clamp-1">
                              {shot.description}
                            </div>
                          )}
                          {isProjectTask && (
                            <div className="text-[10px] text-indigo-400 mt-0.5">
                              整片级任务 · 覆盖整个项目
                            </div>
                          )}
                        </td>
                        <td className="py-3 px-3">
                          <span className="px-2 py-0.5 bg-slate-800 text-indigo-300 rounded text-[11px] font-mono">
                            {task.pipelineStage}
                          </span>
                        </td>
                        <td className="py-3 px-3">
                          <span className={`font-semibold ${
                            task.priority === '高' ? 'text-rose-400' : task.priority === '中' ? 'text-amber-400' : 'text-slate-400'
                          }`}>
                            {task.priority}
                          </span>
                        </td>
                        <td className="py-3 px-3">{getStatusBadge(task.status)}</td>
                        <td className="py-3 px-3 text-slate-400 font-mono text-[11px]">{task.dueDate}</td>
                        <td className="py-3 px-3 text-right">
                          <div className="flex items-center justify-end space-x-2">
                            {shot && (
                              <button
                                onClick={() => {
                                  setSelectedShotId(shot.id);
                                  setActiveTab('shots');
                                }}
                                className="px-2.5 py-1 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded text-[11px] transition"
                              >
                                查看镜头
                              </button>
                            )}
                            <button
                              onClick={() => onOpenNewVersion(task.id)}
                              className="px-2.5 py-1 bg-indigo-600/80 hover:bg-indigo-600 text-white rounded text-[11px] font-medium transition"
                            >
                              提交版本
                            </button>
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
        </div>

        {/* Right Column (1 col): Recent Submissions & Pending Reviews */}
        <div className="space-y-6">
          {/* Pending Reviews Box */}
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 space-y-3">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-bold text-white flex items-center space-x-2">
                <CheckCircle2 className="w-4 h-4 text-amber-400" />
                <span>待审核版本集评 ({pendingReviewTasks.length})</span>
              </h2>
              <button
                onClick={() => setActiveTab('review')}
                className="text-xs text-indigo-400 hover:underline flex items-center space-x-0.5"
              >
                <span>进入审核单</span>
                <ChevronRight className="w-3.5 h-3.5" />
              </button>
            </div>

            <div className="space-y-2.5">
              {pendingReviewTasks.slice(0, 4).map(t => {
                const shot = shots.find(s => s.id === t.entityId);
                const version = versions.find(v => v.id === t.latestVersionId);
                return (
                  <div key={t.id} className="p-2.5 bg-slate-800/60 rounded-lg border border-slate-700/60 flex items-center space-x-3">
                    {version?.thumbnailUrl && (
                      <img src={version.thumbnailUrl} alt={t.title} className="w-12 h-10 object-cover rounded border border-slate-700" />
                    )}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-semibold text-slate-200 truncate">{t.title}</span>
                        <span className="text-[10px] text-indigo-400 font-mono font-bold">{version?.versionNumber || 'V001'}</span>
                      </div>
                      <div className="text-[10px] text-slate-400 mt-0.5 truncate">
                        {canViewInternal ? (version?.aiParams?.modelName || 'AI算法模型生成') : '待审核版本'}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Activity Log */}
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 space-y-3">
            <h2 className="text-sm font-bold text-white flex items-center space-x-2">
              <Clock className="w-4 h-4 text-indigo-400" />
              <span>动态提交记录</span>
            </h2>

            <div className="space-y-3 text-xs">
              {recentVersionsForDisplay.map(v => (
                <div key={v.id} className="border-l-2 border-indigo-500 pl-3 py-1 space-y-0.5">
                  <div className="flex items-center justify-between">
                    <span className="font-semibold text-slate-200">{v.entityId.toUpperCase()} {v.versionNumber}</span>
                    <span className="text-[10px] text-slate-400 font-mono">{v.createdAt}</span>
                  </div>
                  {canViewInternal && <p className="text-[11px] text-slate-300 line-clamp-1">{v.changelog}</p>}
                  {canViewInternal && <p className="text-[10px] text-indigo-400/80">模型: {v.aiParams?.modelName || '未知'}</p>}
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
