import { createReadStream, existsSync } from "node:fs";
import { createInterface } from "node:readline";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";

const PINO_LEVELS: Record<string, number> = {
  trace: 10,
  debug: 20,
  info: 30,
  warn: 40,
  error: 50,
  fatal: 60,
};

const PINO_LEVEL_NAMES: Record<number, string> = {
  10: "trace",
  20: "debug",
  30: "info",
  40: "warn",
  50: "error",
  60: "fatal",
};

export function registerLogTools(server: McpServer): void {
  server.tool(
    "query_logs",
    "Search and filter Pino JSON log files by level, time range, and content. Returns matching log entries as formatted JSON.",
    {
      log_file: z
        .string()
        .describe(
          "Absolute path to the Pino JSON log file"
        ),
      level: z
        .enum(["trace", "debug", "info", "warn", "error", "fatal"])
        .optional()
        .describe("Filter by log level"),
      search: z
        .string()
        .optional()
        .describe(
          "Substring or regex pattern to match against log line content"
        ),
      since: z
        .string()
        .optional()
        .describe("ISO 8601 timestamp -- only show logs after this time"),
      until: z
        .string()
        .optional()
        .describe("ISO 8601 timestamp -- only show logs before this time"),
      limit: z
        .number()
        .optional()
        .default(100)
        .describe("Maximum number of log lines to return (default: 100)"),
    },
    async (args) => {
      const { log_file, level, search, since, until, limit } = args;

      if (!existsSync(log_file)) {
        return {
          content: [
            {
              type: "text" as const,
              text: `Error: Log file not found: ${log_file}`,
            },
          ],
          isError: true,
        };
      }

      const levelFilter =
        level !== undefined ? PINO_LEVELS[level] : undefined;
      const sinceMs = since ? new Date(since).getTime() : undefined;
      const untilMs = until ? new Date(until).getTime() : undefined;
      const searchRegex = search ? new RegExp(search, "i") : undefined;
      const maxLines = limit ?? 100;

      const matches: unknown[] = [];

      const rl = createInterface({
        input: createReadStream(log_file, { encoding: "utf-8" }),
        crlfDelay: Infinity,
      });

      for await (const line of rl) {
        if (matches.length >= maxLines) break;

        const trimmed = line.trim();
        if (!trimmed) continue;

        let entry: Record<string, unknown>;
        try {
          entry = JSON.parse(trimmed);
        } catch {
          // Skip non-JSON lines
          continue;
        }

        // Filter by level
        if (levelFilter !== undefined && entry.level !== levelFilter) {
          continue;
        }

        // Filter by time range
        const entryTime =
          typeof entry.time === "number" ? entry.time : undefined;
        if (sinceMs !== undefined && entryTime !== undefined && entryTime < sinceMs) {
          continue;
        }
        if (untilMs !== undefined && entryTime !== undefined && entryTime > untilMs) {
          continue;
        }

        // Filter by search pattern
        if (searchRegex && !searchRegex.test(trimmed)) {
          continue;
        }

        // Add human-readable level name
        if (typeof entry.level === "number" && PINO_LEVEL_NAMES[entry.level]) {
          entry.levelName = PINO_LEVEL_NAMES[entry.level];
        }

        matches.push(entry);
      }

      return {
        content: [
          {
            type: "text" as const,
            text:
              matches.length > 0
                ? JSON.stringify(matches, null, 2)
                : "No matching log entries found.",
          },
        ],
      };
    }
  );
}
