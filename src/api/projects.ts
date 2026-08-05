import { requestJson } from '../utils/apiClient';
import type { ServerProject, ProjectMember, DirectoryUser } from '../context/WorkspaceContext';
import type { UserRole } from '../types';

export const listProjects = () => requestJson<{ projects: ServerProject[] }>('/api/projects');
export const listUsers = () => requestJson<{ users: DirectoryUser[] }>('/api/users');
export const createProject = (input: { name: string; code: string; type: string; aspectRatio: string }) =>
  requestJson<{ project: ServerProject }>('/api/projects', { method: 'POST', body: input });
export const listProjectMembers = (projectId: string) => requestJson<{ members: ProjectMember[] }>(`/api/projects/${projectId}/members`);
export const addProjectMember = (projectId: string, userId: string, projectRole: UserRole) =>
  requestJson<void>(`/api/projects/${projectId}/members`, { method: 'POST', body: { userId, projectRole } });
export const removeProjectMember = (projectId: string, userId: string) =>
  requestJson<void>(`/api/projects/${projectId}/members/${userId}`, { method: 'DELETE' });
export const ensureShotDirectories = (projectId: string, shots: Array<{ shotId: string; shotCode: string; sceneCode: string }>) =>
  requestJson<void>(`/api/projects/${projectId}/storage/shots`, { method: 'POST', body: { shots } });
