---
phase: 22-recipe-variations-grocery-intelligence
plan: 03
subsystem: ai
tags: [tool-handler, validation, system-prompt, tool-description]

# Dependency graph
requires:
  - phase: 22-recipe-variations-grocery-intelligence
    provides: "Recipe variation in-place update flow and knowledge tools"
provides:
  - "Validation guard rejecting update_knowledge no-op calls"
  - "Strengthened tool description warning about substantive field requirement"
  - "Explicit system prompt directive to always include content field"
affects: [ai-tools, recipe-management, knowledge-updates]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Pre-DB validation guard in tool handler for input completeness"

key-files:
  created: []
  modified:
    - src/ai/tool-handler.ts
    - src/ai/tools.ts
    - src/ai/system-prompt.ts
    - tests/ai/tool-handler.test.ts

key-decisions:
  - "Validation guard placed before DB access to avoid unnecessary getById call on invalid input"
  - "Error message includes remediation guidance directing Claude to use get_knowledge_item first"

patterns-established:
  - "Tool handler validates substantive input before any database access"

requirements-completed: [AIBH-04]

# Metrics
duration: 2min
completed: 2026-02-19
---

# Phase 22 Plan 03: update_knowledge No-Op Bug Fix Summary

**Validation guard rejects update_knowledge calls with no substantive fields, plus strengthened tool description and system prompt to prevent Claude from omitting content field**

## Performance

- **Duration:** 2 min
- **Started:** 2026-02-19T04:50:26Z
- **Completed:** 2026-02-19T04:53:03Z
- **Tasks:** 2
- **Files modified:** 4

## Accomplishments
- Added validation guard in update_knowledge handler that rejects calls with only id and change_description (no title/summary/content/tags), returning descriptive error before any DB access
- Strengthened update_knowledge tool description to explicitly warn that id + change_description alone will be rejected
- Updated RECIPE_VARIATIONS_PROMPT in system prompt to instruct Claude to always provide the full updated content field when modifying recipes
- Added 2 new tests: no-op rejection test and valid content update test

## Task Commits

Each task was committed atomically:

1. **Task 1: Add validation guard and test for update_knowledge no-op rejection** - `f7d34c4` (fix)
2. **Task 2: Strengthen tool description and system prompt to prevent no-op calls** - `c9d6780` (feat)

## Files Created/Modified
- `src/ai/tool-handler.ts` - Added validation guard before DB access in update_knowledge case
- `src/ai/tools.ts` - Updated update_knowledge description to warn about required substantive fields
- `src/ai/system-prompt.ts` - Updated RECIPE_VARIATIONS_PROMPT steps to mandate content field inclusion
- `tests/ai/tool-handler.test.ts` - Added describe block with no-op rejection and valid update tests

## Decisions Made
- Validation guard placed before DB access to avoid unnecessary getById call on invalid input
- Error message includes remediation guidance directing Claude to use get_knowledge_item first, then provide full updated content

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
None

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- update_knowledge bug is fully patched at three layers: runtime guard, tool description, and behavioral prompt
- All existing tests continue to pass alongside 2 new tests

## Self-Check: PASSED

All 4 modified files exist on disk. Both task commits (f7d34c4, c9d6780) verified in git log.

---
*Phase: 22-recipe-variations-grocery-intelligence*
*Completed: 2026-02-19*
