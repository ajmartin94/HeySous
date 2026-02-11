---
status: complete
phase: 15-users-households-invites
source: [15-01-SUMMARY.md, 15-02-SUMMARY.md]
started: 2026-02-11T13:15:00Z
updated: 2026-02-11T14:00:00Z
---

## Current Test

[testing complete]

## Tests

### 1. Bot starts and admin can chat
expected: Bot starts without errors. Admin (you) can send messages and get normal responses. All existing features (recipes, meal plans, grocery lists, reminders) continue to work.
result: issue
reported: "my user ID is in the admin env field, but i'm getting blocked when i message"
severity: major

### 2. Admin /start shows welcome back
expected: Send /start (no deep link, just the bare command). You should see "Welcome back! What can I help you with?" since you're already registered as admin.
result: skipped
reason: blocked by test 1

### 3. Admin /invite generates deep link
expected: Send /invite. You should receive a message with a single-use invite link in the format https://t.me/YourBotName?start=TOKEN (32-char base64url token). The message should say it expires in 7 days.
result: skipped
reason: blocked by test 1

### 4. Admin /invite independent generates solo household link
expected: Send /invite independent. You should receive an invite link similar to the default, but this one will create a brand new household for the invitee (not join yours).
result: skipped
reason: blocked by test 1

### 5. New user redeems valid invite
expected: Have someone (or a second account) click a valid invite link. They should be registered, greeted with a warm welcome message mentioning their name and what HeySous can do. You (admin) should receive a notification that they joined your household.
result: skipped
reason: blocked by test 1

### 6. Invalid or expired invite is rejected
expected: A new user clicking an already-used or expired invite link sees "This invite link is no longer valid. Ask for a new one!" and cannot use the bot.
result: skipped
reason: blocked by test 1

### 7. Unregistered user is blocked
expected: An unregistered user (no invite redeemed) sending any message sees "Hey! I'm an invite-only bot. Ask the person who told you about me for an invite link!" and cannot access any features.
result: skipped
reason: blocked by test 1

## Summary

total: 7
passed: 0
issues: 1
pending: 0
skipped: 6

## Gaps

- truth: "Admin user is seeded and can chat through access gate without being blocked"
  status: failed
  reason: "User reported: my user ID is in the admin env field, but i'm getting blocked when i message"
  severity: major
  test: 1
  root_cause: ""
  artifacts: []
  missing: []
  debug_session: ""
