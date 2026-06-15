import { describe, it, expect } from 'vitest';
import request from 'supertest';
import { createApp } from '../src/app';
import { SqliteStorage } from '../src/storage/sqlite';

function makeApp() {
  const storage = new SqliteStorage(':memory:');
  return { app: createApp(storage), storage };
}

const planBody = {
  series_key: 'session1::/repo:main',
  content: '# Plan\n\nDo the thing.',
  author_kind: 'agent',
  source_tool: 'claude-code',
};

describe('GET /mcp/get_latest_plan', () => {
  it('returns 400 without series_id', async () => {
    const { app } = makeApp();
    const res = await request(app).get('/mcp/get_latest_plan');
    expect(res.status).toBe(400);
  });

  it('returns 404 for unknown series_id', async () => {
    const { app } = makeApp();
    const res = await request(app).get('/mcp/get_latest_plan?series_id=nope');
    expect(res.status).toBe(404);
  });

  it('returns plan content when not yet approved', async () => {
    const { app } = makeApp();
    const created = await request(app).post('/api/plans').send(planBody);
    const res = await request(app).get(
      `/mcp/get_latest_plan?series_id=${created.body.series_id}`,
    );
    expect(res.status).toBe(200);
    expect(res.body.content).toBe(planBody.content);
    expect(res.body.status).toBe('pending');
  });

  it('returns approved=true after approval', async () => {
    const { app } = makeApp();
    const created = await request(app).post('/api/plans').send(planBody);
    await request(app)
      .post(`/api/plans/${created.body.series_id}/approve`)
      .send({ creator_token: created.body.creator_token });
    const res = await request(app).get(
      `/mcp/get_latest_plan?series_id=${created.body.series_id}`,
    );
    expect(res.body.status).toBe('approved');
  });
});

describe('POST /mcp (JSON-RPC)', () => {
  it('tools/list returns get_latest_plan tool', async () => {
    const { app } = makeApp();
    const res = await request(app)
      .post('/mcp')
      .send({ jsonrpc: '2.0', id: 1, method: 'tools/list', params: {} });
    expect(res.status).toBe(200);
    const tools = res.body.result.tools as Array<{ name: string }>;
    expect(tools.some((t) => t.name === 'get_latest_plan')).toBe(true);
  });

  it('tools/call get_latest_plan returns plan', async () => {
    const { app } = makeApp();
    const created = await request(app).post('/api/plans').send(planBody);
    const res = await request(app).post('/mcp').send({
      jsonrpc: '2.0',
      id: 2,
      method: 'tools/call',
      params: { name: 'get_latest_plan', arguments: { series_id: created.body.series_id } },
    });
    expect(res.status).toBe(200);
    expect(res.body.result.content).toBe(planBody.content);
  });
});
