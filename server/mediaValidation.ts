export type VersionMediaType = 'image' | 'video' | 'audio';

const EXTENSION_MIME_PREFIXES = new Map<string, string[]>([
  ['mp4', ['video/mp4']], ['mov', ['video/quicktime']], ['webm', ['video/webm']], ['mkv', ['video/']], ['avi', ['video/']],
  ['png', ['image/png']], ['jpg', ['image/jpeg']], ['jpeg', ['image/jpeg']], ['webp', ['image/webp']], ['gif', ['image/gif']], ['tif', ['image/tiff']], ['tiff', ['image/tiff']],
  ['wav', ['audio/wav', 'audio/x-wav']], ['mp3', ['audio/mpeg']], ['aac', ['audio/aac', 'audio/']],
]);

const VERSION_EXTENSIONS: Record<VersionMediaType, ReadonlySet<string>> = {
  image: new Set(['png', 'jpg', 'jpeg', 'webp', 'gif', 'tif', 'tiff']),
  video: new Set(['mp4', 'mov', 'webm', 'mkv', 'avi']),
  audio: new Set(['wav', 'mp3', 'aac']),
};

export const validateKnownMediaMime = (extension: string, mimeType: string): string | null | undefined => {
  const allowedPrefixes = EXTENSION_MIME_PREFIXES.get(extension);
  if (!allowedPrefixes) return undefined;
  const normalized = (mimeType || 'application/octet-stream').toLowerCase();
  return allowedPrefixes.some(prefix => normalized.startsWith(prefix))
    ? null
    : `文件扩展名 .${extension} 与浏览器上报的 MIME 类型 ${normalized} 不一致。`;
};

export const validateVersionMediaExtension = (mediaType: string, extension: string): string | null => {
  if (!(mediaType in VERSION_EXTENSIONS)) return '版本媒体类型必须是 image、video 或 audio。';
  return VERSION_EXTENSIONS[mediaType as VersionMediaType].has(extension)
    ? null
    : `.${extension} 文件与版本媒体类型 ${mediaType} 不匹配。`;
};
