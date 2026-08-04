import pg from 'pg';
import { config, requireDatabaseUrl } from './config';

const { Pool } = pg;

export const pool = new Pool({
  connectionString: requireDatabaseUrl(),
  max: config.databasePoolMax,
  ssl: config.databaseSsl ? { rejectUnauthorized: false } : undefined,
  application_name: 'shotgrid-light',
});

pool.on('error', (error) => {
  console.error('[database] idle client error', error);
});

export const closeDatabase = async (): Promise<void> => {
  await pool.end();
};

