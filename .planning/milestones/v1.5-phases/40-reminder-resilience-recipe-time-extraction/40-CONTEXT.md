# Phase 40: Reminder Resilience & Recipe Time Extraction - Context

**Gathered:** 2026-02-23
**Status:** Ready for planning

<domain>
## Phase Boundary

Start-cooking reminders fire at the right time by fixing the fragile dependency chain in the reminder generator. Three areas: (1) sensible fallback when recipe time can't be determined, (2) guard against plans saved without recipe linkage, (3) structured time metadata so extraction doesn't depend solely on regex parsing free text. Plus observability to make failures visible.

</domain>

<decisions>
## Implementation Decisions

### Fallback behavior
- Default offset: **45 minutes before dinner time** when recipe prep/cook time cannot be determined
- Dinner-only: only applies to `start_cooking` reminders for dinner entries — no over-engineering for other meal types
- No floor on early reminders: trust the math — if a recipe genuinely takes 4 hours, fire 4 hours before dinner
- No change to reminder message when fallback is used: send normally, user doesn't need to know the system couldn't find exact times

### Plan-recipe linking guard
- **Non-blocking warning**: when Claude saves a meal plan entry without `knowledge_item_id` for a recipe name that matches a knowledge base item, the save succeeds but the tool response includes a warning
- Match method: **FTS search** on recipe name against knowledge base (broader recall than exact match)
- Warning includes matched knowledge item IDs and titles so Claude can immediately retry: e.g., `"unlinked_recipes": [{"name": "Chicken Parmesan", "match_id": 42, "match_title": "Chicken Parmesan"}]`
- Also **log server-side** at info level when unlinked recipe matches are found (track how often Claude misses linking)

### Structured time storage
- Add **three nullable INTEGER columns** to `knowledge_items`: `prep_time_minutes`, `cook_time_minutes`, `total_time_minutes`
- **Backfill on migration**: run `parseRecipeTotalMinutes` on all existing recipe content at startup/migration to populate columns
- **Auto-extract with override**: tool handler auto-parses content to fill time columns on save/update, but Claude can pass explicit `prep_time`, `cook_time`, `total_time` parameters that take precedence
- Reminder generator lookup priority: **structured columns first** → content parsing fallback → 45-minute default

### Observability
- Replace silent `catch {}` with `catch(err) { logger.error(...) }` — DB failures and other errors get their own error-level log
- Fallback to 45-minute default: **log at info level** with recipe name, household ID, and reason (no knowledgeItemId, no content, parse failed, etc.)
- No log on happy path (structured time found and used) — only log fallbacks
- Unlinked recipe warning: logged server-side at info level in addition to the tool response

### Claude's Discretion
- FTS search query construction for recipe name matching
- Exact migration script approach for adding columns and backfilling
- How to handle `total_time_minutes` when only prep or cook is available (sum vs store individually)

</decisions>

<specifics>
## Specific Ideas

- The current code at `src/reminders/generator.ts:269` defaults to `settings.dinnerTime` — the fix changes this to `dinnerTime - 45 minutes`
- The `parseRecipeTotalMinutes` function at `src/reminders/generator.ts:55` should remain as-is for the content-parsing fallback layer
- The non-blocking warning pattern follows the existing `duplicate_found` pattern in `save_knowledge` — return success with advisory data
- Backfill migration should be idempotent (safe to re-run) since it only fills null columns

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope

</deferred>

---

*Phase: 40-reminder-resilience-recipe-time-extraction*
*Context gathered: 2026-02-23*
