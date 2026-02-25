---
phase: 34-observability-data-integrity
verified: 2026-02-21T18:35:00Z
status: passed
score: 9/9 must-haves verified
re_verification: false
---

# Phase 34: Observability & Data Integrity Verification Report

**Phase Goal:** Every tool call is traceable in logs with timing and outcome, error details never leak to the LLM, and extracted recipes are validated before save
**Verified:** 2026-02-21T18:35:00Z
**Status:** passed
**Re-verification:** No -- initial verification

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | Each tool call produces a structured log entry with tool_name, duration_ms, household_id, and success/error status | VERIFIED | `createInstrumentedToolHandler` in `processor.ts` lines 63-105 logs `{ tool_name, duration_ms, household_id, status }` at `info` level on success and `error` level on failure |
| 2 | When a tool throws an internal error, the message returned to Claude describes the failure generically without exposing stack traces, file paths, or SQL | VERIFIED | `sanitizeToolError` in `claude-client.ts` lines 68-77 strips stack traces (`\s+at\s+.+`), file paths (`/[\w/.-]+\.\w+`), and SQL (`SELECT\|INSERT\|...`) before the error is placed in `tool_result` blocks (line 258) |
| 3 | MODEL_PRICING in config covers Sonnet and Opus model IDs and falls back gracefully for unknown models | VERIFIED | `types.ts` lines 32-61 includes `claude-sonnet-4-20250514`, `claude-opus-4-20250514`, and `_fallback` entries; `claude-client.ts` line 50 uses `MODEL_PRICING[model] ?? MODEL_PRICING._fallback` |
| 4 | Recipes extracted from URLs or photos that lack a title, ingredients list, or instructions are rejected with a message explaining what is missing | VERIFIED | `validateRecipeCompleteness` in `tool-handler.ts` lines 88-116 checks for "recipe" tag, validates title presence, "Ingredients:" header with list items, and "Steps:" header with numbered steps; returns specific missing-field message |

**Score:** 4/4 success criteria verified

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `src/pipeline/processor.ts` | Instrumented tool call wrapper with timing, logging, and error sanitization | VERIFIED | `createInstrumentedToolHandler` exists at line 63, exported, wraps handler with timing (lines 69-103); used at lines 386-390 replacing both raw `handleToolCall` call sites |
| `src/ai/claude-client.ts` | Error sanitization in tool result catch block | VERIFIED | `sanitizeToolError` exported at line 68; used in catch block at line 258 in `sendMessageWithTools` |
| `src/ai/types.ts` | MODEL_PRICING with Sonnet, Opus, and fallback entries | VERIFIED | Contains `claude-sonnet-4-20250514` (line 41), `claude-opus-4-20250514` (line 48), `_fallback` (line 55) |
| `src/ai/tool-handler.ts` | Recipe completeness validation in save_knowledge handler | VERIFIED | `validateRecipeCompleteness` at line 88; called in `save_knowledge` case at line 270, after dedup check, before repository create |
| `src/ai/system-prompt.ts` | System prompt instructions for recipe validation behavior | VERIFIED | Recipe creation flow step 7 at line 376 instructs Claude to ask for missing fields; RECIPE IMPORT section line 436 adds gap-filling guidance |
| `src/config.ts` | `logToolInputs` boolean from `LOG_TOOL_INPUTS` env var | VERIFIED | `logToolInputs: boolean` in Config interface (line 18); set to `process.env.LOG_TOOL_INPUTS === "true"` (line 62) |
| `tests/pipeline/processor-tools.test.ts` | Tests for tool call instrumentation and error sanitization | VERIFIED | 17 tests pass covering info/error logging, input toggling, duration capture, re-throw, and 11 sanitization cases |
| `tests/ai/tool-handler.test.ts` | Tests for recipe validation | VERIFIED | 6 recipe completeness validation tests pass (lines 353-459) covering reject-missing-ingredients, reject-missing-steps, reject-both-missing, accept-complete, skip-for-preferences, skip-for-non-recipe-tags |

### Key Link Verification

| From | To | Via | Status | Details |
|------|----|-----|--------|---------|
| `src/pipeline/processor.ts` | `toolHandler.handleToolCall` | `createInstrumentedToolHandler` wraps and is passed to `sendMessageWithTools` | WIRED | Lines 386-390 create `instrumentedHandler`; lines 396 and 416 pass it to both `sendMessageWithTools` call sites (first attempt and retry) |
| `src/ai/claude-client.ts` | `tool_result` blocks | `sanitizeToolError` called in catch block | WIRED | Line 258: `content: JSON.stringify({ error: sanitizeToolError(error) })` inside `Promise.all` catch at line 254 |
| `src/ai/tool-handler.ts` | `save_knowledge` case | `validateRecipeCompleteness` called after dedup check | WIRED | Line 270: `const recipeError = validateRecipeCompleteness(title, content, tags);` -- correctly positioned after dedup block (lines 226-267), before `knowledgeRepository.create` (line 280) |
| `src/ai/types.ts` | `src/ai/claude-client.ts` `calculateCost` | `MODEL_PRICING` lookup with `_fallback` | WIRED | `claude-client.ts` imports `MODEL_PRICING` from `./types.js` (line 4); `calculateCost` at line 50 uses `MODEL_PRICING[model] ?? MODEL_PRICING._fallback` |

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|-------------|-------------|--------|----------|
| OBS-01 | 34-01 | Every tool call is logged with name, duration, household_id, and success/error status | SATISFIED | `createInstrumentedToolHandler` produces structured Pino log on every invocation; 5 tests verify log fields |
| OBS-02 | 34-01 | Tool error messages are sanitized before returning to Claude (no internal details leaked) | SATISFIED | `sanitizeToolError` strips stack traces, file paths, SQL; applied in `sendMessageWithTools` catch block; 11 sanitization tests |
| OBS-03 | 34-02 | MODEL_PRICING includes entries for Sonnet and Opus with unknown-model fallback | SATISFIED | `types.ts` has Sonnet 4, Opus 4, Haiku 4.5, and `_fallback`; `calculateCost` uses `?? MODEL_PRICING._fallback` |
| DATA-01 | 34-02 | Extracted recipes are validated for required fields (title, ingredients, instructions) before save | SATISFIED | `validateRecipeCompleteness` enforces title + "Ingredients:" section + "Steps:" section for items tagged "recipe"; non-recipe saves unaffected |

No orphaned requirements found -- all four IDs from plan frontmatter are mapped and verified.

### Anti-Patterns Found

None. Scanned `src/pipeline/processor.ts`, `src/ai/claude-client.ts`, `src/ai/types.ts`, `src/ai/tool-handler.ts`, `src/config.ts` -- no TODO/FIXME/placeholder comments, no empty implementations, no stub handlers.

### Human Verification Required

None. All success criteria are verifiable programmatically through code inspection and test execution.

## Test Execution Results

```
Tests: 40 passed (40)
Files: 2 passed (2)
  - tests/pipeline/processor-tools.test.ts: 17 tests
  - tests/ai/tool-handler.test.ts: 23 tests
TypeScript typecheck: clean (no errors)
```

## Summary

All four phase success criteria are fully implemented and verified:

1. **Tool call tracing (OBS-01):** `createInstrumentedToolHandler` wraps every tool call with Pino structured logging at both info (success) and error levels, capturing `tool_name`, `duration_ms`, `household_id`, and `status`. The wrapper replaces raw `toolHandler.handleToolCall` in both the first attempt and retry paths inside `processBatch`.

2. **Error sanitization (OBS-02):** `sanitizeToolError` strips stack trace lines, Unix file paths, and SQL statements before placing errors into `tool_result` blocks returned to Claude. The function is wired directly into the `Promise.all` catch handler in `sendMessageWithTools`.

3. **Model pricing coverage (OBS-03):** `MODEL_PRICING` in `types.ts` covers Haiku 4.5, Sonnet 4, and Opus 4 with a `_fallback` key. `calculateCost` uses `?? MODEL_PRICING._fallback` so unknown future model IDs return a conservative cost estimate rather than zero.

4. **Recipe validation (DATA-01):** `validateRecipeCompleteness` in `tool-handler.ts` gates saves for "recipe"-tagged items on the presence of a title, an "Ingredients:" section with list items, and a "Steps:" section with numbered steps. Non-recipe items bypass validation. The system prompt instructs Claude to ask for missing fields when validation fails.

---

_Verified: 2026-02-21T18:35:00Z_
_Verifier: Claude (gsd-verifier)_
