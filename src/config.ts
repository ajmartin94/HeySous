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
  anthropicModel: string;
  adminUserIds: string[];
  adminUserId: string;
  miniAppUrl: string;
  logToolInputs: boolean;
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

export const config: Config = {
  botToken,
  botMode,
  port: Number(process.env.PORT) || 3000,
  webhookUrl,
  dbFileName: process.env.DB_FILE_NAME ?? "data/heysous.db",
  logLevel: process.env.LOG_LEVEL ?? "info",
  isDev: process.env.NODE_ENV !== "production",
  anthropicApiKey,
  anthropicModel: process.env.ANTHROPIC_MODEL ?? "claude-haiku-4-5-20251001",
  adminUserIds: (process.env.ADMIN_USER_IDS ?? "").split(",").filter(Boolean),
  adminUserId: (process.env.ADMIN_USER_IDS ?? "").split(",").filter(Boolean)[0] ?? "",
  miniAppUrl: process.env.MINI_APP_URL ?? "",
  logToolInputs: process.env.LOG_TOOL_INPUTS === "true",
};
