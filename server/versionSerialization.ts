import type { ProjectPermissionContext } from './permissions';

export const serializeVersionForRole = <T extends Record<string, unknown>>(version: T, context: ProjectPermissionContext): Omit<T, 'aiParams'> | T => {
  if (context.projectRole !== 'client') return version;
  const { aiParams: _aiParams, ...publicVersion } = version;
  return publicVersion;
};
