import Database from "better-sqlite3";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";

const ALLOWED_PREFIXES = ["SELECT", "PRAGMA", "EXPLAIN"];
const FORBIDDEN_KEYWORDS = [
  "INSERT",
  "UPDATE",
  "DELETE",
  "DROP",
  "CREATE",
  "ALTER",
  "ATTACH",
  "DETACH",
  "REINDEX",
  "VACUUM",
];

function validateReadOnlySQL(sql: string): string | null {
  const trimmed = sql.trim();
  const upper = trimmed.toUpperCase();

  // Check if starts with an allowed prefix
  const startsWithAllowed = ALLOWED_PREFIXES.some((prefix) =>
    upper.startsWith(prefix)
  );
  if (!startsWithAllowed) {
    return `Only SELECT, PRAGMA, and EXPLAIN queries are allowed. Got: ${upper.split(/\s/)[0]}`;
  }

  // Check for forbidden keywords in WITH...INSERT/UPDATE/DELETE CTEs
  if (upper.startsWith("WITH")) {
    for (const keyword of FORBIDDEN_KEYWORDS) {
      // Look for the keyword as a standalone word (not part of a column/table name)
      const regex = new RegExp(`\\b${keyword}\\b`, "i");
      if (regex.test(trimmed)) {
        return `WITH expressions containing ${keyword} are not allowed. Only read-only queries are permitted.`;
      }
    }
  }

  return null;
}

export function registerDatabaseTools(
  server: McpServer,
  dbPath: string
): void {
  // Open database in read-only mode -- connection-level guarantee
  const db = new Database(dbPath, { readonly: true });

  server.tool(
    "query_database",
    "Execute a read-only SQL query against the HeySous SQLite database. Only SELECT, PRAGMA, and EXPLAIN statements are allowed.",
    {
      sql: z.string().describe("The SQL query to execute (SELECT only)"),
      params: z
        .array(z.union([z.string(), z.number()]))
        .optional()
        .describe("Bind parameters for the query"),
    },
    async (args) => {
      const { sql, params } = args;

      // Validate SQL is read-only
      const validationError = validateReadOnlySQL(sql);
      if (validationError) {
        return {
          content: [
            {
              type: "text" as const,
              text: `Error: ${validationError}`,
            },
          ],
          isError: true,
        };
      }

      try {
        const stmt = db.prepare(sql);
        const rows = params ? stmt.all(...params) : stmt.all();

        return {
          content: [
            {
              type: "text" as const,
              text:
                rows.length > 0
                  ? JSON.stringify(rows, null, 2)
                  : "Query returned no results.",
            },
          ],
        };
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        return {
          content: [
            {
              type: "text" as const,
              text: `SQLite error: ${message}`,
            },
          ],
          isError: true,
        };
      }
    }
  );

  server.tool(
    "list_tables",
    "List all tables in the HeySous database with their CREATE TABLE schemas. Useful for discovering the database structure.",
    async () => {
      try {
        const rows = db
          .prepare(
            "SELECT name, sql FROM sqlite_master WHERE type='table' ORDER BY name"
          )
          .all() as Array<{ name: string; sql: string }>;

        return {
          content: [
            {
              type: "text" as const,
              text: JSON.stringify(rows, null, 2),
            },
          ],
        };
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        return {
          content: [
            {
              type: "text" as const,
              text: `SQLite error: ${message}`,
            },
          ],
          isError: true,
        };
      }
    }
  );

  server.tool(
    "describe_table",
    "Show column details for a specific table using PRAGMA table_info. Returns column names, types, and constraints.",
    {
      table_name: z
        .string()
        .describe("Name of the table to describe"),
    },
    async (args) => {
      const { table_name } = args;

      // Validate table name to prevent injection (only alphanumeric and underscore)
      if (!/^[a-zA-Z0-9_]+$/.test(table_name)) {
        return {
          content: [
            {
              type: "text" as const,
              text: "Error: Table name must contain only alphanumeric characters and underscores.",
            },
          ],
          isError: true,
        };
      }

      try {
        const rows = db
          .prepare(`PRAGMA table_info(${table_name})`)
          .all();

        if ((rows as unknown[]).length === 0) {
          return {
            content: [
              {
                type: "text" as const,
                text: `Table '${table_name}' not found or has no columns.`,
              },
            ],
            isError: true,
          };
        }

        return {
          content: [
            {
              type: "text" as const,
              text: JSON.stringify(rows, null, 2),
            },
          ],
        };
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        return {
          content: [
            {
              type: "text" as const,
              text: `SQLite error: ${message}`,
            },
          ],
          isError: true,
        };
      }
    }
  );
}
