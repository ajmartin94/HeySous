import type { Request, Response } from "express";
import type BetterSqlite3 from "better-sqlite3";
import { config } from "../../config.js";

/**
 * Check if the requesting user is an admin.
 * Returns true if admin (caller continues), or sends 403 and returns false.
 */
function requireAdmin(res: Response): boolean {
  const chatId = res.locals.chatId as string;
  if (config.adminUserIds.includes(String(chatId))) {
    return true;
  }
  res.status(403).json({ error: "Admin access required" });
  return false;
}

/**
 * Get the Unix timestamp (in seconds) for midnight today in the configured timezone.
 * Replicates the pattern from token-budget-guard.ts.
 */
function getMidnightEpochSeconds(timezone: string): number {
  const formatter = new Intl.DateTimeFormat("en-CA", {
    timeZone: timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
  const todayStr = formatter.format(new Date());

  const refDate = new Date(`${todayStr}T00:00:00Z`);

  const detailFormatter = new Intl.DateTimeFormat("en-US", {
    timeZone: timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  });

  const parts = detailFormatter.formatToParts(refDate);
  const getPart = (type: string): number =>
    Number(parts.find((p) => p.type === type)?.value ?? "0");

  const localAtRef = Date.UTC(
    getPart("year"),
    getPart("month") - 1,
    getPart("day"),
    getPart("hour") === 24 ? 0 : getPart("hour"),
    getPart("minute"),
    getPart("second"),
  );

  const offsetMs = localAtRef - refDate.getTime();
  const midnightUtcMs = refDate.getTime() - offsetMs;

  return Math.floor(midnightUtcMs / 1000);
}

/**
 * Compute the time boundary (Unix epoch seconds) for a given range.
 */
function getTimeBoundary(range: string): number {
  switch (range) {
    case "today":
      return getMidnightEpochSeconds(config.sessionTimezone);
    case "7d":
      return Math.floor(Date.now() / 1000) - 7 * 86400;
    case "30d":
      return Math.floor(Date.now() / 1000) - 30 * 86400;
    default:
      return getMidnightEpochSeconds(config.sessionTimezone);
  }
}

// -- Row types for SQLite query results --

interface MessageEventRow {
  id: number;
  created_at: number;
  chat_id: string;
  direction: string;
  text: string;
  display_name: string | null;
}

interface TokenEventRow {
  id: number;
  created_at: number;
  user_id: string;
  model: string;
  input_tokens: number;
  output_tokens: number;
  estimated_cost: number;
  display_name: string | null;
}

interface FeedbackEventRow {
  id: number;
  created_at: number;
  user_id: string;
  source: string;
  text: string;
  display_name: string | null;
}

interface CountRow {
  count: number;
}

interface DailyCountRow {
  day: string;
  count: number;
}

interface DailyCostRow {
  day: string;
  cost: number;
}

interface ModelCostRow {
  model: string;
  cost: number;
  tokens: number;
}

interface UserCostRow {
  user_id: string;
  cost: number;
  display_name: string | null;
}

interface FeedbackRow {
  id: number;
  user_id: string;
  text: string;
  source: string;
  created_at: number;
  display_name: string | null;
}

interface ActivityEvent {
  id: number;
  eventType: string;
  userId: string;
  userName: string;
  timestamp: number;
  details: Record<string, unknown>;
}

/**
 * Factory function for admin dashboard API route handlers.
 * Returns an object with four handlers: getActivity, getStats, getCosts, getFeedback.
 *
 * All endpoints are admin-gated via config.adminUserIds.
 * Follows the same factory pattern as createGroceryRoutes.
 */
export function createAdminRoutes(sqlite: BetterSqlite3.Database) {
  return {
    /**
     * GET /api/admin/activity
     * Unified activity feed from messages, token_usage, and app_feedback.
     * Query params: limit, offset, type (all|message|tool_call|feedback), userId (all|<id>)
     */
    getActivity(req: Request, res: Response) {
      if (!requireAdmin(res)) return;

      const limit = Math.min(Number(req.query.limit) || 50, 200);
      const offset = Number(req.query.offset) || 0;
      const typeFilter = (req.query.type as string) || "all";
      const userIdFilter = (req.query.userId as string) || "all";

      const events: ActivityEvent[] = [];

      // Build user filter clause
      const userClause = userIdFilter !== "all";

      // 1. Messages
      if (typeFilter === "all" || typeFilter === "message") {
        const userWhere = userClause ? " AND m.chat_id = ?" : "";
        const params: (string | number)[] = [];
        if (userClause) params.push(userIdFilter);

        const rows = sqlite
          .prepare(
            `SELECT m.id, m.created_at, m.chat_id, m.direction, m.text, u.display_name
             FROM messages m
             LEFT JOIN users u ON m.chat_id = u.telegram_id
             WHERE 1=1${userWhere}
             ORDER BY m.created_at DESC
             LIMIT ?`,
          )
          .all(...params, limit + offset) as MessageEventRow[];

        for (const row of rows) {
          events.push({
            id: row.id,
            eventType: "message",
            userId: row.chat_id,
            userName: row.display_name ?? "Unknown",
            timestamp: row.created_at,
            details: {
              direction: row.direction,
              text: row.text.length > 100 ? row.text.slice(0, 100) + "..." : row.text,
            },
          });
        }
      }

      // 2. Token usage / tool calls
      if (typeFilter === "all" || typeFilter === "tool_call") {
        const userWhere = userClause ? " AND tu.user_id = ?" : "";
        const params: (string | number)[] = [];
        if (userClause) params.push(userIdFilter);

        const rows = sqlite
          .prepare(
            `SELECT tu.id, tu.created_at, tu.user_id, tu.model, tu.input_tokens, tu.output_tokens, tu.estimated_cost, u.display_name
             FROM token_usage tu
             LEFT JOIN users u ON tu.user_id = u.telegram_id
             WHERE 1=1${userWhere}
             ORDER BY tu.created_at DESC
             LIMIT ?`,
          )
          .all(...params, limit + offset) as TokenEventRow[];

        for (const row of rows) {
          events.push({
            id: row.id,
            eventType: "tool_call",
            userId: row.user_id,
            userName: row.display_name ?? "Unknown",
            timestamp: row.created_at,
            details: {
              model: row.model,
              inputTokens: row.input_tokens,
              outputTokens: row.output_tokens,
              cost: row.estimated_cost,
            },
          });
        }
      }

      // 3. App feedback
      if (typeFilter === "all" || typeFilter === "feedback") {
        const userWhere = userClause ? " AND af.user_id = ?" : "";
        const params: (string | number)[] = [];
        if (userClause) params.push(userIdFilter);

        const rows = sqlite
          .prepare(
            `SELECT af.id, af.created_at, af.user_id, af.source, af.text, u.display_name
             FROM app_feedback af
             LEFT JOIN users u ON af.user_id = u.telegram_id
             WHERE 1=1${userWhere}
             ORDER BY af.created_at DESC
             LIMIT ?`,
          )
          .all(...params, limit + offset) as FeedbackEventRow[];

        for (const row of rows) {
          events.push({
            id: row.id,
            eventType: "feedback",
            userId: row.user_id,
            userName: row.display_name ?? "Unknown",
            timestamp: row.created_at,
            details: {
              source: row.source,
              text: row.text.length > 100 ? row.text.slice(0, 100) + "..." : row.text,
            },
          });
        }
      }

      // Sort all events by timestamp descending, then paginate
      events.sort((a, b) => b.timestamp - a.timestamp);
      const paginated = events.slice(offset, offset + limit);
      const hasMore = events.length > offset + limit;

      res.json({ events: paginated, hasMore });
    },

    /**
     * GET /api/admin/stats
     * Usage statistics with configurable time ranges.
     * Query params: range (today|7d|30d)
     */
    getStats(req: Request, res: Response) {
      if (!requireAdmin(res)) return;

      const range = (req.query.range as string) || "today";
      const boundary = getTimeBoundary(range);

      // Total inbound messages in range
      const messagesCount = (
        sqlite
          .prepare(
            `SELECT COUNT(*) as count FROM messages
             WHERE direction = 'in' AND created_at >= ?`,
          )
          .get(boundary) as CountRow
      ).count;

      // Active users in range
      const activeUsers = (
        sqlite
          .prepare(
            `SELECT COUNT(DISTINCT chat_id) as count FROM messages
             WHERE direction = 'in' AND created_at >= ?`,
          )
          .get(boundary) as CountRow
      ).count;

      // Total API calls in range
      const apiCalls = (
        sqlite
          .prepare(
            `SELECT COUNT(*) as count FROM token_usage WHERE created_at >= ?`,
          )
          .get(boundary) as CountRow
      ).count;

      // Total users (all time)
      const totalUsers = (
        sqlite.prepare(`SELECT COUNT(*) as count FROM users`).get() as CountRow
      ).count;

      // Total recipes (all time)
      const totalRecipes = (
        sqlite
          .prepare(
            `SELECT COUNT(*) as count FROM knowledge_items ki
             JOIN knowledge_tags kt ON ki.id = kt.knowledge_item_id
             WHERE kt.tag = 'recipe'`,
          )
          .get() as CountRow
      ).count;

      // Daily message breakdown
      const daily = sqlite
        .prepare(
          `SELECT date(created_at, 'unixepoch') as day, COUNT(*) as count
           FROM messages WHERE direction = 'in' AND created_at >= ?
           GROUP BY day ORDER BY day`,
        )
        .all(boundary) as DailyCountRow[];

      res.json({
        summary: {
          messagesCount,
          activeUsers,
          apiCalls,
          totalUsers,
          totalRecipes,
        },
        daily: daily.map((d) => ({ day: d.day, messageCount: d.count })),
      });
    },

    /**
     * GET /api/admin/costs
     * Cost trends with per-model and per-user breakdown.
     * Query params: range (today|7d|30d)
     */
    getCosts(req: Request, res: Response) {
      if (!requireAdmin(res)) return;

      const range = (req.query.range as string) || "today";
      const boundary = getTimeBoundary(range);

      // Total cost in range
      const totalCostRow = sqlite
        .prepare(
          `SELECT COALESCE(SUM(estimated_cost), 0) as cost FROM token_usage
           WHERE created_at >= ?`,
        )
        .get(boundary) as { cost: number };

      // Per-model breakdown
      const byModel = sqlite
        .prepare(
          `SELECT model, SUM(estimated_cost) as cost, SUM(input_tokens + output_tokens) as tokens
           FROM token_usage WHERE created_at >= ?
           GROUP BY model ORDER BY cost DESC`,
        )
        .all(boundary) as ModelCostRow[];

      // Per-user breakdown
      const byUser = sqlite
        .prepare(
          `SELECT tu.user_id, SUM(tu.estimated_cost) as cost, u.display_name
           FROM token_usage tu
           LEFT JOIN users u ON tu.user_id = u.telegram_id
           WHERE tu.created_at >= ?
           GROUP BY tu.user_id ORDER BY cost DESC`,
        )
        .all(boundary) as UserCostRow[];

      // Daily cost trend
      const daily = sqlite
        .prepare(
          `SELECT date(created_at, 'unixepoch') as day, SUM(estimated_cost) as cost
           FROM token_usage WHERE created_at >= ?
           GROUP BY day ORDER BY day`,
        )
        .all(boundary) as DailyCostRow[];

      res.json({
        totalCost: totalCostRow.cost,
        dailyBudgetUsd: config.dailyCostBudgetUsd,
        byModel: byModel.map((m) => ({
          model: m.model,
          cost: m.cost,
          tokens: m.tokens,
        })),
        byUser: byUser.map((u) => ({
          userId: u.user_id,
          userName: u.display_name ?? "Unknown",
          cost: u.cost,
        })),
        daily: daily.map((d) => ({ day: d.day, cost: d.cost })),
      });
    },

    /**
     * GET /api/admin/feedback
     * Paginated app_feedback entries with user names.
     * Query params: limit, offset
     */
    getFeedback(req: Request, res: Response) {
      if (!requireAdmin(res)) return;

      const limit = Math.min(Number(req.query.limit) || 50, 200);
      const offset = Number(req.query.offset) || 0;

      // Total count
      const total = (
        sqlite
          .prepare(`SELECT COUNT(*) as count FROM app_feedback`)
          .get() as CountRow
      ).count;

      // Recent trend: last 7 days vs previous 7 days
      const nowEpoch = Math.floor(Date.now() / 1000);
      const sevenDaysAgo = nowEpoch - 7 * 86400;
      const fourteenDaysAgo = nowEpoch - 14 * 86400;

      const recentCount = (
        sqlite
          .prepare(
            `SELECT COUNT(*) as count FROM app_feedback WHERE created_at >= ?`,
          )
          .get(sevenDaysAgo) as CountRow
      ).count;

      const previousCount = (
        sqlite
          .prepare(
            `SELECT COUNT(*) as count FROM app_feedback
             WHERE created_at >= ? AND created_at < ?`,
          )
          .get(fourteenDaysAgo, sevenDaysAgo) as CountRow
      ).count;

      // Paginated entries
      const entries = sqlite
        .prepare(
          `SELECT af.id, af.user_id, af.text, af.source, af.created_at, u.display_name
           FROM app_feedback af
           LEFT JOIN users u ON af.user_id = u.telegram_id
           ORDER BY af.created_at DESC
           LIMIT ? OFFSET ?`,
        )
        .all(limit, offset) as FeedbackRow[];

      const hasMore = offset + limit < total;

      res.json({
        total,
        recentCount,
        previousCount,
        entries: entries.map((e) => ({
          id: e.id,
          userId: e.user_id,
          userName: e.display_name ?? "Unknown",
          text: e.text,
          source: e.source,
          timestamp: e.created_at,
        })),
        hasMore,
      });
    },
  };
}
