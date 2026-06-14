import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { runCapture } from '../src/cc-capture';
import { readState, writeState } from '../src/config';

const PLAN_CONTENT = '# My plan\n\nStep 1: do the thing\nStep 2: finish the thing\nStep 3: ship it';
const DIFFERENT_PLAN = '# Refactor auth system\n\nPhase 1: remove legacy middleware\nPhase 2: add new token handling\nPhase 3: migrate sessions';

function exitPlanModeEnvelope(plan: string) {
  return JSON.stringify({ tool_name: 'ExitPlanMode', tool_input: { plan } });
}

function mockPostResponse(overrides = {}) {
  return {
    ok: true,
    json: async () => ({ series_id: 'plan-1', creator_token: 'tok-1', share_token: 'share-abc', ...overrides }),
  };
}

describe('cc-capture', () => {
  let tmpDir: string;
  let mockFetch: ReturnType<typeof vi.fn>;

  const env = { CLAUDE_SESSION_ID: 'sess1', PWD: '/project', GIT_BRANCH: 'main' };

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'pact-capture-test-'));
    mockFetch = vi.fn().mockResolvedValue(mockPostResponse());
    vi.stubGlobal('fetch', mockFetch);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it('captures plan from ExitPlanMode envelope', async () => {
    await runCapture(exitPlanModeEnvelope(PLAN_CONTENT), env, tmpDir, tmpDir);

    expect(mockFetch).toHaveBeenCalledOnce();
    const [url, opts] = mockFetch.mock.calls[0] as [string, RequestInit];
    expect(url).toBe('http://localhost:3000/api/plans');
    const body = JSON.parse(opts.body as string);
    expect(body.content).toBe(PLAN_CONTENT);
    expect(body.author_kind).toBe('agent');
    expect(body.source_tool).toBe('claude-code');
    expect(body.series_key).toBe('sess1:/project:main');
  });

  it('ignores non-ExitPlanMode tools', async () => {
    const envelope = JSON.stringify({ tool_name: 'Bash', tool_input: {} });
    await runCapture(envelope, env, tmpDir, tmpDir);
    expect(mockFetch).not.toHaveBeenCalled();
  });

  it('ignores empty plan', async () => {
    await runCapture(exitPlanModeEnvelope('   '), env, tmpDir, tmpDir);
    expect(mockFetch).not.toHaveBeenCalled();
  });

  it('does nothing when config.enabled is false', async () => {
    fs.writeFileSync(path.join(tmpDir, '.pact.json'), JSON.stringify({ enabled: false }));
    await runCapture(exitPlanModeEnvelope(PLAN_CONTENT), env, tmpDir, tmpDir);
    expect(mockFetch).not.toHaveBeenCalled();
  });

  it('writes state file after successful capture', async () => {
    await runCapture(exitPlanModeEnvelope(PLAN_CONTENT), env, tmpDir, tmpDir);

    const state = readState('sess1:/project:main', tmpDir);
    expect(state).not.toBeNull();
    expect(state?.series_id).toBe('plan-1');
    expect(state?.creator_token).toBe('tok-1');
    expect(state?.share_url).toBe('http://localhost:3000/viewer/share-abc');
  });

  it('sends series_key when plan is similar to previous', async () => {
    writeState('sess1:/project:main', { series_id: 'old-series', series_key: 'stored-series-key', creator_token: 'tok-old', share_url: 'http://localhost:3000/viewer/old' }, tmpDir);

    const similarPlan = PLAN_CONTENT + '\nStep 4: monitor results';
    mockFetch
      .mockResolvedValueOnce({ ok: true, json: async () => ({ content: PLAN_CONTENT }) })
      .mockResolvedValueOnce(mockPostResponse());

    await runCapture(exitPlanModeEnvelope(similarPlan), env, tmpDir, tmpDir);

    expect(mockFetch).toHaveBeenCalledTimes(2);
    const postCall = mockFetch.mock.calls[1] as [string, RequestInit];
    const body = JSON.parse(postCall[1].body as string);
    expect(body.series_key).toBe('stored-series-key');
  });

  it('uses env-derived key when no stored series_key (first plan in session)', async () => {
    mockFetch.mockResolvedValueOnce(mockPostResponse());
    await runCapture(exitPlanModeEnvelope(PLAN_CONTENT), env, tmpDir, tmpDir);
    const body = JSON.parse((mockFetch.mock.calls[0] as [string, RequestInit])[1].body as string);
    expect(body.series_key).toBe('sess1:/project:main');
  });

  it('sends fresh uuid series_key when plan is dramatically different', async () => {
    writeState('sess1:/project:main', { series_id: 'old-series', series_key: 'stored-series-key', creator_token: 'tok-old', share_url: 'http://localhost:3000/viewer/old' }, tmpDir);

    mockFetch
      .mockResolvedValueOnce({ ok: true, json: async () => ({ content: PLAN_CONTENT }) })
      .mockResolvedValueOnce(mockPostResponse({ series_id: 'new-series', share_token: 'share-new' }));

    await runCapture(exitPlanModeEnvelope(DIFFERENT_PLAN), env, tmpDir, tmpDir);

    expect(mockFetch).toHaveBeenCalledTimes(2);
    const postCall = mockFetch.mock.calls[1] as [string, RequestInit];
    const body = JSON.parse(postCall[1].body as string);
    expect(body.series_key).toMatch(/^[0-9a-f-]{36}$/); // fresh uuid, not stored key
    expect(body.series_key).not.toBe('stored-series-key');
  });

  it('stores new series_key in state after split', async () => {
    writeState('sess1:/project:main', { series_id: 'old-series', series_key: 'stored-series-key', creator_token: 'tok-old', share_url: 'http://localhost:3000/viewer/old' }, tmpDir);

    mockFetch
      .mockResolvedValueOnce({ ok: true, json: async () => ({ content: PLAN_CONTENT }) })
      .mockResolvedValueOnce(mockPostResponse({ series_id: 'new-series', share_token: 'share-new' }));

    await runCapture(exitPlanModeEnvelope(DIFFERENT_PLAN), env, tmpDir, tmpDir);

    const state = readState('sess1:/project:main', tmpDir);
    expect(state?.series_id).toBe('new-series');
    expect(state?.series_key).toMatch(/^[0-9a-f-]{36}$/);
    expect(state?.series_key).not.toBe('stored-series-key');
  });

  it('sends series_key when server fetch fails (safe fallback)', async () => {
    writeState('sess1:/project:main', { series_id: 'old-series', series_key: 'stored-series-key', creator_token: 'tok-old', share_url: 'http://localhost:3000/viewer/old' }, tmpDir);

    mockFetch
      .mockResolvedValueOnce({ ok: false })
      .mockResolvedValueOnce(mockPostResponse());

    await runCapture(exitPlanModeEnvelope(DIFFERENT_PLAN), env, tmpDir, tmpDir);

    const postCall = mockFetch.mock.calls[1] as [string, RequestInit];
    const body = JSON.parse(postCall[1].body as string);
    expect(body.series_key).toBe('stored-series-key');
  });
});
