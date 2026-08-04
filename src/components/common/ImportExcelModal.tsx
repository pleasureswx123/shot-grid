import React, { useState } from 'react';
import { useApp } from '../../context/AppContext';
import { X, FileSpreadsheet, CheckCircle, Loader2, Upload } from 'lucide-react';
import * as XLSX from 'xlsx';

interface ImportExcelModalProps {
  onClose: () => void;
}

export const ImportExcelModal: React.FC<ImportExcelModalProps> = ({ onClose }) => {
  const { importShotsFromData } = useApp();

  const [parsedRows, setParsedRows] = useState<Array<any>>([]);
  const [fileName, setFileName] = useState<string>('');
  const [isImporting, setIsImporting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Sample Preset Table
  const loadSampleScript = () => {
    const sampleData = [
      { sceneCode: 'SC01', shotCode: 'SH011', description: '控制室气压警报拉响，苟翱天抓紧主扶手', durationSec: 5, shotType: '特写', cameraMovement: '极速推镜头' },
      { sceneCode: 'SC01', shotCode: 'SH012', description: '红光爆闪，全息投影崩溃成火花与碎片', durationSec: 4, shotType: '中景', cameraMovement: '摇镜头' },
      { sceneCode: 'SC02', shotCode: 'SH013', description: '玻璃长廊震裂，苟翱天启动背部脉冲推进器', durationSec: 6, shotType: '全景', cameraMovement: '环绕跟拍' },
      { sceneCode: 'SC03', shotCode: 'SH014', description: '逃生舱合拢爆破离港，进入无重力漂浮状态', durationSec: 7, shotType: '远景', cameraMovement: '缓拉镜头' }
    ];
    setParsedRows(sampleData);
    setFileName('NoMud_EP01_台本镜头表_Sample.xlsx');
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setFileName(file.name);

    const reader = new FileReader();
    reader.onload = (evt) => {
      try {
        const bstr = evt.target?.result;
        const wb = XLSX.read(bstr, { type: 'binary' });
        const wsname = wb.SheetNames[0];
        const ws = wb.Sheets[wsname];
        const data = XLSX.utils.sheet_to_json<any>(ws);

        const mappedData = data.map((row: any) => ({
          sceneCode: row['场次'] || row['sceneCode'] || 'SC01',
          shotCode: row['镜头编号'] || row['shotCode'] || `SH${Math.floor(Math.random() * 900 + 100)}`,
          description: row['镜头描述'] || row['description'] || '导入镜头描述',
          durationSec: Number(row['时长']) || Number(row['durationSec']) || 5,
          shotType: row['景别'] || row['shotType'] || '中景',
          cameraMovement: row['运镜'] || row['cameraMovement'] || '固定镜头'
        }));

        setParsedRows(mappedData);
      } catch (err) {
        alert('读取Excel失败，请检查文件格式。');
      }
    };
    reader.readAsBinaryString(file);
  };

  const handleConfirmImport = async () => {
    if (parsedRows.length === 0) return;
    setIsImporting(true);
    setError(null);
    try {
      await importShotsFromData(parsedRows);
      onClose();
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : '导入镜头失败。');
    } finally {
      setIsImporting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 w-full max-w-2xl text-slate-100 shadow-2xl space-y-5">
        <div className="flex items-center justify-between border-b border-slate-800 pb-3">
          <div className="flex items-center space-x-2">
            <FileSpreadsheet className="w-5 h-5 text-emerald-400" />
            <h2 className="text-base font-bold text-white">批量导入台本/镜头表 (Excel / CSV)</h2>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-white p-1 rounded">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="space-y-4 text-xs">
          {/* File Upload Box */}
          <div className="border-2 border-dashed border-slate-700 hover:border-indigo-500 rounded-xl p-6 text-center space-y-2 bg-slate-800/30 transition">
            <Upload className="w-8 h-8 text-indigo-400 mx-auto opacity-80" />
            <div className="text-slate-300 font-semibold">拖拽 `.xlsx` 或 `.csv` 镜头表文件到此处</div>
            <p className="text-[10px] text-slate-500">支持字段：场次、镜头编号、镜头描述、时长、景别、运镜</p>

            <div className="flex justify-center items-center space-x-3 pt-2">
              <label className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg font-bold cursor-pointer transition">
                <span>浏览本地Excel文件</span>
                <input type="file" accept=".xlsx,.xls,.csv" onChange={handleFileUpload} className="hidden" />
              </label>

              <button
                type="button"
                onClick={loadSampleScript}
                className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 rounded-lg font-semibold transition"
              >
                加载标准分镜台本示例
              </button>
            </div>
          </div>

          {/* Parsed Preview Table */}
          {parsedRows.length > 0 && (
            <div className="space-y-2">
              <div className="flex items-center justify-between text-xs font-bold text-emerald-400">
                <span>预览解析文件: {fileName}</span>
                <span>包含 {parsedRows.length} 条镜头条目</span>
              </div>

              <div className="bg-slate-800/60 rounded-xl border border-slate-700 overflow-hidden max-h-48 overflow-y-auto">
                <table className="w-full text-left text-[11px]">
                  <thead>
                    <tr className="bg-slate-800 text-slate-400 font-semibold border-b border-slate-700">
                      <th className="p-2">场次</th>
                      <th className="p-2">镜头号</th>
                      <th className="p-2">时长</th>
                      <th className="p-2">景别/运镜</th>
                      <th className="p-2">描述</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800">
                    {parsedRows.map((r, i) => (
                      <tr key={i} className="hover:bg-slate-800">
                        <td className="p-2 font-mono text-indigo-300">{r.sceneCode}</td>
                        <td className="p-2 font-mono font-bold text-white">{r.shotCode}</td>
                        <td className="p-2 font-mono text-amber-400">{r.durationSec}s</td>
                        <td className="p-2 text-slate-300">{r.shotType} / {r.cameraMovement}</td>
                        <td className="p-2 text-slate-300 truncate max-w-xs">{r.description}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>

        {error && (
          <div className="rounded-lg border border-rose-500/30 bg-rose-500/10 px-3 py-2.5 text-xs text-rose-300">
            {error}
          </div>
        )}

        <div className="flex justify-end space-x-2 pt-2 border-t border-slate-800">
          <button
            onClick={onClose}
            className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded text-xs font-semibold"
          >
            取消
          </button>
          <button
            onClick={handleConfirmImport}
            disabled={parsedRows.length === 0 || isImporting}
            className="px-5 py-2 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white rounded text-xs font-bold flex items-center space-x-1.5"
          >
            {isImporting
              ? <Loader2 className="w-4 h-4 animate-spin" />
              : <CheckCircle className="w-4 h-4" />
            }
            <span>{isImporting ? '正在创建本地目录…' : '导入镜头、目录和视频任务'}</span>
          </button>
        </div>
      </div>
    </div>
  );
};
