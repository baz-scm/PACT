import { describe, it, expect } from 'vitest';
import request from 'supertest';
import { createApp } from '../src/app';
import { SqliteStorage } from '../src/storage/sqlite';

describe('Expiry sweep', () => {
  it('plan is gone after expirePlans() called with past expires_at', async () => {
    const storage = new SqliteStorage(':memory:');
    const app = createApp(storage);

    const created = await request(app).post('/api/plans').send({
      series_key: 'k',
      content: '# x',
      author_kind: 'agent',
      source_tool: 'claude-code',
    });

    storage._setExpiresAt(created.body.series_id, new Date(Date.now() - 3600 * 1000));

    const deleted = storage.expirePlans();
    expect(deleted).toBe(1);

    const res = await request(app).get(`/api/plans/${created.body.series_id}`);
    expect(res.status).toBe(404);
  });
});
