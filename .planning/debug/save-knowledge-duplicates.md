---
status: diagnosed
trigger: "save_knowledge creates duplicate knowledge items instead of updating existing ones"
created: 2026-02-18T00:00:00Z
updated: 2026-02-18T00:00:00Z
---

## Current Focus

hypothesis: No deduplication exists at any layer -- tool handler, repository, schema, or prompt
test: Read all four layers to verify absence of duplicate checking
expecting: No uniqueness constraints or search-before-save logic anywhere
next_action: Document root cause and fix recommendation

## Symptoms

expected: When saving "Gluten Allergy" or "Spaghetti and Meatballs" that already exists, should upsert or reject duplicate
actual: Creates new rows every time -- 4x "Gluten Allergy", 2x "Spaghetti and Meatballs" within 30 seconds
errors: None (silently creates duplicates)
reproduction: Call save_knowledge with same title/content multiple times for same household
started: Since save_knowledge was implemented -- no deduplication was ever built

## Eliminated

(none -- root cause found on first hypothesis)

## Evidence

- timestamp: 2026-02-18T00:01:00Z
  checked: src/knowledge/schema.ts -- knowledgeItems table definition
  found: No UNIQUE constraint on (householdId, title). Only constraint is autoincrement PK on id.
  implication: Database allows unlimited duplicates per household+title combination

- timestamp: 2026-02-18T00:02:00Z
  checked: src/knowledge/repository.ts -- create() method (lines 49-79)
  found: Pure INSERT with no pre-check. No search for existing items with same title before creating.
  implication: Repository blindly creates new rows every time

- timestamp: 2026-02-18T00:03:00Z
  checked: src/ai/tool-handler.ts -- save_knowledge case (lines 94-125)
  found: Directly calls knowledgeRepository.create() with no deduplication logic. No search_knowledge call before saving.
  implication: Tool handler is a pass-through with zero intelligence about duplicates

- timestamp: 2026-02-18T00:04:00Z
  checked: src/ai/tools.ts -- save_knowledge tool description (lines 54-91)
  found: Description says "Save a new item" -- no mention of checking for duplicates or upsert behavior
  implication: Claude has no instruction to check before saving via tool description

- timestamp: 2026-02-18T00:05:00Z
  checked: src/ai/system-prompt.ts -- preference_management section (line 394)
  found: Line 394 says "IMPORTANT: Before saving, search for existing similar preferences to avoid duplicates. If a similar preference exists, update it instead of creating a new one."
  implication: Prompt-level instruction exists for PREFERENCES but relies entirely on Claude's compliance. No enforcement at code level.

- timestamp: 2026-02-18T00:06:00Z
  checked: src/ai/system-prompt.ts -- recipe_management section
  found: Line 571 in LINKING RECIPES section says "Do NOT create duplicate recipe cards." but save_knowledge tool description and recipe_management section have no dedup instruction for the save flow itself.
  implication: Anti-duplicate instructions are scattered and inconsistent, only for certain scenarios, and purely advisory

- timestamp: 2026-02-18T00:07:00Z
  checked: src/onboarding/prompt.ts -- recipes phase (lines 82-103)
  found: Instructs "AFTER EACH RECIPE: Save it using save_knowledge" with no mention of checking for existing items first
  implication: Onboarding aggressively saves without any dedup awareness

## Resolution

root_cause: |
  No deduplication exists at any enforcement layer. The problem spans all four layers:

  1. **Schema layer**: No UNIQUE constraint on (householdId, title) in knowledge_items table
  2. **Repository layer**: create() does a blind INSERT with no existence check
  3. **Tool handler layer**: save_knowledge case directly calls create() with no search-before-save
  4. **Prompt layer**: Dedup instructions exist ONLY for preferences (system-prompt.ts line 394) and are purely advisory. Recipe saving and onboarding have no dedup instructions at all.

  The two scenarios described in the bug both stem from the same root cause:
  - Same session (30s apart): Claude calls save_knowledge twice because nothing stops it. The tool handler should catch this.
  - Across sessions (onboarding reruns): No code checks for existing items with the same title. The repository should catch this.

fix: (not applied -- diagnosis only)
verification: (not applied -- diagnosis only)
files_changed: []
