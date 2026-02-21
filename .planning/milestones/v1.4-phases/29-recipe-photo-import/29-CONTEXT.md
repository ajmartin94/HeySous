# Phase 29: Recipe Photo Import - Context

**Created:** 2026-02-20
**Phase goal:** Users can snap a photo of a cookbook page or handwritten recipe and Sous extracts it

## Decision 1: Photo Pipeline Integration

Photos go through the existing message pipeline as multimodal content blocks. No separate tool needed.

**How it works:**
1. `message:photo` handler in message.ts downloads the photo via grammY `ctx.getFile()`
2. Photo is fetched as buffer, base64-encoded, and stored on the batch message entry
3. Processor builds a Claude message with an `image` content block alongside the text
4. Claude sees the image with full system prompt + all tools and handles extraction naturally
5. Claude presents the extracted recipe for confirmation, then saves via existing `save_knowledge`

**Key details:**
- Telegram compresses photos to JPEG automatically
- grammY's `ctx.getFile()` returns a file path valid for ~60 minutes
- Download URL: `https://api.telegram.org/file/bot<token>/<file_path>`
- Claude vision supports JPEG, PNG, GIF, WebP; max 5MB per image
- Photo captions come from `ctx.message.caption` and are included as text alongside the image

## Decision 2: Message Queue Extension

The `PendingBatch.messages` array entries gain optional `imageBase64` and `imageMimeType` fields.

- Photo-only messages use caption (or empty string) as text
- Multiple photos in the debounce window are batched (multi-page recipe support)
- Each photo is a separate image content block in the Claude message

## Decision 3: Non-Recipe Photo Handling

Claude handles this naturally via the system prompt -- no special code needed.

- If someone sends a food photo (not a recipe), Claude responds normally ("That looks delicious!")
- If someone sends a non-food photo, Claude stays in character
- The system prompt section instructs Claude to only offer recipe extraction when the image contains recipe content

## Decision 4: Error Handling

- Photos > 5MB: Check before API call, ask for a smaller version
- Failed downloads: Log and respond with a helpful message
- Blurry/unreadable: Claude handles this naturally -- if it can't read the text, it says so

## Deferred Ideas

- Multi-photo recipe support beyond debounce window (user sends photos minutes apart)
- Document/file uploads (uncompressed images via `message:document`)
- Video frame extraction
