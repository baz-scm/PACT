import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { pollUntilApproved, weaveComments } from '../src/gate-core';
import type { PactConfig } from '../src/config';

const baseConfig: PactConfig = {
  enabled: true,
  server: 'http://localhost:3000',
  redact: [],
  nudge: true,
  gate_timeout_seconds: 10,
};

describe('pollUntilApproved', () => {
  let mockFetch: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    mockFetch = vi.fn();
    vi.stubGlobal('fetch', mockFetch);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('returns disabled immediately when config.enabled is false', async () => {
    const result = await pollUntilApproved('series-1', { ...baseConfig, enabled: false }, 50);
    expect(result).toEqual({ approved: false, reason: 'disabled' });
    expect(mockFetch).not.toHaveBeenCalled();
  });

  const noComments = { ok: true, json: async () => [] };

  it('returns approved content on first poll (no comments)', async () => {
    mockFetch
      .mockResolvedValueOnce({ ok: true, json: async () => ({ approved: true, content: '# My plan' }) })
      .mockResolvedValueOnce(noComments);
    const result = await pollUntilApproved('series-1', baseConfig, 50);
    expect(result).toEqual({ approved: true, content: '# My plan' });
    expect(mockFetch.mock.calls[0][0]).toBe('http://localhost:3000/api/plans/series-1');
    expect(mockFetch.mock.calls[1][0]).toBe('http://localhost:3000/api/plans/series-1/comments');
  });

  it('polls until approved on second call', async () => {
    mockFetch
      .mockResolvedValueOnce({ ok: true, json: async () => ({ approved: false, content: '' }) })
      .mockResolvedValueOnce({ ok: true, json: async () => ({ approved: true, content: '# Done' }) })
      .mockResolvedValueOnce(noComments);
    const result = await pollUntilApproved('series-1', baseConfig, 50);
    expect(result).toEqual({ approved: true, content: '# Done' });
    expect(mockFetch).toHaveBeenCalledTimes(3);
  });

  it('continues polling when fetch throws (server unreachable)', async () => {
    mockFetch
      .mockRejectedValueOnce(new Error('ECONNREFUSED'))
      .mockResolvedValueOnce({ ok: true, json: async () => ({ approved: true, content: '# Plan' }) })
      .mockResolvedValueOnce(noComments);
    const result = await pollUntilApproved('series-1', baseConfig, 50);
    expect(result).toEqual({ approved: true, content: '# Plan' });
    expect(mockFetch).toHaveBeenCalledTimes(3);
  });

  it('weaves comments into approved content', async () => {
    mockFetch
      .mockResolvedValueOnce({ ok: true, json: async () => ({ approved: true, content: 'line1\nline2\nline3' }) })
      .mockResolvedValueOnce({ ok: true, json: async () => ([
        { body: 'check this', anchor: 'p-2', resolved: false },
      ]) });
    const result = await pollUntilApproved('series-1', baseConfig, 50);
    expect(result.approved).toBe(true);
    if (result.approved) {
      expect(result.content).toContain('line2');
      expect(result.content).toContain('[reviewer] check this');
    }
  });

  it('returns rejected with woven comments on rejection', async () => {
    mockFetch
      .mockResolvedValueOnce({ ok: true, json: async () => ({ approved: false, rejected: true, content: 'line1\nline2' }) })
      .mockResolvedValueOnce({ ok: true, json: async () => ([{ body: 'bad idea', anchor: 'p-1', resolved: false }]) });
    const result = await pollUntilApproved('series-1', baseConfig, 50);
    expect(result.approved).toBe(false);
    if (!result.approved && result.reason === 'rejected') {
      expect(result.content).toContain('line1');
      expect(result.content).toContain('[reviewer] bad idea');
    }
  });

  it('returns timeout with woven content when deadline passes', async () => {
    mockFetch.mockImplementation((url: string) =>
      Promise.resolve({
        ok: true,
        json: async () => url.endsWith('/comments') ? [] : { approved: false, rejected: false, content: 'plan content' },
      })
    );
    const result = await pollUntilApproved(
      'series-1',
      { ...baseConfig, gate_timeout_seconds: 0.05 },
      30
    );
    expect(result.approved).toBe(false);
    if (!result.approved && result.reason === 'timeout') {
      expect(result.content).toBe('plan content');
    }
  });
});

describe('weaveComments', () => {
  it('returns content unchanged when no comments', () => {
    expect(weaveComments('line1\nline2', [])).toBe('line1\nline2');
  });

  it('returns content unchanged when all comments resolved', () => {
    const comments = [{ body: 'ignore me', anchor: 'p-1', resolved: true }];
    expect(weaveComments('line1\nline2', comments)).toBe('line1\nline2');
  });

  it('inserts anchored comment after target line', () => {
    const comments = [{ body: 'check this', anchor: 'p-2', resolved: false }];
    const result = weaveComments('line1\nline2\nline3', comments);
    const lines = result.split('\n');
    expect(lines[0]).toBe('line1');
    expect(lines[1]).toBe('line2');
    expect(lines[2]).toBe('> [reviewer] check this');
    expect(lines[3]).toBe('line3');
  });

  it('range anchor attaches to end line', () => {
    const comments = [{ body: 'range comment', anchor: 'p-1..p-3', resolved: false }];
    const result = weaveComments('a\nb\nc\nd', comments);
    const lines = result.split('\n');
    expect(lines[2]).toBe('c');
    expect(lines[3]).toBe('> [reviewer] range comment');
    expect(lines[4]).toBe('d');
  });

  it('strips quote fragment from anchor', () => {
    const comments = [{ body: 'noted', anchor: 'p-1#some text', resolved: false }];
    const result = weaveComments('line1\nline2', comments);
    expect(result).toContain('> [reviewer] noted');
    expect(result.indexOf('> [reviewer] noted')).toBeGreaterThan(result.indexOf('line1'));
    expect(result.indexOf('> [reviewer] noted')).toBeLessThan(result.indexOf('line2'));
  });

  it('appends unanchored comments as general section', () => {
    const comments = [{ body: 'overall concern', anchor: null, resolved: false }];
    const result = weaveComments('line1\nline2', comments);
    expect(result).toContain('**General comments:**');
    expect(result).toContain('- overall concern');
    expect(result.indexOf('**General comments:**')).toBeGreaterThan(result.indexOf('line2'));
  });

  it('handles multiple anchored comments at same line', () => {
    const comments = [
      { body: 'first', anchor: 'p-1', resolved: false },
      { body: 'second', anchor: 'p-1', resolved: false },
    ];
    const result = weaveComments('only line', comments);
    expect(result).toContain('> [reviewer] first');
    expect(result).toContain('> [reviewer] second');
  });
});
