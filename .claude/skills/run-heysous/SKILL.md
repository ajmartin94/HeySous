---
name: run-heysous
description: Launch, run, start, stop, smoke-test, or restart the HeySous dev server (Telegram bot + Mini App on port 3000), query the dev database, or set up the cloudflare tunnel for Mini App testing. Use for "run the app", "start the dev server", "reload/restart the server", "check the dev db", "get the tunnel working", or verifying a change against the live app.
---

# Run HeySous (dev)

HeySous is a single-process Node.js server: grammY Telegram bot (polling in dev, as **@heysous_dev_bot**) + Express serving the Mini App and its API on **port 3000**. All paths below are relative to the repo root. The agent path is the driver script; the bot's chat surface itself can only be driven by a human with Telegram.

## Prerequisites

Node >= 22 and `npm install` already done in this repo. `python3` (stdlib only) is used for DB queries. No other packages needed for the driver.

## Run (agent path) — the driver

```bash
bash .claude/skills/run-heysous/smoke.sh start    # launch if not running; waits for /health (up to 60s)
bash .claude/skills/run-heysous/smoke.sh smoke    # PASS/FAIL: /health, /app/ (200), DB table count
bash .claude/skills/run-heysous/smoke.sh status   # running? which pid holds port 3000
bash .claude/skills/run-heysous/smoke.sh stop     # kills tsx watch AND the orphan child on port 3000
bash .claude/skills/run-heysous/smoke.sh db "SELECT status, COUNT(*) n FROM feedback_checkins GROUP BY status"
```

Server log: `.temp/dev-server.log` (startup lines show the active model, menu-button URL, and polling mode). Watch it while a human exercises the bot — tool calls and errors appear here.

`db` runs read-only SQL against `data/heysous.db` via python3's stdlib sqlite3 (`mode=ro` URI). Use it to verify behavior end-to-end (e.g. a check-in row flipping to `responded` after a button press).

**Restart to pick up `.env` changes** (`stop` then `start`) — tsx watch reloads TypeScript but never `.env`.

## Direct invocation

Most PRs are verifiable without the live app: `npm test` (Vitest, in-memory DBs) and `npm run typecheck`. Use the live server for pipeline/bot behavior, reminder delivery, and anything involving the test clock.

## Run (human path)

`npm run dev` in a terminal (tsx watch, pino-pretty logs, Ctrl-C to stop — but see Gotchas about the port-3000 orphan). Then chat with **@heysous_dev_bot** on Telegram. The dev test clock is controllable in-chat via `/debug time` (used to fast-forward to reminder/check-in delivery).

## Mini App testing (needs the tunnel)

The Mini App must be served over HTTPS for Telegram, via a cloudflared quick tunnel. Verified flow:

```bash
# one-time install (WSL has no cloudflared by default)
mkdir -p ~/.local/bin && curl -sL -o ~/.local/bin/cloudflared \
  https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-linux-amd64 \
  && chmod +x ~/.local/bin/cloudflared

nohup ~/.local/bin/cloudflared tunnel --url http://localhost:3000 > .temp/tunnel.log 2>&1 &
sleep 10 && grep -o 'https://[a-z0-9-]*\.trycloudflare\.com' .temp/tunnel.log | head -1
```

Then set `MINI_APP_URL=<that-url>/app` in `.env` (e.g. `sed -i 's|^MINI_APP_URL=.*|MINI_APP_URL=https://<name>.trycloudflare.com/app|' .env`) and **restart the server** — it reconfigures the Telegram menu button from `MINI_APP_URL` at startup. Verify end-to-end: `curl -s <url>/health` returns `ok`.

## Gotchas

- **Killing tsx watch orphans a child that keeps port 3000.** `pkill -f "tsx watch"` (or Ctrl-C in some shells, or `timeout npx tsx ...`) kills the watcher but the actual server child survives and still answers `/health`. Find and kill it via `ss -tlnp | grep :3000`. The driver's `stop` does this for you — prefer it.
- **`.env` changes require a restart.** tsx watch only watches TS files. A changed model/tunnel URL silently doesn't apply until restart.
- **trycloudflare URLs are ephemeral.** Every tunnel start mints a new random URL; `.env` and the tunnel must be re-synced each time.
- **`/app` returns 301** (to `/app/`) — use `curl -L` or the trailing slash when checking it.
- **Repo's better-sqlite3 may be built for a different Node version** (`NODE_MODULE_VERSION` mismatch when scripts/tests load it). Fix: `npm rebuild better-sqlite3`. This is why the driver's `db` command uses python3 instead (also: no sqlite3 CLI in this WSL).
- **WSL on /mnt/c is slow.** First boot after a cold start and the full test suite's import phase take noticeably long; the driver waits up to 60s for health before declaring failure.
- **Two chats already exist in the dev DB** — startup logs show reminders regenerating for them; due reminders/check-ins may fire immediately on boot. That's real behavior, not a bug.
- **Don't `pkill -f "cloudflared tunnel"` in a compound command that also starts a new tunnel** — the `-f` pattern matches the invoking shell's own command line (it contains that string) and kills the shell before the new tunnel launches. Use `pkill -x cloudflared`, or kill and start in separate commands.

## Troubleshooting

- `curl /health` hangs or connection refused right after `start` → still booting; check `tail .temp/dev-server.log`. If the log stops after the dotenv line for >30s, the boot crashed silently — run `npx tsx src/main.ts` in the foreground to see the error.
- `start` says already running but behavior is stale → an orphaned pre-edit server is answering (see Gotchas); run `stop` then `start`.
- Telegram menu button opens a dead page → tunnel died or URL rotated; restart the tunnel, re-sync `MINI_APP_URL`, restart the server.
