---
phase: 49-sous-memory-system
plan: 02
subsystem: ai
tags: [claude-tools, system-prompt, memory, fts5, dedup]

requires:
  - phase: 49-01
    provides: memories table, FTS5 index, CRUD repository, application_settings rename
provides:
  - save_memory/delete_memory/search_memories tool definitions and handlers
  - Memory-based system prompt injection replacing preference injection
  - Inline FTS5 dedup pipeline for save_memory
  - Renamed get_settings/update_settings tools
affects: [49-03-mini-app-memory-ui]

tech-stack:
  added: []
  patterns: [inline FTS5 dedup in tool handler, categorized XML memory injection, memory_instructions prompt]

key-files:
  created: []
  modified:
    - src/ai/tools.ts
    - src/ai/tool-handler.ts
    - src/ai/system-prompt.ts
    - src/ai/tool-status.ts
    - src/pipeline/processor.ts
    - src/onboarding/prompt.ts
    - tests/ai/system-prompt.test.ts

key-decisions:
  - "FTS5 dedup threshold: rank < 5.0 (abs of BM25 score) for strong match detection"
  - "Memory injection uses categorized XML format with id annotations for Claude tool reference"
  - "Soft injection limit of 100 memories with search_memories overflow note"
  - "Onboarding prompt updated to use save_memory instead of save_knowledge for preferences"

patterns-established:
  - "Memory tool handler: inline dedup via FTS5 search before save, returns matches for Claude decision"
  - "Memory injection: grouped by category with [ALLERGY]/[RESTRICTION] hard constraint markers"

requirements-completed: [MEM-03, MEM-04, MEM-05, SET-02]

duration: 8min
completed: 2026-03-06
---

# Phase 49 Plan 02: Tool Integration Summary

**Claude memory tools (save/delete/search) with inline FTS5 dedup, system prompt memory injection replacing preferences, and settings tool rename**

## Performance

- **Duration:** 8 min
- **Started:** 2026-03-06T03:57:01Z
- **Completed:** 2026-03-06T04:04:56Z
- **Tasks:** 2
- **Files modified:** 7

## Accomplishments
- Added MEMORY_TOOLS array with save_memory, delete_memory, search_memories tool definitions
- Implemented save_memory handler with inline FTS5 dedup pipeline (search existing, return matches for Claude to decide ADD/UPDATE/NOOP)
- Replaced buildPreferenceContext with buildMemoryContext using categorized XML format grouped by category
- Renamed get_reminder_settings/update_reminder_settings to get_settings/update_settings throughout tools, handler, status labels
- Added memory_instructions prompt replacing preference_management prompt with proactive saving instructions
- Updated processor to load memories via getMemoriesByHousehold instead of getPreferenceSummaries
- Updated onboarding prompt to use save_memory instead of save_knowledge for preference capture

## Task Commits

Each task was committed atomically:

1. **Task 1: Add memory tool definitions and rename settings tool** - `bc09926` (feat)
2. **Task 2: Implement tool handlers and system prompt memory injection** - `50fbab6` (feat)

## Files Created/Modified
- `src/ai/tools.ts` - Added MEMORY_TOOLS array, renamed settings tools in REMINDER_TOOLS
- `src/ai/tool-handler.ts` - Added save_memory/delete_memory/search_memories handlers, renamed settings handlers
- `src/ai/system-prompt.ts` - Replaced buildPreferenceContext with buildMemoryContext, added memory_instructions prompt
- `src/ai/tool-status.ts` - Updated status labels for renamed and new tools
- `src/pipeline/processor.ts` - Imported MEMORY_TOOLS, swapped preferences for memories
- `src/onboarding/prompt.ts` - Updated to use save_memory and update_settings
- `tests/ai/system-prompt.test.ts` - Updated tests for memory-based API

## Decisions Made
- FTS5 dedup threshold set at rank < 5.0 (absolute BM25 score) -- strong enough to catch near-duplicates without false positives on loosely related facts
- Memory injection includes `(id:N)` annotations so Claude can reference specific memories in update/delete calls
- Soft injection limit of 100 memories with overflow note directing to search_memories tool
- Onboarding prompt updated simultaneously to prevent broken tool references during rollout

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Updated tool status labels for renamed tools**
- **Found during:** Task 1
- **Issue:** tool-status.ts still had get_reminder_settings/update_reminder_settings labels
- **Fix:** Renamed to get_settings/update_settings and added memory tool labels
- **Files modified:** src/ai/tool-status.ts
- **Committed in:** bc09926

**2. [Rule 1 - Bug] Updated onboarding prompt references**
- **Found during:** Task 2
- **Issue:** src/onboarding/prompt.ts referenced update_reminder_settings and save_knowledge for preferences
- **Fix:** Updated to use update_settings and save_memory with correct categories
- **Files modified:** src/onboarding/prompt.ts
- **Committed in:** 50fbab6

**3. [Rule 1 - Bug] Updated test file for new API**
- **Found during:** Task 2
- **Issue:** tests/ai/system-prompt.test.ts used old preferences-based buildDynamicContext API
- **Fix:** Updated tests to use memories-based API
- **Files modified:** tests/ai/system-prompt.test.ts
- **Committed in:** 50fbab6

---

**Total deviations:** 3 auto-fixed (3 bugs -- stale references to renamed tools/APIs)
**Impact on plan:** All auto-fixes necessary for correctness. No scope creep.

## Issues Encountered
None

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- Memory tools fully wired: save_memory with dedup, delete_memory, search_memories
- System prompt injects memories instead of preferences
- Ready for Plan 03 (Mini App memory UI, /memory command, settings views)
- Remaining save_knowledge references in RECIPE_MANAGEMENT_PROMPT and GROCERY_LIST_PROMPT still reference knowledge for recipes (intentional -- recipes stay in knowledge_items)

---
*Phase: 49-sous-memory-system*
*Completed: 2026-03-06*
