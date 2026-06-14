import type { PactConfig } from './config';

export type GateResult =
  | { approved: true; content: string }
  | { approved: false; reason: 'timeout' | 'disabled' };

interface PlanResponse {
  approved: boolean;
  content: string;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function pollUntilApproved(
  series_id: string,
  config: PactConfig,
  pollIntervalMs = 3000
): Promise<GateResult> {
  if (!config.enabled) return { approved: false, reason: 'disabled' };

  const deadline = Date.now() + config.gate_timeout_seconds * 1000;

  while (true) {
    try {
      const response = await fetch(`${config.server}/api/plans/${series_id}`);
      if (response.ok) {
        const data = (await response.json()) as PlanResponse;
        if (data.approved) return { approved: true, content: data.content };
      }
    } catch {
      // server unreachable — keep waiting
    }

    if (Date.now() >= deadline) return { approved: false, reason: 'timeout' };

    await sleep(pollIntervalMs);
  }
}
