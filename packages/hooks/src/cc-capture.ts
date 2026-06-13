#!/usr/bin/env node
import * as fs from 'fs';
import { loadConfig, redactContent, getCCSeriesKey, writeState } from './config';

export { readState } from './config';

interface ToolUseEnvelope {
  tool_name: string;
  tool_input: {
    file_path?: string;
  };
}

interface PlanResponse {
  series_id: string;
  creator_token: string;
  share_token: string;
}

function isPlanFile(filePath: string, homeDir: string): boolean {
  const home = homeDir.replace(/\/$/, '');
  return /[/\\]\.claude(?:-[^/\\]*)?[/\\]plans[/\\][^/\\]+\.md$/.test(filePath) &&
    filePath.startsWith(home);
}

export async function runCapture(
  input: string,
  env: Record<string, string | undefined>,
  cwd?: string,
  homeDir?: string
): Promise<void> {
  const home = homeDir ?? process.env.HOME ?? '';

  let envelope: ToolUseEnvelope;
  try {
    envelope = JSON.parse(input) as ToolUseEnvelope;
  } catch {
    return;
  }

  if (envelope.tool_name !== 'Write' && envelope.tool_name !== 'Edit') return;

  const filePath = envelope.tool_input?.file_path;
  if (!filePath || !isPlanFile(filePath, home)) return;

  const config = loadConfig(cwd, home);
  if (!config.enabled) return;

  let content: string;
  try {
    content = fs.readFileSync(filePath, 'utf8');
  } catch {
    return;
  }

  const redacted = redactContent(content, config.redact);
  const series_key = getCCSeriesKey(env);

  const response = await fetch(`${config.server}/api/plans`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      series_key,
      content: redacted,
      author_kind: 'agent',
      source_tool: 'claude-code',
    }),
  });

  if (!response.ok) {
    process.stderr.write(`[PACT] Failed to capture plan: ${response.status}\n`);
    return;
  }

  const data = (await response.json()) as PlanResponse;
  const share_url = `${config.server}/p/${data.share_token}`;

  writeState(series_key, {
    series_id: data.series_id,
    creator_token: data.creator_token,
    share_url,
  }, homeDir);

  process.stderr.write(`\nPlan captured: ${share_url}#token=${data.creator_token}\n`);
}

if (require.main === module) {
  async function main() {
    const input = await new Promise<string>((resolve) => {
      let data = '';
      process.stdin.setEncoding('utf8');
      process.stdin.on('data', (chunk: string) => { data += chunk; });
      process.stdin.on('end', () => resolve(data));
    });
    await runCapture(input, process.env as Record<string, string | undefined>, process.cwd());
    process.exit(0);
  }
  main().catch(() => process.exit(0));
}
