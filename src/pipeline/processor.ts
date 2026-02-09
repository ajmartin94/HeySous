/**
 * Pipeline Processor
 *
 * Orchestrates the full knowledge-augmented message processing pipeline:
 * save incoming message -> load conversation history -> build context ->
 * typing indicator -> Claude call with tools + retry -> 30s timeout messaging ->
 * formatted response delivery -> save outgoing message ->
 * token usage logged to database and pino.
 *
 * The processor NEVER throws -- it's called from the debounce queue's
 * fire-and-forget pattern. All errors are caught and handled with
 * in-character error messages to the user.
 */

import Anthropic from "@anthropic-ai/sdk";
import { eq, asc } from "drizzle-orm";
import type BetterSqlite3 from "better-sqlite3";
import type { PendingBatch } from "./message-queue.js";
import type { BotContext } from "../bot/context.js";
import type { ClaudeResponse } from "../ai/types.js";
import { calculateCost } from "../ai/claude-client.js";
import { sendFormattedMessage } from "../telegram/sender.js";
import { messages, tokenUsage } from "../db/schema.js";
import { createToolHandler } from "../ai/tool-handler.js";
import { KNOWLEDGE_TOOLS, PLAN_TOOLS, GROCERY_TOOLS, REMINDER_TOOLS, FEEDBACK_TOOLS } from "../ai/tools.js";
import { buildConversationContext } from "../conversation/context-builder.js";
import type { ConversationTurn } from "../conversation/types.js";
import type { createRetrievalService } from "../knowledge/retrieval.js";
import { createKnowledgeRepository } from "../knowledge/repository.js";
import type { createPlanRepository } from "../planning/repository.js";
import type { createGroceryRepository } from "../grocery/repository.js";
import type { createReminderRepository } from "../reminders/repository.js";
import { autoMarkCookedMeals, getCookingHistory } from "../planning/history.js";
import { buildPlanContext } from "../planning/context.js";
import { buildGroceryContext } from "../grocery/context.js";
import { buildReminderContext } from "../reminders/context.js";
import { buildFeedbackContext } from "../feedback/context.js";
import { formatGroceryList } from "../grocery/formatter.js";
import { buildGroceryKeyboard } from "../grocery/buttons.js";
import { getPreferenceSummaries } from "../knowledge/preferences.js";
import { buildSystemPrompt } from "../ai/system-prompt.js";
import type { DrizzleDatabase } from "../db/index.js";
import type { Logger } from "pino";

const TIMEOUT_WARNING_MS = 30_000;
const IN_CHARACTER_ERROR =
  "Sorry, I'm having trouble thinking right now. Try again in a moment!";

/** Default conversation history token budget. */
const CONVERSATION_TOKEN_BUDGET = 2000;

interface ClaudeClient {
  sendMessage(userMessages: string[], systemPrompt?: string): Promise<ClaudeResponse>;
  sendMessageWithTools(
    messages: Anthropic.MessageParam[],
    tools: Anthropic.Tool[],
    onToolCall: (name: string, input: Record<string, unknown>) => string,
    maxIterations?: number,
    systemPrompt?: string,
  ): Promise<ClaudeResponse>;
}

interface ProcessorDeps {
  claudeClient: ClaudeClient;
  db: DrizzleDatabase;
  logger: Logger;
  retrievalService: ReturnType<typeof createRetrievalService>;
  knowledgeRepository: ReturnType<typeof createKnowledgeRepository>;
  planRepository: ReturnType<typeof createPlanRepository>;
  sqlite: BetterSqlite3.Database;
  groceryRepository?: ReturnType<typeof createGroceryRepository>;
  reminderRepository?: ReturnType<typeof createReminderRepository>;
  generateRemindersFn?: (chatId: string) => void;
  feedbackRepository?: ReturnType<typeof import("../feedback/repository.js").createFeedbackRepository>;
}

/**
 * Create a pipeline processor that handles batched messages end-to-end.
 *
 * Returns a processBatch function suitable for use as a ProcessFn callback
 * from the MessageQueue.
 */
export function createProcessor(deps: ProcessorDeps) {
  const { claudeClient, db, logger: log, retrievalService, knowledgeRepository, planRepository } = deps;

  return async function processBatch(batch: PendingBatch): Promise<void> {
    const ctx = batch.ctx as BotContext;
    const { chatId, userId } = batch;

    try {
      // a. Start typing indicator (non-blocking)
      try {
        await ctx.replyWithChatAction("typing");
      } catch {
        // Typing indicator failure should not block processing
      }

      // b. Build user message from batch
      const userText = batch.messages.map((m) => m.text).join("\n\n");

      // c. Save incoming user message to messages table BEFORE Claude call
      db.insert(messages)
        .values({
          chatId,
          userId,
          text: userText,
          direction: "in" as const,
        })
        .run();

      // d. Load conversation history from messages table
      const rows = db
        .select()
        .from(messages)
        .where(eq(messages.chatId, chatId))
        .orderBy(asc(messages.createdAt))
        .all();

      const turns: ConversationTurn[] = rows.map((row) => ({
        id: row.id,
        chatId: row.chatId,
        userId: row.userId,
        text: row.text,
        direction: row.direction as "in" | "out",
        createdAt: row.createdAt,
      }));

      // e. Build conversation context (sliding window within token budget)
      const priorMessages = buildConversationContext(
        turns,
        CONVERSATION_TOKEN_BUDGET,
      );

      // f. Construct full messages array: prior history + current user message
      const fullMessages: Anthropic.MessageParam[] = [
        ...priorMessages,
        { role: "user" as const, content: userText },
      ];

      // g. Create tool handler for knowledge retrieval, write ops, plan tools, grocery tools, and reminder tools
      const toolHandler = createToolHandler({
        retrievalService,
        knowledgeRepository,
        db,
        chatId,
        planRepository,
        sqlite: deps.sqlite,
        groceryRepository: deps.groceryRepository,
        reminderRepository: deps.reminderRepository,
        generateRemindersFn: deps.generateRemindersFn,
      });

      // g2. Auto-mark past planned meals as cooked before Claude processes
      autoMarkCookedMeals(deps.sqlite, chatId);

      // g3. Load active plan context for system prompt injection
      const activePlans = planRepository.getActivePlans(chatId);
      const cookingHistoryEntries = getCookingHistory(deps.sqlite, chatId);
      const planContext = buildPlanContext(activePlans, cookingHistoryEntries);

      // g4. Load active grocery list context for system prompt injection
      const groceryContext = deps.groceryRepository
        ? buildGroceryContext(deps.sqlite, chatId)
        : "";

      // g5. Load reminder settings context for system prompt injection
      const reminderContext = deps.reminderRepository
        ? buildReminderContext(deps.sqlite, chatId)
        : "";

      // g6. Load feedback context for system prompt injection
      const feedbackContext = buildFeedbackContext(deps.sqlite, chatId);

      // h. Load user preferences for system prompt injection
      const preferences = getPreferenceSummaries(deps.sqlite, chatId);
      const systemPrompt = buildSystemPrompt(preferences, planContext, groceryContext, reminderContext, feedbackContext);

      // i. 30-second timeout warning timer
      let timeoutFired = false;
      const timeoutTimer = setTimeout(async () => {
        timeoutFired = true;
        try {
          await ctx.reply(
            "This is taking longer than usual, hang tight...",
          );
        } catch {
          // Best-effort timeout message
        }
      }, TIMEOUT_WARNING_MS);

      // j. Call Claude with tools and one silent retry
      let response: ClaudeResponse;
      const startTime = Date.now();

      const allTools = [...KNOWLEDGE_TOOLS, ...PLAN_TOOLS, ...GROCERY_TOOLS, ...REMINDER_TOOLS, ...FEEDBACK_TOOLS];

      try {
        response = await claudeClient.sendMessageWithTools(
          fullMessages,
          allTools,
          toolHandler.handleToolCall,
          10, // Increased from 5 for grocery list generation (plan + recipe lookups + save)
          systemPrompt,
        );
      } catch (firstError) {
        log.warn(
          {
            error: firstError instanceof Error ? firstError.message : String(firstError),
            stack: firstError instanceof Error ? firstError.stack : undefined,
            chatId,
            userId,
            timestamp: new Date().toISOString(),
          },
          "Claude API call failed (attempt 1), retrying",
        );

        try {
          response = await claudeClient.sendMessageWithTools(
            fullMessages,
            allTools,
            toolHandler.handleToolCall,
            10, // Increased from 5 for grocery list generation (plan + recipe lookups + save)
            systemPrompt,
          );
        } catch (secondError) {
          clearTimeout(timeoutTimer);
          log.error(
            {
              error: secondError instanceof Error ? secondError.message : String(secondError),
              stack: secondError instanceof Error ? secondError.stack : undefined,
              chatId,
              userId,
              timestamp: new Date().toISOString(),
            },
            "Claude API call failed (attempt 2), sending error to user",
          );
          try {
            await ctx.reply(IN_CHARACTER_ERROR);
          } catch {
            // Best-effort error message
          }
          return;
        }
      }

      const requestDurationMs = Date.now() - startTime;
      clearTimeout(timeoutTimer);

      // k. Send response via formatted sender
      await sendFormattedMessage(ctx, response.text);

      // l. Save outgoing response to messages table for conversation continuity
      db.insert(messages)
        .values({
          chatId,
          userId,
          text: response.text,
          direction: "out" as const,
        })
        .run();

      // l2. Edit grocery list message if tools modified it
      if (deps.groceryRepository) {
        try {
          const activeList = deps.groceryRepository.getActiveList(chatId);
          if (activeList && activeList.messageId) {
            const groceryItems = deps.groceryRepository.getListItems(activeList.id);
            const formattedList = formatGroceryList(groceryItems);
            const keyboard = buildGroceryKeyboard(groceryItems);
            await ctx.api.editMessageText(
              chatId,
              activeList.messageId,
              formattedList,
              { parse_mode: "HTML", reply_markup: keyboard },
            );
          }
        } catch (editError) {
          log.debug(
            { error: editError instanceof Error ? editError.message : String(editError) },
            "Grocery list message edit skipped",
          );
        }
      }

      // m. Log token usage to database
      const estimatedCost = calculateCost(response.model, response.usage);

      await db.insert(tokenUsage).values({
        chatId,
        userId,
        model: response.model,
        conversationType: "chat",
        inputTokens: response.usage.inputTokens,
        outputTokens: response.usage.outputTokens,
        cacheCreationTokens: response.usage.cacheCreationInputTokens,
        cacheReadTokens: response.usage.cacheReadInputTokens,
        estimatedCost,
        requestDurationMs,
      });

      // n. Log token usage to pino
      log.info(
        {
          chatId,
          userId,
          model: response.model,
          inputTokens: response.usage.inputTokens,
          outputTokens: response.usage.outputTokens,
          cacheCreationTokens: response.usage.cacheCreationInputTokens,
          cacheReadTokens: response.usage.cacheReadInputTokens,
          estimatedCost,
          requestDurationMs,
          conversationType: "chat",
        },
        "Claude API call completed",
      );
    } catch (outerError) {
      // Outer try/catch -- processor must NEVER throw
      log.error(
        {
          error: outerError instanceof Error ? outerError.message : String(outerError),
          stack: outerError instanceof Error ? outerError.stack : undefined,
          chatId,
          userId,
        },
        "Unexpected error in pipeline processor",
      );
      try {
        await ctx.reply(IN_CHARACTER_ERROR);
      } catch {
        // Best-effort error message
      }
    }
  };
}
