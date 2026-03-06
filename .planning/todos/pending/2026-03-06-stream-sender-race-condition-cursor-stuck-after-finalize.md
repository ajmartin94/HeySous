---
created: 2026-03-06T17:33:00Z
title: Stream sender race condition - cursor stuck after finalize
area: telegram
files:
  - src/telegram/stream-sender.ts:96-151
  - src/pipeline/processor.ts:524-615
---

## Problem

The streaming cursor (`▍`) can remain visible after a message is finalized. This was observed in production on 2026-03-06 (message id 478, "wassup sous" -> teriyaki response).

Root cause: `scheduleEdit()` fires `void doEdit()` as fire-and-forget when enough time has elapsed (line 141). This in-flight async edit is not tracked. When `finalize()` is called immediately after the last text delta:

1. Last `appendText()` -> `scheduleEdit()` -> `void doEdit()` starts (appends cursor in display text)
2. Stream ends -> `finalize()` called -> `flushEditTimer()` only clears pending timers, not in-flight edits
3. `finalize()` sends its edit (without cursor)
4. The in-flight `doEdit()` from step 1 resolves AFTER finalize's edit -> overwrites with cursor-appended text

The `flushEditTimer()` function only clears `setTimeout` timers, not already-executing `doEdit()` promises.

## Solution

Track the in-flight `doEdit()` promise and await it in `finalize()` before sending the final edit. Something like:

```typescript
let inflightEdit: Promise<void> | null = null;

async function doEdit(): Promise<void> { /* ... */ }

function scheduleEdit(): void {
  if (editTimer !== null) return;
  const elapsed = Date.now() - lastEditTime;
  if (elapsed >= EDIT_INTERVAL_MS) {
    inflightEdit = doEdit();
  } else {
    editTimer = setTimeout(() => {
      editTimer = null;
      inflightEdit = doEdit();
    }, delay);
  }
}

async finalize(...) {
  flushEditTimer();
  if (inflightEdit) await inflightEdit; // wait for in-flight edit to complete
  // ... then send final edit
}
```

This ensures finalize's edit is always the last one Telegram receives.
