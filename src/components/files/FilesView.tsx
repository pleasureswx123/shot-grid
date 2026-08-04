import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Check,
  Copy,
  Download,
  File,
  FileImage,
  FileVideo,
  FolderOpen,
  HardDrive,
  Link2,
  LoaderCircle,
  Plus,
  RefreshCw,
  Search,
  Trash2,
  Upload,
  X,
} from 'lucide-react';
import { useWorkspace } from '../../context/WorkspaceContext';

interface ServerFile {
  id: string;
  projectId: string;
  name: string;
  fileType: 'review' | 'source';
  extension: string;
  sizeBytes: number;
  storageKind: 'managed' | 'nas';
  contentUrl: string | null;
  nasPath: string | null;
  entityType: 'shot' | 'asset' | null;
  entityCode: string | null;
  versionNumber: string | null;
  uploadedAt: string;
  uploaderName: string | null;
  sha256: string | null;
}

const parseError = async (response: Response): Promise<string> => {
  try {
    const body = await response.json();
    if (typeof body?.error === 'string') return body.error;
  } catch {
    // Keep the generic message below.
  }
  return `请求失败（${response.status}）`;
};

const formatBytes = (bytes: number): string => {
  if (!bytes) return '—';
  const units = ['B', 'KB', 'MB', 'GB', 'TB'];
  const index = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1);
  return `${(bytes / 1024 ** index).toFixed(index > 1 ? 2 : 0)} ${units[index]}`;
};

const fileIcon = (extension: string) => {
  if (['mp4', 'mov', 'webm', 'mkv', 'avi'].includes(extension)) {
    return <FileVideo className="h-4 w-4 text-indigo-400" />;
  }
  if (['png', 'jpg', 'jpeg', 'webp', 'gif', 'tif', 'tiff', 'exr', 'dpx'].includes(extension)) {
    return <FileImage className="h-4 w-4 text-emerald-400" />;
  }
  return <File className="h-4 w-4 text-amber-400" />;
};

interface AddFileModalProps {
  projectId: string;
  onClose: () => void;
  onCreated: (file: ServerFile) => void;
}

const AddFileModal: React.FC<AddFileModalProps> = ({ projectId, onClose, onCreated }) => {
  const inputRef = useRef<HTMLInputElement>(null);
  const [mode, setMode] = useState<'upload' | 'nas'>('upload');
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [fileType, setFileType] = useState<'review' | 'source'>('review');
  const [entityType, setEntityType] = useState<'project' | 'shot' | 'asset'>('project');
  const [entityCode, setEntityCode] = useState('');
  const [versionNumber, setVersionNumber] = useState('');
  const [nasName, setNasName] = useState('');
  const [nasPath, setNasPath] = useState('');
  const [progress, setProgress] = useState(0);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const uploadFile = (): Promise<ServerFile> => new Promise((resolve, reject) => {
    if (!selectedFile) {
      reject(new Error('请先选择文件。'));
      return;
    }

    const data = new FormData();
    data.append('projectId', projectId);
    data.append('fileType', fileType);
    data.append('entityType', entityType === 'project' ? '' : entityType);
    data.append('entityId', entityCode.trim());
    data.append('entityCode', entityCode.trim());
    data.append('versionNumber', versionNumber.trim());
    data.append('file', selectedFile);

    const request = new XMLHttpRequest();
    request.open('POST', '/api/files/upload');
    request.withCredentials = true;
    request.upload.onprogress = (event) => {
      if (event.lengthComputable) setProgress(Math.round((event.loaded / event.total) * 100));
    };
    request.onerror = () => reject(new Error('网络连接中断，文件未上传。'));
    request.onload = () => {
      let body: { file?: ServerFile; error?: string } = {};
      try {
        body = JSON.parse(request.responseText);
      } catch {
        // Fall through to the status-based error below.
      }
      if (request.status >= 200 && request.status < 300 && body.file) {
        resolve(body.file);
      } else {
        reject(new Error(body.error || `上传失败（${request.status}）`));
      }
    };
    request.send(data);
  });

  const registerNasFile = async (): Promise<ServerFile> => {
    const response = await fetch('/api/files/nas', {
      method: 'POST',
      credentials: 'same-origin',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        projectId,
        name: nasName.trim(),
        nasPath: nasPath.trim(),
        entityType: entityType === 'project' ? '' : entityType,
        entityCode: entityCode.trim(),
        versionNumber: versionNumber.trim(),
      }),
    });
    if (!response.ok) throw new Error(await parseError(response));
    const body = await response.json();
    return body.file;
  };

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setError(null);
    setIsSubmitting(true);
    try {
      const created = mode === 'upload' ? await uploadFile() : await registerNasFile();
      onCreated(created);
      onClose();
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : '无法保存文件。');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 p-4 backdrop-blur-sm">
      <form
        onSubmit={submit}
        className="w-full max-w-xl overflow-hidden rounded-2xl border border-slate-700 bg-slate-900 shadow-2xl"
      >
        <div className="flex items-center justify-between border-b border-slate-800 px-5 py-4">
          <div>
            <h2 className="text-base font-semibold text-white">添加项目文件</h2>
            <p className="mt-1 text-xs text-slate-400">文件只需上传一次，项目成员即可在局域网内访问。</p>
          </div>
          <button type="button" onClick={onClose} className="rounded-lg p-2 text-slate-400 hover:bg-slate-800 hover:text-white">
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="space-y-4 p-5">
          <div className="grid grid-cols-2 gap-2 rounded-xl bg-slate-950 p-1">
            <button
              type="button"
              onClick={() => setMode('upload')}
              className={`flex items-center justify-center gap-2 rounded-lg px-3 py-2 text-xs font-semibold ${
                mode === 'upload' ? 'bg-indigo-600 text-white' : 'text-slate-400 hover:text-white'
              }`}
            >
              <Upload className="h-4 w-4" /> 上传到服务器
            </button>
            <button
              type="button"
              onClick={() => setMode('nas')}
              className={`flex items-center justify-center gap-2 rounded-lg px-3 py-2 text-xs font-semibold ${
                mode === 'nas' ? 'bg-indigo-600 text-white' : 'text-slate-400 hover:text-white'
              }`}
            >
              <Link2 className="h-4 w-4" /> 登记 NAS 路径
            </button>
          </div>

          {mode === 'upload' ? (
            <div
              onDragOver={(event) => event.preventDefault()}
              onDrop={(event) => {
                event.preventDefault();
                setSelectedFile(event.dataTransfer.files[0] || null);
              }}
              onClick={() => inputRef.current?.click()}
              className="cursor-pointer rounded-xl border border-dashed border-slate-600 bg-slate-950/60 p-7 text-center hover:border-indigo-500 hover:bg-indigo-500/5"
            >
              <input
                ref={inputRef}
                type="file"
                className="hidden"
                onChange={(event) => setSelectedFile(event.target.files?.[0] || null)}
              />
              <Upload className="mx-auto mb-3 h-7 w-7 text-indigo-400" />
              <p className="text-sm font-medium text-slate-200">
                {selectedFile ? selectedFile.name : '拖放文件到这里，或点击选择'}
              </p>
              <p className="mt-1 text-xs text-slate-500">
                {selectedFile ? formatBytes(selectedFile.size) : '支持视频、图片、工程文件、压缩包和常用文档'}
              </p>
            </div>
          ) : (
            <div className="grid gap-3">
              <label className="text-xs text-slate-400">
                文件名
                <input
                  value={nasName}
                  onChange={(event) => setNasName(event.target.value)}
                  placeholder="例如 SH010_comp_v003.exr"
                  className="mt-1.5 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2.5 text-sm text-white outline-none focus:border-indigo-500"
                />
              </label>
              <label className="text-xs text-slate-400">
                共享路径
                <input
                  value={nasPath}
                  onChange={(event) => setNasPath(event.target.value)}
                  placeholder={'例如 \\\\STUDIO-NAS\\Projects\\NOMUD\\SH010'}
                  className="mt-1.5 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2.5 font-mono text-sm text-white outline-none focus:border-indigo-500"
                />
              </label>
              <p className="text-[11px] leading-relaxed text-amber-300/80">
                NAS 路径不会上传文件；请确保所有员工电脑都能用同一个共享路径访问。
              </p>
            </div>
          )}

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            {mode === 'upload' && (
              <label className="text-xs text-slate-400">
                文件用途
                <select
                  value={fileType}
                  onChange={(event) => setFileType(event.target.value as 'review' | 'source')}
                  className="mt-1.5 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2.5 text-sm text-white outline-none focus:border-indigo-500"
                >
                  <option value="review">网页审核文件</option>
                  <option value="source">工程源文件</option>
                </select>
              </label>
            )}
            <label className="text-xs text-slate-400">
              关联范围
              <select
                value={entityType}
                onChange={(event) => setEntityType(event.target.value as 'project' | 'shot' | 'asset')}
                className="mt-1.5 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2.5 text-sm text-white outline-none focus:border-indigo-500"
              >
                <option value="project">整个项目</option>
                <option value="shot">镜头</option>
                <option value="asset">资产</option>
              </select>
            </label>
            <label className="text-xs text-slate-400">
              {entityType === 'project' ? '项目文件' : '镜头/资产编号'}
              <input
                disabled={entityType === 'project'}
                value={entityCode}
                onChange={(event) => setEntityCode(event.target.value)}
                placeholder={entityType === 'project' ? '无需填写' : '例如 SH010'}
                className="mt-1.5 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2.5 text-sm text-white outline-none disabled:opacity-50 focus:border-indigo-500"
              />
            </label>
            <label className="text-xs text-slate-400">
              版本号（可选）
              <input
                value={versionNumber}
                onChange={(event) => setVersionNumber(event.target.value)}
                placeholder="例如 V003"
                className="mt-1.5 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2.5 text-sm text-white outline-none focus:border-indigo-500"
              />
            </label>
          </div>

          {progress > 0 && mode === 'upload' && (
            <div>
              <div className="mb-1 flex justify-between text-[11px] text-slate-400">
                <span>{progress < 100 ? '正在传输到服务器' : '服务器正在校验并保存'}</span>
                <span>{progress}%</span>
              </div>
              <div className="h-1.5 overflow-hidden rounded-full bg-slate-800">
                <div className="h-full bg-indigo-500 transition-all" style={{ width: `${progress}%` }} />
              </div>
            </div>
          )}

          {error && <div className="rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-xs text-red-300">{error}</div>}
        </div>

        <div className="flex justify-end gap-2 border-t border-slate-800 bg-slate-950/40 px-5 py-4">
          <button type="button" onClick={onClose} className="rounded-lg px-4 py-2 text-xs font-medium text-slate-300 hover:bg-slate-800">
            取消
          </button>
          <button
            type="submit"
            disabled={isSubmitting || (mode === 'upload' ? !selectedFile : !nasName.trim() || !nasPath.trim())}
            className="flex items-center gap-2 rounded-lg bg-indigo-600 px-4 py-2 text-xs font-semibold text-white hover:bg-indigo-500 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {isSubmitting && <LoaderCircle className="h-4 w-4 animate-spin" />}
            {mode === 'upload' ? '上传文件' : '保存共享路径'}
          </button>
        </div>
      </form>
    </div>
  );
};

export const FilesView: React.FC = () => {
  const { selectedProject } = useWorkspace();
  const [files, setFiles] = useState<ServerFile[]>([]);
  const [filterType, setFilterType] = useState<'ALL' | 'review' | 'source'>('ALL');
  const [searchQuery, setSearchQuery] = useState('');
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isAdding, setIsAdding] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadFiles = useCallback(async () => {
    if (!selectedProject) return;
    setIsLoading(true);
    setError(null);
    try {
      const response = await fetch(`/api/files?projectId=${encodeURIComponent(selectedProject.id)}`, {
        credentials: 'same-origin',
      });
      if (!response.ok) throw new Error(await parseError(response));
      const body = await response.json();
      setFiles(body.files);
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : '无法读取项目文件。');
    } finally {
      setIsLoading(false);
    }
  }, [selectedProject]);

  useEffect(() => {
    void loadFiles();
  }, [loadFiles]);

  const filteredFiles = useMemo(() => files.filter((file) => {
    const matchType = filterType === 'ALL' || file.fileType === filterType;
    const query = searchQuery.trim().toLowerCase();
    const matchQuery = !query ||
      file.name.toLowerCase().includes(query) ||
      (file.entityCode || '').toLowerCase().includes(query) ||
      (file.nasPath || '').toLowerCase().includes(query);
    return matchType && matchQuery;
  }), [files, filterType, searchQuery]);

  const copyNasPath = async (file: ServerFile) => {
    if (!file.nasPath) return;
    await navigator.clipboard.writeText(file.nasPath);
    setCopiedId(file.id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const removeFile = async (file: ServerFile) => {
    if (!window.confirm(`从项目中移除“${file.name}”？服务器托管文件会先进入可恢复区。`)) return;
    setError(null);
    const response = await fetch(`/api/files/${file.id}`, {
      method: 'DELETE',
      credentials: 'same-origin',
    });
    if (!response.ok) {
      setError(await parseError(response));
      return;
    }
    setFiles((current) => current.filter((item) => item.id !== file.id));
  };

  if (!selectedProject) return null;

  return (
    <div className="mx-auto max-w-7xl space-y-5 p-6 text-slate-100">
      <div className="rounded-xl border border-slate-800 bg-slate-900 p-4">
        <div className="flex flex-col justify-between gap-4 lg:flex-row lg:items-center">
          <div>
            <div className="flex items-center gap-2">
              <FolderOpen className="h-5 w-5 text-indigo-400" />
              <h1 className="text-base font-semibold">项目文件中心</h1>
            </div>
            <p className="mt-1 text-xs text-slate-400">
              {selectedProject.code} · 文件集中保存在工作室服务器，项目成员通过局域网共享。
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => void loadFiles()}
              className="rounded-lg border border-slate-700 p-2 text-slate-400 hover:bg-slate-800 hover:text-white"
              title="刷新"
            >
              <RefreshCw className={`h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} />
            </button>
            <button
              onClick={() => setIsAdding(true)}
              className="flex items-center gap-2 rounded-lg bg-indigo-600 px-4 py-2 text-xs font-semibold text-white hover:bg-indigo-500"
            >
              <Plus className="h-4 w-4" /> 添加文件
            </button>
          </div>
        </div>

        <div className="mt-4 flex flex-col gap-3 md:flex-row md:items-center">
          <div className="relative w-full md:w-72">
            <Search className="absolute left-3 top-2.5 h-3.5 w-3.5 text-slate-500" />
            <input
              type="text"
              placeholder="搜索文件名、编号或 NAS 路径"
              value={searchQuery}
              onChange={(event) => setSearchQuery(event.target.value)}
              className="w-full rounded-lg border border-slate-700 bg-slate-800 py-2 pl-8 pr-3 text-xs text-slate-200 outline-none focus:border-indigo-500"
            />
          </div>
          <div className="flex rounded-lg border border-slate-700 bg-slate-800 p-1 text-xs">
            {([
              ['ALL', `全部 ${files.length}`],
              ['review', '审核文件'],
              ['source', '工程源文件'],
            ] as const).map(([value, label]) => (
              <button
                key={value}
                onClick={() => setFilterType(value)}
                className={`rounded px-3 py-1.5 font-medium ${
                  filterType === value ? 'bg-indigo-600 text-white' : 'text-slate-400 hover:text-white'
                }`}
              >
                {label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {error && <div className="rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-3 text-xs text-red-300">{error}</div>}

      <div className="overflow-hidden rounded-xl border border-slate-800 bg-slate-900 shadow-lg">
        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-left text-xs">
            <thead>
              <tr className="border-b border-slate-800 bg-slate-800/50 font-semibold uppercase tracking-wider text-slate-400">
                <th className="p-3 pl-4">文件名</th>
                <th className="p-3">存储方式</th>
                <th className="p-3">关联对象</th>
                <th className="p-3">版本</th>
                <th className="p-3">大小</th>
                <th className="p-3">上传者</th>
                <th className="p-3">上传时间</th>
                <th className="p-3 pr-4 text-right">操作</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60">
              {filteredFiles.map((file) => (
                <tr key={file.id} className="transition hover:bg-slate-800/50">
                  <td className="p-3 pl-4">
                    <div className="flex max-w-xs items-center gap-2 font-semibold text-slate-200">
                      {fileIcon(file.extension)}
                      <span className="truncate" title={file.name}>{file.name}</span>
                    </div>
                  </td>
                  <td className="p-3">
                    <span className={`inline-flex items-center gap-1 rounded px-2 py-1 text-[10px] font-semibold ${
                      file.storageKind === 'managed'
                        ? 'bg-indigo-500/20 text-indigo-300'
                        : 'bg-amber-500/20 text-amber-300'
                    }`}>
                      {file.storageKind === 'managed' ? <HardDrive className="h-3 w-3" /> : <Link2 className="h-3 w-3" />}
                      {file.storageKind === 'managed' ? '服务器托管' : 'NAS 路径'}
                    </span>
                  </td>
                  <td className="p-3 font-mono font-bold text-indigo-300">
                    {file.entityCode || '项目'}
                  </td>
                  <td className="p-3 font-mono font-bold text-emerald-400">
                    {file.versionNumber || '—'}
                  </td>
                  <td className="p-3 font-mono text-slate-400">{formatBytes(file.sizeBytes)}</td>
                  <td className="p-3 text-slate-300">{file.uploaderName || '未知用户'}</td>
                  <td className="p-3 text-slate-400">
                    {new Date(file.uploadedAt).toLocaleString('zh-CN', { hour12: false })}
                  </td>
                  <td className="p-3 pr-4 text-right">
                    <div className="inline-flex items-center gap-1">
                      {file.nasPath ? (
                        <button
                          onClick={() => void copyNasPath(file)}
                          title={file.nasPath}
                          className="inline-flex items-center gap-1 rounded bg-slate-800 px-2.5 py-1.5 text-[11px] font-medium text-slate-200 hover:bg-indigo-600 hover:text-white"
                        >
                          {copiedId === file.id ? <Check className="h-3.5 w-3.5 text-emerald-300" /> : <Copy className="h-3.5 w-3.5" />}
                          {copiedId === file.id ? '已复制' : '复制路径'}
                        </button>
                      ) : (
                        <a
                          href={`${file.contentUrl}?download=1`}
                          className="inline-flex items-center gap-1 rounded bg-indigo-600 px-2.5 py-1.5 text-[11px] font-medium text-white hover:bg-indigo-500"
                        >
                          <Download className="h-3.5 w-3.5" /> 下载
                        </a>
                      )}
                      <button
                        onClick={() => void removeFile(file)}
                        title="移除文件"
                        className="rounded p-1.5 text-slate-500 hover:bg-red-500/15 hover:text-red-300"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {!isLoading && filteredFiles.length === 0 && (
          <div className="py-16 text-center">
            <FolderOpen className="mx-auto mb-3 h-9 w-9 text-slate-700" />
            <p className="text-sm text-slate-400">{files.length ? '没有符合筛选条件的文件' : '当前项目还没有共享文件'}</p>
            {!files.length && <p className="mt-1 text-xs text-slate-600">点击“添加文件”上传第一个文件。</p>}
          </div>
        )}
      </div>

      {isAdding && (
        <AddFileModal
          projectId={selectedProject.id}
          onClose={() => setIsAdding(false)}
          onCreated={(file) => setFiles((current) => [file, ...current])}
        />
      )}
    </div>
  );
};
