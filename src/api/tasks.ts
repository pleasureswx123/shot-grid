import { requestJson } from '../utils/apiClient';
import type { Task } from '../types';

export const listTasks = (projectId: string) =>
  requestJson<{ tasks: Task[] }>(`/api/tasks?projectId=${encodeURIComponent(projectId)}`);
