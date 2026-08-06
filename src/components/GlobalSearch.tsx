import React, { useEffect, useRef, useState } from 'react';
import { File, Image, Loader2, Search, Video, X } from 'lucide-react';
import { searchProject } from '../api/search';
import { useApp } from '../context/AppContext';
import type { SearchResultItem, SearchResponse } from '../types';

const emptyResults: SearchResponse['results'] = { shots: [], assets: [], files: [] };

export const GlobalSearch: React.FC = () => {
  const { project, setActiveTab, setSelectedShotId, setSelectedAssetId } = useApp();
  const [query, setQuery] = useState('');
  const [results, setResults] = useState(emptyResults);
  const [isOpen, setIsOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const boxRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const onPointerDown = (event: PointerEvent) => {
      if (boxRef.current && !boxRef.current.contains(event.target as Node)) setIsOpen(false);
    };
    document.addEventListener('pointerdown', onPointerDown);
    return () => document.removeEventListener('pointerdown', onPointerDown);
  }, []);

  useEffect(() => {
    const trimmed = query.trim();
    if (trimmed.length < 2) {
      setResults(emptyResults);
      setError(null);
      setIsLoading(false);
      return;
    }
    const controller = new AbortController();
    const timer = window.setTimeout(async () => {
      setIsLoading(true);
      setError(null);
      try {
        const body = await searchProject({ projectId: project.id, q: trimmed, limit: 6 });
        if (!controller.signal.aborted) setResults(body.results);
      } catch (err) {
        if (!controller.signal.aborted) setError(err instanceof Error ? err.message : '搜索失败');
      } finally {
        if (!controller.signal.aborted) setIsLoading(false);
      }
    }, 250);
    return () => {
      controller.abort();
      window.clearTimeout(timer);
    };
  }, [project.id, query]);

  const openResult = (item: SearchResultItem) => {
    if (item.type === 'shot') {
      setSelectedShotId(item.id);
      setActiveTab('shots');
    } else if (item.type === 'asset') {
      setSelectedAssetId(item.id);
      setActiveTab('assets');
    } else {
      setActiveTab('files');
    }
    setIsOpen(false);
  };

  const groups = [
    { key: 'shots' as const, label: '镜头', icon: Video, items: results.shots },
    { key: 'assets' as const, label: '资产', icon: Image, items: results.assets },
    { key: 'files' as const, label: '文件', icon: File, items: results.files },
  ];
  const total = groups.reduce((sum, group) => sum + group.items.length, 0);

  return (
    <div ref={boxRef} className="relative w-80">
      <Search className="pointer-events-none absolute left-2.5 top-2 h-4 w-4 text-slate-500" />
      <input
        value={query}
        onChange={event => { setQuery(event.target.value); setIsOpen(true); }}
        onFocus={() => setIsOpen(true)}
        placeholder="搜索镜头、资产、文件…"
        className="w-full rounded-md border border-slate-700 bg-slate-950/70 py-1.5 pl-8 pr-8 text-xs text-slate-100 outline-none transition placeholder:text-slate-500 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
      />
      {query && (
        <button onClick={() => setQuery('')} className="absolute right-2 top-2 text-slate-500 hover:text-slate-200" title="清空搜索">
          <X className="h-3.5 w-3.5" />
        </button>
      )}
      {isOpen && query.trim().length >= 2 && (
        <div className="absolute left-0 right-0 top-10 z-50 max-h-[70vh] overflow-auto rounded-xl border border-slate-700 bg-slate-900 shadow-2xl">
          {isLoading && <div className="flex items-center gap-2 px-3 py-3 text-xs text-slate-400"><Loader2 className="h-4 w-4 animate-spin" />搜索中…</div>}
          {error && <div className="px-3 py-3 text-xs text-rose-300">{error}</div>}
          {!isLoading && !error && total === 0 && <div className="px-3 py-3 text-xs text-slate-400">未找到匹配结果</div>}
          {!isLoading && !error && groups.map(group => group.items.length > 0 && (
            <section key={group.key} className="border-b border-slate-800 last:border-0 py-1">
              <div className="px-3 py-1.5 text-[10px] font-semibold uppercase tracking-wide text-slate-500">{group.label}</div>
              {group.items.map(item => {
                const Icon = group.icon;
                return (
                  <button key={`${item.type}-${item.id}`} onClick={() => openResult(item)} className="flex w-full items-start gap-2 px-3 py-2 text-left hover:bg-slate-800">
                    <Icon className="mt-0.5 h-4 w-4 text-indigo-300" />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-xs font-semibold text-slate-100">{item.title}</span>
                      <span className="block truncate text-[11px] text-slate-400">{item.subtitle || item.detail || '无描述'}</span>
                    </span>
                  </button>
                );
              })}
            </section>
          ))}
        </div>
      )}
    </div>
  );
};
