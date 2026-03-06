# Sous Memory System: Ideation Summary

## Problem Definition

Sous currently stores user preferences as `knowledge_items` differentiated by tags (`preference`, `pref:dietary`, `pref:cooking`, etc.). This approach has clear problems:

- **Duplication** -- the same fact stored 3x because dedup fails across slightly different phrasings
- **Forced categorization** -- rigid tag taxonomy (`pref:dietary`, `pref:schedule`, etc.) doesn't fit many real preferences (e.g., "put amounts inline in recipe steps")
- **Over-engineered storage** -- title/summary/content is recipe-shaped; a single-sentence fact doesn't need three fields
- **Flat injection** -- all preferences dumped into the system prompt with equal weight regardless of importance

The deeper issue: the structured preference system fights against how users naturally share information. Forcing conversational learning into categories causes duplication, misclassification, and tool misuse by Claude.

**Desired outcome:** A memory system that makes Sous feel like *your* cooking assistant -- one that genuinely knows you and gets better over time. Memory becomes the "moat" -- the thing that makes users stay because Sous knows them deeply within the cooking domain.

**Core tension:** Flexible memory (free-form facts, agent-managed) vs. rigid application pathways (reminder times, allergy enforcement, store assignment) that need programmatic structure.

## Landscape Overview

### How Major Agents Handle Memory

| System | Format | Injection | Key Tradeoff |
|--------|--------|-----------|--------------|
| **ChatGPT** | Timestamped atomic facts | All facts injected into every prompt (~1,200 word cap) | Simple but capacity-limited; frequent data loss reported |
| **Gemini** | Structured `user_context` document | Single synthesized doc | Organized but loses nuance in synthesis |
| **Letta/MemGPT** | Labeled memory blocks (agent-editable) + archival vector store | Core blocks always in context; archival searched on demand | Most sophisticated but complex infrastructure |
| **Claude API** | File-based CRUD (developer-controlled) | Agent searches/loads on demand | Flexible but requires developer to design the system |
| **Mem0** | Multi-backend (vector + KV + graph) | Semantic search | Rich querying but massive infrastructure overhead |

### Key Research Findings

1. **Retrieval quality >> write strategy.** Accuracy varies 20 points across retrieval methods but only 3-8 points across storage approaches (March 2026 paper). Don't overthink storage; invest in retrieval.

2. **Agentic keyword search gets 90%+ of vector search quality** (Amazon Science, Feb 2026). FTS5 (which Sous already has) is sufficient.

3. **Atomic facts beat prose synthesis for injection.** ChatGPT (largest deployed system) uses atomic facts. Chroma's "Context Rot" research found models perform better on discrete separated items than structured prose. Synthesis is lossy -- it drifts meaning, hides contradictions, and adds maintenance cost for zero benefit at <200 facts.

4. **The Mem0 dedup pipeline works.** Extract facts -> FTS match against existing -> LLM decides add/update/noop. Three outcomes prevent unbounded growth.

5. **Dual-write via parallel tool calls** is the cleanest bridge between flexible memory and structured settings. Sous already does this for reminder times (saves preference + calls update_reminder_settings). The pattern just needs generalizing.

## Approaches Considered

### Approach A: "Letta-Inspired" Memory Blocks + Settings Table
Labeled text blocks (about_household, food_preferences, cooking_style, sous_personality) that Claude reads/writes via tools. Always in context. Claude actively manages them -- appending, rewriting, pruning.

**Rejected because:** Developer-defined block labels accidentally shape the experience. Same category-forcing problem as today, just with bigger buckets. The user doesn't get to define what Sous remembers about them -- the developer does via block structure.

### Approach B: Atomic Facts + Settings Table (SELECTED)
Flat memory table, one fact per row. Free-form text. Soft category for injection formatting. Paired with a rigid settings table for application pathways. Claude saves facts proactively; users manage via Mini App or conversation.

**Selected because:** Most honest architecture. No interpretation layer. Each fact is independently editable/deletable. Scales well (FTS5 retrieval when needed). Matches what ChatGPT does at scale. Simplest to implement and debug.

### Approach C: LLM-Maintained Prose Document + Settings Table
Single markdown document per household that Claude rewrites over time. Natural to read but prone to information loss during rewrites. Hard to edit granularly.

**Rejected because:** Claude will drop facts during rewrites -- not if, but when. Debugging is awful ("when did Sous forget I don't like cilantro?"). Granular deletion requires full document rewrite. The risk/complexity isn't justified.

### Prose Synthesis as Read Layer (B + C Hybrid)
Store atomic facts (Approach B) but generate a synthesized prose summary for injection. Facts are source of truth; prose is derived cache.

**Rejected because:** Research strongly favors raw fact injection. Synthesis adds lossy compression, token overhead (~30%), subtle meaning drift, contradiction smoothing, and regeneration maintenance cost -- all for no measurable comprehension benefit. Categorized lists with XML tags achieve the same organizational clarity without risk.

## Recommended Direction

### Architecture: Atomic Facts + Settings Table + Dual-Write Tools

#### 1. Memory Table (`memories`)

| Column | Type | Purpose |
|--------|------|---------|
| `id` | INTEGER PK | Primary key |
| `household_id` | TEXT | Household isolation |
| `content` | TEXT | The fact itself ("Jim loves Mediterranean food") |
| `category` | TEXT | Soft grouping for injection: household, taste, cooking_style, logistics, sous_behavior |
| `source` | TEXT | How learned: `conversational`, `onboarding` |
| `created_at` | TIMESTAMP | When learned |
| `last_accessed_at` | TIMESTAMP | For relevance tracking |

No tags table. No title/summary/content split. No version tracking. Just facts.

#### 2. Settings Table (`household_settings`)

Rigid, typed columns for the ~10-15 fields that drive application code:

- **Timing:** `timezone`, `dinner_time`, `breakfast_time`, `lunch_time`, `snack_time`, `dessert_time` (most already exist in `reminder_settings` -- consolidate or extend)
- **Hard constraints:** `allergies` (JSON array), `dietary_restrictions` (JSON array)
- **Shopping:** `preferred_stores` (JSON array with default marked)
- **Cooking:** `default_servings` (number)

These are the ONLY things that need programmatic access. Everything else lives in memory.

#### 3. Tools

| Tool | Purpose |
|------|---------|
| `save_memory` | Save a fact. Runs Mem0-style dedup: FTS match against existing -> Claude decides add/update/noop. |
| `delete_memory` | Remove a fact by ID. |
| `search_memories` | FTS search for when injected context isn't enough (at scale). |
| `update_setting` | Update a typed field in settings. Validates values. Returns confirmation. |

System prompt instruction: "When a user shares a fact about themselves, save it as a memory. If it also maps to a setting (meal time, allergy, store preference), call `update_setting` too. Never ask 'should I save this?' -- just save durable facts and skip transient moods."

#### 4. Context Injection

All memories injected into every prompt as a categorized list:

```xml
<user_context>
The following are things you've learned about this household. Use them to personalize your suggestions and responses.

## Household
- Family of four: Jim, wife, 3-year-old, 9-month-old

## Taste
- Loves Mediterranean and Italian food
- Prefers mild spice, can handle moderate heat
- Doesn't like marshmallows

## Cooking Style
- Prefers ingredient amounts inline in recipe steps
- Budget-conscious but willing to splurge occasionally

## Logistics
- Dinner usually around 6:45 PM
- Shops at Harris Teeter and Lowe's Foods, not Food Lion
</user_context>
```

Settings injected separately as a structured block for both Claude and application code.

At 100+ memories per household, switch to: inject top ~50 by recency/access + agent-driven `search_memories` for the rest.

#### 5. Dedup Pipeline (on `save_memory`)

1. FTS5 search existing memories for similar content
2. If matches found, return them to Claude with the prompt: "These existing memories seem related. Decide: ADD (new distinct fact), UPDATE (replace existing with better version), or NOOP (already known)."
3. Claude responds with the action
4. Tool handler executes it

This directly solves the triple-duplicate "Mediterranean preference" problem.

#### 6. Migration Path

- Extract facts from existing preference `knowledge_items` into `memories` table (one fact per row)
- Extract structured values (allergies, stores, meal times) into settings table
- Recipes stay untouched in `knowledge_items`
- Onboarding writes directly to memories + settings (not a separate process)
- `/preferences` command becomes `/memory` or aliases to settings view

#### 7. Mini App UI

- **Memory view** -- list of facts Sous knows, grouped by category. Tap to delete.
- **Settings view** -- rigid fields (meal times, allergies, stores). Form-style editing, no LLM needed.

## Open Questions

1. **Category assignment** -- should Claude assign categories at save time, or should a lightweight classifier assign them at injection time? Assigning at save time is simpler but categories might evolve.

2. **Memory cap** -- should there be a hard limit on memories per household? At what point does "Sous knows too much" become creepy or unhelpful? ChatGPT caps at ~1,200 words total.

3. **Decay/pruning** -- should memories that haven't been accessed in 6+ months be surfaced for review? Or is passive decay (lower injection priority) sufficient?

4. **Multi-household users** -- if a user is in multiple households, memories are already isolated by `household_id`. But should Sous know "Jim" across households? (Probably not for v1.)

5. **Onboarding redesign** -- the current onboarding state machine collects preferences through structured questions. With the new memory system, onboarding could be more conversational ("tell me about your household and how you like to eat") and just save facts as they emerge. Worth redesigning or keep the current structure?

## Key Sources

### Deployed Systems
- [ChatGPT Memory Architecture (Embrace The Red)](https://embracethered.com/blog/posts/2025/chatgpt-how-does-chat-history-memory-preferences-work/)
- [ChatGPT Memory Reverse Engineered (LLMRefs)](https://llmrefs.com/blog/reverse-engineering-chatgpt-memory)
- [Simon Willison on ChatGPT Memory](https://simonwillison.net/2025/May/21/chatgpt-new-memory/)
- [Gemini Memory Analysis (Shlok Khemani)](https://www.shloked.com/writing/gemini-memory)
- [Claude Memory Tool API](https://platform.claude.com/docs/en/agents-and-tools/tool-use/memory-tool)
- [Anthropic Context Management](https://www.anthropic.com/news/context-management)

### Architecture & Patterns
- [Letta/MemGPT Paper (arXiv)](https://arxiv.org/abs/2310.08560)
- [Letta Memory Blocks](https://www.letta.com/blog/memory-blocks)
- [Mem0 Paper](https://arxiv.org/abs/2504.19413)
- [LangMem Conceptual Guide](https://langchain-ai.github.io/langmem/concepts/conceptual_guide/)
- [Serokell: Design Patterns for LLM Memory](https://serokell.io/blog/design-patterns-for-long-term-memory-in-llm-powered-architectures)

### Retrieval & Scale
- [Keyword Search Is All You Need (Amazon, Feb 2026)](https://arxiv.org/abs/2602.23368)
- [Retrieval vs. Utilization Bottlenecks (March 2026)](https://arxiv.org/abs/2603.02473)
- [Context Rot (Chroma Research)](https://research.trychroma.com/context-rot)
- [ZeroClaw Hybrid Memory (SQLite + FTS5 + Vector)](https://zeroclaws.io/blog/zeroclaw-hybrid-memory-sqlite-vector-fts5/)

### Bridge Patterns
- [Garvik.dev: AI Agent Tool Data Extraction](https://www.garvik.dev/ai-agents/agent-sdk/function-tool/ai-agent-tool-data-extraction)
- [Colby: Messy Notes to Clean CRM Fields](https://getcolby.com/blog/turning-messy-notes-into-clean-salesforce-fields-with-ai)
- [LangMem: Managing User Profiles](https://langchain-ai.github.io/langmem/guides/manage_user_profile/)

### Failure Modes & Privacy
- [The Problem with AI Agent Memory (Dan Giannone)](https://medium.com/@DanGiannone/the-problem-with-ai-agent-memory-9d47924e7975)
- [Unit 42: Memory Poisoning via Prompt Injection](https://unit42.paloaltonetworks.com/indirect-prompt-injection-poisons-ai-longterm-memory/)
- [MIT Technology Review: AI Memory Privacy](https://www.technologyreview.com/2026/01/28/1131835/what-ai-remembers-about-you-is-privacys-next-frontier/)
- [OWASP AI Agent Security Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/AI_Agent_Security_Cheat_Sheet.html)

### Injection Format
- [Anthropic: Claude 4 Prompting Best Practices](https://platform.claude.com/docs/en/build-with-claude/prompt-engineering/claude-4-best-practices)
- [Anthropic: Effective Context Engineering for AI Agents](https://www.anthropic.com/engineering/effective-context-engineering-for-ai-agents)
- [MIT: Personalization Makes LLMs More Agreeable](https://news.mit.edu/2026/personalization-features-can-make-llms-more-agreeable-0218)
