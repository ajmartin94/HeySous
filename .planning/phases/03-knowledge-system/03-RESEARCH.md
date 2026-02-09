# Phase 3: Knowledge System & Retrieval - Research

**Researched:** 2026-02-06
**Domain:** SQLite FTS5 full-text search, Anthropic tool use API, conversation context management, token budget management
**Confidence:** HIGH

## Summary

This phase builds the knowledge storage, retrieval, and conversation context management infrastructure for HeySous. The core approach is: knowledge items stored in SQLite with FTS5 full-text indexing, Claude retrieving them via tool calls (agent-driven queries), and a token budget manager that controls how much context gets injected into each Claude request.

The existing codebase uses better-sqlite3 v12.6.2 with Drizzle ORM v0.45.1 and Anthropic SDK v0.73.0. FTS5 virtual tables are not natively supported by Drizzle ORM, so FTS5 operations require raw SQL via `db.run(sql\`...\`)` or direct access to the underlying better-sqlite3 instance via `db.$client`. The Anthropic SDK v0.73.0 fully supports tool use through `client.messages.create()` with a `tools` parameter, and also offers beta `toolRunner` helpers for automatic agentic loops.

**Primary recommendation:** Use a manual tool-use loop (not the beta toolRunner) for maximum control over the multi-step retrieval process and token budget enforcement. Create the FTS5 virtual table via raw SQL on database initialization. Build a dedicated knowledge service layer that handles all FTS5 operations behind a clean TypeScript interface.

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- Hybrid storage: structured core fields + free-text notes/context per item
- One knowledge item per concept (a recipe is one item, a preference is one item)
- Tag-based categorization, no predefined type enum (items have flexible tags like 'recipe', 'chicken', 'quick')
- Two-pass retrieval: summaries first, expand to full content on demand (token-efficient)
- SQLite FTS5 full-text search (no embeddings, no external dependencies)
- Agent-driven queries: Claude analyzes the conversation and decides what to look up via tool calls
- Multi-step retrieval allowed: agent can search, read results, search again in one turn
- When results exceed budget, recency wins -- most recently accessed/modified items take priority
- Cross-session memory: conversations persist, bot can reference past chats
- Soft target of ~4K tokens for retrieved knowledge, flex up to 6K for highly relevant items
- Budget management is invisible to the user (internal only)
- When budget is tight, knowledge items take priority over conversation history
- Retrieval metrics logged via Pino + exposed through /debug command (items searched, tokens used, items returned)

### Claude's Discretion
- Conversation retention window (how far back to remember)
- Session boundary definition (time gap vs continuous)
- Long conversation compression strategy (summarize vs sliding window)
- FTS5 configuration and query optimization
- Summary format for two-pass retrieval

### Deferred Ideas (OUT OF SCOPE)
None -- discussion stayed within phase scope
</user_constraints>

## Standard Stack

The established libraries/tools for this domain. No new dependencies are required -- the existing stack covers everything.

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| better-sqlite3 | 12.6.2 | SQLite driver with FTS5 support built-in | Already installed; FTS5 is compiled into SQLite by default |
| drizzle-orm | 0.45.1 | ORM for structured tables (knowledge_items, conversations, messages) | Already installed; use for CRUD on regular tables |
| @anthropic-ai/sdk | 0.73.0 | Claude API with tool use support | Already installed; `messages.create()` supports `tools` parameter |
| pino | 10.3.0 | Logging retrieval metrics | Already installed; used throughout codebase |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| drizzle-orm `sql` template | 0.45.1 | Raw SQL for FTS5 queries | All FTS5 MATCH queries, since Drizzle has no native FTS5 support |
| better-sqlite3 `$client` | 12.6.2 | Direct SQLite access for DDL | Creating FTS5 virtual tables, triggers, and `'rebuild'` commands |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Manual tool loop | `beta.messages.toolRunner()` | toolRunner auto-executes tools but gives less control over token budget enforcement between steps; manual loop is more predictable for budget management |
| Character-based token estimate | `messages.countTokens()` API | API is accurate but adds latency + API call per estimation; character-based (4 chars/token) is fast and sufficient for soft budget targets |

**Installation:**
No new packages needed. All dependencies are already in package.json.

## Architecture Patterns

### Recommended Project Structure
```
src/
  knowledge/
    schema.ts           # Drizzle schema: knowledge_items table, tags table
    fts.ts              # FTS5 virtual table setup, raw SQL queries, rebuild
    repository.ts       # CRUD operations on knowledge items via Drizzle
    retrieval.ts        # Two-pass retrieval: search -> summarize -> expand
    token-budget.ts     # Token estimation and budget enforcement
    types.ts            # KnowledgeItem, SearchResult, RetrievalMetrics interfaces
  conversation/
    schema.ts           # Drizzle schema: conversations table (extends existing messages)
    context-builder.ts  # Builds conversation context within token budget
    types.ts            # ConversationTurn, SessionBoundary interfaces
  ai/
    claude-client.ts    # MODIFIED: add tool use support to sendMessage
    system-prompt.ts    # MODIFIED: inject retrieved knowledge context
    tools.ts            # Tool definitions for knowledge retrieval
    tool-handler.ts     # Dispatches tool calls to knowledge service
    types.ts            # MODIFIED: add tool-related types
  pipeline/
    processor.ts        # MODIFIED: orchestrate retrieval loop before final response
  bot/
    handlers/
      debug.ts          # NEW: /debug command handler for retrieval stats
```

### Pattern 1: Manual Tool Use Loop (Agentic Retrieval)
**What:** The processor runs a loop where Claude can make tool calls to search/retrieve knowledge, and the processor executes those tools and feeds results back until Claude produces a final text response.
**When to use:** Every message processing cycle.
**Example:**
```typescript
// Source: Anthropic tool use docs (https://platform.claude.com/docs/en/agents-and-tools/tool-use/implement-tool-use)
import Anthropic from "@anthropic-ai/sdk";

// Define tools for knowledge retrieval
const tools: Anthropic.Tool[] = [
  {
    name: "search_knowledge",
    description: "Search the knowledge base for relevant items. Returns summaries.",
    input_schema: {
      type: "object",
      properties: {
        query: { type: "string", description: "Search query" },
        limit: { type: "number", description: "Max results (default 5)" },
      },
      required: ["query"],
    },
  },
  {
    name: "get_knowledge_item",
    description: "Get full content of a specific knowledge item by ID.",
    input_schema: {
      type: "object",
      properties: {
        id: { type: "number", description: "Knowledge item ID" },
      },
      required: ["id"],
    },
  },
];

// Agentic loop in processor
async function processWithTools(
  client: Anthropic,
  messages: Anthropic.MessageParam[],
  tools: Anthropic.Tool[],
  maxIterations: number = 3,
): Promise<Anthropic.Message> {
  let currentMessages = [...messages];

  for (let i = 0; i < maxIterations; i++) {
    const response = await client.messages.create({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 2048,
      system: [{ type: "text", text: systemPrompt, cache_control: { type: "ephemeral" } }],
      messages: currentMessages,
      tools,
    });

    // If Claude is done (no more tool calls), return
    if (response.stop_reason === "end_turn") {
      return response;
    }

    // Extract tool_use blocks and execute them
    const toolUseBlocks = response.content.filter(
      (block): block is Anthropic.ToolUseBlock => block.type === "tool_use"
    );

    // Execute each tool and collect results
    const toolResults: Anthropic.ToolResultBlockParam[] = [];
    for (const toolUse of toolUseBlocks) {
      const result = await executeToolCall(toolUse.name, toolUse.input);
      toolResults.push({
        type: "tool_result",
        tool_use_id: toolUse.id,
        content: result,
      });
    }

    // Add assistant response and tool results to conversation
    currentMessages = [
      ...currentMessages,
      { role: "assistant", content: response.content },
      { role: "user", content: toolResults },
    ];
  }

  // Safety: if we hit max iterations, do one final call without tools
  return client.messages.create({
    model: "claude-haiku-4-5-20251001",
    max_tokens: 2048,
    messages: currentMessages,
  });
}
```

### Pattern 2: External Content FTS5 Table
**What:** An FTS5 virtual table that indexes content from the main knowledge_items table but doesn't duplicate the data.
**When to use:** For all full-text search operations on knowledge items.
**Example:**
```sql
-- Source: SQLite FTS5 docs (https://sqlite.org/fts5.html)
-- Main content table
CREATE TABLE knowledge_items (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  chat_id TEXT NOT NULL,
  title TEXT NOT NULL,
  summary TEXT NOT NULL,
  content TEXT NOT NULL,
  source TEXT,
  created_at INTEGER NOT NULL DEFAULT (unixepoch()),
  updated_at INTEGER NOT NULL DEFAULT (unixepoch()),
  last_accessed_at INTEGER NOT NULL DEFAULT (unixepoch())
);

-- External content FTS5 table (indexes title, summary, content)
CREATE VIRTUAL TABLE knowledge_fts USING fts5(
  title,
  summary,
  content,
  content='knowledge_items',
  content_rowid='id',
  tokenize='porter unicode61'
);

-- Keep FTS in sync with triggers
CREATE TRIGGER knowledge_items_ai AFTER INSERT ON knowledge_items BEGIN
  INSERT INTO knowledge_fts(rowid, title, summary, content)
  VALUES (new.id, new.title, new.summary, new.content);
END;

CREATE TRIGGER knowledge_items_ad AFTER DELETE ON knowledge_items BEGIN
  INSERT INTO knowledge_fts(knowledge_fts, rowid, title, summary, content)
  VALUES ('delete', old.id, old.title, old.summary, old.content);
END;

CREATE TRIGGER knowledge_items_au AFTER UPDATE ON knowledge_items BEGIN
  INSERT INTO knowledge_fts(knowledge_fts, rowid, title, summary, content)
  VALUES ('delete', old.id, old.title, old.summary, old.content);
  INSERT INTO knowledge_fts(rowid, title, summary, content)
  VALUES (new.id, new.title, new.summary, new.content);
END;
```

### Pattern 3: Two-Pass Retrieval
**What:** First query returns summaries (low token cost). Claude decides which items to expand. Second query returns full content for selected items.
**When to use:** Every knowledge retrieval to stay within token budget.
**Example:**
```typescript
// Pass 1: Search returns summaries only
interface SearchResult {
  id: number;
  title: string;
  summary: string;  // Short description, ~50-100 tokens
  rank: number;     // BM25 relevance score
  tags: string[];
  lastAccessedAt: Date;
}

// Pass 2: Get full content for selected items
interface KnowledgeItemFull {
  id: number;
  title: string;
  summary: string;
  content: string;  // Full content, could be 500+ tokens
  source: string | null;
  tags: string[];
}

// FTS5 search query with BM25 ranking
// Weight: title matches 10x, summary 5x, content 1x
function searchKnowledge(query: string, limit: number = 5): SearchResult[] {
  const results = db.all(sql`
    SELECT
      ki.id,
      ki.title,
      ki.summary,
      rank,
      ki.last_accessed_at
    FROM knowledge_fts
    JOIN knowledge_items ki ON ki.id = knowledge_fts.rowid
    WHERE knowledge_fts MATCH ${query}
    ORDER BY rank
    LIMIT ${limit}
  `);
  return results;
}
```

### Pattern 4: Token Budget Manager
**What:** Estimates token count for text and enforces soft/hard budget limits.
**When to use:** Before injecting knowledge or conversation history into the Claude request.
**Example:**
```typescript
// Source: Anthropic token counting docs + 4 chars/token heuristic
const CHARS_PER_TOKEN = 4; // Conservative estimate for English text

function estimateTokens(text: string): number {
  return Math.ceil(text.length / CHARS_PER_TOKEN);
}

interface TokenBudget {
  knowledgeSoftLimit: number;   // 4000 tokens
  knowledgeHardLimit: number;   // 6000 tokens
  conversationBudget: number;   // Remaining after knowledge
  totalBudget: number;          // System prompt + knowledge + conversation + user message
}

function allocateBudget(
  knowledgeTokens: number,
  conversationTokens: number,
): { knowledge: number; conversation: number } {
  // Knowledge takes priority over conversation history
  const knowledgeAllocation = Math.min(knowledgeTokens, 6000);
  const conversationAllocation = Math.min(
    conversationTokens,
    Math.max(0, 10000 - knowledgeAllocation) // Example total context budget
  );
  return { knowledge: knowledgeAllocation, conversation: conversationAllocation };
}
```

### Pattern 5: Conversation Context with Sliding Window
**What:** Keep recent conversation turns in full, summarize or drop older turns to fit within budget.
**When to use:** Every request to maintain conversation continuity without exceeding limits.
**Example:**
```typescript
// Sliding window: keep last N turns in full
// Optionally summarize older turns into a brief context paragraph
function buildConversationContext(
  turns: ConversationTurn[],
  tokenBudget: number,
): Anthropic.MessageParam[] {
  const messages: Anthropic.MessageParam[] = [];
  let tokensUsed = 0;

  // Work backwards from most recent
  for (let i = turns.length - 1; i >= 0; i--) {
    const turnTokens = estimateTokens(turns[i].text);
    if (tokensUsed + turnTokens > tokenBudget) break;
    messages.unshift({
      role: turns[i].direction === "in" ? "user" : "assistant",
      content: turns[i].text,
    });
    tokensUsed += turnTokens;
  }

  return messages;
}
```

### Anti-Patterns to Avoid
- **Dumping all knowledge into system prompt:** Wastes tokens; use tool-based retrieval instead
- **FTS5 queries with user input directly:** Always sanitize/escape MATCH queries; malformed queries crash SQLite
- **Storing FTS5 table in Drizzle schema:** Drizzle does not support virtual tables; use raw SQL for FTS5 DDL
- **Relying on Drizzle push/generate for FTS5:** Drizzle-kit cannot generate migrations for virtual tables; manage FTS5 schema manually
- **Creating FTS5 table without external content:** Without `content=` option, data is duplicated in both the regular table and FTS index, doubling storage

## Don't Hand-Roll

Problems that look simple but have existing solutions:

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Full-text search | Custom LIKE queries or regex matching | SQLite FTS5 with BM25 ranking | FTS5 handles tokenization, stemming, relevance ranking; LIKE is O(n) and can't rank |
| Token counting | Custom tokenizer | Character-based estimate (4 chars/token) | Good enough for soft budgets; official API adds latency for marginal accuracy gain |
| Tool use loop | Custom JSON-based function dispatch | Anthropic SDK `messages.create()` with `tools` param | SDK handles serialization, validation, content block typing |
| FTS query sanitization | Manual string escaping | Parameterized queries via `sql` template | SQLite prepared statements handle escaping properly |
| Conversation persistence | Custom file-based storage | Extend existing SQLite messages table | Already storing messages; add fields for session tracking |

**Key insight:** The biggest temptation is building a custom retrieval orchestrator. The Anthropic tool use API already provides the agentic loop structure -- Claude decides what to look up, the processor just executes the tool calls and feeds results back.

## Common Pitfalls

### Pitfall 1: FTS5 MATCH Query Syntax Errors
**What goes wrong:** FTS5 MATCH queries have strict syntax. Unescaped special characters (*, ", +, -, OR, AND, NOT, NEAR) in user-derived search terms cause SQLite errors that crash the query.
**Why it happens:** Claude generates search queries that may contain special characters or FTS5 operators.
**How to avoid:** Wrap all search terms in double quotes for exact phrase matching, or strip FTS5 operators. Wrap FTS queries in try/catch and fall back to simpler queries on parse errors.
**Warning signs:** SQLite "fts5: syntax error" exceptions in logs.

### Pitfall 2: FTS5 and Drizzle ORM Incompatibility
**What goes wrong:** Drizzle ORM cannot define, migrate, or query FTS5 virtual tables through its schema API. Attempting to use Drizzle-kit push/generate with FTS5 tables fails.
**Why it happens:** Drizzle does not support CREATE VIRTUAL TABLE (open issue #2046, no ETA for fix).
**How to avoid:** Define the knowledge_items table in Drizzle schema (regular table). Create the FTS5 virtual table and triggers via raw SQL using `db.$client.exec()` at database initialization time. Query FTS5 via `db.all(sql\`...\`)` or `db.$client.prepare()`.
**Warning signs:** Drizzle-kit errors on migration generation, empty results from FTS5 queries.

### Pitfall 3: Tool Use Message Ordering
**What goes wrong:** The Anthropic API requires strict message ordering: assistant message with tool_use blocks must be immediately followed by a user message containing all corresponding tool_result blocks. Violating this returns a 400 error.
**Why it happens:** Easy to accidentally insert text content before tool_result blocks, or split tool results across multiple user messages.
**How to avoid:** Always construct the tool result message as `{ role: "user", content: [toolResult1, toolResult2, ...] }` with all results in a single message, tool_results first.
**Warning signs:** 400 errors from Anthropic API mentioning "tool_use ids were found without tool_result blocks immediately after".

### Pitfall 4: Token Budget Overshoot
**What goes wrong:** Character-based token estimation is approximate. Actual token usage may exceed estimates by 10-20%, causing unexpected context window consumption.
**Why it happens:** Special characters, whitespace patterns, and non-English text tokenize differently than the 4-chars/token heuristic.
**How to avoid:** Use conservative estimates (3.5 chars/token for safety) for budget calculations. Set the soft limit well below the hard limit. Monitor actual vs estimated tokens via the usage data returned from Claude API responses. Adjust the ratio based on observed data.
**Warning signs:** Actual input_tokens from API consistently exceeding estimated tokens.

### Pitfall 5: FTS5 External Content Table Desync
**What goes wrong:** If knowledge items are modified without updating the FTS5 index (e.g., direct SQL updates bypassing triggers), search results return stale or incorrect data.
**Why it happens:** Triggers only fire on INSERT/UPDATE/DELETE through the main table. Raw SQL updates or bulk operations may bypass triggers.
**How to avoid:** Always modify knowledge_items through the repository layer (which includes Drizzle operations that fire triggers). Add a `rebuild` function that runs `INSERT INTO knowledge_fts(knowledge_fts) VALUES('rebuild')` for maintenance.
**Warning signs:** Search results don't match actual content; items that should match don't appear.

### Pitfall 6: Conversation History Grows Without Bound
**What goes wrong:** Without session boundaries and retention, conversation history accumulates indefinitely, making token budget management increasingly difficult and database queries slower.
**Why it happens:** No automatic cleanup or summarization of old conversations.
**How to avoid:** Define session boundaries (e.g., 30-minute gap = new session). Limit conversation context to recent session + summary of past sessions. Consider a retention window (e.g., 7 days of detailed history, summaries beyond that).
**Warning signs:** Increasing token usage over time for the same types of queries; slow conversation history queries.

## Code Examples

Verified patterns from official sources:

### Creating FTS5 Virtual Table at Database Init
```typescript
// Access underlying better-sqlite3 instance from Drizzle
// Source: Drizzle docs (https://orm.drizzle.team/docs/get-started-sqlite)
import Database from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";

export function createDatabase(dbPath: string) {
  const sqlite = new Database(dbPath);
  sqlite.pragma("journal_mode = WAL");

  // Create FTS5 virtual table and sync triggers
  // This is idempotent -- IF NOT EXISTS prevents errors on restart
  sqlite.exec(`
    CREATE VIRTUAL TABLE IF NOT EXISTS knowledge_fts USING fts5(
      title,
      summary,
      content,
      content='knowledge_items',
      content_rowid='id',
      tokenize='porter unicode61'
    );
  `);

  // Triggers need to be created separately (IF NOT EXISTS not supported for triggers)
  // Use a migration or check existence before creating
  return drizzle(sqlite, { schema });
}
```

### Querying FTS5 with BM25 Ranking via Drizzle sql
```typescript
// Source: SQLite FTS5 docs (https://sqlite.org/fts5.html)
import { sql } from "drizzle-orm";

function searchKnowledge(db: DrizzleDatabase, query: string, limit: number = 5) {
  // Escape the query to prevent FTS5 syntax errors
  const safeQuery = escapeForFts5(query);

  return db.all(sql`
    SELECT
      ki.id,
      ki.title,
      ki.summary,
      bm25(knowledge_fts, 10.0, 5.0, 1.0) as relevance,
      ki.last_accessed_at
    FROM knowledge_fts
    JOIN knowledge_items ki ON ki.id = knowledge_fts.rowid
    WHERE knowledge_fts MATCH ${safeQuery}
    ORDER BY bm25(knowledge_fts, 10.0, 5.0, 1.0)
    LIMIT ${limit}
  `);
}

// FTS5 query escaping -- wrap terms in quotes, strip operators
function escapeForFts5(query: string): string {
  // Remove FTS5 operators and wrap each term in quotes
  const terms = query
    .replace(/[*+"()-]/g, " ")
    .split(/\s+/)
    .filter(Boolean)
    .map(term => `"${term}"`);
  return terms.join(" ");
}
```

### Anthropic Tool Use with Manual Loop (TypeScript)
```typescript
// Source: Anthropic SDK docs (https://platform.claude.com/docs/en/agents-and-tools/tool-use/implement-tool-use)
import Anthropic from "@anthropic-ai/sdk";

const KNOWLEDGE_TOOLS: Anthropic.Tool[] = [
  {
    name: "search_knowledge",
    description:
      "Search the user's knowledge base (recipes, preferences, cooking notes) " +
      "for relevant items. Returns brief summaries with IDs. Use this when the " +
      "user asks about recipes they've saved, their preferences, or past cooking " +
      "discussions. You can search multiple times with different queries.",
    input_schema: {
      type: "object" as const,
      properties: {
        query: {
          type: "string",
          description: "Search terms (e.g., 'chicken dinner quick', 'pasta vegetarian')",
        },
        limit: {
          type: "number",
          description: "Max number of results to return. Default 5.",
        },
      },
      required: ["query"],
    },
  },
  {
    name: "get_knowledge_item",
    description:
      "Retrieve the full content of a specific knowledge item by its ID. " +
      "Use this after search_knowledge to get complete details for items " +
      "the user is asking about.",
    input_schema: {
      type: "object" as const,
      properties: {
        id: {
          type: "number",
          description: "The knowledge item ID from search results",
        },
      },
      required: ["id"],
    },
  },
];
```

### Token Counting API (for validation/debugging, not per-request)
```typescript
// Source: Anthropic token counting docs (https://platform.claude.com/docs/en/build-with-claude/token-counting)
const response = await client.messages.countTokens({
  model: "claude-haiku-4-5-20251001",
  system: "You are a scientist",
  messages: [{ role: "user", content: "Hello, Claude" }],
  tools: KNOWLEDGE_TOOLS,
});
console.log(response.input_tokens); // e.g., 403
```

### Drizzle Schema for Knowledge Items
```typescript
// Regular Drizzle table -- FTS5 virtual table created separately via raw SQL
import { integer, text, sqliteTable } from "drizzle-orm/sqlite-core";

export const knowledgeItems = sqliteTable("knowledge_items", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  chatId: text("chat_id").notNull(),
  title: text("title").notNull(),
  summary: text("summary").notNull(),
  content: text("content").notNull(),
  source: text("source"),
  createdAt: integer("created_at", { mode: "timestamp" })
    .notNull()
    .$defaultFn(() => new Date()),
  updatedAt: integer("updated_at", { mode: "timestamp" })
    .notNull()
    .$defaultFn(() => new Date()),
  lastAccessedAt: integer("last_accessed_at", { mode: "timestamp" })
    .notNull()
    .$defaultFn(() => new Date()),
});

export const knowledgeTags = sqliteTable("knowledge_tags", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  knowledgeItemId: integer("knowledge_item_id")
    .notNull()
    .references(() => knowledgeItems.id, { onDelete: "cascade" }),
  tag: text("tag").notNull(),
});
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Embedding-based RAG (vector DB) | FTS5 for small-scale apps | Always available | For <10K items, FTS5 is simpler, faster, zero dependencies, and good enough |
| Hardcoded context injection | Tool-use driven retrieval | Anthropic tool use GA (2024) | Claude decides what to look up -- more flexible, adapts to conversation |
| Custom agentic loop | SDK beta `toolRunner` helper | SDK 0.50+ (2025) | Simplifies multi-step tool use; but manual loop gives more budget control |
| Simple string messages | Multi-block content (text + tool_use + tool_result) | Messages API (2024) | Structured content blocks enable tool interactions within conversation |
| Token counting via tiktoken approximation | Official `messages.countTokens()` API | 2024 | Free API endpoint for accurate token counts; useful for validation |

**Deprecated/outdated:**
- FTS3/FTS4: Use FTS5 instead -- it is the current/recommended version
- `client.completions`: Use `client.messages.create()` -- completions API is legacy

## Open Questions

Things that couldn't be fully resolved:

1. **Drizzle `db.all()` return type with raw SQL**
   - What we know: `db.all(sql\`...\`)` executes queries and returns results, but the return type with raw SQL is `unknown[]` requiring manual typing
   - What's unclear: Whether `db.all()` works directly with FTS5 JOIN queries or if `db.$client.prepare()` is more reliable
   - Recommendation: Test both approaches in Phase 3 task 1; use `db.$client.prepare().all()` as fallback if `db.all()` doesn't work with FTS5 joins. The `$client` approach gives direct better-sqlite3 access which is well-documented for FTS5.

2. **Optimal FTS5 Tokenizer for Recipe Content**
   - What we know: `porter unicode61` provides stemming (e.g., "cooking" matches "cook") and Unicode normalization
   - What's unclear: Whether porter stemmer works well for ingredient names and cooking terms specifically
   - Recommendation: Start with `porter unicode61` (the standard choice). Can be changed later by rebuilding the FTS index -- it's a configuration change, not a schema change.

3. **Tool Definition Token Overhead**
   - What we know: Tool definitions consume input tokens. Two tool definitions with detailed descriptions likely cost 200-400 tokens per request.
   - What's unclear: Exact token cost of KNOWLEDGE_TOOLS definitions with the current SDK version
   - Recommendation: Use `messages.countTokens()` once during development to measure overhead. Cache the system prompt + tools with `cache_control: { type: "ephemeral" }` to minimize cost (already set up in Phase 2).

4. **Session Boundary Heuristic**
   - What we know: Need to define what constitutes a "new session" for conversation context management
   - What's unclear: Optimal time gap threshold for meal planning conversations
   - Recommendation: Default to 4 hours. If last message in a chat was >4 hours ago, treat as new session. This is configurable and can be tuned based on usage.

## Sources

### Primary (HIGH confidence)
- [SQLite FTS5 Extension official docs](https://sqlite.org/fts5.html) -- FTS5 syntax, external content tables, BM25 ranking, tokenizer options
- [Anthropic Tool Use Implementation Guide](https://platform.claude.com/docs/en/agents-and-tools/tool-use/implement-tool-use) -- Tool definitions, tool_use/tool_result message format, agentic loop, parallel tool use
- [Anthropic Token Counting API](https://platform.claude.com/docs/en/build-with-claude/token-counting) -- `messages.countTokens()` API, free usage, rate limits
- [Anthropic Context Windows Guide](https://platform.claude.com/docs/en/build-with-claude/context-windows) -- Context window limits (200K standard), token budget management strategies
- [Drizzle ORM sql template docs](https://orm.drizzle.team/docs/sql) -- `sql\`\``, `sql.raw()`, `db.execute()`, `db.all()`, parameterized queries
- [Anthropic SDK TypeScript helpers](https://github.com/anthropics/anthropic-sdk-typescript/blob/main/helpers.md) -- betaTool, betaZodTool, toolRunner API

### Secondary (MEDIUM confidence)
- [Drizzle ORM FTS5 issue #2046](https://github.com/drizzle-team/drizzle-orm/issues/2046) -- Confirmed FTS5 not supported natively; workaround via raw SQL
- Anthropic SDK v0.73.0 TypeScript type definitions (inspected locally) -- Tool, ToolUseBlock, ToolResultBlockParam interfaces confirmed

### Tertiary (LOW confidence)
- Token estimation heuristic (4 chars/token) -- Widely cited approximation, sufficient for soft budget targets, but not officially documented ratio

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH -- All libraries already installed and verified; no new dependencies needed
- Architecture (tool use loop): HIGH -- Official Anthropic docs with TypeScript examples; SDK types verified locally
- Architecture (FTS5): HIGH -- Official SQLite docs; better-sqlite3 ships with FTS5 compiled in
- Architecture (Drizzle + FTS5 interop): MEDIUM -- Workaround approach based on GitHub issue and community patterns; not officially documented by Drizzle
- Token budget management: MEDIUM -- Heuristic-based approach; character ratio is approximate
- Pitfalls: HIGH -- Based on official docs warnings and known limitations

**Research date:** 2026-02-06
**Valid until:** 2026-03-06 (stable domain; SQLite FTS5 and Anthropic tool use API are mature)
