import { requestJson } from '../utils/apiClient';
import type { Note, ProjectFile, Version, VersionStatus } from '../types';
export const listVersions = (projectId: string) => requestJson<{ versions: Version[] }>(`/api/projects/${projectId}/versions`);
export const createVersion = (body: Omit<Version, 'id' | 'createdAt'>) => requestJson<{ version: Version }>('/api/versions', { method: 'POST', body });
export const updateVersionStatus = (versionId: string, status: VersionStatus) => requestJson<{ version: Version }>(`/api/versions/${versionId}/status`, { method: 'PATCH', body: { status } });
export const listVersionNotes = (versionId: string) => requestJson<{ notes: Note[] }>(`/api/versions/${versionId}/notes`);
export const createVersionNote = (noteData: Omit<Note, 'id' | 'createdAt'>) => requestJson<{ note: Note }>(`/api/versions/${noteData.versionId}/notes`, { method: 'POST', body: noteData });
export const uploadVersionFile = (formData: FormData) => requestJson<{ file: ProjectFile }>('/api/files/upload', { method: 'POST', body: formData });
