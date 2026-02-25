---
phase: 33-input-validation-security
plan: 02
subsystem: ai
tags: [validation, security, tool-handler, input-bounds]

# Dependency graph
requires:
  - phase: 33-input-validation-security
    provides: "sanitizeAndLog integration in message processor"
provides:
  - "Input bounds validation on all tool handler inputs"
  - "Validation helper functions (validateString, validatePositiveInt, validateArray, validateDay)"
  - "MAX_LENGTHS and MAX_ENTRIES constants for tool input bounds"
affects: [ai, pipeline]

# Tech tracking
tech-stack:
  added: []
  patterns: ["validate-before-process pattern in tool handler case blocks"]

key-files:
  created: []
  modified:
    - "src/ai/tool-handler.ts"
    - "tests/ai/tool-handler.test.ts"

key-decisions:
  - "Validation returns JSON with is_error:true flag to distinguish from normal tool results"
  - "Per-item validation reports the specific array index (e.g. items[3].name)"
  - "Validation helpers are module-private (not exported) to keep the API surface minimal"

patterns-established:
  - "Validate-at-entry: every tool case validates inputs at the top before any processing"
  - "Specific error messages: field name + constraint + actual value for Claude self-correction"

requirements-completed: [SEC-03]

# Metrics
duration: 4min
completed: 2026-02-21
---

# Phase 33 Plan 02: Tool Handler Input Validation Summary

**Bounds validation on all tool handler inputs -- string lengths, array sizes, integer ranges, and per-item checks with specific error messages for Claude self-correction**

## Performance

- **Duration:** 4 min
- **Started:** 2026-02-21T19:33:08Z
- **Completed:** 2026-02-21T19:37:23Z
- **Tasks:** 2
- **Files modified:** 2

## Accomplishments
- Added MAX_LENGTHS and MAX_ENTRIES constants defining bounds for every tool input field
- Created 4 validation helpers (validateString, validatePositiveInt, validateArray, validateDay) plus validationError formatter
- Applied validation to all 18 tool handler cases (15 with inputs, 3 with no inputs to validate)
- Added 15 new tests covering string length, integer range, array size, per-item, day range, and pass-through scenarios

## Task Commits

Each task was committed atomically:

1. **Task 1: Add input validation to tool handler** - `284c77a` (feat)
2. **Task 2: Add validation tests for tool handler** - `143b3d2` (test)

## Files Created/Modified
- `src/ai/tool-handler.ts` - Added validation constants, helpers, and per-case validation at entry point of each tool
- `tests/ai/tool-handler.test.ts` - Added createValidationDeps helper and 15 validation test cases

## Decisions Made
- Validation returns `{ error: "message", is_error: true }` JSON format to distinguish from normal tool results and enable Claude to self-correct
- Per-item array validation reports the specific index (e.g., `items[3].name must be at most 200 characters`) for precise debugging
- Validation helpers are module-private (not exported) since they are implementation details of the tool handler
- Used nullish coalescing chain (`??`) pattern to check multiple validation rules per tool, returning the first error found

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
None

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- Input validation layer complete, ready for Plan 03 (output sanitization / remaining security tasks)
- All existing tests continue to pass alongside new validation tests

## Self-Check: PASSED

All files exist on disk. All commit hashes verified in git history.

---
*Phase: 33-input-validation-security*
*Completed: 2026-02-21*
