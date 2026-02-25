---
status: verifying
trigger: "User reports Sous cannot link recipes to meal plans at all. Sous pretends it's doing it but nothing happens."
created: 2026-02-23T00:00:00Z
updated: 2026-02-23T00:02:00Z
---

## Current Focus

hypothesis: CONFIRMED -- Claude AI does not reliably search_knowledge or pass correct knowledge_item_id.
test: Fix applied -- server-side auto-linking in save_meal_plan. Verifying with tests.
expecting: All 29 tests pass including 6 new auto-linking tests
next_action: Run full verification, archive session

## Symptoms

expected: When Sous creates a meal plan, it should automatically link matching recipes from the knowledge base via knowledge_item_id
actual: Sous acknowledges/pretends but no linking actually happens behind the scenes
errors: None visible to user
reproduction: Ask Sous to create a meal plan - recipes don't get linked
started: Broke recently (was working before). Key commits: e2edd22 (Feb 23), 714a263 (Feb 18)

## Eliminated

- hypothesis: "Code bug in repository - knowledgeItemId not persisted to DB"
  evidence: Repository code correctly maps knowledgeItemId -> DB column. Feb 16 week entries have correct IDs (35, 36, 43, 44, 45). Tests pass for round-trip.
  timestamp: 2026-02-23T00:00:30Z

- hypothesis: "System prompt missing LINKING RECIPES TO PLANS instructions"
  evidence: buildStaticPrompt() includes MEAL_PLANNING_PROMPT which contains full LINKING section (lines 105-112). No regressions found in git diff 714a263..HEAD.
  timestamp: 2026-02-23T00:00:30Z

- hypothesis: "Tool schema missing knowledge_item_id field"
  evidence: save_meal_plan tool definition has knowledge_item_id (type: number, optional) with clear description. Present since 714a263.
  timestamp: 2026-02-23T00:00:30Z

## Evidence

- timestamp: 2026-02-23T00:00:20Z
  checked: Local DB meal_plan_entries for week 2026-02-23 (household 858aab7b)
  found: 7 entries, only 1 has knowledge_item_id set ("Classic Pancakes" -> ID 1). But KB item #50 is the real "Classic Pancakes" -- ID 1 does not exist. Claude hallucinated the ID.
  implication: Claude is not reliably calling search_knowledge before save_meal_plan, and when it does try to link, it uses wrong IDs.

- timestamp: 2026-02-23T00:00:25Z
  checked: Local DB meal_plan_entries for week 2026-02-16 (household d4a77227)
  found: 10 entries, 5 properly linked (IDs 35, 36, 43, 44, 45 -- all correct). This was right after the prompt fix in 714a263.
  implication: Prompt-driven linking worked initially but is unreliable. Feb 16 was possibly tested carefully; Feb 23 shows natural degradation.

- timestamp: 2026-02-23T00:00:28Z
  checked: FTS search for "Classic Pancakes" in household 858aab7b
  found: Returns knowledge item #50 correctly. The search works fine -- Claude just didn't use it (or used wrong ID).
  implication: Knowledge base search infrastructure is correct. The issue is purely in Claude's tool-use behavior.

- timestamp: 2026-02-23T00:00:30Z
  checked: Feb 23 plan recipes vs KB contents for household 858aab7b
  found: Most recipes in the plan (Beef Tacos, Spaghetti Carbonara, Salmon, Chili, Roast Chicken) don't exist in the KB at all. Only Classic Pancakes (#50) has an exact match.
  implication: Many entries are correctly unlinked (no KB match). But the linking guard's FTS matching could auto-link the ones that DO match.

- timestamp: 2026-02-23T00:00:35Z
  checked: Linking guard code in tool-handler.ts (lines 616-639)
  found: The guard searches FTS for unlinked entries and returns a WARNING to Claude, but does NOT auto-link them. It relies on Claude to re-save with IDs. Also does not validate that IDs Claude provides are real.
  implication: The guard is passive. Making it active (auto-link + validate) would fix the reliability issue independent of Claude's behavior.

- timestamp: 2026-02-23T00:01:30Z
  checked: Fix applied and tested -- 29 tests pass (23 existing + 6 new auto-linking tests)
  found: Auto-linking correctly: (1) validates IDs exist in household, (2) corrects hallucinated IDs via FTS, (3) auto-links unlinked entries, (4) preserves valid IDs, (5) returns auto_linked array in response
  implication: Fix is minimal, targeted, and well-tested. Addresses root cause.

## Resolution

root_cause: The recipe-plan linking mechanism is entirely prompt-driven -- Claude must call search_knowledge before save_meal_plan and include correct knowledge_item_id values. In practice, Claude unreliably follows these instructions: sometimes doesn't search, sometimes hallucates IDs (e.g., used ID 1 instead of real ID 50 for Classic Pancakes). There is no server-side validation or auto-linking fallback. The passive "linking guard" (added in e2edd22) only warns Claude about mismatches but doesn't fix them.
fix: Converted the passive linking guard into active server-side auto-linking in save_meal_plan handler. Two phases: (1) Validate any knowledge_item_id Claude provides -- if ID doesn't exist in household, clear it. (2) For entries without a valid knowledge_item_id, auto-search FTS and link if title matches. Also added 6 unit tests covering auto-linking, ID correction, wrong-household rejection, valid ID preservation, and mixed scenarios.
verification: 29/29 tests pass (6 new auto-linking + 23 existing). TypeScript type check passes. Full test suite 244/244 pass.
files_changed:
  - src/ai/tool-handler.ts (replaced passive guard with active auto-linking)
  - tests/ai/tool-handler.test.ts (added 6 auto-linking tests)
