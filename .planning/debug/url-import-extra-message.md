---
status: diagnosed
trigger: "URL-imported recipe confirmation requires extra followup message before save"
created: 2026-02-20T00:00:00Z
updated: 2026-02-20T00:00:00Z
---

## Current Focus

hypothesis: CONFIRMED - conversation history loses tool interaction context between turns, causing Claude to lack structured recipe data on confirmation turn
test: Full code trace complete across all 4 key files
expecting: N/A - root cause identified
next_action: Return diagnosis

## Symptoms

expected: User confirms recipe -> save_knowledge tool is called -> recipe saved in same turn
actual: User confirms recipe -> Claude says "saved" -> recipe NOT saved until user sends another message
errors: None visible (no crash, just silent failure to persist)
reproduction: Send recipe URL, confirm when presented, check DB - recipe missing until next message
started: Unknown

## Eliminated

- hypothesis: Async tool handler not completing DB write
  evidence: save_knowledge uses synchronous better-sqlite3 calls (knowledgeRepository.create at tool-handler.ts:150, db.insert().run() at tool-handler.ts:158-165). No async gaps.
  timestamp: 2026-02-20

- hypothesis: sendMessageWithTools skips tool_use blocks when stop_reason is end_turn
  evidence: Anthropic API guarantees stop_reason="tool_use" when tool_use blocks are present. The end_turn check at claude-client.ts:159 is correct. If Claude returns tool_use blocks, stop_reason will be "tool_use" and they will be processed.
  timestamp: 2026-02-20

- hypothesis: Dedup check in save_knowledge blocks the save
  evidence: Dedup searches FTS index (tool-handler.ts:108). On first save attempt, recipe doesn't exist yet, so no duplicate would be found. Dedup is also wrapped in try/catch (line 144) with fallthrough to save on error.
  timestamp: 2026-02-20

- hypothesis: Race condition or timing issue in DB writes
  evidence: Incoming message saved before Claude call (processor.ts:118-125), outgoing saved after (processor.ts:369-376). Conversation history correctly reflects prior turns on each new message. better-sqlite3 is synchronous - no race possible.
  timestamp: 2026-02-20

## Evidence

- timestamp: 2026-02-20
  checked: processor.ts lines 118-125 and 369-376 - what gets persisted in messages table
  found: Only text messages (direction in/out) are saved. Tool call names, inputs, and results are NOT persisted.
  implication: On the next turn, Claude has no memory of tool interactions from previous turns

- timestamp: 2026-02-20
  checked: conversation/context-builder.ts - how history is reconstructed for Claude
  found: Builds Anthropic MessageParam[] from messages table rows. Maps direction "in" -> role "user", direction "out" -> role "assistant". No tool_use or tool_result blocks are ever included.
  implication: Claude sees only text history - never its own tool calls or their results

- timestamp: 2026-02-20
  checked: claude-client.ts sendMessageWithTools lines 109-262 - the tool loop
  found: Tool interactions (assistant tool_use + user tool_result) are appended to loopMessages (lines 224-231) WITHIN a single turn but are never returned or persisted externally. The loop only returns the final text response.
  implication: Multi-turn tool context is ephemeral - exists only within a single processBatch call

- timestamp: 2026-02-20
  checked: system-prompt.ts lines 606-623 - RECIPE IMPORT instructions
  found: Step 4 says "If the user confirms, call save_knowledge with the extracted content and include source_url". The phrase "extracted content" refers to data from import_from_url which only existed in the previous turn's tool loop.
  implication: Prompt tells Claude to use data that is no longer in its context, creating ambiguity about what to save

- timestamp: 2026-02-20
  checked: Full recipe import flow across turns
  found: Turn 1: URL -> import_from_url tool returns structured recipe data -> Claude formats and presents -> text saved to DB. Turn 2: "yes" -> conversation history has [user: URL text, assistant: formatted recipe text, user: yes]. Claude does NOT see the import_from_url tool call or its structured result. Claude must reconstruct recipe data from its own formatted text output to call save_knowledge.
  implication: Claude either (a) skips the save_knowledge call entirely and just outputs "saved" text, or (b) attempts save_knowledge but with incomplete/wrong data reconstructed from formatted display text

## Resolution

root_cause: The conversation history system (processor.ts + conversation/context-builder.ts) only persists plain text messages between turns, discarding all tool interaction context (tool_use calls and tool_result responses). When a recipe URL import spans two turns (Turn 1: import_from_url + present recipe, Turn 2: user confirms + should save), Claude loses access to the structured extracted recipe data on the confirmation turn. Claude sees only its own formatted text presentation, not the original import_from_url result containing structured ingredients, instructions, and metadata. This causes Claude to either (a) respond with "saved!" text without actually calling save_knowledge (hallucinating the action), or (b) attempt an incomplete save. The recipe only actually gets saved on a subsequent message when Claude re-engages with the knowledge tools.
fix:
verification:
files_changed: []
