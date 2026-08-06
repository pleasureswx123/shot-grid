import React from 'react';
import { Calendar, FileCheck2, Layers3, MessageSquareText, UserRound } from 'lucide-react';
import { useApp } from '../../context/AppContext';
import type { Task } from '../../types';

interface TaskDetailCardProps {
  task: Task;
}

export const TaskDetailCard: React.FC<TaskDetailCardProps> = ({ task }) => {
  const { project, users, shots, assets, tasks, versions, notes, apiStatus, updateTaskAssignee } = useApp();
  const shot = task.entityType === 'shot' ? shots.find(item => item.id === task.entityId) : undefined;
  const asset = task.entityType === 'asset' ? assets.find(item => item.id === task.entityId) : undefined;
  const entityLabel = task.entityType === 'project'
    ? `项目 · ${project.name}`
    : shot
      ? `镜头 · ${shot.shotCode}`
      : asset
        ? `资产 · ${asset.name}`
        : `${task.entityType} · ${task.entityId}`;
  const latestVersion = versions.find(version => version.id === task.latestVersionId)
    || versions.filter(version => version.taskId === task.id || version.entityId === task.entityId)[0];
  const latestNotes = notes
    .filter(note => note.versionId === latestVersion?.id)
    .sort((left, right) => right.createdAt.localeCompare(left.createdAt));
  const prerequisite = tasks.find(item => item.id === task.prerequisiteTaskId);

  return (
    <article className="rounded-xl border border-slate-700 bg-slate-900/70 p-4 space-y-3">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h4 className="text-sm font-bold text-white">{task.title}</h4>
          <p className="mt-1 text-[11px] text-slate-400">{task.requirements || '暂无制作要求'}</p>
        </div>
        <span className="shrink-0 rounded border border-indigo-500/20 bg-indigo-500/10 px-2 py-0.5 text-[11px] text-indigo-300">
          {task.status}
        </span>
      </div>

      <dl className="grid grid-cols-2 gap-3 text-xs md:grid-cols-3">
        <div><dt className="text-[10px] text-slate-500">所属实体</dt><dd className="mt-0.5 text-slate-200">{entityLabel}</dd></div>
        <div><dt className="text-[10px] text-slate-500">制作阶段</dt><dd className="mt-0.5 text-emerald-300">{task.pipelineStage}</dd></div>
        <div><dt className="text-[10px] text-slate-500">任务状态</dt><dd className="mt-0.5 text-slate-200">{task.status}</dd></div>
        <div>
          <dt className="flex items-center gap-1 text-[10px] text-slate-500"><UserRound className="h-3 w-3" />负责人</dt>
          <dd className="mt-1">
            <select
              aria-label={`${task.title}负责人`}
              value={task.assigneeId}
              disabled={apiStatus.isSaving}
              onChange={event => void updateTaskAssignee(task.id, event.target.value)}
              className="w-full rounded border border-slate-700 bg-slate-800 px-2 py-1 text-xs text-slate-100 outline-none focus:border-indigo-500 disabled:opacity-60"
            >
              {!users.some(user => user.id === task.assigneeId) && <option value={task.assigneeId}>未分配</option>}
              {users.map(user => <option key={user.id} value={user.id}>{user.name} · {user.department}</option>)}
            </select>
          </dd>
        </div>
        <div><dt className="flex items-center gap-1 text-[10px] text-slate-500"><Calendar className="h-3 w-3" />截止日期</dt><dd className="mt-1 font-mono text-amber-300">{task.dueDate || '未设置'}</dd></div>
        <div><dt className="flex items-center gap-1 text-[10px] text-slate-500"><FileCheck2 className="h-3 w-3" />最新版本</dt><dd className="mt-1 font-mono text-indigo-300">{latestVersion?.versionNumber || '暂无版本'}</dd></div>
        <div><dt className="text-[10px] text-slate-500">前置任务</dt><dd className="mt-1 text-slate-300">{prerequisite ? `${prerequisite.pipelineStage} · ${prerequisite.status}` : '无'}</dd></div>
      </dl>

      <div className="rounded-lg border border-slate-800 bg-slate-950/60 p-2.5">
        <div className="mb-1 flex items-center gap-1 text-[10px] text-slate-500">
          <MessageSquareText className="h-3 w-3" />审核意见摘要
        </div>
        {latestNotes.length > 0 ? (
          <p className="line-clamp-2 text-xs text-slate-300">
            {latestNotes[0].content}<span className="ml-2 text-slate-500">（共 {latestNotes.length} 条）</span>
          </p>
        ) : (
          <p className="flex items-center gap-1 text-xs text-slate-500"><Layers3 className="h-3 w-3" />暂无审核意见</p>
        )}
      </div>
    </article>
  );
};
