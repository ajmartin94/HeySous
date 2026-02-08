# Roadmap: HeySous Meal Planning Assistant

## Overview

HeySous is a conversational AI meal planning assistant on Telegram, powered by Claude. The roadmap builds from bot infrastructure through foundational knowledge systems to complete user-facing features. Phases 1-3 establish the agent-first architecture (bot transport, LLM reasoning, knowledge retrieval). Phases 4-5 deliver the first real capabilities (recipes and preferences). Phases 6-8 build the full planning workflow (meal plans, grocery lists, reminders). Phase 9 closes the learning loop with post-meal feedback. Each phase delivers an independently verifiable capability.

## Phases

**Phase Numbering:**
- Integer phases (1, 2, 3): Planned milestone work
- Decimal phases (2.1, 2.2): Urgent insertions (marked with INSERTED)

Decimal phases appear between their surrounding integers in numeric order.

- [x] **Phase 1: Bot Foundation** - Working Telegram bot with proper message formatting and delivery
- [x] **Phase 2: Async Pipeline & Claude Integration** - Bot processes messages asynchronously through Claude and responds intelligently
- [x] **Phase 3: Knowledge System & Retrieval** - Agent retrieves relevant context per conversation within a token budget
- [x] **Phase 4: Recipe Knowledge** - Users can teach the bot recipes and retrieve them conversationally
- [x] **Phase 5: Preference Learning** - System remembers user preferences and applies them as active constraints
- [x] **Phase 6: Meal Planning** - Users can generate and adjust weekly dinner plans through conversation
- [ ] **Phase 7: Grocery Lists** - Grocery lists generated from meal plans with aggregation and store splitting
- [ ] **Phase 8: Reminders** - Proactive daily prep summaries and time-aware reminders that survive restarts
- [ ] **Phase 9: Feedback Loop** - Post-meal check-ins that annotate recipes and improve future planning

## Phase Details

### Phase 1: Bot Foundation
**Goal**: User can message the bot on Telegram and receive properly formatted, reliably delivered responses
**Depends on**: Nothing (first phase)
**Requirements**: INFRA-01, INFRA-03, INFRA-04, INFRA-05
**Success Criteria** (what must be TRUE):
  1. User sends a message on Telegram and receives a response from the bot
  2. Bot responses render with clean HTML formatting (bold, italic, lists) in Telegram
  3. Long responses arrive as multiple messages split at natural paragraph boundaries, not mid-sentence
  4. User sees a "typing..." indicator while the bot is preparing a response
**Plans**: 3 plans

Plans:
- [x] 01-01-PLAN.md -- Project scaffolding (Node.js, TypeScript, grammY, SQLite/Drizzle, database setup)
- [x] 01-02-PLAN.md -- Telegram bot connection (bot instance, webhook/polling server, handlers, typing indicator)
- [x] 01-03-PLAN.md -- Message formatting and delivery (TDD: HTML formatter, message splitter, reliable sender)

### Phase 2: Async Pipeline & Claude Integration
**Goal**: Bot processes messages through Claude asynchronously, responding with intelligent conversation while tracking costs
**Depends on**: Phase 1
**Requirements**: INFRA-02, INFRA-06, AGENT-01, AGENT-04, AGENT-05
**Success Criteria** (what must be TRUE):
  1. Bot acknowledges webhook within 2 seconds and processes Claude response asynchronously (no Telegram timeouts)
  2. User sends a message and receives a contextually relevant, conversational response from Claude (not echo or static)
  3. Rapid consecutive messages are batched into a single Claude call rather than triggering multiple parallel calls
  4. Token usage is logged per request with conversation type tags visible in logs
  5. System prompt content benefits from prompt caching (verifiable via API response cache metrics)
**Plans**: 3 plans

Plans:
- [x] 02-01-PLAN.md -- Config, Claude client, system prompt, and token usage schema (Anthropic SDK, Sous persona, cost tracking DB)
- [x] 02-02-PLAN.md -- Message debounce queue (TDD: sliding window batching for rapid consecutive messages)
- [x] 02-03-PLAN.md -- Pipeline processor and end-to-end wiring (retry/timeout logic, /costs command, async flow integration)

### Phase 3: Knowledge System & Retrieval
**Goal**: Agent retrieves relevant knowledge per conversation and manages conversation context within a token budget
**Depends on**: Phase 2
**Requirements**: AGENT-02, AGENT-03, AGENT-06
**Success Criteria** (what must be TRUE):
  1. Agent retrieves relevant stored knowledge (not full dump) before each Claude call, staying within ~4K token budget
  2. Agent decides what to look up based on conversation context -- no hardcoded query paths per feature
  3. Conversation context is maintained within a session; older turns are summarized to stay within budget
**Plans**: 3 plans

Plans:
- [x] 03-01-PLAN.md -- Knowledge storage layer (schema, FTS5 index, repository CRUD, token budget utilities)
- [x] 03-02-PLAN.md -- Retrieval service and tool interface (two-pass search, tool definitions, tool dispatcher)
- [x] 03-03-PLAN.md -- Pipeline integration (conversation context, tool use loop, /debug command, end-to-end wiring)

### Phase 4: Recipe Knowledge
**Goal**: Users can teach the bot their recipes through conversation and retrieve them anytime
**Depends on**: Phase 3
**Requirements**: RECIPE-01, RECIPE-02, RECIPE-03, RECIPE-04, RECIPE-05, RECIPE-06
**Success Criteria** (what must be TRUE):
  1. User can describe a recipe conversationally and the bot captures it (ingredients, steps, times, notes)
  2. Bot confirms captured recipe back to user for verification before saving
  3. User can ask for any stored recipe by name or description and see it formatted clearly in chat
  4. User can update a stored recipe through conversation ("the stromboli actually takes 70 minutes")
  5. Recipes are stored as rich context the agent retrieves and reasons over, not as rigid database records
**Plans**: 3 plans

Plans:
- [x] 04-01-PLAN.md -- Write tool infrastructure (changelog schema, save/update/delete tools, tool handler dispatch, formatter blockquote)
- [x] 04-02-PLAN.md -- Recipe system prompt (creation flow, content format, display format, tag taxonomy, updates, deletion, reasoning)
- [x] 04-03-PLAN.md -- Pipeline wiring (max iterations bump, processor + main.ts dependency injection, end-to-end integration)

### Phase 5: Preference Learning
**Goal**: System remembers user preferences across conversations and actively applies them as constraints
**Depends on**: Phase 3
**Requirements**: PREF-01, PREF-02, PREF-03, PREF-04
**Success Criteria** (what must be TRUE):
  1. User states a preference ("dinner is at 6pm", "no shellfish") and it persists across conversations
  2. Preferences actively influence agent behavior -- allergies excluded from suggestions, not just stored
  3. User can update preferences conversationally and the change takes effect immediately
  4. Dietary restrictions are treated as hard constraints that are never violated in suggestions
**Plans**: 2 plans

Plans:
- [x] 05-01-PLAN.md -- Preference retrieval, system prompt injection, and processor integration (preference loading, constraint instructions, tool description updates)
- [x] 05-02-PLAN.md -- /preferences command handler and bot wiring (formatted display, category grouping, main.ts integration)

### Phase 6: Meal Planning
**Goal**: Users can generate and adjust a weekly dinner plan through conversation, informed by their recipes and preferences
**Depends on**: Phase 4, Phase 5
**Requirements**: PLAN-01, PLAN-02, PLAN-03, PLAN-04, PLAN-05
**Success Criteria** (what must be TRUE):
  1. User can request a weekly dinner plan and receive one generated from their stored recipes
  2. Generated plan respects user preferences, constraints, and recent cooking history
  3. User can adjust the plan conversationally ("swap Thursday and Friday", "something easier on Tuesday")
  4. Plan surfaces recipes that haven't been made recently to avoid repetition
  5. System tracks what was planned/cooked and when, building cooking history over time
**Plans**: 3 plans

Plans:
- [x] 06-01-PLAN.md -- Meal plan data layer (schema, repository, date utils, cooking history, context builder)
- [x] 06-02-PLAN.md -- Claude tools and system prompt (plan tool definitions, tool handler dispatch, planning instructions, context injection)
- [x] 06-03-PLAN.md -- Pipeline wiring and /plan command (/plan handler, processor integration, main.ts wiring, auto-marking)

### Phase 7: Grocery Lists
**Goal**: Grocery lists are automatically generated from meal plans with smart aggregation and store-aware organization
**Depends on**: Phase 6
**Requirements**: GROCERY-01, GROCERY-02, GROCERY-03, GROCERY-04, GROCERY-05
**Success Criteria** (what must be TRUE):
  1. Grocery list is generated automatically from the active meal plan
  2. Ingredients are aggregated across recipes (3 recipes needing onions = one combined entry, not three)
  3. List is split between Kroger and Costco based on learned store preferences
  4. User can check off items through conversation or inline interaction
  5. List is organized by store section where possible
**Plans**: 4 plans

Plans:
- [ ] 07-01-PLAN.md -- Grocery data layer (schema, table init, repository CRUD with factory function)
- [ ] 07-02-PLAN.md -- Claude tools and system prompt (GROCERY_TOOLS, tool handler dispatch, grocery instructions, context builder)
- [ ] 07-03-PLAN.md -- Telegram interaction utilities (inline keyboard builder, HTML list formatter with strikethrough)
- [ ] 07-04-PLAN.md -- Pipeline wiring and /grocery command (callback handler, bot registration, main.ts wiring, post-loop message editing)

### Phase 8: Reminders
**Goal**: System proactively sends prep reminders that survive restarts and respect the user's schedule
**Depends on**: Phase 6
**Requirements**: REMIND-01, REMIND-02, REMIND-03, REMIND-04, REMIND-05
**Success Criteria** (what must be TRUE):
  1. User receives a morning prep summary -- what's for dinner, what needs doing today
  2. Time-aware reminders fire based on recipe analysis ("defrost chicken by 8am")
  3. Reminders persist across process restarts -- no lost reminders on deploy or crash
  4. All reminders respect the user's timezone
  5. User can mute or adjust reminders through conversation
**Plans**: TBD

Plans:
- [ ] 08-01: Reminder data layer (persistent storage, UTC times, timezone handling)
- [ ] 08-02: Daily prep summary (morning message generation, meal plan integration)
- [ ] 08-03: Time-aware reminders (recipe analysis for prep timing, reminder scheduling, poller)
- [ ] 08-04: Reminder management (mute, adjust, snooze through conversation)

### Phase 9: Feedback Loop
**Goal**: System learns from post-meal check-ins, annotating recipes with real-world data that improves future planning
**Depends on**: Phase 6
**Requirements**: FEED-01, FEED-02, FEED-03, FEED-04
**Success Criteria** (what must be TRUE):
  1. Bot offers optional post-meal check-in ("How was dinner?") at appropriate times
  2. Feedback is stored as recipe annotations (actual time, what worked, what to change next time)
  3. Check-ins are low-friction and infrequent -- not every meal, never feels like homework
  4. Accumulated feedback visibly influences future planning and recipe suggestions
**Plans**: TBD

Plans:
- [ ] 09-01: Post-meal check-in (scheduling, prompt design, low-friction interaction)
- [ ] 09-02: Feedback storage and application (recipe annotations, actual times, influence on future planning)

## Progress

**Execution Order:**
Phases execute in numeric order: 1 -> 2 -> 3 -> 4 -> 5 -> 6 -> 7 -> 8 -> 9
(Phases 4 and 5 can execute in parallel after Phase 3. Phases 7, 8, and 9 can execute in parallel after Phase 6.)

| Phase | Plans Complete | Status | Completed |
|-------|----------------|--------|-----------|
| 1. Bot Foundation | 3/3 | Complete | 2026-02-06 |
| 2. Async Pipeline & Claude Integration | 3/3 | Complete | 2026-02-06 |
| 3. Knowledge System & Retrieval | 3/3 | Complete | 2026-02-06 |
| 4. Recipe Knowledge | 3/3 | Complete | 2026-02-06 |
| 5. Preference Learning | 2/2 | Complete | 2026-02-06 |
| 6. Meal Planning | 3/3 | Complete | 2026-02-07 |
| 7. Grocery Lists | 0/4 | Not started | - |
| 8. Reminders | 0/4 | Not started | - |
| 9. Feedback Loop | 0/2 | Not started | - |
