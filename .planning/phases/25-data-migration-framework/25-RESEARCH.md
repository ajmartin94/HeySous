# Phase 25: Data Migration Framework - Research

**Researched:** 2026-02-19
**Domain:** SQLite migration infrastructure (PRAGMA user_version, better-sqlite3)
**Confidence:** HIGH

## Summary

This phase builds a lightweight, forward-only migration framework for HeySous's SQLite database. The codebase currently has no formal migration system -- tables are created via `CREATE TABLE IF NOT EXISTS` in domain-specific init functions, and the only real migration (`migrateToHouseholdId` in `src/db/migrate.ts`) uses `PRAGMA table_info()` to detect whether it has already run. Future phases (notably Phase 30: Update Notifications) need schema changes (adding columns/tables), so a safe, tracked migration path is necessary.

The framework is intentionally minimal: ~50 lines of runner code, `PRAGMA user_version` as the version tracker, numbered migration functions in a registry module, each migration wrapped in a transaction. No rollback support (explicitly out of scope per REQUIREMENTS.md), no CLI tool, no separate migration table. The runner executes during `createDatabase()` after WAL/foreign key pragmas and before all `CREATE TABLE IF NOT EXISTS` init functions.

The key bootstrapping challenge is that existing databases have `user_version = 0` (the SQLite default for databases created without version tracking). The runner must distinguish "fresh database" from "existing database that predates versioning." The solution: start numbering at version 1, and the runner treats `user_version = 0` as "no migrations have run yet." The first v1.4 migration (e.g., the one Phase 30 will add) becomes version 1. The existing `migrateToHouseholdId` function stays as-is per MIGR-04 -- it runs separately and continues to use its own `PRAGMA table_info()` idempotency check.

**Primary recommendation:** Build a ~50 LOC migration runner in `src/db/migrations.ts` using `PRAGMA user_version`, a static registry of migration functions, transaction-per-migration execution, and integration into `createDatabase()` between pragmas and init functions. No new dependencies.

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| MIGR-01 | Lightweight migration runner using PRAGMA user_version tracks which migrations have run | `PRAGMA user_version` is a built-in SQLite integer (verified: better-sqlite3 ^12.6.2 bundling SQLite 3.51.2 supports it). Read via `sqlite.pragma('user_version', { simple: true })`, set via `sqlite.pragma('user_version = N')`. Transactional -- rolls back with the enclosing transaction. |
| MIGR-02 | Each migration runs in a transaction and is idempotent | better-sqlite3's `sqlite.transaction()()` pattern already used in `migrateToHouseholdId`. PRAGMA user_version can be set inside transactions and rolls back on failure (verified experimentally). Idempotency achieved by: (a) version check skips already-run migrations, (b) individual SQL statements use defensive patterns (IF NOT EXISTS, PRAGMA table_info checks). |
| MIGR-03 | Migration runner executes during database init, after pragmas, before table init functions | Current `createDatabase()` flow: pragmas -> initCoreTables -> migrateToHouseholdId -> domain init functions. Runner inserts between pragmas and initCoreTables. |
| MIGR-04 | Existing migrateToHouseholdId left as-is; framework handles v1.4+ schema changes only | The household migration stays in `src/db/migrate.ts` with its existing call site. The new framework starts at version 1 for v1.4+ changes. No conflict because the two systems are independent. |
</phase_requirements>

## Standard Stack

### Core (existing -- no new dependencies)
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| better-sqlite3 | ^12.6.2 (SQLite 3.51.2) | Raw SQL execution, PRAGMA access, transactions | Already the database driver; migration runner uses `sqlite.pragma()` and `sqlite.transaction()` |
| pino | ^10.3.0 | Migration logging | Already imported as `logger` throughout codebase |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| node:fs | built-in | Not needed | Migrations use static imports, not filesystem scanning |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| PRAGMA user_version | Dedicated `migrations` table | user_version is simpler (single integer, no table creation needed, atomic with transactions). A table would track per-migration metadata (name, timestamp) but adds complexity this project doesn't need. |
| Static migration registry | Dynamic filesystem scanning with `import()` | Registry is simpler, type-safe, works with ESM without dynamic import complexities. The codebase has zero dynamic imports. Filesystem scanning would need `readdirSync` + `import()` + path resolution. |
| Custom runner | drizzle-kit migrate | Drizzle migrations are designed for a different workflow (generate SQL from schema diffs). The project uses `CREATE TABLE IF NOT EXISTS` in init functions, not Drizzle-managed schema. A custom runner is simpler and fits the existing patterns. |

**Installation:**
```bash
# No new packages needed
```

## Architecture Patterns

### Recommended Project Structure
```
src/db/
  index.ts           # createDatabase() -- calls runMigrations() between pragmas and init functions
  migrate.ts          # Existing migrateToHouseholdId (UNCHANGED per MIGR-04)
  init.ts             # initializeCoreTables (UNCHANGED)
  schema.ts           # Drizzle schema definitions (UNCHANGED)
  migrations.ts       # NEW: Migration runner + migration registry
```

### Pattern 1: Migration Runner with PRAGMA user_version
**What:** A `runMigrations(sqlite)` function that reads the current `user_version`, runs any migrations with version > current, and sets `user_version` after each successful migration.
**When to use:** Called once during database initialization.
**Example:**
```typescript
// Source: verified experimentally with better-sqlite3 ^12.6.2
import type BetterSqlite3 from "better-sqlite3";
import { logger } from "../logger.js";

interface Migration {
  version: number;
  name: string;
  up: (sqlite: BetterSqlite3.Database) => void;
}

// Static registry -- add new migrations here
const migrations: Migration[] = [
  // Example (Phase 30 will add the first real migration):
  // { version: 1, name: "add-notification-tracking", up: (sqlite) => { ... } },
];

export function runMigrations(sqlite: BetterSqlite3.Database): void {
  const currentVersion = sqlite.pragma("user_version", { simple: true }) as number;

  const pending = migrations
    .filter((m) => m.version > currentVersion)
    .sort((a, b) => a.version - b.version);

  if (pending.length === 0) {
    return;
  }

  logger.info(
    { currentVersion, pendingCount: pending.length },
    "Running database migrations",
  );

  for (const migration of pending) {
    logger.info(
      { version: migration.version, name: migration.name },
      "Applying migration",
    );

    sqlite.transaction(() => {
      migration.up(sqlite);
      sqlite.pragma(`user_version = ${migration.version}`);
    })();

    logger.info(
      { version: migration.version, name: migration.name },
      "Migration applied",
    );
  }

  logger.info(
    { newVersion: pending[pending.length - 1].version },
    "All migrations complete",
  );
}
```

### Pattern 2: Integration into createDatabase()
**What:** Call `runMigrations()` after pragmas but before any init functions.
**When to use:** Always -- this is the integration point.
**Example:**
```typescript
// In src/db/index.ts
import { runMigrations } from "./migrations.js";

export function createDatabase(dbPath: string) {
  const sqlite = new Database(dbPath);

  // 1. Pragmas (WAL, foreign keys)
  sqlite.pragma("journal_mode = WAL");
  sqlite.pragma("foreign_keys = ON");

  // 2. Run versioned migrations (MIGR-03: after pragmas, before init)
  runMigrations(sqlite);

  // 3. Core tables (CREATE TABLE IF NOT EXISTS)
  initializeCoreTables(sqlite);

  // 4. Legacy migration (MIGR-04: left as-is)
  migrateToHouseholdId(sqlite);

  // 5. Domain init functions...
  initializeFts(sqlite);
  // ...
}
```

### Pattern 3: Writing an Individual Migration
**What:** Each migration is a plain function that receives the `sqlite` instance and runs SQL.
**When to use:** Adding any schema change in v1.4+.
**Example:**
```typescript
// Adding a column (defensive with PRAGMA table_info check)
{
  version: 1,
  name: "add-notification-tracking",
  up: (sqlite) => {
    sqlite.exec(`
      CREATE TABLE IF NOT EXISTS update_notifications (
        household_id TEXT PRIMARY KEY,
        last_seen_version INTEGER NOT NULL DEFAULT 0
      )
    `);
  },
}

// Adding a column to an existing table
{
  version: 2,
  name: "add-source-url-to-knowledge",
  up: (sqlite) => {
    // SQLite 3.35.0+ supports ADD COLUMN IF NOT EXISTS
    // But better-sqlite3 bundles SQLite 3.51.2, so we can use it safely
    // However, SQLite does NOT support "ADD COLUMN IF NOT EXISTS" syntax.
    // Use PRAGMA table_info() check instead:
    const columns = sqlite.prepare("PRAGMA table_info(knowledge_items)").all() as Array<{ name: string }>;
    if (!columns.some((c) => c.name === "source_url")) {
      sqlite.exec(`ALTER TABLE knowledge_items ADD COLUMN source_url TEXT`);
    }
  },
}
```

### Anti-Patterns to Avoid
- **Over-engineering the framework:** No rollback support, no dry-run mode, no CLI tool, no migration table. ~50 LOC is the target. (Confirmed out of scope per REQUIREMENTS.md "Auto-migration rollback" in Out of Scope.)
- **Dynamic filesystem scanning:** Don't use `readdirSync` + `import()`. The codebase uses static imports exclusively. A static registry array is simpler, type-safe, and avoids ESM dynamic import edge cases.
- **Moving existing init functions into migrations:** The `CREATE TABLE IF NOT EXISTS` init functions work well and are safe to run alongside the migration framework. Don't touch them. Migrations are for ALTER TABLE, new tables beyond init, and data transforms.
- **Using PRAGMA user_version outside a transaction:** Setting user_version without a transaction means a crash between the migration SQL and the version update leaves the database in an inconsistent state. Always set user_version inside the same transaction as the migration SQL.
- **Starting at version 0:** `user_version = 0` is the SQLite default for all databases. Starting migrations at version 1 means existing databases (which have `user_version = 0`) simply have no pending migrations until a real v1.4 migration is added. Don't create a "baseline" migration that does nothing -- it's unnecessary complexity.
- **Non-sequential version numbers:** Versions must be sequential integers (1, 2, 3...). Don't use timestamps, semantic versions, or gaps. `PRAGMA user_version` is a single integer and the runner filters `> currentVersion`.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Version tracking | Custom migrations table | `PRAGMA user_version` | Built into SQLite, atomic with transactions, no table creation needed, inspectable via `sqlite3` CLI |
| Transaction management | Manual BEGIN/COMMIT | `sqlite.transaction()()` | better-sqlite3's transaction wrapper handles rollback on error automatically |
| Migration ordering | Custom sorting logic | Sequential integer versions + array sort | `parseInt(version)` + `array.sort()` is trivial |

**Key insight:** The entire migration framework should be ~50 lines of code. If it's getting larger, something is being over-engineered. The codebase has ~12 tables and will add 2-3 more. This is not an enterprise database needing Flyway or Liquibase.

## Common Pitfalls

### Pitfall 1: PRAGMA user_version = 0 on Existing Databases
**What goes wrong:** A brand new database and an existing database both have `user_version = 0`. If migration 1 assumes "empty database" and tries to create tables that already exist, it will either succeed silently (CREATE TABLE IF NOT EXISTS) or fail loudly (ALTER TABLE ADD COLUMN for a column that exists).
**Why it happens:** SQLite sets `user_version` to 0 by default. There's no way to distinguish "never versioned" from "version 0."
**How to avoid:** Don't create a "baseline" migration. Start at version 1 for the first real v1.4 schema change. Use defensive SQL in every migration (IF NOT EXISTS checks, PRAGMA table_info before ALTER TABLE). The existing init functions already use IF NOT EXISTS, so they coexist safely.
**Warning signs:** Migration 1 crashes with "table already exists" or "duplicate column name" on existing databases.

### Pitfall 2: PRAGMA user_version Set Outside Transaction
**What goes wrong:** If the migration SQL runs successfully but a crash occurs before `PRAGMA user_version = N` is executed, the database is in a migrated state but the version number doesn't reflect it. Next startup, the runner tries to re-run the migration. If the migration is not idempotent, it fails.
**Why it happens:** `PRAGMA user_version = N` is not automatically transactional unless explicitly wrapped.
**How to avoid:** Always set `user_version` inside the same `sqlite.transaction()()` call as the migration SQL. Verified experimentally: PRAGMA user_version rolls back with the transaction on failure.
**Warning signs:** After a crash, migration re-runs unexpectedly.

### Pitfall 3: SQLite ALTER TABLE Limitations
**What goes wrong:** Migration author assumes SQL Server/PostgreSQL-level ALTER TABLE support. SQLite cannot: add constraints to existing columns, change column types, add NOT NULL columns without defaults, or drop columns (pre-3.35.0).
**Why it happens:** Different SQL databases have different ALTER TABLE capabilities.
**How to avoid:** For SQLite migrations, the safe operations are: ADD COLUMN (with default or nullable), RENAME COLUMN, RENAME TABLE, CREATE TABLE, CREATE INDEX. For constraint changes, use the table-rebuild pattern (CREATE new -> INSERT SELECT -> DROP old -> RENAME new).
**Warning signs:** Migration fails with "near 'ADD': syntax error" or similar.

### Pitfall 4: Foreign Keys and Transactions
**What goes wrong:** `PRAGMA foreign_keys = ON` is set before migrations run. If a migration creates a table with a foreign key reference to a table that doesn't exist yet (because the init function hasn't run), the migration fails.
**Why it happens:** Migrations run before init functions (MIGR-03). If a migration creates a table with FK references to tables created by init functions, the FK constraint check fails.
**How to avoid:** Migrations that create tables with FK references must either: (a) also create the referenced table first (via CREATE TABLE IF NOT EXISTS), or (b) temporarily disable foreign keys (`PRAGMA foreign_keys = OFF` at start of migration, `ON` at end). Option (a) is cleaner for this project since init functions use IF NOT EXISTS anyway.
**Warning signs:** Migration fails with "FOREIGN KEY constraint failed."

### Pitfall 5: Logger Import Creates Circular Dependency
**What goes wrong:** `src/db/migrations.ts` imports logger, which imports config, which runs `dotenv.config()` at module load time. If the import chain introduces a circular dependency, module initialization fails.
**Why it happens:** The logger module in this codebase is a thin wrapper that imports config at the top level.
**How to avoid:** Verify that `migrations.ts` -> `logger.ts` -> `config.ts` is a clean dependency chain with no cycles. Currently, `src/db/index.ts` already imports `config.js`, so adding `logger.js` to `migrations.ts` follows the same pattern. No circular dependency risk here.
**Warning signs:** "Cannot access before initialization" error at startup.

## Code Examples

Verified patterns from codebase analysis and experimental testing:

### Reading PRAGMA user_version
```typescript
// Source: verified experimentally with better-sqlite3 ^12.6.2
const currentVersion = sqlite.pragma("user_version", { simple: true }) as number;
// Returns: 0 (default), or whatever was last set
// Type: number
```

### Setting PRAGMA user_version Inside Transaction
```typescript
// Source: verified experimentally -- rolls back on transaction failure
sqlite.transaction(() => {
  sqlite.exec(`CREATE TABLE IF NOT EXISTS foo (id INTEGER PRIMARY KEY)`);
  sqlite.pragma("user_version = 1");
})();
// If the transaction throws, user_version is NOT updated
```

### Defensive ALTER TABLE ADD COLUMN
```typescript
// Source: codebase pattern from src/db/migrate.ts (table_info check)
// SQLite does NOT have "ADD COLUMN IF NOT EXISTS" syntax
const columns = sqlite
  .prepare("PRAGMA table_info(knowledge_items)")
  .all() as Array<{ name: string }>;

if (!columns.some((col) => col.name === "source_url")) {
  sqlite.exec(`ALTER TABLE knowledge_items ADD COLUMN source_url TEXT`);
}
```

### Existing Transaction Pattern
```typescript
// Source: src/db/migrate.ts (migrateToHouseholdId)
sqlite.transaction(() => {
  sqlite.exec(`ALTER TABLE knowledge_items RENAME COLUMN chat_id TO household_id`);
  // ... more statements
})();
```

### Inspecting user_version via SQLite CLI
```bash
# The success criteria requires this to be inspectable
sqlite3 data/heysous.db "PRAGMA user_version;"
# Returns: integer (0, 1, 2, etc.)
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Ad-hoc PRAGMA table_info checks | PRAGMA user_version tracking | This phase | Single source of truth for database schema version |
| No migration framework | Forward-only migration runner | This phase | All future schema changes go through a safe, tracked path |

**Deprecated/outdated:**
- The `migrateToHouseholdId` function in `src/db/migrate.ts` will remain as legacy code (per MIGR-04). Future migrations use the new framework.

## Key Design Decisions

### 1. Static Registry vs. Filesystem Scanning
**Decision:** Use a static array of migration objects in `src/db/migrations.ts`.
**Rationale:**
- The codebase has zero dynamic imports -- all imports are static ESM with `.js` extensions
- Static registry is type-safe (TypeScript catches missing properties at compile time)
- No filesystem scanning means no `readdirSync`, no path resolution, no `.js` vs `.ts` extension issues
- Adding a migration means: write the function, add it to the array, done
- Works identically in dev (tsx) and production (compiled JS)

### 2. Version Numbering Starts at 1
**Decision:** The first migration added (by a later phase) will be version 1.
**Rationale:**
- `user_version = 0` is the SQLite default for ALL databases, both fresh and existing
- Starting at 1 means existing databases have 0 pending migrations until a real change is needed
- No need for a "baseline" no-op migration -- the init functions already handle table creation
- The runner simply checks `version > currentVersion`, so version 0 databases skip all migrations if none exist

### 3. One Transaction Per Migration (Not One Big Transaction)
**Decision:** Each migration runs in its own transaction, with `user_version` updated inside that transaction.
**Rationale:**
- If migration 3 fails, migrations 1 and 2 are already committed and won't re-run
- SQLite transactions are lightweight -- no performance concern
- A single big transaction risks rolling back ALL migrations if the last one fails
- Per-migration transactions match the PRAGMA user_version semantics (version advances one step at a time)

### 4. Migrations Module Lives at src/db/migrations.ts (Not a Directory of Files)
**Decision:** Single file with all migrations registered in an array.
**Rationale:**
- Consistent with codebase style (single-file modules, no barrel exports)
- For a project with ~12 tables that will add 2-3 more, the total number of migrations will be small (likely <10)
- A directory of files would need dynamic imports, path resolution, and sorting logic -- unnecessary complexity
- If the file grows too large in the future, individual migration functions can be extracted to separate files and imported statically

## Open Questions

1. **Should the runner log at info or debug level?**
   - What we know: The logger currently uses `info` level in dev and production. Migration runs are rare (only on version change).
   - What's unclear: Whether migration logging should be prominent (info) or quiet (debug).
   - Recommendation: Use `info` level. Migrations are important enough to see in production logs, and they only run once.

2. **Should the migration runner validate version sequencing?**
   - What we know: If someone adds version 3 without version 2, the runner would skip from 1 to 3, leaving version 2 "missing."
   - What's unclear: Whether this validation is worth the code.
   - Recommendation: Add a simple check that versions are sequential (no gaps). It's 3 lines of code and catches developer errors early. Throw on startup if gaps are detected.

## Sources

### Primary (HIGH confidence)
- **better-sqlite3 `pragma()` API** -- verified experimentally with better-sqlite3 ^12.6.2 (SQLite 3.51.2): `sqlite.pragma('user_version', { simple: true })` returns a number, `sqlite.pragma('user_version = N')` sets it, and the value rolls back with transactions
- **Codebase analysis** -- `src/db/index.ts` (createDatabase flow), `src/db/migrate.ts` (existing migration pattern), `src/db/init.ts` (core tables), all domain init functions
- **SQLite PRAGMA user_version documentation** -- built-in integer stored in database header, persists across connections, inspectable via CLI

### Secondary (MEDIUM confidence)
- **v1.4 research documents** -- `.planning/research/ARCHITECTURE.md` (integration point recommendations), `.planning/research/PITFALLS.md` (Pitfall 5: migration runner breaks existing ad-hoc migrations), `.planning/research/FEATURES.md` (migration framework as Phase 1), `.planning/research/SUMMARY.md` (50 LOC runner recommendation)

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH -- no new dependencies, using existing better-sqlite3 APIs verified experimentally
- Architecture: HIGH -- integration point clearly identified in createDatabase(), existing patterns well understood
- Pitfalls: HIGH -- bootstrapping challenge (user_version = 0) well documented in prior research, transaction behavior verified experimentally

**Research date:** 2026-02-19
**Valid until:** 2026-04-19 (very stable -- SQLite PRAGMA user_version is a 20+ year old feature, better-sqlite3 API is stable)
