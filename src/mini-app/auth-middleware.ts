import { validate, parse } from "@tma.js/init-data-node";
import type { Request, Response, NextFunction } from "express";
import { config } from "../config.js";

/**
 * Express middleware that validates Telegram Mini App initData.
 * Uses HMAC-SHA256 verification via @tma.js/init-data-node.
 *
 * On success, sets res.locals.chatId to the user's Telegram ID (as string).
 * On failure, returns 401 JSON error.
 */
export function validateInitData(
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

    // Extract user ID as chatId for repository queries
    const userId = parsed.user?.id;
    if (!userId) {
      res.status(401).json({ error: "No user in initData" });
      return;
    }

    res.locals.chatId = String(userId);
    next();
  } catch {
    res.status(401).json({ error: "Invalid initData" });
    return;
  }
}
