# Database

## Adding a table

1. Define schema in the relevant domain module (e.g. `src/yourfeature/schema.ts`)
2. Create an init function with `CREATE TABLE IF NOT EXISTS`
3. Call init from `src/db/index.ts` `createDatabase()`
4. Re-export from `src/db/schema.ts` if using Drizzle

## Two database handles

- `db` (Drizzle ORM) -- for schema-defined tables via query builder
- `sqlite` (raw better-sqlite3) -- for FTS5 queries, raw SQL init scripts, and older repositories

SQLite is passed as first param to standalone repository functions. Use Drizzle when possible.
