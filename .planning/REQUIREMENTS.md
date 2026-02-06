# Requirements: HeySous (Meal Planning Assistant)

**Defined:** 2026-02-05
**Core Value:** The recipe brain — an AI agent that remembers everything about your meals and reasons over that knowledge to help you plan.

**Architectural Principle:** Agent-first, not database-first. The LLM reasons over a knowledge store. Capabilities emerge from good context + good reasoning, not from individually coded database features.

## v1 Requirements

Requirements for initial release. Each maps to roadmap phases.

### Bot Infrastructure (INFRA)

- [ ] **INFRA-01**: Bot receives Telegram messages and responds conversationally
- [ ] **INFRA-02**: Webhook acknowledged within 2 seconds; Claude processing happens asynchronously
- [ ] **INFRA-03**: Messages formatted in HTML parse mode with graceful fallback if formatting fails
- [ ] **INFRA-04**: Long responses split at natural boundaries (Telegram 4096 char limit)
- [ ] **INFRA-05**: "Typing..." indicator shown while Claude is processing
- [ ] **INFRA-06**: Rapid consecutive messages debounced/batched before processing

### Agent & Knowledge System (AGENT)

- [ ] **AGENT-01**: Claude receives a system prompt defining its role as a cooking partner with the user's context
- [ ] **AGENT-02**: Agent retrieves relevant knowledge (recipes, preferences, history) per conversation within a token budget (~4K tokens)
- [ ] **AGENT-03**: Agent decides what to look up based on conversation context — no hardcoded query paths
- [ ] **AGENT-04**: Prompt caching applied to stable system prompt content (90% cost reduction on cached portion)
- [ ] **AGENT-05**: Token usage logged per request, tagged by conversation type, for cost monitoring
- [ ] **AGENT-06**: Conversation context maintained within a session; older turns summarized to stay within budget

### Recipe Knowledge (RECIPE)

- [ ] **RECIPE-01**: User can tell the bot about a recipe conversationally and the bot captures and stores it
- [ ] **RECIPE-02**: Bot confirms captured recipe back to user for verification before persisting
- [ ] **RECIPE-03**: User can ask for any stored recipe and see it formatted in chat
- [ ] **RECIPE-04**: User can update a recipe through conversation ("the stromboli actually takes 70 minutes, not 45")
- [ ] **RECIPE-05**: System stores user's notes, actual prep times, and feedback alongside each recipe
- [ ] **RECIPE-06**: Recipes stored as rich text context the agent can retrieve and reason over

### Meal Planning (PLAN)

- [ ] **PLAN-01**: User can request a weekly dinner plan through conversation
- [ ] **PLAN-02**: Plan generated from user's stored recipes, respecting preferences, constraints, and recent history
- [ ] **PLAN-03**: User can adjust the plan conversationally ("swap Thursday and Friday", "something easier on Tuesday")
- [ ] **PLAN-04**: Plan considers what hasn't been made recently to surface forgotten favorites
- [ ] **PLAN-05**: Cooking history tracked — what was planned/cooked and when

### Grocery List (GROCERY)

- [ ] **GROCERY-01**: Grocery list generated from the active meal plan
- [ ] **GROCERY-02**: Ingredients aggregated across recipes (3 recipes needing onions = total quantity, not 3 separate entries)
- [ ] **GROCERY-03**: List split between Kroger and Costco based on learned preferences
- [ ] **GROCERY-04**: User can check off items through conversation or inline interaction
- [ ] **GROCERY-05**: List organized by store section where possible

### Reminders (REMIND)

- [ ] **REMIND-01**: Daily prep summary sent each morning — what's for dinner, what needs doing
- [ ] **REMIND-02**: Time-aware prep reminders based on recipe analysis ("defrost chicken by 8am")
- [ ] **REMIND-03**: Reminders persist across process restarts (database-backed, not in-memory)
- [ ] **REMIND-04**: Reminders respect user's timezone
- [ ] **REMIND-05**: User can mute or adjust reminders through conversation

### Preference Learning (PREF)

- [ ] **PREF-01**: System remembers stated preferences across conversations (dinner time, allergies, cooking goals, stores)
- [ ] **PREF-02**: Preferences actively influence planning — allergies excluded from suggestions, not just stored
- [ ] **PREF-03**: User can update preferences conversationally ("actually, dinner is at 6:30 now")
- [ ] **PREF-04**: Dietary restrictions treated as hard constraints (never violated in suggestions)

### Feedback Loop (FEED)

- [ ] **FEED-01**: Bot offers optional post-meal check-in ("How was dinner?")
- [ ] **FEED-02**: Feedback stored as recipe annotations (actual time, what worked, what to change)
- [ ] **FEED-03**: Check-ins are low-friction and infrequent — not every meal, not homework
- [ ] **FEED-04**: Accumulated feedback influences future planning and recipe suggestions

## v2 Requirements

Deferred to future release. Tracked but not in current roadmap.

### Enhanced Interface

- **UI-01**: Telegram Mini App for grocery list (checkboxes, real-time updates)
- **UI-02**: Mini App for weekly plan view (visual calendar)
- **UI-03**: Mini App for recipe display (formatted, scrollable)

### Multi-User

- **MULTI-01**: Partner can interact with the bot independently
- **MULTI-02**: Shared meal plan visible to both users
- **MULTI-03**: Shared grocery list with real-time sync

### Import & Capture

- **IMPORT-01**: Import recipe from URL (web scraping with conversational confirmation)
- **IMPORT-02**: Photo/image recipe capture (OCR + conversational confirmation)

### Advanced Reminders

- **ADV-01**: Calendar-aware scheduling (knows about events, busy days)
- **ADV-02**: Partner-specific reminders ("tell Sarah to pick up the chicken")

## Out of Scope

Explicitly excluded. Documented to prevent scope creep.

| Feature | Reason |
|---------|--------|
| Nutritional tracking / calorie counting | Changes product from cooking partner to diet app. Target user cares about cooking, not macros. |
| Recipe catalog / discovery database | This is YOUR recipes. A browsable catalog fights the core value of personal knowledge. Previous attempts devolved into this. |
| Grocery delivery integration (Instacart, etc.) | User shops in-person. Massive integration complexity for wrong user profile. |
| Social features / recipe sharing | Different product. Adds moderation, privacy, viral mechanics for no value. |
| Budget tracking / price optimization | Requires real-time price data per store. User's constraint is time, not money. |
| Voice interaction / cooking mode | Different interaction paradigm. Telegram latency too high for real-time cooking guidance. |
| Feature-specific database queries | Agent reasons over knowledge. "Search by ingredient" is not a feature — it's the agent understanding your request. |

## Traceability

Which phases cover which requirements. Updated during roadmap creation.

| Requirement | Phase | Status |
|-------------|-------|--------|
| INFRA-01 through INFRA-06 | TBD | Pending |
| AGENT-01 through AGENT-06 | TBD | Pending |
| RECIPE-01 through RECIPE-06 | TBD | Pending |
| PLAN-01 through PLAN-05 | TBD | Pending |
| GROCERY-01 through GROCERY-05 | TBD | Pending |
| REMIND-01 through REMIND-05 | TBD | Pending |
| PREF-01 through PREF-04 | TBD | Pending |
| FEED-01 through FEED-04 | TBD | Pending |

**Coverage:**
- v1 requirements: 35 total
- Mapped to phases: 0 (pending roadmap)
- Unmapped: 35

---
*Requirements defined: 2026-02-05*
*Last updated: 2026-02-05 after scoping with agent-first architecture decision*
