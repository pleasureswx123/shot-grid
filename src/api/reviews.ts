import { requestJson } from '../utils/apiClient';
import type { ReviewList } from '../types';
export const listReviewLists = (projectId: string) => requestJson<{ reviewLists: ReviewList[] }>(`/api/projects/${projectId}/review-lists`);
export const createReviewList = (projectId: string, body: { title: string; date: string; versionIds: string[]; description?: string }) => requestJson<{ reviewList: ReviewList }>(`/api/projects/${projectId}/review-lists`, { method: 'POST', body });
