import React from 'react';
import { useApp, MainTab } from '../context/AppContext';
import {
  LayoutDashboard, FolderKanban, Film, Box, PlaySquare, FolderTree, AlertCircle, MessageSquare
} from 'lucide-react';

export const SidebarNav: React.FC = () => {
  const { activeTab, setActiveTab, shots, tasks, channels } = useApp();

  const pendingReviewCount = shots.filter(s => s.status === '审核中').length;
  const pendingTaskCount = tasks.filter(t => t.status === '待审核' || t.status === '修改中').length;
  const totalUnreadMessages = channels?.reduce((acc, c) => acc + (c.unreadCount || 0), 0) || 0;

  const navItems: Array<{ id: MainTab; label: string; icon: React.ReactNode; badge?: number }> = [
    {
      id: 'workbench',
      label: '我的工作台',
      icon: <LayoutDashboard className="w-4 h-4" />,
      badge: pendingTaskCount > 0 ? pendingTaskCount : undefined
    },
    {
      id: 'communication',
      label: '部门员工交流',
      icon: <MessageSquare className="w-4 h-4" />,
      badge: totalUnreadMessages > 0 ? totalUnreadMessages : undefined
    },
    {
      id: 'project',
      label: '项目概况',
      icon: <FolderKanban className="w-4 h-4" />
    },
    {
      id: 'shots',
      label: '镜头管理',
      icon: <Film className="w-4 h-4" />,
      badge: shots.length
    },
    {
      id: 'assets',
      label: '资产库',
      icon: <Box className="w-4 h-4" />
    },
    {
      id: 'review',
      label: '版本审核',
      icon: <PlaySquare className="w-4 h-4" />,
      badge: pendingReviewCount > 0 ? pendingReviewCount : undefined
    },
    {
      id: 'files',
      label: '文件与NAS',
      icon: <FolderTree className="w-4 h-4" />
    }
  ];

  return (
    <aside className="w-52 bg-slate-900 border-r border-slate-800 flex flex-col justify-between select-none">
      <div className="p-3 space-y-1">
        <div className="px-3 py-1 text-[11px] font-semibold text-slate-500 uppercase tracking-wider">
          ShotGrid 核心模块
        </div>

        {navItems.map(item => {
          const isActive = activeTab === item.id;
          return (
            <button
              key={item.id}
              onClick={() => setActiveTab(item.id)}
              className={`w-full flex items-center justify-between px-3 py-2.5 rounded-lg text-xs font-medium transition ${
                isActive
                  ? 'bg-indigo-600/20 text-indigo-300 border border-indigo-500/30'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
              }`}
            >
              <div className="flex items-center space-x-2.5">
                <span className={isActive ? 'text-indigo-400' : 'text-slate-400'}>{item.icon}</span>
                <span>{item.label}</span>
              </div>
              {item.badge !== undefined && (
                <span className={`px-1.5 py-0.2 text-[10px] rounded-full font-mono font-semibold ${
                  isActive ? 'bg-indigo-500 text-white' : 'bg-slate-800 text-slate-400 border border-slate-700'
                }`}>
                  {item.badge}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* Footer Info */}
      <div className="p-3 border-t border-slate-800 text-[11px] text-slate-500 space-y-1">
        <div className="flex items-center space-x-1.5 text-slate-400">
          <AlertCircle className="w-3.5 h-3.5 text-amber-400" />
          <span className="font-semibold">轻量管线模式</span>
        </div>
        <p className="text-[10px] leading-relaxed text-slate-500">
          镜头与资产 -&gt; 任务 -&gt; 版本提交 -&gt; 动态集评
        </p>
      </div>
    </aside>
  );
};
