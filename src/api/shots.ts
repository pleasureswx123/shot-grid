import { requestJson } from '../utils/apiClient';
import type { Scene, Shot, Task } from '../types';
export interface ShotImportReport {
  createdAssets: Array<{ name: string; category: string }>;
  reusedAssets: Array<{ name: string; category: string }>;
  unmatchedAssets: Array<{ name: string; category: string; reason: string }>;
}
export const listShots = (projectId: string) => requestJson<{ shots: Shot[] }>(`/api/shots?projectId=${encodeURIComponent(projectId)}`);
export const listScenes = (projectId: string) => requestJson<{ scenes: Scene[] }>(`/api/scenes?projectId=${encodeURIComponent(projectId)}`);
export const createShot = (body: Partial<Shot> & { projectId: string }) => requestJson<{ shot: Shot }>('/api/shots', { method: 'POST', body });
export const bulkCreateShots = (body: { projectId: string; shots: Array<Record<string, unknown>> }) => requestJson<{ scenes: Scene[]; shots: Shot[]; tasks: Task[]; importReport: ShotImportReport }>('/api/shots/bulk', { method: 'POST', body });
export const updateShot = (shotId: string, updates: Partial<Pick<Shot, 'sceneCode' | 'assigneeId' | 'description'>>) => requestJson<{ shot: Shot }>(`/api/shots/${shotId}`, { method: 'PATCH', body: updates });
export const lockShot = (shotId: string) => requestJson<{ shot: Shot }>(`/api/shots/${shotId}`, { method: 'PATCH', body: { status: '已锁定' } });
export const restoreShot = (shotId: string) => requestJson<{ shot: Shot }>(`/api/shots/${shotId}`, { method: 'PATCH', body: { status: '恢复' } });
export const deleteShot = (shotId: string) => requestJson<void>(`/api/shots/${shotId}`, { method: 'DELETE' });
