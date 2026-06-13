import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { pollUntilApproved } from '../src/gate-core';
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

  it('returns approved content on first poll', async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => ({ approved: true, content: '# My plan' }),
    });
    const result = await pollUntilApproved('series-1', baseConfig, 50);
    expect(result).toEqual({ approved: true, content: '# My plan' });
    expect(mockFetch).toHaveBeenCalledOnce();
    expect(mockFetch.mock.calls[0][0]).toBe('http://localhost:3000/api/plans/series-1');
  });

  it('polls until approved on second call', async () => {
    mockFetch
      .mockResolvedValueOnce({ ok: true, json: async () => ({ approved: false, content: '' }) })
      .mockResolvedValueOnce({ ok: true, json: async () => ({ approved: true, content: '# Done' }) });
    const result = await pollUntilApproved('series-1', baseConfig, 50);
    expect(result).toEqual({ approved: true, content: '# Done' });
    expect(mockFetch).toHaveBeenCalledTimes(2);
  });

  it('returns timeout when deadline passes', async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => ({ approved: false, content: '' }),
    });
    const result = await pollUntilApproved(
      'series-1',
      { ...baseConfig, gate_timeout_seconds: 0.05 },
      30
    );
    expect(result).toEqual({ approved: false, reason: 'timeout' });
  });
});
