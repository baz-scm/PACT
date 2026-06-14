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
  content: '# My Plan\n\nStep 1.',
  author_kind: 'agent',
  source_tool: 'claude-code',
};

describe('POST /api/plans', () => {
  it('creates a plan and returns metadata', async () => {
    const { app } = makeApp();
    const res = await request(app).post('/api/plans').send(planBody);
    expect(res.status).toBe(201);
    expect(res.body.series_id).toBeTruthy();
    expect(res.body.version_id).toBeTruthy();
    expect(res.body.share_token).toBeTruthy();
    expect(res.body.url).toMatch(/^\/viewer\//);
    expect(res.body.expires_at).toBeTruthy();
    expect(res.body.creator_token).toBeTruthy();
  });

  it('deduplicates same content', async () => {
    const { app } = makeApp();
    const first = await request(app).post('/api/plans').send(planBody);
    const second = await request(app).post('/api/plans').send(planBody);
    expect(second.status).toBe(200);
    expect(second.body.version_id).toBe(first.body.version_id);
  });

  it('returns new version_id on same series_key with different content', async () => {
    const { app } = makeApp();
    const first = await request(app).post('/api/plans').send(planBody);
    const second = await request(app)
      .post('/api/plans')
      .send({ ...planBody, content: '# Updated' });
    expect(second.status).toBe(200);
    expect(second.body.series_id).toBe(first.body.series_id);
    expect(second.body.version_id).not.toBe(first.body.version_id);
  });

  it('rejects missing required fields', async () => {
    const { app } = makeApp();
    const res = await request(app).post('/api/plans').send({ content: 'hi' });
    expect(res.status).toBe(400);
  });

  it('creates a new series when series_key is omitted', async () => {
    const { app } = makeApp();
    const body = { content: '# Plan', author_kind: 'agent', source_tool: 'claude-code' };
    const first = await request(app).post('/api/plans').send(body);
    const second = await request(app).post('/api/plans').send(body);
    expect(first.status).toBe(201);
    expect(second.status).toBe(201);
    expect(second.body.series_id).not.toBe(first.body.series_id);
  });
});

describe('GET /api/plans/:series_id', () => {
  it('returns 404 for unknown series', async () => {
    const { app } = makeApp();
    const res = await request(app).get('/api/plans/nope');
    expect(res.status).toBe(404);
  });

  it('returns plan content', async () => {
    const { app } = makeApp();
    const created = await request(app).post('/api/plans').send(planBody);
    const res = await request(app).get(`/api/plans/${created.body.series_id}`);
    expect(res.status).toBe(200);
    expect(res.body.content).toBe(planBody.content);
    expect(res.body.approved).toBe(false);
  });
});

describe('GET /api/plans/share/:share_token', () => {
  it('returns 404 for unknown token', async () => {
    const { app } = makeApp();
    const res = await request(app).get('/api/plans/share/badtoken');
    expect(res.status).toBe(404);
  });

  it('resolves share token to plan', async () => {
    const { app } = makeApp();
    const created = await request(app).post('/api/plans').send(planBody);
    const res = await request(app).get(`/api/plans/share/${created.body.share_token}`);
    expect(res.status).toBe(200);
    expect(res.body.content).toBe(planBody.content);
  });
});

describe('PUT /api/plans/:series_id', () => {
  it('returns 401 with wrong creator_token', async () => {
    const { app } = makeApp();
    const created = await request(app).post('/api/plans').send(planBody);
    const res = await request(app)
      .put(`/api/plans/${created.body.series_id}`)
      .send({ content: '# Edited', creator_token: 'bad' });
    expect(res.status).toBe(401);
  });

  it('saves edited content', async () => {
    const { app } = makeApp();
    const created = await request(app).post('/api/plans').send(planBody);
    const res = await request(app)
      .put(`/api/plans/${created.body.series_id}`)
      .send({ content: '# Edited by human', creator_token: created.body.creator_token });
    expect(res.status).toBe(200);
    expect(res.body.content).toBe('# Edited by human');
  });
});

describe('POST /api/plans/:series_id/approve', () => {
  it('returns 401 with wrong token', async () => {
    const { app } = makeApp();
    const created = await request(app).post('/api/plans').send(planBody);
    const res = await request(app)
      .post(`/api/plans/${created.body.series_id}/approve`)
      .send({ creator_token: 'bad' });
    expect(res.status).toBe(401);
  });

  it('approves plan', async () => {
    const { app } = makeApp();
    const created = await request(app).post('/api/plans').send(planBody);
    const res = await request(app)
      .post(`/api/plans/${created.body.series_id}/approve`)
      .send({ creator_token: created.body.creator_token });
    expect(res.status).toBe(200);
    expect(res.body.approved).toBe(true);
  });

  it('approved flag visible on subsequent GET', async () => {
    const { app } = makeApp();
    const created = await request(app).post('/api/plans').send(planBody);
    await request(app)
      .post(`/api/plans/${created.body.series_id}/approve`)
      .send({ creator_token: created.body.creator_token });
    const res = await request(app).get(`/api/plans/${created.body.series_id}`);
    expect(res.body.approved).toBe(true);
  });
});

describe('DELETE /api/plans/:series_id', () => {
  it('returns 401 with wrong token', async () => {
    const { app } = makeApp();
    const created = await request(app).post('/api/plans').send(planBody);
    const res = await request(app)
      .delete(`/api/plans/${created.body.series_id}`)
      .send({ creator_token: 'bad' });
    expect(res.status).toBe(401);
  });

  it('delists plan, making GET return 404', async () => {
    const { app } = makeApp();
    const created = await request(app).post('/api/plans').send(planBody);
    await request(app)
      .delete(`/api/plans/${created.body.series_id}`)
      .send({ creator_token: created.body.creator_token });
    const res = await request(app).get(`/api/plans/${created.body.series_id}`);
    expect(res.status).toBe(404);
  });
});

describe('POST /api/plans/:series_id/reject', () => {
  it('returns 401 with wrong token', async () => {
    const { app } = makeApp();
    const created = await request(app).post('/api/plans').send(planBody);
    const res = await request(app)
      .post(`/api/plans/${created.body.series_id}/reject`)
      .send({ creator_token: 'bad' });
    expect(res.status).toBe(401);
  });

  it('rejects plan', async () => {
    const { app } = makeApp();
    const created = await request(app).post('/api/plans').send(planBody);
    const res = await request(app)
      .post(`/api/plans/${created.body.series_id}/reject`)
      .send({ creator_token: created.body.creator_token });
    expect(res.status).toBe(200);
    expect(res.body.rejected).toBe(true);
  });

  it('rejected flag visible on subsequent GET', async () => {
    const { app } = makeApp();
    const created = await request(app).post('/api/plans').send(planBody);
    await request(app)
      .post(`/api/plans/${created.body.series_id}/reject`)
      .send({ creator_token: created.body.creator_token });
    const res = await request(app).get(`/api/plans/${created.body.series_id}`);
    expect(res.body.rejected).toBe(true);
  });

  it('approve after reject clears rejected flag', async () => {
    const { app } = makeApp();
    const created = await request(app).post('/api/plans').send(planBody);
    await request(app)
      .post(`/api/plans/${created.body.series_id}/reject`)
      .send({ creator_token: created.body.creator_token });
    await request(app)
      .post(`/api/plans/${created.body.series_id}/approve`)
      .send({ creator_token: created.body.creator_token });
    const res = await request(app).get(`/api/plans/${created.body.series_id}`);
    expect(res.body.approved).toBe(true);
    expect(res.body.rejected).toBe(false);
  });

  it('reject after approve clears approved flag', async () => {
    const { app } = makeApp();
    const created = await request(app).post('/api/plans').send(planBody);
    await request(app)
      .post(`/api/plans/${created.body.series_id}/approve`)
      .send({ creator_token: created.body.creator_token });
    await request(app)
      .post(`/api/plans/${created.body.series_id}/reject`)
      .send({ creator_token: created.body.creator_token });
    const res = await request(app).get(`/api/plans/${created.body.series_id}`);
    expect(res.body.rejected).toBe(true);
    expect(res.body.approved).toBe(false);
  });
});

describe('GET /healthz', () => {
  it('returns 200', async () => {
    const { app } = makeApp();
    const res = await request(app).get('/healthz');
    expect(res.status).toBe(200);
  });
});
