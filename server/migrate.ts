import { createHash } from 'node:crypto';
import { readdir, readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import type { PoolClient } from 'pg';
import { closeDatabase, pool } from './db';

const currentDirectory = path.dirname(fileURLToPath(import.meta.url));
const migrationsDirectory = path.resolve(process.cwd(), 'server', 'migrations');
const MIGRATION_LOCK_ID = 2_017_072_800;

const ensureMigrationTable = async (client: PoolClient): Promise<void> => {
  await client.query(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      filename text PRIMARY KEY,
      checksum char(64) NOT NULL,
      applied_at timestamptz NOT NULL DEFAULT now()
    )
  `);
};

export const runMigrations = async (): Promise<void> => {
  const client = await pool.connect();

  try {
    await client.query('SELECT pg_advisory_lock($1)', [MIGRATION_LOCK_ID]);
    await ensureMigrationTable(client);

    const migrationFiles = (await readdir(migrationsDirectory))
      .filter((filename) => filename.endsWith('.sql'))
      .sort();

    for (const filename of migrationFiles) {
      const sql = await readFile(path.join(migrationsDirectory, filename), 'utf8');
      const checksum = createHash('sha256').update(sql).digest('hex');
      const existing = await client.query<{ checksum: string }>(
        'SELECT checksum FROM schema_migrations WHERE filename = $1',
        [filename],
      );

      if (existing.rowCount) {
        if (existing.rows[0].checksum !== checksum) {
          throw new Error(`Migration ${filename} changed after it was applied.`);
        }
        continue;
      }

      await client.query('BEGIN');
      try {
        await client.query(sql);
        await client.query(
          'INSERT INTO schema_migrations (filename, checksum) VALUES ($1, $2)',
          [filename, checksum],
        );
        await client.query('COMMIT');
        console.info(`[database] applied migration ${filename}`);
      } catch (error) {
        await client.query('ROLLBACK');
        throw error;
      }
    }
  } finally {
    await client.query('SELECT pg_advisory_unlock($1)', [MIGRATION_LOCK_ID]).catch(() => undefined);
    client.release();
  }
};

const isDirectExecution = process.argv[1] &&
  path.resolve(process.argv[1]) === path.resolve(fileURLToPath(import.meta.url));

if (isDirectExecution) {
  runMigrations()
    .then(() => console.info('[database] migrations are up to date'))
    .catch((error) => {
      console.error('[database] migration failed', error);
      process.exitCode = 1;
    })
    .finally(closeDatabase);
}
