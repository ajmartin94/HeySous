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

/**
 * Parse a single log line into a Pino entry, tolerating a leading prefix.
 *
 * Production runs under pm2 with `log_date_format` set (docs/DEPLOYMENT.md),
 * which prepends a formatted timestamp to every stdout line:
 *
 *   2026-07-25 00:58:03: {"level":50,"time":...,"msg":"..."}
 *
 * A strict JSON.parse rejects those, which silently dropped every prod log
 * line and made query_logs always report "No matching log entries found".
 * We retry from the first `{` so any prefix format works.
 *
 * @returns The parsed entry, or null if the line is not a JSON object.
 */
export function parseLogLine(line: string): Record<string, unknown> | null {
  const trimmed = line.trim();
  if (!trimmed) return null;

  const direct = parseJsonObject(trimmed);
  if (direct) return direct;

  // Retry past a leading prefix. Index 0 is already covered by `direct`.
  const braceIndex = trimmed.indexOf("{");
  if (braceIndex <= 0) return null;

  return parseJsonObject(trimmed.slice(braceIndex));
}

/** Parse `text` as JSON, accepting only plain objects. */
function parseJsonObject(text: string): Record<string, unknown> | null {
  try {
    const parsed: unknown = JSON.parse(text);
    if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) {
      return null;
    }
    return parsed as Record<string, unknown>;
  } catch {
    return null;
  }
}

export function registerLogTools(server: McpServer): void {
  server.tool(
    "query_logs",
    "Search and filter Pino JSON log files by level, time range, and content. Returns the MOST RECENT matching entries (up to `limit`) as formatted JSON, oldest-first.",
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
        .describe(
          "Maximum number of entries to return (default: 100). The newest matches are kept."
        ),
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
        const entry = parseLogLine(line);
        if (entry === null) continue;

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

        // Filter by search pattern (against the entry itself, so a pm2
        // timestamp prefix can never satisfy or defeat the match)
        if (searchRegex && !searchRegex.test(JSON.stringify(entry))) {
          continue;
        }

        // Add human-readable level name
        if (typeof entry.level === "number" && PINO_LEVEL_NAMES[entry.level]) {
          entry.levelName = PINO_LEVEL_NAMES[entry.level];
        }

        // Keep a sliding window of the newest `maxLines` matches. The prod log
        // spans months without rotation, so taking the first N from the top
        // returns stale startup entries rather than what just happened.
        matches.push(entry);
        if (matches.length > maxLines) matches.shift();
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
