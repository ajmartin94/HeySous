import { Router } from "express";
import type BetterSqlite3 from "better-sqlite3";
import { validateInitData } from "./auth-middleware.js";
import { createSummaryRoute } from "./routes/summary.js";

/**
 * Dependencies for the API router.
 * Receives the raw SQLite instance for direct query access,
 * consistent with the grocery repository pattern.
 */
interface ApiRouterDeps {
  sqlite: BetterSqlite3.Database;
}

/**
 * Factory function that creates an Express Router for /api/* routes.
 * All routes are protected by initData HMAC-SHA256 validation.
 *
 * Follows the project's factory function pattern
 * (createGroceryRepository, createServer, etc.).
 */
export function createApiRouter(deps: ApiRouterDeps): Router {
  const router = Router();

  // All API routes require valid Telegram initData
  router.use(validateInitData);

  // Hub dashboard summary
  router.get("/summary", createSummaryRoute(deps.sqlite));

  return router;
}
