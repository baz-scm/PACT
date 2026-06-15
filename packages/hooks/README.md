# @baz-scm/pact-hooks

Claude Code hooks that capture plan-mode output to [PACT](https://github.com/baz-scm/PACT) for human review before execution.

## What the hooks do

| Hook | Event | Behaviour |
|------|-------|-----------|
| `cc-capture` | `PermissionRequest / ExitPlanMode` | Sends the plan to PACT, stores the share URL + creator token locally, prints the URL to your terminal |
| `cc-gate` | `PermissionRequest / ExitPlanMode` | Blocks plan execution until a human approves in the browser |
| `cc-nudge` | `UserPromptSubmit` | If your prompt is long and no plan has been captured yet for this session, suggests using `/plan` mode |

## Install

```bash
npm install -g @baz-scm/pact-hooks
pact-hooks install
```

Or with pnpm:

```bash
pnpm add -g @baz-scm/pact-hooks
pact-hooks install
```

Or one-liner:

```bash
curl -fsSL https://pact.baz.co/install.sh | sh
```

Restart Claude Code. That's it.

## Point at a hosted server

By default hooks talk to `http://localhost:3000`. To use a hosted instance:

```bash
mkdir -p ~/.pact
echo '{"server":"https://plan.baz.co"}' > ~/.pact/config.json
```

## Configuration

`~/.pact/config.json` — global, applies to all repos:

```json
{
  "server": "http://localhost:3000",
  "enabled": true,
  "nudge": true,
  "redact": [],
  "gate_timeout_seconds": 300
}
```

`.pact.json` at your repo root — per-repo overrides (git-committable):

```json
{
  "redact": ["ACME_API_KEY_\\w+"],
  "nudge": false
}
```

| Field | Default | Description |
|-------|---------|-------------|
| `server` | `http://localhost:3000` | PACT server URL |
| `enabled` | `true` | Set `false` to disable all hooks |
| `nudge` | `true` | Remind you to use plan mode on long prompts |
| `redact` | `[]` | Regex patterns — matched text replaced with `[REDACTED]` before upload |
| `gate_timeout_seconds` | `86400` | How long the gate hook waits for approval |

## Smart series detection

Each plan belongs to a *series* — a thread of related revisions for the same feature. When you exit plan mode, the hook compares the new plan against the previous one using word-level Jaccard similarity (the same heuristic git uses for rename detection).

- **Similar plan (≥ 30% word overlap)** → update the existing series. Reviewers see it as a revision of the same feature.
- **Dramatically different plan (< 30% overlap)** → create a fresh series. The old plan is preserved; the new one gets its own share URL.

This means you can work on multiple features in the same session or on the same branch without them clobbering each other.

## Disable for a repo

// .pact.json
```json
{ "enabled": false }
```

## Self-host

Run the PACT server locally:

```bash
docker run -p 3000:3000 -v ./data:/data ghcr.io/baz-scm/pact
```

Then set `server` in your config to `http://localhost:3000` (already the default).
