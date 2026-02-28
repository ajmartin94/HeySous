---
created: 2026-02-21T15:25:00.866Z
title: Surface conversation history truncation to Claude
area: ai
tags: [resilience, ux, audit-low]
files:
  - src/conversation/context-builder.ts:69
---

## Problem

When conversation history exceeds the 2000-token budget, older turns are silently dropped. Neither Claude nor the user is informed that context was truncated. On long conversations, users might reference something discussed earlier that Claude no longer has access to, leading to confusion.

## Solution

When history is truncated, append a note to the conversation context visible to Claude:

```
[Note: This conversation has been ongoing. Earlier messages were trimmed to fit context.
If the user references something you don't see, acknowledge that you may have lost that
context and ask them to remind you.]
```

Also log when truncation occurs with the number of turns dropped for observability.
