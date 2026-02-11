# Requirements: HeySous v1.2 Onboarding and Feedback

**Defined:** 2026-02-10
**Core Value:** The recipe brain -- an AI agent that remembers everything about your meals and reasons over that knowledge to help you plan.

## v1.2 Requirements

Requirements for multi-user access, household sharing, guided onboarding, and app feedback.

### Invite System

- [ ] **INVITE-01**: User can join the bot via Telegram deep link invite URL (`t.me/BotName?start=TOKEN`)
- [ ] **INVITE-02**: User is rejected with a friendly message when using an invalid invite token
- [ ] **INVITE-03**: Each invite token can only be used once (single-use, marked redeemed on use)
- [ ] **INVITE-04**: Admin can generate two invite types: household (join existing) and independent (new household)
- [ ] **INVITE-05**: Non-invited users are blocked from all bot features with a message directing them to get an invite
- [ ] **INVITE-06**: Admin can create invite links via `/invite` command

### Multi-User Identity

- [ ] **USER-01**: User identity persisted in users table with Telegram metadata (ID, name, username)
- [ ] **USER-02**: Each user belongs to exactly one household
- [ ] **USER-03**: Admin role assigned to primary user for management commands (invites, costs, feedback)
- [ ] **USER-04**: Claude's system prompt includes current user's name and household context

### Household Sharing

- [ ] **HOUSE-01**: All household members see and can add to the same recipe library
- [ ] **HOUSE-02**: Household shares a single weekly meal plan (any member can create/modify)
- [ ] **HOUSE-03**: Household shares a single active grocery list (any member can check items)
- [ ] **HOUSE-04**: Household shares cooking history so Claude knows what "we" ate recently
- [ ] **HOUSE-05**: Prep reminders are sent to all household members based on the shared plan
- [ ] **HOUSE-06**: Existing single-user data is migrated to a household-of-one preserving all functionality

### Guided Onboarding

- [ ] **ONBD-01**: New user receives a warm welcome message after redeeming an invite
- [ ] **ONBD-02**: Onboarding includes conversational preference Q&A (dietary restrictions, dinner time, stores, comfort level)
- [ ] **ONBD-03**: Onboarding includes a capability tour showing what the bot can do with example interactions
- [ ] **ONBD-04**: Onboarding prompts user to seed 3-5 initial recipes conversationally
- [ ] **ONBD-05**: User can skip onboarding at any time and use the bot with defaults
- [ ] **ONBD-06**: Household members joining an existing household get abbreviated onboarding (personal preferences only)
- [ ] **ONBD-07**: New household members immediately see existing household data (no cold start)
- [ ] **ONBD-08**: Bot learns remaining preferences progressively from conversation after initial setup
- [ ] **ONBD-09**: Onboarding is Claude-driven conversational flow (not a rigid state machine)

### App Feedback

- [ ] **FEED-01**: User can submit app feedback via `/feedback` command with free-text
- [ ] **FEED-02**: Bot confirms feedback submission with a warm acknowledgment
- [ ] **FEED-03**: Claude silently detects app-related sentiment in conversation and logs as implicit feedback
- [ ] **FEED-04**: Mini App hub includes a "Give Feedback" button that opens a text input
- [ ] **FEED-05**: Bot proactively asks "how am I doing?" via periodic check-in (every 2 weeks)
- [ ] **FEED-06**: Feedback is auto-categorized (UX, recipes, planning, grocery, reminders, general)
- [ ] **FEED-07**: Feedback is scored for sentiment (positive/neutral/negative/suggestion)
- [ ] **FEED-08**: Admin can view all collected feedback via command or Mini App dashboard with filtering

## Future Requirements

Deferred to future milestone. Tracked but not in current roadmap.

### Invite Enhancements

- **INVITE-07**: Invite tokens expire after configurable period (default 7 days)
- **INVITE-08**: Invite link shows rich preview message in Telegram chat
- **INVITE-09**: Admin can view invite status dashboard (pending/redeemed/expired)

### Sharing Enhancements

- **HOUSE-07**: Recipes and plan entries show "added by [Name]" attribution
- **HOUSE-08**: Grocery list items show who checked them off
- **HOUSE-09**: Per-user preference profiles that Claude reasons over separately within household context
- **HOUSE-10**: Per-member notification preferences for reminders

### Onboarding Enhancements

- **ONBD-10**: 7-day onboarding recap message summarizing learned preferences

## Out of Scope

Explicitly excluded. Documented to prevent scope creep.

| Feature | Reason |
|---------|--------|
| Self-service registration | Private bot — admin controls access via invites |
| Multi-use invite codes | Loses control over who joins, cannot revoke per-person |
| Group chat support | 1:1 private chat model, sharing via household DB scope |
| Multiple households per user | Massive complexity, one user = one household |
| Role-based permissions beyond admin/member | Household of 2-4 people doesn't need RBAC |
| Form-based onboarding Mini App | Breaks conversational model, bot IS the interface |
| Mandatory onboarding (no skip) | Frustrating, some users want to dive right in |
| In-app star ratings for feedback | Meaningless with 2-3 users, qualitative text is better |
| Feedback reply system | Admin can just message users directly on Telegram |
| Real-time collaboration indicators | WebSocket complexity not justified, 8s polling sufficient |

## Traceability

Which phases cover which requirements. Updated during roadmap creation.

| Requirement | Phase | Status |
|-------------|-------|--------|
| — | — | — |

**Coverage:**
- v1.2 requirements: 28 total
- Mapped to phases: 0
- Unmapped: 28 ⚠️

---
*Requirements defined: 2026-02-10*
*Last updated: 2026-02-10 after initial definition*
