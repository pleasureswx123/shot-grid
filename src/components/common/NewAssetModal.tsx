import React, { useState } from 'react';
import { useApp } from '../../context/AppContext';
import { X, FolderOpen } from 'lucide-react';
import { AssetCategory } from '../../types';

interface NewAssetModalProps {
  onClose: () => void;
}

export const NewAssetModal: React.FC<NewAssetModalProps> = ({ onClose }) => {
  const { addAsset, currentUser, apiStatus } = useApp();

  const [name, setName] = useState<string>('逃生救生艇');
  const [category, setCategory] = useState<AssetCategory>('载具');
  const [thumbnailUrl, setThumbnailUrl] = useState<string>('https://images.unsplash.com/photo-1518709268805-4e9042af9f23?w=600&auto=format&fit=crop&q=80');
  const [description, setDescription] = useState<string>('双人高压逃生救生艇，拥有重型防爆装甲与脉冲发动机。');
  const [promptTemplate, setPromptTemplate] = useState<string>('Futuristic escape pod, sleek carbon fiber hull, glowing thrusters, sci-fi concept art --ar 2.39:1');
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    try {
      await addAsset({
        name,
        category,
        thumbnailUrl,
        description,
        promptTemplate,
        assigneeId: currentUser.id,
      });
      onClose();
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : '保存资产失败。');
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 w-full max-w-lg text-slate-100 shadow-2xl space-y-4">
        <div className="flex items-center justify-between border-b border-slate-800 pb-3">
          <div className="flex items-center space-x-2">
            <FolderOpen className="w-5 h-5 text-amber-400" />
            <h2 className="text-base font-bold text-white">新建美术资产 (New Asset)</h2>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-white p-1 rounded">
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-3 text-xs">
          {(error || apiStatus.error) && (
            <div className="rounded-lg border border-rose-500/40 bg-rose-500/10 p-2 text-rose-200">
              {apiStatus.permissionDenied
                ? '权限不足，无法新建资产。'
                : apiStatus.conflict
                  ? '保存冲突，请刷新后重试。'
                  : error || apiStatus.error}
            </div>
          )}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-slate-400 font-semibold block mb-1">资产名称</label>
              <input
                type="text"
                value={name}
                onChange={e => setName(e.target.value)}
                className="w-full bg-slate-800 border border-slate-700 rounded p-2 text-xs text-white font-bold"
                required
              />
            </div>

            <div>
              <label className="text-slate-400 font-semibold block mb-1">资产分类</label>
              <select
                value={category}
                onChange={e => setCategory(e.target.value as any)}
                className="w-full bg-slate-800 border border-slate-700 rounded p-2 text-xs text-slate-200"
              >
                <option value="角色">角色</option>
                <option value="场景">场景</option>
                <option value="道具">道具</option>
                <option value="服装">服装</option>
                <option value="载具">载具</option>
                <option value="生物">生物</option>
                <option value="风格参考">风格参考</option>
              </select>
            </div>
          </div>

          <div>
            <label className="text-slate-400 font-semibold block mb-1">资产缩略图 URL</label>
            <input
              type="text"
              value={thumbnailUrl}
              onChange={e => setThumbnailUrl(e.target.value)}
              className="w-full bg-slate-800 border border-slate-700 rounded p-2 text-xs text-slate-200 font-mono"
            />
          </div>

          <div>
            <label className="text-slate-400 font-semibold block mb-1">资产设定说明</label>
            <textarea
              value={description}
              onChange={e => setDescription(e.target.value)}
              className="w-full bg-slate-800 border border-slate-700 rounded p-2 text-xs text-slate-200 h-16 resize-none"
              required
            />
          </div>

          <div>
            <label className="text-slate-400 font-semibold block mb-1">AI 提示词模板 (Prompt)</label>
            <textarea
              value={promptTemplate}
              onChange={e => setPromptTemplate(e.target.value)}
              className="w-full bg-slate-800 border border-slate-700 rounded p-2 text-xs font-mono text-emerald-300 h-16 resize-none"
            />
          </div>

          <div className="flex justify-end space-x-2 pt-3 border-t border-slate-800">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded text-xs"
            >
              取消
            </button>
            <button
              type="submit"
              disabled={apiStatus.isSaving}
              className="px-5 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded text-xs font-bold"
            >
              {apiStatus.isSaving ? '保存中…' : '创建资产'}并建立任务
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
