import type { Request, Response } from "express";
import type BetterSqlite3 from "better-sqlite3";
import { getUserByTelegramId } from "../../users/repository.js";

/**
 * Factory function for the /me endpoint.
 * Returns the authenticated user's role for client-side conditional rendering.
 */
export function createMeRoute(sqlite: BetterSqlite3.Database) {
  return (_req: Request, res: Response) => {
    const chatId = res.locals.chatId as string;
    const user = getUserByTelegramId(sqlite, chatId);
    res.json({ role: user?.role ?? "member" });
  };
}
