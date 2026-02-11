# Phase 18: App Feedback - Research

**Researched:** 2026-02-11
**Domain:** Telegram bot feedback collection (command, implicit AI detection, Mini App form, proactive prompting)
**Confidence:** HIGH

## Summary

Phase 18 adds app-level feedback collection through four channels that all write to a single `app_feedback` table. The existing codebase already has a `feedback` module, but it handles **meal-level feedback check-ins** (recipe sentiment after dinner). This phase is entirely separate -- it is about users sharing feedback on the **bot experience itself**.

The implementation maps cleanly onto existing codebase patterns: a `/feedback` command handler (like `/reminders`), a new Claude tool for implicit detection (`save_app_feedback`), a Mini App page with a simple text form, and a proactive prompt mechanism that piggybacks on the existing message counting infrastructure. The data model is intentionally minimal (text, source, userId, timestamp) with no real-time categorization or sentiment scoring.

**Primary recommendation:** Create a new `app-feedback` module (separate from the existing `feedback` module for meal check-ins) with a repository, init, and types file. Wire the four collection channels through this shared repository. Use the pipeline processor's existing system prompt injection pattern to give Claude instructions for implicit detection. The Mini App feedback page should be a simple textarea + submit button added to the Hub, following the same `apiFetch` + `@telegram-apps/telegram-ui` patterns used throughout.

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- `/feedback <text>` command -- user submits explicit feedback inline
- Implicit detection -- Claude silently logs app-related sentiment from regular conversation (fully silent, user never knows feedback was captured)
- Mini App "Give Feedback" button -- simple text box and submit, no category picker or emoji rating
- Proactive prompt -- bot asks "how am I doing?" triggered by message count (not calendar-based)
- All four channels store to the same feedback table with a `source` column (command, implicit, mini-app, proactive)
- Simple, short, warm reply: "Thanks for the feedback!" -- no echo-back of what was captured
- Minimal data model: feedback text, source (command/implicit/mini-app/proactive), user ID, timestamp
- No categories, no sentiment scoring at save time -- analysis happens after the fact on raw data
- Proactive prompt triggered after Nth message since last prompt (approximates 2 weeks of natural use)
- Only ask at natural conversation breaks -- if user is mid-conversation, don't interrupt
- If user ignores the prompt, drop it silently -- no follow-up, no nagging, wait for next cycle
- No opt-out mechanism needed -- infrequent enough that it's not annoying
- No admin review interface this phase -- no Mini App dashboard, no bot command
- Feedback is collected and stored in SQLite; admin queries the database directly if needed

### Claude's Discretion
- Exact wording of proactive "how am I doing?" prompt
- How to detect implicit app-related sentiment vs regular conversation frustration
- Message count threshold for proactive prompt trigger
- Mini App feedback form styling and placement in hub

### Deferred Ideas (OUT OF SCOPE)
- Admin feedback dashboard (Mini App or bot command) -- future phase
- Sentiment scoring and categorization -- post-hoc analysis, not real-time
- Feedback analytics and trending -- future phase
</user_constraints>

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| grammY | existing | Bot framework, command handling, middleware | Already used for all bot handlers |
| better-sqlite3 | existing | Direct SQL for table init + repository | All non-Drizzle tables use this pattern |
| express | existing | API routes for Mini App feedback endpoint | Existing server infrastructure |
| @telegram-apps/telegram-ui | existing | Mini App UI components (Section, Cell, etc.) | Used for all Mini App pages |
| React + react-router-dom | existing | Mini App SPA routing | Existing client-side stack |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| lucide-react | existing | Icons for Hub and feedback page | MessageSquare or similar for feedback card |
| Anthropic SDK | existing | Claude tool calls for implicit detection + proactive prompt | Already wired into pipeline |

### Alternatives Considered
None -- all decisions are locked. No new libraries needed.

## Architecture Patterns

### Recommended Module Structure
```
src/
  app-feedback/             # NEW module (distinct from existing src/feedback/)
    init.ts                 # CREATE TABLE IF NOT EXISTS app_feedback
    repository.ts           # CRUD: saveFeedback, getMessageCountSinceLastPrompt, getLastPromptTimestamp
    types.ts                # AppFeedback interface, AppFeedbackSource type
  bot/
    handlers/
      app-feedback.ts       # /feedback command handler (NEW)
  ai/
    tools.ts                # Add save_app_feedback tool definition
    tool-handler.ts         # Add save_app_feedback handler case
    system-prompt.ts        # Add APP_FEEDBACK_PROMPT section
  mini-app/
    routes/
      app-feedback.ts       # POST /api/feedback endpoint (NEW)
    router.ts               # Wire new route
  pipeline/
    processor.ts            # Wire proactive prompt check + inject app_feedback context

mini-app/
  src/
    pages/
      Feedback.tsx          # Simple textarea + submit page (NEW)
      Hub.tsx               # Add "Give Feedback" card (MODIFY)
    router.tsx              # Add /feedback route (MODIFY)
```

### Pattern 1: Command Handler (same as /reminders, /preferences)
**What:** A grammY Composer that handles `/feedback <text>`, extracts the text after the command, saves to repository, replies with acknowledgment.
**When to use:** For the explicit `/feedback` command channel.
**Example:**
```typescript
// Source: existing pattern from src/bot/handlers/reminders.ts
import { Composer } from "grammy";
import type BetterSqlite3 from "better-sqlite3";
import type { BotContext } from "../context.js";
import { createAppFeedbackRepository } from "../../app-feedback/repository.js";

export function createAppFeedbackHandler(
  sqlite: BetterSqlite3.Database,
): Composer<BotContext> {
  const repository = createAppFeedbackRepository(sqlite);
  const handler = new Composer<BotContext>();

  handler.command("feedback", async (ctx) => {
    const text = ctx.match; // grammY extracts text after /feedback
    if (!text || text.trim().length === 0) {
      await ctx.reply("Just type /feedback followed by your thoughts!");
      return;
    }

    repository.saveFeedback({
      householdId: ctx.householdId!,
      userId: ctx.userId!,
      text: text.trim(),
      source: "command",
    });

    await ctx.reply("Thanks for the feedback!");
  });

  return handler;
}
```

### Pattern 2: Claude Tool for Implicit Detection
**What:** A new tool `save_app_feedback` that Claude calls silently when it detects app-related sentiment in normal conversation.
**When to use:** For the implicit detection channel.
**Example:**
```typescript
// Tool definition (added to src/ai/tools.ts)
export const APP_FEEDBACK_TOOLS: Anthropic.Tool[] = [
  {
    name: "save_app_feedback",
    description:
      "Silently save app-related feedback detected in conversation. " +
      "Use when the user expresses opinions about the bot's features, UX, or experience " +
      "(e.g., 'I wish you could...', 'the grocery list feature is great', 'it's annoying when...'). " +
      "Do NOT acknowledge saving feedback to the user. Do NOT use for meal/recipe feedback. " +
      "Do NOT use for general frustration unrelated to bot features.",
    input_schema: {
      type: "object" as const,
      properties: {
        text: {
          type: "string",
          description: "The feedback text extracted from the conversation",
        },
      },
      required: ["text"],
    },
  },
];

// Tool handler case (added to src/ai/tool-handler.ts)
case "save_app_feedback": {
  if (!appFeedbackRepository) {
    return JSON.stringify({ error: "App feedback not available" });
  }
  const text = input.text as string;
  appFeedbackRepository.saveFeedback({
    householdId,
    userId: "system", // implicit detection, no specific userId in tool context
    text,
    source: "implicit",
  });
  return JSON.stringify({ saved: true });
}
```

### Pattern 3: Mini App API Endpoint (same as /api/grocery/toggle)
**What:** A POST endpoint that accepts feedback text from the Mini App form, validates initData auth, saves to repository.
**When to use:** For the Mini App feedback channel.
**Example:**
```typescript
// Source: existing pattern from src/mini-app/routes/grocery.ts
export function createAppFeedbackRoutes(sqlite: BetterSqlite3.Database) {
  const repository = createAppFeedbackRepository(sqlite);

  return {
    submit(req: Request, res: Response) {
      const householdId = res.locals.householdId as string;
      const userId = res.locals.chatId as string; // from initData validation
      const { text } = req.body as { text?: string };

      if (!text || text.trim().length === 0) {
        res.status(400).json({ error: "Feedback text is required" });
        return;
      }

      repository.saveFeedback({
        householdId,
        userId,
        text: text.trim(),
        source: "mini-app",
      });

      res.json({ ok: true });
    },
  };
}
```

### Pattern 4: Proactive Prompt via System Prompt Context Injection
**What:** Count messages since last proactive prompt; when threshold is reached, inject a system prompt instruction telling Claude to ask for feedback at a natural break.
**When to use:** For the proactive prompt channel.
**Key insight:** The proactive prompt should NOT be a separate poller/reminder. Instead, it should be a system prompt injection that Claude sees during normal conversation processing. Claude then decides when to naturally ask "how am I doing?" based on conversation flow. This respects the "only at natural conversation breaks" constraint.
**Example:**
```typescript
// In pipeline processor, before building system prompt:
const messagesSinceLastPrompt = appFeedbackRepository.getMessageCountSinceLastPrompt(householdId);
const shouldPromptForFeedback = messagesSinceLastPrompt >= PROACTIVE_THRESHOLD;

// In system prompt, conditionally inject:
if (shouldPromptForFeedback) {
  // Inject instruction telling Claude to ask for feedback naturally
  // Claude will pick an appropriate moment in the conversation
}
```

### Anti-Patterns to Avoid
- **Do NOT reuse the existing `feedback` module:** The existing `feedback` module (src/feedback/) handles meal-level check-ins with sentiment buttons, recipe annotations, and reminder-based scheduling. App feedback is a completely separate concept. Create a new `app-feedback` module.
- **Do NOT use a poller/scheduler for proactive prompts:** The "message count threshold" approach means the prompt should be injected into the system prompt during normal message processing, not triggered by a timer.
- **Do NOT echo back feedback content:** The user decision explicitly says no echo-back. "Thanks for the feedback!" only.
- **Do NOT add sentiment/category columns to the table:** The decision explicitly defers this. Raw text + source only.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Command text extraction | Manual string parsing | `ctx.match` (grammY built-in) | grammY automatically extracts text after `/command` |
| Mini App auth | Custom token validation | Existing `createInitDataValidator` middleware | Already handles HMAC-SHA256 + user lookup |
| Table creation | Drizzle migrations | `CREATE TABLE IF NOT EXISTS` in init.ts | Matches all existing table creation patterns |
| Proactive prompt timing | Custom timer/scheduler | Message count + system prompt injection | Avoids new infrastructure; leverages existing pipeline |
| Implicit detection | Regex/keyword matching | Claude tool call with system prompt guidance | Claude understands nuance between app feedback and meal frustration |

**Key insight:** The entire implicit detection system is "just" a Claude tool + system prompt instructions. No NLP pipeline, no keyword lists, no ML models. Claude's judgment is the detection engine.

## Common Pitfalls

### Pitfall 1: Naming Collision with Existing Feedback Module
**What goes wrong:** Creating files in `src/feedback/` that conflict with existing meal check-in feedback code.
**Why it happens:** Both modules deal with "feedback" but are completely different concepts.
**How to avoid:** Use a distinct module name: `src/app-feedback/` with prefix `app_feedback` for the table, `AppFeedback` for types, and `createAppFeedbackRepository` for the factory.
**Warning signs:** Import conflicts, type name ambiguity, accidental modifications to meal feedback code.

### Pitfall 2: Proactive Prompt Fires During Active Conversation
**What goes wrong:** Claude asks "how am I doing?" while the user is in the middle of meal planning or recipe creation.
**Why it happens:** Message count threshold is reached mid-conversation.
**How to avoid:** The system prompt instruction should tell Claude to ONLY ask at the end of a completed interaction -- after finishing a task, not during one. Claude can hold the prompt for the next natural break.
**Warning signs:** Feedback prompts interrupting active workflows.

### Pitfall 3: Implicit Detection is Too Aggressive
**What goes wrong:** Claude logs normal conversation as feedback (e.g., "I don't like chicken" logged as app feedback instead of meal preference).
**Why it happens:** Vague system prompt instructions for the implicit detection tool.
**How to avoid:** The system prompt must clearly distinguish: app feedback is about the **bot's features/experience** (grocery list feature, planning workflow, reminders). Meal preferences and recipe opinions are NOT app feedback.
**Warning signs:** app_feedback table filling with meal preferences instead of actual app feedback.

### Pitfall 4: Implicit Detection Leaks to User
**What goes wrong:** Claude acknowledges that it saved feedback (e.g., "I've noted your feedback about the grocery feature").
**Why it happens:** Claude's natural tendency to be transparent about tool usage.
**How to avoid:** Both the tool description and system prompt must explicitly say: "Do NOT acknowledge saving feedback to the user. Respond to their message naturally as if you did not detect feedback."
**Warning signs:** User sees any acknowledgment of implicit feedback capture.

### Pitfall 5: Proactive Prompt Counting Per-Household vs Per-User
**What goes wrong:** In multi-user households, one user's messages trigger the prompt for another user.
**Why it happens:** Counting messages at household level when it should be per-user (or at least per-household but tracking which user gets prompted).
**How to avoid:** Track message count per household (since the bot conversation is shared), but record when the prompt was last shown for each household. This is acceptable because households share a single chat.
**Warning signs:** One user getting prompted much more frequently than expected.

### Pitfall 6: Mini App Feedback Route Missing from Router
**What goes wrong:** 404 on POST /api/feedback because the route was not wired in the API router.
**Why it happens:** Forgetting to update both `src/mini-app/router.ts` and `mini-app/src/router.tsx`.
**How to avoid:** Checklist: (1) server-side route in router.ts, (2) client-side route in mini-app router.tsx, (3) Hub.tsx card linking to the page.
**Warning signs:** API call fails from Mini App.

## Code Examples

### Data Model (app_feedback table)
```typescript
// Source: following pattern from src/feedback/init.ts
export function initializeAppFeedback(sqlite: BetterSqlite3.Database): void {
  sqlite.exec(`
    CREATE TABLE IF NOT EXISTS app_feedback (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      household_id TEXT NOT NULL,
      user_id TEXT NOT NULL,
      text TEXT NOT NULL,
      source TEXT NOT NULL CHECK(source IN ('command', 'implicit', 'mini-app', 'proactive')),
      created_at INTEGER NOT NULL DEFAULT (unixepoch())
    )
  `);

  // Track when the last proactive prompt was shown per household
  // and the message count at that time
  sqlite.exec(`
    CREATE TABLE IF NOT EXISTS app_feedback_prompt_tracking (
      household_id TEXT PRIMARY KEY,
      last_prompt_at INTEGER NOT NULL DEFAULT 0,
      messages_at_last_prompt INTEGER NOT NULL DEFAULT 0
    )
  `);
}
```

### Repository Pattern
```typescript
// Source: following pattern from src/feedback/repository.ts
export function createAppFeedbackRepository(sqlite: BetterSqlite3.Database) {
  return {
    saveFeedback(params: {
      householdId: string;
      userId: string;
      text: string;
      source: "command" | "implicit" | "mini-app" | "proactive";
    }): void {
      sqlite
        .prepare(
          `INSERT INTO app_feedback (household_id, user_id, text, source)
           VALUES (?, ?, ?, ?)`,
        )
        .run(params.householdId, params.userId, params.text, params.source);
    },

    /**
     * Get the count of inbound messages for a household since the last proactive prompt.
     * Uses the messages table (already exists in db/schema.ts).
     */
    getMessageCountSinceLastPrompt(householdId: string): number {
      // Get the timestamp of the last proactive prompt
      const tracking = sqlite
        .prepare(`SELECT messages_at_last_prompt FROM app_feedback_prompt_tracking WHERE household_id = ?`)
        .get(householdId) as { messages_at_last_prompt: number } | undefined;

      const lastCount = tracking?.messages_at_last_prompt ?? 0;

      // Count total inbound messages for this household
      // householdId maps to chatId for the messages table
      const result = sqlite
        .prepare(
          `SELECT COUNT(*) as count FROM messages
           WHERE chat_id = ? AND direction = 'in'`,
        )
        .get(householdId) as { count: number };

      return result.count - lastCount;
    },

    recordProactivePromptShown(householdId: string): void {
      const totalMessages = sqlite
        .prepare(
          `SELECT COUNT(*) as count FROM messages
           WHERE chat_id = ? AND direction = 'in'`,
        )
        .get(householdId) as { count: number };

      sqlite
        .prepare(
          `INSERT OR REPLACE INTO app_feedback_prompt_tracking (household_id, last_prompt_at, messages_at_last_prompt)
           VALUES (?, unixepoch(), ?)`,
        )
        .run(householdId, totalMessages.count);
    },
  };
}
```

### System Prompt for Implicit Detection + Proactive Prompt
```typescript
// New constant in src/ai/system-prompt.ts
const APP_FEEDBACK_PROMPT = `
<app_feedback>
You can silently collect feedback about the bot experience when users express opinions about features.

IMPLICIT FEEDBACK DETECTION:
- When a user says something about the BOT's features, UX, or capabilities, silently call save_app_feedback
- Examples: "I wish the grocery list had categories", "the meal plan feature is really helpful", "reminders are annoying"
- Do NOT call save_app_feedback for meal/recipe opinions ("this chicken was dry" = NOT app feedback)
- Do NOT call save_app_feedback for general frustration ("ugh I can't decide" = NOT app feedback)
- CRITICAL: NEVER acknowledge to the user that you saved feedback. Respond naturally as if nothing happened.
- The tool call and response happen silently -- the user sees only your normal conversational reply.

PROACTIVE FEEDBACK (when prompted):
- When the system prompt includes <request_feedback/>, find a natural moment to ask how the bot experience is going
- Use a casual, warm tone: "Hey, I've been helping you for a while now -- how's the experience been? Anything I could do better?"
- If the user responds with feedback, call save_app_feedback with source "proactive" before replying naturally
- If the user ignores or deflects, drop it completely -- no follow-up
- Only ask ONCE per prompt injection -- do not repeat in subsequent messages
</app_feedback>`;
```

### Mini App Feedback Page
```typescript
// Source: following pattern from mini-app/src/pages/Recipes.tsx
import { useState } from 'react';
import { Section, Cell, Input, Button } from '@telegram-apps/telegram-ui';
import { apiFetch } from '../api';

export function Feedback() {
  const [text, setText] = useState('');
  const [submitted, setSubmitted] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async () => {
    if (!text.trim() || submitting) return;
    setSubmitting(true);
    try {
      const res = await apiFetch('/feedback', {
        method: 'POST',
        body: JSON.stringify({ text: text.trim() }),
      });
      if (res.ok) {
        setSubmitted(true);
        setText('');
      }
    } finally {
      setSubmitting(false);
    }
  };

  // Simple form: textarea + submit
  // On success: "Thanks for the feedback!" message
}
```

### Bot Handler Registration
```typescript
// In src/bot/index.ts, add between remindersHandler and feedbackTextHandler:
// appFeedbackHandler (/feedback command)
bot.use(appFeedbackHandler);
```

### Main.ts Wiring
```typescript
// In src/main.ts, add:
import { createAppFeedbackRepository } from "./app-feedback/repository.js";
import { createAppFeedbackHandler } from "./bot/handlers/app-feedback.js";

const appFeedbackRepository = createAppFeedbackRepository(sqlite);
const appFeedbackHandler = createAppFeedbackHandler(sqlite);

// Pass to createBot options
// Pass appFeedbackRepository to createProcessor deps
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Survey forms with categories | Free-text + AI extraction | Ongoing | No upfront categorization needed; defer analysis |
| Timer-based prompts | Message-count-based triggers | This design | More natural frequency based on actual usage |
| Separate feedback DB | Same SQLite with `source` column | This design | Simple unified storage |

**Deprecated/outdated:**
- None relevant. This is greenfield within the existing stack.

## Open Questions

1. **Message Count Threshold for Proactive Prompt**
   - What we know: Should approximate "2 weeks of natural use"
   - What's unclear: How many messages per day does a typical user send? Active users might send 5-10/day, casual users 1-2/day.
   - Recommendation: Start with **50 messages** as the threshold. This approximates ~2 weeks for a moderately active user (3-4 messages/day). This is Claude's discretion per CONTEXT.md, so the planner can set a reasonable default and the value should be a named constant that's easy to adjust.

2. **Implicit Detection: How to Handle Tool Call Visibility**
   - What we know: Claude tool calls appear in the conversation loop but the text response is what the user sees.
   - What's unclear: When Claude calls `save_app_feedback` as part of a multi-tool response, does the tool call result appear to the user?
   - Recommendation: No -- tool calls are internal to the pipeline processor. The user only sees the final text response. The existing `sendMessageWithTools` pattern handles this correctly. The tool result (`{ saved: true }`) is consumed by Claude internally.

3. **Proactive Prompt: Where to Inject the `<request_feedback/>` Tag**
   - What we know: System prompt injection happens in the pipeline processor.
   - What's unclear: Should we mark "prompt shown" when injecting the tag, or when Claude actually asks?
   - Recommendation: Mark it when injecting the tag into the system prompt. Claude might not ask immediately (it waits for a natural break), but we don't want to inject it repeatedly on every message. After injection, record the prompt as "shown" and reset the counter.

4. **Proactive Prompt Response Capture**
   - What we know: After Claude asks "how am I doing?", the user's next message enters the normal pipeline.
   - What's unclear: How does Claude know to save the response as proactive feedback vs. treating it as a new conversation topic?
   - Recommendation: The APP_FEEDBACK_PROMPT system prompt instruction should tell Claude: "If you recently asked for feedback and the user responds with feedback, call save_app_feedback with source 'proactive'." Claude's conversation context (which includes its own recent messages) will help it recognize this.

## Sources

### Primary (HIGH confidence)
- **Existing codebase analysis** -- All patterns, module structure, naming conventions, and integration points verified by direct reading of:
  - `src/feedback/` (existing meal feedback module -- to differentiate)
  - `src/bot/index.ts` (middleware/handler registration order)
  - `src/pipeline/processor.ts` (system prompt injection, tool handling)
  - `src/ai/tools.ts` + `src/ai/tool-handler.ts` (tool definition patterns)
  - `src/ai/system-prompt.ts` (system prompt structure and injection)
  - `src/mini-app/router.ts` + `src/mini-app/routes/` (API route patterns)
  - `mini-app/src/pages/Hub.tsx` (Hub card structure)
  - `src/db/index.ts` (table initialization pattern)
  - `src/main.ts` (full wiring/dependency injection)

### Secondary (MEDIUM confidence)
- grammY `ctx.match` for command argument extraction -- standard grammY pattern, verified by codebase usage patterns (though `/feedback` is new, other commands like `/start` with deep links use similar patterns)

### Tertiary (LOW confidence)
- Message count threshold of 50 -- purely a heuristic recommendation; no data on actual user messaging frequency. Should be a tunable constant.

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH -- all libraries already in use, no new dependencies
- Architecture: HIGH -- all patterns directly observed in existing codebase
- Pitfalls: HIGH -- naming collision and implicit detection concerns derived from direct code analysis
- Proactive prompt mechanism: MEDIUM -- the system prompt injection approach is sound but the threshold and timing details are design decisions

**Research date:** 2026-02-11
**Valid until:** 2026-03-11 (stable -- no external dependencies changing)
