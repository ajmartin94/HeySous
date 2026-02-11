---
status: complete
phase: 15-users-households-invites
source: [15-01-SUMMARY.md, 15-02-SUMMARY.md]
started: 2026-02-11T14:30:00Z
updated: 2026-02-11T15:00:00Z
---

## Current Test

[testing complete]

## Tests

### 1. Bot starts and admin can chat
expected: Bot starts without errors. Admin (you) can send messages and get normal responses. All existing features (recipes, meal plans, grocery lists, reminders) continue to work.
result: pass

### 2. Admin /start shows welcome back
expected: Send /start (no deep link, just the bare command). You should see "Welcome back! What can I help you with?" since you're already registered as admin.
result: pass

### 3. Admin /invite generates deep link
expected: Send /invite. You should receive a message with a single-use invite link in the format https://t.me/YourBotName?start=TOKEN (32-char base64url token). The message should say it expires in 7 days.
result: pass

### 4. Admin /invite independent generates solo household link
expected: Send /invite independent. You should receive an invite link similar to the default, but this one will create a brand new household for the invitee (not join yours).
result: pass

### 5. New user redeems valid invite
expected: Have someone (or a second account) click a valid invite link. They should be registered, greeted with a warm welcome message mentioning their name and what HeySous can do. You (admin) should receive a notification that they joined your household.
result: pass (after fix)

### 6. Invalid or expired invite is rejected
expected: A new user clicking an already-used or expired invite link sees "This invite link is no longer valid. Ask for a new one!" and cannot use the bot.
result: pass

### 7. Unregistered user is blocked
expected: An unregistered user (no invite redeemed) sending any message sees "Hey! I'm an invite-only bot. Ask the person who told you about me for an invite link!" and cannot access any features.
result: pass

## Summary

total: 7
passed: 7
issues: 0
pending: 0
skipped: 0

## Gaps

[all resolved]
