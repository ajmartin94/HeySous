---
status: diagnosed
trigger: "/debug returns 'No retrieval stats yet' despite active conversation"
created: 2026-02-09T00:00:00Z
updated: 2026-02-09T00:00:00Z
---

## Current Focus

hypothesis: retrieval stats only update when Claude calls search_knowledge tool -- not on every message
test: trace code path from user message -> processor -> tool handler -> retrieval service
expecting: search() is never called eagerly; only called when Claude decides to use the tool
next_action: confirmed -- return diagnosis

## Symptoms

expected: /debug shows retrieval stats after user sends messages
actual: /debug always says "No retrieval stats yet -- send a message first!"
errors: none (no crashes, just zero metrics)
reproduction: send messages to bot, then /debug
started: likely since /debug was implemented

## Eliminated

(none needed -- root cause found on first hypothesis)

## Evidence

- timestamp: 2026-02-09T00:01:00Z
  checked: src/knowledge/retrieval.ts -- how lastMetrics is stored
  found: lastMetrics is a closure variable initialized to all zeros; only updated inside search() method (line 96)
  implication: metrics stay zero unless search() is explicitly called

- timestamp: 2026-02-09T00:02:00Z
  checked: src/pipeline/processor.ts -- whether search() is called during message processing
  found: processor does NOT call retrievalService.search() directly; it passes retrievalService to createToolHandler (line 141-151)
  implication: search() is only invoked when Claude decides to use the search_knowledge tool

- timestamp: 2026-02-09T00:03:00Z
  checked: src/ai/tool-handler.ts -- the only call site for retrievalService.search()
  found: line 52 -- retrievalService.search() is called inside case "search_knowledge" of handleToolCall
  implication: metrics are ONLY updated when Claude calls the search_knowledge tool during a conversation turn

- timestamp: 2026-02-09T00:04:00Z
  checked: grep for all .search() calls across codebase
  found: only ONE call site: src/ai/tool-handler.ts:52
  implication: confirmed -- there is no eager/automatic knowledge search on every message

- timestamp: 2026-02-09T00:05:00Z
  checked: src/bot/handlers/debug.ts -- the /debug handler
  found: checks if all metrics are zero (lines 26-30) and shows "No retrieval stats yet" message
  implication: this message will show for ANY user whose Claude interactions have never triggered a search_knowledge tool call

- timestamp: 2026-02-09T00:06:00Z
  checked: lastMetrics is global to the retrieval service instance, not per-chat
  found: single `let lastMetrics` closure variable (line 35); overwritten on every search() call regardless of chatId
  implication: secondary issue -- /debug shows the LAST search by ANY user, not the current user's last search

## Resolution

root_cause: |
  The retrieval service's `lastMetrics` variable (src/knowledge/retrieval.ts, line 35) is only
  updated when `search()` is called (line 96), and `search()` is only called when Claude
  decides to invoke the `search_knowledge` tool during message processing
  (src/ai/tool-handler.ts, line 52). There is NO automatic/eager knowledge retrieval on
  every user message. If Claude never decides to call the tool (e.g., the user is just
  chatting casually, or Claude answers from its own knowledge/conversation context), the
  metrics stay at their initialized all-zero state, and /debug shows "No retrieval stats yet."

  Additionally, `lastMetrics` is a single variable shared across ALL chats -- it stores
  the result of whichever user's search ran last, not per-user metrics. This is a
  secondary design issue.

fix: (not applied -- research only)
verification: (not applied -- research only)
files_changed: []
