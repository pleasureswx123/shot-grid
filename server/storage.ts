import { createHash, randomUUID } from 'node:crypto';
import { createReadStream } from 'node:fs';
import { mkdir, rename, rm, unlink, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { config } from './config';

const WINDOWS_RESERVED_NAME = /^(con|prn|aux|nul|com[1-9]|lpt[1-9])(?:\.|$)/i;

export const sanitizeFileName = (value: string): string => {
  const cleaned = value
    .normalize('NFKC')
    .replace(/[\u0000-\u001f<>:"/\\|?*]/g, '_')
    .replace(/[. ]+$/g, '')
    .trim()
    .slice(0, 180);

  if (!cleaned) return 'file';
  return WINDOWS_RESERVED_NAME.test(cleaned) ? `_${cleaned}` : cleaned;
};

export const sanitizeStorageSegment = (value: string, fallback = 'general'): string => {
  const cleaned = value
    .normalize('NFKC')
    .replace(/[^A-Za-z0-9._-]+/g, '_')
    .replace(/^[.]+|[. ]+$/g, '')
    .slice(0, 80);
  return cleaned && !WINDOWS_RESERVED_NAME.test(cleaned) ? cleaned : fallback;
};

export const resolveWithinStorage = (storageKey: string): string => {
  const root = path.resolve(config.storageRoot);
  const target = path.resolve(root, storageKey);
  const relative = path.relative(root, target);
  if (!relative || relative.startsWith('..') || path.isAbsolute(relative)) {
    throw new Error('Invalid storage path.');
  }
  return target;
};

export const toStorageKey = (...segments: string[]): string =>
  segments.join('/');

export const PROJECT_DIRECTORY_STRUCTURE = [
  '00_Project/Briefs',
  '00_Project/References',
  '00_Project/Imports',
  '00_Project/Documents',
  '01_Assets/Characters',
  '01_Assets/Environments',
  '01_Assets/Props',
  '01_Assets/Costumes',
  '01_Assets/Vehicles',
  '01_Assets/Creatures',
  '01_Assets/Style_References',
  '02_Shots',
  '03_Audio/Dialogue',
  '03_Audio/SFX',
  '03_Audio/Music',
  '03_Audio/Mix',
  '04_Deliverables/Reviews',
  '04_Deliverables/Final',
  '05_Exchange/Incoming',
  '05_Exchange/Outgoing',
] as const;

export const SHOT_DIRECTORY_STRUCTURE = [
  '01_Inputs',
  '02_Generations',
  '03_Selected',
  '04_Versions',
  '05_Review',
  '06_Source',
] as const;

export const getProjectStorageKey = (projectCode: string): string =>
  sanitizeStorageSegment(projectCode.toUpperCase(), 'PROJECT');

export const getProjectDirectoryKeys = (projectCode: string): string[] => {
  const projectStorageKey = getProjectStorageKey(projectCode);
  return PROJECT_DIRECTORY_STRUCTURE.map(directory =>
    toStorageKey(projectStorageKey, directory)
  );
};

export const ensureProjectStorageStructure = async (input: {
  projectId: string;
  projectCode: string;
  projectName: string;
  requireNewRoot?: boolean;
}): Promise<{
  storageKey: string;
  absolutePath: string;
  directories: string[];
}> => {
  const storageKey = getProjectStorageKey(input.projectCode);
  const absolutePath = resolveWithinStorage(storageKey);
  let createdRoot = false;

  try {
    if (input.requireNewRoot) {
      await mkdir(absolutePath);
      createdRoot = true;
    } else {
      await mkdir(absolutePath, { recursive: true });
    }
    await Promise.all(
      PROJECT_DIRECTORY_STRUCTURE.map(directory =>
        mkdir(resolveWithinStorage(toStorageKey(storageKey, directory)), { recursive: true })
      ),
    );
    const metadataDirectory = resolveWithinStorage(toStorageKey(storageKey, '.shotgrid'));
    await mkdir(metadataDirectory, { recursive: true });
    await writeFile(
      path.join(metadataDirectory, 'project.json'),
      `${JSON.stringify({
        schemaVersion: 1,
        projectId: input.projectId,
        projectCode: input.projectCode,
        projectName: input.projectName,
        storageKey,
        updatedAt: new Date().toISOString(),
      }, null, 2)}\n`,
      'utf8',
    );
    return {
      storageKey,
      absolutePath,
      directories: [...PROJECT_DIRECTORY_STRUCTURE],
    };
  } catch (error) {
    if (createdRoot) {
      await rm(absolutePath, { recursive: true, force: true }).catch(() => undefined);
    }
    throw error;
  }
};

export const getShotStorageKey = (projectCode: string, shotCode: string): string =>
  toStorageKey(
    getProjectStorageKey(projectCode),
    '02_Shots',
    sanitizeStorageSegment(shotCode.toUpperCase(), 'SHOT'),
  );

export const getShotDirectoryKeys = (
  projectCode: string,
  shotCode: string,
): string[] => {
  const shotStorageKey = getShotStorageKey(projectCode, shotCode);
  return SHOT_DIRECTORY_STRUCTURE.map(directory =>
    toStorageKey(shotStorageKey, directory)
  );
};

export const ensureShotStorageStructure = async (input: {
  projectCode: string;
  shotId?: string;
  shotCode: string;
  sceneCode: string;
}): Promise<{
  storageKey: string;
  absolutePath: string;
  directories: string[];
}> => {
  const storageKey = getShotStorageKey(input.projectCode, input.shotCode);
  const absolutePath = resolveWithinStorage(storageKey);
  await mkdir(absolutePath, { recursive: true });
  await Promise.all(
    SHOT_DIRECTORY_STRUCTURE.map(directory =>
      mkdir(resolveWithinStorage(toStorageKey(storageKey, directory)), { recursive: true })
    ),
  );
  const metadataDirectory = resolveWithinStorage(toStorageKey(storageKey, '.shotgrid'));
  await mkdir(metadataDirectory, { recursive: true });
  await writeFile(
    path.join(metadataDirectory, 'shot.json'),
    `${JSON.stringify({
      schemaVersion: 1,
      shotId: input.shotId || null,
      shotCode: input.shotCode,
      sceneCode: input.sceneCode,
      storageKey,
      updatedAt: new Date().toISOString(),
    }, null, 2)}\n`,
    'utf8',
  );
  return {
    storageKey,
    absolutePath,
    directories: [...SHOT_DIRECTORY_STRUCTURE],
  };
};

export const removeProjectStorageStructure = async (storageKey: string): Promise<void> => {
  const normalizedKey = getProjectStorageKey(storageKey);
  if (normalizedKey !== storageKey || storageKey.startsWith('.')) {
    throw new Error('Invalid project storage key.');
  }
  await rm(resolveWithinStorage(storageKey), { recursive: true, force: true });
};

export const ensureStorageDirectories = async (): Promise<void> => {
  await Promise.all([
    mkdir(config.storageRoot, { recursive: true }),
    mkdir(path.join(config.storageRoot, '.tmp'), { recursive: true }),
    mkdir(path.join(config.storageRoot, '.trash'), { recursive: true }),
  ]);
};

export const createManagedStorageKey = (input: {
  projectCode: string;
  entityType?: string | null;
  entityCode?: string | null;
  versionNumber?: string | null;
  originalName: string;
}): string => {
  const projectCode = sanitizeStorageSegment(input.projectCode, 'PROJECT');
  const entityType = sanitizeStorageSegment(input.entityType || 'project', 'project');
  const entityCode = sanitizeStorageSegment(input.entityCode || 'general', 'general');
  const versionNumber = sanitizeStorageSegment(input.versionNumber || 'unversioned', 'unversioned');
  const fileName = `${randomUUID()}-${sanitizeFileName(input.originalName)}`;
  if (entityType === 'asset') {
    return toStorageKey(projectCode, '01_Assets', entityCode, versionNumber, fileName);
  }
  if (entityType === 'shot') {
    return toStorageKey(projectCode, '02_Shots', entityCode, versionNumber, fileName);
  }
  return toStorageKey(projectCode, '00_Project', 'Files', versionNumber, fileName);
};

export const sha256File = async (filePath: string): Promise<string> => {
  const hash = createHash('sha256');
  for await (const chunk of createReadStream(filePath)) hash.update(chunk);
  return hash.digest('hex');
};

export const moveIntoStorage = async (temporaryPath: string, storageKey: string): Promise<string> => {
  const target = resolveWithinStorage(storageKey);
  await mkdir(path.dirname(target), { recursive: true });
  await rename(temporaryPath, target);
  return target;
};

export const moveToTrash = async (storageKey: string, fileId: string): Promise<string> => {
  const source = resolveWithinStorage(storageKey);
  const trashKey = toStorageKey('.trash', `${fileId}-${path.basename(storageKey)}`);
  const target = resolveWithinStorage(trashKey);
  await mkdir(path.dirname(target), { recursive: true });
  await rename(source, target);
  return trashKey;
};

export const removeFileIfPresent = async (filePath: string): Promise<void> => {
  await unlink(filePath).catch((error: NodeJS.ErrnoException) => {
    if (error.code !== 'ENOENT') throw error;
  });
};
