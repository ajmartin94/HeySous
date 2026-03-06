# Phase 54: Hide Release Notes for New Users - Context

**Gathered:** 2026-03-06
**Status:** Ready for planning

<domain>
## Phase Boundary

Prevent new users from seeing release notes that were published before they joined. Only deliver notifications created AFTER the user's account creation timestamp.

</domain>

<decisions>
## Implementation Decisions

### Filtering approach
- Compare `notifications.created_at` against `users.created_at`
- In `checkPendingNotification()`, add a WHERE clause: `n.created_at > ?` with the user's creation timestamp
- This requires passing the user's creation timestamp (or looking it up) in the notification check

### Claude's Discretion
- Whether to pass user creation time as a parameter or look it up in the query
- Any edge cases around exact timestamp matching (same-second creation)

</decisions>

<specifics>
## Specific Ideas

- Currently ALL unseen notifications are delivered to ALL users regardless of join date
- Mike (joined 2026-03-05) would have received v1.4 and v1.5 release notes on his first interaction
- Simple timestamp comparison is sufficient — no need for complex logic

</specifics>

<code_context>
## Existing Code Insights

### Reusable Assets
- `src/notifications/update-notifier.ts` — `checkPendingNotification(sqlite, userId)` is the function to modify
- `src/notifications/release-notes.ts` — static RELEASE_NOTES record

### Established Patterns
- Notifications seeded on startup via `seedNotifications()`
- Lazy delivery: checked during message processing before Claude call
- Delivery tracked in `notification_deliveries` table

### Integration Points
- `processor.ts` calls `checkPendingNotification(sqlite, userId)` — may need to pass user creation timestamp
- `users` table has `created_at` column (unix timestamp)
- `notifications` table has `created_at` column

</code_context>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope

</deferred>

---

*Phase: 54-hide-release-notes-for-new-users*
*Context gathered: 2026-03-06*
