import express, { type Express } from 'express';
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

  return app;
}
