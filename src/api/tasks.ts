import { requestJson } from '../utils/apiClient';
import type { Task } from '../types';

export const listTasks = (projectId: string) =>
  requestJson<{ tasks: Task[] }>(`/api/tasks?projectId=${encodeURIComponent(projectId)}`);

export const updateTask = (taskId: string, updates: Partial<Pick<Task, 'status' | 'assigneeId'>>) =>
  requestJson<{ task: Task }>(`/api/tasks/${taskId}`, { method: 'PATCH', body: updates });
