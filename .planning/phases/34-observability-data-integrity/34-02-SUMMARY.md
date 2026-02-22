---
phase: 34-observability-data-integrity
plan: 02
subsystem: ai
tags: [model-pricing, recipe-validation, data-integrity, cost-tracking]

# Dependency graph
requires:
  - phase: 33-input-validation-security
    provides: Input validation patterns and validationError helper
provides:
  - MODEL_PRICING with Sonnet 4, Opus 4, and fallback entries
  - Recipe completeness validation in save_knowledge handler
  - System prompt guidance for incomplete recipe handling
affects: [ai, knowledge, pipeline]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Fallback pricing pattern for unknown model IDs"
    - "Content structure validation for domain-specific items (recipes)"

key-files:
  created: []
  modified:
    - src/ai/types.ts
    - src/ai/claude-client.ts
    - src/ai/tool-handler.ts
    - src/ai/system-prompt.ts
    - tests/ai/tool-handler.test.ts
    - tests/ai/tool-handler-dedup.test.ts

key-decisions:
  - "Used Haiku pricing as _fallback for unknown models (conservative baseline)"
  - "Recipe validation checks for Ingredients:/Steps: headers with content patterns"
  - "Validation returns incomplete_recipe flag so Claude can ask user for missing fields"

patterns-established:
  - "Fallback pricing: MODEL_PRICING._fallback ensures cost tracking never returns 0 for unknown models"
  - "Content validation: validateRecipeCompleteness validates domain content structure before save"

requirements-completed: [OBS-03, DATA-01]

# Metrics
duration: 3min
completed: 2026-02-22
---

# Phase 34 Plan 02: Model Pricing & Recipe Validation Summary

**Sonnet/Opus model pricing with fallback for unknown IDs, plus recipe completeness validation rejecting saves missing title/ingredients/instructions**

## Performance

- **Duration:** 3 min
- **Started:** 2026-02-22T02:27:26Z
- **Completed:** 2026-02-22T02:30:49Z
- **Tasks:** 2
- **Files modified:** 6

## Accomplishments
- MODEL_PRICING now covers Haiku 4.5, Sonnet 4, and Opus 4 with _fallback for unknown models
- calculateCost returns non-zero estimates for unrecognized model IDs via fallback pricing
- save_knowledge validates recipe completeness (title, ingredients, instructions) for items tagged "recipe"
- System prompt instructs Claude to ask users for missing recipe fields and save partial after one round
- 6 new test cases cover recipe validation accept/reject scenarios

## Task Commits

Each task was committed atomically:

1. **Task 1: Update MODEL_PRICING with Sonnet, Opus, and fallback** - `c5c446c` (feat)
2. **Task 2: Add recipe completeness validation to save_knowledge and update system prompt** - `e67496f` (feat)
3. **Fix: Update dedup test data for recipe validation compatibility** - `a253540` (fix)

## Files Created/Modified
- `src/ai/types.ts` - Added Sonnet 4, Opus 4, and _fallback entries to MODEL_PRICING
- `src/ai/claude-client.ts` - Updated calculateCost to use fallback pricing for unknown models
- `src/ai/tool-handler.ts` - Added validateRecipeCompleteness function and validation check in save_knowledge
- `src/ai/system-prompt.ts` - Added incomplete_recipe handling guidance in recipe creation and import sections
- `tests/ai/tool-handler.test.ts` - Added 6 recipe completeness validation tests
- `tests/ai/tool-handler-dedup.test.ts` - Updated recipe test data to include valid Ingredients/Steps content

## Decisions Made
- Used Haiku pricing as _fallback for unknown models -- conservative baseline that avoids overestimating costs
- Recipe validation checks for "Ingredients:" header followed by "- " list items and "Steps:" header followed by numbered steps
- Validation returns `incomplete_recipe: true` flag alongside `is_error: true` so Claude can distinguish validation issues from system errors

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Updated dedup test data to pass recipe validation**
- **Found during:** Task 2 verification (full test suite run)
- **Issue:** Existing dedup tests used content like "New recipe..." with tags: ["recipe"], which now fails recipe completeness validation
- **Fix:** Updated all recipe-tagged test content to include proper Ingredients/Steps structure
- **Files modified:** tests/ai/tool-handler-dedup.test.ts
- **Verification:** All 218 tests pass
- **Committed in:** a253540

---

**Total deviations:** 1 auto-fixed (1 bug fix)
**Impact on plan:** Auto-fix was necessary to maintain test compatibility with new validation. No scope creep.

## Issues Encountered
None

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- Recipe validation foundation ready for any future content quality improvements
- Cost tracking now covers all deployed model families
- No blockers for subsequent phases

---
*Phase: 34-observability-data-integrity*
*Completed: 2026-02-22*
