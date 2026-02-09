---
status: diagnosed
trigger: "Updating a recipe through conversation throws an error"
created: 2026-02-09T00:00:00Z
updated: 2026-02-09T00:00:00Z
---

## Current Focus

hypothesis: Two bugs identified -- (1) no try/catch around tool handler calls causes unhandled exceptions to crash the tool loop and both retries, and (2) failed pipeline invocations leave orphaned "in" messages that create consecutive user messages in subsequent requests, violating the Anthropic API message format
test: Code trace confirmed
expecting: Both issues independently and together can cause the described error
next_action: Report findings

## Symptoms

expected: Bot updates the recipe knowledge item and confirms the change
actual: Bot shows "i'm having trouble thinking right now" error message
errors: IN_CHARACTER_ERROR shown to user (exact error not logged to user)
reproduction: Tell the bot to update a saved recipe (e.g., "the carbonara actually takes 25 minutes, not 20")
started: Unknown -- likely since tool handler was implemented

## Eliminated

- hypothesis: Drizzle .set() throws on Record<string, unknown> type
  evidence: Drizzle's mapUpdateSet correctly iterates Object.entries and looks up column definitions by key name; updatedAt maps correctly to the SQLiteTimestamp column
  timestamp: 2026-02-09

- hypothesis: FTS trigger conflict between getFullItem and repository update
  evidence: Both operations are synchronous and happen in separate tool loop iterations; no concurrent access
  timestamp: 2026-02-09

- hypothesis: Malformed tool result content format
  evidence: Tool handler returns JSON.stringify() string; ToolResultBlockParam accepts string content
  timestamp: 2026-02-09

- hypothesis: Drizzle mapUpdateSet throws "No values to set"
  evidence: updateValues always contains at least updatedAt: new Date(), so entries array is never empty
  timestamp: 2026-02-09

## Evidence

- timestamp: 2026-02-09
  checked: tool-handler.ts handleToolCall method
  found: No try/catch wrapping any tool handler case. All DB operations (knowledgeRepository.getById, knowledgeRepository.update, db.insert changelog) can throw on DB errors, and any exception propagates up through the .map() in claude-client.ts, crashing sendMessageWithTools
  implication: Any transient or unexpected DB error in a tool handler crashes the entire Claude call and both retries

- timestamp: 2026-02-09
  checked: claude-client.ts sendMessageWithTools tool call handling (lines 198-209)
  found: Tool calls executed inside .map() with no error handling; exception propagates as rejected promise
  implication: A single tool handler failure kills the entire multi-iteration tool loop, even if the failure is in a non-critical operation like changelog insertion

- timestamp: 2026-02-09
  checked: processor.ts retry logic (lines 197-243)
  found: Both retries use identical fullMessages and toolHandler; if first attempt's tool handler throws, retry produces same Claude response, same tool calls, same exception
  implication: Deterministic tool handler errors fail BOTH retries -- user always sees error

- timestamp: 2026-02-09
  checked: processor.ts message persistence (lines 102-109 save "in", lines 253-260 save "out")
  found: Incoming message saved BEFORE Claude call (line 102-109); outgoing saved AFTER successful response (line 253-260); on failure, only "in" is saved, creating orphaned user messages
  implication: Next pipeline invocation loads orphaned "in" message + new "in" message, creating consecutive user messages

- timestamp: 2026-02-09
  checked: conversation/context-builder.ts buildConversationContext
  found: Builder correctly handles alternation but does NOT check for consecutive user messages at the END of the returned array; fullMessages construction (processor line 135-138) appends another user message without checking
  implication: If priorMessages ends with role:user (from orphaned "in" message), fullMessages has consecutive user messages, which the Anthropic API rejects

- timestamp: 2026-02-09
  checked: update_knowledge handler flow vs save_knowledge
  found: update_knowledge does getById + update + changelog insert (3 DB operations); save_knowledge does create + changelog insert (2 DB operations); the extra getById and the more complex update() call increase the surface area for DB errors
  implication: update_knowledge is more prone to errors than save_knowledge, explaining why saves work but updates fail

## Resolution

root_cause: |
  PRIMARY: The tool handler (tool-handler.ts handleToolCall) has NO error handling.
  All tool operations are bare DB calls that can throw exceptions. When any exception
  occurs (e.g., DB constraint violation, serialization error, FTS trigger issue),
  the exception propagates through the .map() in claude-client.ts (line 198-209),
  crashes sendMessageWithTools, and BOTH retries fail identically because they
  reproduce the same tool calls.

  SECONDARY (cascading): When the pipeline fails, the incoming user message is already
  saved to the messages table (processor.ts line 102-109) but no outgoing message is
  saved (line 253-260 is skipped). This creates an orphaned "in" message. On the next
  user message, the conversation context builder produces a history ending with
  role:user, and the processor appends another role:user message, creating consecutive
  user messages that violate the Anthropic API's alternating message format. This causes
  the NEXT request to also fail, creating a cascade of failures.

  The fact that the update "worked on a subsequent message" is explained by: the tool
  handler may have successfully executed the DB update BEFORE failing on a subsequent
  operation (e.g., the changelog insert), so the data was actually modified. When the
  user tried again (possibly after a session gap >4 hours, which resets the context
  window), Claude found the already-updated recipe and responded without needing to
  call update_knowledge again.

fix: Not applied (diagnosis only)
verification: Not applicable
files_changed: []
