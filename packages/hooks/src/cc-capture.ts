#!/usr/bin/env node
import crypto from 'crypto';
import { loadConfig, redactContent, getCCSeriesKey, writeState, readState, planSimilarity, SIMILARITY_THRESHOLD } from './config';

async function fetchLastContent(server: string, series_id: string): Promise<string | null> {
  try {
    const res = await fetch(`${server}/api/plans/${series_id}`);
    if (!res.ok) return null;
    const data = await res.json() as { content?: string };
    return data.content ?? null;
  } catch {
    return null;
  }
}

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
  if (!config.enabled) return;

  const redacted = redactContent(plan, config.redact);
  const series_key = getCCSeriesKey(env);
  const existingState = readState(series_key, homeDir);

  let isSameFeature = true;
  if (existingState) {
    const lastContent = await fetchLastContent(config.server, existingState.series_id);
    if (lastContent) {
      isSameFeature = planSimilarity(redacted, lastContent) >= SIMILARITY_THRESHOLD;
    }
  }

  // Use the stored series_key for same-feature updates so we always target the correct
  // series even after a prior "new feature" split created a server-side random key.
  // For new features, generate a fresh key here so it can be stored and reused later.
  const postKey = isSameFeature
    ? (existingState?.series_key ?? series_key)
    : crypto.randomUUID();

  try {
    const response = await fetch(`${config.server}/api/plans`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        series_key: postKey,
        content: redacted,
        author_kind: 'agent',
        source_tool: 'claude-code',
      }),
    });

    if (response.ok) {
      const data = (await response.json()) as PlanResponse;
      const share_url = `${config.server}/viewer/${data.share_token}`;
      writeState(series_key, {
        series_id: data.series_id,
        series_key: postKey,
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
