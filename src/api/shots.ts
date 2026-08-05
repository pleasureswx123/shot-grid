import { requestJson } from '../utils/apiClient';
import type { Scene, Shot, Task } from '../types';
export const listShots = (projectId: string) => requestJson<{ shots: Shot[] }>(`/api/shots?projectId=${encodeURIComponent(projectId)}`);
export const listScenes = (projectId: string) => requestJson<{ scenes: Scene[] }>(`/api/scenes?projectId=${encodeURIComponent(projectId)}`);
export const createShot = (body: Partial<Shot> & { projectId: string }) => requestJson<{ shot: Shot }>('/api/shots', { method: 'POST', body });
export const bulkCreateShots = (body: { projectId: string; shots: Array<Record<string, unknown>> }) => requestJson<{ scenes: Scene[]; shots: Shot[]; tasks: Task[] }>('/api/shots/bulk', { method: 'POST', body });
export const deleteShot = (shotId: string) => requestJson<void>(`/api/shots/${shotId}`, { method: 'DELETE' });
