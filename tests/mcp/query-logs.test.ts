import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterAll, describe, expect, it } from "vitest";
import { parseLogLine, registerLogTools } from "../../src/mcp/tools/query-logs.js";

/**
 * Verbatim head of the production log (~/.pm2/logs/heysous-out.log), captured
 * 2026-07-25. The dotenv banner is a real non-JSON line that must stay skipped.
 */
const PROD_LOG_HEAD = [
  "2026-02-12 04:24:50: [dotenv@17.2.4] injecting env (10) from .env -- tip: \u{1F4E1} add observability to secrets: https://dotenvx.com/ops",
  '2026-02-12 04:24:51: {"level":30,"time":1770870291448,"pid":7369,"hostname":"ubuntu-s-1vcpu-1gb-nyc3-01","dbFile":"data/heysous.db","msg":"Database initialized"}',
  '2026-02-12 04:24:53: {"level":30,"time":1770870293565,"pid":7369,"hostname":"ubuntu-s-1vcpu-1gb-nyc3-01","botUsername":"heysous_bot","msg":"Bot info fetched"}',
].join("\n");

/**
 * Prod runs under pm2 with `log_date_format: 'YYYY-MM-DD HH:mm:ss'`
 * (docs/DEPLOYMENT.md), which prefixes every stdout line with a formatted
 * timestamp before the Pino JSON. A strict JSON.parse skips all of them,
 * making every prod log query return zero results.
 */
describe("parseLogLine", () => {
  const pinoJson =
    '{"level":50,"time":1784000283000,"pid":1234,"msg":"Stream error, partial text preserved"}';

  it("parses a raw Pino JSON line", () => {
    const entry = parseLogLine(pinoJson);
    expect(entry).toMatchObject({ level: 50, time: 1784000283000 });
  });

  it("parses a line carrying the pm2 date prefix", () => {
    const entry = parseLogLine(`2026-07-25 00:58:03: ${pinoJson}`);
    expect(entry).toMatchObject({
      level: 50,
      msg: "Stream error, partial text preserved",
    });
  });

  it("parses regardless of the configured pm2 date format", () => {
    expect(parseLogLine(`07/25/2026: ${pinoJson}`)).toMatchObject({ level: 50 });
    expect(parseLogLine(`2026-07-25T00:58:03.123Z ${pinoJson}`)).toMatchObject({
      level: 50,
    });
  });

  it("keeps nested objects intact when a prefix is stripped", () => {
    const nested =
      '{"level":30,"err":{"stack":"at foo {bar}"},"msg":"done"}';
    expect(parseLogLine(`2026-07-25 00:58:03: ${nested}`)).toMatchObject({
      err: { stack: "at foo {bar}" },
      msg: "done",
    });
  });

  it("returns null for blank lines", () => {
    expect(parseLogLine("")).toBeNull();
    expect(parseLogLine("   \t ")).toBeNull();
  });

  it("returns null for non-JSON console output", () => {
    expect(parseLogLine("PM2 log management")).toBeNull();
    expect(
      parseLogLine("    at processTicksAndRejections (node:internal/process)"),
    ).toBeNull();
  });

  it("returns null for JSON that is not an object", () => {
    expect(parseLogLine("123")).toBeNull();
    expect(parseLogLine('"a string"')).toBeNull();
    expect(parseLogLine("[1,2,3]")).toBeNull();
    expect(parseLogLine("null")).toBeNull();
  });

  it("returns null when a prefixed payload is still malformed", () => {
    expect(parseLogLine('2026-07-25 00:58:03: {"level":50,')).toBeNull();
  });

  it("handles the real production log format", () => {
    const [banner, dbInit, botInfo] = PROD_LOG_HEAD.split("\n");
    expect(parseLogLine(banner)).toBeNull();
    expect(parseLogLine(dbInit)).toMatchObject({ msg: "Database initialized" });
    expect(parseLogLine(botInfo)).toMatchObject({ msg: "Bot info fetched" });
  });
});

/**
 * End-to-end coverage of the registered query_logs handler, reading a real
 * file. Guards the whole path -- readline, prefix-tolerant parse, filters --
 * not just the parser in isolation.
 */
describe("query_logs handler", () => {
  const dir = mkdtempSync(join(tmpdir(), "heysous-logs-"));
  const logFile = join(dir, "heysous-out.log");
  writeFileSync(logFile, PROD_LOG_HEAD + "\n");

  afterAll(() => rmSync(dir, { recursive: true, force: true }));

  /** Capture the handler registered by registerLogTools. */
  function getHandler() {
    let handler:
      | ((args: Record<string, unknown>) => Promise<{ content: { text: string }[] }>)
      | undefined;
    registerLogTools({
      tool: (_name: string, _desc: string, _schema: unknown, fn: never) => {
        handler = fn;
      },
    } as never);
    if (!handler) throw new Error("query_logs handler was not registered");
    return handler;
  }

  it("returns prefixed entries instead of reporting none found", async () => {
    const result = await getHandler()({ log_file: logFile, limit: 100 });
    const entries = JSON.parse(result.content[0].text) as { msg: string }[];

    expect(entries).toHaveLength(2); // banner skipped
    expect(entries.map((e) => e.msg)).toEqual([
      "Database initialized",
      "Bot info fetched",
    ]);
    expect(entries[0]).toMatchObject({ levelName: "info" });
  });

  it("matches the search pattern against entry content, not the prefix", async () => {
    const handler = getHandler();

    const hit = await handler({ log_file: logFile, search: "Bot info", limit: 100 });
    expect(JSON.parse(hit.content[0].text)).toHaveLength(1);

    // The pm2 prefix carries a date; it must not be searchable content.
    const miss = await handler({ log_file: logFile, search: "04:24:53", limit: 100 });
    expect(miss.content[0].text).toBe("No matching log entries found.");
  });

  it("filters by level and time range", async () => {
    const handler = getHandler();

    const warns = await handler({ log_file: logFile, level: "warn", limit: 100 });
    expect(warns.content[0].text).toBe("No matching log entries found.");

    const recent = await handler({
      log_file: logFile,
      since: "2026-02-12T04:24:52Z",
      limit: 100,
    });
    const entries = JSON.parse(recent.content[0].text) as { msg: string }[];
    expect(entries.map((e) => e.msg)).toEqual(["Bot info fetched"]);
  });

  it("returns the MOST RECENT entries when more match than the limit", async () => {
    // The prod log spans months without rotation, so first-N-from-the-top
    // hands back startup logs from February instead of anything useful.
    const many = join(dir, "many.log");
    writeFileSync(
      many,
      Array.from(
        { length: 10 },
        (_, i) =>
          `2026-07-25 00:0${i}:00: {"level":30,"time":${1784000000000 + i * 1000},"msg":"entry-${i}"}`,
      ).join("\n") + "\n",
    );

    const result = await getHandler()({ log_file: many, limit: 3 });
    const entries = JSON.parse(result.content[0].text) as { msg: string }[];

    // Newest three, still in chronological order.
    expect(entries.map((e) => e.msg)).toEqual(["entry-7", "entry-8", "entry-9"]);
  });

  it("reports a missing file distinctly from an empty result", async () => {
    const result = await getHandler()({
      log_file: join(dir, "nope.log"),
      limit: 100,
    });
    expect(result.content[0].text).toContain("Log file not found");
  });
});
