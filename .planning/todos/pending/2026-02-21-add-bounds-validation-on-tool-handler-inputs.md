---
created: 2026-02-21T15:25:00.866Z
title: Add bounds validation on tool handler inputs
area: ai
tags: [security, validation, audit-medium]
files:
  - src/ai/tool-handler.ts
---

## Problem

Tool inputs use direct type assertions (`input.query as string`) with no bounds checking. No limits on string length, array size, or number ranges. Claude could theoretically request saving 100KB content blocks or arrays with thousands of tags.

```typescript
case "search_knowledge": {
  const query = input.query as string;       // No length check
  const limit = input.limit as number;       // Could be negative or huge
case "save_knowledge": {
  const content = input.content as string;   // Could be 100KB+
  const tags = input.tags as string[];       // Could have 10,000 tags
```

## Solution

Add validation constants and checks at the top of each tool handler case:

```typescript
const MAX_QUERY_LENGTH = 1000;
const MAX_CONTENT_SIZE = 100_000;  // 100KB
const MAX_TAGS_COUNT = 20;
const MAX_SEARCH_LIMIT = 10;
```

Return clear error messages for out-of-bounds inputs so Claude can adjust. Consider a shared `validateToolInput()` helper to avoid repetition across handlers.
