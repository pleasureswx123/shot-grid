import { createServer } from 'node:http';
import { createApp } from './app';
import { ensureBootstrapAdmin } from './bootstrap';
import { config } from './config';
import { closeDatabase, pool } from './db';
import { runMigrations } from './migrate';
import { ensureProjectStorageStructure, ensureStorageDirectories } from './storage';

const ensureExistingProjectDirectories = async (): Promise<void> => {
  const result = await pool.query<{
    id: string;
    code: string;
    name: string;
  }>('SELECT id, code, name FROM projects ORDER BY created_at ASC');

  for (const project of result.rows) {
    await ensureProjectStorageStructure({
      projectId: project.id,
      projectCode: project.code,
      projectName: project.name,
    });
  }
};

const start = async (): Promise<void> => {
  if (config.autoMigrate) await runMigrations();
  await ensureBootstrapAdmin();
  await ensureStorageDirectories();
  await ensureExistingProjectDirectories();

  const app = await createApp();
  const server = createServer(app);

  server.listen(config.port, config.host, () => {
    console.info(`[server] ShotGrid Light listening on http://${config.host}:${config.port}`);
  });

  const shutdown = (signal: string) => {
    console.info(`[server] received ${signal}, shutting down`);
    server.close(async () => {
      await closeDatabase();
      process.exit(0);
    });

    setTimeout(() => {
      console.error('[server] forced shutdown after timeout');
      process.exit(1);
    }, 10_000).unref();
  };

  process.once('SIGINT', () => shutdown('SIGINT'));
  process.once('SIGTERM', () => shutdown('SIGTERM'));
};

start().catch(async (error) => {
  console.error('[server] startup failed', error);
  await closeDatabase().catch(() => undefined);
  process.exitCode = 1;
});
