---
status: resolved
trigger: "Investigate why recipe search returns the entire library instead of filtered results when a search term matches."
created: 2026-02-10T00:00:00Z
updated: 2026-02-10T00:08:00Z
symptoms_prefilled: true
goal: find_root_cause_only
---

## Current Focus

hypothesis: CONFIRMED - Catch block at line 190 returns all recipes without search filtering when FTS5 query throws error. Need to find WHY FTS5 throws error for valid searches.
test: Examine FTS5 query syntax for issues with quote handling or GROUP BY interaction
expecting: Find query syntax issue causing FTS5 to throw exception
next_action: Analyze FTS5 query structure and test query locally if possible

## Symptoms

expected: Typing a keyword filters the recipe list to only matching recipes
actual: Shows "no results" for partial words (correct), but when a full word matches, it returns the entire library unfiltered
errors: None reported - logic error
reproduction: Enter a full word that matches recipes, observe entire library returned
started: Unknown - regression or existing bug

## Eliminated

## Evidence

- timestamp: 2026-02-10T00:01:00Z
  checked: Frontend search flow (useRecipes.ts)
  found: Search input is debounced correctly, passed as 'q' param to /recipes API endpoint (line 84)
  implication: Frontend side looks correct - issue is likely server-side

- timestamp: 2026-02-10T00:01:30Z
  checked: Server-side recipes.ts route (getList handler)
  found: Lines 95-100 show FTS5 search path with escapeForFts5() call. If escaped value is empty/falsy, returns empty array (correct). Otherwise, proceeds to FTS search.
  implication: The escapeForFts5() function might be returning empty string for valid searches, causing fallback to catch block

- timestamp: 2026-02-10T00:02:00Z
  checked: escapeForFts5 function in fts.ts (lines 105-117)
  found: Function wraps each term in double quotes and joins them. For valid word like "chicken", returns '"chicken"'. This is NOT empty/falsy.
  implication: The escaped string is valid. Issue must be in FTS5 query execution or catch block behavior

- timestamp: 2026-02-10T00:02:30Z
  checked: Catch block in recipes.ts (lines 190-236)
  found: Catch block returns ALL recipes (filtered only by chatId and 'recipe' tag) without search filtering. This is executed when FTS5 throws an error.
  implication: Either FTS5 is throwing an error for valid queries, OR the try block is returning wrong results

- timestamp: 2026-02-10T00:03:00Z
  checked: Symptom analysis - "no results" for partial words vs "entire library" for full words
  found: Partial words likely fail escapeForFts5 or FTS5 matching, correctly returning empty results. Full words pass validation but trigger catch block somehow, showing all recipes.
  implication: Strong hypothesis - FTS5 query is throwing an error for valid full words, falling back to catch block

- timestamp: 2026-02-10T00:04:00Z
  checked: FTS5 query syntax at lines 103-140 in recipes.ts
  found: Query uses GROUP_CONCAT and GROUP BY, joins knowledge_fts with knowledge_items and knowledge_tags. The catch block at line 190 catches ANY error and returns all recipes.
  implication: If FTS5 query throws error (syntax, parse, or execution), catch block is triggered and returns unfiltered results

- timestamp: 2026-02-10T00:05:00Z
  checked: Comparison of successful non-search query (lines 143-176) vs FTS search query (lines 103-140)
  found: The ONLY structural difference is the FROM clause and MATCH condition. Both use identical GROUP BY and aggregation patterns.
  implication: The FTS5 MATCH query itself must be throwing an error for valid search terms

- timestamp: 2026-02-10T00:06:00Z
  checked: Catch block behavior at lines 190-236
  found: **CONFIRMED** - Catch block returns ALL recipes filtered only by chatId and 'recipe' tag. It completely ignores the search query parameter `q`. This matches the symptom exactly: "returns entire library unfiltered".
  implication: When FTS5 query throws ANY error, user sees all recipes instead of search results. Bug is confirmed to be in catch block execution path.

- timestamp: 2026-02-10T00:07:00Z
  checked: Executed actual FTS5 query against database with search term "chicken"
  found: **ROOT CAUSE FOUND** - Query throws error: "unable to use function bm25 in the requested context". The bm25() function at line 106 cannot be used with GROUP BY at line 125 when joining multiple tables.
  implication: Every FTS5 search query fails, falls to catch block, returns all recipes. This explains symptom perfectly.

## Resolution

root_cause: recipes.ts line 106 - bm25() function call is incompatible with GROUP BY at line 125. SQLite FTS5's bm25() cannot be used in queries with GROUP BY when joining external tables. This causes every search query to throw "unable to use function bm25 in the requested context", triggering the catch block at line 190 which returns all recipes unfiltered.

fix: Remove bm25() from the SELECT clause when grouping is required, OR restructure query to compute bm25 in a subquery before grouping. Simplest fix: Remove relevance calculation from recipe list query since it's not essential for basic filtering. Alternative: Use subquery to get FTS matches with relevance first, then join and group.

verification: After fix, search for a specific term (e.g., "chicken") and verify it returns only matching recipes, not the entire library.

files_changed:
- src/mini-app/routes/recipes.ts

resolved: 2026-02-10 — Two-step query: bm25() in isolation, then tag aggregation on matched IDs. CTE approach insufficient because SQLite propagates bm25() restriction through CTEs when outer query has GROUP BY.
