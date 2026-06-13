# PACT — Plan As ConTract

Capture, view, edit, and approve AI coding agent plans before they execute.

Plans from Claude Code and Cursor are automatically posted to PACT via editor hooks. Each plan gets a shareable URL with full markdown rendering (code highlighting, Mermaid diagrams, interactive checklists). Humans can edit the plan in the browser and click **Approve** — the agent waits, then continues with the reviewed version.

## Quick start (self-host)

```bash
docker run -p 3000:3000 -v ./data:/data ghcr.io/baz-scm/pact
```

Then install the hooks:

```bash
npx @baz-scm/pact-hooks install --server http://localhost:3000
```

Open Claude Code, enter plan mode — your plan appears at `http://localhost:3000/p/<token>`.

## Development

```bash
pnpm install
pnpm dev          # start server on :3000
pnpm test         # run all tests
pnpm typecheck    # typecheck all packages
pnpm build        # production build
```

## Project structure

```
packages/
  server/   Node/TS Express API + SQLite storage
  client/   React + Vite viewer (served by server at /p/*)
  hooks/    Claude Code + Cursor hook scripts
```

## License

AGPL-3.0. See [LICENSE](LICENSE).
