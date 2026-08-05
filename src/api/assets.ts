import { requestJson } from '../utils/apiClient';
import type { Asset } from '../types';
export const listAssets = (projectId: string) => requestJson<{ assets: Asset[] }>(`/api/assets?projectId=${encodeURIComponent(projectId)}`);
export const createAsset = (body: Partial<Asset> & { projectId: string }) => requestJson<{ asset: Asset }>('/api/assets', { method: 'POST', body });
