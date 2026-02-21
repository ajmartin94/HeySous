# Phase 30: Update Notifications - Context

**Created:** 2026-02-20
**Phase goal:** Users learn about new bot capabilities naturally through conversational "what's new" messages on their next interaction

## Decision 1: Lazy Delivery Pattern

Notifications are delivered lazily -- when a user sends a message, the processor checks if there are unseen notifications and sends them before processing the user's message.

**Why lazy delivery over startup broadcast:**
- Matches success criteria: "next time a user sends a message"
- No rate limit concerns (one notification per user interaction)
- Only reaches active users (no wasted sends to dormant accounts)
- No timing issues with tsx watch restarts in dev mode
- Simpler error handling (one send at a time, errors don't cascade)

## Decision 2: Schema Design

Two tables via migration:
- `notifications` -- stores notification content (version, message text)
- `notification_deliveries` -- tracks which households have seen which notifications

Version tracking uses the notification ID, not a version column on the users table. This supports multiple notifications and arbitrary ordering.

## Decision 3: Notification Content

Release notes are defined in code as a simple TypeScript record. Notifications are hand-written in Sous's voice, not auto-generated.

Example for v1.4:
"Hey, I picked up a few new tricks! You can now send me recipe links and I'll save them for you. I can also read recipe photos -- just snap a picture of a cookbook page or recipe card. Oh, and I'm better at catching duplicate recipes now."

## Decision 4: Integration Point

The lazy delivery check happens in the pipeline processor, after saving the incoming message but before the Claude call. If a notification is pending, it's sent as a separate Telegram message, the delivery is recorded, and processing continues normally.

## Deferred Ideas

- Admin /notify command for custom notifications
- Rich media notifications (images, inline buttons)
- Per-feature notification targeting
