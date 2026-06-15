import { Router, type IRouter } from 'express';
import { rateLimit } from 'express-rate-limit';
import crypto from 'crypto';
import type { IStorage } from '../storage/interface';

function ipHash(ip: string) {
  return crypto.createHash('sha256').update(ip).digest('hex');
}

export function commentsRouter(storage: IStorage): IRouter {
  const router = Router({ mergeParams: true });

  const limiter = rateLimit({
    windowMs: 60 * 1000,
    limit: 5,
    keyGenerator: (req) => `${req.ip}:${(req.params as { series_id: string }).series_id}`,
    standardHeaders: true,
    legacyHeaders: false,
  });

  router.get('/', (req, res) => {
    const { series_id } = req.params as { series_id: string };
    const comments = storage.getComments(series_id);
    return res.json(comments);
  });

  router.post('/', limiter, (req, res) => {
    const { series_id } = req.params as { series_id: string };
    const { body, anchor } = req.body ?? {};
    if (!body || typeof body !== 'string' || body.trim() === '') {
      return res.status(400).json({ error: 'body required' });
    }
    const comment = storage.addComment(
      series_id,
      body.trim(),
      ipHash(req.ip ?? ''),
      typeof anchor === 'string' ? anchor : undefined,
    );
    return res.status(201).json(comment);
  });

  router.patch('/:comment_id', (req, res) => {
    const { series_id, comment_id } = req.params as { series_id: string; comment_id: string };
    const { body } = req.body ?? {};
    if (!body || typeof body !== 'string' || body.trim() === '') {
      return res.status(400).json({ error: 'body required' });
    }
    const updated = storage.updateComment(series_id, comment_id, body.trim());
    if (!updated) return res.status(404).json({ error: 'Not found' });
    return res.json(updated);
  });

  router.post('/:comment_id/resolve', (req, res) => {
    const { series_id, comment_id } = req.params as { series_id: string; comment_id: string };
    const ok = storage.resolveComment(comment_id, series_id);
    if (!ok) return res.status(404).json({ error: 'Not found' });
    return res.json({ resolved: true });
  });

  router.delete('/:comment_id', (req, res) => {
    const { series_id, comment_id } = req.params as { series_id: string; comment_id: string };
    const ok = storage.deleteComment(comment_id, series_id);
    if (!ok) return res.status(404).json({ error: 'Not found' });
    return res.json({ deleted: true });
  });

  return router;
}
