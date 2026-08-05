import React, { useEffect, useState } from 'react';
import {
  Loader2, Plus, RefreshCw, ShieldCheck, UserPlus, Users, X
} from 'lucide-react';
import type { UserRole } from '../../types';

interface ManagedUser {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  department: string;
  avatar: string | null;
  isActive: boolean;
  createdAt: string;
}

interface UserManagementModalProps {
  onClose: () => void;
}

const roleLabels: Record<UserRole, string> = {
  admin: '管理员',
  director: '项目总监',
  creator: '制作人员',
  client: '外部审核',
};

const parseError = async (response: Response): Promise<string> => {
  try {
    const body = await response.json();
    if (typeof body?.error === 'string') return body.error;
  } catch {
    // Ignore malformed error bodies.
  }
  return `请求失败（${response.status}）`;
};

const roleDescriptions: Record<UserRole, string> = {
  admin: '可查看/编辑项目、管理成员、创建任务和审核单、提交/审核版本、评论审核、删除文件。',
  director: '可管理成员与内容流程，具备创建任务、审核单、提交/审核版本、评论审核、删除文件权限。',
  creator: '可查看项目、创建任务、提交版本、回复审核意见和参与评论，不能管理成员或删除文件。',
  client: '可查看项目、查看审核单、评论审核并参与版本审核，不能提交版本或改动项目设置。',
};

export const UserManagementModal: React.FC<UserManagementModalProps> = ({ onClose }) => {
  const [users, setUsers] = useState<ManagedUser[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isCreating, setIsCreating] = useState(false);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [department, setDepartment] = useState('');
  const [role, setRole] = useState<UserRole>('creator');
  const [password, setPassword] = useState('');

  const loadUsers = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const response = await fetch('/api/admin/users', { credentials: 'same-origin' });
      if (!response.ok) throw new Error(await parseError(response));
      const body = await response.json();
      setUsers(body.users);
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : '无法读取员工账号。');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    void loadUsers();
  }, []);

  const handleCreate = async (event: React.FormEvent) => {
    event.preventDefault();
    setIsCreating(true);
    setError(null);

    try {
      const response = await fetch('/api/admin/users', {
        method: 'POST',
        credentials: 'same-origin',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, email, department, role, password }),
      });
      if (!response.ok) throw new Error(await parseError(response));
      const body = await response.json();
      setUsers((current) => [...current, body.user].sort((a, b) => a.name.localeCompare(b.name, 'zh-CN')));
      setName('');
      setEmail('');
      setDepartment('');
      setRole('creator');
      setPassword('');
      setShowCreateForm(false);
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : '创建账号失败。');
    } finally {
      setIsCreating(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[80] bg-slate-950/85 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="w-full max-w-4xl max-h-[88vh] overflow-hidden bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl flex flex-col">
        <div className="px-5 py-4 border-b border-slate-800 flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="w-9 h-9 rounded-lg bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center">
              <Users className="w-5 h-5 text-indigo-400" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-white">员工账号管理</h2>
              <p className="text-[11px] text-slate-400">账号保存在工作室服务器，员工不能自行注册。</p>
            </div>
          </div>
          <button onClick={onClose} className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="px-5 py-3 border-b border-slate-800 flex items-center justify-between">
          <div className="flex items-center space-x-2 text-xs text-slate-400">
            <ShieldCheck className="w-4 h-4 text-emerald-400" />
            <span>共 {users.length} 个账号</span>
          </div>
          <div className="flex items-center space-x-2">
            <button
              onClick={() => void loadUsers()}
              className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 rounded-lg text-xs text-slate-300 flex items-center space-x-1.5"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin' : ''}`} />
              <span>刷新</span>
            </button>
            <button
              onClick={() => setShowCreateForm((value) => !value)}
              className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-500 rounded-lg text-xs text-white font-bold flex items-center space-x-1.5"
            >
              <UserPlus className="w-3.5 h-3.5" />
              <span>新建员工账号</span>
            </button>
          </div>
        </div>

        {showCreateForm && (
          <form onSubmit={handleCreate} className="p-5 border-b border-slate-800 bg-slate-950/35">
            <div className="grid grid-cols-1 md:grid-cols-5 gap-3">
              <input
                value={name}
                onChange={(event) => setName(event.target.value)}
                placeholder="员工姓名"
                className="bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-xs text-white outline-none focus:border-indigo-500"
                required
              />
              <input
                type="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                placeholder="内部邮箱"
                className="bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-xs text-white outline-none focus:border-indigo-500"
                required
              />
              <input
                value={department}
                onChange={(event) => setDepartment(event.target.value)}
                placeholder="部门"
                className="bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-xs text-white outline-none focus:border-indigo-500"
              />
              <select
                value={role}
                onChange={(event) => setRole(event.target.value as UserRole)}
                className="bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-xs text-slate-200 outline-none focus:border-indigo-500"
              >
                {Object.entries(roleLabels).map(([value, label]) => (
                  <option key={value} value={value}>{label}｜{roleDescriptions[value as UserRole]}</option>
                ))}
              </select>
              <input
                type="password"
                minLength={10}
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                placeholder="初始密码（至少10位）"
                className="bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-xs text-white outline-none focus:border-indigo-500"
                required
              />
            </div>
            <div className="mt-3 grid grid-cols-1 md:grid-cols-2 gap-2">
              {Object.entries(roleDescriptions).map(([value, description]) => (
                <div key={value} className="rounded-lg border border-slate-800 bg-slate-950/50 p-2 text-[10px] text-slate-400">
                  <span className="font-bold text-slate-200">{roleLabels[value as UserRole]}</span>：{description}
                </div>
              ))}
            </div>
            <div className="mt-3 flex justify-end">
              <button
                type="submit"
                disabled={isCreating}
                className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-60 text-white rounded-lg text-xs font-bold flex items-center space-x-1.5"
              >
                {isCreating ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Plus className="w-3.5 h-3.5" />}
                <span>{isCreating ? '正在创建…' : '创建账号'}</span>
              </button>
            </div>
          </form>
        )}

        {error && (
          <div className="mx-5 mt-4 px-3 py-2 bg-rose-500/10 border border-rose-500/30 rounded-lg text-xs text-rose-300">
            {error}
          </div>
        )}

        <div className="flex-1 overflow-y-auto p-5">
          {isLoading && users.length === 0 ? (
            <div className="h-40 flex items-center justify-center text-xs text-slate-400 space-x-2">
              <Loader2 className="w-4 h-4 animate-spin text-indigo-400" />
              <span>正在读取员工账号…</span>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {users.map((user) => (
                <div key={user.id} className="p-3.5 bg-slate-950/50 border border-slate-800 rounded-xl flex items-center justify-between">
                  <div className="flex items-center space-x-3 min-w-0">
                    {user.avatar ? (
                      <img src={user.avatar} alt={user.name} className="w-10 h-10 rounded-lg object-cover" />
                    ) : (
                      <div className="w-10 h-10 rounded-lg bg-indigo-600 text-white flex items-center justify-center font-bold">
                        {Array.from(user.name)[0] || 'U'}
                      </div>
                    )}
                    <div className="min-w-0">
                      <div className="text-xs font-bold text-white truncate">{user.name}</div>
                      <div className="text-[10px] text-slate-400 truncate">{user.email}</div>
                      <div className="text-[10px] text-slate-500 truncate">{user.department || '未分配部门'}</div>
                    </div>
                  </div>
                  <div className="text-right shrink-0 ml-3">
                    <span className="px-2 py-1 bg-indigo-500/10 border border-indigo-500/20 text-indigo-300 rounded text-[10px]">
                      {roleLabels[user.role]}
                    </span>
                    <div className="mt-1.5 max-w-56 text-[9px] leading-relaxed text-slate-500">
                      {roleDescriptions[user.role]}
                    </div>
                    <div className={`mt-1.5 text-[9px] ${user.isActive ? 'text-emerald-400' : 'text-slate-500'}`}>
                      {user.isActive ? '已启用' : '已停用'}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

