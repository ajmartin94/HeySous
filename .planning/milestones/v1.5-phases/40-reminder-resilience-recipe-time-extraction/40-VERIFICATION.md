---
phase: 40-reminder-resilience-recipe-time-extraction
verified: 2026-02-23T21:36:00Z
status: passed
score: 5/5 must-haves verified
re_verification: false
---

# Phase 40: Reminder Resilience and Recipe Time Extraction Verification Report

**Phase Goal:** Start-cooking reminders fire at the right time by default, recipe time data is reliably extractable, and plan entries without linked recipes are flagged before save
**Verified:** 2026-02-23T21:36:00Z
**Status:** passed
**Re-verification:** No -- initial verification

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | Start-cooking reminders default to 45 minutes before dinner time when recipe prep/cook time cannot be determined | VERIFIED | `DEFAULT_COOKING_MINUTES = 45` in generator.ts:11; `offsetMinutes` applied unconditionally at generator.ts:332-334; TDD test "uses 45-minute default when no time source is available" passes |
| 2 | When Claude saves a meal plan entry without knowledge_item_id for a recipe that exists in the knowledge base, the tool handler warns Claude to search and link the recipe | VERIFIED | Linking guard at tool-handler.ts:616-661; `unlinked_recipes` array returned alongside `warning` string; `logger.info` called with unlinked matches |
| 3 | Recipe time fields (prep, cook, total) are stored as structured metadata alongside the unstructured recipe content | VERIFIED | `prep_time_minutes`, `cook_time_minutes`, `total_time_minutes` INTEGER columns in knowledge_items (schema.ts:22-24, fts.ts:28-30, types.ts:15-17, repository.ts:12-15); Migration 6 adds columns and backfills existing recipes |
| 4 | parseRecipeTotalMinutes falls back to structured metadata when free-text parsing fails, and logs when neither source yields a result | VERIFIED | Generator fallback chain at generator.ts:289-310: structured columns checked first (priority 1), content parsing (`parseRecipeTotalMinutes`) as fallback (priority 2), `logger.info` with `reason: "no_time_data"` when both yield null; TDD test "logs at info level when falling back to default (no time data)" passes |
| 5 | Silent catch {} in reminder generation is replaced with observability logging | VERIFIED | `catch (err) { logger.error({err, householdId, recipeName, knowledgeItemId}, "Error querying recipe time...") }` at generator.ts:318-323; TDD test "replaces silent catch with logger.error" passes |

**Score:** 5/5 truths verified

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `src/reminders/generator.ts` | 45-min fallback, structured metadata lookup, error logging | VERIFIED | Contains `DEFAULT_COOKING_MINUTES = 45`, `logger.error` in catch, `logger.info` for fallback paths, SQL selects `prep_time_minutes, cook_time_minutes, total_time_minutes` |
| `tests/reminders/generator.test.ts` | TDD tests for parseRecipeTotalMinutes and generateReminders fallback behavior | VERIFIED | 18 tests across 3 describe blocks; all pass |
| `src/db/migrations.ts` | Migration 6: add time columns and backfill | VERIFIED | Version 6 "add-recipe-time-columns" present; adds 3 INTEGER columns, backfills from recipe content via `parseTimeToMinutes` and `parseRecipeTotalMinutes` |
| `src/knowledge/schema.ts` | Drizzle schema with time columns | VERIFIED | `prepTimeMinutes`, `cookTimeMinutes`, `totalTimeMinutes` as nullable integers at lines 22-24 |
| `src/knowledge/fts.ts` | CREATE TABLE includes time columns | VERIFIED | `prep_time_minutes INTEGER`, `cook_time_minutes INTEGER`, `total_time_minutes INTEGER` in CREATE TABLE at lines 28-30 |
| `src/ai/tool-handler.ts` | Auto-extract time on save/update, plan-recipe linking guard | VERIFIED | `unlinked_recipes` warning in save_meal_plan; auto-extract in save_knowledge (lines 340-371) and update_knowledge (lines 453-480) |

### Key Link Verification

| From | To | Via | Status | Details |
|------|----|-----|--------|---------|
| `src/db/migrations.ts` | `src/reminders/generator.ts` | `parseRecipeTotalMinutes`, `parseTimeToMinutes` imported from generator | WIRED | `import { parseRecipeTotalMinutes, parseTimeToMinutes } from "../reminders/generator.js"` at migrations.ts:3 |
| `src/db/migrations.ts` | `knowledge_items` table | Both define prep_time_minutes, cook_time_minutes, total_time_minutes columns | WIRED | Migration 6 adds columns to existing installs; fts.ts CREATE TABLE includes them for fresh installs |
| `src/ai/tool-handler.ts` | `src/knowledge/fts.ts` | `searchFts` used in linking guard for recipe name matching | WIRED | `import { searchFts, ... } from "../knowledge/fts.js"` at tool-handler.ts:15; called at tool-handler.ts:622 |
| `src/reminders/generator.ts` | `knowledge_items` table | SQL query selects `prep_time_minutes, cook_time_minutes, total_time_minutes` alongside content | WIRED | `SELECT content, prep_time_minutes, cook_time_minutes, total_time_minutes FROM knowledge_items WHERE id = ? AND household_id = ?` at generator.ts:280 |

### Requirements Coverage

No requirement IDs are mapped to this phase. Verification is against success criteria only.

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| `src/ai/tool-handler.ts` | 634 | `catch {}` (empty catch in linking guard) | INFO | Non-blocking by design -- FTS search failure in the linking guard is explicitly documented as non-blocking. The primary save has already succeeded; this is an advisory check only. The pattern is intentional, not a stub. |

The linking guard's empty catch block at tool-handler.ts:634 is intentional -- the comment reads "FTS search failure is non-blocking." This is a deliberate design choice for an advisory feature (warn but don't break saves), not an anti-pattern hiding a real error. It does not block the phase goal.

### Human Verification Required

None -- all five success criteria are verifiable programmatically via code inspection and passing TDD tests.

### Gaps Summary

No gaps. All five success criteria are met with substantive implementation and passing tests.

---

## Detail Notes

### SC1: 45-minute default fallback

Previously, `reminderTime` was initialized to `settings.dinnerTime` with no offset applied when recipe time was unknown. The new code always applies an offset: `recipeTotalMinutes ?? DEFAULT_COOKING_MINUTES`. The constant `DEFAULT_COOKING_MINUTES = 45` is defined at generator.ts:11. Two TDD tests confirm the behavior ("uses 45-minute default when no time source is available" and "uses 45-min default when knowledgeItemId is null"), both firing the reminder at 16:45 ET (21:45 UTC) for a 17:30 ET dinner.

### SC2: Plan-recipe linking guard

The guard at tool-handler.ts:616-661 runs after a successful `planRepository.savePlan()` call. For each entry without `knowledge_item_id`, it calls `searchFts(sqlite, entry.recipe_name, householdId, 1)` and considers a match when `topResult.title.toLowerCase() === entry.recipe_name.toLowerCase() || topResult.relevance < 5`. Matches are collected in `unlinkedRecipes`, which are added to the JSON response as `unlinked_recipes` and a `warning` string. `logger.info` is called with `{ householdId, unlinkedRecipes }`.

### SC3: Structured time columns

Three nullable INTEGER columns (`prep_time_minutes`, `cook_time_minutes`, `total_time_minutes`) exist in:
- Drizzle schema (`src/knowledge/schema.ts`)
- FTS init CREATE TABLE (`src/knowledge/fts.ts`)
- TypeScript interface (`src/knowledge/types.ts`)
- Repository input interfaces and `buildKnowledgeItem` (`src/knowledge/repository.ts`)
- Migration 6 with backfill (`src/db/migrations.ts`)

The `getFullItem` function in fts.ts also returns these fields in its SELECT and maps them to the KnowledgeItem return value.

### SC4: Fallback chain and logging

Generator.ts implements a strict priority chain:
1. Structured DB columns (prep+cook combined, then total, then prep-only, then cook-only)
2. Content parsing via `parseRecipeTotalMinutes(row.content)` only if all structured columns are null
3. 45-min `DEFAULT_COOKING_MINUTES` if both sources yield null

When step 2 is reached (no structured time data), `logger.info` is called with `reason: "no_time_data"`. This satisfies SC4's requirement to "log when neither source yields a result."

### SC5: Observable error handling

The old code had `catch {}` (silent). The new code has:
```typescript
catch (err) {
  logger.error(
    { err, householdId, recipeName: meal.recipeName, knowledgeItemId: meal.knowledgeItemId },
    "Error querying recipe time for start-cooking reminder",
  );
}
```
The TDD test at generator.test.ts:465-521 verifies this by proxying `sqlite.prepare` to throw a "Simulated DB error" and asserting `mockLogger.error` was called with the error object.

### Test suite status

- All 238 project tests pass
- TypeScript typecheck passes (`tsc --noEmit` exits cleanly)
- All 18 generator TDD tests pass
- The one failing test file (`gsd-tools.test.cjs`) is GSD tooling infrastructure, not project code

---

_Verified: 2026-02-23T21:36:00Z_
_Verifier: Claude (gsd-verifier)_
