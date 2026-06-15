import { describe, it, expect, beforeEach } from 'vitest';
import { SqliteStorage } from '../src/storage/sqlite';

function makeStorage() {
  return new SqliteStorage(':memory:');
}

const base = {
  series_key: 'session1::/repo:main',
  content: '# Plan\n\nDo the thing.',
  author_kind: 'agent' as const,
  source_tool: 'claude-code' as const,
};

describe('SqliteStorage', () => {
  let storage: SqliteStorage;

  beforeEach(() => {
    storage = makeStorage();
  });

  describe('createPlan', () => {
    it('creates series and version', () => {
      const result = storage.createPlan(base);
      expect(result.series.id).toBeTruthy();
      expect(result.series.series_key).toBe(base.series_key);
      expect(result.series.share_token).toBeTruthy();
      expect(result.series.status).toBe('pending');
      expect(result.version.content).toBe(base.content);
      expect(result.version.author_kind).toBe('agent');
      expect(result.deduped).toBe(false);
    });

    it('sets expires_at far in the future when ttl_hours is 0 (no TTL)', () => {
      const before = Date.now();
      const result = storage.createPlan(base);
      const exp = result.series.expires_at.getTime();
      expect(exp).toBeGreaterThan(before + 365 * 24 * 3600 * 1000);
    });

    it('deduplicates on same content hash', () => {
      const first = storage.createPlan(base);
      const second = storage.createPlan(base);
      expect(second.deduped).toBe(true);
      expect(second.version.id).toBe(first.version.id);
    });

    it('resets approved flag on dedup so gate always waits for fresh approval', () => {
      const { series } = storage.createPlan(base);
      storage.approvePlan(series.id);
      const second = storage.createPlan(base);
      expect(second.deduped).toBe(true);
      expect(second.series.status).toBe('pending');
    });

    it('overwrites version row on same series_key with different content', () => {
      const first = storage.createPlan(base);
      const second = storage.createPlan({ ...base, content: '# Updated plan' });
      expect(second.deduped).toBe(false);
      expect(second.series.id).toBe(first.series.id);
      expect(second.version.id).not.toBe(first.version.id);
      expect(second.version.content).toBe('# Updated plan');
    });

    it('creates separate series for different series_key', () => {
      const a = storage.createPlan(base);
      const b = storage.createPlan({ ...base, series_key: 'session2::/repo:main' });
      expect(a.series.id).not.toBe(b.series.id);
    });
  });

  describe('getLatestBySeriesKey', () => {
    it('returns null for unknown key', () => {
      expect(storage.getLatestBySeriesKey('nope')).toBeNull();
    });

    it('returns latest after creation', () => {
      storage.createPlan(base);
      const result = storage.getLatestBySeriesKey(base.series_key);
      expect(result).not.toBeNull();
      expect(result!.version.content).toBe(base.content);
    });
  });

  describe('getLatestBySeriesId', () => {
    it('returns null for unknown id', () => {
      expect(storage.getLatestBySeriesId('unknown-id')).toBeNull();
    });

    it('returns plan by series id', () => {
      const { series } = storage.createPlan(base);
      const result = storage.getLatestBySeriesId(series.id);
      expect(result!.series.id).toBe(series.id);
    });
  });

  describe('savePlan', () => {
    it('overwrites content in place', () => {
      const { series } = storage.createPlan(base);
      const saved = storage.savePlan(series.id, '# Edited');
      expect(saved).not.toBeNull();
      expect(saved!.version.content).toBe('# Edited');
      expect(saved!.version.author_kind).toBe('human');
    });

    it('deduplicates on same content', () => {
      const { series, version } = storage.createPlan(base);
      const saved = storage.savePlan(series.id, base.content);
      expect(saved!.deduped).toBe(true);
      expect(saved!.version.id).toBe(version.id);
    });
  });

  describe('approvePlan', () => {
    it('sets approved flag', () => {
      const { series } = storage.createPlan(base);
      expect(storage.approvePlan(series.id)).toBe(true);
      const result = storage.getLatestBySeriesId(series.id);
      expect(result!.series.status).toBe('approved');
    });
  });

  describe('delistPlan', () => {
    it('sets delisted flag, making series invisible', () => {
      const { series } = storage.createPlan(base);
      expect(storage.delistPlan(series.id)).toBe(true);
      expect(storage.getLatestBySeriesId(series.id)).toBeNull();
    });
  });

  describe('expirePlans', () => {
    it('deletes plans with expires_at in the past', () => {
      const { series } = storage.createPlan(base);
      storage._setExpiresAt(series.id, new Date(Date.now() - 3600 * 1000));

      const deleted = storage.expirePlans();
      expect(deleted).toBe(1);
      expect(storage.getLatestBySeriesId(series.id)).toBeNull();
    });

    it('leaves non-expired plans alone', () => {
      storage.createPlan(base);
      const deleted = storage.expirePlans();
      expect(deleted).toBe(0);
    });
  });

  describe('comments', () => {
    it('adds and retrieves comments', () => {
      const { series } = storage.createPlan(base);
      storage.addComment(series.id, 'Looks good', 'ip1');
      storage.addComment(series.id, 'Check step 3', 'ip2');
      const comments = storage.getComments(series.id);
      expect(comments).toHaveLength(2);
      expect(comments[0].body).toBe('Looks good');
    });

    it('deletes a comment', () => {
      const { series } = storage.createPlan(base);
      const comment = storage.addComment(series.id, 'Delete me', 'ip1');
      const ok = storage.deleteComment(comment.id, series.id);
      expect(ok).toBe(true);
      expect(storage.getComments(series.id)).toHaveLength(0);
    });

    it('cascades delete comments when plan is expired', () => {
      const { series } = storage.createPlan(base);
      storage.addComment(series.id, 'Will be gone', 'ip1');
      storage._setExpiresAt(series.id, new Date(Date.now() - 3600 * 1000));
      storage.expirePlans();
      expect(storage.getComments(series.id)).toHaveLength(0);
    });
  });
});
