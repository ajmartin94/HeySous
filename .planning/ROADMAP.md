# Roadmap: HeySous

## Milestones

- [x] **v1.0 MVP** - Phases 1-10 (shipped 2026-02-09)
- [x] **v1.1 Mini Apps** - Phases 11-14 (shipped 2026-02-10)
- [x] **v1.2 Onboarding and Feedback** - Phases 15-19 (shipped 2026-02-11)
- [x] **v1.3 AI Polish & UX** - Phases 20-24 (shipped 2026-02-19)
- [x] **v1.4 Backlog Sweep** - Phases 25-31 (shipped 2026-02-21)
- [ ] **v1.5 Agent Hardening & Polish** - Phases 32-40 (in progress)

## Phases

<details>
<summary>v1.0 MVP (Phases 1-10) - SHIPPED 2026-02-09</summary>

See .planning/milestones/v1.0-ROADMAP.md for full phase history.
30 plans completed across 10 phases. 8,263 LOC TypeScript.

</details>

<details>
<summary>v1.1 Mini Apps (Phases 11-14) - SHIPPED 2026-02-10</summary>

See .planning/milestones/v1.1-ROADMAP.md for full phase history.
10 plans completed across 4 phases. 3,875 LOC Mini App code (12,726 total).

</details>

<details>
<summary>v1.2 Onboarding and Feedback (Phases 15-19) - SHIPPED 2026-02-11</summary>

See .planning/milestones/v1.2-ROADMAP.md for full phase history.
10 plans completed across 5 phases. Multi-user households, onboarding, feedback, help.

</details>

<details>
<summary>v1.3 AI Polish & UX (Phases 20-24) - SHIPPED 2026-02-19</summary>

See .planning/milestones/v1.3-ROADMAP.md for full phase history.
9 plans completed across 5 phases. Implicit AI behaviors, recipe variations, grocery intelligence, Mini App deletion, onboarding refinement.

</details>

<details>
<summary>v1.4 Backlog Sweep (Phases 25-31) - SHIPPED 2026-02-21</summary>

See .planning/milestones/v1.4-ROADMAP.md for full phase history.
7 plans completed across 7 phases. Recipe import (URL + photo), knowledge dedup, Sous personality, update notifications, migration framework.

</details>

### v1.5 Agent Hardening & Polish (In Progress)

**Milestone Goal:** Harden the Sous agent against security, cost, and resilience gaps identified by a comprehensive 3-agent audit. Improve prompt quality, add observability, optimize performance, and polish UI/UX.

- [x] **Phase 32: Prompt Quality & Persona** - Unify Sous persona, fix conflicting instructions, restructure system prompt for caching (completed 2026-02-21)
- [x] **Phase 33: Input Validation & Security** - Sanitize user-controlled text, bounds-validate tool inputs, enforce message length limits (completed 2026-02-21)
- [x] **Phase 34: Observability & Data Integrity** - Log tool calls with metrics, sanitize error messages, validate recipe extraction (completed 2026-02-22)
- [x] **Phase 35: Resilience** - 429 backoff with jitter, meal plan race condition fix, context overflow detection (completed 2026-02-22)
- [x] **Phase 36: Pipeline Efficiency** - Rate limiting, configurable session, N+1 fix, token counting, knowledge content search (completed 2026-02-23)
- [x] **Phase 37: Streaming** - Stream Claude responses to Telegram for lower perceived latency (completed 2026-02-23)
- [x] **Phase 38: Mini App Theme & Accessibility** - Theme selection, font size, tag contrast, help page update (completed 2026-02-24)
- [ ] **Phase 39: Admin Dashboard** - Activity feed, usage stats, cost trends, feedback overview
- [ ] **Phase 40: Reminder Resilience & Recipe Time Extraction** - 45min fallback offset, plan-recipe linking guard, structured time metadata

## Phase Details

### Phase 32: Prompt Quality & Persona
**Goal**: Sous speaks with one consistent voice across all interactions, prompt instructions are clear and non-contradictory, and the system prompt is structured for effective prompt caching
**Depends on**: Nothing (first phase of v1.5 -- text changes only, low risk)
**Requirements**: PROMPT-01, PROMPT-02, PROMPT-03, PROMPT-04, PROMPT-05, PERF-02
**Success Criteria** (what must be TRUE):
  1. All Claude interactions (chat, onboarding, feedback detection) use the same Sous persona definition from a single source
  2. The import_from_url tool description and system prompt give consistent instructions about URL recipe import behavior
  3. System prompt explicitly documents recipe ID format for plan modifications, preference save-vs-skip durability signals, and dinner time cross-reference in reminders section
  4. Static system prompt content is separated from dynamic household context so the Anthropic API can cache the stable prefix across requests
**Plans**: 2 plans
  - [ ] 32-01-PLAN.md -- Unify Sous persona, fix import_from_url conflict, fill instruction gaps (PROMPT-01 through PROMPT-05)
  - [x] 32-02-PLAN.md -- Restructure system prompt for Anthropic API prompt caching (PERF-02)

### Phase 33: Input Validation & Security
**Goal**: User-supplied content cannot corrupt system prompts or crash tool handlers, and excessively long messages are rejected before reaching the AI pipeline
**Depends on**: Phase 32 (persona restructure establishes prompt structure that sanitization protects)
**Requirements**: SEC-02, SEC-03, SEC-04
**Success Criteria** (what must be TRUE):
  1. Display names and preference text containing HTML tags or prompt injection attempts are escaped/stripped before appearing in the system prompt
  2. Tool handler inputs exceeding defined bounds (string length, array size, number ranges) return a clear error to Claude instead of processing
  3. Messages above a configurable character limit are rejected with a friendly user-facing message before entering the pipeline
**Plans**: 3 plans
  - [ ] 33-01-PLAN.md -- Sanitize user-controlled text (display names, preferences) before system prompt injection (SEC-02)
  - [ ] 33-02-PLAN.md -- Bounds-validate tool handler inputs (string length, array size, number ranges) (SEC-03)
  - [ ] 33-03-PLAN.md -- Reject messages above 4,000 character limit with in-character response (SEC-04)

### Phase 34: Observability & Data Integrity
**Goal**: Every tool call is traceable in logs with timing and outcome, error details never leak to the LLM, and extracted recipes are validated before save
**Depends on**: Phase 33 (input validation ensures tool handlers receive clean inputs; observability wraps validated handlers)
**Requirements**: OBS-01, OBS-02, OBS-03, DATA-01
**Success Criteria** (what must be TRUE):
  1. Each tool call produces a structured log entry with tool name, duration_ms, household_id, and success/error status
  2. When a tool throws an internal error, the message returned to Claude describes the failure generically without exposing stack traces, file paths, or SQL
  3. MODEL_PRICING in config covers Sonnet and Opus model IDs and falls back gracefully for unknown models
  4. Recipes extracted from URLs or photos that lack a title, ingredients list, or instructions are rejected with a message explaining what is missing
**Plans**: 2 plans
  - [ ] 34-01-PLAN.md -- Tool call observability wrapper and error sanitization (OBS-01, OBS-02)
  - [ ] 34-02-PLAN.md -- Model pricing update and recipe completeness validation (OBS-03, DATA-01)

### Phase 35: Resilience
**Goal**: The pipeline gracefully handles API rate limits, concurrent modifications, and oversized context instead of failing silently or crashing
**Depends on**: Phase 34 (observability logging in place to trace resilience events)
**Requirements**: RES-01, RES-02, RES-03, RES-04
**Success Criteria** (what must be TRUE):
  1. When the Anthropic API returns a 429 error, the system retries with exponential backoff and jitter instead of immediate retry or failure
  2. Two simultaneous meal plan edit requests for the same household cannot silently overwrite each other (optimistic locking or serialization)
  3. Before calling the Anthropic API, the system checks estimated token count and triggers graceful degradation (context trimming) if it would exceed the model window
  4. When conversation history is truncated to fit the context window, Claude receives a notice that earlier messages were omitted
**Plans**: 3 plans
  - [ ] 35-01-PLAN.md -- 429 retry with exponential backoff, jitter, and Retry-After header support (RES-01)
  - [ ] 35-02-PLAN.md -- Optimistic locking on all stateful household writes (RES-02)
  - [ ] 35-03-PLAN.md -- Context overflow detection, conversation trimming, and truncation notice (RES-03, RES-04)

### Phase 36: Pipeline Efficiency
**Goal**: The message pipeline enforces per-household cost/rate budgets, uses accurate token counting, optimizes database queries, supports configurable session boundaries, and searches knowledge content (not just titles) for deduplication
**Depends on**: Phase 35 (resilience provides the retry/backoff layer that rate limiting builds on)
**Requirements**: SEC-01, CFG-01, PERF-01, PERF-03, PROMPT-06
**Success Criteria** (what must be TRUE):
  1. Households hitting the message rate limit or daily token budget receive a friendly explanation instead of silent processing
  2. Conversation session timeout is configurable via environment variable instead of a hardcoded 4-hour value
  3. Preference loading for system prompt construction executes a single query instead of one query per preference category
  4. Token estimation before API calls uses a counting method that matches actual API token usage within 10% instead of the 4-chars-per-token heuristic
  5. Knowledge deduplication searches recipe/preference content (ingredients, instructions) beyond title-only matching
**Plans**: 3 plans
Plans:
  - [ ] 36-01-PLAN.md -- Daily token budget enforcement and midnight session boundary (SEC-01, CFG-01)
  - [ ] 36-02-PLAN.md -- N+1 preference query fix and byte-based token estimation (PERF-01, PERF-03)
  - [ ] 36-03-PLAN.md -- Content-aware knowledge deduplication (PROMPT-06)

### Phase 37: Streaming
**Goal**: Users see Claude's response appearing progressively in Telegram instead of waiting for the full response before any text appears
**Depends on**: Phase 36 (token counting and rate limiting must be in place before streaming changes the response flow)
**Requirements**: PERF-04
**Success Criteria** (what must be TRUE):
  1. Claude responses are streamed to Telegram, with message edits delivering incremental text as it generates
  2. Tool calls within a streaming response are still executed correctly and their results incorporated into the final message
  3. Long responses that require Telegram message splitting still render correctly when streamed
**Plans**: 2 plans
Plans:
  - [ ] 37-01-PLAN.md -- Streaming infrastructure: Claude client streaming method, Telegram stream sender, tool status labels (PERF-04)
  - [ ] 37-02-PLAN.md -- Processor integration: wire streaming into pipeline, replace non-streaming path, preserve post-processing (PERF-04)

### Phase 38: Mini App Theme & Accessibility
**Goal**: Users can customize the Mini App appearance for comfort and readability, and the help page reflects current features
**Depends on**: Nothing (frontend work, independent of backend phases -- can be parallelized)
**Requirements**: UX-01, DOCS-01
**Success Criteria** (what must be TRUE):
  1. Users can select a theme (light/dark/system) from Mini App settings and the selection persists across sessions
  2. Users can adjust font size and the entire Mini App respects the setting
  3. Recipe tags in the browser have sufficient color contrast against their background for readability
  4. The Mini App help page documents all current features including those added in v1.3 and v1.4
**Plans**: 2 plans
Plans:
  - [ ] 38-01-PLAN.md -- Theme infrastructure, font size scale, Settings page, localStorage persistence (UX-01)
  - [ ] 38-02-PLAN.md -- Tag contrast fix for both themes and comprehensive help page rewrite (UX-01, DOCS-01)

### Phase 39: Admin Dashboard
**Goal**: The admin user has a visual overview of system health, usage patterns, costs, and user feedback without querying the database directly
**Depends on**: Phase 34 (observability logging provides the data the dashboard displays)
**Requirements**: UX-02
**Success Criteria** (what must be TRUE):
  1. Admin dashboard shows a recent activity feed (messages, tool calls, errors) with timestamps
  2. Admin dashboard displays usage statistics (messages per day, active households, tool call frequency)
  3. Admin dashboard shows cost trends (daily/weekly token spend with model breakdown)
  4. Admin dashboard includes a feedback overview (recent feedback entries, sentiment summary)
**Plans**: 2 plans
Plans:
  - [ ] 39-01-PLAN.md -- Backend admin API endpoints (activity feed, stats, costs, feedback) with admin role guard
  - [ ] 39-02-PLAN.md -- Frontend admin dashboard page with all sections, SVG charts, and admin nav tab in Hub

## Progress

**Execution Order:** 32 -> 33 -> 34 -> 35 -> 36 -> 37 -> 38 -> 39 -> 40
Note: Phase 38 (Mini App Theme) has no backend dependencies and can be parallelized with phases 33-37.
Note: Phase 40 (Reminder Resilience) has no dependencies and can be parallelized with Phase 39.

| Phase | Milestone | Plans Complete | Status | Completed |
|-------|-----------|----------------|--------|-----------|
| 1-10. MVP Phases | v1.0 | 30/30 | Complete | 2026-02-09 |
| 11-14. Mini App Phases | v1.1 | 10/10 | Complete | 2026-02-10 |
| 15-19. Onboarding Phases | v1.2 | 10/10 | Complete | 2026-02-11 |
| 20-24. AI Polish Phases | v1.3 | 9/9 | Complete | 2026-02-19 |
| 25-31. Backlog Sweep Phases | v1.4 | 7/7 | Complete | 2026-02-21 |
| 32. Prompt Quality & Persona | v1.5 | 2/2 | Complete | 2026-02-21 |
| 33. Input Validation & Security | 3/3 | Complete    | 2026-02-21 | - |
| 34. Observability & Data Integrity | 2/2 | Complete    | 2026-02-22 | - |
| 35. Resilience | 3/3 | Complete    | 2026-02-22 | - |
| 36. Pipeline Efficiency | 3/3 | Complete    | 2026-02-23 | - |
| 37. Streaming | 2/2 | Complete    | 2026-02-23 | - |
| 38. Mini App Theme & Accessibility | 2/2 | Complete    | 2026-02-24 | - |
| 39. Admin Dashboard | 1/2 | In Progress|  | - |
| 40. Reminder Resilience & Recipe Time Extraction | v1.5 | 0/2 | Not started | - |

**Total: 32 phases complete (68 plans), 8 phases remaining for v1.5**

### Phase 40: Reminder Resilience & Recipe Time Extraction

**Goal:** Start-cooking reminders fire at the right time by default, recipe time data is reliably extractable, and plan entries without linked recipes are flagged before save
**Depends on:** Nothing (bugfix phase, independent of Phase 39)
**Success Criteria** (what must be TRUE):
  1. Start-cooking reminders default to 45 minutes before dinner time when recipe prep/cook time cannot be determined, instead of firing at dinner time
  2. When Claude saves a meal plan entry without a `knowledge_item_id` for a recipe that exists in the knowledge base, the tool handler warns Claude to search and link the recipe
  3. Recipe time fields (prep, cook, total) are stored as structured metadata alongside the unstructured recipe content so time extraction does not depend on regex parsing of free text
  4. `parseRecipeTotalMinutes` falls back to structured metadata when free-text parsing fails, and logs when neither source yields a result
  5. Silent `catch {}` in reminder generation is replaced with observability logging
**Plans:** 2 plans

Plans:
- [ ] 40-01-PLAN.md -- Structured time columns, migration+backfill, auto-extraction on save/update, plan-recipe linking guard
- [ ] 40-02-PLAN.md -- Generator fixes: 45-min fallback, structured metadata lookup, error logging (TDD)
