# Phase 7: Grocery Lists - Research

**Researched:** 2026-02-08
**Domain:** Grocery list generation from meal plans with inline Telegram buttons, ingredient aggregation via Claude, user-configurable store splitting, and conversational check-off
**Confidence:** HIGH

## Summary

Phase 7 adds grocery list generation to an existing meal planning bot that already has recipes, preferences, meal plans, and a Claude tool use loop. The grocery list is generated from the active meal plan, with Claude handling ingredient aggregation (combining "2 onions" from one recipe with "1 onion" from another into "3 onions"). Lists are organized by user-defined stores (not hardcoded) and by store sections within each store. After generation, a "check the pantry" conversational step lets users remove items they have and add non-recipe items.

The key technical challenge is the inline Telegram buttons for item check-off. This requires new grammY patterns not yet used in the codebase: `InlineKeyboard` for buttons, `bot.on("callback_query:data")` for handling button presses, `ctx.editMessageText()` for updating the list in place, and `ctx.answerCallbackQuery()` to dismiss loading indicators. The grocery list data needs a dedicated table (same pattern as meal plans) since it has structured state (items, checked status, store assignment) that Claude manages through tools.

Store preferences are stored using the existing Phase 5 preference system (knowledge items tagged with "preference" and domain tags like "pref:grocery") -- no separate data model. Claude reads these preferences when generating the list to assign items to the correct stores.

**Primary recommendation:** Add `grocery_lists` and `grocery_list_items` tables. Use Claude tools for list generation/management. Implement grammY InlineKeyboard with callback queries for tap-to-check. Edit the list message in place when items are checked. Store preferences go in the existing knowledge/preference system with `pref:grocery` tags.

<user_constraints>

## User Constraints (from CONTEXT.md)

### Locked Decisions

**List format & display**
- Single message with store headers as top-level sections
- Items grouped by store section within each store (Produce, Dairy, Meat, Pantry, etc.)
- Item format: quantity + item only (no recipe source attribution)
- `/grocery` command for quick access AND conversational retrieval ("show my grocery list")

**Store splitting logic**
- Stores are user-configurable, not hardcoded -- each user defines their own stores
- User teaches store preferences explicitly (item-by-item or by category, e.g., "I get all meat at Costco")
- Store preferences stored as user preferences (existing Phase 5 preference system), not a separate data model
- Each user sets a default store -- unassigned items go there
- Unlimited stores per user (Kroger, Costco, Trader Joe's, farmer's market, etc.)

**Ingredient aggregation**
- Claude handles aggregation -- no code-level ingredient parsing
- Claude reads recipes from the meal plan and intelligently combines quantities when generating the list
- Full list generated first (all ingredients included, no staple filtering)
- After generation: "check the pantry" step where user conversationally removes what they have and adds extras (snacks, drinks, non-recipe items)
- Extra items mixed into appropriate store sections (not a separate "Other" section)

**Checking off items**
- Both inline Telegram buttons (tap-to-check) AND conversational check-off ("got the chicken and onions", "got everything from produce")
- List message edits in place when items are checked (single source of truth)
- Checked items shown with strikethrough (stay visible, easy to undo)
- No special completion interaction when all items checked

### Claude's Discretion

- Store section categorization logic (what counts as "produce" vs "pantry")
- Exact inline button layout and grouping
- How to handle the conversational "check the pantry" flow prompt
- Aggregation approach for ambiguous quantities

### Deferred Ideas (OUT OF SCOPE)

None -- discussion stayed within phase scope

</user_constraints>

## Standard Stack

No new libraries needed. This phase uses the existing stack entirely with one new built-in grammY feature (InlineKeyboard).

### Core (already installed)
| Library | Version | Purpose | Role in Phase 7 |
|---------|---------|---------|-----------------|
| grammy | ^1.39.3 | Telegram bot | InlineKeyboard for check-off buttons, callback_query handling, editMessageText |
| drizzle-orm | ^0.45.1 | ORM for SQLite | Schema for grocery_lists, grocery_list_items tables |
| better-sqlite3 | ^12.6.2 | SQLite driver | Raw SQL for grocery queries, table initialization |
| @anthropic-ai/sdk | ^0.73.0 | Claude API | Tools for list generation/management, ingredient aggregation |
| @grammyjs/parse-mode | ^1.11.1 | HTML parse mode | Strikethrough formatting with `<s>` tags |

### Supporting (already installed)
| Library | Version | Purpose | Role in Phase 7 |
|---------|---------|---------|-----------------|
| pino | ^10.3.0 | Logging | Grocery operation logging |
| vitest | ^4.0.18 | Testing | Unit tests for grocery repository, button handling |

**No new dependencies required.** `InlineKeyboard` is a built-in grammY class -- no plugin needed.

## Architecture Patterns

### Recommended Project Structure

```
src/
  grocery/                  # NEW directory
    schema.ts               # Drizzle schema: grocery_lists, grocery_list_items
    repository.ts           # Grocery list CRUD (factory function pattern)
    init.ts                 # CREATE TABLE IF NOT EXISTS (same pattern as planning/history.ts)
    buttons.ts              # InlineKeyboard builder + callback data encoding/decoding
  ai/
    tools.ts                # ADD: GROCERY_TOOLS array
    tool-handler.ts         # ADD: grocery tool dispatch cases
    system-prompt.ts        # ADD: grocery list instructions section
  bot/
    handlers/
      grocery.ts            # NEW: /grocery command handler + callback query handler
    index.ts                # ADD: groceryHandler + callbackHandler registration
  db/
    schema.ts               # ADD: re-export grocery schema tables
    index.ts                # ADD: initializeGrocery() call
  main.ts                   # ADD: grocery dependencies wiring
```

### Pattern 1: Dedicated Tables for Grocery Lists

**What:** Store grocery lists in dedicated tables, not as knowledge items.

**Why:** Same reasoning as Phase 6 meal plans -- grocery lists have structured state (items with checked/unchecked status, store assignment, section grouping) that requires relational queries. Knowledge items are for unstructured text. A grocery list needs:
- Query: "get all unchecked items for store X"
- Update: "mark item Y as checked"
- Query: "get the active list for this chat"
- Structured fields per item: name, quantity, store, section, checked status

**Schema design:**

```typescript
// src/grocery/schema.ts
import { integer, sqliteTable, text } from "drizzle-orm/sqlite-core";

export const groceryLists = sqliteTable("grocery_lists", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  chatId: text("chat_id").notNull(),
  planId: integer("plan_id"),           // Optional link to the meal plan it was generated from
  messageId: integer("message_id"),      // Telegram message ID for in-place editing
  status: text("status", { enum: ["draft", "active", "completed"] })
    .notNull()
    .default("active"),
  createdAt: integer("created_at", { mode: "timestamp" })
    .notNull()
    .$defaultFn(() => new Date()),
  updatedAt: integer("updated_at", { mode: "timestamp" })
    .notNull()
    .$defaultFn(() => new Date()),
});

export const groceryListItems = sqliteTable("grocery_list_items", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  listId: integer("list_id")
    .notNull()
    .references(() => groceryLists.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  quantity: text("quantity"),            // "2 lbs", "3", "1 bunch" -- freeform text
  store: text("store").notNull(),        // User-defined store name
  section: text("section").notNull(),    // "Produce", "Dairy", "Meat", "Pantry", etc.
  checked: integer("checked", { mode: "boolean" })
    .notNull()
    .default(false),
  createdAt: integer("created_at", { mode: "timestamp" })
    .notNull()
    .$defaultFn(() => new Date()),
});
```

**Key design decisions:**
- `messageId` on the list tracks which Telegram message to edit in place
- `quantity` is freeform text because Claude generates it ("2 lbs", "1 bunch", "3 cans")
- `store` and `section` are freeform text, not enums, because stores and sections are user-defined
- `checked` is boolean for simple toggle
- No `planId` foreign key constraint -- soft link since plans can change
- `status` allows tracking draft (during pantry check) vs active vs completed

### Pattern 2: Callback Data Encoding for Inline Buttons

**What:** Encode item IDs in callback data for inline keyboard buttons.

**Telegram API constraint:** callback_data is limited to 64 bytes (UTF-8). This is critical for button design.

**Recommended encoding:**

```typescript
// Callback data format: "g:<action>:<item_id>"
// Examples:
//   "g:t:42"     -- toggle item 42
//   "g:t:123"    -- toggle item 123
//
// Under 64 bytes even with large IDs (max ~20 chars total)

const GROCERY_CB_PREFIX = "g:";

function encodeToggle(itemId: number): string {
  return `${GROCERY_CB_PREFIX}t:${itemId}`;
}

function parseCallback(data: string): { action: string; itemId: number } | null {
  if (!data.startsWith(GROCERY_CB_PREFIX)) return null;
  const parts = data.slice(GROCERY_CB_PREFIX.length).split(":");
  if (parts.length !== 2) return null;
  return { action: parts[0], itemId: parseInt(parts[1], 10) };
}
```

**Button layout recommendation:**

Given Telegram's limits (8 buttons per row, 100 buttons total), and that a grocery list could have 30-60+ items, full per-item buttons are impractical. Recommended approach:

- Show items as text in the message (not as buttons)
- Use a small set of section-level toggle buttons at the bottom
- Or: show a paginated set of item buttons grouped by section
- Primary interaction is conversational ("got the chicken"), buttons are a convenience

**Practical button layout:**
- One button per store section (e.g., "Produce", "Dairy", "Meat") that, when tapped, shows the items in that section with individual toggle buttons
- Or: flatten all items as buttons, grouped by section with section header buttons that are non-functional
- With 100 button limit, aim for ~50 items with buttons, plus navigational buttons

**Recommended approach:** Show the full list as formatted text in the message body. Add a compact row of buttons at the bottom for the most actionable items (or section-level "mark all" buttons). The primary check-off mechanism is conversational ("got the onions and chicken"), with buttons as a tap-friendly supplement.

### Pattern 3: In-Place Message Editing

**What:** The grocery list message edits itself in place when items are checked/unchecked.

**How it works:**

1. When the list is first sent, store the Telegram message ID in the `grocery_lists.messageId` column
2. When a callback query fires (button tap) or Claude checks off items conversationally, rebuild the formatted message and call `ctx.editMessageText()`
3. Use `<s>strikethrough</s>` for checked items (Telegram HTML supports `<s>`, `<strike>`, and `<del>` tags)

```typescript
// After sending the initial list message
const sentMessage = await ctx.reply(formattedList, {
  reply_markup: inlineKeyboard,
  parse_mode: "HTML",  // Already set globally, but explicit here
});
// Store sentMessage.message_id in grocery_lists.messageId

// When editing after a check-off
await ctx.api.editMessageText(
  chatId,
  messageId,          // The stored Telegram message ID
  rebuiltFormattedList,
  {
    parse_mode: "HTML",
    reply_markup: updatedKeyboard,
  }
);
```

**Critical detail:** When editing via callback query, use `ctx.editMessageText()` directly (it uses the message from the callback query context). When editing via conversational check-off (tool call), use `ctx.api.editMessageText(chatId, messageId, text)` since the edit happens outside the callback context.

### Pattern 4: Store Preferences via Existing Preference System

**What:** Store shopping preferences use the existing knowledge item + tag system from Phase 5.

**How Claude saves store preferences:**

```
User: "I get all my meat at Costco"

Claude saves via save_knowledge:
  title: "Meat shopping preference - Costco"
  summary: "User buys all meat at Costco"
  content: "Shopping store preference: All meat items should be assigned to Costco. This includes beef, chicken, pork, fish, shrimp, and other proteins."
  tags: ["preference", "pref:grocery", "store:costco", "category:meat"]

User: "My default store is Kroger"

Claude saves via save_knowledge:
  title: "Default grocery store - Kroger"
  summary: "Kroger is the default store for grocery shopping"
  content: "Default grocery store: Kroger. All items without a specific store preference should be assigned to Kroger."
  tags: ["preference", "pref:grocery", "store:kroger", "default-store"]
```

**Claude reads these preferences** when generating the list. The preferences are already injected into the system prompt via the existing `getPreferenceSummaries()` function. Claude uses them to assign items to stores during list generation.

**Tag conventions for store preferences:**
- `preference` -- standard preference tag (required for getPreferenceSummaries to find it)
- `pref:grocery` -- domain tag for grocery preferences
- `store:<name>` -- which store this preference relates to
- `default-store` -- marks the default store preference
- `category:<section>` -- what food category this preference covers

### Pattern 5: Claude Tool Flow for List Generation

**What:** Claude generates the grocery list through a multi-step tool flow.

**Generation flow:**

1. User says "make my grocery list" or uses `/grocery`
2. Claude calls `get_meal_plan` to get the active plan
3. Claude calls `search_knowledge` multiple times to get full recipes for each meal
4. Claude calls `get_knowledge_item` for each recipe to get ingredients
5. Claude reads store preferences from the system prompt context
6. Claude calls `save_grocery_list` with the aggregated, store-split, section-organized list
7. Bot sends the formatted list with inline buttons
8. Claude prompts the "check the pantry" step

**This means the tool use loop may need 5+ iterations** for list generation (plan lookup + multiple recipe lookups + list save). The existing max iterations of 5 may need to increase to 7-8 for grocery flows.

### Anti-Patterns to Avoid

- **Code-level ingredient parsing:** User explicitly decided Claude handles aggregation. No regex for "2 cups flour" -> { amount: 2, unit: "cups", item: "flour" }.
- **Hardcoded stores:** Stores are user-defined. No `enum: ["Kroger", "Costco"]` anywhere.
- **Separate store data model:** Store preferences use the existing knowledge/preference system. No `stores` table.
- **Full per-item buttons for large lists:** Telegram has a 100-button limit. A 50-item list with toggle buttons is feasible, but 80+ items would exceed the limit.
- **Sending a new message for each check-off:** The list edits in place. Only one message is the source of truth.
- **Separate "Extra items" section:** User explicitly said extra items (snacks, beverages) should be mixed into appropriate store sections, not isolated.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Ingredient parsing/aggregation | NLP parser for "2 cups flour" | Claude's reasoning | Claude is better at fuzzy matching ("chicken breast" + "boneless chicken" = same item) |
| Store section categorization | Category lookup table | Claude's knowledge | Claude knows "avocados" is produce, "Greek yogurt" is dairy without a mapping table |
| Inline keyboard building | Raw JSON for reply_markup | grammY `InlineKeyboard` class | Built-in, type-safe, handles row/button management |
| Message ID tracking for edits | Session state / in-memory map | Database column on grocery_lists | Persists across restarts, survives multiple webhook handlers |
| Store preference storage | Custom stores table | Existing knowledge items with tags | User explicitly decided this; existing system handles it |
| Quantity normalization | Unit conversion library | Claude's reasoning | "1/2 lb" + "8 oz" = Claude can figure out "1 lb" without a conversion library |

**Key insight:** The agent-first architecture means almost all "intelligence" for this feature lives in Claude's system prompt instructions and tool definitions, not in code. Code handles data persistence, Telegram API interaction, and button mechanics. Claude handles list generation, aggregation, section categorization, and conversational check-off interpretation.

## Common Pitfalls

### Pitfall 1: Telegram Message ID Not Persisted

**What goes wrong:** The grocery list message cannot be edited in place because the Telegram message ID was lost after the initial send.
**Why it happens:** Storing message_id in memory instead of database. Bot restarts, different webhook handler instances, or queue processing means the context that sent the message is gone.
**How to avoid:** Store `sentMessage.message_id` in the `grocery_lists.messageId` column immediately after sending. All edit operations look up the message ID from the database.
**Warning signs:** "Message to edit not found" errors, duplicate list messages instead of edits.

### Pitfall 2: Callback Data Exceeding 64 Bytes

**What goes wrong:** Telegram rejects button callbacks with error 400 BUTTON_DATA_INVALID.
**Why it happens:** Encoding too much information in callback data (store name + section + item name + action).
**How to avoid:** Use minimal callback data: `"g:t:42"` (prefix + action + database ID). Look up all context from the database using the item ID. Never encode names, stores, or sections in callback data.
**Warning signs:** Buttons that sometimes work and sometimes fail (depending on item name length).

### Pitfall 3: Tool Use Loop Too Short for List Generation

**What goes wrong:** Claude's response is cut off mid-generation because it hit the max tool iterations limit.
**Why it happens:** Generating a grocery list requires multiple tool calls: get_meal_plan + multiple search_knowledge + multiple get_knowledge_item + save_grocery_list. This can easily be 6-8 iterations.
**How to avoid:** Increase max iterations for grocery-related conversations, or design the tools so that `generate_grocery_list` does the plan/recipe lookup internally (server-side) and passes all recipe content to Claude in a single tool result.
**Warning signs:** Incomplete lists, Claude saying "I couldn't finish generating the list."

### Pitfall 4: editMessageText Fails Without parse_mode

**What goes wrong:** Edited message loses all HTML formatting (no bold headers, no strikethrough).
**Why it happens:** The global parse mode set by `bot.api.config.use(parseMode("HTML"))` applies to `sendMessage` but may not propagate to `editMessageText` when called via `ctx.api.editMessageText()`.
**How to avoid:** Always explicitly pass `parse_mode: "HTML"` when calling `editMessageText`. This is confirmed to work in grammY: `ctx.editMessageText(text, { parse_mode: "HTML" })`.
**Warning signs:** Formatted messages become plain text after first edit, `<b>` and `<s>` tags showing as literal text.

### Pitfall 5: Race Condition on Rapid Button Taps

**What goes wrong:** User taps two buttons rapidly. Both callbacks try to edit the same message concurrently. One fails with "message is not modified" or a stale state.
**Why it happens:** Telegram sends callback queries independently; the bot processes them in parallel.
**How to avoid:** Use the database as the source of truth. Each callback handler: 1) updates the item in the database, 2) rebuilds the full message from the database, 3) calls editMessageText. If the message content hasn't actually changed (same text), catch the "message is not modified" error silently. Consider a per-list mutex or sequential processing, but the catch-and-ignore approach is simpler and sufficient.
**Warning signs:** "Bad Request: message is not modified" errors in logs, items flickering between checked/unchecked.

### Pitfall 6: Answering Callback Queries

**What goes wrong:** User sees a persistent loading spinner on the button they tapped.
**Why it happens:** Telegram requires `answerCallbackQuery` to be called for every callback query, even if you don't want to show a notification. Not calling it leaves the loading indicator spinning.
**How to avoid:** Always call `await ctx.answerCallbackQuery()` in every callback handler, even before doing the actual work. This clears the loading indicator immediately.
**Warning signs:** Buttons appear "stuck" with a clock icon, users tap repeatedly.

### Pitfall 7: Stale List After Plan Changes

**What goes wrong:** User generates a grocery list, then changes the meal plan. The grocery list still has the old ingredients.
**Why it happens:** The grocery list is a snapshot of the plan at generation time, not a live view.
**How to avoid:** This is actually correct behavior -- the list IS a snapshot. But the system prompt should instruct Claude to offer to regenerate the list if the plan changes significantly. A simple check: "I see you changed Thursday's dinner. Want me to update your grocery list?"
**Warning signs:** User confusion about why the list doesn't match the plan.

## Code Examples

### grammY InlineKeyboard for Grocery Items

```typescript
// Source: grammy.dev/plugins/keyboard (verified)
import { InlineKeyboard } from "grammy";

function buildGroceryKeyboard(items: GroceryItem[]): InlineKeyboard {
  const keyboard = new InlineKeyboard();

  // Group items by section for organized buttons
  const bySection = groupBySection(items);

  for (const [section, sectionItems] of bySection) {
    // Add unchecked items as buttons (checked items don't need buttons)
    const unchecked = sectionItems.filter(i => !i.checked);
    for (let i = 0; i < unchecked.length; i++) {
      const item = unchecked[i];
      const label = item.quantity
        ? `${item.quantity} ${item.name}`
        : item.name;
      keyboard.text(label, `g:t:${item.id}`);
      // 2 buttons per row for readability on mobile
      if (i % 2 === 1) keyboard.row();
    }
    if (unchecked.length % 2 === 1) keyboard.row(); // End row after odd count
  }

  return keyboard;
}
```

### Callback Query Handler Pattern

```typescript
// Source: grammy.dev/plugins/keyboard (verified)
import { Composer } from "grammy";
import type { BotContext } from "../context.js";

export function createGroceryCallbackHandler(
  sqlite: BetterSqlite3.Database,
): Composer<BotContext> {
  const handler = new Composer<BotContext>();

  // Match all grocery callback queries
  handler.callbackQuery(/^g:t:(\d+)$/, async (ctx) => {
    // Always answer immediately to clear loading indicator
    await ctx.answerCallbackQuery();

    const itemId = parseInt(ctx.match[1], 10);

    // Toggle checked status in database
    toggleGroceryItem(sqlite, itemId);

    // Rebuild the full message from database
    const listId = getListIdForItem(sqlite, itemId);
    const items = getListItems(sqlite, listId);
    const formattedMessage = formatGroceryList(items);
    const keyboard = buildGroceryKeyboard(items);

    // Edit message in place with updated content and buttons
    try {
      await ctx.editMessageText(formattedMessage, {
        parse_mode: "HTML",
        reply_markup: keyboard,
      });
    } catch (error) {
      // Silently ignore "message is not modified" errors from rapid taps
      if (error instanceof GrammyError &&
          error.description.includes("message is not modified")) {
        // Expected with rapid taps -- no action needed
      } else {
        throw error;
      }
    }
  });

  return handler;
}
```

### Grocery List HTML Formatting with Strikethrough

```typescript
// Telegram HTML supports: <s>, <strike>, <del> for strikethrough
// Source: core.telegram.org/bots/api (verified)

function formatGroceryList(
  items: GroceryItem[],
  stores: Map<string, GroceryItem[]>,
): string {
  const lines: string[] = ["<b>Grocery List</b>", ""];

  for (const [storeName, storeItems] of stores) {
    lines.push(`<b>${escapeHtml(storeName)}</b>`);

    // Group by section within store
    const bySection = groupBySection(storeItems);
    for (const [section, sectionItems] of bySection) {
      lines.push(`<i>${escapeHtml(section)}</i>`);
      for (const item of sectionItems) {
        const qty = item.quantity ? `${item.quantity} ` : "";
        const text = `${qty}${item.name}`;
        if (item.checked) {
          lines.push(`  <s>${escapeHtml(text)}</s>`);
        } else {
          lines.push(`  - ${escapeHtml(text)}`);
        }
      }
    }
    lines.push(""); // Blank line between stores
  }

  return lines.join("\n");
}
```

### Grocery List Tool Definition Pattern

```typescript
// Following the pattern of PLAN_TOOLS in src/ai/tools.ts
export const GROCERY_TOOLS: Anthropic.Tool[] = [
  {
    name: "save_grocery_list",
    description:
      "Save a generated grocery list. Provide all items with their store assignment, " +
      "section, and quantity. This creates the full list from scratch -- always send ALL items. " +
      "Each item needs: name, quantity (freeform text like '2 lbs' or '3'), store name, " +
      "and section (Produce, Dairy, Meat, Pantry, Bakery, Frozen, Beverages, etc.).",
    input_schema: {
      type: "object" as const,
      properties: {
        items: {
          type: "array",
          items: {
            type: "object",
            properties: {
              name: { type: "string", description: "Item name" },
              quantity: { type: "string", description: "Amount needed (e.g., '2 lbs', '3', '1 bunch')" },
              store: { type: "string", description: "Store name (user-defined)" },
              section: { type: "string", description: "Store section (Produce, Dairy, Meat, Pantry, etc.)" },
            },
            required: ["name", "store", "section"],
          },
          description: "Array of grocery items",
        },
      },
      required: ["items"],
    },
  },
  {
    name: "update_grocery_list",
    description:
      "Update the active grocery list. Use for removing items (pantry check), " +
      "adding items (extras like snacks), or checking off items conversationally. " +
      "Provide the action and items to modify.",
    input_schema: {
      type: "object" as const,
      properties: {
        add_items: {
          type: "array",
          items: {
            type: "object",
            properties: {
              name: { type: "string" },
              quantity: { type: "string" },
              store: { type: "string" },
              section: { type: "string" },
            },
            required: ["name", "store", "section"],
          },
          description: "Items to add to the list",
        },
        remove_item_ids: {
          type: "array",
          items: { type: "number" },
          description: "Item IDs to remove from the list",
        },
        check_item_ids: {
          type: "array",
          items: { type: "number" },
          description: "Item IDs to mark as checked",
        },
        uncheck_item_ids: {
          type: "array",
          items: { type: "number" },
          description: "Item IDs to mark as unchecked",
        },
      },
      required: [],
    },
  },
  {
    name: "get_grocery_list",
    description:
      "Get the active grocery list. Returns all items with their store, " +
      "section, quantity, and checked status.",
    input_schema: {
      type: "object" as const,
      properties: {},
      required: [],
    },
  },
];
```

### Editing the List Message from a Tool Call

```typescript
// When Claude checks off items via conversation (not button tap),
// the tool handler needs to trigger a message edit.
// The tool handler is synchronous, so it returns the result and the
// processor handles the message edit after the tool loop completes.

// In the tool handler:
case "update_grocery_list": {
  // ... process add/remove/check/uncheck in database
  const list = getActiveList(sqlite, chatId);
  const items = getListItems(sqlite, list.id);

  return JSON.stringify({
    message: "List updated",
    listId: list.id,
    messageId: list.messageId,  // Include for the processor to edit
    items: items.map(i => ({
      id: i.id,
      name: i.name,
      quantity: i.quantity,
      store: i.store,
      section: i.section,
      checked: i.checked,
    })),
  });
}
```

**Note on message editing from tools:** The existing tool handler is synchronous and returns a string. It cannot call Telegram APIs directly. The message edit after a conversational check-off needs to happen in the processor layer. Two approaches:

1. **Side-effect in tool handler:** The tool handler could accept a reference to the bot API and fire the edit as a side effect. This breaks the current synchronous pattern.
2. **Post-tool-loop edit:** After the tool loop completes and Claude responds, the processor detects that a grocery list was modified (by inspecting tool results or a flag) and triggers the edit. This is cleaner but requires the processor to know about grocery list edits.

**Recommendation:** Use approach 2. The processor already does post-loop work (saving messages, logging tokens). Adding a grocery list edit step fits naturally. The tool handler returns the `messageId` and updated items in its JSON response; the processor checks for this and fires the edit.

### Table Initialization Pattern

```typescript
// src/grocery/init.ts
// Same pattern as initializePlanning() in planning/history.ts
export function initializeGrocery(sqlite: BetterSqlite3.Database): void {
  sqlite.exec(`
    CREATE TABLE IF NOT EXISTS grocery_lists (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      chat_id TEXT NOT NULL,
      plan_id INTEGER,
      message_id INTEGER,
      status TEXT NOT NULL DEFAULT 'active',
      created_at INTEGER NOT NULL DEFAULT (unixepoch()),
      updated_at INTEGER NOT NULL DEFAULT (unixepoch())
    )
  `);

  sqlite.exec(`
    CREATE TABLE IF NOT EXISTS grocery_list_items (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      list_id INTEGER NOT NULL REFERENCES grocery_lists(id) ON DELETE CASCADE,
      name TEXT NOT NULL,
      quantity TEXT,
      store TEXT NOT NULL,
      section TEXT NOT NULL,
      checked INTEGER NOT NULL DEFAULT 0,
      created_at INTEGER NOT NULL DEFAULT (unixepoch())
    )
  `);
}
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Text-only bot responses | Inline keyboard buttons for interactive check-off | Phase 7 (new) | First use of InlineKeyboard in this codebase |
| All responses via ctx.reply() | ctx.editMessageText() for in-place updates | Phase 7 (new) | Single message source of truth pattern |
| Synchronous tool results only | Tool results that trigger post-loop side effects | Phase 7 (new) | Processor needs awareness of grocery edit triggers |
| Static system prompt sections | Dynamic grocery context injection | Phase 7 extension | Active grocery list summary in system prompt |

**Telegram formatting notes:**
- Strikethrough is supported in HTML mode via `<s>`, `<strike>`, or `<del>` tags
- The codebase already supports `<s>`, `<strike>`, and `<del>` in the formatter's ALLOWED_TAGS set (see `src/telegram/formatter.ts`)
- `editMessageText` supports `parse_mode: "HTML"` and `reply_markup` in the same call
- Both text and buttons can be updated in a single editMessageText call

## Open Questions

### 1. Tool Use Iterations for List Generation

**What we know:** Generating a grocery list requires Claude to: get_meal_plan (1) + search_knowledge for recipes (1-2) + get_knowledge_item for each recipe (5-7) + save_grocery_list (1) = potentially 8-10 tool calls. The current max is 5 iterations (already increased from 3 for recipe flows).

**What's unclear:** Whether Claude can batch multiple recipe lookups per iteration, or if it calls one tool per iteration. If batched, 5 iterations may suffice. If sequential, the limit needs to increase.

**Recommendation:** Increase max iterations to 10 for grocery generation. Or better: create a server-side helper that the `save_grocery_list` tool uses internally -- when called, it looks up the plan and all recipes, then passes the full ingredient data to Claude in the tool result. This keeps the tool call count low (2-3 iterations: generate list tool + save list tool). The second approach is preferable for token efficiency.

**Alternative recommendation:** Create a `generate_grocery_list` tool that accepts the plan week and internally does all the recipe lookups. The tool handler fetches the plan, fetches all linked recipes, and returns all ingredients in a single tool result. Claude then aggregates and calls `save_grocery_list`. This reduces the loop to 2-3 iterations.

### 2. Message Edit from Conversational Check-Off

**What we know:** When a user says "got the chicken and onions", Claude calls `update_grocery_list` to check items. The list message needs to be edited in place. But the tool handler is synchronous and cannot call Telegram APIs.

**What's unclear:** The cleanest way to trigger the message edit from the synchronous tool handler.

**Recommendation:** The processor should detect grocery list modifications after the tool loop completes. The tool handler returns the grocery list messageId and updated items in its JSON response. After the final Claude response is sent, the processor checks if any tool results contained a grocery list update, and if so, edits the grocery list message. This keeps the tool handler synchronous and puts the Telegram API call in the async processor layer where it belongs.

### 3. Button Count for Large Lists

**What we know:** A typical grocery list might have 30-60 items. Telegram allows max 100 buttons, 8 per row.

**What's unclear:** Whether per-item buttons will overwhelm the mobile UI, or whether section-level buttons are more usable.

**Recommendation:** Start with per-item buttons for unchecked items only (checked items are shown as strikethrough text, no button needed). This effectively means the button count decreases as items are checked off. If the list exceeds 100 unchecked items (unlikely for a weekly meal plan), fall back to conversational-only check-off. The planner should make this decision, but the code should handle both modes gracefully.

### 4. Grocery List Context in System Prompt

**What we know:** Active plan data and cooking history are injected into the system prompt. The active grocery list could also be injected so Claude knows what's on the list without a tool call.

**What's unclear:** Whether to inject the full list (could be 30-60 items = 200-400 tokens) or just a summary ("You have an active grocery list with 42 items, 12 checked").

**Recommendation:** Inject a summary ("Active grocery list: 42 items across 2 stores, 12 checked off") rather than the full list. Claude can call `get_grocery_list` when it needs the full details. The summary enables Claude to reference the list naturally ("looks like you still have items to get") without bloating the system prompt.

## Sources

### Primary (HIGH confidence)
- **Codebase analysis** -- Complete read of all source files: schema, tools, tool-handler, system-prompt, preferences, fts, repository, pipeline processor, bot handlers, main.ts, telegram formatter/sender/splitter, planning (schema, repository, context, date-utils, history), db index
- **CONTEXT.md** -- User decisions from discussion phase
- **grammy.dev/plugins/keyboard** -- Official grammY InlineKeyboard documentation (WebFetch verified)
- **grammy.dev/ref/core/context** -- Official grammY context methods: editMessageText, answerCallbackQuery, callbackQuery (WebFetch verified)
- **core.telegram.org/bots/api** -- Telegram Bot API specifications for callback_data limits, HTML formatting, editMessageText (WebSearch verified)

### Secondary (MEDIUM confidence)
- **grammyjs/grammY#557** -- parse_mode with editMessageText confirmed working: `ctx.editMessageText(text, { parse_mode: "HTML" })` (GitHub issue verified)
- **Telegram limits** -- callback_data: 64 bytes, buttons per row: 8, total buttons: 100 (multiple community sources agree)

### Tertiary (LOW confidence)
- None -- all findings verified with official sources.

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH -- no new dependencies, extending existing patterns
- Architecture (dedicated tables): HIGH -- same reasoning and pattern as Phase 6 meal plans
- Architecture (inline buttons): HIGH -- verified with official grammY and Telegram docs
- Architecture (store preferences): HIGH -- user explicitly decided to use existing preference system
- Architecture (message editing): HIGH -- verified API methods and parse_mode behavior
- Pitfalls: HIGH -- based on direct codebase analysis, Telegram API constraints, and grammY documentation
- Tool iteration count: MEDIUM -- depends on Claude's batching behavior with tool calls
- Post-tool-loop message editing: MEDIUM -- novel pattern for this codebase, needs careful implementation

**Research date:** 2026-02-08
**Valid until:** No expiration for codebase patterns. Telegram API limits (64-byte callback_data, 100 buttons) are stable. grammY API is stable at ^1.39.3.
