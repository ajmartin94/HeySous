/**
 * Pipeline Processor
 *
 * Orchestrates the full knowledge-augmented message processing pipeline:
 * save incoming message -> load conversation history -> build context ->
 * typing indicator -> streaming Claude call with tools + retry ->
 * progressive message delivery -> save outgoing message ->
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
import { KNOWLEDGE_TOOLS, PLAN_TOOLS, GROCERY_TOOLS, REMINDER_TOOLS, FEEDBACK_TOOLS, APP_FEEDBACK_TOOLS, DEEP_LINK_TOOLS, MEMORY_TOOLS } from "../ai/tools.js";
import { buildConversationContext } from "../conversation/context-builder.js";
import { estimateTokens, estimateMessageTokens } from "../knowledge/token-budget.js";
import type { ConversationTurn } from "../conversation/types.js";
import type { createRetrievalService } from "../knowledge/retrieval.js";
import { createKnowledgeRepository } from "../knowledge/repository.js";
import type { createPlanRepository } from "../planning/repository.js";
import type { createGroceryRepository } from "../grocery/repository.js";
import type { createReminderRepository } from "../reminders/repository.js";
import type { Clock } from "../clock.js";
import { getTodayInTimezone } from "../clock.js";
import { autoMarkCookedMeals, getCookingHistory } from "../planning/history.js";
import { buildPlanContext } from "../planning/context.js";
import { buildGroceryContext } from "../grocery/context.js";
import { buildReminderContext } from "../reminders/context.js";
import { buildFeedbackContext } from "../feedback/context.js";
import type { createAppFeedbackRepository } from "../app-feedback/repository.js";
import { formatGroceryList } from "../grocery/formatter.js";
import { buildGroceryKeyboard } from "../grocery/buttons.js";
import { getMemoriesByHousehold } from "../memory/repository.js";
import { checkPendingNotification } from "../notifications/update-notifier.js";
import { config } from "../config.js";
import { buildStaticPrompt, buildDynamicContext } from "../ai/system-prompt.js";
import { sanitizeAndLog } from "../ai/sanitize.js";
import type { SystemPromptInput, StreamCallbacks } from "../ai/claude-client.js";
import { extractOnboardingMarker, getNextOnboardingState } from "../onboarding/state.js";
import { buildOnboardingPrompt } from "../onboarding/prompt.js";
import { updateOnboardingState } from "../users/repository.js";
import type { User } from "../users/types.js";
import type { DrizzleDatabase } from "../db/index.js";
import type { Logger } from "pino";
import { getErrorMessage, getMessageTooLongResponse, getThinkingLongerMessage, getResilienceFailureMessage, getDailyLimitMessage } from "../bot/messages.js";
import { createTelegramStreamSender } from "../telegram/stream-sender.js";
import { getToolStatusLabel } from "../ai/tool-status.js";
import { checkDailyTokenBudget } from "../pipeline/token-budget-guard.js";
import { buildDeepLinksFromToolCalls, buildDeepLinkKeyboard } from "../deep-links/builder.js";
import type { DeepLinkTarget } from "../deep-links/builder.js";

/**
 * Create an instrumented wrapper around a tool call handler.
 * Logs structured data (tool_name, duration_ms, household_id, status) for every
 * tool call. On error, always includes tool_input; on success, only if
 * config.logToolInputs is true.
 */
export function createInstrumentedToolHandler(
  handler: (name: string, input: Record<string, unknown>) => string | Promise<string>,
  householdId: string,
  log: Logger,
): (name: string, input: Record<string, unknown>) => Promise<string> {
  return async (name: string, input: Record<string, unknown>): Promise<string> => {
    const startTime = Date.now();
    try {
      const result = await handler(name, input);
      const duration_ms = Date.now() - startTime;

      const logData: Record<string, unknown> = {
        tool_name: name,
        duration_ms,
        household_id: householdId,
        status: "success",
      };
      if (config.logToolInputs) {
        logData.tool_input = input;
      }

      log.info(logData, "Tool call completed");
      return result;
    } catch (error) {
      const duration_ms = Date.now() - startTime;
      const errorMessage = error instanceof Error ? error.message : String(error);

      log.error(
        {
          tool_name: name,
          duration_ms,
          household_id: householdId,
          status: "error",
          error: errorMessage,
          tool_input: input,
        },
        "Tool call completed",
      );

      throw error;
    }
  };
}

/**
 * Maximum combined character length for debounced messages.
 * Messages exceeding this limit are rejected before entering the AI pipeline.
 * Applies to all message types including photo captions.
 */
const MAX_MESSAGE_LENGTH = 4_000;

/** Default conversation history token budget. */
const CONVERSATION_TOKEN_BUDGET = 2000;

/** Anthropic context window size in tokens. Model-specific but 200k is the standard. */
const CONTEXT_WINDOW_TOKENS = 200_000;
/** Trigger trimming when estimated tokens exceed this percentage of the context window. */
const CONTEXT_TRIM_THRESHOLD = 0.8; // 80%

interface ClaudeClient {
  sendMessage(
    userMessages: string[],
    systemPrompt?: SystemPromptInput,
    onRetry?: (attempt: number, delayMs: number) => void | Promise<void>,
  ): Promise<ClaudeResponse>;
  sendMessageWithTools(
    messages: Anthropic.MessageParam[],
    tools: Anthropic.Tool[],
    onToolCall: (name: string, input: Record<string, unknown>) => string | Promise<string>,
    maxIterations?: number,
    systemPrompt?: SystemPromptInput,
    onRetry?: (attempt: number, delayMs: number) => void | Promise<void>,
  ): Promise<ClaudeResponse>;
  streamMessageWithTools(
    messages: Anthropic.MessageParam[],
    tools: Anthropic.Tool[],
    onToolCall: (name: string, input: Record<string, unknown>) => string | Promise<string>,
    callbacks: StreamCallbacks,
    maxIterations?: number,
    systemPrompt?: SystemPromptInput,
    onRetry?: (attempt: number, delayMs: number) => void | Promise<void>,
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
  generateRemindersFn?: (householdId: string) => void;
  feedbackRepository?: ReturnType<typeof import("../feedback/repository.js").createFeedbackRepository>;
  appFeedbackRepository?: ReturnType<typeof createAppFeedbackRepository>;
  clock: Clock;
  refreshUserCache?: (user: User) => void;
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
    const householdId = ctx.householdId!;

    try {
      // a. Start typing indicator (non-blocking)
      try {
        await ctx.replyWithChatAction("typing");
      } catch {
        // Typing indicator failure should not block processing
      }

      // b. Build user message from batch
      const userText = batch.messages.map((m) => m.text).filter(Boolean).join("\n\n");

      // b1. Reject messages exceeding length limit (before saving to DB)
      if (userText.length > MAX_MESSAGE_LENGTH) {
        log.info(
          { chatId, userId, messageLength: userText.length, limit: MAX_MESSAGE_LENGTH },
          "Message rejected: exceeds length limit",
        );
        try {
          await ctx.reply(getMessageTooLongResponse());
        } catch {
          // Best-effort rejection message
        }
        return; // Discard -- do not save to conversation history or process
      }

      // b2. Check daily token budget before processing
      const budgetCheck = checkDailyTokenBudget(deps.sqlite, householdId, config.dailyTokenBudget, config.sessionTimezone);
      if (!budgetCheck.allowed) {
        log.info({ chatId, householdId, tokensUsed: budgetCheck.tokensUsed, budget: budgetCheck.budgetTokens }, "Daily token budget exhausted");
        try { await ctx.reply(getDailyLimitMessage()); } catch { /* best-effort */ }
        return;
      }

      // b3. Collect images from batch (for multimodal messages)
      const batchImages = batch.messages.filter((m) => m.imageBase64 && m.imageMimeType);

      // c. Save incoming user message to messages table BEFORE Claude call
      const savedText = userText || (batchImages.length > 0 ? "[photo]" : "");
      db.insert(messages)
        .values({
          chatId,
          userId,
          text: savedText,
          direction: "in" as const,
        })
        .run();

      // c2. Check for pending update notifications (lazy delivery)
      if (!config.isDev) {
        const notification = checkPendingNotification(deps.sqlite, userId);
        if (notification) {
          try {
            await sendFormattedMessage(ctx, notification);
          } catch {
            // Best-effort notification delivery -- don't block processing
          }
        }
      }

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
      const { messages: priorMessages, wasTruncated, originalTurnCount, includedTurnCount } = buildConversationContext(
        turns,
        CONVERSATION_TOKEN_BUDGET,
        config.sessionTimezone,
      );

      // f. Construct full messages array: prior history + current user message
      //    For photos, build multimodal content blocks (image + text)
      let userContent: string | Anthropic.ContentBlockParam[];

      if (batchImages.length > 0) {
        const contentBlocks: Anthropic.ContentBlockParam[] = [];

        // Add image blocks first
        for (const msg of batchImages) {
          contentBlocks.push({
            type: "image" as const,
            source: {
              type: "base64" as const,
              media_type: msg.imageMimeType as "image/jpeg" | "image/png" | "image/gif" | "image/webp",
              data: msg.imageBase64!,
            },
          });
        }

        // Add text block if present
        if (userText) {
          contentBlocks.push({
            type: "text" as const,
            text: userText,
          });
        }

        userContent = contentBlocks;
      } else {
        userContent = userText;
      }

      const fullMessages: Anthropic.MessageParam[] = [
        ...priorMessages,
        { role: "user" as const, content: userContent },
      ];

      // g. Resolve user timezone for date calculations
      let userTimezone = "America/New_York"; // fallback
      let todayStr: string | undefined;
      if (deps.reminderRepository) {
        const reminderSettings = deps.reminderRepository.getOrCreateSettings(householdId);
        userTimezone = reminderSettings.timezone;
        todayStr = getTodayInTimezone(userTimezone, deps.clock);
      }

      // g1. Create tool handler for knowledge retrieval, write ops, plan tools, grocery tools, and reminder tools
      const toolHandler = createToolHandler({
        retrievalService,
        knowledgeRepository,
        db,
        householdId,
        planRepository,
        sqlite: deps.sqlite,
        groceryRepository: deps.groceryRepository,
        reminderRepository: deps.reminderRepository,
        generateRemindersFn: deps.generateRemindersFn,
        appFeedbackRepository: deps.appFeedbackRepository,
        clock: deps.clock,
        timezone: userTimezone,
      });

      // g2. Auto-mark past planned meals as cooked before Claude processes
      autoMarkCookedMeals(deps.sqlite, householdId, deps.clock, userTimezone);

      // g3. Load active plan context for system prompt injection
      const activePlans = planRepository.getActivePlans(householdId, todayStr);
      const cookingHistoryEntries = getCookingHistory(deps.sqlite, householdId, deps.clock);
      const planContext = buildPlanContext(activePlans, cookingHistoryEntries);

      // g4. Load active grocery list context for system prompt injection
      const groceryContext = deps.groceryRepository
        ? buildGroceryContext(deps.sqlite, householdId)
        : "";

      // g5. Load reminder settings context for system prompt injection
      const reminderContext = deps.reminderRepository
        ? buildReminderContext(deps.sqlite, householdId, deps.clock)
        : "";

      // g6. Load feedback context for system prompt injection
      const feedbackContext = buildFeedbackContext(deps.sqlite, householdId, deps.clock);

      // g7. Build date context for system prompt
      let dateContext = "";
      if (todayStr) {
        const todayDate = new Date(todayStr + "T00:00:00");
        const dayNames = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
        const monthNames = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
        dateContext = `<current_date>\nToday is ${dayNames[todayDate.getDay()]}, ${monthNames[todayDate.getMonth()]} ${todayDate.getDate()}, ${todayDate.getFullYear()} (${todayStr}).\n</current_date>`;
      }

      // h. Load user memories for system prompt injection
      const memories = getMemoriesByHousehold(deps.sqlite, householdId);
      const rawUserName = ctx.user?.displayName;

      // h1. Sanitize user-controlled text with logging (per security policy)
      const userName = rawUserName ? sanitizeAndLog(rawUserName, "userName", log) : undefined;
      const sanitizedMemories = memories.map((mem) => ({
        id: mem.id,
        content: sanitizeAndLog(mem.content, "memory.content", log),
        category: mem.category,
      }));

      // h2. Build onboarding context if user is in onboarding
      const onboardingContext = ctx.user && ctx.user.onboardingState !== "complete"
        ? buildOnboardingPrompt(ctx.user.onboardingState)
        : "";

      // h3. Proactive app feedback prompt injection
      const PROACTIVE_FEEDBACK_THRESHOLD = 50;
      let appFeedbackContext = "";
      if (deps.appFeedbackRepository) {
        const messagesSinceLastPrompt = deps.appFeedbackRepository.getMessageCountSinceLastPrompt(householdId);
        if (messagesSinceLastPrompt >= PROACTIVE_FEEDBACK_THRESHOLD) {
          appFeedbackContext = "<request_feedback/>";
          deps.appFeedbackRepository.recordProactivePromptShown(householdId);
        }
      }

      const staticPrompt = buildStaticPrompt(config.miniAppUrl);
      const dynamicContext = buildDynamicContext({
        memories: sanitizedMemories,
        planContext,
        groceryContext,
        reminderContext,
        feedbackContext,
        userName,
        onboardingContext,
        appFeedbackContext,
        dateContext,
      });

      // i0. Estimate total token count and check for context overflow
      const estimatedSystemTokens = estimateTokens(staticPrompt) + estimateTokens(dynamicContext);
      const estimatedMsgTokens = estimateMessageTokens(fullMessages);
      const estimatedTotalTokens = estimatedSystemTokens + estimatedMsgTokens;

      let contextTrimmed = wasTruncated;

      if (estimatedTotalTokens > CONTEXT_WINDOW_TOKENS * CONTEXT_TRIM_THRESHOLD) {
        // Context approaching limit -- aggressively trim conversation history
        log.warn(
          {
            chatId,
            householdId,
            estimatedTotalTokens,
            threshold: CONTEXT_WINDOW_TOKENS * CONTEXT_TRIM_THRESHOLD,
            priorMessageCount: priorMessages.length,
          },
          "Context approaching window limit, trimming conversation history",
        );

        // Remove oldest messages from fullMessages until under threshold
        // Always keep at least the current user message (last element)
        while (fullMessages.length > 1) {
          const currentEstimate = estimateTokens(staticPrompt) + estimateTokens(dynamicContext) + estimateMessageTokens(fullMessages);
          if (currentEstimate <= CONTEXT_WINDOW_TOKENS * CONTEXT_TRIM_THRESHOLD) {
            break;
          }
          // Remove the oldest message (first element, which is oldest conversation history)
          fullMessages.shift();
          contextTrimmed = true;
        }

        // If still over after removing all history, log and proceed anyway
        // (the API will handle it, or the request is genuinely too large)
        const finalEstimate = estimateTokens(staticPrompt) + estimateTokens(dynamicContext) + estimateMessageTokens(fullMessages);
        if (finalEstimate > CONTEXT_WINDOW_TOKENS * CONTEXT_TRIM_THRESHOLD) {
          log.warn(
            {
              chatId,
              householdId,
              estimatedTokens: finalEstimate,
              threshold: CONTEXT_WINDOW_TOKENS * CONTEXT_TRIM_THRESHOLD,
            },
            "Context still over threshold after trimming all history -- proceeding with current message only",
          );
        }
      }

      // i1. Inject truncation notice into dynamic context if history was trimmed
      let finalDynamicContext = dynamicContext;
      if (contextTrimmed) {
        const trimNotice = `\n<conversation_note>\nEarlier messages in this conversation have been omitted to fit the context window. Continue the conversation naturally based on what's visible. Do not mention this to the user.\n</conversation_note>`;
        finalDynamicContext = dynamicContext + trimNotice;
      }
      const systemPrompt: SystemPromptInput = { static: staticPrompt, dynamic: finalDynamicContext };

      // i2. Log context trimming metadata
      if (contextTrimmed) {
        log.info(
          {
            chatId,
            householdId,
            originalTurnCount,
            includedTurnCount,
            estimatedTotalTokens,
            contextTrimmed,
          },
          "Context trimmed for Claude API call",
        );
      }

      // i. Set up streaming infrastructure
      // Streaming provides visual progress, so the 30-second timeout timer is removed.
      // The "thinking longer" message is only sent on 429 retries (via onRetry callback).

      // j. Call Claude with streaming tools and retry via retryWithBackoff (inside claude-client)
      let response: ClaudeResponse;
      const startTime = Date.now();

      const allTools = [...KNOWLEDGE_TOOLS, ...PLAN_TOOLS, ...GROCERY_TOOLS, ...REMINDER_TOOLS, ...FEEDBACK_TOOLS, ...APP_FEEDBACK_TOOLS, ...DEEP_LINK_TOOLS, ...MEMORY_TOOLS];

      const instrumentedHandler = createInstrumentedToolHandler(
        toolHandler.handleToolCall,
        householdId,
        log,
      );

      // Track tool calls for deep-link button injection after response
      const trackedToolCalls: Array<{ name: string; input: Record<string, unknown>; result: string }> = [];
      const trackingHandler = async (name: string, input: Record<string, unknown>): Promise<string> => {
        const result = await instrumentedHandler(name, input);
        trackedToolCalls.push({ name, input, result });
        return result;
      };

      // Track whether user has been notified about retry (only once per request)
      let retryNotificationSent = false;

      const onRetry = async (attempt: number, delayMs: number): Promise<void> => {
        log.warn(
          {
            chatId,
            userId,
            householdId,
            attempt,
            delayMs,
            timestamp: new Date().toISOString(),
          },
          "Claude API retry in progress",
        );

        // Send "thinking longer" message to user on first retry only
        // This goes through ctx.reply (not stream sender) since it's a separate notification
        if (!retryNotificationSent) {
          retryNotificationSent = true;
          try {
            await ctx.reply(getThinkingLongerMessage());
          } catch {
            // Best-effort notification
          }
        }
      };

      // Create stream sender for progressive message delivery
      const streamSender = createTelegramStreamSender(ctx, log);
      let streamingActive = false;

      try {
        await streamSender.sendPlaceholder();
        streamingActive = true;
      } catch (placeholderError) {
        log.warn(
          { error: placeholderError instanceof Error ? placeholderError.message : String(placeholderError), chatId },
          "Stream placeholder failed, falling back to non-streaming",
        );
      }

      if (streamingActive) {
        // Streaming path -- progressive delivery via stream sender
        const streamCallbacks = {
          onText: (delta: string, _snapshot: string) => {
            streamSender.appendText(delta);
          },
          onToolUseStart: (toolName: string) => {
            streamSender.showToolStatus(getToolStatusLabel(toolName));
          },
          onToolUseEnd: (_toolName: string) => {
            streamSender.clearToolStatus();
          },
        };

        try {
          response = await claudeClient.streamMessageWithTools(
            fullMessages,
            allTools,
            trackingHandler,
            streamCallbacks,
            10, // max iterations for grocery list generation (plan + recipe lookups + save)
            systemPrompt,
            onRetry,
          );
        } catch (streamError) {
          // Handle stream failure
          const is429Exhausted = streamError instanceof Error &&
            streamError.message.includes("429");

          if (is429Exhausted) {
            // Finalize stream with error note
            await streamSender.handleError();
            log.error(
              {
                error: streamError instanceof Error ? streamError.message : String(streamError),
                stack: streamError instanceof Error ? streamError.stack : undefined,
                chatId,
                userId,
                householdId,
                failureType: "429_exhausted",
                retryCount: 3,
                timestamp: new Date().toISOString(),
              },
              "Claude API streaming call failed after all retries, sending resilience failure to user",
            );
            try {
              await ctx.reply(getResilienceFailureMessage());
            } catch {
              // Best-effort error message
            }
            return;
          }

          // Generic stream error -- keep partial text, append error note
          const partialText = await streamSender.handleError();
          log.error(
            {
              error: streamError instanceof Error ? streamError.message : String(streamError),
              chatId,
              userId,
              householdId,
              partialTextLength: partialText.length,
            },
            "Stream error, partial text preserved",
          );

          // Save partial text to conversation history if meaningful
          if (partialText.trim()) {
            db.insert(messages)
              .values({
                chatId,
                userId,
                text: partialText,
                direction: "out" as const,
              })
              .run();
          }
          return;
        }
      } else {
        // Non-streaming fallback -- original sendMessageWithTools path
        try {
          response = await claudeClient.sendMessageWithTools(
            fullMessages,
            allTools,
            trackingHandler,
            10,
            systemPrompt,
            onRetry,
          );
        } catch (retryExhaustedError) {
          log.error(
            {
              error: retryExhaustedError instanceof Error ? retryExhaustedError.message : String(retryExhaustedError),
              stack: retryExhaustedError instanceof Error ? retryExhaustedError.stack : undefined,
              chatId,
              userId,
              householdId,
              failureType: "429_exhausted",
              retryCount: 3,
              timestamp: new Date().toISOString(),
            },
            "Claude API call failed after all retries, sending resilience failure to user",
          );
          try {
            await ctx.reply(getResilienceFailureMessage());
          } catch {
            // Best-effort error message
          }
          return;
        }
      }

      const requestDurationMs = Date.now() - startTime;

      // k. Extract onboarding marker (if any) BEFORE finalizing
      const { text: cleanText, completedPhase } = extractOnboardingMarker(response.text);

      // k2. Advance onboarding state if marker was found
      if (completedPhase !== null && ctx.user && ctx.user.onboardingState !== "complete") {
        const fromState = ctx.user.onboardingState;
        const nextState = getNextOnboardingState(ctx.user.onboardingState, completedPhase);
        updateOnboardingState(deps.sqlite, ctx.user.telegramId, nextState);
        log.info(
          { telegramId: ctx.user.telegramId, fromState, toState: nextState, completedPhase },
          "Onboarding state advanced",
        );
        ctx.user.onboardingState = nextState;
        if (deps.refreshUserCache) {
          deps.refreshUserCache(ctx.user);
        }
      }

      // l3. Attach deep-link buttons to response message
      let deepLinkKeyboard: ReturnType<typeof buildDeepLinkKeyboard> = null;
      if (trackedToolCalls.length > 0) {
        try {
          // Check for explicit attach_deep_link tool calls first
          const explicitLinks: DeepLinkTarget[] = [];
          for (const tc of trackedToolCalls) {
            if (tc.name === "attach_deep_link") {
              try {
                const parsed = JSON.parse(tc.result) as { deep_link?: boolean; target?: string; recipe_id?: number };
                if (parsed.deep_link && parsed.target) {
                  if (parsed.target === "recipe" && parsed.recipe_id) {
                    explicitLinks.push({ type: "recipe", recipeId: parsed.recipe_id });
                  } else if (parsed.target === "recipes") {
                    explicitLinks.push({ type: "recipes" });
                  } else if (parsed.target === "plan") {
                    explicitLinks.push({ type: "plan" });
                  } else if (parsed.target === "grocery") {
                    explicitLinks.push({ type: "grocery" });
                  }
                }
              } catch { /* ignore parse errors */ }
            }
          }

          // Build targets from automatic tool tracking (excludes attach_deep_link)
          const autoTargets = buildDeepLinksFromToolCalls(
            trackedToolCalls.filter(tc => tc.name !== "attach_deep_link")
          );

          // Merge: explicit links take priority, deduplicate by type
          const allTargets = [...explicitLinks];
          const existingTypes = new Set(allTargets.map(t => t.type));
          for (const t of autoTargets) {
            if (!existingTypes.has(t.type)) {
              allTargets.push(t);
              existingTypes.add(t.type);
            }
          }

          deepLinkKeyboard = buildDeepLinkKeyboard(allTargets);
        } catch (deepLinkError) {
          log.debug(
            { error: deepLinkError instanceof Error ? deepLinkError.message : String(deepLinkError) },
            "Deep-link keyboard build skipped",
          );
        }
      }

      // k3. Finalize the message and save to conversation history
      if (streamingActive) {
        // Streaming path: finalize the stream sender with clean text (markers stripped)
        if (cleanText.trim()) {
          await streamSender.finalize(
            cleanText,
            deepLinkKeyboard ? { reply_markup: deepLinkKeyboard } : undefined,
          );

          // l. Save outgoing response to messages table for conversation continuity
          db.insert(messages)
            .values({
              chatId,
              userId,
              text: cleanText,
              direction: "out" as const,
            })
            .run();
        } else {
          // Empty after marker extraction -- clean up the streamed message
          await streamSender.finalize();
        }
      } else {
        // Non-streaming fallback: use sendFormattedMessage then attach buttons separately
        if (cleanText.trim()) {
          await sendFormattedMessage(ctx, cleanText);

          // l. Save outgoing response to messages table for conversation continuity
          db.insert(messages)
            .values({
              chatId,
              userId,
              text: cleanText,
              direction: "out" as const,
            })
            .run();

          // For non-streaming, send deep-link buttons as follow-up (no stream message to attach to)
          if (deepLinkKeyboard) {
            try {
              await ctx.reply("Open in app:", { reply_markup: deepLinkKeyboard });
            } catch { /* best-effort */ }
          }
        }
      }

      // l2. Edit grocery list message if tools modified it
      if (deps.groceryRepository) {
        try {
          const activeList = deps.groceryRepository.getActiveList(householdId);
          if (activeList && activeList.messageId) {
            const groceryItems = deps.groceryRepository.getListItems(activeList.id);
            const formattedList = formatGroceryList(groceryItems);
            const groceryKeyboard = buildGroceryKeyboard(groceryItems);
            await ctx.api.editMessageText(
              chatId,
              activeList.messageId,
              formattedList,
              { parse_mode: "HTML", reply_markup: groceryKeyboard },
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
        householdId,
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
        await ctx.reply(getErrorMessage());
      } catch {
        // Best-effort error message
      }
    }
  };
}
