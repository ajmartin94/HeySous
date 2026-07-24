#!/usr/bin/env bash
# Agent driver for launching and smoke-testing the HeySous dev server.
# Usage: bash .claude/skills/run-heysous/smoke.sh {start|smoke|stop|status|db "<SQL>"}
#
# The server is `tsx watch src/main.ts` (polling mode, test clock) on port 3000.
# Logs go to .temp/dev-server.log. See SKILL.md for gotchas — notably that
# killing tsx watch leaves an orphaned child holding port 3000, which `stop`
# handles via ss.

set -u
cd "$(dirname "$0")/../../.." || exit 1

LOG=.temp/dev-server.log
HEALTH_URL=http://localhost:3000/health

health() { curl -s -m 3 "$HEALTH_URL" 2>/dev/null; }

port_pids() {
  ss -tlnp 2>/dev/null | grep ':3000 ' | grep -o 'pid=[0-9]*' | cut -d= -f2 | sort -u
}

case "${1:-}" in
  start)
    if [ "$(health)" = "ok" ]; then
      echo "already running (health ok)"
      exit 0
    fi
    mkdir -p .temp
    nohup npm run dev >> "$LOG" 2>&1 &
    echo "launching (log: $LOG) ..."
    for _ in $(seq 1 30); do
      sleep 2
      if [ "$(health)" = "ok" ]; then
        grep -E "model|menu button|polling mode" "$LOG" | tail -3
        echo "UP: health ok"
        exit 0
      fi
    done
    echo "FAIL: no health response after 60s. Last log lines:"
    tail -15 "$LOG"
    exit 1
    ;;

  smoke)
    fail=0
    h=$(health)
    if [ "$h" = "ok" ]; then echo "PASS health: ok"; else echo "FAIL health: '$h'"; fail=1; fi
    # /app redirects (301) to /app/ -- follow it
    code=$(curl -sL -o /dev/null -w "%{http_code}" -m 5 http://localhost:3000/app)
    if [ "$code" = "200" ]; then echo "PASS mini-app: /app/ serves 200"; else echo "FAIL mini-app: HTTP $code"; fail=1; fi
    tables=$(python3 -c "
import sqlite3
db = sqlite3.connect('file:data/heysous.db?mode=ro', uri=True)
print(len(db.execute(\"SELECT name FROM sqlite_master WHERE type='table'\").fetchall()))" 2>/dev/null)
    if [ -n "$tables" ] && [ "$tables" -gt 20 ]; then echo "PASS db: $tables tables"; else echo "FAIL db: '$tables' tables"; fail=1; fi
    exit $fail
    ;;

  stop)
    pkill -f "tsx watch src/main.ts" 2>/dev/null
    sleep 2
    # tsx watch's child process survives the pkill and keeps holding port 3000
    pids=$(port_pids)
    if [ -n "$pids" ]; then
      echo "$pids" | xargs -r kill 2>/dev/null
      sleep 1
      pids=$(port_pids)
      [ -n "$pids" ] && echo "$pids" | xargs -r kill -9 2>/dev/null
      sleep 1
    fi
    if [ -n "$(port_pids)" ]; then
      echo "FAIL: port 3000 still held"
      exit 1
    fi
    echo "stopped: port 3000 free"
    ;;

  status)
    h=$(health)
    if [ "$h" = "ok" ]; then
      echo "running (health ok), port holder pid(s): $(port_pids | tr '\n' ' ')"
    else
      echo "not running"
    fi
    ;;

  db)
    # Read-only query against the dev DB. No sqlite3 CLI in this WSL and the
    # repo's better-sqlite3 native module may be built for a different Node
    # version -- python3's stdlib sqlite3 avoids both problems.
    python3 -c "
import sqlite3, json, sys
db = sqlite3.connect('file:data/heysous.db?mode=ro', uri=True)
db.row_factory = sqlite3.Row
rows = [dict(r) for r in db.execute(sys.argv[1])]
print(json.dumps(rows, indent=1, default=str))" "${2:?usage: smoke.sh db \"SELECT ...\"}"
    ;;

  *)
    echo "usage: $0 {start|smoke|stop|status|db \"<SQL>\"}"
    exit 2
    ;;
esac
