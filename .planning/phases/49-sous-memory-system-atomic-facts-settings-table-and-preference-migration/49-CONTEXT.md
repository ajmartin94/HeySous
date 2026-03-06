# Phase 49: Sous Memory System - Context

**Gathered:** 2026-03-05
**Status:** Ready for planning

<domain>
## Phase Boundary

Replace the current preference-as-knowledge-item system with an atomic facts memory table (`memories`), repurpose `reminder_settings` into `application_settings`, add new Claude tools (`save_memory`, `delete_memory`, `search_memories`, `update_settings`), implement a dedup pipeline, migrate existing preference data, rename `/preferences` to `/memory`, and add memory + settings views to the Mini App settings page.

Recipes stay in `knowledge_items`. `save_knowledge` stays for recipes. This phase does NOT touch recipe storage or the recipe FTS index.

</domain>

<decisions>
## Implementation Decisions

### Settings table scope
- Rename/repurpose `reminder_settings` into `application_settings` -- same columns (timezone, meal times, morning_enabled, prep_alerts_enabled, muted_until), no new typed fields
- Allergies, dietary restrictions, preferred stores, default servings all stay as memories (atomic facts), NOT typed settings columns
- No `household_settings` table needed -- `application_settings` is the single settings table
- Rename the `update_reminder_settings` tool to `update_settings` to match the new table name

### Tool design
- `save_knowledge` stays for recipes (title/summary/content/tags in `knowledge_items`)
- New `save_memory` tool for atomic facts (content + optional category into `memories` table)
- New `delete_memory` tool to remove a memory by ID
- New `search_memories` tool for FTS search when injected context isn't enough (at scale)
- Clean separation: recipes = knowledge_items, facts = memories

### Dedup pipeline
- Inline in `save_memory` tool handler (blocking, not async)
- FTS5 search for similar existing memories on every save
- If matches found, tool returns match info to Claude; Claude decides ADD/UPDATE/NOOP in a follow-up tool call (same pattern as current `save_knowledge` dedup with `skip_dedup`)
- Claude saves memories proactively and silently -- system prompt instructs "save durable facts, skip transient moods, never ask 'should I save this?'"
- No hard cap on memories per household; soft injection limit (~50-100 facts injected into system prompt, rest accessible via `search_memories`)

### Migration
- Automated migration script in the DB migration framework
- Extracts facts from preference-tagged `knowledge_items` (title + summary -> content), maps tags to categories
- Inserts into `memories` table, then deletes old preference rows from `knowledge_items`
- `knowledge_changelog` preserves historical record
- Recipes stay untouched in `knowledge_items`

### Bot command
- `/preferences` renamed to `/memory`
- Reads from `memories` table, grouped by category
- Same display format (grouped sections, severity markers) but sourced from new table

### Mini App memory UI
- Memory and settings views added to the existing settings cog (not a new nav tab)
- **Memory view:** Grouped list with category headers (Household, Taste, Cooking Style, Logistics, etc.). Each fact shows content and a delete button. Delete only -- no inline editing (to change a fact, tell Sous in chat, which triggers dedup naturally)
- **Settings view:** Form fields for timezone, meal times, morning summary toggle, prep alerts toggle. Direct editing without going through Claude.

### Claude's Discretion
- Category assignment strategy (at save time vs. injection time)
- Memory injection format and ordering within categories
- Exact FTS similarity threshold for dedup matching
- System prompt wording for proactive memory saving instructions
- How to handle the soft injection limit (recency vs. access frequency vs. hybrid)

</decisions>

<specifics>
## Specific Ideas

- The ideation doc's "Approach B: Atomic Facts + Settings Table" is the guiding architecture
- Memory injection should use categorized XML format (like the `<user_preferences>` block today but sourced from `memories`)
- Dedup follows the Mem0 pattern: extract -> FTS match -> LLM decides add/update/noop
- "Dual-write" pattern for settings: when user says "I eat breakfast at 8am", Claude calls both `save_memory` (for the fact) and `update_settings` (for the breakfast_time column)
- The memory system should make Sous feel like "your" cooking assistant -- one that genuinely knows you

</specifics>

<code_context>
## Existing Code Insights

### Reusable Assets
- `src/knowledge/fts.ts`: FTS5 search infrastructure -- reusable for memory dedup matching
- `src/knowledge/preferences.ts`: `getPreferenceSummaries()` pattern for grouped retrieval -- adapt for memories
- `src/ai/system-prompt.ts`: `buildPreferenceContext()` injection pattern -- replace with memory injection
- `src/bot/handlers/preferences.ts`: `groupPreferences()` and display formatting -- adapt for `/memory` command
- `src/knowledge/token-budget.ts`: Token estimation for injection budget enforcement
- `src/db/migrations.ts`: Migration framework with column addition helpers

### Established Patterns
- Factory functions (`createXxx()`) for all modules
- Raw SQLite for FTS5 queries, Drizzle for schema-defined tables
- Tool handler switch-case in `src/ai/tool-handler.ts`
- Tool definitions in `src/ai/tools.ts` with `allTools` array in `src/pipeline/processor.ts`
- Mini App routes as factory functions in `src/mini-app/routes/`
- Mini App settings cog already exists in the React app

### Integration Points
- `src/ai/tool-handler.ts`: Add cases for save_memory, delete_memory, search_memories; rename update_reminder_settings to update_settings
- `src/ai/tools.ts`: Add tool definitions for new memory tools
- `src/ai/system-prompt.ts`: Replace `buildPreferenceContext()` with memory-based injection
- `src/pipeline/processor.ts`: Update `allTools` array
- `src/db/index.ts`: Initialize memories table
- `src/db/migrations.ts`: Add migration for memories table + reminder_settings rename
- `src/mini-app/router.ts`: Add memory and settings API routes
- Mini App settings page: Add memory list and settings form components

</code_context>

<deferred>
## Deferred Ideas

- Onboarding redesign to be more conversational with memory system (ideation doc open question #5) -- future phase
- Memory decay/pruning for stale facts (ideation doc open question #3) -- future phase
- Cross-household user identity (ideation doc open question #4) -- explicitly not for v1

</deferred>

---

*Phase: 49-sous-memory-system-atomic-facts-settings-table-and-preference-migration*
*Context gathered: 2026-03-05*
