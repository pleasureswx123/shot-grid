import React, { useState } from 'react';
import { Clapperboard, FolderPlus, Loader2, Server } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useWorkspace } from '../../context/WorkspaceContext';

export const ProjectSetupView: React.FC = () => {
  const { user } = useAuth();
  const { createProject, error } = useWorkspace();
  const [name, setName] = useState('');
  const [code, setCode] = useState('');
  const [type, setType] = useState('AI影视短片');
  const [aspectRatio, setAspectRatio] = useState('16:9');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [localError, setLocalError] = useState<string | null>(null);

  const canCreate = user?.role === 'admin' || user?.role === 'director';

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setIsSubmitting(true);
    setLocalError(null);
    try {
      await createProject({ name, code, type, aspectRatio });
    } catch (requestError) {
      setLocalError(requestError instanceof Error ? requestError.message : '创建项目失败。');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <main className="min-h-screen bg-slate-950 text-slate-100 flex items-center justify-center p-6">
      <div className="w-full max-w-lg">
        <div className="flex items-center justify-center space-x-3 mb-7">
          <div className="w-11 h-11 rounded-xl bg-indigo-600 flex items-center justify-center">
            <Clapperboard className="w-6 h-6" />
          </div>
          <div>
            <h1 className="font-black">ShotGrid Light</h1>
            <p className="text-xs text-slate-400">项目工作区初始化</p>
          </div>
        </div>

        <section className="bg-slate-900 border border-slate-800 rounded-2xl p-7 shadow-2xl">
          {canCreate ? (
            <>
              <div className="mb-6">
                <h2 className="text-lg font-bold">创建第一个工作室项目</h2>
                <p className="text-xs text-slate-400 mt-1">
                  项目关系保存在局域网数据库，同时在服务器磁盘生成标准文件架构。
                </p>
              </div>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="grid grid-cols-2 gap-3">
                  <label className="col-span-2">
                    <span className="text-xs text-slate-400">项目名称</span>
                    <input
                      value={name}
                      onChange={event => setName(event.target.value)}
                      className="mt-1.5 w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2.5 text-sm outline-none focus:border-indigo-500"
                      placeholder="例如：无泥之地 EP01"
                      required
                    />
                  </label>
                  <label>
                    <span className="text-xs text-slate-400">项目代号</span>
                    <input
                      value={code}
                      onChange={event => setCode(event.target.value.toUpperCase())}
                      className="mt-1.5 w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2.5 text-sm font-mono outline-none focus:border-indigo-500"
                      placeholder="NOMUD"
                      pattern="[A-Za-z0-9_-]{2,40}"
                      required
                    />
                  </label>
                  <label>
                    <span className="text-xs text-slate-400">画幅</span>
                    <select
                      value={aspectRatio}
                      onChange={event => setAspectRatio(event.target.value)}
                      className="mt-1.5 w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2.5 text-sm outline-none focus:border-indigo-500"
                    >
                      <option>16:9</option>
                      <option>2.39:1</option>
                      <option>9:16</option>
                      <option>1:1</option>
                    </select>
                  </label>
                </div>
                <label className="block">
                  <span className="text-xs text-slate-400">项目类型</span>
                  <input
                    value={type}
                    onChange={event => setType(event.target.value)}
                    className="mt-1.5 w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2.5 text-sm outline-none focus:border-indigo-500"
                  />
                </label>
                {(localError || error) && (
                  <div className="px-3 py-2.5 bg-rose-500/10 border border-rose-500/30 rounded-lg text-xs text-rose-300">
                    {localError || error}
                  </div>
                )}
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="w-full h-10 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-60 rounded-lg text-sm font-bold flex items-center justify-center space-x-2"
                >
                  {isSubmitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <FolderPlus className="w-4 h-4" />}
                  <span>{isSubmitting ? '正在创建…' : '创建项目工作区'}</span>
                </button>
              </form>
            </>
          ) : (
            <div className="py-8 text-center">
              <Server className="w-10 h-10 text-slate-600 mx-auto mb-3" />
              <h2 className="font-bold">尚未分配项目</h2>
              <p className="text-xs text-slate-400 mt-2">请联系管理员或项目总监，将您的账号加入一个项目。</p>
            </div>
          )}
        </section>
      </div>
    </main>
  );
};
