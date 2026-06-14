import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { runGate } from '../src/cc-gate';
import { writeState } from '../src/config';

describe('cc-gate', () => {
  let tmpDir: string;
  let mockFetch: ReturnType<typeof vi.fn>;
  let stdoutSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'pact-gate-test-'));
    mockFetch = vi.fn();
    vi.stubGlobal('fetch', mockFetch);
    stdoutSpy = vi.spyOn(process.stdout, 'write').mockImplementation(() => true);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    stdoutSpy.mockRestore();
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  const envelope = JSON.stringify({ tool_name: 'ExitPlanMode', tool_input: { plan: 'plan' } });
  const env = { CLAUDE_SESSION_ID: 'sess1', PWD: '/project', GIT_BRANCH: 'main' };

  it('does nothing when no state file exists', async () => {
    await runGate(envelope, env, tmpDir, tmpDir);
    expect(mockFetch).not.toHaveBeenCalled();
    expect(stdoutSpy).not.toHaveBeenCalled();
  });

  it('ignores non-ExitPlanMode tool', async () => {
    writeState('sess1:/project:main', { series_id: 'p1', series_key: 'sess1:/project:main', creator_token: 'tok', share_url: 'http://x' }, tmpDir);
    await runGate(JSON.stringify({ tool_name: 'Bash', tool_input: {} }), env, tmpDir, tmpDir);
    expect(mockFetch).not.toHaveBeenCalled();
  });

  it('writes allow + context to stdout on approval', async () => {
    writeState('sess1:/project:main', { series_id: 'p1', series_key: 'sess1:/project:main', creator_token: 'tok', share_url: 'http://x' }, tmpDir);
    mockFetch
      .mockResolvedValueOnce({ ok: true, json: async () => ({ approved: true, rejected: false, content: '# Approved' }) })
      .mockResolvedValueOnce({ ok: true, json: async () => [] });
    await runGate(envelope, env, tmpDir, tmpDir, 50);
    const written = (stdoutSpy.mock.calls.map((c) => c[0]) as string[]).join('');
    const parsed = JSON.parse(written) as { hookSpecificOutput: { decision: { behavior: string }; additionalContext: string } };
    expect(parsed.hookSpecificOutput.decision.behavior).toBe('allow');
    expect(parsed.hookSpecificOutput.additionalContext).toContain('# Approved');
  });

  it('writes block with feedback on rejection', async () => {
    writeState('sess1:/project:main', { series_id: 'p1', series_key: 'sess1:/project:main', creator_token: 'tok', share_url: 'http://x' }, tmpDir);
    mockFetch
      .mockResolvedValueOnce({ ok: true, json: async () => ({ approved: false, rejected: true, content: '# Plan' }) })
      .mockResolvedValueOnce({ ok: true, json: async () => ([{ body: 'too risky', anchor: null, resolved: false }]) });
    await runGate(envelope, env, tmpDir, tmpDir, 50);
    const written = (stdoutSpy.mock.calls.map((c) => c[0]) as string[]).join('');
    const parsed = JSON.parse(written) as { hookSpecificOutput: { decision: { behavior: string }; additionalContext: string } };
    expect(parsed.hookSpecificOutput.decision.behavior).toBe('deny');
    expect(parsed.hookSpecificOutput.additionalContext).toContain('rejected');
    expect(parsed.hookSpecificOutput.additionalContext).toContain('too risky');
  });

  it('writes block with plan content on timeout', async () => {
    writeState('sess1:/project:main', { series_id: 'p1', series_key: 'sess1:/project:main', creator_token: 'tok', share_url: 'http://x' }, tmpDir);
    mockFetch.mockImplementation((url: string) =>
      Promise.resolve({
        ok: true,
        json: async () => url.endsWith('/comments') ? [] : { approved: false, rejected: false, content: '# The Plan' },
      })
    );
    await runGate(envelope, env, tmpDir, tmpDir, 30, 0.05);
    const written = (stdoutSpy.mock.calls.map((c) => c[0]) as string[]).join('');
    const parsed = JSON.parse(written) as { hookSpecificOutput: { decision: { behavior: string }; additionalContext: string } };
    expect(parsed.hookSpecificOutput.decision.behavior).toBe('deny');
    expect(parsed.hookSpecificOutput.additionalContext).toContain('not approved');
    expect(parsed.hookSpecificOutput.additionalContext).toContain('# The Plan');
  });
});
