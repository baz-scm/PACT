#!/usr/bin/env node
import { loadConfig, getCCSeriesKey, readState } from './config';
import { pollUntilApproved } from './gate-core';

interface ExitPlanModeEnvelope {
  tool_name: string;
  tool_input: { plan: string };
}

export async function runGate(
  input: string,
  env: Record<string, string | undefined>,
  cwd?: string,
  homeDir?: string,
  pollIntervalMs?: number,
  gateSecs?: number
): Promise<void> {
  let envelope: ExitPlanModeEnvelope;
  try {
    envelope = JSON.parse(input) as ExitPlanModeEnvelope;
  } catch {
    return;
  }

  if (envelope.tool_name !== 'ExitPlanMode') return;

  const series_key = getCCSeriesKey(env);
  const state = readState(series_key, homeDir);
  if (!state) return;

  const config = loadConfig(cwd, homeDir);
  if (gateSecs !== undefined) config.gate_timeout_seconds = gateSecs;

  const result = await pollUntilApproved(state.series_id, config, pollIntervalMs);

  const deny = (additionalContext: string) =>
    process.stdout.write(JSON.stringify({
      hookSpecificOutput: {
        hookEventName: 'PermissionRequest',
        decision: { behavior: 'deny' },
        additionalContext,
      },
    }));

  if (result.approved) {
    process.stdout.write(JSON.stringify({
      hookSpecificOutput: {
        hookEventName: 'PermissionRequest',
        decision: { behavior: 'allow' },
        additionalContext: `[PACT] Plan approved. Proceed with this reviewed plan:\n\n${result.content}`.slice(0, 10000),
      },
    }));
  } else if (result.reason === 'rejected') {
    const state2 = readState(series_key, homeDir);
    const url = state2?.share_url ?? config.server;
    deny(`[PACT] Plan rejected. Do not proceed. Review feedback at: ${url}\n\n${result.content}`);
  } else if (result.reason === 'timeout') {
    const state2 = readState(series_key, homeDir);
    const url = state2?.share_url ?? config.server;
    deny(`[PACT] Plan not approved — review timed out. Approve at: ${url}\n\n${result.content}`);
  }
}

if (require.main === module) {
  async function main() {
    const input = await new Promise<string>((resolve) => {
      let data = '';
      process.stdin.setEncoding('utf8');
      process.stdin.on('data', (chunk: string) => { data += chunk; });
      process.stdin.on('end', () => resolve(data));
    });
    await runGate(input, process.env as Record<string, string | undefined>, process.cwd());
    process.exit(0);
  }
  main().catch(() => process.exit(0));
}
