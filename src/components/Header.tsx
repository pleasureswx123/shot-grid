import React, { useState } from 'react';
import { useApp } from '../context/AppContext';
import { useAuth } from '../context/AuthContext';
import {
  Clapperboard, User, Shield, Video, Layers, Plus,
  Sparkles, FolderOpen, CheckCircle, ChevronDown, LogOut, Building2, Users, FileClock
} from 'lucide-react';
import { UserRole } from '../types';
import { UserManagementModal } from './admin/UserManagementModal';
import { AuditLogsModal } from './admin/AuditLogsModal';
import { useWorkspace } from '../context/WorkspaceContext';
import { NewProjectModal } from './project/NewProjectModal';
import { GlobalSearch } from './GlobalSearch';

interface HeaderProps {
  onOpenNewShot: () => void;
  onOpenNewAsset: () => void;
  onOpenNewVersion: () => void;
  onOpenImportExcel: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  onOpenNewShot,
  onOpenNewAsset,
  onOpenNewVersion,
  onOpenImportExcel
}) => {
  const { currentUser, project } = useApp();
  const { logout } = useAuth();
  const { projects, setSelectedProjectId } = useWorkspace();
  const [showRoleDropdown, setShowRoleDropdown] = useState(false);
  const [showAddDropdown, setShowAddDropdown] = useState(false);
  const [showUserManagement, setShowUserManagement] = useState(false);
  const [showAuditLogs, setShowAuditLogs] = useState(false);
  const [showNewProject, setShowNewProject] = useState(false);

  const getRoleBadge = (role: UserRole) => {
    switch (role) {
      case 'admin':
        return <span className="px-2 py-0.5 text-xs font-medium bg-purple-500/10 text-purple-400 border border-purple-500/20 rounded">管理员</span>;
      case 'director':
        return <span className="px-2 py-0.5 text-xs font-medium bg-amber-500/10 text-amber-400 border border-amber-500/20 rounded">项目总监</span>;
      case 'creator':
        return <span className="px-2 py-0.5 text-xs font-medium bg-blue-500/10 text-blue-400 border border-blue-500/20 rounded">制作人员</span>;
      case 'client':
        return <span className="px-2 py-0.5 text-xs font-medium bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 rounded">外部审核</span>;
    }
  };

  return (
    <header className="h-14 bg-slate-900 border-b border-slate-800 px-4 flex items-center justify-between sticky top-0 z-40 text-slate-100">
      {/* Left: App Logo & Active Project */}
      <div className="flex items-center space-x-4">
        <div className="flex items-center space-x-2">
          <div className="w-8 h-8 rounded-lg bg-indigo-600 flex items-center justify-center text-white shadow-md shadow-indigo-600/30">
            <Clapperboard className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center space-x-1.5">
              <span className="font-bold text-sm tracking-wide text-white">ShotGrid Light</span>
              <span className="text-[10px] px-1.5 py-0.2 bg-indigo-500/20 text-indigo-300 rounded font-mono">AI Studio</span>
            </div>
            <p className="text-[10px] text-slate-400 leading-none mt-0.5">AI影视项目管理系统</p>
          </div>
        </div>

        <div className="h-5 w-px bg-slate-800" />

        {/* Current Project Badge */}
        <div className="flex items-center space-x-2 px-2.5 py-1 bg-slate-800/80 rounded-md border border-slate-700/60">
          <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
          {projects.length > 1 ? (
            <select
              value={project.id}
              onChange={event => setSelectedProjectId(event.target.value)}
              className="max-w-56 bg-transparent text-xs font-semibold text-slate-200 outline-none cursor-pointer"
              title="切换项目"
            >
              {projects.map(item => (
                <option key={item.id} value={item.id} className="bg-slate-800">
                  {item.name}
                </option>
              ))}
            </select>
          ) : (
            <span className="text-xs font-semibold text-slate-200">{project.name}</span>
          )}
          <span className="text-[10px] text-slate-400 font-mono">[{project.code}]</span>
          <span className="text-[10px] bg-slate-700 text-slate-300 px-1.5 py-0.5 rounded">{project.currentPhase}</span>
          {(currentUser.role === 'admin' || currentUser.role === 'director') && (
            <button
              onClick={() => setShowNewProject(true)}
              className="p-0.5 text-slate-400 hover:text-indigo-300 rounded"
              title="新建项目"
            >
              <Plus className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      </div>

      {/* Right: Search, Actions, Role Switcher */}
      <div className="flex items-center space-x-3">
        <GlobalSearch />
        {/* Quick Add Menu */}
        <div className="relative">
          <button
            onClick={() => setShowAddDropdown(!showAddDropdown)}
            className="flex items-center space-x-1.5 px-3 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-md text-xs font-medium transition shadow-sm"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>新建实体</span>
            <ChevronDown className="w-3 h-3 opacity-70" />
          </button>

          {showAddDropdown && (
            <div
              className="absolute right-0 mt-1.5 w-44 bg-slate-800 border border-slate-700 rounded-lg shadow-xl z-50 py-1 text-xs"
              onMouseLeave={() => setShowAddDropdown(false)}
            >
              <button
                onClick={() => { setShowAddDropdown(false); onOpenNewShot(); }}
                className="w-full text-left px-3 py-2 hover:bg-slate-700 flex items-center space-x-2 text-slate-200"
              >
                <Video className="w-4 h-4 text-indigo-400" />
                <span>新建镜头 (Shot)</span>
              </button>
              <button
                onClick={() => { setShowAddDropdown(false); onOpenImportExcel(); }}
                className="w-full text-left px-3 py-2 hover:bg-slate-700 flex items-center space-x-2 text-slate-200"
              >
                <Layers className="w-4 h-4 text-emerald-400" />
                <span>导入镜头表 (Excel/CSV)</span>
              </button>
              <button
                onClick={() => { setShowAddDropdown(false); onOpenNewAsset(); }}
                className="w-full text-left px-3 py-2 hover:bg-slate-700 flex items-center space-x-2 text-slate-200"
              >
                <FolderOpen className="w-4 h-4 text-amber-400" />
                <span>新建资产 (Asset)</span>
              </button>
              <button
                onClick={() => { setShowAddDropdown(false); onOpenNewVersion(); }}
                className="w-full text-left px-3 py-2 hover:bg-slate-700 flex items-center space-x-2 text-slate-200 border-t border-slate-700/60"
              >
                <Sparkles className="w-4 h-4 text-purple-400" />
                <span>提交新版本 (Version)</span>
              </button>
            </div>
          )}
        </div>

        {/* Authenticated account menu */}
        <div className="relative">
          <button
            onClick={() => setShowRoleDropdown(!showRoleDropdown)}
            className="flex items-center space-x-2.5 px-2.5 py-1.5 bg-slate-800 hover:bg-slate-700/80 border border-slate-700 rounded-md text-xs transition"
          >
            <img src={currentUser.avatar} alt={currentUser.name} className="w-5 h-5 rounded-full object-cover border border-slate-600" />
            <div className="text-left">
              <div className="flex items-center space-x-1">
                <span className="font-medium text-slate-200">{currentUser.name}</span>
                {getRoleBadge(currentUser.role)}
              </div>
            </div>
            <ChevronDown className="w-3.5 h-3.5 text-slate-400" />
          </button>

          {showRoleDropdown && (
            <div
              className="absolute right-0 mt-1.5 w-64 bg-slate-800 border border-slate-700 rounded-lg shadow-xl z-50 py-1"
              onMouseLeave={() => setShowRoleDropdown(false)}
            >
              <div className="px-3 py-3 border-b border-slate-700">
                <div className="flex items-center space-x-2.5">
                  <img src={currentUser.avatar} alt={currentUser.name} className="w-9 h-9 rounded-lg object-cover" />
                  <div className="min-w-0">
                    <div className="text-xs font-bold text-white truncate">{currentUser.name}</div>
                    <div className="text-[10px] text-slate-400 truncate">{currentUser.email}</div>
                  </div>
                </div>
                <div className="mt-2 flex items-center justify-between">
                  <span className="flex items-center space-x-1 text-[10px] text-slate-400">
                    <Building2 className="w-3 h-3" />
                    <span>{currentUser.department || '未分配部门'}</span>
                  </span>
                  {getRoleBadge(currentUser.role)}
                </div>
              </div>
              {currentUser.role === 'admin' && (
                <button
                  onClick={() => {
                    setShowRoleDropdown(false);
                    setShowUserManagement(true);
                  }}
                  className="w-full px-3 py-2.5 text-left text-xs text-slate-200 hover:bg-slate-700 flex items-center space-x-2 transition"
                >
                  <Users className="w-4 h-4 text-indigo-400" />
                  <span>员工账号管理</span>
                </button>
              )}
              {currentUser.role === 'admin' && (
                <button
                  onClick={() => {
                    setShowRoleDropdown(false);
                    setShowAuditLogs(true);
                  }}
                  className="w-full px-3 py-2.5 text-left text-xs text-slate-200 hover:bg-slate-700 flex items-center space-x-2 transition"
                >
                  <FileClock className="w-4 h-4 text-cyan-400" />
                  <span>审计日志</span>
                </button>
              )}
              <button
                onClick={() => {
                  setShowRoleDropdown(false);
                  void logout();
                }}
                className="w-full px-3 py-2.5 text-left text-xs text-rose-300 hover:bg-rose-500/10 flex items-center space-x-2 transition"
              >
                <LogOut className="w-4 h-4" />
                <span>退出登录</span>
              </button>
            </div>
          )}
        </div>

      </div>
      {showUserManagement && (
        <UserManagementModal onClose={() => setShowUserManagement(false)} />
      )}
      {showNewProject && (
        <NewProjectModal onClose={() => setShowNewProject(false)} />
      )}
      {showAuditLogs && (
        <AuditLogsModal onClose={() => setShowAuditLogs(false)} />
      )}
    </header>
  );
};
