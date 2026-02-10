/**
 * BotFather Menu Button Setup
 *
 * Configures the Telegram menu button to open the Mini App hub.
 * Called once on startup -- idempotent (setChatMenuButton replaces any existing setting).
 */

import type { Bot } from "grammy";
import type { BotContext } from "../bot/context.js";
import { logger } from "../logger.js";

/**
 * Set the BotFather menu button to open the Mini App hub.
 *
 * When miniAppUrl is configured, sets the menu button to type "web_app"
 * which opens the Mini App hub page in a Telegram WebView.
 *
 * Gracefully no-ops when:
 * - miniAppUrl is empty (dev/polling mode without tunnel)
 * - setChatMenuButton fails (may happen in polling mode without webhook)
 */
export async function setupMenuButton(
  bot: Bot<BotContext>,
  miniAppUrl: string,
): Promise<void> {
  if (!miniAppUrl) {
    logger.warn("MINI_APP_URL not set -- skipping menu button setup");
    return;
  }

  try {
    await bot.api.setChatMenuButton({
      menu_button: {
        type: "web_app",
        text: "Open App",
        web_app: { url: miniAppUrl },
      },
    });
    logger.info({ url: miniAppUrl }, "BotFather menu button configured");
  } catch (error) {
    logger.error(
      { error, url: miniAppUrl },
      "Failed to set menu button -- continuing without it",
    );
  }
}
