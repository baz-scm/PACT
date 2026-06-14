# Installing PACT

## As a user

Install the hooks package globally and register it with Claude Code:

```bash
npm install -g @baz-scm/pact-hooks
pact-hooks install
```

Restart Claude Code. Hooks are now active.

By default hooks point to `http://localhost:3000`. To use a remote server, create `~/.pact/config.json`:

```json
{ "server": "https://your-pact-server" }
```

To override per-repo, add `.pact.json` in the project root with the same fields.

To remove the hooks:

```bash
pact-hooks uninstall
```

---

## As a developer / contributor

**Prerequisites:** Node 20+, pnpm 9+

```bash
git clone https://github.com/baz-scm/pact.git
cd pact
pnpm install
pnpm dev          # server on :3000, client on :5173
```

Other commands:

```bash
pnpm test         # run all tests
pnpm typecheck    # typecheck all packages
pnpm check        # typecheck + lint + test (CI gate)
```

Point your local hooks at the dev server by adding `~/.pact/config.json`:

```json
{ "server": "http://localhost:3000" }
```

Then install the hooks from source:

```bash
pnpm -F @baz-scm/pact-hooks build
node packages/hooks/dist/install.js install
```
