# Phase 9: Feedback Loop - Research

**Researched:** 2026-02-09
**Domain:** Post-meal check-in system with feedback capture, recipe annotation, and suggestion influence
**Confidence:** HIGH

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

#### Check-in timing & triggers
- Check in after every planned meal, not a subset
- Send check-in same evening, 8-9pm window (using user's timezone from reminder settings)
- Always send regardless of whether user interacted with bot that day
- If user doesn't respond, silent drop -- no follow-up, no nagging
- Check-in expires silently; no guilt, no tracking of non-responses

#### Interaction style
- Open with a direct question naming the recipe: "How was the chicken parmesan tonight?"
- Offer three inline buttons: thumbs-up Loved it / neutral It was okay / thumbs-down Didn't work
- Also include a "Skipped" button for meals not cooked (explicit plan adherence tracking)
- Always accept free-text responses as an alternative to buttons
- No follow-up questions after the user responds -- one response captured and done
- Claude extracts structured feedback (sentiment + notes) from whatever the user says

#### What gets captured
- Overall sentiment (positive / neutral / negative / skipped) -- first-class signal for planning
- Freeform notes -- equally important as sentiment. Notes are broad: timing, ingredients, oven settings, substitutions, anything
- No structured time-tracking field; if user mentions time, Claude captures it in notes
- "Didn't make it" / "Skipped" tracked explicitly via button
- Feedback stored as annotations on the recipe's knowledge item, not a separate table
- Each annotation includes: date, sentiment, notes text

#### Feedback visibility
- When suggesting a recipe for a future plan, explicitly reference past feedback: "Suggesting chicken parm -- you loved it last time but said to use less salt"
- Negative feedback deprioritizes recipes in auto-suggestions but doesn't ban them -- user can still request
- Feedback history shown inline when displaying a recipe (e.g., "Last 3 times: thumbs-up thumbs-up neutral")
- Aggressive recipe update suggestions: even a single mention of a concrete change triggers a proposal
  - Example: user says "less salt" -> bot suggests "Cut salt in half for next time?" and updates recipe if approved
  - Adds a note to the recipe that the change was made based on feedback
  - User must approve before recipe is modified

### Claude's Discretion
- Exact wording of check-in messages (within the "direct question naming the recipe" pattern)
- How to handle edge cases like multiple meals in one day
- How to format feedback annotations within recipe knowledge items
- Threshold for deprioritization (how many negative reviews before significant ranking drop)

### Deferred Ideas (OUT OF SCOPE)
None -- discussion stayed within phase scope
</user_constraints>

## Summary

Phase 9 adds a feedback loop to the meal planning bot: after each planned meal, the bot proactively sends a check-in message asking how the meal went, captures the user's response (via inline buttons or free text), and stores that feedback as annotations on the recipe's knowledge item. This feedback then influences future recipe suggestions and can trigger recipe update proposals.

The implementation builds directly on two existing infrastructure pieces: (1) the **reminder/poller system** (Phase 8) for scheduling and sending check-in messages at the right time, and (2) the **knowledge system** (Phases 3-4) for storing feedback as annotations on recipe items. No new external libraries are needed -- this is purely an application-level feature built with existing tools: grammY inline keyboards, the reminder poller, the Anthropic SDK for feedback extraction, and SQLite for storage.

The core challenge is architectural: feedback flows through multiple subsystems (reminder generation -> poller delivery -> callback/message handling -> Claude extraction -> knowledge annotation -> system prompt surfacing). Getting the data flow right across these boundaries is the key design problem.

**Primary recommendation:** Add a new `feedback_checkin` reminder type to the existing reminder system, store feedback as JSON annotations appended to the recipe's knowledge item content, and add a feedback callback handler alongside the existing grocery callback handler.

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| grammy | ^1.39.3 | InlineKeyboard for feedback buttons, callback_query handling | Already in project, proven pattern in grocery buttons |
| better-sqlite3 | ^12.6.2 | Direct SQL for reminder and feedback queries | Already in project, used by reminder repository |
| @anthropic-ai/sdk | ^0.73.0 | Claude for extracting structured feedback from free text | Already in project, used by reminder sender |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| drizzle-orm | ^0.45.1 | Knowledge item updates (appending annotations) | When modifying recipe content via knowledge repository |
| pino | ^10.3.0 | Logging feedback operations | Throughout all feedback modules |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Annotations in knowledge item content | Separate feedback_annotations table | User decision: store on knowledge item, not separate table |
| JSON in content field | Structured columns | Content field is flexible text; JSON section appended to recipe text is searchable and human-readable |

**Installation:**
```bash
# No new dependencies needed -- all libraries already in project
```

## Architecture Patterns

### Recommended Project Structure
```
src/
├── feedback/
│   ├── init.ts           # Create feedback_checkins table (scheduling state)
│   ├── schema.ts         # Drizzle schema for feedback_checkins (optional, for type generation)
│   ├── repository.ts     # CRUD for feedback check-in scheduling + annotation storage
│   ├── generator.ts      # Generate feedback_checkin reminders from meal plans
│   ├── buttons.ts        # InlineKeyboard builder + callback data encoding/parsing
│   ├── handler.ts        # Callback query handler for button taps
│   ├── extractor.ts      # Claude-based structured feedback extraction from free text
│   └── context.ts        # Build feedback context for system prompt injection
├── reminders/
│   ├── types.ts          # Add "feedback_checkin" to ReminderType union
│   ├── init.ts           # Update CHECK constraint to include new type
│   ├── sender.ts         # Add feedback_checkin case to sendReminder
│   └── ...               # Existing files unchanged
├── ai/
│   ├── system-prompt.ts  # Add FEEDBACK_PROMPT section + feedback context injection
│   └── tools.ts          # Add record_feedback tool for Claude to use
└── ...
```

### Pattern 1: Feedback Check-in as a Reminder Type
**What:** Extend the existing reminder system with a new `feedback_checkin` type rather than building a separate scheduling mechanism.
**When to use:** This is the primary pattern for Phase 9 -- it reuses the proven poller/sender infrastructure.
**How it works:**

The reminder generator already iterates meal plan entries and creates reminders for each date. Adding feedback check-ins means:
1. For each dinner entry, generate a `feedback_checkin` reminder at 20:00-21:00 (user timezone)
2. The poller picks it up at the right time (same as morning_summary, prep_alert, start_cooking)
3. The sender generates the check-in message and sends it with inline buttons
4. User responds via button tap or free text

**Key implementation detail:** The `contextJson` on the reminder carries the recipe name and knowledge item ID, so the sender knows which recipe to ask about.

```typescript
// In feedback/generator.ts -- extends the same pattern as reminders/generator.ts
// For each dinner entry, create a feedback_checkin reminder at 20:30 (midpoint of 8-9pm window)
reminderRepository.createReminder({
  chatId,
  type: "feedback_checkin",
  dueAt: localTimeToUtc(currentDate, "20:30", settings.timezone),
  contextJson: JSON.stringify({
    recipeName: meal.recipeName,
    knowledgeItemId: meal.knowledgeItemId,
    mealDate: currentDate,
    mealType: meal.mealType,
  }),
});
```

### Pattern 2: Inline Keyboard for Feedback Buttons
**What:** Send check-in messages with 4 inline buttons (3 sentiment + 1 skipped), following the same pattern as grocery buttons.
**When to use:** Every feedback check-in message.

```typescript
// In feedback/buttons.ts -- follows exact pattern of grocery/buttons.ts
export const FEEDBACK_CB_PREFIX = "f:";

export function encodeFeedback(reminderId: number, sentiment: string): string {
  return `${FEEDBACK_CB_PREFIX}${sentiment}:${reminderId}`;
  // Examples: "f:pos:42", "f:neu:42", "f:neg:42", "f:skip:42"
  // All well under 64-byte Telegram limit
}

export function buildFeedbackKeyboard(reminderId: number): InlineKeyboard {
  return new InlineKeyboard()
    .text("👍 Loved it", encodeFeedback(reminderId, "pos"))
    .text("😐 It was okay", encodeFeedback(reminderId, "neu"))
    .row()
    .text("👎 Didn't work", encodeFeedback(reminderId, "neg"))
    .text("⏭ Skipped", encodeFeedback(reminderId, "skip"));
}
```

### Pattern 3: Feedback Annotations in Knowledge Item Content
**What:** Append a `Feedback:` section to the recipe's knowledge item content field, storing annotations as structured text.
**When to use:** After every feedback capture (button or free text).
**Why this format:** The user explicitly decided against a separate table. Content-based storage keeps feedback visible when Claude retrieves recipes and is human-readable.

```
Ingredients:
- 1 lb chicken breast
- 2 cups marinara
...

Steps:
1. Preheat oven to 375
...

Notes:
- Great for weeknights

Feedback:
- 2026-02-03 [positive]: Loved it, perfectly crispy
- 2026-01-27 [neutral]: Good but needed more salt
- 2026-01-20 [negative]: Overcooked, reduce time by 10 min
- 2026-01-13 [skipped]: Ordered takeout instead
```

### Pattern 4: Claude Feedback Extraction from Free Text
**What:** When a user responds with free text instead of buttons, use Claude to extract structured sentiment and notes.
**When to use:** Any time the user sends a text message in response to a check-in.

```typescript
// In feedback/extractor.ts
const EXTRACTION_SYSTEM_PROMPT = `Extract feedback from the user's response about a meal.
Return a JSON object with:
- sentiment: "positive" | "neutral" | "negative" | "skipped"
- notes: string (key observations, suggestions, or details mentioned)

Be generous with classification:
- "positive" = any clearly happy response ("great", "loved it", "perfect")
- "neutral" = mixed or lukewarm ("it was fine", "decent", "okay")
- "negative" = dissatisfied ("didn't like", "won't make again", "overcooked")
- "skipped" = didn't cook it ("we ordered out", "didn't make it", "skipped")

For notes, extract specific actionable details: timing changes, ingredient adjustments,
substitutions made, what worked or didn't. Keep notes concise.`;
```

### Pattern 5: Feedback Context in System Prompt
**What:** Inject recent feedback data into the system prompt so Claude can reference it when suggesting recipes.
**When to use:** Every Claude call (same as plan context, grocery context, reminder context).

```typescript
// In feedback/context.ts -- follows same pattern as planning/context.ts
export function buildFeedbackContext(
  sqlite: BetterSqlite3.Database,
  chatId: string,
): string {
  // Query recent feedback annotations from knowledge items tagged "recipe"
  // Return formatted context for system prompt injection
}
```

### Pattern 6: Feedback-Aware Check-in Scheduling State
**What:** A lightweight `feedback_checkins` table to track which check-ins have been sent and whether a response was received, avoiding the need to modify the reminders table schema.
**When to use:** To determine whether to accept a free-text response as feedback, and to correlate callback data back to a specific meal.

```sql
CREATE TABLE IF NOT EXISTS feedback_checkins (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  chat_id TEXT NOT NULL,
  reminder_id INTEGER NOT NULL,
  recipe_name TEXT NOT NULL,
  knowledge_item_id INTEGER,
  meal_date TEXT NOT NULL,
  meal_type TEXT NOT NULL DEFAULT 'dinner',
  message_id INTEGER,          -- Telegram message ID of the check-in message
  status TEXT NOT NULL DEFAULT 'pending'
    CHECK(status IN ('pending', 'sent', 'responded', 'expired')),
  sentiment TEXT CHECK(sentiment IN ('positive', 'neutral', 'negative', 'skipped')),
  notes TEXT,
  responded_at INTEGER,
  created_at INTEGER NOT NULL DEFAULT (unixepoch())
);
```

**Key insight:** This table bridges the reminder (scheduling) and knowledge (annotation) systems. When the poller fires the check-in, it creates a row here. When the user responds, the row is updated AND the annotation is appended to the knowledge item.

### Anti-Patterns to Avoid
- **Separate feedback database table for annotations:** User explicitly decided feedback lives ON the knowledge item, not in a separate table. The `feedback_checkins` table is for scheduling/tracking state only; the actual feedback data is written to the recipe's content field.
- **Follow-up messages after no response:** User explicitly said silent drop, no nagging, no tracking of non-responses. The `expired` status is for internal state only, never surfaced to the user.
- **Blocking the conversation pipeline for feedback:** Check-in responses should be handled by a dedicated callback handler (like grocery), not routed through the full Claude conversation pipeline for simple button taps. Free-text responses DO need Claude for extraction but should be lightweight.
- **Feedback as a survey:** The interaction must feel like a quick debrief (one question, one response, done). No multi-step flows.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Scheduling check-ins at the right time | Custom timer/cron system | Existing reminder poller + new reminder type | Proven infrastructure, handles timezone, restart-safe |
| Inline button interactions | Custom Telegram API calls | grammY InlineKeyboard + callback_query handler | Already working for grocery, well-tested pattern |
| Extracting structured data from free text | Regex parsing of user responses | Claude API with extraction prompt | Users will say anything; LLM handles natural language |
| Timezone-aware scheduling | Manual UTC offset calculation | Existing `localTimeToUtc` from reminders/generator.ts | Already handles DST, tested with Intl.DateTimeFormat |
| Dedup check-ins for same meal | Custom locking mechanism | Existing `hasPendingReminder` dedup pattern | 1-minute dedup window, proven for reminders |

**Key insight:** Phase 9 is primarily a feature built on existing infrastructure. The reminder system, knowledge system, inline button pattern, and Claude integration are all proven. The new code is glue between these systems, not new infrastructure.

## Common Pitfalls

### Pitfall 1: Free-Text Response Attribution
**What goes wrong:** User sends a text message hours after the check-in. How does the bot know it's feedback for that recipe vs a new conversation?
**Why it happens:** Telegram messages don't carry context about which check-in they're replying to.
**How to avoid:** Two strategies:
1. **Button taps are unambiguous** -- callback data carries the reminder ID, so attribution is instant.
2. **Free-text responses:** Use Telegram's reply-to feature -- when the bot sends the check-in, if the user replies to THAT specific message, the `reply_to_message` field links back to the check-in. For unsolicited text messages, the bot should check if there's a recent unanswered check-in (status=sent, responded_at IS NULL) and if the timing is reasonable (within a few hours). If ambiguous, route through normal conversation pipeline.
**Warning signs:** Feedback being attributed to wrong recipes, or feedback being lost because it went through the general chat pipeline.

### Pitfall 2: Multiple Meals in One Day
**What goes wrong:** User has both lunch and dinner planned. Two check-ins fire at 8pm.
**Why it happens:** The generator creates one check-in per planned meal, and both could be for the same day.
**How to avoid:** For multiple meals on the same day, consolidate into a single check-in message that asks about all meals:
- "How was today's cooking? You had tuna salad for lunch and chicken parm for dinner."
- Offer a row of buttons per meal, or ask in sequence.
- Alternative (simpler): Send separate check-ins 10 minutes apart. The user decided Claude has discretion here.
**Warning signs:** Users getting bombarded with multiple check-in messages at 8pm.

### Pitfall 3: Recipe Without Knowledge Item
**What goes wrong:** A meal plan entry references a recipe by name but has no `knowledgeItemId`. Feedback can't be stored as an annotation because there's no knowledge item to annotate.
**Why it happens:** Users can plan meals with arbitrary recipe names without saving recipes to the knowledge base.
**How to avoid:** Still send the check-in (the user might have feedback). If feedback is captured, store it only in the `feedback_checkins` table. When the user later saves that recipe, consider migrating any orphaned feedback. Alternatively, auto-create a minimal knowledge item to hold the feedback.
**Warning signs:** Feedback silently lost for recipes not in the knowledge base.

### Pitfall 4: Callback Data Expiry
**What goes wrong:** User taps a feedback button on a check-in message from 3 days ago. The system may have already expired that check-in.
**Why it happens:** Telegram inline buttons stay active on messages indefinitely, but our tracking may have moved on.
**How to avoid:** Always handle late button taps gracefully. Look up the `feedback_checkins` row by reminder_id. If it exists and status is not `responded`, accept the feedback. If already responded, answer the callback with "Already recorded!" and don't duplicate. If the check-in row can't be found, answer with "This check-in has expired" (graceful degradation).
**Warning signs:** Users getting errors when tapping buttons, or duplicate feedback entries.

### Pitfall 5: Knowledge Item Content Parsing
**What goes wrong:** Appending a `Feedback:` section to a recipe that already has varied content formats. Content parsing becomes fragile.
**Why it happens:** Knowledge item content is free-form text. There's no guaranteed structure.
**How to avoid:** Use a clear, unique delimiter for the feedback section:
- Always append `\n\nFeedback:\n` followed by entries
- When reading feedback back, look for the `Feedback:` marker
- If the marker doesn't exist yet, create it on first feedback
- Never modify text above the `Feedback:` marker when adding annotations
**Warning signs:** Feedback entries getting mixed into recipe steps, or content corruption when appending.

### Pitfall 6: Reminder Type Constraint Migration
**What goes wrong:** Adding `feedback_checkin` to the `reminders` table `type` column fails because of the existing CHECK constraint.
**Why it happens:** The `init.ts` uses `CHECK(type IN ('morning_summary', 'prep_alert', 'start_cooking'))`.
**How to avoid:** SQLite CHECK constraints are defined at table creation. For an existing table, you need to either:
1. Use `ALTER TABLE` to recreate with the new constraint (complex)
2. Drop and recreate the table (loses data)
3. **Best option:** Since `initializeReminders` uses `CREATE TABLE IF NOT EXISTS`, the CHECK constraint was set at first creation. For development, the simplest approach is to update the init SQL and start fresh. For production migration, add the new value to the CHECK constraint. Better-sqlite3 supports `PRAGMA writable_schema` for constraint changes if needed.
**Warning signs:** Insert errors when creating feedback_checkin reminders.

## Code Examples

### Check-in Message Sending (extends reminder sender)
```typescript
// In reminders/sender.ts -- new case in buildReminderPrompt and sendReminder

case "feedback_checkin": {
  const recipeName = (context.recipeName as string) || "dinner";
  const mealDate = context.mealDate as string;

  // Build check-in message -- Claude generates the exact wording
  const prompt = `Generate a post-meal check-in message asking how "${recipeName}" went tonight (${mealDate}).
Open with a direct question naming the recipe. Keep it casual and brief -- one sentence max.
Examples: "How was the chicken parmesan tonight?" or "How'd the tacos turn out?"`;

  // ... generate text via Claude, then send with inline keyboard
  const keyboard = buildFeedbackKeyboard(reminder.id);
  await bot.api.sendMessage(reminder.chatId, text, {
    parse_mode: "HTML",
    reply_markup: keyboard,
  });
}
```

### Callback Handler Registration (follows grocery pattern)
```typescript
// In bot/index.ts -- add feedback callback handler before grocery
bot.use(feedbackCallbackHandler); // feedback button callbacks
bot.use(groceryCallbackHandler);  // grocery button callbacks -- existing
```

### Feedback Callback Handler (follows grocery/buttons.ts pattern)
```typescript
// In feedback/handler.ts
export function createFeedbackCallbackHandler(
  sqlite: BetterSqlite3.Database,
): Composer<BotContext> {
  const feedbackRepo = createFeedbackRepository(sqlite);
  const handler = new Composer<BotContext>();

  handler.on("callback_query:data", async (ctx, next) => {
    const parsed = parseFeedbackCallback(ctx.callbackQuery.data);
    if (!parsed) {
      await next(); // Not a feedback callback -- pass through
      return;
    }

    await ctx.answerCallbackQuery(); // Clear loading spinner immediately

    const { sentiment, reminderId } = parsed;
    const checkin = feedbackRepo.getCheckinByReminderId(reminderId);
    if (!checkin || checkin.status === "responded") {
      return; // Already responded or not found
    }

    // Record the feedback
    feedbackRepo.recordFeedback(checkin.id, sentiment, "");

    // Append annotation to knowledge item if it exists
    if (checkin.knowledgeItemId) {
      appendFeedbackAnnotation(knowledgeRepo, checkin.knowledgeItemId, chatId, {
        date: checkin.mealDate,
        sentiment,
        notes: "",
      });
    }

    // Edit the check-in message to show confirmation
    await ctx.editMessageText(
      `Got it! Recorded as ${sentimentEmoji(sentiment)} for ${checkin.recipeName}.`,
      { parse_mode: "HTML" },
    );
  });

  return handler;
}
```

### Appending Feedback to Knowledge Item Content
```typescript
// In feedback/repository.ts
export function appendFeedbackAnnotation(
  knowledgeRepo: ReturnType<typeof createKnowledgeRepository>,
  knowledgeItemId: number,
  chatId: string,
  feedback: { date: string; sentiment: string; notes: string },
): void {
  const item = knowledgeRepo.getById(knowledgeItemId, chatId);
  if (!item) return;

  const sentimentLabel = {
    positive: "positive",
    neutral: "neutral",
    negative: "negative",
    skipped: "skipped",
  }[feedback.sentiment] ?? feedback.sentiment;

  const annotation = `- ${feedback.date} [${sentimentLabel}]${feedback.notes ? ": " + feedback.notes : ""}`;

  let updatedContent: string;
  if (item.content.includes("\nFeedback:\n")) {
    // Append to existing feedback section
    updatedContent = item.content + "\n" + annotation;
  } else {
    // Create new feedback section
    updatedContent = item.content + "\n\nFeedback:\n" + annotation;
  }

  knowledgeRepo.update(knowledgeItemId, chatId, { content: updatedContent });
}
```

### Free-Text Feedback Extraction via Claude
```typescript
// In feedback/extractor.ts
export async function extractFeedback(
  claudeClient: ClaudeClient,
  userText: string,
  recipeName: string,
): Promise<{ sentiment: string; notes: string }> {
  const response = await claudeClient.sendMessage(
    [`The user was asked about "${recipeName}" and responded: "${userText}"\n\nExtract feedback as JSON: { "sentiment": "positive"|"neutral"|"negative"|"skipped", "notes": "..." }`],
    EXTRACTION_SYSTEM_PROMPT,
  );

  try {
    const parsed = JSON.parse(response.text);
    return {
      sentiment: parsed.sentiment || "neutral",
      notes: parsed.notes || "",
    };
  } catch {
    // Fallback: treat as neutral with the full text as notes
    return { sentiment: "neutral", notes: userText };
  }
}
```

### Recipe Update Suggestion from Feedback
```typescript
// In the system prompt FEEDBACK_PROMPT section, instruct Claude:
const FEEDBACK_PROMPT = `
<feedback_management>
FEEDBACK CHECK-INS:
- The bot sends "How was dinner?" check-ins after planned meals
- Users respond via buttons (thumbs-up/neutral/thumbs-down/skipped) or free text
- Feedback is stored as annotations on the recipe knowledge item

RECIPE UPDATE SUGGESTIONS:
- When feedback contains a SPECIFIC actionable change (less salt, cook longer, swap ingredient),
  IMMEDIATELY propose a recipe update
- Be specific: "Cut salt from 1 tsp to 1/2 tsp?" not just "use less salt"
- If user approves, update the recipe via update_knowledge and note the change was feedback-driven
- Even a SINGLE mention of a concrete change triggers a proposal -- don't wait for patterns

FEEDBACK IN SUGGESTIONS:
- When suggesting a recipe with feedback history, reference it naturally:
  "Suggesting chicken parm -- you loved it last time but mentioned wanting less salt"
- Negative feedback deprioritizes but doesn't ban: still suggest if user asks
- Show recent feedback inline: "Last 3 times: thumbs-up thumbs-up neutral"

FEEDBACK CONTEXT:
- Recent feedback annotations are included in the <feedback_context> section below
- Use this context when making recipe suggestions for meal plans
- Weight recent feedback more heavily than old feedback
</feedback_management>`;
```

### Feedback Generator (extends reminder generator pattern)
```typescript
// In feedback/generator.ts -- mirrors reminders/generator.ts structure
export function generateFeedbackCheckins(deps: {
  reminderRepository: ReturnType<typeof createReminderRepository>;
  feedbackRepository: ReturnType<typeof createFeedbackRepository>;
  planRepository: ReturnType<typeof createPlanRepository>;
  sqlite: BetterSqlite3.Database;
  chatId: string;
  settings: ReminderSettings;
}): void {
  // Same pattern as generateReminders:
  // 1. Get active plans
  // 2. For each meal entry on each date
  // 3. Create a feedback_checkin reminder at 20:30 (user timezone)
  // 4. Dedup via hasPendingReminder
  // 5. Also create a feedback_checkins tracking row
}
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Separate feedback table | Annotations on knowledge items | User decision for Phase 9 | Keeps feedback co-located with recipe data |
| Optional/infrequent check-ins | Every planned meal gets a check-in | User decision for Phase 9 | More data, higher engagement expectation |
| Multi-step feedback survey | Single question + one response | User decision for Phase 9 | Low-friction, high completion rate |

## Architectural Decisions to Make

### Decision 1: Check-in Time -- Fixed vs Configurable
**Recommendation:** Use a fixed time within the 8-9pm window (e.g., 20:30) derived from the user's timezone in reminder_settings. Do NOT add a separate `checkinTime` setting -- the user's timezone is already configured and 20:30 is a reasonable default. If a user wants to change it, that could be a future enhancement.

### Decision 2: Multiple Meals Per Day
**Recommendation:** For multiple meals in one day, send a single consolidated check-in that lists all meals and offers feedback buttons for each. This avoids bombarding the user. The check-in message would look like:

```
How'd today's cooking go?

Lunch: Tuna Salad
[thumbs-up] [neutral] [thumbs-down] [Skipped]

Dinner: Chicken Parm
[thumbs-up] [neutral] [thumbs-down] [Skipped]
```

Callback data encodes both the reminder ID and the meal entry ID: `f:pos:42:15` (feedback:sentiment:reminderId:entryIndex).

### Decision 3: Feedback Annotation Format
**Recommendation:** Plain text with a clear marker, appended to the knowledge item's content field:

```
Feedback:
- 2026-02-03 [positive]: Perfectly crispy, family loved it
- 2026-01-27 [neutral]: Good but needed more seasoning
- 2026-01-20 [skipped]: Ordered pizza instead
```

This is:
- Human-readable when viewed via get_knowledge_item
- Parseable by Claude when included in context
- Searchable via FTS5 (feedback text gets indexed)
- Simple to append without parsing existing content

### Decision 4: Deprioritization Threshold
**Recommendation:** Use a simple weighted scoring:
- Each positive: +1
- Each neutral: 0
- Each negative: -1
- Each skipped: 0 (neutral for recipe quality, valuable for plan adherence)

When the total score is -2 or below (i.e., net 2+ more negatives than positives), the recipe is "deprioritized" -- Claude is instructed in the system prompt to prefer other options but can still suggest it if asked. This is surfaced via the feedback context, not a hard algorithmic filter. Claude makes the judgment call based on the annotations.

### Decision 5: Free-Text Response Detection
**Recommendation:** Use a two-pronged approach:
1. **Reply-to detection:** If the user's message is a reply to a check-in message (via `reply_to_message.message_id`), treat it as feedback.
2. **Recency window:** If there's an unanswered check-in (status=sent) from the last 4 hours, and the user sends a message, check if it looks like feedback (short message, sentiment words). This is a fallback -- most users will use buttons or reply-to.

The safest approach: if unsure, route through the normal conversation pipeline. Claude can see the feedback context and will naturally handle it.

## Open Questions

1. **Check-in generation timing**
   - What we know: Feedback check-ins need to be generated alongside regular reminders.
   - What's unclear: Should `generateFeedbackCheckins` be called from the same `regenerateReminders` helper, or separately?
   - Recommendation: Call it from the same helper. It reads the same meal plan data and follows the same pattern. The generator function can be in a separate file but invoked together.

2. **Feedback for recipes without knowledge items**
   - What we know: Some planned meals have no `knowledgeItemId`.
   - What's unclear: Should we still send check-ins? Where does feedback go?
   - Recommendation: Still send check-ins. Store feedback in `feedback_checkins` table. If the recipe is later saved to the knowledge base, feedback can be retroactively annotated (or left in the tracking table -- Claude can query both).

3. **Check-in expiry mechanism**
   - What we know: Check-ins expire silently.
   - What's unclear: When exactly should a check-in expire?
   - Recommendation: Mark as expired during the next reminder regeneration cycle, or after 24 hours. No user-visible action on expiry.

## Sources

### Primary (HIGH confidence)
- Codebase analysis: `/workspace/src/reminders/` -- complete reminder system (poller, sender, generator, repository, init, types)
- Codebase analysis: `/workspace/src/grocery/buttons.ts` -- inline keyboard and callback pattern
- Codebase analysis: `/workspace/src/knowledge/` -- knowledge item CRUD, FTS5 search, retrieval
- Codebase analysis: `/workspace/src/ai/tools.ts` -- tool definitions for knowledge, plan, grocery, reminder operations
- Codebase analysis: `/workspace/src/ai/system-prompt.ts` -- system prompt construction with context injection
- Codebase analysis: `/workspace/src/pipeline/processor.ts` -- message processing pipeline with tool handling
- Codebase analysis: `/workspace/src/main.ts` -- component wiring and initialization

### Secondary (MEDIUM confidence)
- grammY InlineKeyboard API -- based on working code in grocery/buttons.ts (version 1.39.3)
- Telegram Bot API callback_query behavior -- based on working grocery callback handler
- Claude structured extraction -- based on working reminder text generation in sender.ts

### Tertiary (LOW confidence)
- None -- all patterns are verified against existing working code in the project

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH -- no new libraries needed, all patterns proven in codebase
- Architecture: HIGH -- extends existing reminder/knowledge/callback infrastructure with clear precedents
- Pitfalls: HIGH -- identified from concrete codebase analysis (CHECK constraints, content formats, multi-meal handling)

**Research date:** 2026-02-09
**Valid until:** 2026-03-09 (stable -- no external dependencies to go stale)
