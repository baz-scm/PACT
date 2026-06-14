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
  content: '# Plan',
  author_kind: 'agent',
  source_tool: 'claude-code',
};

describe('Comments API', () => {
  it('GET returns empty array initially', async () => {
    const { app } = makeApp();
    const created = await request(app).post('/api/plans').send(planBody);
    const res = await request(app).get(`/api/plans/${created.body.series_id}/comments`);
    expect(res.status).toBe(200);
    expect(res.body).toEqual([]);
  });

  it('POST adds a comment', async () => {
    const { app } = makeApp();
    const created = await request(app).post('/api/plans').send(planBody);
    const res = await request(app)
      .post(`/api/plans/${created.body.series_id}/comments`)
      .send({ body: 'Looks good!' });
    expect(res.status).toBe(201);
    expect(res.body.id).toBeTruthy();
    expect(res.body.body).toBe('Looks good!');
  });

  it('POST rejects empty body', async () => {
    const { app } = makeApp();
    const created = await request(app).post('/api/plans').send(planBody);
    const res = await request(app)
      .post(`/api/plans/${created.body.series_id}/comments`)
      .send({ body: '' });
    expect(res.status).toBe(400);
  });

  it('GET lists all comments', async () => {
    const { app } = makeApp();
    const created = await request(app).post('/api/plans').send(planBody);
    await request(app)
      .post(`/api/plans/${created.body.series_id}/comments`)
      .send({ body: 'First' });
    await request(app)
      .post(`/api/plans/${created.body.series_id}/comments`)
      .send({ body: 'Second' });
    const res = await request(app).get(`/api/plans/${created.body.series_id}/comments`);
    expect(res.body).toHaveLength(2);
  });

  it('DELETE removes comment with valid creator token', async () => {
    const { app } = makeApp();
    const created = await request(app).post('/api/plans').send(planBody);
    const comment = await request(app)
      .post(`/api/plans/${created.body.series_id}/comments`)
      .send({ body: 'Remove me' });
    const res = await request(app)
      .delete(`/api/plans/${created.body.series_id}/comments/${comment.body.id}`)
      .send({ token: created.body.creator_token });
    expect(res.status).toBe(200);
    const list = await request(app).get(`/api/plans/${created.body.series_id}/comments`);
    expect(list.body).toHaveLength(0);
  });

  it('DELETE returns 401 with wrong token', async () => {
    const { app } = makeApp();
    const created = await request(app).post('/api/plans').send(planBody);
    const comment = await request(app)
      .post(`/api/plans/${created.body.series_id}/comments`)
      .send({ body: 'Keep me' });
    const res = await request(app)
      .delete(`/api/plans/${created.body.series_id}/comments/${comment.body.id}`)
      .send({ token: 'bad' });
    expect(res.status).toBe(401);
  });

  it('POST .../resolve marks comment as resolved', async () => {
    const { app } = makeApp();
    const created = await request(app).post('/api/plans').send(planBody);
    const comment = await request(app)
      .post(`/api/plans/${created.body.series_id}/comments`)
      .send({ body: 'Resolve me' });
    const res = await request(app)
      .post(`/api/plans/${created.body.series_id}/comments/${comment.body.id}/resolve`)
      .send({ creator_token: created.body.creator_token });
    expect(res.status).toBe(200);
    expect(res.body.resolved).toBe(true);
    const list = await request(app).get(`/api/plans/${created.body.series_id}/comments`);
    expect(list.body[0].resolved).toBe(true);
  });

  it('POST .../resolve returns 401 with wrong creator_token', async () => {
    const { app } = makeApp();
    const created = await request(app).post('/api/plans').send(planBody);
    const comment = await request(app)
      .post(`/api/plans/${created.body.series_id}/comments`)
      .send({ body: 'Keep me' });
    const res = await request(app)
      .post(`/api/plans/${created.body.series_id}/comments/${comment.body.id}/resolve`)
      .send({ creator_token: 'bad' });
    expect(res.status).toBe(401);
  });

  it('rate limits after 5 comments per minute from same IP', async () => {
    const { app } = makeApp();
    const created = await request(app).post('/api/plans').send(planBody);
    for (let i = 0; i < 5; i++) {
      await request(app)
        .post(`/api/plans/${created.body.series_id}/comments`)
        .send({ body: `Comment ${i}` });
    }
    const res = await request(app)
      .post(`/api/plans/${created.body.series_id}/comments`)
      .send({ body: 'Over limit' });
    expect(res.status).toBe(429);
  });
});
