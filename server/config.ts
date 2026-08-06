import 'dotenv/config';
import path from 'node:path';

const readInteger = (name: string, fallback: number, minimum = 1): number => {
  const raw = process.env[name];
  if (!raw) return fallback;

  const value = Number.parseInt(raw, 10);
  if (!Number.isInteger(value) || value < minimum) {
    throw new Error(`${name} must be an integer greater than or equal to ${minimum}.`);
  }
  return value;
};

const readList = (name: string): string[] => (process.env[name] || '')
  .split(';')
  .map(item => item.trim())
  .filter(Boolean);

const readBoolean = (name: string, fallback: boolean): boolean => {
  const raw = process.env[name];
  if (!raw) return fallback;
  if (raw === 'true') return true;
  if (raw === 'false') return false;
  throw new Error(`${name} must be either "true" or "false".`);
};

export const config = {
  nodeEnv: process.env.NODE_ENV || 'development',
  host: process.env.HOST || '0.0.0.0',
  port: readInteger('PORT', 3000),
  databaseUrl: process.env.DATABASE_URL || '',
  databaseSsl: readBoolean('DATABASE_SSL', false),
  databasePoolMax: readInteger('DATABASE_POOL_MAX', 20),
  autoMigrate: readBoolean('AUTO_MIGRATE', true),
  bootstrapAdminName: process.env.BOOTSTRAP_ADMIN_NAME || '系统管理员',
  bootstrapAdminEmail: (process.env.BOOTSTRAP_ADMIN_EMAIL || 'admin@studio.local').trim().toLowerCase(),
  bootstrapAdminPassword: process.env.BOOTSTRAP_ADMIN_PASSWORD || '',
  sessionTtlHours: readInteger('SESSION_TTL_HOURS', 168),
  sessionCookieSecure: readBoolean('SESSION_COOKIE_SECURE', false),
  sessionCookieSecureExplicit: process.env.SESSION_COOKIE_SECURE !== undefined,
  trustProxy: process.env.TRUST_PROXY || 'loopback, linklocal, uniquelocal',
  virusScanCommand: process.env.VIRUS_SCAN_COMMAND || '',
  storageRoot: path.resolve(process.env.STORAGE_ROOT || path.join(process.cwd(), 'storage')),
  maxUploadBytes: readInteger('MAX_UPLOAD_MB', 2048) * 1024 * 1024,
  nasRootWhitelist: readList('NAS_ROOT_WHITELIST'),
};

export const requireDatabaseUrl = (): string => {
  if (!config.databaseUrl) {
    throw new Error('DATABASE_URL is required. Copy .env.example to .env and configure PostgreSQL.');
  }
  return config.databaseUrl;
};

if (config.nodeEnv === 'production' && (!config.sessionCookieSecureExplicit || !config.sessionCookieSecure)) {
  const message = 'Production requires SESSION_COOKIE_SECURE=true so browser sessions are only sent over HTTPS.';
  if (process.env.ALLOW_INSECURE_PRODUCTION_COOKIES === 'true') {
    console.error(`[security] ${message} Continuing only because ALLOW_INSECURE_PRODUCTION_COOKIES=true.`);
  } else {
    throw new Error(`${message} Set SESSION_COOKIE_SECURE=true or explicitly acknowledge the risk with ALLOW_INSECURE_PRODUCTION_COOKIES=true.`);
  }
}
