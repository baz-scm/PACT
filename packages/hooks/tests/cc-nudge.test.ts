import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { runNudge } from '../src/cc-nudge';
import { writeState } from '../src/config';

describe('cc-nudge', () => {
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'pact-nudge-test-'));
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it('returns null for short prompt', () => {
    const result = runNudge(JSON.stringify({ prompt: 'short' }), {}, tmpDir, tmpDir);
    expect(result).toBeNull();
  });

  it('returns null for exactly 200 chars', () => {
    const result = runNudge(JSON.stringify({ prompt: 'x'.repeat(200) }), {}, tmpDir, tmpDir);
    expect(result).toBeNull();
  });

  it('returns suggestion for long prompt with no state', () => {
    const result = runNudge(
      JSON.stringify({ prompt: 'x'.repeat(201) }),
      { CLAUDE_SESSION_ID: 'new', PWD: '/proj', GIT_BRANCH: 'main' },
      tmpDir,
      tmpDir
    );
    expect(result).toContain('[PACT]');
    expect(result).toContain('/plan mode');
  });

  it('returns null for long prompt when state exists', () => {
    writeState('existing:/proj:main', { series_id: 'p1', share_url: 'http://x' }, tmpDir);
    const result = runNudge(
      JSON.stringify({ prompt: 'x'.repeat(201) }),
      { CLAUDE_SESSION_ID: 'existing', PWD: '/proj', GIT_BRANCH: 'main' },
      tmpDir,
      tmpDir
    );
    expect(result).toBeNull();
  });

  it('returns null when nudge is disabled', () => {
    fs.writeFileSync(path.join(tmpDir, '.pact.json'), JSON.stringify({ nudge: false }));
    const result = runNudge(JSON.stringify({ prompt: 'x'.repeat(201) }), {}, tmpDir, tmpDir);
    expect(result).toBeNull();
  });
});
