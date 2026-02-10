/**
 * Grocery Command and Callback Handlers
 *
 * Two factory functions:
 * 1. createGroceryHandler -- /grocery command (instant display, no Claude call)
 * 2. createGroceryCallbackHandler -- inline button taps for item check-off
 *
 * Follows the same factory pattern as createPlanHandler, createCostsHandler, etc.
 */

import { Composer, GrammyError } from "grammy";
import type BetterSqlite3 from "better-sqlite3";
import type { BotContext } from "../context.js";
import { config } from "../../config.js";
import { createGroceryRepository } from "../../grocery/repository.js";
import { formatGroceryList } from "../../grocery/formatter.js";
import {
  buildGroceryKeyboard,
  parseGroceryCallback,
} from "../../grocery/buttons.js";

/**
 * Create a /grocery command handler with SQLite access.
 *
 * Displays the active grocery list instantly (no Claude API call).
 * If no active list exists, shows a helpful hint to generate one.
 */
export function createGroceryHandler(
  sqlite: BetterSqlite3.Database,
): Composer<BotContext> {
  const groceryRepository = createGroceryRepository(sqlite);
  const handler = new Composer<BotContext>();

  handler.command("grocery", async (ctx) => {
    const chatId = String(ctx.chat.id);
    const activeList = groceryRepository.getActiveList(chatId);

    if (!activeList) {
      await ctx.reply(
        "No grocery list yet! Just say something like \"make my grocery list\" and I'll generate one from your meal plan.",
      );
      return;
    }

    const items = groceryRepository.getListItems(activeList.id);
    const formattedList = formatGroceryList(items);
    const keyboard = buildGroceryKeyboard(items);

    // Add "View List" web_app button to open the Mini App grocery view
    if (config.miniAppUrl) {
      keyboard.row().webApp("View List", config.miniAppUrl + "/grocery");
    }

    const sentMessage = await ctx.reply(formattedList, {
      reply_markup: keyboard,
      parse_mode: "HTML",
    });

    // Store the sent message ID so the processor can edit it later
    groceryRepository.setMessageId(activeList.id, sentMessage.message_id);
  });

  return handler;
}

/**
 * Create a callback query handler for grocery inline buttons.
 *
 * Handles "callback_query:data" events and checks if the callback
 * is grocery-related (g:t:{id} format). If not, passes to next().
 */
export function createGroceryCallbackHandler(
  sqlite: BetterSqlite3.Database,
): Composer<BotContext> {
  const groceryRepository = createGroceryRepository(sqlite);
  const handler = new Composer<BotContext>();

  handler.on("callback_query:data", async (ctx, next) => {
    const parsed = parseGroceryCallback(ctx.callbackQuery.data);

    // Not a grocery callback -- pass to other handlers
    if (!parsed) {
      await next();
      return;
    }

    if (parsed.action === "t") {
      // Immediately clear the loading spinner
      await ctx.answerCallbackQuery();

      // Toggle the item's checked state
      groceryRepository.toggleItem(parsed.itemId);

      // Look up which list this item belongs to
      const listId = groceryRepository.getListIdForItem(parsed.itemId);
      if (!listId) return; // Item was deleted

      // Rebuild the message and keyboard
      const items = groceryRepository.getListItems(listId);
      const formattedMessage = formatGroceryList(items);
      const keyboard = buildGroceryKeyboard(items);

      // Preserve "View List" web_app button on keyboard rebuild
      if (config.miniAppUrl) {
        keyboard.row().webApp("View List", config.miniAppUrl + "/grocery");
      }

      try {
        await ctx.editMessageText(formattedMessage, {
          parse_mode: "HTML",
          reply_markup: keyboard,
        });
      } catch (error) {
        // Silently ignore "message is not modified" errors (expected with rapid taps)
        if (
          error instanceof GrammyError &&
          error.description.includes("message is not modified")
        ) {
          return;
        }
        throw error;
      }
    }
  });

  return handler;
}
