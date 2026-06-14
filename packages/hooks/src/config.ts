#!/usr/bin/env node
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import * as crypto from 'crypto';

export interface PactConfig {
  enabled: boolean;
  server: string;
  redact: string[];
  nudge: boolean;
  gate_timeout_seconds: number;
}

export const defaultConfig: PactConfig = {
  enabled: true,
  server: 'http://localhost:3000',
  redact: [],
  nudge: true,
  gate_timeout_seconds: 86400,
};

export function loadConfig(cwd?: string, homeDir?: string): PactConfig {
  const dir = cwd ?? process.cwd();
  const home = homeDir ?? os.homedir();
  let config: PactConfig = { ...defaultConfig };

  const globalPath = path.join(home, '.pact', 'config.json');
  if (fs.existsSync(globalPath)) {
    try {
      const parsed = JSON.parse(fs.readFileSync(globalPath, 'utf8')) as Partial<PactConfig>;
      config = { ...config, ...parsed };
    } catch {
      // ignore parse errors
    }
  }

  // Per-repo: .pact.json in cwd
  const localPath = path.join(dir, '.pact.json');
  if (fs.existsSync(localPath)) {
    try {
      const parsed = JSON.parse(fs.readFileSync(localPath, 'utf8')) as Partial<PactConfig>;
      config = { ...config, ...parsed };
    } catch {
      // ignore parse errors
    }
  }

  return config;
}

export function redactContent(content: string, patterns: string[]): string {
  let result = content;
  for (const pattern of patterns) {
    const regex = new RegExp(pattern, 'g');
    result = result.replace(regex, '[REDACTED]');
  }
  return result;
}

export function getCCSeriesKey(env: Record<string, string | undefined>): string {
  const sessionId = env['CLAUDE_SESSION_ID'] ?? '';
  const pwd = env['PWD'] ?? '';
  const branch = env['GIT_BRANCH'] ?? '';
  return `${sessionId}:${pwd}:${branch}`;
}

function stateFilePath(series_key: string, homeDir?: string): string {
  const hash = crypto.createHash('sha256').update(series_key).digest('hex');
  return path.join(homeDir ?? os.homedir(), '.pact', 'state', `${hash}.json`);
}

export interface PactState {
  series_id: string;
  series_key: string;
  creator_token: string;
  share_url: string;
}

export function planSimilarity(a: string, b: string): number {
  const words = (s: string) => new Set(s.toLowerCase().split(/\W+/).filter(w => w.length > 3));
  const wa = words(a);
  const wb = words(b);
  let intersection = 0;
  for (const w of wa) if (wb.has(w)) intersection++;
  const union = new Set([...wa, ...wb]).size;
  return union === 0 ? 1 : intersection / union;
}

export const SIMILARITY_THRESHOLD = 0.3;

export function readState(series_key: string, homeDir?: string): PactState | null {
  const filePath = stateFilePath(series_key, homeDir);
  if (!fs.existsSync(filePath)) return null;
  try {
    return JSON.parse(fs.readFileSync(filePath, 'utf8')) as PactState;
  } catch {
    return null;
  }
}

export function writeState(series_key: string, state: PactState, homeDir?: string): void {
  const filePath = stateFilePath(series_key, homeDir);
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, JSON.stringify(state, null, 2), 'utf8');
}
