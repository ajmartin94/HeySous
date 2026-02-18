---
phase: quick-1-mcp-server
plan: 01
subsystem: infra
tags: [mcp, model-context-protocol, debugging, sqlite, logs, stdio]

# Dependency graph
requires: []
provides:
  - "MCP server for read-only production debugging via Claude Code"
  - "query_logs tool for Pino JSON log searching"
  - "query_database tool with SELECT-only SQL execution"
  - "list_tables and describe_table tools for schema discovery"
  - "server_status tool for health/stats monitoring"
affects: []

# Tech tracking
tech-stack:
  added: ["@modelcontextprotocol/sdk"]
  patterns: ["MCP stdio transport", "read-only database connection", "SQL validation whitelist"]

key-files:
  created:
    - src/mcp/server.ts
    - src/mcp/tools/query-logs.ts
    - src/mcp/tools/query-database.ts
    - src/mcp/tools/server-status.ts
  modified:
    - package.json
    - .claude/settings.json

key-decisions:
  - "MCP server is standalone -- does not import config.ts or require BOT_TOKEN/ANTHROPIC_API_KEY"
  - "Database opened with better-sqlite3 readonly:true flag for connection-level write protection"
  - "SQL validation uses both prefix whitelist (SELECT/PRAGMA/EXPLAIN) and WITH-CTE keyword blocklist"
  - "HEYSOUS_LOG_FILE omitted from dev config since dev mode uses pino-pretty (not JSON)"

patterns-established:
  - "registerXxxTools(server, ...deps) pattern for MCP tool modules"
  - "MCP server as separate entry point (src/mcp/server.ts) that compiles to dist/mcp/server.js"

requirements-completed: [MCP-01, MCP-02, MCP-03]

# Metrics
duration: 3min
completed: 2026-02-18
---

# Quick Task 1: MCP Server for Production Debugging Summary

**Standalone MCP server with stdio transport exposing read-only log search, SQL query, and server status tools for Claude Code production debugging**

## Performance

- **Duration:** 3 min
- **Started:** 2026-02-18T02:32:07Z
- **Completed:** 2026-02-18T02:35:43Z
- **Tasks:** 2
- **Files modified:** 6

## Accomplishments
- MCP server with 5 tools: query_logs, query_database, list_tables, describe_table, server_status
- Read-only database access with connection-level and SQL-validation-level protection
- Log file searching with level, time range, and regex content filters
- Claude Code settings configured to auto-start MCP server in project sessions

## Task Commits

Each task was committed atomically:

1. **Task 1: Install MCP SDK and create server entry point with all three tools** - `d410318` (feat)
2. **Task 2: Add MCP server configuration to Claude Code settings** - `71d8d4f` (chore)

## Files Created/Modified
- `src/mcp/server.ts` - MCP server entry point with stdio transport, reads HEYSOUS_DB_PATH env var
- `src/mcp/tools/query-logs.ts` - Log search tool with level/time/regex filters using readline streams
- `src/mcp/tools/query-database.ts` - Read-only SQL tool (SELECT/PRAGMA/EXPLAIN only) plus list_tables and describe_table
- `src/mcp/tools/server-status.ts` - Health check tool with DB stats, table row counts, memory usage
- `package.json` - Added @modelcontextprotocol/sdk dependency and "mcp" script
- `.claude/settings.json` - Added mcpServers.heysous-debug configuration

## Decisions Made
- MCP server is standalone and does not import config.ts -- avoids requiring BOT_TOKEN/ANTHROPIC_API_KEY just for debugging
- Database opened with better-sqlite3 `{ readonly: true }` flag for connection-level write protection
- SQL validation uses prefix whitelist (SELECT/PRAGMA/EXPLAIN) plus keyword blocklist for WITH-CTE abuse prevention
- HEYSOUS_LOG_FILE intentionally omitted from dev config since dev mode pipes through pino-pretty (not JSON files)
- Used deprecated `server.tool()` API (still fully functional) rather than `server.registerTool()` for simpler code

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None.

## User Setup Required

None - no external service configuration required. The MCP server will auto-start when Claude Code opens the project.

For production log querying, users can add `HEYSOUS_LOG_FILE` to the env section in `.claude/settings.json` pointing to wherever production logs are piped to a JSON file.

## Next Phase Readiness
- MCP server is ready for use immediately after `npm run build`
- To use in production: set HEYSOUS_DB_PATH to the production database path and optionally HEYSOUS_LOG_FILE to the JSON log file path

## Self-Check: PASSED

All 5 source files verified on disk. Both task commits (d410318, 71d8d4f) verified in git log.

---
*Quick Task: 1-mcp-server-for-prod-debugging*
*Completed: 2026-02-18*
