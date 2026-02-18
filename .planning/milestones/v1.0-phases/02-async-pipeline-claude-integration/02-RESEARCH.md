# Phase 2: Async Pipeline & Claude Integration - Research

**Researched:** 2026-02-06
**Domain:** Anthropic Claude API integration, async webhook processing, message debouncing, token cost tracking
**Confidence:** HIGH

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

#### Claude's personality & system prompt
- Warm & casual tone -- like a friend who loves cooking ("oh nice, that stromboli sounds amazing!")
- Named persona: "Sous" -- the user's kitchen sidekick, has a personality
- Strict food-only boundaries -- politely declines anything not food-related ("I only know my way around a kitchen!")
- Actively helpful / proactive -- regularly suggests ideas, follows up, nudges ("It's Sunday -- want me to plan the week?")

#### Cost tracking & guardrails
- Per-request token logging -- each Claude call logs input/output tokens and estimated cost, tagged by user and conversation type
- Log only (no hard limits) for early stages -- track everything per-user but no cutoffs yet
- Admin bot command -- a `/costs` command in Telegram for quick usage checks, only visible to admin users
- Backend is the source of truth for per-user cost attribution (Anthropic dashboard only shows account-level aggregates)

#### Error & fallback behavior
- Friendly in-character error messages -- "Sorry, I'm having trouble thinking right now. Try again in a moment!" (as Sous)
- Retry once silently before showing error -- user only sees error if both attempts fail
- Timeout messaging at 30s -- after 30 seconds, tell user "This is taking longer than usual, hang tight..." then continue waiting
- Detailed error logging -- full error details, request context, user ID, timestamps for post-hoc debugging

### Claude's Discretion
- Message batching debounce window timing
- System prompt structure and exact wording (within personality constraints above)
- Prompt caching strategy details
- Retry delay timing and backoff approach

### Deferred Ideas (OUT OF SCOPE)
None -- discussion stayed within phase scope
</user_constraints>

## Summary

This phase integrates the Anthropic Claude API into the existing grammY Telegram bot, replacing the Phase 1 echo handler with an intelligent conversational agent. The three major technical challenges are: (1) responding to Telegram webhooks fast enough while processing Claude responses asynchronously, (2) debouncing rapid consecutive messages from a user into a single Claude call, and (3) tracking token usage and costs per-user in the database.

The standard approach uses the official `@anthropic-ai/sdk` (v0.73.0) with its built-in retry logic and streaming support. Prompt caching is now GA (not beta) and works directly through `client.messages.create()` with `cache_control` blocks on system prompt content. For async webhook processing, the recommended pattern is an in-process message queue that accepts messages from grammY middleware and processes them outside the webhook timeout window.

The existing codebase (grammY + Express + SQLite/Drizzle + Pino) provides a solid foundation. The message handler in `src/bot/handlers/message.ts` currently echoes -- Phase 2 replaces this with a pipeline that queues the message, debounces, calls Claude, and sends the response via the existing `sendFormattedMessage` utility.

**Primary recommendation:** Use `@anthropic-ai/sdk` v0.73.0 directly (not through AI SDK or LangChain), with an in-process Map-based debounce queue per chat, and a `token_usage` Drizzle table for cost tracking.

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| @anthropic-ai/sdk | ^0.73.0 | Claude API client | Official SDK with TypeScript types, built-in retries, streaming, prompt caching support |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| drizzle-orm | ^0.45.1 (existing) | Token usage database table | Already in project; add `token_usage` table to schema |
| pino | ^10.3.0 (existing) | Structured error/cost logging | Already in project; used for all logging |
| grammy | ^1.39.3 (existing) | Bot framework | Already in project; webhook callback configuration |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| @anthropic-ai/sdk | @ai-sdk/anthropic (Vercel AI SDK) | Adds abstraction layer, hides cache metrics, unnecessary for single-provider use |
| In-process queue | BullMQ / Redis queue | Overkill for single-instance bot; adds infrastructure dependency |
| SQLite token_usage table | Structured log parsing | Logs are harder to query; DB enables /costs command and per-user aggregation |

**Installation:**
```bash
npm install @anthropic-ai/sdk
```

No other new dependencies needed -- the project already has everything else.

## Architecture Patterns

### Recommended Project Structure
```
src/
  ai/
    claude-client.ts     # Anthropic SDK wrapper, prompt builder, cost calculation
    system-prompt.ts     # System prompt content (Sous persona) -- separate file for caching clarity
    types.ts             # Claude-related TypeScript types
  pipeline/
    message-queue.ts     # In-process debounce queue (Map<chatId, PendingMessages>)
    processor.ts         # Orchestrates: dequeue -> build prompt -> call Claude -> send response
  bot/
    handlers/
      message.ts         # (MODIFY) Replace echo with queue.enqueue()
      costs.ts           # (NEW) /costs admin command handler
    context.ts           # (MODIFY) Add db instance to context if needed
  db/
    schema.ts            # (MODIFY) Add tokenUsage table
```

### Pattern 1: Async Webhook with In-Process Queue
**What:** Webhook handler immediately enqueues the message and returns. A debounce timer fires after the window expires, triggering Claude processing outside the webhook lifecycle.
**When to use:** Always -- this is the core async pattern for this phase.
**Why not grammY "return" mode:** grammY docs explicitly warn against using `webhookCallback(bot, "express", "return")` because it causes parallel update processing and race conditions with sessions. Instead, keep middleware fast by only enqueuing.

```typescript
// Source: Pattern derived from grammY deployment docs + project architecture
// src/pipeline/message-queue.ts

interface PendingBatch {
  chatId: string;
  userId: string;
  messages: Array<{ text: string; timestamp: Date }>;
  timer: ReturnType<typeof setTimeout>;
  ctx: BotContext; // Keep reference to latest context for replying
}

const pendingBatches = new Map<string, PendingBatch>();
const DEBOUNCE_WINDOW_MS = 1500; // Recommended: 1-2 seconds

export function enqueueMessage(
  chatId: string,
  userId: string,
  text: string,
  ctx: BotContext,
  processFn: (batch: PendingBatch) => Promise<void>
): void {
  const existing = pendingBatches.get(chatId);

  if (existing) {
    clearTimeout(existing.timer);
    existing.messages.push({ text, timestamp: new Date() });
    existing.ctx = ctx; // Always use latest context
  } else {
    pendingBatches.set(chatId, {
      chatId,
      userId,
      messages: [{ text, timestamp: new Date() }],
      timer: setTimeout(() => {/* set below */}, 0),
      ctx,
    });
  }

  const batch = pendingBatches.get(chatId)!;
  batch.timer = setTimeout(async () => {
    pendingBatches.delete(chatId);
    await processFn(batch);
  }, DEBOUNCE_WINDOW_MS);
}
```

### Pattern 2: Claude Service with Prompt Caching
**What:** Wrapper around Anthropic SDK that builds prompts with `cache_control` on the system prompt, calls Claude, and extracts token usage.
**When to use:** Every Claude API call.

```typescript
// Source: Anthropic official docs (platform.claude.com/docs/en/build-with-claude/prompt-caching)
// src/ai/claude-client.ts

import Anthropic from "@anthropic-ai/sdk";

const client = new Anthropic({
  apiKey: config.anthropicApiKey,
  maxRetries: 0, // We handle retries ourselves for user-facing messaging
  timeout: 60_000, // 60 second timeout
});

interface ClaudeResponse {
  text: string;
  usage: {
    inputTokens: number;
    outputTokens: number;
    cacheCreationInputTokens: number;
    cacheReadInputTokens: number;
  };
  model: string;
  stopReason: string;
}

export async function sendMessage(
  userMessages: string[],
  systemPrompt: string
): Promise<ClaudeResponse> {
  const combinedUserText = userMessages.join("\n\n");

  const response = await client.messages.create({
    model: "claude-haiku-4-5-20251001",
    max_tokens: 2048,
    system: [
      {
        type: "text",
        text: systemPrompt,
        cache_control: { type: "ephemeral" },
      },
    ],
    messages: [
      { role: "user", content: combinedUserText },
    ],
  });

  const textContent = response.content
    .filter((block): block is Anthropic.TextBlock => block.type === "text")
    .map((block) => block.text)
    .join("\n");

  return {
    text: textContent,
    usage: {
      inputTokens: response.usage.input_tokens,
      outputTokens: response.usage.output_tokens,
      cacheCreationInputTokens: response.usage.cache_creation_input_tokens ?? 0,
      cacheReadInputTokens: response.usage.cache_read_input_tokens ?? 0,
    },
    model: response.model,
    stopReason: response.stop_reason ?? "unknown",
  };
}
```

### Pattern 3: Token Usage Logging with Cost Calculation
**What:** Log every Claude API call to a `token_usage` table with calculated costs.
**When to use:** After every successful Claude response.

```typescript
// Source: Anthropic pricing docs + Drizzle ORM patterns from Phase 1
// Cost calculation per Anthropic pricing page (2026-02-06)

// Haiku 4.5 pricing
const PRICING = {
  "claude-haiku-4-5-20251001": {
    inputPerMTok: 1.00,
    outputPerMTok: 5.00,
    cacheWritePerMTok: 1.25,
    cacheReadPerMTok: 0.10,
  },
  // Add more models as needed
} as const;

export function calculateCost(
  model: string,
  usage: ClaudeResponse["usage"]
): number {
  const pricing = PRICING[model as keyof typeof PRICING];
  if (!pricing) return 0;

  const inputCost = (usage.inputTokens / 1_000_000) * pricing.inputPerMTok;
  const outputCost = (usage.outputTokens / 1_000_000) * pricing.outputPerMTok;
  const cacheWriteCost = (usage.cacheCreationInputTokens / 1_000_000) * pricing.cacheWritePerMTok;
  const cacheReadCost = (usage.cacheReadInputTokens / 1_000_000) * pricing.cacheReadPerMTok;

  return inputCost + outputCost + cacheWriteCost + cacheReadCost;
}
```

### Pattern 4: Retry with User-Facing Timeout Messaging
**What:** Retry once silently on failure. Show 30s timeout message. Send error message only after both attempts fail.
**When to use:** In the pipeline processor that orchestrates the Claude call.

```typescript
// Source: User decisions from CONTEXT.md
// src/pipeline/processor.ts (conceptual pattern)

async function processWithRetryAndTimeout(
  batch: PendingBatch,
  claudeService: ClaudeService
): Promise<void> {
  const ctx = batch.ctx;
  let timeoutMsgSent = false;

  // Start 30s timeout warning timer
  const timeoutTimer = setTimeout(async () => {
    timeoutMsgSent = true;
    await ctx.reply("This is taking longer than usual, hang tight...");
  }, 30_000);

  try {
    // Attempt 1
    try {
      const result = await claudeService.sendMessage(/* ... */);
      clearTimeout(timeoutTimer);
      await sendFormattedMessage(ctx, result.text);
      await logTokenUsage(/* ... */);
      return;
    } catch (firstError) {
      logger.warn({ error: firstError }, "First Claude attempt failed, retrying");
    }

    // Attempt 2 (silent retry)
    try {
      const result = await claudeService.sendMessage(/* ... */);
      clearTimeout(timeoutTimer);
      await sendFormattedMessage(ctx, result.text);
      await logTokenUsage(/* ... */);
      return;
    } catch (secondError) {
      clearTimeout(timeoutTimer);
      logger.error({ error: secondError }, "Both Claude attempts failed");
      // In-character error message
      await ctx.reply(
        "Sorry, I'm having trouble thinking right now. Try again in a moment!"
      );
    }
  } catch (outerError) {
    clearTimeout(timeoutTimer);
    logger.error({ error: outerError }, "Unexpected error in pipeline processor");
  }
}
```

### Anti-Patterns to Avoid
- **Using grammY webhookCallback "return" mode:** Causes parallel update processing and race conditions. Keep middleware fast instead.
- **Using `client.beta.promptCaching.messages.create()`:** This is the OLD beta API. Prompt caching is now GA -- use `client.messages.create()` directly with `cache_control` blocks.
- **Awaiting Claude response inside grammY middleware:** Blocks the webhook timeout (default 10s in grammY). Enqueue and process asynchronously.
- **Storing costs only in logs:** Makes the /costs command impossible without log parsing infrastructure. Use a database table.
- **Hardcoding model name everywhere:** Use a config constant. Model names change as new versions release.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| HTTP client for Claude API | Custom fetch wrapper | `@anthropic-ai/sdk` | Handles auth, retries, streaming, TypeScript types, request IDs |
| Token cost calculation | Approximation from character count | Exact counts from `response.usage` | API returns exact token counts; character-based estimates are unreliable |
| Message queue infrastructure | Redis/BullMQ queue | In-process Map + setTimeout | Single-instance bot; no need for distributed queue overhead |
| Retry logic with exponential backoff | Custom retry wrapper | SDK built-in retries for infra errors + custom retry for user-facing | SDK handles 429/500/529 automatically; only need custom retry for user messaging flow |

**Key insight:** The Anthropic SDK already handles the hardest parts (auth, retries on transient errors, streaming, TypeScript types). The custom code needed is: debounce queue, prompt building, cost logging, and user-facing error flow.

## Common Pitfalls

### Pitfall 1: grammY Webhook Timeout
**What goes wrong:** Claude API calls take 2-15+ seconds. grammY's default webhook timeout is 10 seconds. If the middleware doesn't complete in time, grammY throws an error and Telegram re-sends the update, causing duplicate processing.
**Why it happens:** Developers try to await the Claude response inside the grammY message handler.
**How to avoid:** Never await Claude calls inside middleware. Enqueue the message and let the handler return immediately. The debounce timer fires the async processing outside the middleware lifecycle.
**Warning signs:** Duplicate bot responses, "Error while handling update" logs, intermittent timeouts.

### Pitfall 2: Prompt Caching Minimum Token Requirement
**What goes wrong:** Cache is never created because the system prompt is too short to meet the minimum cacheable length.
**Why it happens:** Haiku 4.5 requires a minimum of 4096 tokens for caching. A simple system prompt (~200-500 tokens) won't reach this threshold.
**How to avoid:** For Phase 2, the system prompt alone will likely be under 4096 tokens. Still add `cache_control` -- it costs nothing if the minimum isn't met (the request processes normally without caching). In Phase 3+, when knowledge context is added to the system prompt, caching will activate. Monitor `cache_creation_input_tokens` in logs to verify.
**Warning signs:** `cache_creation_input_tokens` always 0, `cache_read_input_tokens` always 0.

### Pitfall 3: Double-Processing Debounced Messages
**What goes wrong:** A race condition where the same batch of messages gets processed twice.
**Why it happens:** The timer fires but the batch hasn't been removed from the Map yet, and a new message arrives for the same chat during processing.
**How to avoid:** Delete the batch from the Map BEFORE starting async processing (as shown in Pattern 1). New messages arriving during processing start a fresh batch.
**Warning signs:** User receives two responses to the same message.

### Pitfall 4: Anthropic SDK Default Retries Conflicting with Custom Retry
**What goes wrong:** The SDK retries 2 times by default on 429/500/529 errors. If you also wrap calls in your own retry loop, you get up to 6 total attempts (2 SDK retries x 2 manual retries + originals), causing unnecessary API spend and delay.
**Why it happens:** Developers don't realize the SDK has built-in retry logic.
**How to avoid:** Set `maxRetries: 0` on the Anthropic client constructor and handle all retry logic explicitly in the pipeline processor. This gives full control over timing and user-facing messages (like the 30s timeout warning).
**Warning signs:** Very long delays before error messages appear, excessive API billing on failed requests.

### Pitfall 5: Not Escaping Claude's HTML Output for Telegram
**What goes wrong:** Claude generates HTML-like content (angle brackets in code snippets, markdown-style formatting) that Telegram's HTML parser rejects.
**Why it happens:** Claude doesn't know it's generating for Telegram's limited HTML subset.
**How to avoid:** Use the existing `formatBotResponse()` from `src/telegram/formatter.ts` which strips unsupported tags. Also use the existing `sendFormattedMessage()` from `src/telegram/sender.ts` which has plain-text fallback on parse errors.
**Warning signs:** "can't parse entities" errors from Telegram API.

### Pitfall 6: Context Object Stale After Async Processing
**What goes wrong:** The grammY context object stored in the debounce queue becomes stale or the underlying connection drops.
**Why it happens:** The context is captured during webhook processing but used seconds later after the debounce window.
**How to avoid:** grammY contexts in webhook mode are safe to use after the webhook response -- they make independent HTTP calls to the Telegram API. The context doesn't depend on the webhook connection. However, always store the LATEST context (from the most recent message in the batch) since it has the most recent update info.
**Warning signs:** "Chat not found" or "Message not found" errors when replying.

## Code Examples

### Adding ANTHROPIC_API_KEY to Config
```typescript
// Source: Existing src/config.ts pattern
// Add to Config interface:
anthropicApiKey: string;
anthropicModel: string;
adminUserIds: string[]; // For /costs command access control

// Add to validation:
const anthropicApiKey = process.env.ANTHROPIC_API_KEY;
if (!anthropicApiKey) {
  throw new Error(
    "ANTHROPIC_API_KEY is required. Get one at console.anthropic.com"
  );
}

// Add to config object:
anthropicApiKey,
anthropicModel: process.env.ANTHROPIC_MODEL ?? "claude-haiku-4-5-20251001",
adminUserIds: (process.env.ADMIN_USER_IDS ?? "").split(",").filter(Boolean),
```

### Token Usage Drizzle Schema
```typescript
// Source: Drizzle ORM patterns from existing src/db/schema.ts
import { integer, real, sqliteTable, text } from "drizzle-orm/sqlite-core";

export const tokenUsage = sqliteTable("token_usage", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  chatId: text("chat_id").notNull(),
  userId: text("user_id").notNull(),
  model: text("model").notNull(),
  conversationType: text("conversation_type").notNull(), // e.g., "chat", "recipe", "planning"
  inputTokens: integer("input_tokens").notNull(),
  outputTokens: integer("output_tokens").notNull(),
  cacheCreationTokens: integer("cache_creation_tokens").notNull().default(0),
  cacheReadTokens: integer("cache_read_tokens").notNull().default(0),
  estimatedCost: real("estimated_cost").notNull(), // in USD
  requestDurationMs: integer("request_duration_ms"),
  createdAt: integer("created_at", { mode: "timestamp" })
    .notNull()
    .$defaultFn(() => new Date()),
});
```

### System Prompt Structure (Sous Persona)
```typescript
// Source: User decisions from CONTEXT.md
// src/ai/system-prompt.ts

export function buildSystemPrompt(): string {
  return `You are Sous, a friendly and knowledgeable kitchen sidekick. You chat like a friend who genuinely loves cooking -- warm, casual, and enthusiastic.

## Your Personality
- You're warm and encouraging ("oh nice, that stromboli sounds amazing!")
- You actively suggest ideas and follow up on past conversations
- You're a real cooking nerd who gets excited about techniques and flavors
- You keep things casual -- no corporate assistant vibes

## Your Boundaries
- You ONLY discuss food, cooking, meal planning, recipes, ingredients, kitchen tips, and related topics
- If someone asks about non-food topics, politely decline: "Ha, I only know my way around a kitchen! But I can help you figure out dinner if you want."
- Never break character or acknowledge being an AI

## How You Communicate
- Keep responses conversational and concise (1-3 short paragraphs unless the user asks for detail)
- Use casual language, occasional enthusiasm, but don't overdo exclamation marks
- When suggesting recipes or meals, be specific and practical
- Ask follow-up questions to understand preferences and constraints
- Use HTML formatting for Telegram: <b>bold</b> for emphasis, <code>code</code> for measurements`;
}
```

### Modified Message Handler (Enqueue Pattern)
```typescript
// Source: grammY Composer pattern from existing src/bot/handlers/message.ts
// src/bot/handlers/message.ts (Phase 2 modification)

import { Composer } from "grammy";
import type { BotContext } from "../context.js";
import { enqueueMessage } from "../../pipeline/message-queue.js";
import { processMessageBatch } from "../../pipeline/processor.js";

export const messageHandler = new Composer<BotContext>();

messageHandler.on("message:text", (ctx) => {
  const chatId = String(ctx.chat.id);
  const userId = String(ctx.from?.id ?? "unknown");
  const text = ctx.message.text;

  // Enqueue and return immediately -- do NOT await Claude here
  enqueueMessage(chatId, userId, text, ctx, processMessageBatch);
});
```

### /costs Admin Command
```typescript
// Source: grammY command handler pattern + user decision for admin-only /costs
// src/bot/handlers/costs.ts

import { Composer } from "grammy";
import type { BotContext } from "../context.js";
import { config } from "../../config.js";

export const costsHandler = new Composer<BotContext>();

costsHandler.command("costs", async (ctx) => {
  const userId = String(ctx.from?.id ?? "");

  if (!config.adminUserIds.includes(userId)) {
    // Silently ignore non-admin users
    return;
  }

  // Query token_usage table for summary
  // (Implementation depends on how db is injected into context)
  const summary = await getUsageSummary(/* db instance */);

  await ctx.reply(
    `<b>Usage Summary</b>\n\n` +
    `Total requests: ${summary.totalRequests}\n` +
    `Total cost: $${summary.totalCost.toFixed(4)}\n` +
    `Cache hit rate: ${summary.cacheHitRate}%`
  );
});
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| `client.beta.promptCaching.messages.create()` | `client.messages.create()` with `cache_control` | GA release Dec 2024 | Prompt caching is now standard -- no beta prefix needed |
| `claude-3-haiku-20240307` | `claude-haiku-4-5-20251001` | Oct 2025 | Haiku 4.5 matches Sonnet 4 performance, supports extended thinking, 64K output |
| Organization-level cache isolation | Workspace-level cache isolation | Feb 5, 2026 | Caches now isolated per workspace, not per org |
| 5-minute cache only | 5-minute or 1-hour cache TTL | 2025 | `cache_control: { type: "ephemeral", ttl: "1h" }` for longer cache |

**Deprecated/outdated:**
- `client.beta.promptCaching.messages.create()`: Throws `TypeError: Cannot read properties of undefined`. Use `client.messages.create()` directly.
- `claude-3-haiku-20240307`: Still available but outperformed by Haiku 4.5 at minimal cost increase ($0.25 -> $1.00 per MTok input).
- `anthropic-beta: prompt-caching-2024-07-31` header: No longer needed. Prompt caching works without any beta headers.

## Model Selection Recommendation

For a personal cooking assistant bot, **Claude Haiku 4.5** (`claude-haiku-4-5-20251001`) is the recommended model:

| Factor | Haiku 4.5 | Sonnet 4.5 | Why Haiku Wins Here |
|--------|-----------|------------|---------------------|
| Input cost | $1/MTok | $3/MTok | 3x cheaper input |
| Output cost | $5/MTok | $15/MTok | 3x cheaper output |
| Cache read cost | $0.10/MTok | $0.30/MTok | 3x cheaper cache reads |
| Latency | Fastest | Fast | Sub-second for short queries |
| Quality | Near-frontier intelligence | Frontier intelligence | More than sufficient for conversational cooking advice |
| Context window | 200K tokens | 200K tokens | Same |
| Max output | 64K tokens | 64K tokens | Same |

The system prompt and conversational cooking queries don't require frontier reasoning. Haiku 4.5's quality is excellent for this use case, and the 3x cost savings compound with every message.

Store the model name in config (`ANTHROPIC_MODEL` env var) so it can be changed without code changes.

## Debounce Window Recommendation

**Recommended: 1500ms (1.5 seconds)**

Rationale:
- Users typically send rapid-fire messages in 200-800ms bursts when splitting a thought across multiple messages
- 1.5 seconds is long enough to catch most multi-message bursts
- Short enough that users don't feel the bot is ignoring them
- Can be tuned via environment variable (`DEBOUNCE_WINDOW_MS`)

The debounce should reset on each new message (sliding window), not be a fixed window from the first message.

## Prompt Caching Strategy

**Approach:** Add `cache_control: { type: "ephemeral" }` to the last system prompt text block.

**Current phase reality:**
- System prompt alone will be ~300-500 tokens
- Haiku 4.5 requires 4096 tokens minimum for caching to activate
- Caching will NOT activate in Phase 2 -- the system prompt is too short
- This is fine. Adding `cache_control` costs nothing when below the minimum. It simply has no effect.

**Future phases (3+):**
- When knowledge context, user preferences, or conversation history are added to the prompt, it will exceed 4096 tokens
- At that point, caching activates automatically because the `cache_control` marker is already in place
- Cache reads cost 90% less than regular input: $0.10/MTok vs $1.00/MTok for Haiku 4.5

**Verification:** Log `cache_creation_input_tokens` and `cache_read_input_tokens` from every response. In Phase 2, both should be 0. When they become non-zero in later phases, caching is working.

## Open Questions

1. **Database injection into grammY context**
   - What we know: Phase 1 creates the database in `main.ts` but doesn't pass it to handlers. The `/costs` command needs database access.
   - What's unclear: Whether to inject via grammY's `ctx.session` or via module-level singleton or via middleware.
   - Recommendation: Use grammY's `ctx` flavor pattern to add a `db` property, or pass it through a closure when creating handlers. Research the grammY context flavors pattern if needed. Alternatively, a simple module-level reference works for single-instance deployment.

2. **Zod 4 compatibility with @anthropic-ai/sdk**
   - What we know: The SDK's `betaZodTool` helper uses `zod-to-json-schema` internally. Zod 4 has known incompatibilities with this converter. However, Phase 2 does NOT use tool calling -- it only uses `messages.create()` with text.
   - What's unclear: Whether future phases needing tool calling will have issues.
   - Recommendation: Not a blocker for Phase 2. Revisit when adding tools in later phases. For now, don't install Zod at all -- it's not needed for basic message creation.

3. **Webhook vs polling mode for async processing**
   - What we know: In polling mode, grammY handles updates sequentially by default, so the debounce queue still works. In webhook mode, the async pattern is critical.
   - What's unclear: Whether the debounce queue behaves identically in both modes.
   - Recommendation: Design the queue to work in both modes. In polling mode, the middleware completes synchronously (enqueue returns immediately), and the timer fires processing later. Same pattern, just no webhook timeout pressure.

## Sources

### Primary (HIGH confidence)
- [Anthropic Prompt Caching Docs](https://platform.claude.com/docs/en/build-with-claude/prompt-caching) - Full caching API, TypeScript examples, pricing, minimum token requirements, GA status confirmed
- [Anthropic Models Overview](https://platform.claude.com/docs/en/about-claude/models/overview) - Model IDs, pricing, context windows, capabilities
- [Anthropic Pricing Docs](https://platform.claude.com/docs/en/about-claude/pricing) - Exact per-model pricing including cache read/write rates
- [Anthropic API Errors](https://platform.claude.com/docs/en/api/errors) - Error types, HTTP status codes, request size limits
- [Anthropic SDK TypeScript GitHub](https://github.com/anthropics/anthropic-sdk-typescript) - SDK API reference, types, configuration options
- [@anthropic-ai/sdk npm](https://www.npmjs.com/package/@anthropic-ai/sdk) - v0.73.0 confirmed as latest
- [grammY Deployment Types](https://grammy.dev/guide/deployment-types) - Webhook timeout behavior, "return" mode warnings, async queue recommendation
- [grammY webhookCallback Reference](https://grammy.dev/ref/core/webhookcallback) - Default 10s timeout, onTimeout options

### Secondary (MEDIUM confidence)
- [Anthropic SDK TypeScript api.md](https://github.com/anthropics/anthropic-sdk-typescript/blob/main/api.md) - Type exports, error hierarchy
- Web search results confirming SDK defaults: maxRetries=2, timeout=10 minutes

### Tertiary (LOW confidence)
- None -- all critical claims verified with official sources

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - Official SDK is the only sensible choice, verified current version
- Architecture: HIGH - Patterns derived from official grammY docs and Anthropic SDK docs
- Prompt caching: HIGH - Verified GA status, exact API format, minimum token requirements from official docs
- Model selection: HIGH - Pricing and capabilities from official models page
- Pitfalls: HIGH - Webhook timeout documented by grammY, caching minimum from Anthropic docs
- Debounce timing: MEDIUM - Recommended based on UX patterns, not empirically tested for this specific use case

**Research date:** 2026-02-06
**Valid until:** 2026-03-06 (30 days -- Anthropic SDK moves fast but core patterns are stable)
