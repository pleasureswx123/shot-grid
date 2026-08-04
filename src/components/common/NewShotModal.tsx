import React, { useState } from 'react';
import { useApp } from '../../context/AppContext';
import { Loader2, X, Video } from 'lucide-react';

interface NewShotModalProps {
  onClose: () => void;
}

export const NewShotModal: React.FC<NewShotModalProps> = ({ onClose }) => {
  const { addShot, scenes, shots, assets } = useApp();

  const [shotCode, setShotCode] = useState<string>(
    `SH${String(shots.length + 1).padStart(3, '0')}`,
  );
  const [sceneCode, setSceneCode] = useState<string>(scenes[0]?.sceneCode || 'SC01');
  const [durationSec, setDurationSec] = useState<number>(5);
  const [shotType, setShotType] = useState<string>('特写 (Close Up)');
  const [cameraMovement, setCameraMovement] = useState<string>('缓慢推进 (Push In)');
  const [description, setDescription] = useState<string>('太空舱室应急阀爆开，红光扫过人物面部。');
  const [dialogue, setDialogue] = useState<string>('警告：舱室失压！');
  const [selectedAssetIds, setSelectedAssetIds] = useState<string[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setError(null);
    try {
      await addShot({
        shotCode,
        sceneCode,
        durationSec,
        shotType,
        cameraMovement,
        description,
        dialogue,
        assetIds: selectedAssetIds
      });
      onClose();
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : '创建镜头失败。');
    } finally {
      setIsSubmitting(false);
    }
  };

  const toggleAsset = (assetId: string) => {
    if (selectedAssetIds.includes(assetId)) {
      setSelectedAssetIds(selectedAssetIds.filter(id => id !== assetId));
    } else {
      setSelectedAssetIds([...selectedAssetIds, assetId]);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 w-full max-w-lg text-slate-100 shadow-2xl space-y-4">
        <div className="flex items-center justify-between border-b border-slate-800 pb-3">
          <div className="flex items-center space-x-2">
            <Video className="w-5 h-5 text-indigo-400" />
            <h2 className="text-base font-bold text-white">新建影视镜头 (New Shot)</h2>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-white p-1 rounded">
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-3 text-xs">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-slate-400 font-semibold block mb-1">镜头编号 (Shot Code)</label>
              <input
                type="text"
                value={shotCode}
                onChange={e => setShotCode(e.target.value)}
                className="w-full bg-slate-800 border border-slate-700 rounded p-2 text-xs text-white font-mono font-bold"
                required
              />
            </div>

            <div>
              <label className="text-slate-400 font-semibold block mb-1">所属场次 (Scene)</label>
              <input
                list="shot-scene-options"
                value={sceneCode}
                onChange={e => setSceneCode(e.target.value)}
                className="w-full bg-slate-800 border border-slate-700 rounded p-2 text-xs text-slate-200"
                placeholder="例如 SC01"
                required
              />
              <datalist id="shot-scene-options">
                {scenes.map(sc => (
                  <option key={sc.id} value={sc.sceneCode}>
                    {sc.sceneCode} - {sc.name}
                  </option>
                ))}
              </datalist>
            </div>
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="text-slate-400 font-semibold block mb-1">时长 (秒)</label>
              <input
                type="number"
                value={durationSec}
                onChange={e => setDurationSec(Number(e.target.value))}
                className="w-full bg-slate-800 border border-slate-700 rounded p-2 text-xs text-amber-400 font-mono font-bold"
              />
            </div>

            <div>
              <label className="text-slate-400 font-semibold block mb-1">景别 (Shot Type)</label>
              <select
                value={shotType}
                onChange={e => setShotType(e.target.value)}
                className="w-full bg-slate-800 border border-slate-700 rounded p-2 text-xs text-slate-200"
              >
                <option value="特写 (Close Up)">特写 (Close Up)</option>
                <option value="中近景 (Medium Close)">中近景 (Medium Close)</option>
                <option value="中景 (Medium)">中景 (Medium)</option>
                <option value="全景 (Wide)">全景 (Wide)</option>
                <option value="远景 (Extreme Long)">远景 (Extreme Long)</option>
              </select>
            </div>

            <div>
              <label className="text-slate-400 font-semibold block mb-1">运镜 (Camera Motion)</label>
              <select
                value={cameraMovement}
                onChange={e => setCameraMovement(e.target.value)}
                className="w-full bg-slate-800 border border-slate-700 rounded p-2 text-xs text-slate-200"
              >
                <option value="缓慢推进 (Push In)">缓慢推进 (Push In)</option>
                <option value="快速甩镜头 (Whip Pan)">快速甩镜头 (Whip Pan)</option>
                <option value="环绕航拍 (Orbit)">环绕航拍 (Orbit)</option>
                <option value="固定镜头 (Static)">固定镜头 (Static)</option>
              </select>
            </div>
          </div>

          <div>
            <label className="text-slate-400 font-semibold block mb-1">台本镜头描述</label>
            <textarea
              value={description}
              onChange={e => setDescription(e.target.value)}
              className="w-full bg-slate-800 border border-slate-700 rounded p-2 text-xs text-slate-200 h-16 resize-none"
              required
            />
          </div>

          <div>
            <label className="text-slate-400 font-semibold block mb-1">台词或音效表演</label>
            <input
              type="text"
              value={dialogue}
              onChange={e => setDialogue(e.target.value)}
              className="w-full bg-slate-800 border border-slate-700 rounded p-2 text-xs text-slate-200"
            />
          </div>

          <div>
            <label className="text-slate-400 font-semibold block mb-1">勾选关联核心资产</label>
            <div className="flex flex-wrap gap-2 pt-1">
              {assets.map(a => (
                <button
                  key={a.id}
                  type="button"
                  onClick={() => toggleAsset(a.id)}
                  className={`px-2.5 py-1 rounded text-xs transition border ${
                    selectedAssetIds.includes(a.id)
                      ? 'bg-indigo-600 text-white border-indigo-500'
                      : 'bg-slate-800 text-slate-400 border-slate-700'
                  }`}
                >
                  {a.category}: {a.name}
                </button>
              ))}
            </div>
          </div>

          {error && (
            <div className="rounded-lg border border-rose-500/30 bg-rose-500/10 px-3 py-2.5 text-xs text-rose-300">
              {error}
            </div>
          )}

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
              disabled={isSubmitting}
              className="px-5 py-1.5 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-60 text-white rounded text-xs font-bold flex items-center gap-1.5"
            >
              {isSubmitting && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
              {isSubmitting ? '正在创建本地目录…' : '新建镜头、目录和视频任务'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
