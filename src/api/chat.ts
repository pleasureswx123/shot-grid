import { requestJson } from '../utils/apiClient';
import type { ChatMessage, DepartmentChannel } from '../types';
export const listChannels = (projectId: string) => requestJson<{ channels: DepartmentChannel[] }>(`/api/chat/channels?projectId=${encodeURIComponent(projectId)}`);
export const listMessages = (params: URLSearchParams) => requestJson<{ chatMessages: ChatMessage[] }>(`/api/chat/messages?${params.toString()}`);
export const createMessage = (body: Omit<ChatMessage, 'id' | 'createdAt'>) => requestJson<{ message: ChatMessage }>('/api/chat/messages', { method: 'POST', body });
export const updateMessageMedia = (messageId: string, editedMediaUrl: string) => requestJson<void>(`/api/chat/messages/${messageId}/media`, { method: 'PATCH', body: { editedMediaUrl } });
export const likeMessage = (messageId: string, liked: boolean) => requestJson<void>(`/api/chat/messages/${messageId}/likes`, { method: liked ? 'DELETE' : 'POST' });
export const createChannel = (projectId: string, body: Omit<DepartmentChannel, 'id' | 'unreadCount'>) => requestJson<{ channel: DepartmentChannel }>(`/api/chat/channels?projectId=${encodeURIComponent(projectId)}`, { method: 'POST', body: { ...body, projectId } });
