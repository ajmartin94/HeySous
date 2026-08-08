import { config as dotenvConfig } from "dotenv";

dotenvConfig();

interface Config {
  botToken: string;
  botMode: "polling" | "webhook";
  port: number;
  webhookUrl: string;
  dbFileName: string;
  logLevel: string;
  isDev: boolean;
  anthropicApiKey: string;
  adminUserIds: string[];
  adminUserId: string;
  miniAppUrl: string;
  logToolInputs: boolean;
  dailyCostBudgetUsd: number;
  sessionTimezone: string;
}

const botToken = process.env.BOT_TOKEN;
if (!botToken) {
  throw new Error(
    "BOT_TOKEN is required. Set it in .env or as an environment variable.\n" +
      "Create a bot via @BotFather on Telegram -> /newbot -> copy token"
  );
}

const botMode = (process.env.BOT_MODE ?? "polling") as "polling" | "webhook";
if (botMode !== "polling" && botMode !== "webhook") {
  throw new Error(`BOT_MODE must be "polling" or "webhook", got "${botMode}"`);
}

const webhookUrl = process.env.WEBHOOK_URL ?? "";
if (botMode === "webhook" && !webhookUrl) {
  throw new Error(
    "WEBHOOK_URL is required when BOT_MODE is set to 'webhook'"
  );
}

const anthropicApiKey = process.env.ANTHROPIC_API_KEY;
if (!anthropicApiKey) {
  throw new Error(
    "ANTHROPIC_API_KEY is required. Set it in .env or as an environment variable.\n" +
      "Get an API key at console.anthropic.com -> API Keys -> Create Key"
  );
}

/**
 * Sous's model settings.
 *
 * Deliberately NOT environment variables. These three move together -- which
 * `effort` values are legal depends on the model, and `maxTokens` has to suit
 * whether that model thinks by default -- so splitting them across .env invites
 * a mismatch that only shows up in production. Changing the model is a code
 * change: reviewed, version-controlled, and visible in git history.
 *
 * A bare .env edit is how the Haiku 4.5 -> Sonnet 5 switch silently turned
 * thinking on and started truncating replies, with nothing in the repo to show
 * what had changed.
 *
 * - model:     Sonnet 5 and later think by default when no `thinking` param is
 *              sent. Check that before switching.
 * - maxTokens: Covers thinking AND reply text together, so a tight ceiling gets
 *              spent on reasoning and truncates the answer. This is a cap, not
 *              a target -- raising it does not raise typical spend.
 * - effort:    Optional. Leave undefined unless the model supports it; the
 *              parameter errors on Haiku 4.5 and Sonnet 4.5.
 *
 * After changing `model`, add a MODEL_PRICING entry for it in src/ai/types.ts
 * or cost tracking silently falls back to the most expensive rates.
 */
export const AI = {
  model: "claude-sonnet-5",
  maxTokens: 16_000,
  effort: undefined as "low" | "medium" | "high" | "max" | undefined,
} as const;

export const config: Config = {
  botToken,
  botMode,
  port: Number(process.env.PORT) || 3000,
  webhookUrl,
  dbFileName: process.env.DB_FILE_NAME ?? "data/heysous.db",
  logLevel: process.env.LOG_LEVEL ?? "info",
  isDev: process.env.NODE_ENV !== "production",
  anthropicApiKey,
  adminUserIds: (process.env.ADMIN_USER_IDS ?? "").split(",").filter(Boolean),
  adminUserId: (process.env.ADMIN_USER_IDS ?? "").split(",").filter(Boolean)[0] ?? "",
  miniAppUrl: process.env.MINI_APP_URL ?? "",
  logToolInputs: process.env.LOG_TOOL_INPUTS === "true",
  // Per-household daily spend ceiling in USD. Stays an env var because it is a
  // genuine per-environment operational dial (dev vs prod), unlike the model.
  dailyCostBudgetUsd: Number(process.env.DAILY_COST_BUDGET_USD) || 5,
  sessionTimezone: process.env.SESSION_TIMEZONE ?? "America/New_York",
};
