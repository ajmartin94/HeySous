import express, { type Express } from "express";
import type BetterSqlite3 from "better-sqlite3";
import { createApiRouter } from "../../../src/mini-app/router.js";

/**
 * Build the same Express wiring `server.ts` uses for the API router:
 * JSON body parsing, then `/api/*` mounted behind initData auth.
 * (We don't import `createServer` itself because it also wires up the
 * Telegram webhook callback and static Mini App assets, which are out of
 * scope here and would drag in bot/grammy setup.)
 */
export function createTestApp(
  sqlite: BetterSqlite3.Database,
  deps?: { regenerateReminders?: (householdId: string) => void },
): Express {
  const app = express();
  app.use(express.json());
  app.use("/api", createApiRouter({ sqlite, ...deps }));
  return app;
}

export interface RunningServer {
  baseUrl: string;
  close: () => Promise<void>;
}

/** Start an Express app on an ephemeral port for real HTTP request tests. */
export async function startServer(app: Express): Promise<RunningServer> {
  const server = app.listen(0);
  await new Promise<void>((resolve) => server.once("listening", resolve));
  const address = server.address();
  const port = typeof address === "object" && address ? address.port : 0;

  return {
    baseUrl: `http://127.0.0.1:${port}`,
    close: () =>
      new Promise<void>((resolve, reject) => {
        server.close((err) => (err ? reject(err) : resolve()));
      }),
  };
}
