import { Router, type IRouter } from 'express';
import type { IStorage } from '../storage/interface';

const GET_LATEST_PLAN_TOOL = {
  name: 'get_latest_plan',
  description: 'Get the latest version of a plan by series ID.',
  inputSchema: {
    type: 'object',
    properties: {
      series_id: { type: 'string', description: 'The plan series ID.' },
    },
    required: ['series_id'],
  },
};

export function mcpRouter(storage: IStorage): IRouter {
  const router = Router();

  router.get('/get_latest_plan', (req, res) => {
    const series_id = req.query.series_id as string | undefined;
    if (!series_id) return res.status(400).json({ error: 'series_id required' });
    const result = storage.getLatestBySeriesId(series_id);
    if (!result) return res.status(404).json({ error: 'Not found' });
    return res.json({
      series_id: result.series.id,
      version_id: result.version.id,
      content: result.version.content,
      status: result.series.status,
    });
  });

  // Minimal JSON-RPC 2.0 over HTTP
  router.post('/', (req, res) => {
    const { jsonrpc, id, method, params } = req.body ?? {};
    if (jsonrpc !== '2.0') {
      return res.status(400).json({ error: 'Invalid JSON-RPC version' });
    }

    if (method === 'tools/list') {
      return res.json({ jsonrpc: '2.0', id, result: { tools: [GET_LATEST_PLAN_TOOL] } });
    }

    if (method === 'tools/call') {
      const { name, arguments: args } = params ?? {};
      if (name === 'get_latest_plan') {
        const result = storage.getLatestBySeriesId(args?.series_id);
        if (!result) {
          return res.json({
            jsonrpc: '2.0',
            id,
            error: { code: -32602, message: 'Plan not found' },
          });
        }
        return res.json({
          jsonrpc: '2.0',
          id,
          result: {
            series_id: result.series.id,
            version_id: result.version.id,
            content: result.version.content,
            status: result.series.status,
          },
        });
      }
      return res.json({
        jsonrpc: '2.0',
        id,
        error: { code: -32601, message: 'Unknown tool' },
      });
    }

    return res.json({
      jsonrpc: '2.0',
      id,
      error: { code: -32601, message: 'Method not found' },
    });
  });

  return router;
}
