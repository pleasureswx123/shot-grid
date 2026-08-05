import React, { useEffect, useState } from 'react';
import { FileClock, Loader2, RefreshCw, X } from 'lucide-react';

interface AuditLog {
  id: string;
  actorName: string | null;
  projectName: string | null;
  action: string;
  entityType: string | null;
  entityId: string | null;
  details: Record<string, unknown> | null;
  ipAddress: string | null;
  createdAt: string;
}

const parseError = async (response: Response) => {
  try {
    const body = await response.json();
    if (typeof body?.error === 'string') return body.error;
  } catch {
    // Ignore malformed error bodies.
  }
  return `请求失败（${response.status}）`;
};

export const AuditLogsModal: React.FC<{ onClose: () => void }> = ({ onClose }) => {
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [action, setAction] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadLogs = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const query = new URLSearchParams({ limit: '200' });
      if (action.trim()) query.set('action', action.trim());
      const response = await fetch(`/api/admin/audit-logs?${query}`, { credentials: 'same-origin' });
      if (!response.ok) throw new Error(await parseError(response));
      const body = await response.json();
      setLogs(body.auditLogs ?? []);
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : '无法读取审计日志。');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => { void loadLogs(); }, []);

  return (
    <div className="fixed inset-0 z-[80] bg-slate-950/85 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="w-full max-w-6xl max-h-[88vh] overflow-hidden bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl flex flex-col">
        <div className="px-5 py-4 border-b border-slate-800 flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="w-9 h-9 rounded-lg bg-cyan-500/10 border border-cyan-500/20 flex items-center justify-center"><FileClock className="w-5 h-5 text-cyan-300" /></div>
            <div><h2 className="text-sm font-bold text-white">管理员审计日志</h2><p className="text-[11px] text-slate-400">查看项目、镜头、资产、任务、版本、批注与文件关键操作。</p></div>
          </div>
          <button onClick={onClose} className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800"><X className="w-5 h-5" /></button>
        </div>
        <div className="px-5 py-3 border-b border-slate-800 flex items-center gap-2">
          <input value={action} onChange={event => setAction(event.target.value)} placeholder="按事件过滤，如 shot.create" className="w-72 bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-xs text-white outline-none focus:border-cyan-500" />
          <button onClick={() => void loadLogs()} className="px-3 py-2 bg-slate-800 hover:bg-slate-700 rounded-lg text-xs text-slate-200 flex items-center space-x-1.5"><RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin' : ''}`} /><span>刷新</span></button>
        </div>
        {error && <div className="mx-5 mt-4 px-3 py-2 bg-rose-500/10 border border-rose-500/30 rounded-lg text-xs text-rose-300">{error}</div>}
        <div className="flex-1 overflow-auto p-5">
          {isLoading && logs.length === 0 ? <div className="h-40 flex items-center justify-center text-xs text-slate-400"><Loader2 className="w-4 h-4 animate-spin mr-2" />正在读取审计日志…</div> : (
            <table className="w-full text-xs">
              <thead className="text-slate-400"><tr className="border-b border-slate-800"><th className="py-2 text-left">时间</th><th className="text-left">操作人</th><th className="text-left">项目</th><th className="text-left">事件</th><th className="text-left">实体</th><th className="text-left">IP</th><th className="text-left">详情</th></tr></thead>
              <tbody>{logs.map(log => <tr key={log.id} className="border-b border-slate-800/70 text-slate-300 align-top"><td className="py-2 whitespace-nowrap">{new Date(log.createdAt).toLocaleString()}</td><td>{log.actorName || '系统'}</td><td>{log.projectName || '-'}</td><td className="font-mono text-cyan-300">{log.action}</td><td>{log.entityType || '-'}<div className="font-mono text-[10px] text-slate-500">{log.entityId}</div></td><td>{log.ipAddress || '-'}</td><td><pre className="max-w-sm whitespace-pre-wrap break-all text-[10px] text-slate-400">{JSON.stringify(log.details ?? {}, null, 2)}</pre></td></tr>)}</tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
};
