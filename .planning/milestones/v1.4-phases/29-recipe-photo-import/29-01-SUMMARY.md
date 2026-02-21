---
phase: 29-recipe-photo-import
plan: 01
subsystem: pipeline, bot, ai
tags: [photo-import, multimodal, claude-vision, base64, message-handler]

requires:
  - phase: 28
    provides: async tool handler, import-to-save flow pattern
provides:
  - Photo message handling in Telegram bot pipeline
  - Multimodal Claude message construction with image content blocks
  - System prompt instructions for photo-based recipe extraction
affects: []

tech-stack:
  added: []
  patterns: [multimodal-content-blocks, message-photo-handler, base64-image-encoding]

key-files:
  modified:
    - src/bot/handlers/message.ts
    - src/pipeline/message-queue.ts
    - src/pipeline/processor.ts
    - src/ai/system-prompt.ts
    - src/bot/index.ts

key-decisions:
  - "Photos go through existing message pipeline -- no separate tool needed"
  - "Claude vision handles OCR + semantic understanding in one step"
  - "Telegram compresses photos to JPEG automatically -- always image/jpeg"
  - "5MB size check before API call (Claude vision limit)"
  - "Non-recipe photos handled naturally by Claude via system prompt instructions"
  - "Photo captions included as text content block alongside image"

patterns-established:
  - "Multimodal message pipeline: image + text content blocks to Claude"
  - "message:photo handler pattern: download -> base64 -> enqueue"

requirements-completed: [IMPORT-02]

duration: 3min
completed: 2026-02-20
---

# Phase 29 Plan 01: Recipe Photo Import Summary

**Recipe photo import via multimodal message pipeline -- photos downloaded, base64-encoded, and sent to Claude as image content blocks**

## Performance

- **Duration:** 3 min
- **Started:** 2026-02-20
- **Completed:** 2026-02-20
- **Tasks:** 2
- **Files modified:** 5

## Accomplishments
- Extended PendingBatch message entries with optional imageBase64 and imageMimeType fields
- Added message:photo handler that downloads images via Telegram API and base64-encodes them
- 5MB size check prevents oversized images from hitting Claude vision API
- Processor builds multimodal Anthropic messages with ImageBlockParam content blocks
- Photos sent alongside text captions as combined content blocks array
- Photo-only messages (no caption) saved as "[photo]" in conversation history
- Added RECIPE PHOTO IMPORT section to system prompt with clear instructions
- System prompt distinguishes recipe photos from food photos from non-food photos
- Handles blurry/unreadable photos gracefully with fill-in-the-gaps approach

## Task Commits

Each task was committed atomically:

1. **Task 1: Message queue and handler photo support** - `d6b92a3` (feat)
2. **Task 2: Multimodal processor and system prompt** - `b38ffb6` (feat)

## Files Modified
- `src/pipeline/message-queue.ts` - Optional imageBase64/imageMimeType on message entries, enqueue params
- `src/bot/handlers/message.ts` - message:photo handler with download, base64, size check
- `src/pipeline/processor.ts` - Multimodal content blocks, image collection from batch
- `src/ai/system-prompt.ts` - RECIPE PHOTO IMPORT section with extraction workflow
- `src/bot/index.ts` - Updated middleware chain comment to note photo support

## Decisions Made
- No new dependencies needed -- Claude vision + native fetch + Buffer.toString("base64") cover everything
- Telegram's JPEG compression is sufficient for recipe text extraction
- Non-recipe photos handled naturally by Claude (no pre-filtering needed)
- Multi-photo batching works automatically via debounce queue

## Deviations from Plan
None -- plan executed exactly as written.

## Issues Encountered
None.

## User Setup Required
None -- uses existing Anthropic API key and Telegram bot token.

## Next Phase Readiness
- Phase complete, ready for transition to Phase 30 (Update Notifications)
- Full recipe import story complete: URL import (Phase 28) + photo import (Phase 29)

---
*Phase: 29-recipe-photo-import*
*Completed: 2026-02-20*
