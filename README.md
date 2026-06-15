# PACT — Plan As ConTract

Capture, view, edit, and approve AI coding agent plans before they execute.

Plans from Claude Code and Cursor are automatically posted to PACT via editor hooks. Each plan gets a shareable URL with full markdown rendering (code highlighting, Mermaid diagrams, interactive checklists). Humans can edit the plan in the browser and click **Approve** — the agent waits, then continues with the reviewed version.

## Quick start (self-host)

```bash
docker run -p 3000:3000 -v ./data:/data ghcr.io/baz-scm/pact
```

Then install the Claude Code plugin:

```bash
claude plugin marketplace add baz-scm/PACT
claude plugin install pact-hooks@baz
```

Open Claude Code, enter plan mode — your plan appears at `http://localhost:3000/p/<token>`.

## Configuration

By default the hooks point at `http://localhost:3000`. To point at a hosted instance (e.g. `https://plan.baz.co`):

```bash
mkdir -p ~/.pact
echo '{"server":"https://plan.baz.co"}' > ~/.pact/config.json
```

Full config options (`~/.pact/config.json`):

```json
{
  "server": "https://plan.baz.co",
  "enabled": true,
  "nudge": true,
  "redact": ["MY_SECRET_\\w+"],
  "gate_timeout_seconds": 300
}
```

| Field | Default | Description |
|---|---|---|
| `server` | `http://localhost:3000` | PACT server URL |
| `enabled` | `true` | Enable/disable plan capture |
| `nudge` | `true` | Show reminder when submitting long prompts without a plan |
| `redact` | `[]` | Regex patterns — matching text is replaced with `[REDACTED]` before upload |
| `gate_timeout_seconds` | `300` | How long the gate hook waits for approval |

Per-repo overrides go in `.pact.json` at the repo root (same fields, merged on top of `~/.pact/config.json`).

## Development

```bash
pnpm install
pnpm dev          # start server on :3000 + client on :5173
pnpm test         # run all tests
pnpm typecheck    # typecheck all packages
pnpm build        # production build
pnpm check        # typecheck + lint + test (CI)
```

## Project structure

```
packages/
  server/   Node/TS Express API + SQLite storage
  client/   React + Vite viewer (served by server at /p/*)
  hooks/    Claude Code + Cursor hook scripts
```

## Inspiration

PACT was inspired by [Plannotator](https://github.com/backnotprop/plannotator), a browser-based annotation and review tool for AI agent plans. Check it out.

## License

AGPL-3.0. See [LICENSE](LICENSE).
