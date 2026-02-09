# Architecture Research

**Domain:** Conversational AI Meal Planning Assistant (Telegram + Claude API)
**Researched:** 2026-02-05
**Confidence:** HIGH (core patterns verified via official Telegram Bot API docs, Anthropic API docs, and multiple credible sources)

---

## Standard Architecture

### System Overview

```
                          EXTERNAL SERVICES
    ┌──────────────────┐                    ┌──────────────────┐
    │   Telegram API   │                    │   Claude API     │
    │  (Bot + Updates) │                    │  (Messages API)  │
    └────────┬─────────┘                    └────────┬─────────┘
             │ HTTPS webhook                         │ HTTPS
             │ (push updates)                        │ (on-demand)
    ═════════╪═══════════════════════════════════════╪══════════════
             │              YOUR SERVER              │
    ┌────────▼─────────┐                    ┌────────▼─────────┐
    │  Webhook Handler │    enqueue job     │  Claude Service  │
    │  (Express/HTTP)  ├───────────────►    │  (API wrapper)   │
    │  Responds 200    │                    │  Prompt builder  │
    │  immediately     │                    │  Cost tracking   │
    └──────────────────┘                    └────────▲─────────┘
             │                                       │
    ┌────────▼─────────┐    calls Claude    ┌────────┴─────────┐
    │   Message Queue  ├──────────────────► │  Message Worker  │
    │  (in-process or  │                    │  Processes jobs   │
    │   BullMQ+Redis)  │◄──────────────────┤  Sends replies   │
    └──────────────────┘   job complete     └────────┬─────────┘
                                                     │
    ┌────────────────────────────────────────────────┤
    │                DATA LAYER                      │
    │  ┌──────────┐  ┌──────────┐  ┌──────────────┐ │
    │  │ Recipes  │  │ Prefs &  │  │ Conversation │ │
    │  │ Store    │  │ Knowledge│  │ History      │ │
    │  └──────────┘  └──────────┘  └──────────────┘ │
    │  ┌──────────┐  ┌──────────┐                   │
    │  │ Reminders│  │ Meal     │                   │
    │  │ (sched.) │  │ Plans    │                   │
    │  └─────┬────┘  └──────────┘                   │
    │        │         SQLite Database               │
    └────────┼───────────────────────────────────────┘
             │
    ┌────────▼─────────┐
    │ Reminder Poller  │    Checks DB every 1-2 min
    │ (cron/interval)  ├──► Sends due reminders via Telegram API
    └──────────────────┘
```

### Component Responsibilities

| Component | Responsibility | Typical Implementation |
|-----------|----------------|------------------------|
| **Webhook Handler** | Receive Telegram updates, validate secret token, respond 200 immediately, enqueue processing job | Express.js route or grammY/Telegraf webhookCallback |
| **Message Queue** | Decouple webhook receipt from processing; buffer jobs when Claude is slow | In-process async queue (v1), BullMQ + Redis (if scaling needed) |
| **Message Worker** | Process queued messages: retrieve context, call Claude, format response, send reply via Telegram | Async function consuming from queue |
| **Claude Service** | Build prompts from system instructions + injected context + conversation, call Claude API, track token usage, handle errors/retries | Wrapper around @anthropic-ai/sdk |
| **Knowledge Retriever** | Query DB for relevant recipes, preferences, and context based on user message; inject into prompt | SQL queries against SQLite, possibly with keyword matching |
| **Telegram Sender** | Send messages back to user, handle message splitting (4096 char limit), format as HTML, send typing indicators, manage rate limits | Wrapper around Telegram Bot API sendMessage/sendChatAction |
| **Reminder Poller** | Periodically check database for due reminders; send them via Telegram; mark as sent; handle missed reminders on startup | setInterval or node-cron polling SQLite every 1-2 minutes |
| **Data Layer (SQLite)** | Persist all state: recipes, preferences, conversation history, reminders, meal plans | SQLite via better-sqlite3 or drizzle ORM |
| **Conversation Manager** | Maintain recent conversation window; summarize older turns; manage context budget | Application logic managing conversation_history table |

---

## Recommended Project Structure

```
src/
├── index.ts                # Entry point: start server, set webhook, start poller
├── config.ts               # Environment variables, constants, token budgets
├── server/                 # HTTP layer
│   ├── webhook.ts          # POST /webhook handler: validate, enqueue, respond 200
│   └── health.ts           # GET /health for monitoring
├── bot/                    # Telegram bot logic
│   ├── handler.ts          # Route incoming updates by type (message, callback, etc.)
│   ├── commands/           # Command handlers
│   │   ├── start.ts        # /start command (onboarding)
│   │   ├── plan.ts         # /plan command (trigger meal planning)
│   │   ├── list.ts         # /list command (show grocery list)
│   │   └── help.ts         # /help command
│   ├── sender.ts           # Message sending: splitting, formatting, typing indicator
│   └── formatter.ts        # Claude markdown -> Telegram HTML conversion
├── ai/                     # Claude integration
│   ├── client.ts           # Anthropic SDK wrapper, error handling, retries
│   ├── prompts/            # System prompts and prompt templates
│   │   ├── system.ts       # Base system prompt
│   │   ├── meal-plan.ts    # Meal planning specific prompt additions
│   │   └── recipe.ts       # Recipe retrieval/storage prompts
│   ├── context-builder.ts  # Assemble prompt: system + retrieved knowledge + conversation
│   └── cost-tracker.ts     # Log token usage per feature, track costs
├── knowledge/              # Knowledge retrieval and storage
│   ├── retriever.ts        # Query DB for relevant context given user message
│   ├── recipes.ts          # Recipe CRUD operations
│   ├── preferences.ts      # Preference read/write
│   └── conversation.ts     # Conversation history windowing and summarization
├── scheduler/              # Reminder system
│   ├── poller.ts           # Periodic check for due reminders
│   ├── reminders.ts        # Reminder CRUD, timezone handling
│   └── parser.ts           # Extract reminder needs from Claude output
├── queue/                  # Message processing queue
│   ├── queue.ts            # Queue implementation (in-process for v1)
│   └── worker.ts           # Job processor: retrieve context -> Claude -> send reply
├── db/                     # Database layer
│   ├── connection.ts       # SQLite connection setup
│   ├── migrations/         # Schema migrations
│   │   └── 001-initial.ts  # Initial tables
│   ├── schema.ts           # Table definitions (if using ORM)
│   └── queries/            # Named query functions
│       ├── recipes.ts
│       ├── preferences.ts
│       ├── conversations.ts
│       ├── reminders.ts
│       └── meal-plans.ts
└── utils/                  # Shared utilities
    ├── logger.ts           # Structured logging (pino or similar)
    ├── errors.ts           # Custom error types
    └── retry.ts            # Exponential backoff utility
```

### Structure Rationale

- **`server/`:** Isolated HTTP concerns. The webhook handler does one thing: validate and enqueue. This keeps the hot path (responding 200 to Telegram) free of any slow operations.
- **`bot/`:** Telegram-specific logic. Commands, message formatting, sending. Nothing about Claude or data storage leaks in here.
- **`ai/`:** Everything Claude-related. Prompt construction, API calls, cost tracking. Isolated so you can swap models, adjust prompts, or add model routing without touching bot or data code.
- **`knowledge/`:** The retrieval layer that sits between the database and the AI layer. Decides what context to inject. This is the critical boundary that prevents unbounded context growth.
- **`scheduler/`:** Self-contained reminder system. Polls the database independently of the main message flow. Can be tested and debugged in isolation.
- **`queue/`:** Decouples webhook receipt from processing. v1 can be a simple in-process async queue (a Promise chain or p-queue). If multi-user scaling is needed later, swap to BullMQ without changing the worker logic.
- **`db/`:** Data access only. No business logic. Returns data, not decisions.

---

## Architectural Patterns

### Pattern 1: Async Webhook with Immediate Acknowledgment

**What:** Receive Telegram webhook, respond 200 instantly, process the message in a background job. This is the most critical architectural pattern for this system.

**When to use:** Always. Telegram expects a fast HTTP response. Claude API calls take 3-15 seconds. You cannot do both in the same HTTP request cycle.

**Trade-offs:**
- PRO: Telegram never times out, no missed messages, no duplicate deliveries
- PRO: Can show "typing..." indicator while processing
- CON: Slightly more complex than synchronous handling
- CON: Need to handle job failures (what if Claude call fails after webhook was acknowledged?)

**Evidence:** The grammY framework documentation explicitly recommends this pattern: "Instead of trying to perform all of the work in the small webhook timeout window, just append the task to the queue to be handled separately, and let your middleware complete." Telegram's own Bot API retries on non-2XX responses and slow responses (default ~30 seconds, but grammY implements a 10-second internal timeout). (Source: [grammY Deployment Types](https://grammy.dev/guide/deployment-types.html), HIGH confidence)

**Example:**
```typescript
// server/webhook.ts
import express from 'express';
import { processMessage } from '../queue/queue';

const app = express();

app.post('/webhook', express.json(), (req, res) => {
  const secretToken = req.headers['x-telegram-bot-api-secret-token'];
  if (secretToken !== process.env.WEBHOOK_SECRET) {
    return res.sendStatus(403);
  }

  // Enqueue and respond immediately
  const update = req.body;
  processMessage(update).catch(err => {
    logger.error({ err, updateId: update.update_id }, 'Failed to process update');
  });

  res.sendStatus(200);
});
```

```typescript
// queue/worker.ts
export async function handleMessage(update: TelegramUpdate): Promise<void> {
  const chatId = update.message?.chat.id;
  if (!chatId) return;

  // 1. Send typing indicator (repeat every 4 seconds while processing)
  const typingInterval = setInterval(() => {
    telegram.sendChatAction(chatId, 'typing');
  }, 4000);
  telegram.sendChatAction(chatId, 'typing');

  try {
    // 2. Retrieve relevant context from knowledge store
    const context = await knowledgeRetriever.getRelevantContext(
      update.message.text,
      chatId
    );

    // 3. Build prompt and call Claude
    const response = await claudeService.generateResponse({
      userMessage: update.message.text,
      systemPrompt: buildSystemPrompt(),
      injectedContext: context,
      conversationHistory: await conversationManager.getRecentTurns(chatId),
      maxTokens: 1024,
    });

    // 4. Format and send response
    await telegramSender.sendResponse(chatId, response);

    // 5. Store conversation turn
    await conversationManager.saveTurn(chatId, update.message.text, response);

  } finally {
    clearInterval(typingInterval);
  }
}
```

**Confidence:** HIGH -- verified against official Telegram Bot API docs, grammY documentation, and the established pattern for Telegram + LLM bots across multiple sources.

---

### Pattern 2: Retrieval-Before-Generation (Selective Context Injection)

**What:** Before every Claude API call, query the knowledge store for relevant items and inject only those into the prompt. Never send all knowledge. This is a lightweight RAG pattern without embeddings.

**When to use:** Every Claude API call that needs to reference user knowledge (recipes, preferences, history).

**Trade-offs:**
- PRO: Keeps token costs bounded and predictable
- PRO: Prevents context window overflow as knowledge grows
- PRO: Forces explicit knowledge management from day one
- CON: Relevance of retrieval depends on query quality
- CON: May miss relevant context if retrieval is too narrow

**Evidence:** This is the core recommendation from the PITFALLS.md research (Pitfall 1: Unbounded context growth). The Stevens AI assistant (a real Telegram + Claude personal assistant) uses exactly this pattern: "Memory contents can be any arbitrary text, since they'll just be fed back into an LLM later anyways." It stores knowledge in a SQLite table and injects relevant entries per query. (Source: [Stevens article](https://www.geoffreylitt.com/2025/04/12/how-i-made-a-useful-ai-assistant-with-one-sqlite-table-and-a-handful-of-cron-jobs), MEDIUM confidence)

**Implementation approach for v1 (no embeddings, keyword-based):**
```typescript
// knowledge/retriever.ts
export async function getRelevantContext(
  userMessage: string,
  chatId: number
): Promise<InjectedContext> {
  // 1. Always inject: active preferences, current meal plan, user profile
  const preferences = await db.getActivePreferences(chatId);
  const currentPlan = await db.getCurrentMealPlan(chatId);

  // 2. Conditionally inject: recipes mentioned or relevant
  const mentionedRecipes = await db.searchRecipes(chatId, userMessage);

  // 3. Recent conversation summary (not full history)
  const conversationSummary = await db.getConversationSummary(chatId);

  // 4. Enforce token budget
  return buildContextWithinBudget({
    preferences,       // ~200-500 tokens
    currentPlan,       // ~300-800 tokens
    mentionedRecipes,  // ~500-2000 tokens per recipe
    conversationSummary, // ~200-500 tokens
    budget: 4000,      // Hard cap: 4K tokens of injected context
  });
}
```

**Confidence:** HIGH for the pattern itself. MEDIUM for the specific v1 keyword approach (may need to graduate to embeddings if keyword matching proves too blunt).

---

### Pattern 3: Persistent Reminder Polling

**What:** Store all reminders in the database with their target delivery time. A poller process checks for due reminders every 1-2 minutes. Never rely on in-memory timers (setTimeout, node-cron) for user-facing reminders.

**When to use:** All scheduled reminders (defrost, start cooking, meal plan review).

**Trade-offs:**
- PRO: Survives process restarts, deploys, and crashes
- PRO: Missed reminders on startup can be detected and sent late with explanation
- PRO: Easy to query, debug, and audit
- CON: 1-2 minute delivery granularity (not sub-minute precision)
- CON: Requires database polling (minor CPU cost)

**Evidence:** PITFALLS.md Pitfall 4 documents this as a critical issue. The spec's success metric is "zero missed defrost/prep reminders." node-cron documentation itself warns: "node-cron doesn't provide job persistence, meaning that if your Node.js app restarts, all previously scheduled jobs are lost." (Source: [node-cron docs](https://betterstack.com/community/guides/scaling-nodejs/node-cron-scheduled-tasks/), HIGH confidence for the problem; pattern is standard distributed systems practice)

**Example:**
```typescript
// scheduler/poller.ts
export function startReminderPoller(intervalMs: number = 60_000): void {
  // On startup, check for any reminders that were missed during downtime
  checkAndSendDueReminders(true);

  // Then poll regularly
  setInterval(() => checkAndSendDueReminders(false), intervalMs);
}

async function checkAndSendDueReminders(isStartup: boolean): Promise<void> {
  const now = new Date();
  const dueReminders = await db.getDueReminders(now);

  for (const reminder of dueReminders) {
    // Idempotency: mark as "sending" before actually sending
    const claimed = await db.claimReminder(reminder.id);
    if (!claimed) continue; // Another process already claimed it

    const wasLate = (now.getTime() - reminder.dueAt.getTime()) > 5 * 60 * 1000;
    const message = wasLate
      ? `(Apologies for the late reminder!) ${reminder.message}`
      : reminder.message;

    try {
      await telegram.sendMessage(reminder.chatId, message);
      await db.markReminderSent(reminder.id);
    } catch (err) {
      await db.markReminderFailed(reminder.id, err.message);
    }
  }
}
```

**Confidence:** HIGH -- fundamental pattern for reliable scheduled delivery.

---

### Pattern 4: Conversation Windowing with Summarization

**What:** Keep the last N conversation turns (e.g., 10-20) in full detail. Periodically summarize older turns into a compact summary. Send the summary + recent turns to Claude, not the full history.

**When to use:** Every conversation that spans more than ~20 turns.

**Trade-offs:**
- PRO: Bounded token cost per request regardless of conversation length
- PRO: Claude maintains coherent context within a session
- PRO: Summaries preserve key decisions and preferences from older turns
- CON: Summarization itself costs tokens (but can use Haiku for this)
- CON: Some nuance from older turns may be lost in summarization

**Example:**
```typescript
// knowledge/conversation.ts
const MAX_RECENT_TURNS = 10;
const SUMMARY_TRIGGER = 20; // Summarize when history exceeds this

export async function getConversationForPrompt(chatId: number) {
  const turns = await db.getConversationHistory(chatId);

  if (turns.length <= MAX_RECENT_TURNS) {
    return { summary: null, recentTurns: turns };
  }

  // Get or create summary of older turns
  let summary = await db.getConversationSummary(chatId);
  if (turns.length > SUMMARY_TRIGGER && needsResummarization(summary, turns)) {
    const olderTurns = turns.slice(0, -MAX_RECENT_TURNS);
    summary = await claudeService.summarizeConversation(olderTurns, {
      model: 'claude-haiku-4.5', // Use cheap model for summarization
      maxTokens: 300,
    });
    await db.saveConversationSummary(chatId, summary);
  }

  return {
    summary,
    recentTurns: turns.slice(-MAX_RECENT_TURNS),
  };
}
```

**Confidence:** MEDIUM -- the pattern is well-established in LLM application design. The specific turn counts and trigger thresholds need tuning during implementation.

---

### Pattern 5: HTML Formatting over MarkdownV2

**What:** Use Telegram's HTML parse mode instead of MarkdownV2 for all bot messages. Instruct Claude to output simple HTML or plain text, then post-process.

**When to use:** All message sending to Telegram.

**Trade-offs:**
- PRO: Far fewer escaping issues than MarkdownV2 (only `<`, `>`, `&` need escaping)
- PRO: Claude can be instructed to output HTML naturally
- PRO: Supports all needed formatting: bold, italic, code, links
- CON: HTML less readable in prompts/logs than Markdown
- CON: Some Telegram formatting features (spoilers, custom emoji) require specific HTML tags

**Evidence:** PITFALLS.md Pitfall 6 documents MarkdownV2 escaping as a persistent source of bugs. Telegram Bot API docs confirm HTML parse mode supports: `<b>`, `<i>`, `<code>`, `<pre>`, `<a>`, `<s>`, `<u>`, `<blockquote>`, `<tg-spoiler>`. Only three characters need escaping: `<`, `>`, `&`. (Source: [Telegram Bot API](https://core.telegram.org/bots/api), HIGH confidence)

**Confidence:** HIGH -- straightforward Telegram API feature, verified.

---

## Data Flow

### Request Flow: User Message to Bot Response

```
User sends message in Telegram
    │
    ▼
Telegram delivers webhook POST to /webhook
    │
    ▼
Webhook Handler: validate secret_token header
    │
    ├──► Invalid: respond 403, done
    │
    ▼
    Respond HTTP 200 immediately
    │
    ▼
    Enqueue message for async processing
    │
    ▼
Worker picks up job
    │
    ├──► sendChatAction("typing") to Telegram (repeat every 4s)
    │
    ▼
Knowledge Retriever: query DB for relevant context
    │
    ├── Active user preferences
    ├── Current meal plan (if any)
    ├── Recipes matching user's message keywords
    └── Recent conversation summary + last N turns
    │
    ▼
Context Builder: assemble Claude prompt
    │
    ├── System prompt (static, cached via prompt caching)
    ├── Injected knowledge context (variable, within 4K token budget)
    ├── Conversation history (summary + recent turns)
    └── User's current message
    │
    ▼
Claude Service: call messages.create()
    │
    ├── model: claude-sonnet-4.5 (reasoning) or claude-haiku-4.5 (simple tasks)
    ├── max_tokens: 1024 (conversation) or 2048 (meal plans)
    ├── cache_control on system prompt (saves ~90% on stable prefix)
    └── Log: input_tokens, output_tokens, cache_read_tokens, feature tag
    │
    ▼
Response Post-Processing
    │
    ├── Extract any structured data (reminders to schedule, preferences to store)
    ├── Convert Claude output to Telegram HTML format
    ├── Split if > 4096 characters
    └── Check for action items (save recipe, update preference, schedule reminder)
    │
    ▼
Telegram Sender: send formatted message(s)
    │
    ├── sendMessage with parse_mode: "HTML"
    ├── If sending fails with parse error, retry without parse_mode
    └── If multiple splits, send with small delays to preserve order
    │
    ▼
Conversation Manager: save turn to database
    │
    ├── Store user message + assistant response
    ├── Trigger summarization if history exceeds threshold
    └── Execute any side effects (save recipe, update preference, create reminder)
```

### Reminder Flow

```
Claude generates meal plan response
    │
    ▼
Response Parser: extract reminder needs from Claude's output
    │
    ├── "Chicken needs defrosting → Tuesday 8am reminder"
    ├── "Start marinating → Wednesday 4pm reminder"
    │
    ▼
Reminder Service: save to DB with target time (user timezone → UTC)
    │
    ▼
    ... time passes ...
    │
    ▼
Reminder Poller (every 60s): SELECT * FROM reminders WHERE due_at <= NOW() AND status = 'pending'
    │
    ▼
    For each due reminder:
    ├── Claim (set status = 'sending', prevents double-send)
    ├── Send via Telegram sendMessage
    ├── Include inline keyboard: [Done] [Snooze 1h] [Remind later]
    └── Mark status = 'sent' (or 'failed' with retry)
    │
    ▼
User taps callback button
    │
    ▼
Callback Handler: update reminder status in DB
    ├── Done → status = 'completed'
    ├── Snooze → new due_at = now + 1h, status = 'pending'
    └── Remind later → new due_at = user-specified, status = 'pending'
```

### Key Data Flows

1. **Message Processing:** Telegram webhook -> queue -> knowledge retrieval -> Claude API -> format -> Telegram send. The critical constraint is that webhook acknowledgment and Claude processing are fully decoupled.

2. **Knowledge Accumulation:** Claude response -> parser extracts facts (recipe updates, preference changes, timing corrections) -> DB writes. Knowledge enters the system as a side effect of conversation, not through dedicated input flows.

3. **Reminder Lifecycle:** Claude suggests reminders -> DB insert -> poller fires -> Telegram notification -> user interaction -> DB update. The entire lifecycle is database-driven, never in-memory.

4. **Context Assembly:** User message triggers retrieval query -> DB returns relevant items -> context builder assembles within token budget -> prompt sent to Claude. This is the flow that prevents unbounded context growth.

---

## Scaling Considerations

| Scale | Architecture Adjustments |
|-------|--------------------------|
| 1 user (v1) | Single Node.js process. In-process async queue (p-queue or simple Promise chain). SQLite file database. Polling reminders via setInterval. No Redis needed. This is the target architecture. |
| 2-10 users | Same architecture works. SQLite handles concurrent reads well. May need WAL mode for concurrent writes. Add per-user rate limiting on Claude calls. Monitor costs closely. |
| 10-100 users | Consider moving queue to BullMQ + Redis for better job management. SQLite may need migration to PostgreSQL for concurrent write-heavy workloads. Add model routing (Haiku for simple tasks). |
| 100+ users | Separate webhook server from worker processes. PostgreSQL required. BullMQ for job distribution. Multiple worker processes. Consider embedding-based retrieval instead of keyword search. This is well beyond v1 scope. |

### Scaling Priorities

1. **First bottleneck: Claude API costs.** At ~$3/MTok input (Sonnet) with an average of 5K tokens per request and 20 requests/day/user, cost is ~$0.30/day/user or ~$9/month/user. The first optimization is model routing: use Haiku ($1/MTok input) for simple tasks, Sonnet for complex reasoning. Second optimization is prompt caching (90% reduction on cached system prompt tokens).

2. **Second bottleneck: SQLite write concurrency.** SQLite with WAL mode handles many concurrent readers but serializes writes. For a single user this is irrelevant. For 10+ active users all generating meal plans simultaneously, write contention could cause delays. Migration path: switch to PostgreSQL (the query/schema layer should be abstracted enough to make this a configuration change, not a rewrite).

3. **Third bottleneck: Webhook processing throughput.** If the single Node.js process is overwhelmed by incoming webhooks (unlikely below 100 users), the fix is separating the webhook server (responds 200) from the worker (processes jobs) and connecting them via BullMQ + Redis.

---

## Anti-Patterns

### Anti-Pattern 1: Synchronous Webhook Processing

**What people do:** Call Claude API directly inside the webhook HTTP handler and return the response.

**Why it's wrong:** Claude takes 3-15 seconds. Telegram times out webhook deliveries and retries, causing duplicate processing. If Claude is slow or down, ALL incoming messages fail. The grammY framework throws an error if middleware takes >10 seconds specifically to prevent this.

**Do this instead:** Acknowledge the webhook with 200 immediately. Process the message asynchronously. Send the reply via a separate sendMessage API call.

**Confidence:** HIGH -- verified via grammY docs and Telegram Bot API behavior.

---

### Anti-Pattern 2: Full Context Every Call

**What people do:** Append every conversation turn, every recipe, every preference to the messages array and send it all to Claude on every API call. "It works and Claude has 200K context!"

**Why it's wrong:** Token costs grow linearly with knowledge. At 50 recipes (avg 500 tokens each = 25K tokens) + conversation history (grows unbounded), each API call becomes expensive ($0.075+ just for recipe context at Sonnet pricing). Response latency also increases with input size.

**Do this instead:** Retrieve selectively. Inject only the 2-5 most relevant recipes, the active meal plan, and a conversation summary. Budget total injected context to 4-6K tokens. Use prompt caching for the stable system prompt portion.

**Confidence:** HIGH -- verified via Anthropic pricing docs, standard RAG pattern.

---

### Anti-Pattern 3: In-Memory Reminder Scheduling

**What people do:** Use setTimeout or node-cron to schedule reminders when Claude suggests them. Works perfectly in development.

**Why it's wrong:** All reminders are lost on process restart (deploys, crashes, host reboots). This is the #1 most impactful failure for this specific product: missed defrost reminders mean ruined dinners.

**Do this instead:** Store reminders in the database with UTC target time. Poll for due reminders. On startup, immediately check for any past-due reminders that were missed during downtime.

**Confidence:** HIGH -- fundamental distributed systems principle.

---

### Anti-Pattern 4: Raw Claude Output to Telegram

**What people do:** Take Claude's text response and pass it directly to Telegram sendMessage with parse_mode: "MarkdownV2".

**Why it's wrong:** Claude outputs standard Markdown. Telegram's MarkdownV2 requires escaping of characters that are not special in standard Markdown (`.`, `-`, `(`, `)`, `!`, `+`, `=`, etc.). Every unescaped character causes a 400 error and the user sees nothing.

**Do this instead:** Use HTML parse_mode. Build a formatter that converts Claude's output to simple HTML. Have a fallback: if HTML send fails, retry with no parse mode so the user at least sees the content as plain text.

**Confidence:** HIGH -- verified via Telegram Bot API docs and PITFALLS.md.

---

### Anti-Pattern 5: Monolithic Message Handler

**What people do:** Put all logic in one giant handler function: receive message -> query DB -> build prompt -> call Claude -> parse response -> save to DB -> send reply -> schedule reminders. One function, 500+ lines.

**Why it's wrong:** Untestable, undebuggable, impossible to modify one concern without risking others. When Claude's API changes, you're editing the same file as your Telegram formatting logic.

**Do this instead:** Each concern gets its own module. The worker orchestrates them but each step is a separate, testable function. The project structure above enforces this separation.

**Confidence:** HIGH -- standard software engineering principle.

---

## Integration Points

### External Services

| Service | Integration Pattern | Notes |
|---------|---------------------|-------|
| **Telegram Bot API** | Webhook (receive) + REST API (send). Use secret_token for webhook validation. Set webhook via setWebhook on startup. | Webhook URL must be HTTPS with valid cert. Ports: 443, 80, 88, 8443. Max 40 concurrent connections (configurable via max_connections). Source: [Telegram Bot API](https://core.telegram.org/bots/api) |
| **Claude API** | REST API via @anthropic-ai/sdk TypeScript SDK. messages.create() for each interaction. Prompt caching via cache_control on system prompt blocks. | Min 1024 tokens for cache on Sonnet. 5-minute default TTL, refreshed on each use. Cache read cost is 10% of base input price. Source: [Anthropic Prompt Caching Docs](https://platform.claude.com/docs/en/docs/build-with-claude/prompt-caching) |
| **Recipe URLs** | WebFetch for URL scraping when user shares a recipe link. Look for JSON-LD schema.org/Recipe structured data first (most reliable), fall back to HTML parsing. | Sites change layouts and block bots. Always have a graceful fallback ("I couldn't parse that URL, can you paste the recipe?"). |

### Internal Boundaries

| Boundary | Communication | Notes |
|----------|---------------|-------|
| Webhook Handler <-> Worker | Async queue (function call in v1, BullMQ in later versions) | The queue is the key decoupling point. Webhook handler must NEVER await the worker. |
| Worker <-> Claude Service | Direct async function call | Worker calls claudeService.generateResponse() and awaits the result. This is where the 3-15 second wait happens. |
| Worker <-> Knowledge Retriever | Direct async function call | Retriever queries DB and returns structured context. Must complete quickly (<<1 second). |
| Worker <-> Telegram Sender | Direct async function call | Sender handles formatting and splitting. May make multiple sendMessage calls for long responses. |
| Reminder Poller <-> Telegram Sender | Direct async function call | Poller is an independent loop. Shares the Telegram sender module but operates on its own schedule. |
| All components <-> DB | Direct function calls via db module | All database access goes through the db layer. No component queries SQLite directly. This abstraction enables future migration to PostgreSQL. |

---

## Database Schema (Conceptual)

This is the logical schema. The actual implementation should use migrations.

```sql
-- User (single user v1, but schema supports multi-user)
CREATE TABLE users (
  id INTEGER PRIMARY KEY,
  telegram_chat_id INTEGER UNIQUE NOT NULL,
  timezone TEXT DEFAULT 'America/New_York',
  created_at TEXT DEFAULT (datetime('now'))
);

-- Recipes as content (LLM-native: text, not rigid fields)
CREATE TABLE recipes (
  id INTEGER PRIMARY KEY,
  user_id INTEGER REFERENCES users(id),
  name TEXT NOT NULL,
  content TEXT NOT NULL,          -- Full recipe text (Claude reasons over this)
  user_notes TEXT,                -- User's personal notes, timing corrections
  source_url TEXT,                -- Original URL if imported
  last_made_at TEXT,
  times_made INTEGER DEFAULT 0,
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now'))
);

-- Preferences as key-value with context
CREATE TABLE preferences (
  id INTEGER PRIMARY KEY,
  user_id INTEGER REFERENCES users(id),
  category TEXT NOT NULL,         -- 'dietary', 'schedule', 'shopping', 'goal'
  content TEXT NOT NULL,          -- Natural language preference
  active INTEGER DEFAULT 1,
  created_at TEXT DEFAULT (datetime('now'))
);

-- Conversation history
CREATE TABLE conversation_turns (
  id INTEGER PRIMARY KEY,
  user_id INTEGER REFERENCES users(id),
  role TEXT NOT NULL,             -- 'user' or 'assistant'
  content TEXT NOT NULL,
  token_count INTEGER,
  created_at TEXT DEFAULT (datetime('now'))
);

-- Conversation summaries (for older turns)
CREATE TABLE conversation_summaries (
  id INTEGER PRIMARY KEY,
  user_id INTEGER REFERENCES users(id),
  summary TEXT NOT NULL,
  covers_up_to_turn_id INTEGER,  -- Last turn ID included in summary
  created_at TEXT DEFAULT (datetime('now'))
);

-- Reminders (persistent, survives restarts)
CREATE TABLE reminders (
  id INTEGER PRIMARY KEY,
  user_id INTEGER REFERENCES users(id),
  message TEXT NOT NULL,
  due_at TEXT NOT NULL,           -- UTC datetime
  status TEXT DEFAULT 'pending',  -- pending, sending, sent, failed, completed, snoozed
  related_recipe_id INTEGER REFERENCES recipes(id),
  related_meal_plan_id INTEGER,
  retry_count INTEGER DEFAULT 0,
  created_at TEXT DEFAULT (datetime('now'))
);

-- Meal plans
CREATE TABLE meal_plans (
  id INTEGER PRIMARY KEY,
  user_id INTEGER REFERENCES users(id),
  week_start TEXT NOT NULL,      -- Monday of the plan week
  plan_content TEXT NOT NULL,     -- Full plan as text (Claude-generated)
  status TEXT DEFAULT 'active',   -- active, completed, abandoned
  created_at TEXT DEFAULT (datetime('now'))
);

-- Token usage tracking (for cost monitoring)
CREATE TABLE token_usage (
  id INTEGER PRIMARY KEY,
  user_id INTEGER REFERENCES users(id),
  feature TEXT NOT NULL,          -- 'chat', 'meal_plan', 'recipe', 'summarize', 'reminder'
  model TEXT NOT NULL,
  input_tokens INTEGER,
  output_tokens INTEGER,
  cache_read_tokens INTEGER DEFAULT 0,
  cache_write_tokens INTEGER DEFAULT 0,
  created_at TEXT DEFAULT (datetime('now'))
);
```

**Schema design philosophy:** Recipes and preferences are stored as text content, not rigid structured fields. This aligns with the spec's "LLM-Native Architecture" principle: "Claude reads the recipe and figures out what needs defrosting, not a `requires_defrost: true` field." The database stores content; Claude provides intelligence.

---

## Build Order (Dependencies Between Components)

The components have natural dependencies that dictate build order.

### Phase 1: Foundation (Must Be First)

**Build order within Phase 1:**

1. **Database layer** (`db/`) -- everything depends on persistent storage
2. **Telegram sender** (`bot/sender.ts`, `bot/formatter.ts`) -- need to send messages before anything else works
3. **Webhook handler** (`server/webhook.ts`) -- receive messages from Telegram
4. **Simple queue** (`queue/`) -- decouple webhook from processing
5. **Claude service** (`ai/client.ts`, `ai/prompts/`) -- make Claude API calls
6. **Basic worker** (`queue/worker.ts`) -- wire everything together: receive message -> call Claude -> send reply
7. **Conversation manager** (`knowledge/conversation.ts`) -- track conversation turns

**At this point:** Bot receives messages, calls Claude, and replies. No knowledge retrieval yet (Claude works from system prompt + immediate conversation only). This is the minimum viable bot.

### Phase 2: Knowledge System

**Depends on:** Phase 1 (database, Claude service, conversation manager)

1. **Recipe storage** (`knowledge/recipes.ts`, `db/queries/recipes.ts`) -- CRUD for recipes
2. **Preference storage** (`knowledge/preferences.ts`, `db/queries/preferences.ts`) -- store user preferences
3. **Knowledge retriever** (`knowledge/retriever.ts`) -- query and inject relevant context
4. **Context builder** (`ai/context-builder.ts`) -- assemble prompt with injected knowledge
5. **Update worker** to use knowledge retriever before Claude calls

**At this point:** Bot remembers recipes and preferences, injects relevant knowledge into Claude calls, stays within token budget.

### Phase 3: Reminders

**Depends on:** Phase 2 (recipes, meal plans) and Phase 1 (Telegram sender, database)

1. **Reminder data layer** (`db/queries/reminders.ts`) -- CRUD for reminders
2. **Reminder parser** (`scheduler/parser.ts`) -- extract reminder needs from Claude output
3. **Reminder poller** (`scheduler/poller.ts`) -- periodic check for due reminders
4. **Callback handler** for reminder interactions (done/snooze)
5. **Update worker** to parse Claude responses for reminder triggers

**At this point:** System proactively sends reminders. Core product is complete.

### Phase 4: Meal Planning + Grocery Lists

**Depends on:** Phase 2 (knowledge system) and Phase 3 (reminders)

1. **Meal plan data layer** and prompts
2. **Grocery list generation** from meal plans
3. **Meal plan commands** and conversation flows
4. **Integration:** Meal plan creation automatically triggers reminder scheduling

### Phase 5: Polish and Optimization

**Depends on:** All previous phases

1. **Cost optimization:** Model routing (Haiku for simple tasks), prompt caching tuning
2. **Conversation summarization** implementation
3. **Error recovery** improvements (graceful Claude failures, Telegram retries)
4. **Cost tracking dashboard** (query token_usage table)
5. **Message deduplication** (handle Telegram webhook retries)

---

## Key Architecture Decisions and Rationale

| Decision | Choice | Rationale |
|----------|--------|-----------|
| Webhook vs Long Polling | **Webhooks** | Production-standard for deployed bots. Lower latency. Required for proper async processing pattern. Long polling is fine for local development only. |
| Bot Framework | **grammY or direct HTTP** | grammY has better TypeScript support, better docs, actively maintained, explicitly supports webhook timeout handling. Telegraf is more popular but TypeScript types are weaker. For this project, either works -- but grammY's explicit webhook timeout handling and the recommendation to use external queues align perfectly with our architecture. Direct HTTP (Express) is also viable since we're already decoupling with a queue. |
| Database | **SQLite (v1)** | Single user, single server, no concurrency issues. Zero setup. File-based. Fast reads. Perfect for v1. Migration path to PostgreSQL exists if multi-user is needed. |
| Message Queue | **In-process async queue (v1)** | For a single-user bot on a single server, BullMQ + Redis is over-engineering. A simple p-queue or even a raw async function call is sufficient. The queue interface should be abstracted so BullMQ can be swapped in later. |
| Claude Model | **Sonnet 4.5 (primary) + Haiku 4.5 (simple tasks)** | Sonnet for reasoning-heavy tasks (meal planning, recipe understanding). Haiku for classification, preference extraction, conversation summarization. Cost difference: 3x on input, 3x on output. |
| Message Format | **HTML parse_mode** | Fewer escaping issues than MarkdownV2. Claude can output simple HTML. Three characters to escape vs 20+ for MarkdownV2. |
| Reminder System | **Database polling** | Must survive restarts. 1-minute granularity is fine for meal reminders. No Redis/external dependency needed for v1. |
| Knowledge Storage | **Text content in SQLite** | LLM-native approach per spec. Recipes stored as text, not structured fields. Claude reasons over content. Simpler schema, easier to evolve. |
| Context Retrieval | **Keyword search (v1)** | Good enough for single-user with <100 recipes. No embedding infrastructure needed. Can graduate to vector search later if keyword matching is insufficient. |

---

## Sources

- [Telegram Bot API - Official Documentation](https://core.telegram.org/bots/api) -- webhook setup, setWebhook, getWebhookInfo, sendMessage, sendChatAction, message limits (HIGH confidence)
- [Telegram Bot API - Webhooks Guide](https://core.telegram.org/bots/webhooks) -- webhook infrastructure requirements (HIGH confidence)
- [grammY - Long Polling vs Webhooks](https://grammy.dev/guide/deployment-types.html) -- webhook timeout behavior (10s internal timeout), recommendation to use external queues for slow processing (HIGH confidence)
- [grammY - Framework Comparison](https://grammy.dev/resources/comparison) -- grammY vs Telegraf detailed comparison (MEDIUM confidence, authored by grammY maintainers)
- [Anthropic - Prompt Caching Documentation](https://platform.claude.com/docs/en/docs/build-with-claude/prompt-caching) -- cache_control API, pricing (cache reads at 10% of base), 5-minute TTL, minimum token requirements (HIGH confidence)
- [Anthropic - Messages API](https://platform.claude.com/docs/en/api/messages) -- API parameters, model options, streaming, system prompt format (HIGH confidence)
- [Stevens AI Assistant](https://www.geoffreylitt.com/2025/04/12/how-i-made-a-useful-ai-assistant-with-one-sqlite-table-and-a-handful-of-cron-jobs) -- real-world Telegram + Claude personal assistant using SQLite for knowledge storage (MEDIUM confidence, single case study)
- [npm trends: grammy vs telegraf](https://npmtrends.com/grammy-vs-node-telegram-bot-api-vs-telegraf-vs-telegram-bot-api) -- download statistics for framework comparison (MEDIUM confidence)
- [BullMQ Documentation](https://bullmq.io/) -- Redis-backed job queue for Node.js (HIGH confidence for BullMQ capabilities, not yet needed for v1)
- [node-cron Limitations](https://betterstack.com/community/guides/scaling-nodejs/node-cron-scheduled-tasks/) -- node-cron doesn't persist jobs across restarts (HIGH confidence)

---
*Architecture research for: Conversational AI Meal Planning Assistant (Telegram + Claude)*
*Researched: 2026-02-05*
