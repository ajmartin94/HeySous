---
phase: 34-observability-data-integrity
plan: 01
subsystem: observability
tags: [pino, logging, error-sanitization, tool-instrumentation]

# Dependency graph
requires:
  - phase: 33-input-validation-security
    provides: "Validated tool inputs and sanitized user content"
provides:
  - "Instrumented tool call wrapper with structured Pino logging"
  - "Error sanitization for tool results returned to Claude"
  - "LOG_TOOL_INPUTS config toggle for verbose success logging"
affects: [34-02, observability, pipeline]

# Tech tracking
tech-stack:
  added: []
  patterns: ["Instrumented wrapper pattern for tool call observability", "Two-tier error sanitization (descriptive for Claude, generic for users)"]

key-files:
  created:
    - tests/pipeline/processor-tools.test.ts
  modified:
    - src/pipeline/processor.ts
    - src/ai/claude-client.ts
    - src/config.ts

key-decisions:
  - "Tool inputs logged on error always, on success only with LOG_TOOL_INPUTS=true -- balances debuggability vs log volume"
  - "sanitizeToolError strips stack traces, file paths, and SQL via regex -- keeps descriptive error context for Claude self-correction while hiding internals"

patterns-established:
  - "createInstrumentedToolHandler: wrap any tool handler with structured logging and timing"
  - "sanitizeToolError: centralized error sanitization before returning to LLM"

requirements-completed: [OBS-01, OBS-02]

# Metrics
duration: 3min
completed: 2026-02-22
---

# Phase 34 Plan 01: Tool Call Instrumentation Summary

**Structured Pino logging for every tool call (name, duration, household, status) with regex-based error sanitization stripping stack traces, file paths, and SQL from Claude-facing tool results**

## Performance

- **Duration:** 3 min
- **Started:** 2026-02-22T02:27:19Z
- **Completed:** 2026-02-22T02:30:52Z
- **Tasks:** 2
- **Files modified:** 4

## Accomplishments
- Every tool call through the pipeline now produces a structured Pino log entry with tool_name, duration_ms, household_id, and success/error status
- Error messages returned to Claude via tool_result blocks are sanitized of stack traces, file paths, and SQL statements
- LOG_TOOL_INPUTS env var toggles full input logging on successful calls (always logged on errors)
- 17 new tests covering instrumentation logging, input toggling, duration tracking, and error sanitization

## Task Commits

Each task was committed atomically:

1. **Task 1: Add instrumented tool call wrapper and error sanitization** - `3fd5c3c` (feat)
2. **Task 2: Add tests for tool call instrumentation and error sanitization** - `bdfe665` (test)

## Files Created/Modified
- `src/pipeline/processor.ts` - Added createInstrumentedToolHandler wrapper, replaced raw handleToolCall in both call sites
- `src/ai/claude-client.ts` - Added sanitizeToolError helper, updated tool result catch block to sanitize errors
- `src/config.ts` - Added logToolInputs boolean config from LOG_TOOL_INPUTS env var
- `tests/pipeline/processor-tools.test.ts` - 17 tests for instrumentation and sanitization

## Decisions Made
- Tool inputs logged on error always, on success only with LOG_TOOL_INPUTS=true -- balances debuggability vs log volume in production
- sanitizeToolError uses regex replacement for stack traces, file paths, and SQL -- simple, maintainable, covers the common internal detail patterns

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
None.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness
- Tool call observability foundation complete
- Ready for 34-02 (token usage & cost tracking enhancements)

## Self-Check: PASSED

All files verified present. All commits verified in git log.

---
*Phase: 34-observability-data-integrity*
*Completed: 2026-02-22*
