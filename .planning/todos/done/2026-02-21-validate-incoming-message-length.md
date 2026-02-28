---
created: 2026-02-21T15:25:00.866Z
title: Validate incoming message length
area: pipeline
tags: [security, validation, audit-medium]
files:
  - src/bot/handlers/message.ts
---

## Problem

User messages go straight to Claude with no size cap. The message handler extracts `ctx.message.text` with no length check, and the processor concatenates batched messages with no size validation. A 100KB message is processed at full cost.

```typescript
const text = ctx.message.text;  // No length check
// ...
const userText = batch.messages.map((m) => m.text).filter(Boolean).join("\n\n");
// Concatenated with no size validation
```

## Solution

Add a message length check in the message handler before enqueueing:

```typescript
const MAX_MESSAGE_LENGTH = 10000;  // ~2500 tokens
if (text.length > MAX_MESSAGE_LENGTH) {
  await ctx.reply("That message is too long! Try breaking it into smaller chunks.");
  return;
}
```

Also consider a total batch size limit in the processor to prevent concatenated messages from exceeding a reasonable threshold.
