---
phase: 35-resilience
plan: 03
subsystem: pipeline
tags: [context-window, token-estimation, truncation, graceful-degradation, resilience]

# Dependency graph
requires:
  - phase: 35-resilience
    provides: retryWithBackoff and onRetry callback pattern in processor
provides:
  - ConversationContextResult interface with wasTruncated truncation metadata
  - estimateMessageTokens utility for full Anthropic message array token estimation
  - Pre-call context window overflow detection at 80% of 200K threshold
  - Automatic oldest-first message trimming when context approaches limit
  - conversation_note XML tag injection for Claude truncation awareness
affects: [pipeline, conversation, knowledge]

# Tech tracking
tech-stack:
  added: []
  patterns: [context overflow detection with threshold-based trimming, truncation notice injection via dynamic system prompt context]

key-files:
  created: []
  modified:
    - src/conversation/context-builder.ts
    - src/knowledge/token-budget.ts
    - src/pipeline/processor.ts

key-decisions:
  - "wasTruncated flag distinguishes budget-limited trimming from session boundary gaps -- session gaps are intentional, not truncation"
  - "80% threshold (160K tokens) triggers proactive trimming before hitting the hard 200K context window limit"
  - "Truncation notice uses <conversation_note> XML tag in dynamic context -- Claude can parse it but user never sees it"
  - "Current user message always preserved even after trimming all conversation history"

patterns-established:
  - "Context overflow detection pattern: estimate before call, trim oldest-first, inject notice, proceed"
  - "ConversationContextResult interface: functions returning message arrays can include metadata about truncation"

requirements-completed: [RES-03, RES-04]

# Metrics
duration: 4min
completed: 2026-02-22
---

# Phase 35 Plan 03: Context Window Overflow Summary

**Pre-call context window overflow detection with oldest-first message trimming and invisible truncation notice injection for Claude**

## Performance

- **Duration:** 4 min
- **Started:** 2026-02-22T22:17:54Z
- **Completed:** 2026-02-22T22:21:33Z
- **Tasks:** 2
- **Files modified:** 3

## Accomplishments
- buildConversationContext returns ConversationContextResult with wasTruncated, originalTurnCount, and includedTurnCount metadata
- estimateMessageTokens utility handles string content, content block arrays, and image blocks (flat 1000 token estimate per image)
- Processor estimates total tokens (system prompt + dynamic context + messages) before Claude API call
- When estimated tokens exceed 80% of 200K context window, oldest conversation messages are trimmed
- Truncation notice injected as `<conversation_note>` XML tag in dynamic system prompt context
- Claude continues naturally without mentioning truncation to the user

## Task Commits

Each task was committed atomically:

1. **Task 1: Add truncation metadata to context builder and token estimation** - `f3af938` (feat)
2. **Task 2: Wire context overflow detection and truncation notice into processor** - `792292e` (feat)

## Files Created/Modified
- `src/conversation/context-builder.ts` - Added ConversationContextResult interface; wasTruncated flag tracks budget-limited truncation vs session boundary gaps
- `src/knowledge/token-budget.ts` - Added estimateMessageTokens utility for full Anthropic MessageParam[] token estimation
- `src/pipeline/processor.ts` - Added CONTEXT_WINDOW_TOKENS/CONTEXT_TRIM_THRESHOLD constants; pre-call token estimation; oldest-first trimming loop; truncation notice injection; structured logging

## Decisions Made
- wasTruncated only tracks budget-limited truncation, not session boundary gaps (session gaps are intentional architecture, not truncation)
- 80% threshold chosen as proactive buffer before the hard 200K limit
- Truncation notice uses `<conversation_note>` XML tag that Claude can parse but user never sees
- Current user message is always preserved even when all history is trimmed
- Image blocks estimated at flat 1000 tokens each (actual counting is model-dependent and harder to estimate)

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
None.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness
- Context window overflow protection is in place for long conversations
- Combined with 429 retry (35-01) and optimistic locking (35-02), the resilience layer is complete
- Phase 35 is fully implemented

## Self-Check: PASSED

All files exist, all commits found, all key functions verified in correct files.

---
*Phase: 35-resilience*
*Completed: 2026-02-22*
