# Requirements: HeySous

**Defined:** 2026-03-02
**Core Value:** The recipe brain -- an AI agent that remembers everything about your meals and reasons over that knowledge to help you plan.

## v1.6 Requirements

Requirements for v1.6 All-Day Meals & UX. Each maps to roadmap phases.

### Meal Planning

- [x] **PLAN-01**: User can create meal plans with multiple meal types per day (breakfast, lunch, dinner, snack, dessert)
- [x] **PLAN-02**: Each meal slot supports multiple recipes (main + sides/components)
- [x] **PLAN-03**: User can tell Sous about any meal type and it gets planned into the correct slot
- [ ] **PLAN-04**: Mini App meal plan view displays all meal types per day with expandable sections
- [ ] **PLAN-05**: Grocery list generation aggregates ingredients from all meal types across the week
- [ ] **PLAN-06**: Reminders fire for all meal types, not just dinner (prep reminders, start-cooking alerts)
- [x] **PLAN-07**: User can configure preferred times for each meal type (sensible defaults: breakfast 7am, lunch 12pm, dinner 6pm)

### Navigation

- [ ] **NAV-01**: Sous responses include inline keyboard buttons to open referenced recipes in Mini App
- [ ] **NAV-02**: Sous responses include inline keyboard buttons to open meal plan view in Mini App
- [ ] **NAV-03**: Sous responses include inline keyboard buttons to open grocery list in Mini App
- [ ] **NAV-04**: Cooking reminders include a button to open the relevant recipe directly

### Mini App

- [ ] **UI-01**: Mini App uses a new, more readable font family for improved accessibility
- [ ] **UI-02**: Mini App layout is constrained to a reasonable max-width and centered on large screens (iPad/desktop)

### Prompt

- [ ] **PROMPT-01**: Sous never uses emojis in responses (explicit system prompt ban + audit of hardcoded messages)

## Future Requirements

None deferred — full scope included in v1.6.

## Out of Scope

| Feature | Reason |
|---------|--------|
| Calorie/nutrition tracking per meal | Changes product from cooking partner to diet app |
| Meal prep batching across days | Complex scheduling, revisit in future |
| Shared grocery list real-time sync (WebSocket) | 8s polling sufficient, avoids WebSocket complexity |
| Voice-based recipe walkthrough | Future capability |

## Traceability

Which phases cover which requirements. Updated during roadmap creation.

| Requirement | Phase | Status |
|-------------|-------|--------|
| PLAN-01 | Phase 42 | Complete |
| PLAN-02 | Phase 42 | Complete |
| PLAN-03 | Phase 43 | Complete |
| PLAN-04 | Phase 44 | Pending |
| PLAN-05 | Phase 45 | Pending |
| PLAN-06 | Phase 45 | Pending |
| PLAN-07 | Phase 43 | Complete |
| NAV-01 | Phase 46 | Pending |
| NAV-02 | Phase 46 | Pending |
| NAV-03 | Phase 46 | Pending |
| NAV-04 | Phase 46 | Pending |
| UI-01 | Phase 47 | Pending |
| UI-02 | Phase 47 | Pending |
| PROMPT-01 | Phase 47 | Pending |

**Coverage:**
- v1.6 requirements: 14 total
- Mapped to phases: 14
- Unmapped: 0

---
*Requirements defined: 2026-03-02*
*Last updated: 2026-03-02 after roadmap creation*
