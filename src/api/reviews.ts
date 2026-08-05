import { requestJson } from '../utils/apiClient';
import type { ReviewList, ReviewListParticipant } from '../types';

type ReviewListBody = {
  title: string;
  date: string;
  versionIds: string[];
  description?: string;
  roundNumber?: number;
  dueAt?: string | null;
  participants?: ReviewListParticipant[];
};

export const listReviewLists = (projectId: string) => requestJson<{ reviewLists: ReviewList[] }>(`/api/projects/${projectId}/review-lists`);
export const createReviewList = (projectId: string, body: ReviewListBody) => requestJson<{ reviewList: ReviewList }>(`/api/projects/${projectId}/review-lists`, { method: 'POST', body });
export const updateReviewList = (id: string, body: Partial<ReviewListBody>) => requestJson<{ reviewList: ReviewList }>(`/api/review-lists/${id}`, { method: 'PATCH', body });
export const submitReviewList = (id: string) => requestJson<{ reviewList: ReviewList }>(`/api/review-lists/${id}/submit`, { method: 'POST' });
export const completeReviewList = (id: string) => requestJson<{ reviewList: ReviewList }>(`/api/review-lists/${id}/complete`, { method: 'POST' });
export const archiveReviewList = (id: string) => requestJson<{ reviewList: ReviewList }>(`/api/review-lists/${id}/archive`, { method: 'POST' });
export const completeReviewListParticipant = (id: string, userId: string, hasCompleted = true) => requestJson<{ reviewList: ReviewList }>(`/api/review-lists/${id}/participants/${userId}/complete`, { method: 'POST', body: { hasCompleted } });
