# Phase 6: Meal Planning - Research

**Researched:** 2026-02-06
**Domain:** Conversational meal planning with SQLite storage, Claude tool use, grammY Telegram bot
**Confidence:** HIGH

## Summary

Phase 6 adds meal planning to an existing conversational bot that already has recipes, preferences, knowledge retrieval, and a Claude tool use loop. The user generates and adjusts weekly dinner plans through conversation. The bot proposes meals, the user reacts, and they iterate. Plans are living objects that can always be adjusted. Cooking history is tracked automatically and through user reports.

The primary design decision is **dedicated tables vs knowledge items** for plan storage. After analyzing the codebase, the recommendation is **dedicated tables** for meal plans and cooking history, with knowledge items used only for the existing recipe/preference data. Plans have structured relationships (week + day + meal type + recipe reference) that benefit from relational queries, and cooking history needs date-range queries and automatic status transitions that are impractical with FTS-only knowledge items.

The implementation extends the existing patterns: new Drizzle schema tables, new Claude tools for plan CRUD, system prompt additions for planning behavior, a `/plan` command handler, and wiring through the existing pipeline.

**Primary recommendation:** Add `meal_plans`, `meal_plan_entries`, and `cooking_history` tables. Expose them to Claude via 4-5 new tools. Keep the conversational approach entirely in the system prompt -- no algorithmic planning code.

<user_constraints>

## User Constraints (from CONTEXT.md)

### Locked Decisions

**Plan display & structure**
- Monday-Sunday full week plan
- Recipe name only per day -- clean and minimal ("Monday: Chicken Parm")
- Full plan presented all at once in a single message
- Primarily dinners, but the user has the option to fill out a full plan (breakfast, lunch, dinner) -- likely path is dinners only most of the time
- Both conversational recall ("what's for dinner this week") AND a /plan command to view the active plan

**Recipe selection & planning approach**
- Planning is a **conversation**, not an algorithm -- the bot proposes, the user reacts, they iterate
- No rigid selection logic -- bot suggests whatever feels best based on conversation context + preferences
- Bot can suggest both stored recipes and new recipe ideas freely
- Effort/complexity is NOT automatically factored in -- only considered if the user mentions it ("something easy on Tuesday")
- No auto-optimization for variety or recency -- user-driven choices

**Plan adjustment flow**
- Changes applied immediately without confirmation -- user says "swap Thursday to tacos", bot does it and shows the updated plan
- No explicit finalize step -- plan is a living object that can always be adjusted
- Bot may suggest moving on once the conversation feels complete, but never locks the plan
- Multiple active plans supported (e.g., this week and next week)

**Cooking history**
- Planned meals auto-marked as "cooked" after the day passes
- Unplanned meals also trackable -- any meal the user mentions gets logged ("we had pizza tonight")
- History visible to user on request ("what did we eat last week")
- History available to Claude as context for suggestions, but no explicit recency/rotation logic -- just context

### Claude's Discretion
- Plan message formatting and layout within the "recipe name only" constraint
- How to handle ambiguous day references ("this Thursday" vs "next Thursday")
- How to store and retrieve plans (schema design, knowledge items vs dedicated tables)
- Conversation flow for building plans -- how much to suggest vs ask

### Deferred Ideas (OUT OF SCOPE)
None -- discussion stayed within phase scope

</user_constraints>

## Standard Stack

No new libraries needed. This phase uses the existing stack entirely.

### Core (already installed)
| Library | Version | Purpose | Role in Phase 6 |
|---------|---------|---------|-----------------|
| drizzle-orm | ^0.45.1 | ORM for SQLite | Schema for meal_plans, meal_plan_entries, cooking_history tables |
| better-sqlite3 | ^12.6.2 | SQLite driver | Raw SQL for plan queries (same pattern as preferences.ts, fts.ts) |
| @anthropic-ai/sdk | ^0.73.0 | Claude API | Tool definitions for plan CRUD, system prompt for planning |
| grammy | ^1.39.3 | Telegram bot | /plan command handler |

### Supporting (already installed)
| Library | Version | Purpose | Role in Phase 6 |
|---------|---------|---------|-----------------|
| pino | ^10.3.0 | Logging | Plan operation logging |
| vitest | ^4.0.18 | Testing | Unit tests for plan repository, date utilities |

**No new dependencies required.**

## Architecture Patterns

### Recommended Project Structure

```
src/
  db/
    schema.ts              # ADD: meal_plans, meal_plan_entries, cooking_history tables
  planning/                # NEW directory
    schema.ts              # Drizzle schema definitions for planning tables
    repository.ts          # Plan CRUD operations (factory function pattern)
    history.ts             # Cooking history queries and auto-marking logic
    date-utils.ts          # Week calculation, day resolution, date helpers
    context.ts             # Plan context builder for system prompt injection
  ai/
    tools.ts               # ADD: planning tools alongside KNOWLEDGE_TOOLS
    tool-handler.ts        # ADD: plan tool dispatch cases
    system-prompt.ts       # ADD: meal planning instructions section
  bot/
    handlers/
      plan.ts              # NEW: /plan command handler (factory pattern)
    index.ts               # ADD: planHandler registration
  main.ts                  # ADD: plan dependencies wiring
```

### Pattern 1: Dedicated Tables (Recommended over Knowledge Items)

**What:** Store meal plans in dedicated relational tables rather than as knowledge items.

**Why dedicated tables win for plans:**

1. **Structured queries**: Plans need "get plan for week of 2026-02-10" which is a simple WHERE clause on a date column. With knowledge items, Claude would need to search_knowledge("meal plan February 10") and hope FTS returns the right one.

2. **Multi-row relationships**: A plan has 7+ entries (one per day, possibly 3 per day for full plans). Knowledge items are flat text blobs -- representing structured day-by-day data as free text loses queryability.

3. **Automatic status transitions**: "Planned meals auto-marked as cooked after the day passes" requires a date comparison query (`UPDATE ... WHERE date < current_date AND status = 'planned'`). This is trivial with a date column, impossible with knowledge item text.

4. **Multiple active plans**: "this week and next week" means querying by week_start_date. Relational columns make this direct.

5. **Recipe references**: Plan entries can optionally reference a knowledge_item_id for stored recipes, creating a link between the plan and the recipe system without coupling.

6. **Cooking history queries**: "What did we eat last week?" needs date range queries on structured data.

**What knowledge items are still good for:** Recipes, preferences, cooking notes -- unstructured text that Claude reasons over. Plans are *structured data* that Claude *manages*, which is a different pattern.

### Pattern 2: Tool-Driven Plan Management

**What:** Claude manages plans through tools, not through conversation memory alone.

All plan operations go through tools:
- `create_meal_plan` -- Create a new weekly plan
- `update_meal_plan` -- Add/change entries in a plan
- `get_meal_plan` -- Retrieve the current/specific plan
- `log_cooking_history` -- Record a meal that was cooked (planned or unplanned)
- `get_cooking_history` -- Retrieve recent cooking history

Claude uses these tools to persist state, then responds conversationally. This matches the existing pattern where Claude uses `save_knowledge`, `update_knowledge`, etc. for recipes.

### Pattern 3: System Prompt Planning Instructions

**What:** All planning intelligence lives in the system prompt, not in code.

This matches the Phase 4 pattern exactly: recipe intelligence is entirely in `buildSystemPrompt()`, not in code-level recipe parsing. For meal planning:
- How to propose a plan
- How to handle adjustments
- When to show the updated plan
- How to use cooking history as context
- Formatting rules for plan display

### Pattern 4: Context Injection for Plans

**What:** Active plan data is injected into the system prompt alongside preferences.

Just as `buildSystemPrompt(preferences)` injects preference context, the system prompt should also receive:
- The active plan(s) summary
- Recent cooking history (last 2-3 weeks)

This gives Claude context without requiring tool calls for every message. Claude can reference "your current plan has chicken parm on Monday" naturally.

### Anti-Patterns to Avoid

- **Storing plans as knowledge items:** Loses queryability, makes date-based operations impossible, conflates unstructured knowledge with structured data.
- **Algorithmic plan generation in code:** User explicitly decided against this. No "plan generator" function that optimizes for variety/recency. Claude proposes, user reacts.
- **Confirmation flow for plan changes:** User explicitly decided against this. Changes applied immediately. No "Are you sure you want to swap Thursday?"
- **Plan locking/finalizing:** User explicitly decided no finalize step. Plans are always editable.
- **Auto-optimization logic:** No code that factors in effort, variety, or recency automatically. Claude has context but the user drives choices.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Week start/end calculation | Custom date math | Standard ISO week calculation with `Date` API | Off-by-one errors, timezone edge cases |
| Day-of-week resolution | String parsing ("Monday" -> 0) | Lookup table constant | Consistent, no locale issues |
| Plan display formatting | Template engine | System prompt instructions (same as recipe display) | Claude formats within constraints; no rigid template |
| Recipe selection algorithm | Scoring/ranking function | System prompt context (preferences + history + recipes) | User explicitly rejected algorithmic planning |
| "This week" vs "next week" | Complex NLP parsing | Let Claude handle in conversation + system prompt rules | Claude already handles natural language; just give it the tools |

## Common Pitfalls

### Pitfall 1: Overengineering the Data Model

**What goes wrong:** Creating tables for meal types, serving sizes, nutrition, plan templates, etc.
**Why it happens:** Developer instinct to model the full domain upfront.
**How to avoid:** Keep it minimal. A plan is: week_start_date + day + optional meal_type + recipe_name. That's it. The user said "recipe name only" for display. Don't model what you don't need.
**Warning signs:** More than 3 tables, columns for data the user didn't ask for.

### Pitfall 2: Timezone Confusion in Date Handling

**What goes wrong:** Auto-marking meals as "cooked" at midnight UTC instead of midnight in the user's timezone.
**Why it happens:** SQLite stores dates as integers (Unix timestamps in UTC). "After the day passes" depends on the user's timezone.
**How to avoid:** Store plan dates as ISO date strings (YYYY-MM-DD), not timestamps. "Monday 2026-02-09" is a date, not a moment in time. The auto-marking can happen on a simple date comparison: `date < CURRENT_DATE`. For the initial implementation, assume a single user in a single timezone (configured or defaulted). Timezone per-user can be a preference.
**Warning signs:** Using Unix timestamps for plan dates, complex timezone conversion code.

### Pitfall 3: Making Claude Call Tools for Every Plan Reference

**What goes wrong:** Every time the user says "what's for dinner tonight?", Claude has to call `get_meal_plan` before it can answer.
**Why it happens:** Plan data isn't in the system prompt context.
**How to avoid:** Inject active plan summary into the system prompt (like preferences). Claude already knows the plan. Tools are for mutations and explicit queries, not for every read.
**Warning signs:** High tool use count on simple plan questions, slow responses for "what's for dinner?"

### Pitfall 4: Rigid Plan Structure

**What goes wrong:** Requiring exactly 7 entries, requiring all meal types filled, rejecting partial plans.
**Why it happens:** Modeling Monday-Sunday as a fixed structure.
**How to avoid:** Plan entries are individual rows. A plan can have 1 entry or 21 entries. "Primarily dinners" means most plans will have 7 rows (one per day, dinner only). A "full plan" has more rows. An incomplete plan is fine.
**Warning signs:** Validation that rejects plans with < 7 entries, forced meal type selection.

### Pitfall 5: Conflating Plan Tools with Knowledge Tools

**What goes wrong:** Trying to use save_knowledge/update_knowledge for plan data, or mixing plan tool results into knowledge search results.
**Why it happens:** Desire to reuse existing infrastructure.
**How to avoid:** Plan tools are separate from knowledge tools. They operate on different tables. Both are passed to Claude together in the tools array, but their implementations are independent.
**Warning signs:** Plan data appearing in search_knowledge results, using knowledge tags for plan metadata.

### Pitfall 6: Ambiguous Day References Without Week Context

**What goes wrong:** User says "swap Thursday to tacos" but there are plans for this week and next week. Which Thursday?
**Why it happens:** Natural language is ambiguous about time references.
**How to avoid:** System prompt should instruct Claude to:
  1. Default to the current/most recent plan's week
  2. If ambiguous, ask: "Do you mean this Thursday or next Thursday?"
  3. Use explicit dates in tool calls, never ambiguous references
**Warning signs:** Tool calls with day names instead of dates, wrong week being modified.

## Code Examples

### Schema Design (Drizzle)

```typescript
// src/planning/schema.ts
import { integer, sqliteTable, text } from "drizzle-orm/sqlite-core";

export const mealPlans = sqliteTable("meal_plans", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  chatId: text("chat_id").notNull(),
  weekStartDate: text("week_start_date").notNull(), // ISO: "2026-02-09" (Monday)
  createdAt: integer("created_at", { mode: "timestamp" })
    .notNull()
    .$defaultFn(() => new Date()),
  updatedAt: integer("updated_at", { mode: "timestamp" })
    .notNull()
    .$defaultFn(() => new Date()),
});

export const mealPlanEntries = sqliteTable("meal_plan_entries", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  planId: integer("plan_id")
    .notNull()
    .references(() => mealPlans.id, { onDelete: "cascade" }),
  dayOfWeek: integer("day_of_week").notNull(), // 0=Monday, 6=Sunday
  mealType: text("meal_type", { enum: ["breakfast", "lunch", "dinner"] })
    .notNull()
    .default("dinner"),
  recipeName: text("recipe_name").notNull(), // Display name (may or may not match a stored recipe)
  knowledgeItemId: integer("knowledge_item_id"), // Optional link to stored recipe
  createdAt: integer("created_at", { mode: "timestamp" })
    .notNull()
    .$defaultFn(() => new Date()),
});

export const cookingHistory = sqliteTable("cooking_history", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  chatId: text("chat_id").notNull(),
  recipeName: text("recipe_name").notNull(),
  knowledgeItemId: integer("knowledge_item_id"), // Optional link to stored recipe
  cookedDate: text("cooked_date").notNull(), // ISO: "2026-02-09"
  mealType: text("meal_type", { enum: ["breakfast", "lunch", "dinner"] })
    .notNull()
    .default("dinner"),
  source: text("source", { enum: ["planned", "unplanned"] })
    .notNull()
    .default("planned"), // Was this from a plan or ad-hoc?
  notes: text("notes"), // Optional notes ("tried the spicy version")
  createdAt: integer("created_at", { mode: "timestamp" })
    .notNull()
    .$defaultFn(() => new Date()),
});
```

**Design notes:**
- `weekStartDate` as text (ISO date) avoids timezone issues. Monday is always the start.
- `dayOfWeek` as integer (0-6) enables simple arithmetic and ordering.
- `mealType` defaults to "dinner" since that's the primary use case.
- `knowledgeItemId` is optional -- plans can reference stored recipes OR be free-text names (new ideas, restaurants, etc.).
- `cookingHistory.source` distinguishes planned meals from ad-hoc reports.
- No unique constraint on plan + day + mealType -- allows easy upsert via delete-then-insert.

### Tool Definitions Pattern

```typescript
// New tools added to the KNOWLEDGE_TOOLS array or a separate PLAN_TOOLS array
export const PLAN_TOOLS: Anthropic.Tool[] = [
  {
    name: "save_meal_plan",
    description:
      "Save or update a weekly meal plan. Provide the week start date (Monday) " +
      "and an array of meal entries. Each entry needs a day (0=Mon through 6=Sun), " +
      "meal type, and recipe name. Replaces all entries for that week -- always " +
      "send the COMPLETE plan, not just changes.",
    input_schema: {
      type: "object" as const,
      properties: {
        week_start_date: {
          type: "string",
          description: "Monday of the plan week in ISO format: YYYY-MM-DD",
        },
        entries: {
          type: "array",
          items: {
            type: "object",
            properties: {
              day: { type: "number", description: "0=Monday through 6=Sunday" },
              meal_type: {
                type: "string",
                enum: ["breakfast", "lunch", "dinner"],
                description: "Meal type (default: dinner)",
              },
              recipe_name: {
                type: "string",
                description: "Name of the recipe or meal",
              },
              knowledge_item_id: {
                type: "number",
                description: "Optional ID of stored recipe in knowledge base",
              },
            },
            required: ["day", "recipe_name"],
          },
          description: "Array of meal entries for the week",
        },
      },
      required: ["week_start_date", "entries"],
    },
  },
  {
    name: "get_meal_plan",
    description:
      "Get the meal plan for a specific week. If no week specified, returns " +
      "the current week's plan. Returns all entries for the week.",
    input_schema: {
      type: "object" as const,
      properties: {
        week_start_date: {
          type: "string",
          description:
            "Monday of the plan week in ISO format: YYYY-MM-DD. " +
            "Omit for current week.",
        },
      },
      required: [],
    },
  },
  {
    name: "log_meal",
    description:
      "Log a meal to cooking history. Use for both planned meals and " +
      "unplanned meals the user mentions (\"we had pizza tonight\"). " +
      "Planned meals are auto-logged when the day passes, so only use " +
      "this for manual logging of unplanned meals or corrections.",
    input_schema: {
      type: "object" as const,
      properties: {
        recipe_name: {
          type: "string",
          description: "Name of the meal/recipe",
        },
        cooked_date: {
          type: "string",
          description: "Date the meal was cooked in ISO format: YYYY-MM-DD",
        },
        meal_type: {
          type: "string",
          enum: ["breakfast", "lunch", "dinner"],
          description: "Meal type (default: dinner)",
        },
        knowledge_item_id: {
          type: "number",
          description: "Optional ID of stored recipe",
        },
        notes: {
          type: "string",
          description: "Optional notes about the meal",
        },
      },
      required: ["recipe_name", "cooked_date"],
    },
  },
  {
    name: "get_cooking_history",
    description:
      "Get recent cooking history. Returns what was cooked/planned in " +
      "the date range. Defaults to the last 3 weeks if no range specified.",
    input_schema: {
      type: "object" as const,
      properties: {
        start_date: {
          type: "string",
          description: "Start of date range in ISO format: YYYY-MM-DD",
        },
        end_date: {
          type: "string",
          description: "End of date range in ISO format: YYYY-MM-DD",
        },
      },
      required: [],
    },
  },
];
```

### Plan Repository Pattern (following knowledge/repository.ts)

```typescript
// src/planning/repository.ts
export function createPlanRepository(db: DrizzleDatabase) {
  return {
    /**
     * Save a meal plan for a week. Replaces all existing entries for that week.
     * Uses delete-then-insert for simplicity (no upsert complexity).
     */
    savePlan(chatId: string, weekStartDate: string, entries: PlanEntry[]): MealPlan {
      // Find or create the plan row
      let plan = db.select().from(mealPlans)
        .where(and(
          eq(mealPlans.chatId, chatId),
          eq(mealPlans.weekStartDate, weekStartDate)
        )).get();

      if (plan) {
        // Delete existing entries, update timestamp
        db.delete(mealPlanEntries).where(eq(mealPlanEntries.planId, plan.id)).run();
        db.update(mealPlans).set({ updatedAt: new Date() })
          .where(eq(mealPlans.id, plan.id)).run();
      } else {
        plan = db.insert(mealPlans).values({ chatId, weekStartDate })
          .returning().get();
      }

      // Insert new entries
      for (const entry of entries) {
        db.insert(mealPlanEntries).values({
          planId: plan.id,
          dayOfWeek: entry.day,
          mealType: entry.mealType ?? "dinner",
          recipeName: entry.recipeName,
          knowledgeItemId: entry.knowledgeItemId ?? null,
        }).run();
      }

      return { id: plan.id, weekStartDate, entries };
    },

    /**
     * Get plan for a specific week.
     */
    getPlan(chatId: string, weekStartDate: string): MealPlan | null {
      // ... query plan + entries
    },

    /**
     * Get the active plan(s) for system prompt context injection.
     * Returns current week and next week if they exist.
     */
    getActivePlans(chatId: string): MealPlanSummary[] {
      // ... query plans where weekStartDate >= current week start - 7 days
    },
  };
}
```

### /plan Command Handler Pattern (following preferences.ts)

```typescript
// src/bot/handlers/plan.ts
export function createPlanHandler(sqlite: BetterSqlite3.Database): Composer<BotContext> {
  const planHandler = new Composer<BotContext>();

  planHandler.command("plan", async (ctx) => {
    const chatId = String(ctx.chat.id);
    // Get current week's plan using raw SQLite (matches preferences.ts pattern)
    const plan = getCurrentWeekPlan(sqlite, chatId);

    if (!plan || plan.entries.length === 0) {
      await ctx.reply(
        "No meal plan for this week yet! Just say something like " +
        "\"plan my dinners for this week\" and we'll figure it out together."
      );
      return;
    }

    const message = formatPlanMessage(plan);
    await sendFormattedMessage(ctx, message);
  });

  return planHandler;
}
```

### Plan Display Format

```
<b>This Week's Plan</b>
<i>Feb 10 - Feb 16</i>

Monday - Chicken Parm
Tuesday - Beef Tacos
Wednesday - Pasta Primavera
Thursday - Salmon with Rice
Friday - Pizza Night
Saturday - Grilled Chicken Salad
Sunday - Slow Cooker Pot Roast
```

Design notes:
- `<b>` header with `<i>` date range (matches existing HTML formatting style)
- Recipe name only per day (user decision: clean and minimal)
- Day name + dash + recipe name (simple, scannable)
- No meal type shown when all entries are dinner (the common case)
- Full plan in a single message (user decision)

For multi-meal-type plans:
```
<b>This Week's Plan</b>
<i>Feb 10 - Feb 16</i>

<b>Monday</b>
Breakfast - Overnight Oats
Lunch - Turkey Wrap
Dinner - Chicken Parm
```

### System Prompt Context Injection

```typescript
// Injected alongside preferences in buildSystemPrompt()
function buildPlanContext(plans: MealPlanSummary[], history: CookingHistorySummary[]): string {
  if (plans.length === 0 && history.length === 0) return "";

  let context = "\n<meal_planning_context>";

  if (plans.length > 0) {
    context += "\n\nACTIVE PLANS:";
    for (const plan of plans) {
      context += `\nWeek of ${plan.weekStartDate}:`;
      for (const entry of plan.entries) {
        context += `\n- ${DAY_NAMES[entry.dayOfWeek]}: ${entry.recipeName}`;
      }
    }
  }

  if (history.length > 0) {
    context += "\n\nRECENT COOKING HISTORY (last 3 weeks):";
    for (const entry of history) {
      context += `\n- ${entry.cookedDate}: ${entry.recipeName}`;
    }
  }

  context += "\n</meal_planning_context>";
  return context;
}
```

### Date Utility Functions

```typescript
// src/planning/date-utils.ts

/** Day name constants for display. */
export const DAY_NAMES = [
  "Monday", "Tuesday", "Wednesday", "Thursday",
  "Friday", "Saturday", "Sunday",
] as const;

/**
 * Get the Monday of the week containing the given date.
 * Uses ISO week rules (Monday = start of week).
 */
export function getWeekStartDate(date: Date = new Date()): string {
  const d = new Date(date);
  const day = d.getDay(); // 0=Sunday, 1=Monday, ..., 6=Saturday
  const diff = d.getDate() - day + (day === 0 ? -6 : 1); // Adjust to Monday
  d.setDate(diff);
  return d.toISOString().split("T")[0]; // "YYYY-MM-DD"
}

/**
 * Resolve a day name to a day-of-week number.
 * 0=Monday through 6=Sunday (ISO convention).
 */
export function resolveDayOfWeek(dayName: string): number | null {
  const normalized = dayName.toLowerCase().trim();
  const index = DAY_NAMES.findIndex(d => d.toLowerCase() === normalized);
  return index >= 0 ? index : null;
}
```

### Auto-Marking Planned Meals as Cooked

```typescript
// Called once per pipeline invocation (or on /plan command) to transition past meals
export function autoMarkCookedMeals(sqlite: BetterSqlite3.Database, chatId: string): number {
  const today = new Date().toISOString().split("T")[0]; // "YYYY-MM-DD"

  // Find plan entries for past dates that haven't been logged to history yet
  const result = sqlite.prepare(`
    INSERT INTO cooking_history (chat_id, recipe_name, knowledge_item_id, cooked_date, meal_type, source)
    SELECT
      mp.chat_id,
      mpe.recipe_name,
      mpe.knowledge_item_id,
      date(mp.week_start_date, '+' || mpe.day_of_week || ' days') as cooked_date,
      mpe.meal_type,
      'planned'
    FROM meal_plans mp
    JOIN meal_plan_entries mpe ON mpe.plan_id = mp.id
    WHERE mp.chat_id = ?
      AND date(mp.week_start_date, '+' || mpe.day_of_week || ' days') < ?
      AND NOT EXISTS (
        SELECT 1 FROM cooking_history ch
        WHERE ch.chat_id = mp.chat_id
          AND ch.recipe_name = mpe.recipe_name
          AND ch.cooked_date = date(mp.week_start_date, '+' || mpe.day_of_week || ' days')
          AND ch.meal_type = mpe.meal_type
      )
  `).run(chatId, today);

  return result.changes;
}
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Knowledge items for everything | Dedicated tables for structured data, knowledge items for unstructured | Phase 6 design decision | Plans get proper relational queries |
| Fixed system prompt | Dynamic system prompt with context injection | Phase 5 (preferences) | Plan context follows same pattern |
| Knowledge tools only | Knowledge + planning tools in same tool array | Phase 6 | More tool call types, same loop |

**Key insight:** The codebase has been building toward this moment. The `buildSystemPrompt()` function was designed as a function (not constant) specifically for context injection. The tool handler dispatch is a simple switch statement that extends naturally. The factory function pattern for command handlers is established. Phase 6 follows all existing patterns -- just more of them.

## Architecture Recommendations (Claude's Discretion Items)

### 1. Storage: Dedicated Tables (RECOMMENDED)

Three new tables: `meal_plans`, `meal_plan_entries`, `cooking_history`. See schema design in Code Examples above. Rationale covered extensively in Architecture Patterns section.

Confidence: HIGH -- based on analysis of existing codebase patterns and query requirements.

### 2. Plan Message Formatting

Format: Day name + dash + recipe name, one line per day. `<b>` header, `<i>` date range. Single message. See Code Examples for exact format.

For the rare multi-meal plan, group by day with `<b>` day headers.

Confidence: HIGH -- follows existing HTML formatting conventions in the codebase.

### 3. Ambiguous Day References

System prompt instructs Claude to:
- Default to current week when references are ambiguous
- Ask for clarification when there are multiple active plans and the target is unclear
- Always use ISO dates (YYYY-MM-DD) in tool calls, never day names
- Claude resolves "this Thursday" vs "next Thursday" based on conversation context (this is exactly what LLMs are good at)

Confidence: MEDIUM -- LLMs generally handle temporal references well, but edge cases exist (e.g., on a Thursday, does "Thursday" mean today or next week?). System prompt guidance helps but won't eliminate all ambiguity.

### 4. Conversation Flow for Building Plans

System prompt approach: Claude proposes a full week plan first, then the user reacts. Key instructions:
- When user asks for a plan, Claude should propose all 7 days at once
- Claude should search recipes and cooking history first (via tools) to inform suggestions
- After presenting the initial proposal, wait for feedback
- Apply changes immediately, show updated plan
- Never ask "is this final?" -- the plan is always open for changes
- If the conversation naturally winds down, Claude can suggest "looks like a good week" but not lock anything

Confidence: HIGH -- aligns directly with user's explicit guidance ("conversational, not algorithmic").

## Open Questions

### 1. Timezone for Auto-Marking

**What we know:** The user wants planned meals auto-marked as cooked after the day passes. We store plan dates as ISO date strings to avoid timezone issues.
**What's unclear:** When exactly should auto-marking fire? If the user is in US Central and it's 11pm Monday, is Monday "past"? The simplest approach: auto-mark when the pipeline processes a message and the date has passed. This means it fires naturally when the user interacts with the bot.
**Recommendation:** Use `new Date().toISOString().split("T")[0]` for "today" in auto-marking. This uses server time. For V1, this is fine. If the user is in a different timezone, they can set a timezone preference later, and the date comparison can be adjusted.

### 2. Token Budget Impact

**What we know:** Current prompt has ~4K knowledge token budget and ~2K conversation budget. Adding active plans and cooking history to the system prompt increases base token usage.
**What's unclear:** How much token budget does plan context consume? A 7-entry plan is ~100 tokens. 3 weeks of history (~21 entries) is ~300 tokens.
**Recommendation:** Plan context is small enough (400-500 tokens) to inject unconditionally without impacting the existing budget significantly. No budget adjustment needed.

### 3. Table Creation Pattern

**What we know:** The existing codebase uses `initializeFts()` with raw `CREATE TABLE IF NOT EXISTS` SQL in `fts.ts` for the knowledge tables. Drizzle schema exists but `drizzle-kit push` is available for schema sync.
**What's unclear:** Should new tables follow the `CREATE TABLE IF NOT EXISTS` raw SQL pattern (like fts.ts) or rely on drizzle-kit push?
**Recommendation:** Follow the existing pattern -- add `CREATE TABLE IF NOT EXISTS` statements in a new initialization function called from `createDatabase()` or `initializeFts()`. This ensures tables exist at startup without requiring a migration step. The Drizzle schema definitions remain the source of truth for types and queries.

## Sources

### Primary (HIGH confidence)
- **Codebase analysis** -- Read all source files in src/ (schema, tools, handlers, pipeline, system prompt, repository, preferences, fts, retrieval, config, main)
- **CONTEXT.md** -- User decisions from discussion phase
- **ROADMAP.md and STATE.md** -- Project context and prior decisions

### Secondary (MEDIUM confidence)
- **Drizzle ORM patterns** -- Verified against existing codebase usage (not external docs needed; the project already uses Drizzle extensively)
- **grammY command handler patterns** -- Verified against 4 existing handler files (start, costs, debug, preferences)

### Tertiary (LOW confidence)
- None -- this phase requires no new libraries or external patterns; it is an extension of existing codebase patterns.

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH -- no new dependencies, extending existing patterns
- Architecture (dedicated tables): HIGH -- thorough analysis of query requirements vs knowledge item capabilities
- Architecture (tool design): HIGH -- follows exact pattern of existing knowledge tools
- Pitfalls: HIGH -- based on direct codebase analysis and understanding of user decisions
- Date handling: MEDIUM -- timezone edge cases exist but V1 approach is reasonable
- Token budget impact: MEDIUM -- estimates based on typical plan sizes, not measured

**Research date:** 2026-02-06
**Valid until:** No expiration -- this research is based on the current codebase state, not external libraries with version drift.
