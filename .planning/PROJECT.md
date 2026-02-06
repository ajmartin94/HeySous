# Meal Planning Assistant

## What This Is

A conversational AI assistant on Telegram that helps a home cook plan meals, manage grocery shopping, and improve over time. The bot is powered by Claude, remembers recipes and preferences through conversation, and reaches into your life with timely prep reminders. No forms, no settings screens — you talk to it like a partner who happens to have perfect memory.

## Core Value

The recipe brain — the system remembers everything about your meals (recipes, your actual prep times, what worked, what didn't) and reasons over that knowledge to help you plan. If this doesn't work, nothing else matters.

## Requirements

### Validated

(None yet — ship to validate)

### Active

- [ ] Conversational recipe entry — tell the bot about a recipe and it captures and stores it
- [ ] Recipe retrieval — ask for any stored recipe and see it formatted in chat
- [ ] Recipe learning — system remembers your notes, actual times, and feedback per recipe
- [ ] Weekly meal planning — generate a week of dinners based on your recipes, constraints, and preferences
- [ ] Grocery list generation — aggregate ingredients from the plan into a text-based shopping list in chat
- [ ] Daily prep reminder — simple morning message summarizing what needs doing today (defrost, marinate, etc.)
- [ ] Optional post-meal check-in — bot offers to capture how dinner went, learnable feedback loop
- [ ] Preference learning — system accumulates knowledge from conversation (dinner time, stores, allergies, goals)
- [ ] Pivot assistance — help finding alternatives when plans fall apart, using knowledge of your kitchen

### Out of Scope

- Mini Apps (Telegram rich UI) — deferring to keep v1 simple, bot-only interface first
- URL recipe import — conversational entry sufficient for v1
- Photo/image recipe capture — requires vision pipeline, defer
- Multi-user / partner access — solo user first, shared household later
- Full proactive reminders (event-driven, time-calculated) — simple daily morning summary instead
- Voice interaction / cooking mode — future capability
- Post-cooking auto-capture ("remember what we made") — user will describe recipes explicitly
- Monetization / paid features — personal dogfooding first

## Context

- **Primary user:** Home cook who loves cooking, time-constrained on weekdays, more flexible weekends
- **Household:** Partner + 9-month-old. Partner collaboration deferred to v2.
- **Dinner target:** 6pm daily
- **Shopping:** Kroger (primary), Costco (bulk)
- **Devices:** Apple ecosystem (iPhone, iPad) — Telegram works cross-platform
- **First-run flow:** User seeds 10-15 rotating recipes before planning first week
- **Existing spec:** Detailed product spec exists in `meal-planning-assistant-spec-v2.md`

## Constraints

- **Platform**: Telegram Bot API — conversation-first, push notifications via Telegram
- **AI**: Claude as the reasoning engine — called on-demand, not running continuously
- **Architecture**: Thin backend orchestrator — handles webhooks, storage, scheduling; Claude reasons on demand
- **Language/Framework**: TBD — research phase will determine best fit
- **Hosting**: TBD — research phase will determine (needs webhook handling, scheduled jobs, data persistence)
- **Knowledge storage**: TBD — critical architecture decision, research needed (how Claude accesses recipe library at scale)
- **Interface**: Bot conversation only for v1 — no Mini Apps, no web UI
- **Users**: Single user for v1

## Key Decisions

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| Telegram as platform | Conversational interface native and polished, push notifications reliable, Mini Apps available later, no app store process | — Pending |
| Bot-only v1 (no Mini Apps) | Reduces frontend complexity significantly, text-based lists workable for solo user | — Pending |
| Solo user first | Defer multi-user complexity, get core working for primary user | — Pending |
| Conversational recipe entry only | Simplest entry method, no URL scraping or vision pipeline needed | — Pending |
| Simple daily prep reminder over full proactive system | Morning summary much simpler than event-driven scheduling, still solves core problem | — Pending |
| Claude as reasoning engine (not continuous) | Called on-demand via thin orchestrator, not running 24/7 — cost-effective and architecturally clean | — Pending |
| Research knowledge storage approach | Load-bearing decision: how Claude accesses growing recipe library. Needs proper investigation. | — Pending |
| Research language/framework/hosting | Let domain research inform stack choice rather than premature commitment | — Pending |

---
*Last updated: 2026-02-05 after initialization*
