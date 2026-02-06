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

export const config: Config = {
  botToken,
  botMode,
  port: Number(process.env.PORT) || 3000,
  webhookUrl,
  dbFileName: process.env.DB_FILE_NAME ?? "data/heysous.db",
  logLevel: process.env.LOG_LEVEL ?? "info",
  isDev: process.env.NODE_ENV !== "production",
};
