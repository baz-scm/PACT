import { Router, type IRouter } from 'express';
import type { IStorage } from '../storage/interface';

function planResponse(result: NonNullable<ReturnType<IStorage['getLatestBySeriesId']>>) {
  return {
    series_id: result.series.id,
    version_id: result.version.id,
    content: result.version.content,
    author_kind: result.version.author_kind,
    source_tool: result.version.source_tool,
    model_id: result.version.model_id,
    input_tokens: result.version.input_tokens,
    output_tokens: result.version.output_tokens,
    expires_at: result.series.expires_at,
    approved: result.series.approved,
    rejected: result.series.rejected,
    implemented: result.series.implemented,
    share_token: result.series.share_token,
    created_at: result.version.created_at,
  };
}

export function plansRouter(storage: IStorage, plansTtlHours: number): IRouter {
  const router = Router();

  router.get('/', (_req, res) => {
    const results = storage.listAll();
    return res.json(results.map(planResponse));
  });

  router.post('/', (req, res) => {
    const { series_key, content, author_kind, source_tool, model_id, input_tokens, output_tokens } = req.body ?? {};
    if (!content || !author_kind || !source_tool) {
      return res.status(400).json({ error: 'content, author_kind, source_tool required' });
    }

    const result = storage.createPlan({
      series_key,
      content,
      author_kind,
      source_tool,
      model_id,
      input_tokens,
      output_tokens,
      ttl_hours: plansTtlHours,
    });

    const status = result.isNewSeries ? 201 : 200;
    return res.status(status).json({
      series_id: result.series.id,
      version_id: result.version.id,
      share_token: result.series.share_token,
      url: `/viewer/${result.series.share_token}`,
      expires_at: result.series.expires_at,
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
    const { content } = req.body ?? {};
    if (!content) return res.status(400).json({ error: 'content required' });
    const result = storage.savePlan(req.params.series_id, content);
    if (!result) return res.status(404).json({ error: 'Not found' });
    return res.json(planResponse(result));
  });

  router.post('/:series_id/approve', (req, res) => {
    const ok = storage.approvePlan(req.params.series_id);
    if (!ok) return res.status(404).json({ error: 'Not found' });
    return res.json({ approved: true });
  });

  router.post('/:series_id/reject', (req, res) => {
    const ok = storage.rejectPlan(req.params.series_id);
    if (!ok) return res.status(404).json({ error: 'Not found' });
    return res.json({ rejected: true });
  });

  router.post('/:series_id/implement', (req, res) => {
    const ok = storage.implementPlan(req.params.series_id);
    if (!ok) return res.status(404).json({ error: 'Not found' });
    return res.json({ implemented: true });
  });

  router.delete('/:series_id', (req, res) => {
    const ok = storage.delistPlan(req.params.series_id);
    if (!ok) return res.status(404).json({ error: 'Not found' });
    return res.json({ delisted: true });
  });

  return router;
}
