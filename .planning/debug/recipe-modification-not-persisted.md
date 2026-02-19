---
status: diagnosed
trigger: "recipe modifications not reflected in stored recipe card even though Claude claims update was made"
created: 2026-02-18T00:00:00Z
updated: 2026-02-18T00:00:00Z
---

## Current Focus

hypothesis: CONFIRMED - update_knowledge tool allows no-op updates and returns false success
test: Traced full code path from tool definition through handler to repository
expecting: Found the mechanism
next_action: Return diagnosis

## Symptoms

expected: When user asks to modify a recipe (e.g., swap chicken for tofu), the stored recipe card should reflect the change
actual: Claude says it made the update, but recipe card still shows old content
errors: none reported (silent failure - Claude claims success)
reproduction: Ask Sous to modify an existing recipe ingredient
started: unknown

## Eliminated

- hypothesis: update_knowledge tool does not exist
  evidence: Tool is defined in src/ai/tools.ts lines 93-134 with proper schema
  timestamp: 2026-02-18

- hypothesis: update_knowledge handler does not write to DB
  evidence: Handler at src/ai/tool-handler.ts lines 127-178 calls knowledgeRepository.update() which runs Drizzle UPDATE on knowledge_items table
  timestamp: 2026-02-18

- hypothesis: FTS index not synced after update
  evidence: src/knowledge/fts.ts lines 82-89 has AFTER UPDATE trigger on knowledge_items that properly removes old FTS entry and inserts new one
  timestamp: 2026-02-18

- hypothesis: Mini App or retrieval reading stale data
  evidence: Both retrieval.ts getItem() and recipes.ts getDetail() read directly from knowledge_items table, not from cache
  timestamp: 2026-02-18

- hypothesis: Tool use loop broken (tool results not fed back)
  evidence: claude-client.ts sendMessageWithTools properly handles tool_use blocks, dispatches to onToolCall, and appends results as tool_result blocks in the loop
  timestamp: 2026-02-18

## Evidence

- timestamp: 2026-02-18
  checked: src/ai/tools.ts update_knowledge definition (lines 93-134)
  found: Tool description says "Provide the item ID and only the fields that changed" -- content/title/summary/tags are all optional, only `id` is required
  implication: Claude can legally call update_knowledge with just {id, change_description} and no content field

- timestamp: 2026-02-18
  checked: src/ai/tool-handler.ts update_knowledge handler (lines 127-178)
  found: changes object built from optional fields; if none provided, changes={} is empty; repository.update() still runs with only {updatedAt: new Date()} and returns success JSON
  implication: No-op updates (touching only updatedAt) succeed silently and return "Updated [title] (ID: X)" to Claude

- timestamp: 2026-02-18
  checked: src/knowledge/repository.ts update() method (lines 108-160)
  found: updateValues always includes {updatedAt: new Date()}; if changes has no content/title/summary fields, UPDATE runs but only bumps timestamp; returns the item as if update succeeded
  implication: Repository does not distinguish between meaningful and no-op updates

- timestamp: 2026-02-18
  checked: System prompt RECIPE_VARIATIONS_PROMPT (lines 304-341 of system-prompt.ts)
  found: Instructions say to use get_knowledge_item first, modify content, then call update_knowledge -- but the 3-step process is a SHOULD not a MUST, and the tool interface allows skipping steps
  implication: Claude may skip get_knowledge_item and call update_knowledge without content, relying on change_description to "describe" the change

- timestamp: 2026-02-18
  checked: All tools registered in processor.ts line 246
  found: allTools includes KNOWLEDGE_TOOLS which contains update_knowledge -- tool is available to Claude
  implication: Tool is available, the issue is not missing registration

## Resolution

root_cause: The update_knowledge tool allows Claude to call it with only {id, change_description} and no content field. When this happens, the handler runs a no-op UPDATE (only bumping updatedAt timestamp) and returns a success message ("Updated [title]") to Claude. Claude interprets this as a successful modification and tells the user the recipe was updated. But the actual recipe content was never changed. This is a combination of: (1) the tool schema making all fields except `id` optional, (2) the handler not validating that at least one substantive field was provided, and (3) the handler returning a success message for no-op updates.
fix:
verification:
files_changed: []
