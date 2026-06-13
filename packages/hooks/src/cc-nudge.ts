#!/usr/bin/env -S npx tsx
import { loadConfig, getCCSeriesKey, readState } from './config';

interface UserPromptEnvelope {
  prompt: string;
}

export function runNudge(
  input: string,
  env: Record<string, string | undefined>,
  cwd?: string,
  homeDir?: string
): string | null {
  let envelope: UserPromptEnvelope;
  try {
    envelope = JSON.parse(input) as UserPromptEnvelope;
  } catch {
    return null;
  }

  const config = loadConfig(cwd, homeDir);
  if (!config.nudge) return null;

  const prompt = envelope.prompt ?? '';
  if (prompt.length <= 200) return null;

  const series_key = getCCSeriesKey(env);
  const state = readState(series_key, homeDir);
  if (state) return null;

  return '[PACT] This looks like a complex task. Consider using /plan mode to capture a structured plan — it enables human review before execution.';
}

if (require.main === module) {
  async function main() {
    const input = await new Promise<string>((resolve) => {
      let data = '';
      process.stdin.setEncoding('utf8');
      process.stdin.on('data', (chunk: string) => { data += chunk; });
      process.stdin.on('end', () => resolve(data));
    });
    const message = runNudge(input, process.env as Record<string, string | undefined>, process.cwd());
    if (message) {
      process.stdout.write(message + '\n');
    }
    process.exit(0);
  }
  main().catch(() => process.exit(0));
}
