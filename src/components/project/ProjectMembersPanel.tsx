import React, { useMemo, useState } from 'react';
import {
  Loader2, Plus, RefreshCw, ShieldCheck, Trash2, UserPlus, Users
} from 'lucide-react';
import type { UserRole } from '../../types';
import { useAuth } from '../../context/AuthContext';
import { useWorkspace } from '../../context/WorkspaceContext';

const roleLabels: Record<UserRole, string> = {
  admin: '项目管理员',
  director: '项目总监',
  creator: '制作人员',
  client: '外部审核',
};

export const ProjectMembersPanel: React.FC = () => {
  const { user } = useAuth();
  const {
    members, directory, isMembersLoading, error,
    addMember, removeMember, refreshMembers
  } = useWorkspace();
  const [selectedUserId, setSelectedUserId] = useState('');
  const [projectRole, setProjectRole] = useState<UserRole>('creator');
  const [isSaving, setIsSaving] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);

  const currentMembership = members.find(member => member.id === user?.id);
  const canManage = user?.role === 'admin' ||
    currentMembership?.projectRole === 'admin' ||
    currentMembership?.projectRole === 'director';

  const availableUsers = useMemo(
    () => directory.filter(candidate => !members.some(member => member.id === candidate.id)),
    [directory, members],
  );

  const handleAddMember = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!selectedUserId) return;
    setIsSaving(true);
    setActionError(null);
    try {
      await addMember(selectedUserId, projectRole);
      setSelectedUserId('');
      setProjectRole('creator');
    } catch (requestError) {
      setActionError(requestError instanceof Error ? requestError.message : '添加成员失败。');
    } finally {
      setIsSaving(false);
    }
  };

  const handleRemoveMember = async (memberId: string, memberName: string) => {
    if (!window.confirm(`确定要将“${memberName}”移出当前项目吗？`)) return;
    setActionError(null);
    try {
      await removeMember(memberId);
    } catch (requestError) {
      setActionError(requestError instanceof Error ? requestError.message : '移除成员失败。');
    }
  };

  return (
    <div className="space-y-4">
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 flex flex-col md:flex-row md:items-center justify-between gap-3">
        <div className="flex items-center space-x-3">
          <div className="w-9 h-9 rounded-lg bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center">
            <Users className="w-4.5 h-4.5 text-indigo-400" />
          </div>
          <div>
            <div className="text-sm font-bold text-white">真实项目成员</div>
            <div className="text-[11px] text-slate-400">成员关系和项目角色保存在工作室数据库。</div>
          </div>
        </div>
        <button
          onClick={() => void refreshMembers()}
          className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 rounded-lg text-xs text-slate-300 flex items-center space-x-1.5 self-start md:self-auto"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${isMembersLoading ? 'animate-spin' : ''}`} />
          <span>刷新成员</span>
        </button>
      </div>

      {canManage && (
        <form onSubmit={handleAddMember} className="bg-slate-900 border border-slate-800 rounded-xl p-4">
          <div className="flex items-center space-x-2 mb-3 text-xs font-bold text-slate-200">
            <UserPlus className="w-4 h-4 text-emerald-400" />
            <span>添加员工到项目</span>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-[1fr_180px_auto] gap-3">
            <select
              value={selectedUserId}
              onChange={event => setSelectedUserId(event.target.value)}
              className="bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-xs text-slate-200 outline-none focus:border-indigo-500"
              required
            >
              <option value="">选择尚未加入项目的员工</option>
              {availableUsers.map(candidate => (
                <option key={candidate.id} value={candidate.id}>
                  {candidate.name} · {candidate.department || '未分配部门'} · {candidate.email}
                </option>
              ))}
            </select>
            <select
              value={projectRole}
              onChange={event => setProjectRole(event.target.value as UserRole)}
              className="bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-xs text-slate-200 outline-none focus:border-indigo-500"
            >
              {Object.entries(roleLabels).map(([value, label]) => (
                <option key={value} value={value}>{label}</option>
              ))}
            </select>
            <button
              type="submit"
              disabled={isSaving || !selectedUserId}
              className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 rounded-lg text-xs text-white font-bold flex items-center justify-center space-x-1.5"
            >
              {isSaving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Plus className="w-3.5 h-3.5" />}
              <span>添加成员</span>
            </button>
          </div>
          {availableUsers.length === 0 && (
            <p className="mt-2 text-[10px] text-slate-500">所有已启用员工都已加入当前项目。</p>
          )}
        </form>
      )}

      {(actionError || error) && (
        <div className="px-3 py-2.5 bg-rose-500/10 border border-rose-500/30 rounded-lg text-xs text-rose-300">
          {actionError || error}
        </div>
      )}

      {isMembersLoading && members.length === 0 ? (
        <div className="h-40 flex items-center justify-center text-xs text-slate-400 space-x-2">
          <Loader2 className="w-4 h-4 animate-spin text-indigo-400" />
          <span>正在读取项目成员…</span>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {members.map(member => (
            <div key={member.id} className="bg-slate-900 border border-slate-800 rounded-xl p-4 flex items-center justify-between gap-3">
              <div className="flex items-center space-x-3 min-w-0">
                {member.avatar ? (
                  <img src={member.avatar} alt={member.name} className="w-11 h-11 rounded-xl object-cover border border-slate-700" />
                ) : (
                  <div className="w-11 h-11 rounded-xl bg-indigo-600 flex items-center justify-center text-white font-bold">
                    {Array.from(member.name)[0] || 'U'}
                  </div>
                )}
                <div className="min-w-0">
                  <div className="text-sm font-bold text-white truncate">
                    {member.name}
                    {member.id === user?.id && <span className="ml-1.5 text-[9px] text-emerald-400">当前账号</span>}
                  </div>
                  <div className="text-[11px] text-indigo-400 truncate">{member.department || '未分配部门'}</div>
                  <div className="text-[10px] text-slate-500 truncate">{member.email}</div>
                  <div className="mt-1 inline-flex items-center space-x-1 text-[9px] text-amber-300">
                    <ShieldCheck className="w-3 h-3" />
                    <span>{roleLabels[member.projectRole]}</span>
                  </div>
                </div>
              </div>
              {canManage && member.id !== user?.id && (
                <button
                  onClick={() => void handleRemoveMember(member.id, member.name)}
                  className="p-1.5 text-slate-500 hover:text-rose-400 hover:bg-rose-500/10 rounded-lg shrink-0"
                  title="移出项目"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

