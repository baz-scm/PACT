import { Router, type IRouter } from 'express';
import type { IStorage } from '../storage/interface';

function planResponse(result: NonNullable<ReturnType<IStorage['getLatestBySeriesId']>>) {
  return {
    series_id: result.series.id,
    version_id: result.version.id,
    content: result.version.content,
    author_kind: result.version.author_kind,
    source_tool: result.version.source_tool,
    expires_at: result.series.expires_at,
    approved: result.series.approved,
    share_token: result.series.share_token,
    created_at: result.version.created_at,
  };
}

export function plansRouter(storage: IStorage, plansTtlHours: number): IRouter {
  const router = Router();

  router.post('/', (req, res) => {
    const { series_key, content, author_kind, source_tool } = req.body ?? {};
    if (!series_key || !content || !author_kind || !source_tool) {
      return res.status(400).json({ error: 'series_key, content, author_kind, source_tool required' });
    }

    const result = storage.createPlan({
      series_key,
      content,
      author_kind,
      source_tool,
      ttl_hours: plansTtlHours,
    });

    const status = result.isNewSeries ? 201 : 200;
    return res.status(status).json({
      series_id: result.series.id,
      version_id: result.version.id,
      share_token: result.series.share_token,
      url: `/p/${result.series.share_token}`,
      expires_at: result.series.expires_at,
      creator_token: result.series.creator_token,
    });
  });

  // Must come before /:series_id to avoid "share" matching as an id
  router.get('/share/:share_token', (req, res) => {
    const result = storage.getByShareToken(req.params.share_token);
    if (!result) return res.status(404).json({ error: 'Not found' });
    return res.json(planResponse(result));
  });

  router.get('/:series_id', (req, res) => {
    const result = storage.getLatestBySeriesId(req.params.series_id);
    if (!result) return res.status(404).json({ error: 'Not found' });
    return res.json(planResponse(result));
  });

  router.put('/:series_id', (req, res) => {
    const { content, creator_token } = req.body ?? {};
    if (!content || !creator_token) {
      return res.status(400).json({ error: 'content and creator_token required' });
    }
    const result = storage.savePlan(req.params.series_id, content, creator_token);
    if (!result) return res.status(401).json({ error: 'Unauthorized' });
    return res.json(planResponse(result));
  });

  router.post('/:series_id/approve', (req, res) => {
    const { creator_token } = req.body ?? {};
    if (!creator_token) return res.status(400).json({ error: 'creator_token required' });
    const ok = storage.approvePlan(req.params.series_id, creator_token);
    if (!ok) return res.status(401).json({ error: 'Unauthorized' });
    return res.json({ approved: true });
  });

  router.delete('/:series_id', (req, res) => {
    const { creator_token } = req.body ?? {};
    if (!creator_token) return res.status(400).json({ error: 'creator_token required' });
    const ok = storage.delistPlan(req.params.series_id, creator_token);
    if (!ok) return res.status(401).json({ error: 'Unauthorized' });
    return res.json({ delisted: true });
  });

  return router;
}
