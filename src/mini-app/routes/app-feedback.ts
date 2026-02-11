import type { Request, Response } from "express";
import type BetterSqlite3 from "better-sqlite3";
import { createAppFeedbackRepository } from "../../app-feedback/repository.js";

/**
 * Factory function for app feedback API route handlers.
 * Returns an object with a single handler: submit.
 *
 * Follows the same factory pattern as createGroceryRoutes (grocery.ts).
 * All handlers expect res.locals.householdId and res.locals.chatId
 * to be set by auth middleware.
 */
export function createAppFeedbackRoutes(sqlite: BetterSqlite3.Database) {
  const repository = createAppFeedbackRepository(sqlite);

  return {
    /**
     * POST /api/feedback
     * Accepts { text } body, validates non-empty, saves to app_feedback
     * with source "mini-app", returns { ok: true }.
     */
    submit(req: Request, res: Response) {
      const householdId = res.locals.householdId as string;
      const userId = res.locals.chatId as string;
      const { text } = req.body as { text?: string };

      if (!text || !text.trim()) {
        res.status(400).json({ error: "Feedback text is required" });
        return;
      }

      repository.saveFeedback({
        householdId,
        userId,
        text: text.trim(),
        source: "mini-app",
      });

      res.json({ ok: true });
    },
  };
}
