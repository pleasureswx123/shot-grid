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
  storageRoot: path.resolve(process.env.STORAGE_ROOT || path.join(process.cwd(), 'storage')),
  maxUploadBytes: readInteger('MAX_UPLOAD_MB', 2048) * 1024 * 1024,
};

export const requireDatabaseUrl = (): string => {
  if (!config.databaseUrl) {
    throw new Error('DATABASE_URL is required. Copy .env.example to .env and configure PostgreSQL.');
  }
  return config.databaseUrl;
};
