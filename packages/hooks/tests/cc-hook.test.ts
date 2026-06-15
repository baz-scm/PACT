import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { runHook } from '../src/cc-hook';
import { readState, writeState } from '../src/config';

const PLAN = '# My plan\n\nStep 1: do the thing\nStep 2: finish the thing\nStep 3: ship it';
const DIFFERENT_PLAN = '# Refactor auth\n\nPhase 1: remove legacy middleware\nPhase 2: add new token handling\nPhase 3: migrate sessions';

function envelope(plan: string, toolName = 'ExitPlanMode') {
  return JSON.stringify({ tool_name: toolName, tool_input: { plan } });
}

function approvedResponse(content = PLAN) {
  return { ok: true, json: async () => ({ status: 'approved', content }) };
}

function postResponse(overrides = {}) {
  return { ok: true, json: async () => ({ series_id: 'p1', share_token: 'tok1', ...overrides }) };
}

describe('cc-hook', () => {
  let tmpDir: string;
  let mockFetch: ReturnType<typeof vi.fn>;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let stdoutSpy: any;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let stderrSpy: any;

  const env = { CLAUDE_SESSION_ID: 'sess1', PWD: '/project', GIT_BRANCH: 'main' };

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'pact-hook-test-'));
    mockFetch = vi.fn();
    vi.stubGlobal('fetch', mockFetch);
    stdoutSpy = vi.spyOn(process.stdout, 'write').mockImplementation(() => true);
    stderrSpy = vi.spyOn(process.stderr, 'write').mockImplementation(() => true);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    stdoutSpy.mockRestore();
    stderrSpy.mockRestore();
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it('ignores non-ExitPlanMode tool', async () => {
    await runHook(envelope(PLAN, 'Bash'), env, tmpDir, tmpDir);
    expect(mockFetch).not.toHaveBeenCalled();
    expect(stdoutSpy).not.toHaveBeenCalled();
  });

  it('ignores empty plan', async () => {
    await runHook(envelope('   '), env, tmpDir, tmpDir);
    expect(mockFetch).not.toHaveBeenCalled();
  });

  it('logs "New plan" and writes allow on approval', async () => {
    mockFetch
      .mockResolvedValueOnce(postResponse())
      .mockResolvedValueOnce(approvedResponse())
      .mockResolvedValueOnce({ ok: true, json: async () => [] });

    await runHook(envelope(PLAN), env, tmpDir, tmpDir, 50);

    const stderr = (stderrSpy.mock.calls.flat() as string[]).join('');
    expect(stderr).toContain('[PACT] New plan:');

    const stdout = (stdoutSpy.mock.calls.flat() as string[]).join('');
    const parsed = JSON.parse(stdout) as { hookSpecificOutput: { decision: { behavior: string } } };
    expect(parsed.hookSpecificOutput.decision.behavior).toBe('allow');
  });

  it('writes state file after successful submission', async () => {
    mockFetch
      .mockResolvedValueOnce(postResponse())
      .mockResolvedValueOnce(approvedResponse())
      .mockResolvedValueOnce({ ok: true, json: async () => [] });

    await runHook(envelope(PLAN), env, tmpDir, tmpDir, 50);

    const state = readState('sess1:/project:main', tmpDir);
    expect(state?.series_id).toBe('p1');
    expect(state?.share_url).toContain('tok1');
  });

  it('denies with woven comments on submit-review', async () => {
    mockFetch
      .mockResolvedValueOnce(postResponse())
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ status: 'building_consensus', content: '# Plan' }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => [{ body: 'too risky', anchor: null, resolved: false }],
      });

    await runHook(envelope(PLAN), env, tmpDir, tmpDir, 50);

    const stdout = (stdoutSpy.mock.calls.flat() as string[]).join('');
    const parsed = JSON.parse(stdout) as { hookSpecificOutput: { decision: { behavior: string; message: string } } };
    expect(parsed.hookSpecificOutput.decision.behavior).toBe('deny');
    expect(parsed.hookSpecificOutput.decision.message).toContain('building consensus');
    expect(parsed.hookSpecificOutput.decision.message).toContain('too risky');
  });

  it('denies on timeout', async () => {
    mockFetch
      .mockResolvedValueOnce(postResponse())
      .mockImplementation((url: string) =>
        Promise.resolve({
          ok: true,
          json: async () =>
            (url as string).endsWith('/comments')
              ? []
              : { status: 'pending', content: '# Plan' },
        })
      );

    await runHook(envelope(PLAN), env, tmpDir, tmpDir, 30, 0.05);

    const stdout = (stdoutSpy.mock.calls.flat() as string[]).join('');
    const parsed = JSON.parse(stdout) as { hookSpecificOutput: { decision: { behavior: string; message: string } } };
    expect(parsed.hookSpecificOutput.decision.behavior).toBe('deny');
    expect(parsed.hookSpecificOutput.decision.message).toContain('not approved');
  });

  it('uses stored series_key and logs "Updated plan" for similar content', async () => {
    writeState('sess1:/project:main', { series_id: 'old', series_key: 'stored-key', share_url: 'http://x' }, tmpDir);

    const similar = PLAN + '\nStep 4: monitor';
    mockFetch
      .mockResolvedValueOnce({ ok: true, json: async () => ({ content: PLAN }) }) // fetch last
      .mockResolvedValueOnce(postResponse())                                        // POST
      .mockResolvedValueOnce(approvedResponse(similar))                             // poll
      .mockResolvedValueOnce({ ok: true, json: async () => [] });                  // comments

    await runHook(envelope(similar), env, tmpDir, tmpDir, 50);

    const postCall = mockFetch.mock.calls[1] as [string, RequestInit];
    const body = JSON.parse(postCall[1].body as string);
    expect(body.series_key).toBe('stored-key');

    const stderr = (stderrSpy.mock.calls.flat() as string[]).join('');
    expect(stderr).toContain('[PACT] Updated plan:');
  });

  it('uses fresh UUID and logs "New plan" for dramatically different content', async () => {
    writeState('sess1:/project:main', { series_id: 'old', series_key: 'stored-key', share_url: 'http://x' }, tmpDir);

    mockFetch
      .mockResolvedValueOnce({ ok: true, json: async () => ({ content: PLAN }) })
      .mockResolvedValueOnce(postResponse({ series_id: 'p2', share_token: 'tok2' }))
      .mockResolvedValueOnce(approvedResponse())
      .mockResolvedValueOnce({ ok: true, json: async () => [] });

    await runHook(envelope(DIFFERENT_PLAN), env, tmpDir, tmpDir, 50);

    const postCall = mockFetch.mock.calls[1] as [string, RequestInit];
    const body = JSON.parse(postCall[1].body as string);
    expect(body.series_key).toMatch(/^[0-9a-f-]{36}$/);
    expect(body.series_key).not.toBe('stored-key');

    const stderr = (stderrSpy.mock.calls.flat() as string[]).join('');
    expect(stderr).toContain('[PACT] New plan:');
  });

  it('logs "Re-reviewing unchanged plan" when content is identical', async () => {
    writeState('sess1:/project:main', { series_id: 'old', series_key: 'stored-key', share_url: 'http://x' }, tmpDir);

    mockFetch
      .mockResolvedValueOnce({ ok: true, json: async () => ({ content: PLAN }) }) // fetch last (identical)
      .mockResolvedValueOnce(postResponse())
      .mockResolvedValueOnce(approvedResponse())
      .mockResolvedValueOnce({ ok: true, json: async () => [] });

    await runHook(envelope(PLAN), env, tmpDir, tmpDir, 50);

    const stderr = (stderrSpy.mock.calls.flat() as string[]).join('');
    expect(stderr).toContain('[PACT] Re-reviewing unchanged plan:');
  });
});
