---
phase: 01-bot-foundation
plan: 03
subsystem: bot
tags: [telegram, html, formatting, message-splitting, tdd, vitest]

# Dependency graph
requires:
  - phase: 01-01
    provides: "Project scaffolding with TypeScript ESM, directory structure"
  - phase: 01-02
    provides: "Bot instance with handlers, message handler with inline escapeHtml"
provides:
  - "HTML escaping (escapeHtml) and tag filtering (formatBotResponse) for Telegram messages"
  - "Message splitting at natural boundaries (paragraph > line > sentence > word > hard cut)"
  - "Reliable message sender with chunk delays and HTML-to-plain-text fallback"
  - "Full message delivery pipeline: receive -> escape -> split -> send with fallback"
  - "39 passing tests (26 formatter + 13 splitter)"
affects: [02-async-pipeline]

# Tech tracking
tech-stack:
  added: []
  patterns: [TDD red-green cycle for pure functions, priority cascade pattern for split point selection, HTML fallback on GrammyError for resilient delivery]

key-files:
  created:
    - src/telegram/formatter.ts
    - src/telegram/splitter.ts
    - src/telegram/sender.ts
    - tests/telegram/formatter.test.ts
    - tests/telegram/splitter.test.ts
  modified:
    - src/bot/handlers/message.ts

key-decisions:
  - "Ampersand escaped first in escapeHtml chain to prevent double-encoding"
  - "ALLOWED_TAGS Set for O(1) lookup in tag filtering regex"
  - "30% minimum split position (MIN_SPLIT_RATIO) to prevent degenerate tiny first chunks"
  - "Sentence split includes period in first chunk (splitAt = sentenceIdx + 1) for natural reading"
  - "300ms CHUNK_DELAY_MS between message chunks to avoid Telegram rate limits"

patterns-established:
  - "TDD for pure functions: write tests first, stub exports, confirm RED, implement, confirm GREEN"
  - "Priority cascade: try preferred option first, fall through to less preferred options"
  - "Resilient delivery: try HTML, catch GrammyError, fallback to plain text with parse_mode: undefined"
  - "Test directory: tests/ mirrors src/ structure (tests/telegram/ for src/telegram/)"

# Metrics
duration: 3min
completed: 2026-02-06
---

# Phase 1 Plan 3: Message Formatting and Delivery Summary

**TDD-built HTML formatter (escaping + tag filtering), message splitter with natural boundary detection, and reliable sender with HTML fallback -- completing the Phase 1 transport layer**

## Performance

- **Duration:** 3 min 18 sec
- **Started:** 2026-02-06T04:23:23Z
- **Completed:** 2026-02-06T04:26:41Z
- **Tasks:** 3
- **Files created:** 5
- **Files modified:** 1

## Accomplishments

- Built and tested HTML escaping for 4 entities (& < > ") with correct ordering to prevent double-encoding
- Built and tested tag filtering that preserves 12 Telegram-supported HTML tags and strips everything else
- Built and tested message splitter with 5-level priority cascade (paragraph > line > sentence > word > hard cut) and 30% minimum split position
- Created reliable sender with automatic message splitting, 300ms inter-chunk delay, and HTML-to-plain-text fallback on GrammyError
- Wired message handler through the full delivery pipeline, replacing the inline escapeHtml with the shared formatter module
- Established test infrastructure: tests/ directory with 39 passing tests across 2 test suites

## Task Commits

Each task was committed atomically (TDD tasks have RED + GREEN commits):

1. **Task 1 RED: HTML formatter tests** - `210e636` (test)
2. **Task 1 GREEN: HTML formatter implementation** - `7fbef2b` (feat)
3. **Task 2 RED: Message splitter tests** - `d7b0a2c` (test)
4. **Task 2 GREEN: Message splitter implementation** - `35f9cfc` (feat)
5. **Task 3: Sender and message handler wiring** - `28cbb59` (feat)

## Files Created/Modified

- `src/telegram/formatter.ts` - escapeHtml (4 entity replacements) and formatBotResponse (tag whitelist filtering with br replacement)
- `src/telegram/splitter.ts` - splitMessage with priority cascade for natural boundary detection, 30% minimum split position
- `src/telegram/sender.ts` - sendFormattedMessage with chunk splitting, inter-chunk delay, and HTML-to-plain-text GrammyError fallback
- `tests/telegram/formatter.test.ts` - 26 tests covering escapeHtml and formatBotResponse edge cases
- `tests/telegram/splitter.test.ts` - 13 tests covering all split boundary types, 3-way splits, custom maxLength, whitespace trimming
- `src/bot/handlers/message.ts` - Updated to use shared escapeHtml and sendFormattedMessage instead of inline implementation

## Decisions Made

- **Ampersand first in escape chain:** The & character must be escaped before < > " to avoid double-encoding (e.g., "&lt;" becoming "&amp;lt;")
- **Set-based tag whitelist:** ALLOWED_TAGS uses a Set for O(1) lookup when the regex callback checks each tag name
- **30% minimum split position:** Prevents degenerate splits where a break point at position 10 of a 4096-char message would create a tiny first chunk
- **Period stays with first chunk on sentence split:** splitAt = sentenceIdx + 1 keeps the period attached to the sentence that ends, producing natural reading flow
- **300ms chunk delay:** CHUNK_DELAY_MS = 300 provides a conservative delay between message chunks to stay within Telegram's rate limits

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- Phase 1 Bot Foundation is now complete (all 3 plans finished)
- All Phase 1 success criteria are met:
  1. User sends message and gets response (echo) -- from Plan 02
  2. HTML formatting renders cleanly in Telegram -- formatter with tag filtering
  3. Long responses split at natural boundaries -- splitter with priority cascade
  4. Typing indicator shows during processing -- from Plan 02 (autoChatAction plugin)
- 39 tests passing across formatter and splitter modules
- Zero TypeScript errors
- Ready for Phase 2: Async Pipeline and Claude Integration
- No blockers or concerns

## Self-Check: PASSED

---
*Phase: 01-bot-foundation*
*Completed: 2026-02-06*
