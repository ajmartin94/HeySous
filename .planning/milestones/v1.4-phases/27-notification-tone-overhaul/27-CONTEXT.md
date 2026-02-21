---
phase: 27-notification-tone-overhaul
type: context
created: 2026-02-20
---

# Phase 27 Context: Notification Tone Overhaul

## Decision 1: Scope of "bot-initiated messages"

**Decision:** Rewrite messages in these categories:
- Access gate (unregistered user message)
- Pipeline error messages (IN_CHARACTER_ERROR, timeout warning)
- Feedback check-in messages (buildCheckinMessage)
- Reminder fallback messages (getFallbackText in reminders/sender.ts)
- Command responses: /feedback empty prompt, /feedback confirmation, /invite messages, /start welcome messages, /grocery no-list message

**Excluded from scope:**
- Debug handler messages (/debug commands are dev-only, not user-facing)
- /costs handler (admin-only)
- Reminder Claude-generated messages (already use Sous personality via system prompt)
- /help handler (already well-formatted, separate structure)
- /preferences handler (AI-generated responses)
- System prompt content (already Sous voice)

## Decision 2: Centralized message module structure

**Decision:** Create `src/bot/messages.ts` as the centralized message module. Each message type is a function that returns a randomly selected variant. Group messages by domain (errors, access, feedback, reminders, commands).

**Pattern:**
```typescript
export function getErrorMessage(): string {
  return pickRandom([
    "Sorry, I'm having trouble thinking right now. Try again in a moment!",
    "My brain just hiccupped -- give me another shot?",
    "I tripped over my own thoughts there. Mind trying again?",
  ]);
}
```

The `pickRandom` utility lives in the same file. Each function has 3-5 variants minimum.

## Decision 3: Variation strategy

**Decision:** Simple random selection from an array of variants. No tracking of which variant was last used (unnecessary complexity for the small number of messages). Each message type gets 3-5 variants that all convey the same information but with different phrasing.

All variants must:
- Sound like Sous (warm, friendly kitchen companion)
- Use HTML formatting (no markdown)
- Convey the same functional information
- Not include emojis (per project convention)

## Decision 4: Feedback check-in messages

**Decision:** The feedback sender's `buildCheckinMessage` should use the centralized module. The message still needs to be dynamic (interpolating recipe names), so the message functions accept parameters. Variants wrap around the dynamic content differently.

Example: "How was the <b>Chicken Parm</b> tonight?" becomes variants like:
- "How was the <b>Chicken Parm</b> tonight?"
- "How'd <b>Chicken Parm</b> turn out?"
- "So... <b>Chicken Parm</b> night! How was it?"

## Decision 5: Migration approach

**Decision:** Import from centralized module and replace inline strings. Existing behavior stays the same -- just the text changes. No functional changes to any handler logic. This is a pure text replacement refactor with added variation.

---
*Phase: 27-notification-tone-overhaul*
*Created: 2026-02-20 (auto-generated during --auto advance)*
