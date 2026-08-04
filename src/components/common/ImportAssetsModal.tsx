import React, { useMemo, useState } from 'react';
import { CheckCircle, FileSpreadsheet, Upload, X } from 'lucide-react';
import * as XLSX from 'xlsx';
import { useApp } from '../../context/AppContext';
import { parseAssetTableRows, type ParsedAssetRow } from '../../utils/assetImport';

interface ImportAssetsModalProps {
  onClose: () => void;
}

const sampleAssets: Array<Record<string, string>> = [
  {
    '资产名称': '深空救生舱',
    '资产分类': '载具',
    '资产描述': '双人逃生载具，带重型防爆装甲与脉冲推进器。',
    'AI提示词': 'futuristic escape pod, heavy armor, cinematic concept art',
    '负责人': '',
  },
  {
    '资产名称': '应急驾驶服',
    '资产分类': '服装',
    '资产描述': '用于失压环境的轻型驾驶服，配备红色生命维持灯。',
    'AI提示词': 'emergency pilot suit, red life support lights, sci-fi',
    '负责人': '',
  },
  {
    '资产名称': '舰桥AI助手',
    '资产分类': '角色',
    '资产描述': '舰桥全息AI助手，冷白色半透明投影形态。',
    'AI提示词': 'holographic AI assistant, translucent white projection',
    '负责人': '',
  },
];

export const ImportAssetsModal: React.FC<ImportAssetsModalProps> = ({ onClose }) => {
  const { assets, importAssetsFromData } = useApp();
  const [parsedRows, setParsedRows] = useState<ParsedAssetRow[]>([]);
  const [fileName, setFileName] = useState('');
  const [ignoredBlankRows, setIgnoredBlankRows] = useState(0);

  const previewRows = useMemo(() => {
    const names = new Set(
      assets.map(asset => asset.name.trim().toLocaleLowerCase('zh-CN')),
    );
    return parsedRows.map(row => {
      const normalizedName = row.name.trim().toLocaleLowerCase('zh-CN');
      const duplicate = names.has(normalizedName);
      names.add(normalizedName);
      return { ...row, duplicate };
    });
  }, [assets, parsedRows]);
  const importableRows = previewRows.filter(row => !row.duplicate);
  const duplicateCount = previewRows.length - importableRows.length;

  const setRowsFromSheet = (
    rows: Array<Record<string, unknown>>,
    nextFileName: string,
  ) => {
    const parsed = parseAssetTableRows(rows);
    setParsedRows(parsed);
    setIgnoredBlankRows(Math.max(0, rows.length - parsed.length));
    setFileName(nextFileName);
  };

  const loadSampleAssets = () => {
    setRowsFromSheet(sampleAssets, '资产导入表示例.xlsx');
  };

  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = loadEvent => {
      try {
        const workbook = XLSX.read(loadEvent.target?.result, { type: 'array' });
        const sheetName = workbook.SheetNames[0];
        if (!sheetName) throw new Error('工作簿中没有可读取的工作表');
        const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(
          workbook.Sheets[sheetName],
          { defval: '' },
        );
        setRowsFromSheet(rows, `${file.name} · ${sheetName}`);
      } catch (error) {
        console.error('Failed to parse asset sheet:', error);
        window.alert('读取资产表失败，请确认文件是有效的 Excel 或 CSV。');
      }
    };
    reader.readAsArrayBuffer(file);
    event.target.value = '';
  };

  const handleConfirmImport = () => {
    if (!importableRows.length) return;
    importAssetsFromData(importableRows.map(row => ({
      name: row.name,
      category: row.category,
      description: row.description,
      promptTemplate: row.promptTemplate,
      thumbnailUrl: row.thumbnailUrl,
      assignee: row.assignee,
    })));
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-4xl text-slate-100 shadow-2xl overflow-hidden">
        <div className="flex items-center justify-between border-b border-slate-800 px-6 py-4">
          <div className="flex items-center gap-2">
            <FileSpreadsheet className="w-5 h-5 text-emerald-400" />
            <div>
              <h2 className="text-base font-bold text-white">导入资产表</h2>
              <p className="text-[11px] text-slate-400 mt-0.5">
                从 Excel / CSV 提取资产，并自动建立资产制作任务
              </p>
            </div>
          </div>
          <button
            aria-label="关闭资产导入"
            onClick={onClose}
            className="text-slate-400 hover:text-white p-1 rounded"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6 space-y-4 text-xs">
          <div className="border-2 border-dashed border-slate-700 rounded-xl p-5 text-center bg-slate-800/30 space-y-2">
            <Upload className="w-8 h-8 text-indigo-400 mx-auto" />
            <div className="font-semibold text-slate-200">选择本地资产表</div>
            <p className="text-[10px] text-slate-500">
              支持：资产名称、资产分类、资产描述、AI提示词、缩略图URL、负责人
            </p>
            <div className="flex justify-center gap-2 pt-2">
              <label className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 rounded-lg font-semibold text-white cursor-pointer">
                浏览 Excel / CSV
                <input
                  type="file"
                  accept=".xlsx,.xls,.csv"
                  onChange={handleFileUpload}
                  className="hidden"
                />
              </label>
              <button
                type="button"
                onClick={loadSampleAssets}
                className="px-4 py-2 bg-slate-800 hover:bg-slate-700 border border-slate-700 rounded-lg font-semibold text-slate-300"
              >
                加载资产表示例
              </button>
            </div>
          </div>

          {previewRows.length > 0 && (
            <div className="space-y-2">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="font-semibold text-emerald-400">解析预览：{fileName}</span>
                <div className="flex gap-3 text-[11px]">
                  <span className="text-emerald-400">可导入 {importableRows.length}</span>
                  {duplicateCount > 0 && <span className="text-amber-400">重复 {duplicateCount}</span>}
                  {ignoredBlankRows > 0 && <span className="text-slate-500">忽略空名称 {ignoredBlankRows}</span>}
                </div>
              </div>
              <div className="max-h-72 overflow-auto rounded-xl border border-slate-700 bg-slate-800/50">
                <table className="w-full text-left text-[11px]">
                  <thead className="sticky top-0 bg-slate-800 text-slate-400">
                    <tr>
                      <th className="p-2.5">行</th>
                      <th className="p-2.5">资产名称</th>
                      <th className="p-2.5">分类</th>
                      <th className="p-2.5">负责人</th>
                      <th className="p-2.5">资产描述</th>
                      <th className="p-2.5">结果</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800">
                    {previewRows.map(row => (
                      <tr key={`${row.sourceRow}-${row.name}`} className={row.duplicate ? 'opacity-55' : ''}>
                        <td className="p-2.5 text-slate-500 font-mono">{row.sourceRow}</td>
                        <td className="p-2.5 font-semibold text-white">{row.name}</td>
                        <td className="p-2.5 text-indigo-300">{row.category}</td>
                        <td className="p-2.5 text-slate-300">{row.assignee || '当前操作人'}</td>
                        <td className="p-2.5 text-slate-300 max-w-xs truncate">{row.description}</td>
                        <td className="p-2.5">
                          {row.duplicate ? (
                            <span className="text-amber-400">已存在，跳过</span>
                          ) : row.warnings.length ? (
                            <span className="text-amber-300" title={row.warnings.join('；')}>
                              可导入（有提示）
                            </span>
                          ) : (
                            <span className="text-emerald-400">可导入</span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {fileName && previewRows.length === 0 && (
            <div className="rounded-lg border border-amber-500/20 bg-amber-500/5 p-4 text-amber-300">
              没有读取到带“资产名称”的有效记录，请检查表头。
            </div>
          )}
        </div>

        <div className="flex justify-end gap-2 border-t border-slate-800 bg-slate-950/40 px-6 py-4">
          <button
            onClick={onClose}
            className="px-4 py-2 bg-slate-800 hover:bg-slate-700 rounded-lg text-slate-300 font-semibold text-xs"
          >
            取消
          </button>
          <button
            onClick={handleConfirmImport}
            disabled={!importableRows.length}
            className="px-5 py-2 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 disabled:cursor-not-allowed rounded-lg text-white font-bold text-xs flex items-center gap-1.5"
          >
            <CheckCircle className="w-4 h-4" />
            导入 {importableRows.length} 项资产并创建任务
          </button>
        </div>
      </div>
    </div>
  );
};
