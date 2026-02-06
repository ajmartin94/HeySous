---
phase: 03-knowledge-system
plan: 02
subsystem: knowledge-retrieval
tags: [fts5, bm25, tool-use, anthropic-api, two-pass-retrieval, token-budget]
completed: 2026-02-06
duration: 2 min

dependency-graph:
  requires: [03-01]
  provides: [retrieval-service, knowledge-tools, tool-handler]
  affects: [03-03, future-processor-tool-loop]

tech-stack:
  added: []
  patterns: [two-pass-retrieval, tool-dispatch, token-budget-enforcement]

key-files:
  created:
    - src/knowledge/retrieval.ts
    - src/ai/tools.ts
    - src/ai/tool-handler.ts
  modified:
    - src/ai/types.ts

decisions:
  - "Token budget enforcement trims from end (least relevant) when over 4K soft limit"
  - "Search results secondary-sorted by recency among equal-relevance items"
  - "Tool handler is synchronous -- all underlying ops are sync via better-sqlite3"
  - "Tool results returned as JSON strings per Anthropic tool_result API convention"

metrics:
  tasks: 2
  commits: 2
  duration: 2 min
---

# Phase 3 Plan 02: Knowledge Retrieval and Tool Use Summary

Two-pass retrieval service with BM25 search within 4K token budget, Anthropic tool definitions for search_knowledge and get_knowledge_item, and a synchronous tool call dispatcher.

## Task Commits

| Task | Name | Commit | Key Files |
|------|------|--------|-----------|
| 1 | Retrieval service with two-pass search and budget enforcement | 0f0bcb6 | src/knowledge/retrieval.ts |
| 2 | Tool definitions and tool call dispatcher | 0965428 | src/ai/tools.ts, src/ai/tool-handler.ts, src/ai/types.ts |

## What Was Built

### Retrieval Service (`src/knowledge/retrieval.ts`)
- **createRetrievalService** factory takes sqlite, db, and logger dependencies
- **search()** (Pass 1): BM25-ranked summaries within 4K token soft limit
  - Calls searchFts from fts.ts, wraps with defensive error handling
  - Secondary sort by lastAccessedAt desc among equal-relevance items
  - Token budget against title + summary text (what Claude sees in pass 1)
  - Trims least-relevant results from end when over budget
- **getItem()** (Pass 2): Full content retrieval by ID, updates last_accessed_at
- **getMetrics()**: Returns per-search metrics for /debug command

### Tool Definitions (`src/ai/tools.ts`)
- **KNOWLEDGE_TOOLS**: Array of 2 Anthropic.Tool definitions
  - `search_knowledge`: query (required string), limit (optional number)
  - `get_knowledge_item`: id (required number)
- Descriptions guide Claude's usage: search first, then get full content

### Tool Handler (`src/ai/tool-handler.ts`)
- **createToolHandler** factory takes retrievalService and chatId
- **handleToolCall()**: Synchronous dispatcher by tool name
  - search_knowledge: returns JSON with header and results array
  - get_knowledge_item: returns JSON of full item or "No item found" message
  - Unknown tools: returns "Unknown tool: {name}" defensively

### Updated Types (`src/ai/types.ts`)
- Added **ToolHandlerResult** interface: { toolUseId, result } for processor's tool loop

## Decisions Made

1. **Token budget on summaries only**: Pass 1 budgets against title + summary, not full content. Full content is only fetched in pass 2 for selected items.
2. **Synchronous tool handler**: All underlying operations (FTS5, SQLite) are synchronous via better-sqlite3, so handleToolCall is sync.
3. **JSON string results**: Tool results serialized as JSON strings per Anthropic API convention for tool_result blocks.
4. **Defensive error wrapping**: searchFts already has LIKE fallback, but retrieval service adds outer catch returning empty results for truly unexpected errors.

## Deviations from Plan

None -- plan executed exactly as written.

## Next Phase Readiness

Plan 03-03 (Tool Loop Integration) can proceed. All required artifacts are in place:
- `createRetrievalService` for knowledge access
- `KNOWLEDGE_TOOLS` for Claude API tool definitions
- `createToolHandler` for dispatching tool calls
- `ToolHandlerResult` type for processor integration

## Self-Check: PASSED
