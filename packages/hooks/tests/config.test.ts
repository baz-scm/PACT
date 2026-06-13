import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { loadConfig, defaultConfig, redactContent, getCCSeriesKey, readState, writeState } from '../src/config';

describe('config', () => {
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'pact-test-'));
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it('uses defaults when no config files exist', () => {
    const config = loadConfig('/nonexistent', tmpDir);
    expect(config).toEqual(defaultConfig);
  });

  it('global config overrides defaults', () => {
    const globalDir = path.join(tmpDir, '.pact');
    fs.mkdirSync(globalDir, { recursive: true });
    fs.writeFileSync(path.join(globalDir, 'config.json'), JSON.stringify({ nudge: false }));
    const config = loadConfig('/nonexistent', tmpDir);
    expect(config.nudge).toBe(false);
    expect(config.enabled).toBe(true);
  });

  it('per-repo config overrides global config field by field', () => {
    const globalDir = path.join(tmpDir, '.pact');
    fs.mkdirSync(globalDir, { recursive: true });
    fs.writeFileSync(path.join(globalDir, 'config.json'), JSON.stringify({ nudge: false, server: 'http://global:3000' }));

    const repoDir = path.join(tmpDir, 'myrepo');
    fs.mkdirSync(repoDir, { recursive: true });
    fs.writeFileSync(path.join(repoDir, '.pact.json'), JSON.stringify({ server: 'http://repo:4000' }));

    const config = loadConfig(repoDir, tmpDir);
    expect(config.server).toBe('http://repo:4000');
    expect(config.nudge).toBe(false);
    expect(config.enabled).toBe(true);
  });

  it('redactContent replaces pattern matches with [REDACTED]', () => {
    const result = redactContent('my secret password is hunter2', ['hunter2', 'secret']);
    expect(result).toBe('my [REDACTED] password is [REDACTED]');
  });

  it('redactContent handles empty patterns', () => {
    const result = redactContent('unchanged content', []);
    expect(result).toBe('unchanged content');
  });

  it('getCCSeriesKey derives key from env vars', () => {
    const key = getCCSeriesKey({ CLAUDE_SESSION_ID: 'sess1', PWD: '/home/user/project', GIT_BRANCH: 'main' });
    expect(key).toBe('sess1:/home/user/project:main');
  });

  it('getCCSeriesKey falls back to empty strings', () => {
    const key = getCCSeriesKey({});
    expect(key).toBe('::');
  });

  it('readState returns null when state file missing', () => {
    const result = readState('nonexistent-key', tmpDir);
    expect(result).toBeNull();
  });

  it('writeState and readState round-trip', () => {
    const state = { series_id: 'plan-123', creator_token: 'tok-abc', share_url: 'http://localhost:3000/p/xyz' };
    writeState('my-series-key', state, tmpDir);
    const result = readState('my-series-key', tmpDir);
    expect(result).toEqual(state);
  });
});
