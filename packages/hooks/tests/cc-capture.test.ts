import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { runCapture } from '../src/cc-capture';
import { readState } from '../src/config';

describe('cc-capture', () => {
  let tmpDir: string;
  let planDir: string;
  let mockFetch: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'pact-capture-test-'));
    planDir = path.join(tmpDir, '.claude', 'plans');
    fs.mkdirSync(planDir, { recursive: true });
    mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ series_id: 'plan-1', creator_token: 'tok-1', share_token: 'share-abc' }),
    });
    vi.stubGlobal('fetch', mockFetch);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  const env = { CLAUDE_SESSION_ID: 'sess1', PWD: '/project', GIT_BRANCH: 'main' };

  function planEnvelope(fileName = 'my-plan.md') {
    const filePath = path.join(tmpDir, '.claude', 'plans', fileName);
    fs.writeFileSync(filePath, '# My plan content', 'utf8');
    return { envelope: JSON.stringify({ tool_name: 'Write', tool_input: { file_path: filePath } }), filePath };
  }

  it('captures plan when Write targets a plan file', async () => {
    const { envelope } = planEnvelope();
    await runCapture(envelope, env, tmpDir, tmpDir);

    expect(mockFetch).toHaveBeenCalledOnce();
    const [url, opts] = mockFetch.mock.calls[0] as [string, RequestInit];
    expect(url).toBe('http://localhost:3000/api/plans');
    const body = JSON.parse(opts.body as string);
    expect(body.content).toBe('# My plan content');
    expect(body.author_kind).toBe('agent');
    expect(body.source_tool).toBe('claude-code');
  });

  it('captures plan when Edit targets a plan file', async () => {
    const filePath = path.join(tmpDir, '.claude', 'plans', 'edit-plan.md');
    fs.writeFileSync(filePath, '# Edited plan', 'utf8');
    const envelope = JSON.stringify({ tool_name: 'Edit', tool_input: { file_path: filePath } });
    await runCapture(envelope, env, tmpDir, tmpDir);
    expect(mockFetch).toHaveBeenCalledOnce();
  });

  it('writes state file after successful capture', async () => {
    const { envelope } = planEnvelope();
    await runCapture(envelope, env, tmpDir, tmpDir);

    const state = readState('sess1:/project:main', tmpDir);
    expect(state).not.toBeNull();
    expect(state?.series_id).toBe('plan-1');
    expect(state?.creator_token).toBe('tok-1');
    expect(state?.share_url).toBe('http://localhost:3000/p/share-abc');
  });

  it('ignores Write to non-plan file', async () => {
    const envelope = JSON.stringify({ tool_name: 'Write', tool_input: { file_path: '/tmp/somefile.ts' } });
    await runCapture(envelope, env, tmpDir, tmpDir);
    expect(mockFetch).not.toHaveBeenCalled();
  });

  it('ignores non-Write/Edit tool', async () => {
    const envelope = JSON.stringify({ tool_name: 'Bash', tool_input: {} });
    await runCapture(envelope, env, tmpDir, tmpDir);
    expect(mockFetch).not.toHaveBeenCalled();
  });

  it('does nothing when config.enabled is false', async () => {
    fs.writeFileSync(path.join(tmpDir, '.pact.json'), JSON.stringify({ enabled: false }));
    const { envelope } = planEnvelope();
    await runCapture(envelope, env, tmpDir, tmpDir);
    expect(mockFetch).not.toHaveBeenCalled();
  });
});
