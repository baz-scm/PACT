import express, { type Express } from 'express';
import path from 'node:path';
import fs from 'node:fs';
import { plansRouter } from './routes/plans';
import { commentsRouter } from './routes/comments';
import { mcpRouter } from './routes/mcp';
import type { IStorage } from './storage/interface';

export function createApp(storage: IStorage, plansTtlHours = 24): Express {
  const app = express();
  app.use(express.json());

  app.get('/healthz', (_req, res) => res.json({ ok: true }));

  app.use('/api/plans', plansRouter(storage, plansTtlHours));
  app.use('/api/plans/:series_id/comments', commentsRouter(storage));
  app.use('/mcp', mcpRouter(storage));

  const clientDist = path.resolve(__dirname, '../../../client/dist');
  if (fs.existsSync(clientDist)) {
    app.use(express.static(clientDist));
    app.get('/viewer/*', (_req, res) => res.sendFile(path.join(clientDist, 'index.html')));
    app.get('/', (_req, res) => res.sendFile(path.join(clientDist, 'index.html')));
  }

  return app;
}
