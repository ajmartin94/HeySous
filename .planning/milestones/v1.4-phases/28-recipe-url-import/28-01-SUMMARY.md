---
phase: 28-recipe-url-import
plan: 01
subsystem: knowledge, ai
tags: [url-import, cheerio, json-ld, microdata, async-tools, migration]

requires:
  - phase: 26
    provides: dedup check in save_knowledge
provides:
  - Recipe URL import via 3-strategy extraction pipeline
  - Async tool handler supporting Promise-based tool calls
  - source_url column on knowledge_items via migration
  - System prompt instructions for URL import workflow
affects: []

tech-stack:
  added: [cheerio]
  patterns: [3-strategy-extraction, async-tool-handler, pragma-user-version-migration]

key-files:
  created:
    - src/knowledge/url-import.ts
    - tests/knowledge/url-import.test.ts
  modified:
    - src/ai/tool-handler.ts
    - src/ai/claude-client.ts
    - src/ai/tools.ts
    - src/ai/system-prompt.ts
    - src/knowledge/repository.ts
    - src/knowledge/schema.ts
    - src/knowledge/types.ts
    - src/knowledge/fts.ts
    - src/db/migrations.ts
    - src/pipeline/processor.ts
    - tests/ai/tool-handler-dedup.test.ts
    - tests/ai/tool-handler.test.ts

key-decisions:
  - "3-strategy extraction pipeline: JSON-LD first, Microdata second, raw text fallback third"
  - "cheerio for HTML parsing -- lightweight, no headless browser needed"
  - "Async tool handler (string | Promise<string>) -- backward compatible with all sync tools"
  - "source_url stored as nullable TEXT column via PRAGMA user_version migration"
  - "10s fetch timeout and 2MB response cap for safety"
  - "Browser-like User-Agent to avoid basic anti-scraping blocks"

patterns-established:
  - "Async tool handler pattern: handleToolCall returns Promise<string>"
  - "URL import pipeline: fetch -> extract -> present -> confirm -> save"
  - "ISO 8601 duration parsing for recipe time fields"

requirements-completed: [IMPORT-01, IMPORT-03, IMPORT-04, IMPORT-05, IMPORT-06]

duration: 5min
completed: 2026-02-20
---

# Phase 28 Plan 01: Recipe URL Import Summary

**Recipe URL import capability with 3-strategy extraction pipeline, async tool handler, source_url storage, and system prompt instructions**

## Performance

- **Duration:** 5 min
- **Started:** 2026-02-20
- **Completed:** 2026-02-20
- **Tasks:** 3
- **Files modified:** 14 (2 created, 12 modified)

## Accomplishments
- Created url-import.ts with 3-strategy extraction: JSON-LD, Microdata, raw text fallback
- HTTP fetch with 10s timeout, 2MB cap, browser-like User-Agent
- Comprehensive error handling: 403, 404, 402/451 (paywall), timeout, non-HTML content
- ISO 8601 duration parsing (PT1H30M -> "1 hour 30 minutes")
- HTML stripping, title cleaning, instruction normalization
- Made tool handler async (string | Promise<string>) -- all existing sync tools unchanged
- Added import_from_url tool definition with URL parameter
- Added source_url optional parameter to save_knowledge tool
- Added source_url column to knowledge_items via migration 001 (PRAGMA user_version)
- Updated Drizzle schema, TypeScript types, repository, and FTS module for source_url
- Updated claude-client.ts to await Promise.all for async tool results
- Added RECIPE IMPORT section to system prompt with full import workflow instructions
- 32 new tests covering extraction pipeline and normalization helpers
- All existing tests updated for async handleToolCall

## Task Commits

Each task was committed atomically:

1. **Task 1: URL import module, migration, tests** - `ca7b076` (feat)
2. **Task 2: Async tool handler, import_from_url tool, source_url** - `01fe32b` (feat)
3. **Task 3: System prompt RECIPE IMPORT section** - `35f62ab` (feat)

## Files Created/Modified
- `src/knowledge/url-import.ts` - 3-strategy extraction pipeline (JSON-LD, Microdata, raw text)
- `tests/knowledge/url-import.test.ts` - 32 tests for extraction and normalization
- `src/ai/tool-handler.ts` - Async handler, import_from_url case, source_url in save_knowledge
- `src/ai/claude-client.ts` - Async onToolCall callback, Promise.all for parallel tool results
- `src/ai/tools.ts` - import_from_url tool definition, source_url parameter on save_knowledge
- `src/ai/system-prompt.ts` - RECIPE IMPORT section with full workflow instructions
- `src/knowledge/repository.ts` - sourceUrl in create input and insert
- `src/knowledge/schema.ts` - sourceUrl column in Drizzle schema
- `src/knowledge/types.ts` - sourceUrl field in KnowledgeItem interface
- `src/knowledge/fts.ts` - sourceUrl in getFullItem return
- `src/db/migrations.ts` - Migration 001: add source_url column
- `src/pipeline/processor.ts` - Updated local ClaudeClient interface for async callback
- `tests/ai/tool-handler-dedup.test.ts` - All tests updated for async handleToolCall
- `tests/ai/tool-handler.test.ts` - All tests updated for async handleToolCall

## Decisions Made
- JSON-LD is the primary strategy (covers ~80% of recipe sites per Schema.org adoption)
- Microdata is secondary (older sites like some food blogs)
- Raw text fallback gives Claude the first ~4000 chars to parse itself
- No headless browser needed -- cheerio parses static HTML which contains the structured data
- Promise.all used for parallel async tool call resolution (matches existing parallel behavior)

## Deviations from Plan
- Added source_url to Drizzle schema (schema.ts), TypeScript types (types.ts), and FTS module (fts.ts) -- plan mentioned repository.ts but these files also needed updates for type consistency
- Updated local ClaudeClient interface in processor.ts for async callback compatibility

## Issues Encountered
- claude-client.ts needed closing `)` fix for Promise.all wrapping
- fts.ts getFullItem needed sourceUrl in return and source_url in row type interface
- processor.ts local ClaudeClient interface needed async callback type update
- All existing tool handler tests needed async/await updates

## User Setup Required
None -- no external service configuration required. cheerio is a pure JavaScript dependency.

## Next Phase Readiness
- Phase complete, ready for transition to Phase 29 (Recipe Photo Import)
- Async tool handler pattern established for any future async tools
- source_url column ready for use by photo import (Phase 29)

---
*Phase: 28-recipe-url-import*
*Completed: 2026-02-20*
