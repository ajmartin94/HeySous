---
phase: 09-feedback-loop
plan: 02
subsystem: feedback
tags: [feedback, callback-handler, extractor, system-prompt, tools, pipeline-wiring]

dependency-graph:
  requires: [09-01]
  provides: [feedback-callback-handler, feedback-extractor, feedback-context, feedback-prompt, record-feedback-tool, full-pipeline-wiring]
  affects: []

tech-stack:
  added: []
  patterns: [factory-function, callback-passthrough, claude-extraction, content-annotation, system-prompt-injection]

key-files:
  created:
    - src/feedback/handler.ts
    - src/feedback/extractor.ts
    - src/feedback/context.ts
    - src/bot/handlers/feedback.ts
  modified:
    - src/ai/system-prompt.ts
    - src/ai/tools.ts
    - src/ai/tool-handler.ts
    - src/bot/index.ts
    - src/db/index.ts
    - src/pipeline/processor.ts
    - src/main.ts
    - src/reminders/poller.ts
    - src/reminders/sender.ts

decisions:
  - "[09-02]: Feedback annotation appended to recipe content with 'Feedback:' section format"
  - "[09-02]: FEEDBACK_PROMPT always included in system prompt (matches REMINDER_PROMPT pattern)"
  - "[09-02]: FeedbackCheckin type imported directly in poller (not redefined as minimal interface)"
  - "[09-02]: Free-text feedback handler registered before catch-all messageHandler"
  - "[09-02]: Deprioritization threshold: net score -2 (positive=+1, negative=-1)"
  - "[09-02]: feedbackContext injected after reminderContext in system prompt template"

metrics:
  duration: "7 min"
  completed: "2026-02-09"
---

# Phase 9 Plan 2: Feedback Loop Integration Summary

**One-liner:** Complete feedback loop wiring -- button taps and free-text replies annotate recipes, Claude references past feedback in suggestions via FEEDBACK_PROMPT and record_feedback tool.

## What Was Built

### Feedback Callback Handler (`src/feedback/handler.ts`)
- Factory function `createFeedbackCallbackHandler` returns a Composer that handles `callback_query:data` events
- Parses feedback callback data (f:{sentiment}:{reminderId} format), passes non-feedback callbacks via next()
- Maps compact sentiment abbreviations (pos/ok/neg/skip) to full FeedbackSentiment values
- Records response via feedbackRepository.recordResponse()
- Edits check-in message to show sentiment-specific confirmation (removes inline keyboard)
- For non-skipped sentiments: parses mealsJson, looks up each recipe's knowledge item, appends a "Feedback:" annotation to content
- Silently handles GrammyError "message is not modified" (same as grocery callback handler)

### Feedback Extractor (`src/feedback/extractor.ts`)
- `extractFeedback(text, claudeClient)` uses a focused system prompt to extract { sentiment, notes } from free text
- Focused extraction prompt (not full Sous persona) for efficiency
- Falls back to { sentiment: "neutral", notes: text } if Claude API or JSON parsing fails

### Feedback Context Builder (`src/feedback/context.ts`)
- `buildFeedbackContext(sqlite, chatId)` queries responded check-ins from last 14 days
- JOINs with reminders table to get recipe names from context_json
- Returns `<feedback_context>` XML block with recipe name, date, sentiment, and notes

### FEEDBACK_PROMPT (system-prompt.ts)
- New constant with instructions for referencing past feedback, influence rules, recipe update proposals, and tool usage
- Deprioritization threshold: net score -2 or below
- Always included in system prompt (matches REMINDER_PROMPT, GROCERY_LIST_PROMPT pattern)
- feedbackContext parameter added as optional 5th param to buildSystemPrompt

### FEEDBACK_TOOLS and record_feedback Tool
- `FEEDBACK_TOOLS` exported from tools.ts with record_feedback tool definition
- Tool handler case appends feedback annotation to recipe content ("Feedback:" section)
- Logs change to knowledgeChangelog
- Returns confirmation message with sentiment and notes

### Free-Text Feedback Handler (`src/bot/handlers/feedback.ts`)
- Factory function `createFeedbackTextHandler` returns a Composer for `message:text` events
- Detects replies to check-in messages via reply_to_message + getPendingSentCheckins
- Uses extractFeedback to parse sentiment/notes from free text via Claude
- Records response and annotates recipe knowledge items
- Sends natural confirmation with recipe update proposal if actionable notes present
- Registered before catch-all messageHandler in bot middleware chain

### Full Pipeline Wiring
- db/index.ts: initializeFeedback added to database initialization chain
- pipeline/processor.ts: feedbackContext injected into system prompt, FEEDBACK_TOOLS added to allTools
- bot/index.ts: feedbackCallbackHandler registered after groceryCallbackHandler, feedbackTextHandler before messageHandler
- reminders/poller.ts: routes feedback_checkin reminders to dedicated feedbackSender
- reminders/sender.ts: feedback_checkin cases added to prevent errors if one reaches regular sender
- main.ts: creates feedbackRepository, feedbackSender, both handlers; startup regenerates feedback check-ins and expires old ones

## Task Commits

| Task | Name | Commit | Key Changes |
|------|------|--------|-------------|
| 1 | Feedback callback handler, extractor, context, system prompt, and tools | 73ce53d | 3 new files + 3 modified |
| 2 | Pipeline wiring and bot integration | 0777422 | 1 new file + 6 modified |

## Decisions Made

1. **Feedback annotation format**: Recipe content gets a "Feedback:" section with entries like `- YYYY-MM-DD [sentiment]: notes`. Appended to existing section if present, new section added if not.
2. **FEEDBACK_PROMPT always included**: Matches the pattern of MEAL_PLANNING_PROMPT, GROCERY_LIST_PROMPT, and REMINDER_PROMPT -- always present regardless of whether feedback context exists.
3. **FeedbackCheckin type imported in poller**: Rather than defining a minimal interface, imported the FeedbackCheckin type directly from feedback/types.ts for type compatibility with the sender.
4. **Free-text handler position**: Registered before the catch-all messageHandler but after all command handlers, so reply-to-checkin messages are caught before entering normal conversation flow.
5. **Deprioritization threshold**: Net score -2 (positive counts as +1, negative as -1) -- encoded in FEEDBACK_PROMPT instructions for Claude.
6. **feedbackContext after reminderContext**: Injected in system prompt template after reminder context and before the always-on prompt sections.

## Deviations from Plan

None -- plan executed exactly as written.

## Next Phase Readiness

This is the final plan of the final phase (9 of 9). The full feedback loop is now wired end-to-end:
- Generator creates feedback_checkin reminders from meal plan data
- Poller picks them up and routes to the dedicated feedback sender
- Feedback sender delivers check-in messages with inline sentiment buttons
- Button taps record sentiment and annotate recipe knowledge items
- Free-text replies are parsed by Claude to extract sentiment and notes
- Feedback context is injected into the system prompt for Claude to reference
- FEEDBACK_PROMPT teaches Claude to reference past feedback in suggestions and propose recipe updates
- record_feedback tool enables conversational feedback capture

All 9 phases are now complete.

## Self-Check: PASSED
