import { requestJson } from '../utils/apiClient';
import type { ProjectFile } from '../types';

export const listFiles = (projectId: string) =>
  requestJson<{ files: ProjectFile[] }>(`/api/files?projectId=${encodeURIComponent(projectId)}`);

export const uploadFile = (formData: FormData) =>
  requestJson<{ file: ProjectFile }>('/api/files/upload', { method: 'POST', body: formData });
