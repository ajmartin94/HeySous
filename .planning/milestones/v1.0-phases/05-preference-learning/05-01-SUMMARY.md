---
phase: 05-preference-learning
plan: 01
subsystem: knowledge-preferences
tags: [preferences, system-prompt, pipeline, knowledge-retrieval]
dependency-graph:
  requires: [03-knowledge-system, 04-recipe-knowledge]
  provides: [preference-retrieval, preference-aware-system-prompt, preference-management-instructions]
  affects: [05-02-preference-refinement]
tech-stack:
  added: []
  patterns: [preference-injection-via-system-prompt, tag-based-preference-retrieval, backward-compatible-parameter-extension]
key-files:
  created:
    - src/knowledge/preferences.ts
  modified:
    - src/ai/system-prompt.ts
    - src/ai/claude-client.ts
    - src/pipeline/processor.ts
    - src/ai/tools.ts
decisions:
  - "Preferences retrieved via raw SQLite JOIN (same pattern as fts.ts) -- not Drizzle"
  - "System prompt always includes preference_management instructions even when no preferences exist"
  - "Preference context injected after recipe_management section, preserving existing prompt structure"
  - "Claude client systemPrompt parameter is optional with fallback to buildSystemPrompt() for backward compatibility"
  - "Preference markers: [ALLERGY] for severity:allergy, [RESTRICTION] for severity:restriction, [inferred] for inferred"
metrics:
  duration: 5 min
  completed: 2026-02-07
---

# Phase 5 Plan 1: Preference Retrieval and System Prompt Injection Summary

Preference-aware pipeline with tag-based retrieval, system prompt injection with [ALLERGY]/[RESTRICTION]/[inferred] markers, and always-present preference management instructions teaching Claude to detect, save, apply, update, and delete preferences.

## What Was Done

### Task 1: Preference retrieval function and system prompt extension
- Created `src/knowledge/preferences.ts` with `getPreferenceSummaries()` function using efficient SQL JOIN query on `knowledge_items` + `knowledge_tags` tables filtered by `preference` tag
- Exported `PreferenceSummary` interface (id, title, summary, tags)
- Extended `buildSystemPrompt()` to accept optional `preferences` parameter (backward compatible -- no args still works)
- Added `buildPreferenceContext()` that formats preferences with severity markers: `[ALLERGY]`, `[RESTRICTION]`, `[inferred]`
- Added `PREFERENCE_MANAGEMENT_PROMPT` constant with comprehensive instructions for preference lifecycle (detect, save, apply, update, delete, present, infer)
- Preference management instructions are ALWAYS appended to system prompt, even when no preferences exist yet

### Task 2: Claude client parameter extension and processor integration
- Added optional `systemPrompt` parameter to both `sendMessage()` and `sendMessageWithTools()` in claude-client.ts
- Uses `systemPrompt ?? buildSystemPrompt()` pattern for backward compatibility
- Updated `ClaudeClient` interface in processor.ts to match new signatures
- Processor now loads preferences via `getPreferenceSummaries(deps.sqlite, chatId)` before every Claude call
- Processor builds system prompt via `buildSystemPrompt(preferences)` and passes to both initial and retry Claude calls
- Updated `save_knowledge` tool description in tools.ts to include preference tagging guidance (domain, subject, severity tags)

## Decisions Made

| Decision | Rationale |
|----------|-----------|
| Raw SQLite for preference queries (not Drizzle) | Matches existing fts.ts pattern; Drizzle doesn't support FTS5 JOINs well |
| Always-present preference_management prompt | Claude needs to know how to capture preferences from the very first message, before any exist |
| Preference context after recipe_management section | Keeps existing prompt structure intact; new sections are additive |
| Optional systemPrompt param with fallback | Backward compatible -- sendMessage() callers in tests and simple flows still work without changes |
| Severity markers in preference lines | Hard constraints (allergy/restriction) are visually distinct from soft preferences |

## Task Commits

| Task | Commit | Description |
|------|--------|-------------|
| 1 | a76732c | Preference retrieval function and system prompt extension |
| 2 | 7d2fae2 | Claude client parameter extension and processor integration |

## Deviations from Plan

None -- plan executed exactly as written.

## Verification Results

- `npx tsc --noEmit` passes with zero errors
- `src/knowledge/preferences.ts` exists with correct exports (PreferenceSummary, getPreferenceSummaries)
- `buildSystemPrompt()` returns string containing `<preference_management>` section
- `buildSystemPrompt([...])` returns string containing `<user_preferences>` section
- `processor.ts` imports and calls `getPreferenceSummaries` and `buildSystemPrompt`
- `tools.ts` save_knowledge description mentions preference tags
- All imports use `.js` extensions (ESM convention)

## Next Phase Readiness

Plan 05-01 provides the core infrastructure for preference-aware conversations:
- Preferences stored as knowledge items with "preference" tag will automatically appear in system prompt
- Claude has instructions for the full preference lifecycle
- Plan 05-02 can build on this foundation for preference refinement and advanced features

## Self-Check: PASSED
