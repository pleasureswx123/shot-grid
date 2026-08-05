export type ApiEntityType = 'project' | 'shot' | 'asset';

const ENTITY_TYPES = new Set<ApiEntityType>(['project', 'shot', 'asset']);

export const isApiEntityType = (value: unknown): value is ApiEntityType =>
  typeof value === 'string' && ENTITY_TYPES.has(value as ApiEntityType);

export const validateEntityBelongsToProject = (
  entityType: ApiEntityType,
  entityId: string,
  projectId: string,
): string | null => {
  if (entityType === 'project' && entityId !== projectId) {
    return '项目级任务的 entityId 必须等于所属项目。';
  }
  return null;
};
