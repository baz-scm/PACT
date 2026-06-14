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

  it('writes approved plan to stdout', async () => {
    writeState('sess1:/project:main', { series_id: 'p1', series_key: 'sess1:/project:main', creator_token: 'tok', share_url: 'http://x' }, tmpDir);
    mockFetch.mockResolvedValue({ ok: true, json: async () => ({ approved: true, content: '# Approved' }) });
    await runGate(envelope, env, tmpDir, tmpDir, 50);
    const written = (stdoutSpy.mock.calls.map((c) => c[0]) as string[]).join('');
    const parsed = JSON.parse(written) as { hookSpecificOutput: { additionalContext: string } };
    expect(parsed.hookSpecificOutput.additionalContext).toContain('# Approved');
  });

  it('writes to stderr and no stdout on timeout', async () => {
    writeState('sess1:/project:main', { series_id: 'p1', series_key: 'sess1:/project:main', creator_token: 'tok', share_url: 'http://x' }, tmpDir);
    mockFetch.mockResolvedValue({ ok: true, json: async () => ({ approved: false, content: '' }) });
    const stderrSpy = vi.spyOn(process.stderr, 'write').mockImplementation(() => true);
    await runGate(envelope, env, tmpDir, tmpDir, 30, 0.05);
    expect(stdoutSpy).not.toHaveBeenCalled();
    expect(stderrSpy.mock.calls.map((c) => c[0]).join('')).toContain('timed out');
    stderrSpy.mockRestore();
  });
});
