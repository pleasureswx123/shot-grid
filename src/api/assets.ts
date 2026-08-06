import { requestJson } from '../utils/apiClient';
import type { Asset } from '../types';
export const listAssets = (projectId: string) => requestJson<{ assets: Asset[] }>(`/api/assets?projectId=${encodeURIComponent(projectId)}`);
export const createAsset = (body: Partial<Asset> & { projectId: string }) => requestJson<{ asset: Asset }>('/api/assets', { method: 'POST', body });
export const bulkCreateAssets = (body: { projectId: string; assets: Array<Partial<Asset>> }) => requestJson<{ assets: Asset[] }>('/api/assets/bulk', { method: 'POST', body });

export const updateAsset = (assetId: string, updates: Partial<Pick<Asset, 'name' | 'status' | 'assigneeId'>>) => requestJson<{ asset: Asset }>(`/api/assets/${assetId}`, { method: 'PATCH', body: updates });
export const deleteAsset = (assetId: string, confirmImpact = false) => requestJson<void>(`/api/assets/${assetId}`, { method: 'DELETE', body: { confirmImpact } });
