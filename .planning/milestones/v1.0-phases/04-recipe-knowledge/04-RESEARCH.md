# Phase 4: Recipe Knowledge - Research

**Researched:** 2026-02-06
**Domain:** Recipe data modeling within existing knowledge system, Anthropic tool use for write operations, Telegram HTML recipe formatting, auto-tagging, changelog tracking
**Confidence:** HIGH

## Summary

Phase 4 builds recipe knowledge management on top of the existing Phase 3 knowledge infrastructure. The core insight is that recipes are knowledge items -- they use the same `knowledge_items` table, the same FTS5 search, and the same two-pass retrieval. The work is primarily about (1) adding write tools so Claude can save/update/delete knowledge items, (2) defining a structured recipe content format within the free-text `content` field, (3) enriching the system prompt with recipe-specific instructions, and (4) adding a changelog table for audit history.

No new external libraries are required. The existing stack (better-sqlite3, Drizzle, Anthropic SDK, grammY, pino) handles everything. The main new code is: new tool definitions for write operations, tool handler dispatch for those tools, a recipe content format convention (structured text, not a new schema), system prompt enhancements for recipe capture/display behavior, a changelog table, and a tag taxonomy.

**Primary recommendation:** Extend the existing knowledge system with write tools (save_knowledge, update_knowledge, delete_knowledge) rather than building recipe-specific CRUD. Recipes are knowledge items with specific tags (e.g., `recipe`, `cuisine:italian`, `protein:chicken`) and a structured content format that Claude generates. All recipe intelligence lives in the system prompt -- Claude decides when to save, what to extract, how to format, and when to confirm.

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

#### Capture flow
- Bot detects when a recipe is being shared/created and offers to save it (proactive detection + user confirmation)
- Primary flow: user asks bot to generate a recipe -> bot proposes -> user tweaks -> bot saves
- Bot keeps prompting for missing details until the recipe is complete
- Everything before the first save is one "creation session" -- bot accumulates all tweaks into a single final version
- Before saving, bot shows the full recipe summary (name, ingredients, steps, times, notes) for user approval

#### Recipe structure
- Full detail: name, ingredients with quantities, numbered steps, prep/cook time, servings, notes
- Bot auto-tags recipes with metadata: cuisine type, meal type (dinner/lunch), protein, difficulty -- user doesn't have to think about it
- Rich contextual notes preserved: tips, pairings, who likes it, when it works well ("good for weeknights", "kids love this", "pair with crusty bread")
- Changelog stored in DB for data mining potential, but NOT fed into agent context -- agent always works with current version

#### Retrieval & display
- Full formatted recipe displayed inline using HTML in Telegram when user asks for a specific recipe
- Multiple matches shown as a list with brief info (name, time, difficulty) -- user picks one for full details
- Cross-recipe reasoning supported: "what's the quickest dinner?", "which recipes use chicken?" -- bot queries across all recipes
- Contextual notes displayed inline with the recipe (tips, pairings, etc.)

#### Updates & corrections
- Conversational partial updates: user says what changed, bot updates just that part without re-confirming the whole recipe
- Ambiguity resolved by asking: if "change the chicken recipe" matches multiple, bot lists them and asks which one
- Deletion supported with confirmation: "Delete the stromboli recipe" -> "Are you sure?" -> deleted

### Claude's Discretion
- Exact recipe display formatting layout within Telegram HTML constraints
- How to structure recipe data in the knowledge system (schema design)
- Tag taxonomy and auto-tagging logic
- How to handle recipe generation prompting (Claude's culinary knowledge)
- Changelog schema and what constitutes a "change" worth logging

### Deferred Ideas (OUT OF SCOPE)
- Photo/image recipe import (snap a pic of a recipe) -- future phase
- Web page recipe import (provide a URL) -- future phase
- Telegram Mini Apps for recipe display -- future phase
- Recipe versioning exposed to users (viewing history) -- no current use case, but changelog data is stored
</user_constraints>

## Standard Stack

No new dependencies required. The existing stack covers everything.

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| better-sqlite3 | 12.6.2 | SQLite for changelog table, FTS5 queries | Already installed; changelog is a simple append-only table |
| drizzle-orm | 0.45.1 | ORM for CRUD on knowledge_items and new changelog table | Already installed; schema-driven table creation |
| @anthropic-ai/sdk | 0.73.0 | Tool definitions for write operations | Already installed; same tool use pattern as Phase 3 |
| grammy | 1.39.3 | Telegram message delivery with HTML formatting | Already installed; recipe display uses existing sender |
| pino | 10.3.0 | Logging recipe operations | Already installed |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| vitest | 4.0.18 | Testing recipe content formatting, tag extraction | Already installed as devDependency |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Structured text in `content` field | Separate recipe columns (ingredients, steps, etc.) | Separate columns would require schema migration and lose the "rich context" philosophy; structured text in content keeps recipes as knowledge items that Claude reasons over naturally |
| Generic `save_knowledge` tool | Recipe-specific `save_recipe` tool | Recipe-specific tools constrain Claude unnecessarily; generic knowledge tools let Claude handle any knowledge type uniformly, and recipe behavior is guided by the system prompt |
| Tag-based filtering via SQL | FTS5 search for everything | Tags enable efficient exact-match filtering (e.g., all recipes tagged `protein:chicken`); FTS5 is better for free-text queries; use both |

**Installation:**
No new packages needed.

## Architecture Patterns

### Recommended Project Structure
```
src/
  knowledge/
    schema.ts           # MODIFIED: add knowledgeChangelog table
    repository.ts       # MODIFIED: add changelog write on create/update/delete
    fts.ts              # NO CHANGE
    retrieval.ts        # NO CHANGE
    token-budget.ts     # NO CHANGE
    types.ts            # MODIFIED: add ChangelogEntry type
  ai/
    tools.ts            # MODIFIED: add save_knowledge, update_knowledge, delete_knowledge tools
    tool-handler.ts     # MODIFIED: dispatch new write tools to repository
    system-prompt.ts    # MODIFIED: add recipe-specific instructions (capture, format, display, tags)
    types.ts            # NO CHANGE
  pipeline/
    processor.ts        # MODIFIED: increase max tool use iterations from 3 to 5 (recipe creation needs more round-trips)
  bot/
    handlers/           # NO CHANGE (all recipe interaction is conversational via Claude)
  telegram/
    formatter.ts        # NO CHANGE (existing escapeHtml + formatBotResponse sufficient)
```

### Pattern 1: Write Tools for Knowledge Management
**What:** Three new Anthropic tool definitions that let Claude create, update, and delete knowledge items. Claude structures the recipe data and calls these tools based on conversation flow.
**When to use:** Whenever Claude determines a recipe should be saved, updated, or deleted based on user interaction.
**Confidence:** HIGH -- follows exact same pattern as existing read tools

```typescript
// New tool definitions (extend existing KNOWLEDGE_TOOLS array)
const WRITE_TOOLS: Anthropic.Tool[] = [
  {
    name: "save_knowledge",
    description:
      "Save a new item to the user's knowledge base (recipe, preference, cooking note). " +
      "Use this after the user confirms they want to save. Include a descriptive title, " +
      "a brief summary (1-2 sentences for search results), the full content, and relevant tags. " +
      "For recipes, tags should include: 'recipe', cuisine type (e.g., 'cuisine:italian'), " +
      "meal type (e.g., 'meal:dinner'), protein (e.g., 'protein:chicken'), and difficulty " +
      "(e.g., 'difficulty:easy'). Returns the saved item's ID.",
    input_schema: {
      type: "object" as const,
      properties: {
        title: {
          type: "string",
          description: "Descriptive title (e.g., 'Mom's Chicken Stromboli')",
        },
        summary: {
          type: "string",
          description: "Brief 1-2 sentence summary for search results listing",
        },
        content: {
          type: "string",
          description: "Full content. For recipes: ingredients, steps, times, servings, notes",
        },
        tags: {
          type: "array",
          items: { type: "string" },
          description: "Tags for categorization. Always include type tag (e.g., 'recipe')",
        },
      },
      required: ["title", "summary", "content", "tags"],
    },
  },
  {
    name: "update_knowledge",
    description:
      "Update an existing knowledge item. Provide the item ID and only the fields that changed. " +
      "Use this for recipe corrections, adding notes, updating times, etc. " +
      "Does NOT require re-confirming the whole recipe -- just updates what changed.",
    input_schema: {
      type: "object" as const,
      properties: {
        id: {
          type: "number",
          description: "The ID of the knowledge item to update",
        },
        title: {
          type: "string",
          description: "New title (only if changed)",
        },
        summary: {
          type: "string",
          description: "New summary (only if changed)",
        },
        content: {
          type: "string",
          description: "New full content (only if changed)",
        },
        tags: {
          type: "array",
          items: { type: "string" },
          description: "New tags (replaces all existing tags, only if changed)",
        },
      },
      required: ["id"],
    },
  },
  {
    name: "delete_knowledge",
    description:
      "Delete a knowledge item permanently. Only use after user explicitly confirms deletion. " +
      "Returns success/failure.",
    input_schema: {
      type: "object" as const,
      properties: {
        id: {
          type: "number",
          description: "The ID of the knowledge item to delete",
        },
      },
      required: ["id"],
    },
  },
];
```

### Pattern 2: Recipe Content as Structured Text
**What:** Recipes stored in the `content` field as a structured text format that Claude both generates and parses. Not JSON, not Markdown -- a readable text format that is both human-readable in raw form and parseable by Claude.
**When to use:** Every recipe save and display.
**Confidence:** HIGH -- the "rich context the agent reasons over" requirement directly calls for this approach

```
RECIPE FORMAT (stored in knowledge_items.content):

Ingredients:
- 2 cups all-purpose flour
- 1 lb Italian sausage
- 2 cups shredded mozzarella
- 1/2 cup pizza sauce
- 1 egg (for egg wash)

Steps:
1. Roll out the dough into a large rectangle on a floured surface
2. Layer the sausage, mozzarella, and pizza sauce down the center
3. Fold the sides over, pinch the seam, and tuck the ends under
4. Brush with egg wash and cut 3 slits in the top
5. Bake at 375F for 25-30 minutes until golden brown

Prep Time: 20 minutes
Cook Time: 30 minutes
Total Time: 50 minutes
Servings: 4-6

Notes:
- Good for weeknights -- can prep ahead and refrigerate before baking
- Kids love this one
- Pair with a simple green salad
- Use hot Italian sausage for more kick
```

This format is deliberately simple text, not JSON or structured markup, because:
1. Claude generates it naturally (it reads like a recipe card)
2. FTS5 indexes it properly (all terms are searchable)
3. Claude can read it back and reason over it ("which recipes take less than 30 minutes?")
4. It's human-readable if someone views the DB directly

### Pattern 3: Tag Taxonomy for Auto-Tagging
**What:** A consistent tag naming convention that Claude applies automatically. Tags use namespaced prefixes for structured filtering.
**When to use:** Every recipe save.
**Confidence:** HIGH -- follows established tagging patterns, fits existing `knowledge_tags` table

```
TAG TAXONOMY:

Type tags (always present):
  recipe              -- marks this as a recipe

Cuisine tags:
  cuisine:italian
  cuisine:mexican
  cuisine:american
  cuisine:asian
  cuisine:indian
  cuisine:mediterranean
  (open-ended -- Claude adds as needed)

Meal type tags:
  meal:dinner
  meal:lunch
  meal:breakfast
  meal:snack
  meal:dessert
  meal:side

Protein tags:
  protein:chicken
  protein:beef
  protein:pork
  protein:fish
  protein:shrimp
  protein:tofu
  protein:vegetarian
  (open-ended)

Difficulty tags:
  difficulty:easy
  difficulty:medium
  difficulty:hard

Optional contextual tags:
  quick              -- under 30 min total
  make-ahead         -- can be prepped in advance
  one-pot            -- minimal dishes
  kid-friendly       -- kids like it
  entertaining       -- good for guests
```

The existing `knowledge_tags` table handles this perfectly -- no schema change needed for tags. Tags are just strings. The namespace prefix (e.g., `cuisine:`) enables filtered queries:

```sql
-- Find all Italian dinner recipes
SELECT ki.* FROM knowledge_items ki
JOIN knowledge_tags kt ON kt.knowledge_item_id = ki.id
WHERE ki.chat_id = ?
AND kt.tag = 'cuisine:italian'
AND ki.id IN (
  SELECT knowledge_item_id FROM knowledge_tags WHERE tag = 'meal:dinner'
)
```

However, the primary retrieval path remains FTS5 search -- Claude will use `search_knowledge` with queries like "italian dinner recipes". Tag-based filtering is supplementary, used by Claude when it needs exact filtering that FTS5 alone might not satisfy.

### Pattern 4: Changelog for Audit History
**What:** An append-only table that records every create/update/delete operation on knowledge items. Stored for data mining potential but NOT loaded into Claude's context.
**When to use:** Automatically on every knowledge write operation in the repository layer.
**Confidence:** HIGH -- simple append-only table, standard audit pattern

```typescript
// New Drizzle schema for changelog
export const knowledgeChangelog = sqliteTable("knowledge_changelog", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  knowledgeItemId: integer("knowledge_item_id").notNull(),
  chatId: text("chat_id").notNull(),
  action: text("action", { enum: ["create", "update", "delete"] }).notNull(),
  changeDescription: text("change_description"),  // Claude-generated summary of what changed
  previousContent: text("previous_content"),       // snapshot before change (for update/delete)
  createdAt: integer("created_at", { mode: "timestamp" })
    .notNull()
    .$defaultFn(() => new Date()),
});
```

Key design decisions:
- `knowledgeItemId` does NOT have a foreign key constraint (we keep logs even after item deletion)
- `previousContent` stores the full content before the change (for update and delete, null for create)
- `changeDescription` is a brief Claude-generated note like "Updated cook time from 45 to 70 minutes"
- No cascade delete -- changelog persists independently of the knowledge item

### Pattern 5: Recipe Display Formatting for Telegram HTML
**What:** Claude formats recipe display using Telegram-supported HTML tags. The system prompt instructs Claude on the exact format.
**When to use:** Every time a user asks for a recipe.
**Confidence:** HIGH -- uses tags already verified in the codebase's formatter.ts

Telegram supports: `<b>`, `<strong>`, `<i>`, `<em>`, `<u>`, `<ins>`, `<s>`, `<strike>`, `<del>`, `<a>`, `<code>`, `<pre>`, `<blockquote>`, `<blockquote expandable>`.

Telegram does NOT support: `<br>`, `<div>`, `<span>`, `<p>`, `<h1>`, `<h2>`, `<ul>`, `<ol>`, `<li>`, `<table>`. Line breaks use `\n`.

Recommended recipe display format:

```
<b>Mom's Chicken Stromboli</b>
<i>Italian | Dinner | 50 min | Easy</i>

<b>Ingredients</b>
- 2 cups all-purpose flour
- 1 lb Italian sausage
- 2 cups shredded mozzarella
- 1/2 cup pizza sauce
- 1 egg (for egg wash)

<b>Steps</b>
1. Roll out the dough into a large rectangle on a floured surface
2. Layer the sausage, mozzarella, and pizza sauce down the center
3. Fold the sides over, pinch the seam, and tuck the ends under
4. Brush with egg wash and cut 3 slits in the top
5. Bake at 375F for 25-30 minutes until golden brown

<b>Notes</b>
<i>Good for weeknights -- can prep ahead and refrigerate before baking. Kids love this one. Pair with a simple green salad.</i>
```

Note: `<blockquote>` and `<blockquote expandable>` are available in Telegram HTML parse mode. The expandable variant is useful for long recipe notes. However, the existing `formatBotResponse` in `formatter.ts` currently strips blockquote tags since they're not in the `ALLOWED_TAGS` set. The formatter must be updated to include `blockquote` in the allowed tags set.

### Pattern 6: System Prompt Recipe Instructions
**What:** Extensive additions to the system prompt that teach Claude how to handle recipe creation, formatting, tagging, and the confirmation flow.
**When to use:** Always present in the system prompt.
**Confidence:** HIGH -- this is where recipe intelligence lives

The system prompt additions should cover:
1. **Recipe detection**: Recognize when a user is sharing or requesting a recipe
2. **Creation flow**: Accumulate recipe details, prompt for missing information, show confirmation
3. **Structured content**: How to format the content field for knowledge items
4. **Auto-tagging**: The tag taxonomy and how to apply tags automatically
5. **Display formatting**: How to format recipes for Telegram HTML display
6. **Update handling**: How to do partial updates without full re-confirmation
7. **Deletion flow**: Require explicit user confirmation before deleting
8. **Cross-recipe reasoning**: How to search and compare across recipes

### Anti-Patterns to Avoid
- **Recipe-specific database table:** Don't create a `recipes` table with ingredient/step columns. Recipes ARE knowledge items. A separate table would fragment the knowledge system and require separate search infrastructure.
- **Storing HTML in the database:** Store plain text in `content`. Claude generates HTML at display time. This keeps the stored content searchable by FTS5 and prevents formatting lock-in.
- **Client-side recipe parsing:** Don't parse recipe text in TypeScript to extract ingredients/steps. Claude handles all interpretation. The bot code just stores and retrieves text.
- **Over-engineering tag queries:** Don't build a complex tag query system. Claude uses `search_knowledge` for most retrieval. Tag-based filtering is supplementary, not the primary path.
- **Feeding changelog into context:** The user decision is explicit: changelog stored for data mining but NOT fed into agent context. Don't load changelog entries into Claude's context window.

## Don't Hand-Roll

Problems that look simple but have existing solutions:

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Recipe extraction from conversation | Custom NLP/regex parser | Claude via system prompt instructions | Claude already understands recipes naturally; extraction is a prompt engineering problem |
| Recipe display formatting | Custom template engine | Claude generates HTML per system prompt | Template rigidity would fight the conversational nature; Claude adapts formatting to context |
| Ingredient quantity parsing | Custom parser for "2 cups", "1/4 tsp" | Store as plain text, let Claude interpret | Quantity parsing is surprisingly complex (unicode fractions, ranges, "to taste"); Claude handles it natively |
| Recipe duplicate detection | String similarity matching | Claude's contextual awareness via search | When saving, Claude can search for existing recipes with similar names and ask the user |
| Tag assignment | Rule-based classifier | Claude auto-tags per system prompt taxonomy | Claude understands cuisine, protein, difficulty from recipe content naturally |

**Key insight:** Almost everything in this phase is a system prompt problem, not a code problem. The infrastructure (knowledge storage, search, tools, display) already exists. Phase 4 adds write tools and teaches Claude how to be a recipe manager.

## Common Pitfalls

### Pitfall 1: Tool Use Iteration Limit Too Low for Recipe Creation
**What goes wrong:** Recipe creation requires multiple tool calls in sequence: search for duplicates, save the recipe, confirm back to user. The current max 3 iterations may not be enough if Claude also needs to search for context before generating a recipe.
**Why it happens:** Recipe creation is a multi-step flow: (1) search existing recipes, (2) generate recipe, (3) show confirmation, (4) save on approval, (5) confirm save. Some of these happen across multiple messages, but a single turn could involve 3+ tool calls.
**How to avoid:** Increase `maxIterations` from 3 to 5 for the tool use loop. This gives enough headroom for search + save in a single turn. The safety valve (final call without tools) still prevents infinite loops.
**Warning signs:** Claude's responses feel cut off or it fails to complete the save after confirming.

### Pitfall 2: Content Field Grows Too Large for Token Budget
**What goes wrong:** A recipe with many ingredients, detailed steps, and extensive notes could exceed the token budget when retrieved via `get_knowledge_item`, leaving little room for other context.
**Why it happens:** Recipes are inherently detailed. A complex recipe with 20 ingredients, 15 steps, and notes could be 500-1000 tokens.
**How to avoid:** The existing two-pass retrieval already handles this well -- summaries are cheap, and full content is only loaded when needed. Keep recipe summaries concise (1-2 sentences). The system prompt should instruct Claude to write efficient but complete content. For cross-recipe reasoning queries ("what's quickest?"), Claude should use search results (summaries) rather than loading every recipe's full content.
**Warning signs:** Token budget consistently hitting the hard limit (6K) on recipe-related queries.

### Pitfall 3: Confirmation Flow Across Multiple Messages
**What goes wrong:** The recipe confirmation flow (show summary -> user says "yes" -> save) spans multiple messages. If the user sends additional messages between confirmation and approval, the context could be confusing.
**Why it happens:** Telegram is asynchronous. The user might send multiple messages, or the debounce queue might batch messages unexpectedly during the confirmation flow.
**How to avoid:** The system prompt should instruct Claude to treat recipe creation as a conversational flow, not a transactional one. If the user says "yes, save it" after some other messages, Claude should still understand the context from conversation history. There is no need for explicit state machine tracking -- Claude's conversation context handles this.
**Warning signs:** Recipes not being saved despite user confirmation, or wrong recipe being saved.

### Pitfall 4: HTML Formatting Errors in Recipe Display
**What goes wrong:** Claude generates HTML with unsupported tags (e.g., `<ul>`, `<li>`, `<h2>`) that Telegram rejects, causing the fallback to plain text.
**Why it happens:** Claude's training data includes general HTML. Without explicit constraints, it may use tags Telegram does not support.
**How to avoid:** The system prompt must explicitly list which HTML tags are allowed. The existing `formatBotResponse()` already strips unsupported tags, providing a safety net. But it's better to prevent than to strip -- cleaner output.
**Warning signs:** Recipe messages rendering as plain text (HTML fallback triggered in logs).

### Pitfall 5: Partial Update Loses Recipe Content
**What goes wrong:** When updating a recipe, Claude sends the full `content` field with only the changed part, accidentally overwriting the rest.
**Why it happens:** The `update_knowledge` tool replaces the entire content field. If Claude only puts the changed portion in content, the rest is lost.
**How to avoid:** The system prompt must instruct Claude that `content` in update_knowledge replaces the FULL content. For partial updates, Claude must first retrieve the current content (via `get_knowledge_item`), modify the specific part, and send back the complete updated content. The tool description should reinforce this.
**Warning signs:** Recipes losing content after updates.

### Pitfall 6: FTS5 Index Not Updated After Write Operations
**What goes wrong:** New or updated recipes don't appear in search results.
**Why it happens:** The FTS5 sync triggers were set up in Phase 3 to fire on INSERT/UPDATE/DELETE on the knowledge_items table. As long as write operations go through the repository layer (which uses Drizzle ORM on the main table), triggers fire correctly. But if someone bypasses the repository, the index gets stale.
**How to avoid:** All write operations MUST go through `knowledgeRepository.create()`, `.update()`, `.delete()`. The tool handler calls the repository, not raw SQL. This is already the pattern.
**Warning signs:** Newly saved recipes not appearing in search.

### Pitfall 7: Blockquote Tag Stripping
**What goes wrong:** Recipe notes formatted with `<blockquote>` get stripped by the existing `formatBotResponse()` function, losing the formatting.
**Why it happens:** The `ALLOWED_TAGS` set in `formatter.ts` does not include `blockquote`.
**How to avoid:** Add `"blockquote"` to the `ALLOWED_TAGS` set. Telegram supports `<blockquote>` and `<blockquote expandable>` in HTML parse mode.
**Warning signs:** Blockquote formatting disappearing in recipe display.

## Code Examples

### Write Tool Handler Dispatch
```typescript
// Extension of existing tool-handler.ts
case "save_knowledge": {
  const { title, summary, content, tags } = input as {
    title: string;
    summary: string;
    content: string;
    tags: string[];
  };
  const item = knowledgeRepository.create(chatId, {
    title,
    summary,
    content,
    tags,
  });

  // Log changelog entry
  db.insert(knowledgeChangelog).values({
    knowledgeItemId: item.id,
    chatId,
    action: "create",
    changeDescription: `Created: ${title}`,
  }).run();

  return JSON.stringify({
    message: `Saved "${title}" (ID: ${item.id})`,
    id: item.id,
  });
}

case "update_knowledge": {
  const { id, ...changes } = input as {
    id: number;
    title?: string;
    summary?: string;
    content?: string;
    tags?: string[];
  };

  // Get previous content for changelog
  const previous = knowledgeRepository.getById(id, chatId);
  if (!previous) {
    return JSON.stringify({ error: `No item found with ID ${id}` });
  }

  const updated = knowledgeRepository.update(id, chatId, changes);
  if (!updated) {
    return JSON.stringify({ error: `Failed to update item ${id}` });
  }

  // Log changelog
  db.insert(knowledgeChangelog).values({
    knowledgeItemId: id,
    chatId,
    action: "update",
    changeDescription: input.changeDescription as string | undefined,
    previousContent: previous.content,
  }).run();

  return JSON.stringify({
    message: `Updated "${updated.title}" (ID: ${id})`,
    id: updated.id,
  });
}

case "delete_knowledge": {
  const id = input.id as number;

  // Get item for changelog before deletion
  const previous = knowledgeRepository.getById(id, chatId);
  if (!previous) {
    return JSON.stringify({ error: `No item found with ID ${id}` });
  }

  const deleted = knowledgeRepository.delete(id, chatId);
  if (!deleted) {
    return JSON.stringify({ error: `Failed to delete item ${id}` });
  }

  // Log changelog
  db.insert(knowledgeChangelog).values({
    knowledgeItemId: id,
    chatId,
    action: "delete",
    changeDescription: `Deleted: ${previous.title}`,
    previousContent: previous.content,
  }).run();

  return JSON.stringify({
    message: `Deleted "${previous.title}"`,
    deleted: true,
  });
}
```

### Changelog Schema
```typescript
// knowledge/schema.ts addition
export const knowledgeChangelog = sqliteTable("knowledge_changelog", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  knowledgeItemId: integer("knowledge_item_id").notNull(),
  // No foreign key -- keep logs even after item deletion
  chatId: text("chat_id").notNull(),
  action: text("action", { enum: ["create", "update", "delete"] }).notNull(),
  changeDescription: text("change_description"),
  previousContent: text("previous_content"),
  createdAt: integer("created_at", { mode: "timestamp" })
    .notNull()
    .$defaultFn(() => new Date()),
});
```

### System Prompt Recipe Section (key excerpt)
```typescript
// Addition to buildSystemPrompt()
`
<recipe_management>
You can save, update, and delete recipes and other knowledge items using your tools.

RECIPE CREATION FLOW:
1. When a user shares or requests a recipe, accumulate all details
2. Prompt for missing info: ingredients with quantities, numbered steps, prep/cook time, servings
3. Before saving, show the full recipe summary for user approval
4. Only save after user confirms (e.g., "looks good", "save it", "yes")
5. Auto-tag with: recipe, cuisine type, meal type, protein, difficulty

RECIPE CONTENT FORMAT (for the content field):
Ingredients:
- [quantity] [ingredient]

Steps:
1. [step]
2. [step]

Prep Time: [time]
Cook Time: [time]
Total Time: [time]
Servings: [number]

Notes:
- [tips, pairings, contextual notes]

RECIPE DISPLAY FORMAT (for Telegram):
Use <b> for title and section headers, <i> for metadata line and notes.
Use plain dashes (-) for ingredient lists, numbers for steps.
Never use <ul>, <ol>, <li>, <h1>, <h2>, <div>, <span>, <p>, <br>.
Use newlines (actual line breaks) for spacing.

TAG TAXONOMY:
Always include: recipe
Cuisine: cuisine:italian, cuisine:mexican, cuisine:asian, etc.
Meal: meal:dinner, meal:lunch, meal:breakfast, meal:snack
Protein: protein:chicken, protein:beef, protein:pork, protein:fish, protein:vegetarian
Difficulty: difficulty:easy, difficulty:medium, difficulty:hard
Optional: quick, make-ahead, one-pot, kid-friendly, entertaining

UPDATES:
- For partial updates, first retrieve the current recipe with get_knowledge_item
- Modify only the changed parts in the full content
- Send back the complete updated content (update_knowledge replaces the entire content field)
- Do NOT re-confirm the whole recipe for minor changes

DELETION:
- Always confirm before deleting: "Are you sure you want to delete [recipe name]?"
- Only call delete_knowledge after explicit user confirmation

SEARCH & REASONING:
- Use search_knowledge to find recipes by name, ingredients, cuisine, etc.
- For comparison questions ("what's quickest?"), search and compare summaries
- For specific recipe details, use get_knowledge_item after finding the right ID
</recipe_management>
`
```

### Tool Handler Integration Pattern
```typescript
// tool-handler.ts needs knowledgeRepository and db as additional dependencies
export function createToolHandler(deps: {
  retrievalService: ReturnType<typeof createRetrievalService>;
  knowledgeRepository: ReturnType<typeof createKnowledgeRepository>;
  db: DrizzleDatabase;
  chatId: string;
}) {
  // ... dispatch both read and write tools
}
```

### Tag-Based Search Enhancement (optional, for cross-recipe queries)
```typescript
// Raw SQL query for tag filtering -- used when FTS5 alone is insufficient
// Example: "all chicken dinner recipes"
function searchByTags(
  sqlite: BetterSqlite3.Database,
  chatId: string,
  tags: string[],
  limit: number = 10
): Array<{ id: number; title: string; summary: string }> {
  const placeholders = tags.map(() => "?").join(", ");
  return sqlite.prepare(`
    SELECT ki.id, ki.title, ki.summary
    FROM knowledge_items ki
    WHERE ki.chat_id = ?
    AND ki.id IN (
      SELECT knowledge_item_id FROM knowledge_tags
      WHERE tag IN (${placeholders})
      GROUP BY knowledge_item_id
      HAVING COUNT(DISTINCT tag) = ?
    )
    ORDER BY ki.last_accessed_at DESC
    LIMIT ?
  `).all(chatId, ...tags, tags.length, limit) as Array<{
    id: number;
    title: string;
    summary: string;
  }>;
}
```

Note: This tag search function is optional. FTS5 search handles most cases. Claude can determine from search summaries and tags whether a recipe matches the user's query. Only add tag-based search if FTS5 proves insufficient for filtering queries like "all chicken recipes".

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Rigid recipe schema with typed columns | Flexible knowledge items with structured text content | Agent-first architecture decision | Recipes are living documents, not database records; Claude reasons over text naturally |
| User-driven tagging ("tag this recipe") | Auto-tagging by Claude based on content analysis | LLM classification capability | Zero user effort for categorization; tags are comprehensive and consistent |
| Form-based recipe input | Conversational recipe capture | LLM-native interaction pattern | Natural conversation replaces rigid forms; Claude handles ambiguity and incomplete info |
| Template-based recipe display | Claude-generated HTML per context | LLM formatting capability | Display adapts to context (full recipe vs. comparison list vs. quick reference) |

**Deprecated/outdated:**
- Recipe-specific CRUD APIs: In an agent-first architecture, the knowledge CRUD serves all knowledge types. Recipe-specific endpoints are unnecessary complexity.
- Structured recipe JSON storage: Fighting against the "rich context" philosophy. Claude works better with readable text than parsed JSON.

## Open Questions

1. **Max Tool Iterations for Recipe Flows**
   - What we know: Current max is 3 iterations. Recipe creation involves search + save (2 tool calls minimum). Complex flows (search, compare, generate, confirm, save) could need 4-5.
   - What's unclear: Exact number needed for worst-case recipe creation flow
   - Recommendation: Increase to 5 iterations. Monitor actual usage via logs. Can tune later.

2. **Changelog `changeDescription` Population**
   - What we know: Changelog should store a brief description of what changed. Claude can generate this.
   - What's unclear: Whether to add a `changeDescription` parameter to the `update_knowledge` tool or have the repository generate it by diffing old and new content.
   - Recommendation: Add an optional `change_description` parameter to the `update_knowledge` tool input. Claude can provide a natural language description of the change (e.g., "Updated cook time to 70 minutes"). If not provided, default to a generic "Updated [field names]" based on which fields changed.

3. **Token Budget Impact of Write Tools**
   - What we know: Adding 3 tool definitions increases per-request token usage. Each tool definition is roughly 100-200 tokens.
   - What's unclear: Exact token overhead with 5 tools vs. current 2
   - Recommendation: Measure with `messages.countTokens()` after implementation. System prompt + tool definitions are cached with `cache_control: ephemeral`, so cost impact is minimal after first request in a cache window.

4. **Formatter ALLOWED_TAGS Update Scope**
   - What we know: `blockquote` needs to be added. Telegram also supports `tg-spoiler` and `tg-emoji` via entity types.
   - What's unclear: Whether we need `tg-spoiler` or other Telegram-specific entities for recipe display.
   - Recommendation: Add only `blockquote` to ALLOWED_TAGS for now. Other Telegram-specific entity types are not needed for recipe display. Expand later if needed.

## Sources

### Primary (HIGH confidence)
- Anthropic Tool Use Implementation Guide (https://platform.claude.com/docs/en/agents-and-tools/tool-use/implement-tool-use) -- Tool definitions, write operations, tool use loop, parallel tools, error handling
- Existing codebase: `src/knowledge/repository.ts` -- CRUD operations already support create, update, delete
- Existing codebase: `src/ai/tools.ts` -- Tool definition pattern for extending
- Existing codebase: `src/ai/tool-handler.ts` -- Tool dispatch pattern for extending
- Existing codebase: `src/ai/system-prompt.ts` -- System prompt structure for extending
- Existing codebase: `src/telegram/formatter.ts` -- HTML tag allowlist for updating

### Secondary (MEDIUM confidence)
- Telegram Bot API formatting options (https://core.telegram.org/bots/api#formatting-options) -- Supported HTML tags including blockquote
- Phase 3 Research (`03-RESEARCH.md`) -- Architecture patterns that Phase 4 extends

### Tertiary (LOW confidence)
- WebSearch results on Telegram blockquote HTML support -- confirmed via multiple community sources but not directly verified against Telegram docs due to page format limitations

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH -- No new dependencies; extends existing infrastructure
- Architecture (write tools): HIGH -- Same pattern as existing read tools, verified against Anthropic docs
- Architecture (recipe content format): HIGH -- Follows agent-first design principle, fits existing schema
- Architecture (tag taxonomy): HIGH -- Uses existing tags table, simple naming convention
- Architecture (changelog): HIGH -- Standard audit table pattern
- Architecture (display formatting): HIGH -- Telegram HTML tags verified in existing codebase
- Pitfalls: HIGH -- Derived from analysis of existing code paths and known constraints

**Research date:** 2026-02-06
**Valid until:** 2026-03-06 (stable domain; all patterns extend existing verified infrastructure)
