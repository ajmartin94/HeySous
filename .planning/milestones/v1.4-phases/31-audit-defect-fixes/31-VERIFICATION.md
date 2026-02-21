---
phase: 31-audit-defect-fixes
verified: 2026-02-21T19:10:00Z
status: passed
score: 4/4 must-haves verified
re_verification: false
---

# Phase 31: Audit Defect Fixes Verification Report

**Phase Goal:** Fix 3 integration defects found during milestone audit -- fresh install works, dedup threshold is accurate, source_url is retrievable
**Verified:** 2026-02-21T19:10:00Z
**Status:** passed
**Re-verification:** No -- initial verification

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | A fresh database with no prior tables starts successfully and all tables are created | VERIFIED | `src/db/migrations.ts` lines 18-21: `sqlite_master` guard skips migration when `knowledge_items` doesn't exist; `initializeFts` CREATE TABLE includes `source_url TEXT`; `createDatabase` integration test passes |
| 2 | BM25 dedup only triggers for genuinely similar items, not for every FTS match | VERIFIED | `src/ai/tool-handler.ts` line 133: `if (topMatch.relevance < 5)` uses correct direction for positive BM25 values; 3 new BM25 tests pass including mock boundary tests |
| 3 | get_knowledge_item tool returns the stored source_url for imported recipes | VERIFIED | `src/knowledge/fts.ts` line 248: SELECT includes `source_url`; `src/ai/tool-handler.ts` line 93: response JSON includes `sourceUrl: item.sourceUrl`; getFullItem test confirms round-trip |
| 4 | All existing tests pass plus new tests covering the 3 fixes | VERIFIED | 22/22 phase-related tests pass; 152/152 total application tests pass (1 unrelated gsd-tools infrastructure failure pre-existed before phase 31) |

**Score:** 4/4 truths verified

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `src/db/migrations.ts` | Guarded migration 001 that skips ALTER TABLE when knowledge_items table does not exist | VERIFIED | Lines 18-21: `SELECT name FROM sqlite_master WHERE type='table' AND name='knowledge_items'` guard present; returns early if `!tableExists` |
| `src/knowledge/fts.ts` | source_url in both CREATE TABLE and getFullItem SELECT | VERIFIED | Line 22: `source_url TEXT` in CREATE TABLE; Line 248: `source_url` in SELECT; Line 282: `sourceUrl: row.source_url ?? null` in returned object |
| `src/ai/tool-handler.ts` | Corrected BM25 threshold comparison AND sourceUrl in get_knowledge_item response | VERIFIED | Line 133: `topMatch.relevance < 5` (fixed from `> -5`); Line 93: `sourceUrl: item.sourceUrl` in JSON.stringify |
| `tests/db/migrations.test.ts` | Tests for migration 001 fresh-install guard | VERIFIED | Lines 160-262: two describe blocks -- "migration 001 fresh-install guard" (2 tests) and "createDatabase fresh-install integration" (1 test); all pass |
| `tests/knowledge/fts.test.ts` | Tests for source_url returned by getFullItem | VERIFIED | Lines 30-59: 2 tests -- source_url present and null cases; both pass |
| `tests/ai/tool-handler-dedup.test.ts` | Tests for BM25 threshold accuracy | VERIFIED | Lines 241-334: 3 new tests in "BM25 threshold accuracy" describe block -- real FTS weak match, mock relevance >= 5, mock relevance < 5; all pass |

### Key Link Verification

| From | To | Via | Status | Details |
|------|----|-----|--------|---------|
| `src/db/migrations.ts` (migration 001) | `src/knowledge/fts.ts` (CREATE TABLE) | Both paths handle `source_url`: migration adds it to existing DBs; CREATE TABLE includes it for fresh DBs | WIRED | Migration guard checks `sqlite_master`; `initializeFts` CREATE TABLE has `source_url TEXT` on line 22 |
| `src/knowledge/fts.ts:getFullItem` | `src/ai/tool-handler.ts:get_knowledge_item` | `getFullItem` SELECT returns `source_url`; tool handler serializes as `sourceUrl: item.sourceUrl` | WIRED | `fts.ts` line 248 includes `source_url` in SELECT; `tool-handler.ts` line 93 includes `sourceUrl: item.sourceUrl` in JSON response |
| `src/knowledge/fts.ts:searchFts` | `src/ai/tool-handler.ts:save_knowledge` | `searchFts` returns `Math.abs(row.relevance)` (positive); tool handler compares with `< 5` threshold | WIRED | `fts.ts` line 174: `relevance: Math.abs(row.relevance)`; `tool-handler.ts` line 133: `if (topMatch.relevance < 5)` |

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|-------------|-------------|--------|----------|
| MIGR-01 | 31-01-PLAN.md | Lightweight migration runner using PRAGMA user_version tracks which migrations have run | SATISFIED | `runMigrations` uses `PRAGMA user_version`; migration 001 guard added; `createDatabase` integration test passes |
| KNOW-01 | 31-01-PLAN.md | save_knowledge checks for existing similar items before creating; returns match info to Claude if found | SATISFIED | BM25 threshold fixed from `> -5` to `< 5` ensuring dedup check is accurate not always-true; existing dedup tests continue to pass |
| KNOW-04 | 31-01-PLAN.md | Dedup works for both recipe and preference knowledge types with appropriate matching strategies | SATISFIED | BM25 threshold fix applies across all knowledge types; mock threshold tests confirm `< 5` triggers dedup and `>= 5` does not |
| IMPORT-04 | 31-01-PLAN.md | Imported recipes store their source URL on the knowledge item | SATISFIED | Full chain verified: `source_url TEXT` in CREATE TABLE, in getFullItem SELECT, in tool handler JSON response |

No orphaned requirements found -- REQUIREMENTS.md lists all 4 IDs as assigned to Phase 31.

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| None | - | No TODO/FIXME/placeholder anti-patterns found in modified files | - | - |

Scanned: `src/db/migrations.ts`, `src/knowledge/fts.ts`, `src/ai/tool-handler.ts`, all three test files. No stubs, empty returns, or placeholder comments found.

### Human Verification Required

None. All three defects are algorithmic fixes with deterministic, programmatically verifiable behavior:
- Fresh install crash: verified by `createDatabase(":memory:")` integration test
- BM25 threshold: verified by mock-controlled boundary tests
- source_url retrieval: verified by insert/query round-trip test

### Test Suite Note

The overall test run shows 1 failed suite (`gsd-tools.test.cjs`) with "No test suite found" -- this is a pre-existing infrastructure issue with the GSD tooling test file format (uses Node.js `node:test` runner, not Vitest) and is unrelated to phase 31. All 152 application tests pass. All 22 phase-31-relevant tests pass.

### Gaps Summary

No gaps. All three defects are fully implemented and tested.

1. **Fresh install guard:** Migration 001 checks `sqlite_master` before attempting ALTER TABLE. `initializeFts` CREATE TABLE was extended to include `source_url TEXT` so fresh installs get the column from table creation rather than needing the migration. Tests cover both the skip-on-fresh-db path and the add-column-to-existing-db path, plus a full `createDatabase(":memory:")` integration test.

2. **source_url end-to-end:** The fix spans two layers -- `getFullItem` SELECT now includes `source_url`, and the `get_knowledge_item` case in tool-handler serializes it as `sourceUrl: item.sourceUrl`. Tests verify both the null and non-null cases for the SQL layer.

3. **BM25 threshold:** `searchFts` converts negative BM25 scores to positive via `Math.abs`, so the comparison `> -5` was always true. Changed to `< 5` (lower positive = stronger match). Mock tests lock in both sides of the boundary deterministically.

---

_Verified: 2026-02-21T19:10:00Z_
_Verifier: Claude (gsd-verifier)_
