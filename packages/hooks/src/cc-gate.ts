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

  if (result.approved) {
    process.stdout.write(JSON.stringify({
      hookSpecificOutput: {
        hookEventName: 'PostToolUse',
        additionalContext: `[PACT] Plan approved by reviewer. Proceed with this reviewed plan:\n\n${result.content}`,
      },
    }));
  } else if (result.reason === 'timeout') {
    process.stderr.write('[PACT] Review timed out, proceeding.\n');
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
