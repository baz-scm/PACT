import type { PactConfig } from './config';

export type GateResult =
  | { approved: true; content: string }
  | { approved: false; reason: 'disabled' }
  | { approved: false; reason: 'timeout' | 'rejected'; content: string };

interface PlanResponse {
  approved: boolean;
  rejected: boolean;
  content: string;
}

interface Comment {
  body: string;
  anchor: string | null;
  resolved: boolean;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function fetchComments(server: string, series_id: string): Promise<Comment[]> {
  try {
    const res = await fetch(`${server}/api/plans/${series_id}/comments`);
    if (!res.ok) return [];
    return (await res.json()) as Comment[];
  } catch {
    return [];
  }
}

export function weaveComments(content: string, comments: Comment[]): string {
  const open = comments.filter((c) => !c.resolved);
  if (open.length === 0) return content;

  // Build anchor → comments map (only anchored, unresolved)
  const byLine = new Map<number, Comment[]>();
  const unanchored: Comment[] = [];
  for (const c of open) {
    if (!c.anchor) { unanchored.push(c); continue; }
    const anchorPart = c.anchor.split('#')[0];
    // Range anchor p-5..p-13 → attach to end line
    const linePart = anchorPart.includes('..') ? anchorPart.split('..')[1] : anchorPart;
    const line = parseInt(linePart.slice(2));
    if (!isNaN(line)) {
      (byLine.get(line) ?? byLine.set(line, []).get(line)!).push(c);
    } else {
      unanchored.push(c);
    }
  }

  const lines = content.split('\n');
  const out: string[] = [];
  for (let i = 0; i < lines.length; i++) {
    out.push(lines[i]);
    const thread = byLine.get(i + 1); // anchors are 1-indexed source lines
    if (thread) {
      for (const c of thread) {
        out.push(`> [reviewer] ${c.body}`);
      }
    }
  }

  if (unanchored.length > 0) {
    out.push('', '---', '**General comments:**');
    for (const c of unanchored) {
      out.push(`- ${c.body}`);
    }
  }

  return out.join('\n');
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
        if (data.approved) {
          const comments = await fetchComments(config.server, series_id);
          const content = weaveComments(data.content, comments);
          return { approved: true, content };
        }
        if (data.rejected) {
          const comments = await fetchComments(config.server, series_id);
          const content = weaveComments(data.content, comments);
          return { approved: false, reason: 'rejected', content };
        }
      }
    } catch {
      // server unreachable — keep waiting
    }

    if (Date.now() >= deadline) {
      // fetch last known plan content + comments to include in block message
      let timedOutContent = '';
      try {
        const r = await fetch(`${config.server}/api/plans/${series_id}`);
        if (r.ok) {
          const d = (await r.json()) as PlanResponse;
          const comments = await fetchComments(config.server, series_id);
          timedOutContent = weaveComments(d.content, comments);
        }
      } catch { /* best effort */ }
      return { approved: false, reason: 'timeout', content: timedOutContent };
    }

    await sleep(pollIntervalMs);
  }
}
