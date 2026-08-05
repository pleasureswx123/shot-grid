import express from 'express';
import type { ErrorRequestHandler, RequestHandler } from 'express';
import path from 'node:path';
import { authRouter, loadAuthenticatedUser, requireAuth } from './auth';
import { adminRouter } from './admin';
import { config } from './config';
import { pool } from './db';
import { filesRouter } from './files';
import { projectsRouter } from './projects';
import { usersRouter } from './users';
import { scenesRouter } from './scenes';
import { shotsRouter } from './shots';
import { assetsRouter } from './assets';
import { tasksRouter } from './tasks';
import { versionsRouter } from './versions';
import { projectReviewListsRouter, reviewListsRouter } from './reviews';
import { notesRouter, versionNotesRouter } from './notes';
import { chatRouter } from './chat';

const projectRoot = process.cwd();

const applySecurityHeaders: RequestHandler = (_request, response, next) => {
  response.setHeader('X-Content-Type-Options', 'nosniff');
  response.setHeader('X-Frame-Options', 'SAMEORIGIN');
  response.setHeader('Referrer-Policy', 'same-origin');
  response.setHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');
  next();
};

const verifySameOrigin: RequestHandler = (request, response, next) => {
  if (['GET', 'HEAD', 'OPTIONS'].includes(request.method)) {
    next();
    return;
  }

  const origin = request.get('origin');
  const host = request.get('host');
  if (!origin || !host) {
    next();
    return;
  }

  try {
    if (new URL(origin).host !== host) {
      response.status(403).json({ error: '请求来源无效。' });
      return;
    }
  } catch {
    response.status(403).json({ error: '请求来源无效。' });
    return;
  }
  next();
};

export const createApp = async () => {
  const app = express();
  app.disable('x-powered-by');
  app.use(applySecurityHeaders);
  app.use(express.json({ limit: '2mb' }));
  app.use(verifySameOrigin);

  app.get('/api/health/live', (_request, response) => {
    response.json({ status: 'ok' });
  });

  app.get('/api/health/ready', async (_request, response, next) => {
    try {
      await pool.query('SELECT 1');
      response.json({ status: 'ready', database: 'connected' });
    } catch (error) {
      next(error);
    }
  });

  app.use('/api', loadAuthenticatedUser);
  app.use('/api/auth', authRouter);
  app.use('/api/admin', requireAuth, adminRouter);
  app.use('/api/users', requireAuth, usersRouter);
  app.use('/api/projects', requireAuth, projectsRouter);
  app.use('/api/files', requireAuth, filesRouter);
  app.use('/api/scenes', requireAuth, scenesRouter);
  app.use('/api/shots', requireAuth, shotsRouter);
  app.use('/api/assets', requireAuth, assetsRouter);
  app.use('/api/tasks', requireAuth, tasksRouter);
  app.use('/api/versions', requireAuth, versionsRouter);
  app.use('/api/projects/:projectId/review-lists', requireAuth, projectReviewListsRouter);
  app.use('/api/review-lists', requireAuth, reviewListsRouter);
  app.use('/api/versions/:versionId/notes', requireAuth, versionNotesRouter);
  app.use('/api/notes', requireAuth, notesRouter);
  app.use('/api/chat', requireAuth, chatRouter);
  app.get('/api/system/info', requireAuth, (request, response) => {
    response.json({
      name: 'ShotGrid Light',
      mode: 'lan',
      user: request.authUser,
    });
  });

  app.use('/api', (_request, response) => {
    response.status(404).json({ error: '接口不存在。' });
  });

  const apiErrorHandler: ErrorRequestHandler = (error, request, response, _next) => {
    console.error(`[api] ${request.method} ${request.originalUrl}`, error);
    response.status(500).json({
      error: config.nodeEnv === 'production' ? '服务器内部错误。' : String(error?.message || error),
    });
  };
  app.use(apiErrorHandler);

  if (config.nodeEnv === 'production') {
    const distDirectory = path.resolve(projectRoot, 'dist');
    app.use(express.static(distDirectory, { index: false }));
    app.get('*', (_request, response) => {
      response.sendFile(path.join(distDirectory, 'index.html'));
    });
  } else {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      root: projectRoot,
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  }

  return app;
};
