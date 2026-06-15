#!/usr/bin/env node
import crypto from 'crypto';
import { loadConfig, redactContent, getCCSeriesKey, writeState, readState, planSimilarity, SIMILARITY_THRESHOLD } from './config';
import { pollUntilApproved } from './gate-core';

interface ExitPlanModeEnvelope {
  tool_name: string;
  tool_input: { plan?: string };
  model?: string;
}

interface PostResponse {
  series_id: string;
  share_token: string;
}

export async function runHook(
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

  const plan = envelope.tool_input?.plan ?? '';
  if (!plan.trim()) return;

  const model_id = envelope.model ?? env.CLAUDE_MODEL ?? env.ANTHROPIC_MODEL ?? undefined;

  const config = loadConfig(cwd, homeDir);
  if (gateSecs !== undefined) config.gate_timeout_seconds = gateSecs;
  if (!config.enabled) return;

  const redacted = redactContent(plan, config.redact);
  const series_key = getCCSeriesKey(env);
  const existingState = readState(series_key, homeDir);

  let lastContent: string | null = null;
  let isSameFeature = true;

  if (existingState) {
    try {
      const res = await fetch(`${config.server}/api/plans/${existingState.series_id}`);
      if (res.ok) {
        const data = await res.json() as { content?: string };
        lastContent = data.content ?? null;
      }
    } catch {
      // server unreachable — treat as same feature
    }
    if (lastContent !== null) {
      isSameFeature = planSimilarity(redacted, lastContent) >= SIMILARITY_THRESHOLD;
    }
  }

  const postKey = isSameFeature
    ? (existingState?.series_key ?? series_key)
    : crypto.randomUUID();

  let series_id: string;
  let share_url: string;

  try {
    const response = await fetch(`${config.server}/api/plans`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        series_key: postKey,
        content: redacted,
        author_kind: 'agent',
        source_tool: 'claude-code',
        ...(model_id ? { model_id } : {}),
      }),
    });

    if (!response.ok) {
      process.stderr.write(`[PACT] Failed to submit plan: ${response.status}\n`);
      return;
    }

    const data = await response.json() as PostResponse;
    series_id = data.series_id;
    share_url = `${config.server}/viewer/${data.share_token}`;
    writeState(series_key, { series_id, series_key: postKey, share_url }, homeDir);
  } catch (e) {
    process.stderr.write(`[PACT] Error submitting plan: ${e}\n`);
    return;
  }

  const logMsg = !existingState || !isSameFeature
    ? `[PACT] New plan: ${share_url}`
    : lastContent !== null && redacted === lastContent
      ? `[PACT] Re-reviewing unchanged plan: ${share_url}`
      : `[PACT] Updated plan: ${share_url}`;
  process.stderr.write(`\n${logMsg}\n`);

  const result = await pollUntilApproved(series_id, config, pollIntervalMs);

  const deny = (message: string) =>
    process.stdout.write(JSON.stringify({
      hookSpecificOutput: {
        hookEventName: 'PermissionRequest',
        decision: { behavior: 'deny', message },
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
  } else if (result.reason === 'building_consensus') {
    deny(`[PACT] Plan is building consensus. Do not proceed. Review feedback at: ${share_url}\n\n${result.content}`);
  } else if (result.reason === 'timeout') {
    deny(`[PACT] Plan not approved — review timed out. Approve at: ${share_url}\n\n${result.content}`);
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
    const env = process.env as Record<string, string | undefined>;
    const MAX_ATTEMPTS = 3;
    for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
      try {
        await runHook(input, env, process.cwd());
        process.exit(0);
      } catch (e) {
        process.stderr.write(`[PACT] Attempt ${attempt}/${MAX_ATTEMPTS} failed: ${e}\n`);
        if (attempt < MAX_ATTEMPTS) await new Promise((r) => setTimeout(r, 1000 * attempt));
      }
    }
    process.exit(0);
  }
  main().catch(() => process.exit(0));
}
