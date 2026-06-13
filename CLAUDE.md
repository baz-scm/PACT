# PACT — codebase guide for AI agents

## Repo layout

```
packages/server/   Express API, SQLite storage, MCP endpoint
packages/client/   React + Vite viewer SPA
packages/hooks/    Claude Code + Cursor hook scripts (no server dep)
tasks.yaml         Canonical task list with checkpoint milestones
```

## Key invariants

- **Free tier = single version row per series.** `plan_versions` has exactly one row per `series_id`. `createPlan` with a new content hash overwrites the existing row; same hash is a no-op.
- **`creator_token` is the only auth primitive in free tier.** It's returned once on plan creation, stored in the hook's state file and in the browser's `localStorage`. Guard all mutating operations with it.
- **`IStorage` must stay backend-agnostic.** The paid layer swaps in a Postgres implementation. Never leak SQLite specifics outside `packages/server/src/storage/sqlite.ts`.
- **Hooks must not block plan submission.** All CC hooks exit 0. The gate hook times out gracefully.

## Testing approach

- **Vitest** everywhere. No Jest.
- **No DB mocks.** Server tests use `node:sqlite` with `:memory:` path. Paid layer tests use a real Postgres test DB.
- **supertest** for API integration tests — hit the Express app directly, no network.
- TDD order: write failing test → implement → green.

## Commands

```bash
pnpm dev                              # start server + client (Vite on :5173, API on :3000)
pnpm -F @baz-scm/pact-core dev        # server only
pnpm -F @baz-scm/pact-client dev      # client only
pnpm test                             # run all tests across all packages
pnpm -F @baz-scm/pact-core test       # server tests only
pnpm -F @baz-scm/pact-core test:watch # server tests in watch mode
pnpm typecheck              # typecheck all packages
pnpm build                  # production build all packages
pnpm check                  # typecheck + lint + test (same as CI)
```

## Extension seams (paid layer hooks in)

| Seam | Free (OSS) | Paid |
|------|-----------|------|
| `IStorage` | `SqliteStorage` | `PostgresStorage` + version history + audit |
| Auth | `creator_token` (anonymous) | Descope + orgs |
| Comments | Anonymous single-thread | Multi-user attributed |
| Capability flags | `PACT_TIER=free` | `PACT_TIER=paid` |

The paid service imports `@baz-scm/pact-core` and passes its own `IStorage` implementation to `createApp`.
