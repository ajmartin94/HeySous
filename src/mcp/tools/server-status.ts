import { statSync } from "node:fs";
import Database from "better-sqlite3";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";

export function registerStatusTools(
  server: McpServer,
  dbPath: string
): void {
  server.tool(
    "server_status",
    "Get HeySous server health info including database stats, table row counts, memory usage, and system info.",
    async () => {
      try {
        // Database file size
        let dbSizeBytes: number | null = null;
        try {
          const stat = statSync(dbPath);
          dbSizeBytes = stat.size;
        } catch {
          // File might not exist yet
        }

        // Open database read-only for stats
        const db = new Database(dbPath, { readonly: true });

        // Get table names and row counts
        const tables = db
          .prepare(
            "SELECT name FROM sqlite_master WHERE type='table' ORDER BY name"
          )
          .all() as Array<{ name: string }>;

        const tableCounts: Record<string, number> = {};
        for (const { name } of tables) {
          // Skip internal SQLite tables
          if (name.startsWith("sqlite_")) continue;
          try {
            const row = db
              .prepare(`SELECT COUNT(*) as count FROM "${name}"`)
              .get() as { count: number };
            tableCounts[name] = row.count;
          } catch {
            tableCounts[name] = -1; // Indicate error
          }
        }

        // SQLite page info
        const pageCount = (
          db.prepare("PRAGMA page_count").get() as { page_count: number }
        ).page_count;
        const pageSize = (
          db.prepare("PRAGMA page_size").get() as { page_size: number }
        ).page_size;

        db.close();

        // System info
        const memUsage = process.memoryUsage();

        const status = {
          database: {
            path: dbPath,
            sizeBytes: dbSizeBytes,
            sizeMB: dbSizeBytes
              ? (dbSizeBytes / 1024 / 1024).toFixed(2) + " MB"
              : "unknown",
            pageCount,
            pageSize,
            totalPages: `${pageCount} pages x ${pageSize} bytes`,
          },
          tables: tableCounts,
          system: {
            currentTime: new Date().toISOString(),
            nodeVersion: process.version,
            platform: process.platform,
            arch: process.arch,
            memoryUsage: {
              rss: (memUsage.rss / 1024 / 1024).toFixed(2) + " MB",
              heapUsed:
                (memUsage.heapUsed / 1024 / 1024).toFixed(2) + " MB",
              heapTotal:
                (memUsage.heapTotal / 1024 / 1024).toFixed(2) + " MB",
            },
          },
        };

        return {
          content: [
            {
              type: "text" as const,
              text: JSON.stringify(status, null, 2),
            },
          ],
        };
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        return {
          content: [
            {
              type: "text" as const,
              text: `Error getting server status: ${message}`,
            },
          ],
          isError: true,
        };
      }
    }
  );
}
