import { requestJson } from '../utils/apiClient';
import type { SearchResponse, SearchResultType } from '../types';

export const searchProject = (input: {
  projectId: string;
  q: string;
  types?: SearchResultType[];
  limit?: number;
}) => {
  const params = new URLSearchParams({ projectId: input.projectId, q: input.q });
  if (input.types?.length) params.set('types', input.types.join(','));
  if (input.limit) params.set('limit', String(input.limit));
  return requestJson<SearchResponse>(`/api/search?${params.toString()}`);
};
