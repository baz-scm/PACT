#!/usr/bin/env node
import { loadConfig, redactContent, getCCSeriesKey, writeState } from './config';

export { readState } from './config';

interface PermissionRequestEnvelope {
  tool_name: string;
  tool_input: {
    plan?: string;
  };
}

interface PlanResponse {
  series_id: string;
  creator_token: string;
  share_token: string;
}

function allow(): void {
  process.stdout.write(JSON.stringify({
    hookSpecificOutput: {
      hookEventName: 'PermissionRequest',
      decision: { behavior: 'allow' },
    },
  }));
}

export async function runCapture(
  input: string,
  env: Record<string, string | undefined>,
  cwd?: string,
  homeDir?: string
): Promise<void> {
  let envelope: PermissionRequestEnvelope;
  try {
    envelope = JSON.parse(input) as PermissionRequestEnvelope;
  } catch {
    return;
  }

  if (envelope.tool_name !== 'ExitPlanMode') return;

  const plan = envelope.tool_input?.plan ?? '';
  if (!plan.trim()) return;

  const config = loadConfig(cwd, homeDir);
  if (!config.enabled) { allow(); return; }

  const redacted = redactContent(plan, config.redact);
  const series_key = getCCSeriesKey(env);

  try {
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

    if (response.ok) {
      const data = (await response.json()) as PlanResponse;
      const share_url = `${config.server}/p/${data.share_token}`;
      writeState(series_key, {
        series_id: data.series_id,
        creator_token: data.creator_token,
        share_url,
      }, homeDir);
      process.stderr.write(`\nPlan captured: ${share_url}#token=${data.creator_token}\n`);
    } else {
      process.stderr.write(`[PACT] Failed to capture plan: ${response.status}\n`);
    }
  } catch (e) {
    process.stderr.write(`[PACT] Error: ${e}\n`);
  }

  allow();
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
  main().catch(() => { allow(); process.exit(0); });
}
