import { validate, parse } from "@tma.js/init-data-node";
import type { Request, Response, NextFunction } from "express";
import type BetterSqlite3 from "better-sqlite3";
import { config } from "../config.js";
import { getUserByTelegramId } from "../users/repository.js";

/**
 * Factory function that creates Express middleware to validate Telegram Mini App initData.
 * Uses HMAC-SHA256 verification via @tma.js/init-data-node.
 *
 * On success, resolves the user's householdId from the database and sets
 * res.locals.householdId for downstream route handlers.
 * On failure, returns 401 JSON error.
 */
export function createInitDataValidator(sqlite: BetterSqlite3.Database) {
  return function validateInitData(
    req: Request,
    res: Response,
    next: NextFunction,
  ): void {
    const initData = req.headers["x-init-data"] as string | undefined;

    if (!initData) {
      res.status(401).json({ error: "Missing initData" });
      return;
    }

    try {
      // validate() throws if invalid; expiresIn in seconds (1 hour)
      validate(initData, config.botToken, { expiresIn: 3600 });
      const parsed = parse(initData);

      // Extract user ID
      const userId = parsed.user?.id;
      if (!userId) {
        res.status(401).json({ error: "No user in initData" });
        return;
      }

      // Look up user to resolve householdId
      const user = getUserByTelegramId(sqlite, String(userId));
      if (!user) {
        res.status(401).json({ error: "User not registered" });
        return;
      }

      res.locals.householdId = user.householdId;
      res.locals.chatId = String(userId); // keep for backward compat if needed
      next();
    } catch {
      res.status(401).json({ error: "Invalid initData" });
      return;
    }
  };
}
