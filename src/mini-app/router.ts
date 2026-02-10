import { Router } from "express";
import type BetterSqlite3 from "better-sqlite3";
import { validateInitData } from "./auth-middleware.js";
import { createSummaryRoute } from "./routes/summary.js";
import { createGroceryRoutes } from "./routes/grocery.js";

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

  // Grocery list endpoints
  const grocery = createGroceryRoutes(deps.sqlite);
  router.get("/grocery", grocery.getList);
  router.post("/grocery/toggle", grocery.toggleItem);
  router.post("/grocery/add", grocery.addItem);
  router.post("/grocery/complete", grocery.completeList);

  return router;
}
