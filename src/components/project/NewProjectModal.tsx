import React, { useState } from 'react';
import { FolderPlus, Loader2, X } from 'lucide-react';
import { useWorkspace } from '../../context/WorkspaceContext';

export const NewProjectModal: React.FC<{ onClose: () => void }> = ({ onClose }) => {
  const { createProject } = useWorkspace();
  const [name, setName] = useState('');
  const [code, setCode] = useState('');
  const [type, setType] = useState('AI影视短片');
  const [aspectRatio, setAspectRatio] = useState('16:9');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setIsSubmitting(true);
    setError(null);
    try {
      await createProject({ name, code, type, aspectRatio });
      onClose();
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : '创建项目失败。');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[80] bg-slate-950/85 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="w-full max-w-lg bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl">
        <div className="px-5 py-4 border-b border-slate-800 flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <FolderPlus className="w-5 h-5 text-indigo-400" />
            <h2 className="text-sm font-bold text-white">新建项目工作区</h2>
          </div>
          <button onClick={onClose} className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800">
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          <label className="block">
            <span className="text-xs text-slate-400">项目名称</span>
            <input
              value={name}
              onChange={event => setName(event.target.value)}
              className="mt-1.5 w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2.5 text-sm text-white outline-none focus:border-indigo-500"
              required
            />
          </label>
          <div className="grid grid-cols-2 gap-3">
            <label>
              <span className="text-xs text-slate-400">项目代号</span>
              <input
                value={code}
                onChange={event => setCode(event.target.value.toUpperCase())}
                pattern="[A-Za-z0-9_-]{2,40}"
                className="mt-1.5 w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2.5 text-sm text-white font-mono outline-none focus:border-indigo-500"
                required
              />
            </label>
            <label>
              <span className="text-xs text-slate-400">画幅</span>
              <select
                value={aspectRatio}
                onChange={event => setAspectRatio(event.target.value)}
                className="mt-1.5 w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2.5 text-sm text-slate-200 outline-none focus:border-indigo-500"
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
              className="mt-1.5 w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2.5 text-sm text-white outline-none focus:border-indigo-500"
            />
          </label>
          <div className="rounded-lg border border-emerald-500/20 bg-emerald-500/5 px-3 py-2.5 text-[11px] leading-relaxed text-emerald-200">
            创建后将在服务器本地存储中生成项目资料、资产、镜头、声音、成片交付和交换目录。
            局域网成员通过本系统共同访问这些文件。
          </div>
          {error && (
            <div className="px-3 py-2.5 bg-rose-500/10 border border-rose-500/30 rounded-lg text-xs text-rose-300">
              {error}
            </div>
          )}
          <div className="flex justify-end space-x-2 pt-2">
            <button type="button" onClick={onClose} className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg text-xs">
              取消
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-60 text-white rounded-lg text-xs font-bold flex items-center space-x-1.5"
            >
              {isSubmitting && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
              <span>{isSubmitting ? '正在创建…' : '创建并切换'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
