---
phase: 26-knowledge-dedup
plan: 01
subsystem: ai
tags: [knowledge, dedup, fts5, tools, system-prompt]

requires:
  - phase: none
    provides: existing FTS5 search infrastructure
provides:
  - Duplicate detection in save_knowledge tool handler
  - Input validation in update_knowledge tool handler
  - System prompt instructions for dedup handling
affects: [phase-28-recipe-url-import, phase-29-recipe-photo-import]

tech-stack:
  added: []
  patterns: [tool-level-dedup-with-fts5, skip-dedup-bypass-parameter]

key-files:
  created:
    - tests/ai/tool-handler-dedup.test.ts
  modified:
    - src/ai/tool-handler.ts
    - src/ai/tools.ts
    - src/ai/system-prompt.ts

key-decisions:
  - "Dedup happens inside the tool handler, not in Claude's reasoning -- tool returns match info for Claude to present"
  - "BM25 relevance threshold of -5 used for close match detection (title-weighted search)"
  - "skip_dedup parameter allows Claude to bypass after user says 'save as new'"
  - "update_knowledge validation rejects calls with only id or id+change_description"

patterns-established:
  - "Tool-level dedup: check before create, return match info, let Claude handle UX"
  - "skip_dedup bypass: tool parameter for explicit user override"

requirements-completed: [KNOW-01, KNOW-02, KNOW-03, KNOW-04]

duration: 2min
completed: 2026-02-20
---

# Phase 26 Plan 01: Knowledge Dedup Summary

**FTS5-based duplicate detection in save_knowledge with skip_dedup bypass, update_knowledge input validation, and system prompt dedup handling instructions**

## Performance

- **Duration:** 2 min
- **Started:** 2026-02-20T05:20:27Z
- **Completed:** 2026-02-20T05:23:22Z
- **Tasks:** 2
- **Files modified:** 4

## Accomplishments
- save_knowledge searches FTS5 for similar titles before creating, returns match info to Claude
- Exact case-insensitive title matches always flagged as potential duplicates
- Close FTS5 matches flagged by BM25 relevance threshold (-5)
- skip_dedup parameter lets Claude bypass dedup when user explicitly says "save as new"
- update_knowledge rejects calls with no substantive fields (only id or id+change_description)
- System prompt DUPLICATE DETECTION section instructs Claude to present matches conversationally
- 8 new tests covering dedup detection, bypass, preferences, and update validation

## Task Commits

Each task was committed atomically:

1. **Task 1: Add dedup to save_knowledge and validation to update_knowledge** - `76fcd0d` (feat)
2. **Task 2: Update system prompt with dedup instructions** - `b8c0b34` (feat)

## Files Created/Modified
- `src/ai/tool-handler.ts` - Dedup check in save_knowledge, validation in update_knowledge
- `src/ai/tools.ts` - Added skip_dedup parameter to save_knowledge input_schema
- `src/ai/system-prompt.ts` - DUPLICATE DETECTION section and preference saving note
- `tests/ai/tool-handler-dedup.test.ts` - 8 tests for dedup and validation

## Decisions Made
- Used existing FTS5 searchFts function for dedup (no new search mechanism needed)
- BM25 threshold of -5 for close match detection (title-weighted, empirically reasonable)
- Dedup is best-effort: if FTS5 search fails, save proceeds normally

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
None

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- Phase complete, ready for transition
- Dedup pattern established for future import phases (28, 29) which will also use save_knowledge

---
*Phase: 26-knowledge-dedup*
*Completed: 2026-02-20*
