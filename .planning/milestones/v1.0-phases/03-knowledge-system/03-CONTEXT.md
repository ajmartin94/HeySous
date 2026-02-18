# Phase 3: Knowledge System & Retrieval - Context

**Gathered:** 2026-02-06
**Status:** Ready for planning

<domain>
## Phase Boundary

Agent retrieves relevant knowledge per conversation and manages conversation context within a token budget. This phase builds the general-purpose storage, retrieval, and context management infrastructure. Recipes (Phase 4) and preferences (Phase 5) are stored through this system but defined in their own phases.

</domain>

<decisions>
## Implementation Decisions

### Knowledge shape
- Hybrid storage: structured core fields + free-text notes/context per item
- One knowledge item per concept (a recipe is one item, a preference is one item — not broken into sub-pieces)
- Tag-based categorization, no predefined type enum (items have flexible tags like 'recipe', 'chicken', 'quick')
- Two-pass retrieval: summaries first, expand to full content on demand (token-efficient)

### Retrieval strategy
- SQLite FTS5 full-text search (no embeddings, no external dependencies)
- Agent-driven queries: Claude analyzes the conversation and decides what to look up via tool calls
- Multi-step retrieval allowed: agent can search, read results, search again in one turn
- When results exceed budget, recency wins — most recently accessed/modified items take priority

### Conversation memory
- Cross-session memory: conversations persist, bot can reference past chats
- Session boundary and retention window: Claude's discretion (practical defaults)
- Long conversation handling: Claude's discretion (summarization vs sliding window)

### Token budget policy
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

</decisions>

<specifics>
## Specific Ideas

- /debug command shows retrieval stats for the last message — power user feature for development
- "The recipe brain" — the knowledge system should feel like a brain that remembers everything and surfaces what's relevant, not a database you query
- Agent decides what to look up based on conversation, no hardcoded query paths per feature type

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope

</deferred>

---

*Phase: 03-knowledge-system*
*Context gathered: 2026-02-06*
