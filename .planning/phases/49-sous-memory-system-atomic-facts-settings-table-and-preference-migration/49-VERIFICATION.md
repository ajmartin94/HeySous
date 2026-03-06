---
phase: 49-sous-memory-system
verified: 2026-03-06T04:30:00Z
status: gaps_found
score: 11/12 must-haves verified
gaps:
  - truth: "The reminder_settings table is renamed to application_settings everywhere"
    status: partial
    reason: "Live SQL query in src/bot/handlers/plan.ts still references reminder_settings (line 118). This will fail at runtime since the table was renamed to application_settings in migration v9."
    artifacts:
      - path: "src/bot/handlers/plan.ts"
        issue: "Line 118: SELECT timezone FROM reminder_settings WHERE household_id = ? -- should be application_settings"
    missing:
      - "Update the SQL query in src/bot/handlers/plan.ts line 118 to use application_settings instead of reminder_settings"
---

# Phase 49: Sous Memory System Verification Report

**Phase Goal:** Replace the preference-as-knowledge-item system with a dedicated memories table for atomic facts, rename reminder_settings to application_settings, add Claude tools for memory CRUD with dedup, migrate existing preferences, and add memory/settings views to the Mini App
**Verified:** 2026-03-06T04:30:00Z
**Status:** gaps_found
**Re-verification:** No -- initial verification

## Goal Achievement

### Observable Truths

| #  | Truth | Status | Evidence |
|----|-------|--------|----------|
| 1  | A memories table exists with columns: id, household_id, content, category, created_at, updated_at | VERIFIED | `src/memory/schema.ts` defines full Drizzle schema with all columns; migration v9 in `src/db/migrations.ts` creates DDL |
| 2  | An FTS5 virtual table exists for full-text search over memories | VERIFIED | `src/memory/fts.ts` creates `memories_fts` with external content mode, INSERT/UPDATE/DELETE triggers, and BM25 search |
| 3  | The reminder_settings table is renamed to application_settings | PARTIAL | Migration v9 renames table. `src/reminders/init.ts`, `schema.ts`, `repository.ts`, `context.ts` all updated. BUT `src/bot/handlers/plan.ts:118` still queries `reminder_settings` |
| 4  | Existing preference-tagged knowledge_items are migrated into the memories table | VERIFIED | Migration v10 queries preference-tagged items, maps categories, preserves severity markers, deletes migrated rows |
| 5  | Recipes in knowledge_items remain untouched after migration | VERIFIED | Migration v10 explicitly `if (tags.includes("recipe")) continue;` |
| 6  | Claude can save atomic facts via the save_memory tool | VERIFIED | `MEMORY_TOOLS` in `tools.ts` defines save_memory; `tool-handler.ts:1287` implements with dedup via FTS5 search |
| 7  | Claude can delete memories via the delete_memory tool | VERIFIED | `tool-handler.ts:1365` handles delete_memory calling `deleteMemory()` |
| 8  | Claude can search memories via the search_memories tool | VERIFIED | `tool-handler.ts:1384` handles search_memories calling `searchMemoryFts()` |
| 9  | The update_reminder_settings tool is renamed to update_settings | VERIFIED | `tools.ts` REMINDER_TOOLS uses `get_settings`/`update_settings`; tool-handler.ts cases match |
| 10 | System prompt injects memories instead of preferences from knowledge_items | VERIFIED | `system-prompt.ts` has `buildMemoryContext()` with `<user_memories>` XML; processor.ts calls `getMemoriesByHousehold()` and passes to `buildDynamicContext()` |
| 11 | The /memory command displays all memories grouped by category | VERIFIED | `src/bot/handlers/memory.ts` groups by category, formats as HTML with headers; handles both /memory and /preferences |
| 12 | The Mini App settings page shows Memory and Settings sections | VERIFIED | `mini-app/src/pages/Settings.tsx` renders Memory section (grouped list with X delete buttons) and Meal Times section (time inputs + toggles + debounced save) |

**Score:** 11/12 truths verified (1 partial)

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `src/memory/schema.ts` | Drizzle schema for memories table | VERIFIED | 65 lines, exports `memories`, `MemoryCategory`, `Memory` |
| `src/memory/repository.ts` | CRUD functions | VERIFIED | Exports saveMemory, updateMemory, deleteMemory, getMemoriesByHousehold, getMemoryById |
| `src/memory/fts.ts` | FTS5 initialization and search | VERIFIED | Exports initializeMemoryFts, searchMemoryFts with LIKE fallback |
| `src/db/migrations.ts` | Migration v9 and v10 | VERIFIED | v9 creates memories table + renames settings; v10 migrates preferences |
| `src/ai/tools.ts` | MEMORY_TOOLS array | VERIFIED | 3 tools: save_memory, delete_memory, search_memories |
| `src/ai/tool-handler.ts` | Handler cases for memory tools | VERIFIED | All 3 cases implemented with dedup logic |
| `src/ai/system-prompt.ts` | Memory injection replacing preferences | VERIFIED | buildMemoryContext with categorized XML + memory_instructions prompt |
| `src/bot/handlers/memory.ts` | /memory command handler | VERIFIED | createMemoryHandler with /memory + /preferences dual registration |
| `src/mini-app/routes/memory.ts` | GET/DELETE memory endpoints | VERIFIED | createMemoryRoutes with getAll and deleteOne |
| `src/mini-app/routes/settings.ts` | GET/PUT settings endpoints | VERIFIED | createSettingsRoutes with getSettings and updateSettings against application_settings |
| `mini-app/src/pages/Settings.tsx` | Settings page with Memory + Settings + Appearance sections | VERIFIED | Three sections with proper data fetching, optimistic delete, debounced save |

### Key Link Verification

| From | To | Via | Status | Details |
|------|----|-----|--------|---------|
| `src/db/index.ts` | `src/memory/fts.ts` | initializeMemoryFts call | WIRED | Line 48: `initializeMemoryFts(sqlite)` after knowledge FTS init |
| `src/db/schema.ts` | `src/memory/schema.ts` | re-export | WIRED | Line 57: `export { memories } from "../memory/schema.js"` |
| `src/ai/tool-handler.ts` | `src/memory/repository.ts` | saveMemory/deleteMemory imports | WIRED | Line 19: imports saveMemory, updateMemory, deleteMemory, getMemoryById |
| `src/ai/tool-handler.ts` | `src/memory/fts.ts` | searchMemoryFts import | WIRED | Line 20: imports searchMemoryFts |
| `src/ai/system-prompt.ts` | memories data | buildMemoryContext function | WIRED | Line 59: buildMemoryContext accepts and formats memory entries |
| `src/pipeline/processor.ts` | `src/ai/tools.ts` | MEMORY_TOOLS in allTools | WIRED | Line 25: imports MEMORY_TOOLS; Line 479: spread into allTools array |
| `src/pipeline/processor.ts` | `src/memory/repository.ts` | getMemoriesByHousehold | WIRED | Line 44: import; Line 360: called to load memories for prompt |
| `src/bot/handlers/memory.ts` | `src/memory/repository.ts` | getMemoriesByHousehold | WIRED | Line 13: import; Line 79: called in command handler |
| `src/mini-app/routes/memory.ts` | `src/memory/repository.ts` | getMemoriesByHousehold/deleteMemory | WIRED | Lines 4-6: imports both functions |
| `src/mini-app/router.ts` | `src/mini-app/routes/memory.ts` | createMemoryRoutes | WIRED | Line 11: import; Lines 64-66: registered as /memories routes |
| `src/mini-app/router.ts` | `src/mini-app/routes/settings.ts` | createSettingsRoutes | WIRED | Line 12: import; Lines 69-71: registered as /settings routes |
| `src/main.ts` | `src/bot/handlers/memory.ts` | createMemoryHandler | WIRED | Line 26: import; Line 179: instantiated; Line 197: passed to createBot |
| `src/bot/index.ts` | memoryHandler | middleware chain | WIRED | Line 101: `bot.use(memoryHandler)` |

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|-----------|-------------|--------|----------|
| MEM-01 | 49-01 | Memories table with schema | SATISFIED | Schema, migration v9, FTS5 all verified |
| MEM-02 | 49-01 | FTS5 search index | SATISFIED | memories_fts with external content, triggers, BM25 search |
| MEM-03 | 49-02 | save_memory tool | SATISFIED | Tool definition + handler with dedup pipeline |
| MEM-04 | 49-02 | delete_memory tool | SATISFIED | Tool definition + handler |
| MEM-05 | 49-02 | search_memories tool | SATISFIED | Tool definition + handler |
| MEM-06 | 49-03 | /memory bot command | SATISFIED | Handler with /memory + /preferences alias |
| MEM-07 | 49-03 | Mini App memory view | SATISFIED | Settings page Memory section with grouped display + delete |
| SET-01 | 49-01 | reminder_settings renamed to application_settings | PARTIALLY SATISFIED | Migration + most references updated, but src/bot/handlers/plan.ts:118 still uses old name |
| SET-02 | 49-02 | Tools renamed to get_settings/update_settings | SATISFIED | Both tools.ts definitions and tool-handler.ts cases use new names |
| SET-03 | 49-03 | Mini App settings view | SATISFIED | Settings page with timezone, time inputs, toggles, debounced save |

**Note:** Requirements MEM-01 through SET-03 are not present in REQUIREMENTS.md (which only covers v1.6 requirements). These are phase-internal requirements defined in the plan frontmatter. No orphaned requirements detected.

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| `src/bot/handlers/plan.ts` | 118 | References `reminder_settings` table (renamed to `application_settings`) | BLOCKER | /plan command will fail at runtime when querying timezone |
| `src/bot/handlers/preferences.ts` | - | Dead code: entire file still exists with old preference logic | INFO | Not imported anywhere, harmless dead code |

### Human Verification Required

### 1. Memory Display in Mini App

**Test:** Open the Settings page in the Mini App and verify the Memory section renders correctly
**Expected:** Memories grouped by category with readable labels, each with a working delete (X) button
**Why human:** Visual layout, spacing, and touch target sizing cannot be verified programmatically

### 2. Settings Auto-Save

**Test:** Change a meal time or toggle in the Mini App Settings and verify the "Saved" message appears
**Expected:** After 500ms debounce, "Saved" appears for 2 seconds, and reloading the page shows the persisted value
**Why human:** Debounce timing and visual feedback require interactive testing

### 3. Memory Dedup Behavior

**Test:** Tell Sous something it already knows (e.g., repeat an allergy) and verify dedup triggers
**Expected:** save_memory tool fires, FTS5 finds match, Claude decides NOOP or UPDATE rather than creating duplicate
**Why human:** Claude's decision-making on dedup matches requires live AI interaction

### Gaps Summary

One gap blocks full goal achievement: `src/bot/handlers/plan.ts` line 118 still queries the `reminder_settings` table which was renamed to `application_settings` in migration v9. This will cause a runtime SQL error when users use the `/plan` command, as SQLite will report "no such table: reminder_settings". This is a single-line fix (change table name in the SQL string).

The old `src/bot/handlers/preferences.ts` file remains as dead code. While not a blocker, it could be cleaned up.

---

_Verified: 2026-03-06T04:30:00Z_
_Verifier: Claude (gsd-verifier)_
