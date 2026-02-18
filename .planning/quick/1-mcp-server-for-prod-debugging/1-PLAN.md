---
phase: quick-1-mcp-server
plan: 01
type: execute
wave: 1
depends_on: []
files_modified:
  - src/mcp/server.ts
  - src/mcp/tools/query-logs.ts
  - src/mcp/tools/query-database.ts
  - src/mcp/tools/server-status.ts
  - package.json
  - tsconfig.json
autonomous: true
requirements: [MCP-01, MCP-02, MCP-03]

must_haves:
  truths:
    - "Claude Code can query production Pino JSON logs by time range, level, and content"
    - "Claude Code can run read-only SELECT queries against the production SQLite database"
    - "Claude Code can check basic server health and database stats"
    - "No write operations are possible through the MCP server"
  artifacts:
    - path: "src/mcp/server.ts"
      provides: "MCP server entry point using stdio transport"
      exports: ["main"]
    - path: "src/mcp/tools/query-logs.ts"
      provides: "Log search/filter tool definition and handler"
    - path: "src/mcp/tools/query-database.ts"
      provides: "Read-only SQL query tool with SELECT-only validation"
    - path: "src/mcp/tools/server-status.ts"
      provides: "Server health and database stats tool"
  key_links:
    - from: "src/mcp/server.ts"
      to: "@modelcontextprotocol/sdk"
      via: "McpServer class with stdio transport"
      pattern: "McpServer|StdioServerTransport"
    - from: "src/mcp/tools/query-database.ts"
      to: "better-sqlite3"
      via: "read-only database connection"
      pattern: "readonly.*true|SQLITE_OPEN_READONLY"
    - from: "Claude Code settings"
      to: "src/mcp/server.ts"
      via: "mcpServers config in .claude/settings.json"
---

<objective>
Create a standalone MCP (Model Context Protocol) server that gives Claude Code read-only access to the HeySous production environment for debugging. The server exposes three tools: log querying, database querying, and server status -- all strictly read-only.

Purpose: Enable production debugging directly from Claude Code conversations without SSH-ing into the server or manually running queries.

Output: A working MCP server at `src/mcp/server.ts` that can be run via `node dist/mcp/server.js` and configured in Claude Code's MCP settings.
</objective>

<execution_context>
@./.claude/get-shit-done/workflows/execute-plan.md
@./.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@./CLAUDE.md
@./package.json
@./tsconfig.json
@./src/config.ts
@./src/logger.ts
@./src/db/index.ts
@./src/db/schema.ts
@./.claude/settings.json
</context>

<tasks>

<task type="auto">
  <name>Task 1: Install MCP SDK and create server entry point with all three tools</name>
  <files>
    package.json
    src/mcp/server.ts
    src/mcp/tools/query-logs.ts
    src/mcp/tools/query-database.ts
    src/mcp/tools/server-status.ts
  </files>
  <action>
Install `@modelcontextprotocol/sdk` as a dependency:
```
npm install @modelcontextprotocol/sdk
```

**src/mcp/tools/query-logs.ts** -- Log search tool:
- Export a `registerLogTools(server: McpServer)` factory function (follows project pattern)
- Register a `query_logs` tool on the server with these params:
  - `log_file` (string, required): absolute path to the Pino JSON log file (e.g., piped output from `pino-tee` or redirected stdout)
  - `level` (string, optional): filter by log level -- "debug", "info", "warn", "error", "fatal"
  - `search` (string, optional): substring or regex to match against log line content
  - `since` (string, optional): ISO 8601 timestamp -- only show logs after this time
  - `until` (string, optional): ISO 8601 timestamp -- only show logs before this time
  - `limit` (number, optional, default 100): max lines to return
- Implementation:
  - Read the file line by line using `node:readline` + `node:fs` createReadStream
  - Parse each line as JSON (Pino format has `level` as number: 10=trace, 20=debug, 30=info, 40=warn, 50=error, 60=fatal)
  - Apply filters: level match (convert name to number), time range check against `time` field (unix ms), substring/regex match against full line
  - Return matching lines as formatted JSON array (pretty-printed for readability)
  - Handle missing file gracefully with clear error message
  - Cap output at `limit` lines

**src/mcp/tools/query-database.ts** -- Read-only SQL tool:
- Export a `registerDatabaseTools(server: McpServer, dbPath: string)` factory function
- Register a `query_database` tool with params:
  - `sql` (string, required): the SQL query to execute
  - `params` (array of strings/numbers, optional): bind parameters for the query
- Security (CRITICAL):
  - Open database with `{ readonly: true }` flag in better-sqlite3 (this is a connection-level guarantee)
  - Additionally, validate the SQL before execution: trim, uppercase, check it starts with "SELECT" or "PRAGMA" or "EXPLAIN"
  - Reject anything starting with INSERT, UPDATE, DELETE, DROP, CREATE, ALTER, ATTACH, DETACH, REINDEX, VACUUM, WITH (that contains INSERT/UPDATE/DELETE)
  - If rejected, return an error message explaining only SELECT queries are allowed
  - Use `.prepare(sql).all(...params)` for execution -- never raw `.exec()`
  - Wrap in try/catch, return SQLite errors as text (not throw)
- Return results as JSON array of row objects
- Also register a `list_tables` tool (no params) that runs `SELECT name, sql FROM sqlite_master WHERE type='table' ORDER BY name` to help Claude discover the schema
- Also register a `describe_table` tool with param `table_name` (string) that runs `PRAGMA table_info({table_name})` -- validate table_name contains only alphanumeric/underscore chars to prevent injection

**src/mcp/tools/server-status.ts** -- Health/stats tool:
- Export a `registerStatusTools(server: McpServer, dbPath: string)` factory function
- Register a `server_status` tool (no params) that returns:
  - Database file size (from `node:fs` stat)
  - Database path
  - Table row counts (run `SELECT COUNT(*) FROM {table}` for each table found in sqlite_master)
  - SQLite page count and page size (from `PRAGMA page_count` and `PRAGMA page_size`)
  - Current time on server
  - Node.js version, platform, memory usage (`process.memoryUsage()`)
- Open database read-only same as query_database tool

**src/mcp/server.ts** -- Main entry point:
- Import and use `McpServer` from `@modelcontextprotocol/sdk/server/mcp.js` and `StdioServerTransport` from `@modelcontextprotocol/sdk/server/stdio.js`
- Do NOT import from `./config.js` -- the MCP server must NOT require BOT_TOKEN or ANTHROPIC_API_KEY. Instead, read env vars directly:
  - `HEYSOUS_DB_PATH` (required, path to SQLite database file)
  - `HEYSOUS_LOG_FILE` (optional, path to JSON log file -- tool still works without it, just returns "no log file configured")
- Create server with name "heysous-debug" and version "1.0.0"
- Call all three register functions to add tools
- Connect with StdioServerTransport
- Add error handling for uncaught exceptions
- This file should be self-contained -- it does NOT start the bot, Express, or any other HeySous services. It only opens a read-only DB connection and serves MCP tools over stdio.

**package.json** -- Add a script:
```json
"mcp": "node dist/mcp/server.js"
```

IMPORTANT: All TypeScript imports must use `.js` extensions per project convention. The MCP server is part of the `src/` tree and compiles to `dist/` with the existing tsconfig.
  </action>
  <verify>
1. `npm run typecheck` passes with no errors
2. `npm run build` completes successfully
3. `ls dist/mcp/server.js dist/mcp/tools/query-logs.js dist/mcp/tools/query-database.js dist/mcp/tools/server-status.js` -- all files exist
4. Quick smoke test: `echo '{"jsonrpc":"2.0","id":1,"method":"initialize","params":{"protocolVersion":"2024-11-05","capabilities":{},"clientInfo":{"name":"test","version":"0.1"}}}' | HEYSOUS_DB_PATH=data/heysous.db node dist/mcp/server.js` -- should receive a JSON response with server capabilities (not crash)
  </verify>
  <done>
MCP server compiles, all three tool modules register successfully, server responds to MCP initialize handshake over stdio, database opens in read-only mode, SQL validation rejects non-SELECT statements.
  </done>
</task>

<task type="auto">
  <name>Task 2: Add MCP server configuration and documentation</name>
  <files>
    .claude/settings.json
  </files>
  <action>
Update `.claude/settings.json` to add the MCP server configuration so Claude Code can use it. Add an `mcpServers` key at the top level:

```json
{
  "mcpServers": {
    "heysous-debug": {
      "command": "node",
      "args": ["dist/mcp/server.js"],
      "cwd": "/workspace",
      "env": {
        "HEYSOUS_DB_PATH": "data/heysous.db"
      }
    }
  },
  "hooks": { ... existing ... },
  "statusLine": { ... existing ... }
}
```

Note: `HEYSOUS_LOG_FILE` is intentionally omitted from the dev config since dev mode uses pino-pretty to stdout (not JSON files). For production use, the user would configure this in their Claude Code project settings pointing to wherever prod logs are piped.

Preserve all existing settings (hooks, statusLine, permissions in settings.local.json).
  </action>
  <verify>
1. Read `.claude/settings.json` and confirm `mcpServers.heysous-debug` is present
2. Confirm existing `hooks` and `statusLine` keys are preserved
3. `npm run build` still passes (no regressions)
  </verify>
  <done>
Claude Code settings include the MCP server configuration. Running Claude Code in the project will automatically start the MCP server and make the `query_logs`, `query_database`, `list_tables`, `describe_table`, and `server_status` tools available.
  </done>
</task>

</tasks>

<verification>
1. `npm run typecheck` -- no TypeScript errors
2. `npm run build` -- compiles successfully
3. `npm test` -- existing tests still pass (MCP server is additive, no existing code modified)
4. MCP handshake test: pipe an initialize JSON-RPC message to the server and get a valid response
5. Security: attempt to run `DELETE FROM users` through query_database tool -- must be rejected
6. Read-only DB: even if SQL validation is bypassed, `{ readonly: true }` on better-sqlite3 prevents writes at the SQLite level
</verification>

<success_criteria>
- MCP server starts via `HEYSOUS_DB_PATH=data/heysous.db node dist/mcp/server.js` without errors
- All five tools (query_logs, query_database, list_tables, describe_table, server_status) are registered and callable
- Database queries return real data from the SQLite database
- Non-SELECT SQL is rejected with a clear error message
- Server is configured in `.claude/settings.json` for automatic use in Claude Code
- No existing functionality is broken (tests pass, typecheck passes)
</success_criteria>

<output>
After completion, create `.planning/quick/1-mcp-server-for-prod-debugging/1-SUMMARY.md`
</output>
