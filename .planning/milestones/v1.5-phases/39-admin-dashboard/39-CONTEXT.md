# Phase 39: Admin Dashboard - Context

**Gathered:** 2026-02-24
**Status:** Ready for planning

<domain>
## Phase Boundary

Visual admin dashboard within the Mini App showing system health, usage patterns, costs, and user feedback. Admin-only access gated by user ID. No database modifications from the dashboard — read-only views of existing data.

</domain>

<decisions>
## Implementation Decisions

### Dashboard location & access
- Lives as a new route in the existing Mini App (not standalone)
- Admin access gated by user IDs configured via `.env` (not household IDs)
- Visible as a bottom nav tab — only rendered for admin users
- Manual refresh only — data loads on page open, pull-to-refresh or refresh button to update (no polling)

### Activity feed
- Comprehensive event log: messages, tool calls, errors, onboarding events, feedback, system events — everything
- Default view: last 50 events, with option to load more
- Each event labeled with user name/ID (not household)
- Filtering: by event type AND by specific user — both filters available

### Stats & cost display
- Summary cards at top (big numbers: messages today, active users, tool call count)
- Expandable charts below for trend detail (line/bar charts)
- Three switchable time ranges: today, 7 days, 30 days
- Cost breakdown: per-model (Haiku/Sonnet/Opus) AND per-user attribution
- Daily spend shown against the daily token budget configured in Phase 36 (budget line on chart)

### Feedback overview
- App feedback only — meal feedback (check-ins) excluded from dashboard
- Summary stats at top (total count, recent trend), then individual entries below
- Each entry shows user, timestamp, and full text
- Read-only — no actions, no status toggles, no replies from the dashboard
- No sentiment analysis — raw entries displayed as-is

### Claude's Discretion
- Chart library choice and visual styling
- Activity feed event formatting and iconography
- Summary card layout and exact metrics displayed
- How to handle the "load more" pagination in the activity feed
- API endpoint structure for dashboard data
- How to aggregate stats (pre-computed vs on-demand queries)

</decisions>

<specifics>
## Specific Ideas

- Admin user IDs in `.env`, not household-based — the admin concept is per-user
- Budget line on cost chart ties back to the daily token budget from Phase 36 enforcement
- Activity feed should feel like a monitoring tool — comprehensive, filterable, chronological

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope

</deferred>

---

*Phase: 39-admin-dashboard*
*Context gathered: 2026-02-24*
