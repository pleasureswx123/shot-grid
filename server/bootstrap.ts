import { randomUUID } from 'node:crypto';
import { config } from './config';
import { pool } from './db';
import { hashPassword } from './security';

export const ensureBootstrapAdmin = async (): Promise<void> => {
  const result = await pool.query<{ count: string }>('SELECT count(*)::text AS count FROM users');
  if (Number(result.rows[0].count) > 0) return;

  if (!config.bootstrapAdminPassword || config.bootstrapAdminPassword === 'change-this-before-first-start') {
    throw new Error(
      'No users exist. Set a strong BOOTSTRAP_ADMIN_PASSWORD in .env before the first startup.',
    );
  }

  const passwordHash = await hashPassword(config.bootstrapAdminPassword);
  await pool.query(
    `INSERT INTO users (id, name, email, password_hash, role, department)
     VALUES ($1, $2, $3, $4, 'admin', '系统管理')`,
    [
      randomUUID(),
      config.bootstrapAdminName,
      config.bootstrapAdminEmail,
      passwordHash,
    ],
  );

  console.info(`[bootstrap] created administrator ${config.bootstrapAdminEmail}`);
};

