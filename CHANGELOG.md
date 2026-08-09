# Changelog

Technical changelog for HeySous. For user-facing release notes, see [RELEASE_NOTES.md](./RELEASE_NOTES.md).

## v1.7.1

Bug-fix release. Most of it traces back to v1.6.2 switching `ANTHROPIC_MODEL` from `claude-haiku-4-5` to `claude-sonnet-5`: Sonnet 5 thinks by default when no `thinking` param is sent, and thinking shares the `max_tokens` budget. Two prod `/feedback` reports ("Sous can't make a grocery list", "Sous is unresponsive") were the same defect.

### Added
- `src/ai/prompt-cache.ts`: cache breakpoint placement by volatility -- system, end-of-history, and a rolling in-loop marker over tool results
- `buildDateContext()`: enumerates every date in this week and next, so week references are a lookup rather than model arithmetic
- `stripToolStatusLines()`: removes rendered status chrome before persisting an assistant message
- `recipeTitleMatchKind()`: exact / partial / none title comparison for plan-entry auto-linking
- `ClaudeResponse.truncated` plus a user-facing message when a turn is cut off with no text
- `checkDailyCostBudget()`: per-household daily spend guard (`DAILY_COST_BUDGET_USD`)
- `MODEL_PRICING` entries for `claude-sonnet-5` and `claude-opus-5`
- ~90 tests across 6 new files (prompt-cache, claude-client, tool-status, token-budget-guard, query-logs, date-utils)

### Changed
- Model, `max_tokens` and `effort` moved out of `.env` into an `AI` block in `config.ts` -- they move together, and splitting them across env vars is how the v1.6.2 switch shipped invisibly
- `max_tokens` 2048 -> 16000, covering thinking and reply text together
- Daily budget guards `estimated_cost` rather than summed tokens; input/output/cache classes differ ~20x in price, so a token ceiling authorised anywhere from $0.80 to $40 per household per day
- Per-request context (date, plan, grocery, memories, reminders, feedback) moved from the `system` parameter into a `<session_context>` block on the current user turn; `system` is now a single cached block
- `MODEL_PRICING._fallback` from Haiku (cheapest) to Opus-tier (most expensive) -- an unpriced model must over-report, never hide spend
- `query_logs` `limit` keeps the newest matches; `search` matches the parsed entry rather than the raw line
- Admin dashboard reads `dailyBudgetUsd` directly instead of extrapolating a dollar figure from a token budget
- `zod` declared explicitly (was a hoisted transitive; prod installs with `npm ci --omit=dev`)

### Fixed
- Empty replies: the whole 2048-token budget went to reasoning, so turns ended with `stop_reason: max_tokens`, no text, no tool call, and the loop returned `""` with no error. Three consecutive turns on 2026-07-29 each burned exactly 2048 output tokens over ~17s and saved no message row
- The forced-final call after iteration exhaustion dropped `tools` while the messages still carried tool_use/tool_result blocks -- a guaranteed 400, so the safety net could only ever throw. Now keeps `tools` with `tool_choice: none`
- "Next week" resolved a week late ("That's next week" on Fri Jul 24 -> "Tuesday, August 4th")
- Plan entries auto-linked to unrelated recipes: the guard accepted the top FTS hit when BM25 magnitude was *below* 5, i.e. exactly when the match was weak. Measured: bogus match 4.15 (accepted), real match 10.65 (rejected)
- Sous typed `<i>Updating your meal plan...</i>` as text instead of calling the tool. Status chrome was persisted to the messages table and replayed as history, teaching the pattern; brownies and a photographed recipe were both confirmed to the user and never saved
- `query_logs` returned nothing from prod in every query: pm2's `log_date_format` prefixes each line before the Pino JSON, and the strict `JSON.parse` skipped all of them
- `claude-sonnet-5` was unpriced from 2026-07-23, so every cost row used the Haiku fallback and understated spend ~2x
- Cache prefix was never reusable past the system prompt: `cache_read_tokens` was always an exact multiple of 21,858. Uncached input is now ~66% lower, and a 3-iteration turn costs ~1,200 uncached input where it previously ran 26,215

### Removed
- `ANTHROPIC_MODEL`, `ANTHROPIC_MAX_TOKENS`, `ANTHROPIC_EFFORT`, `DAILY_TOKEN_BUDGET` environment handling
- Two-block static/dynamic `SystemPromptInput`

### Deploy
- `DAILY_COST_BUDGET_USD` must be set in prod `.env` (default 5 if absent); `ANTHROPIC_MODEL` and `DAILY_TOKEN_BUDGET` are inert and can be deleted

## v1.7.0

Feedback-driven bug-fix release: every prod-reported issue from `/feedback` and implicit feedback, plus findings from a full codebase audit.

### Added
- Multi-stage "wide" recipe search: prefix AND → prefix OR → LIKE fallback across title/summary/content/tags, unioned with precise stages ranked first; dedup/feedback callers keep strict mode
- `save_meal_plan` no-op detection: identical resubmissions return a corrective warning to the model instead of silent success; tool inputs always logged
- System prompt: bare weekday names resolve to the next future occurrence; log_meal vs save_meal_plan responsibilities clarified; search persistence guidance
- Best-effort user-facing error reply in `bot.catch` (was silent)
- Mini App API test suite: HMAC auth middleware, admin gating, household scoping, per-route happy paths (38 tests)
- Reminder poller/sender, feedback pipeline, date-utils, and memory dedup test coverage (~120 new tests)

### Fixed
- Feedback check-ins stuck in `pending` forever: the `pending→sent` transition never existed, and reminder regeneration deleted `feedback_checkin` reminders, orphaning and duplicating tracking rows on every plan edit; stale orphans now expire on startup
- "Invalid time value" during `save_meal_plan`: start-cooking reminders with prep+cook longer than the meal's time-of-day produced negative times; they now roll over midnight to the previous day, and reminder regeneration failures no longer fail a successful save
- Timezone-dependent date math: date-only strings now parsed deterministically in UTC; malformed dates rejected with clear errors; `formatDateRange` same-month formatting implemented
- Memory dedup leak: BM25 rank normalized by term count (long duplicates never hit the threshold) plus an exact-match insert guard
- Mini App BackButton no-op on cold start/deep-link entry: falls back to Hub when there is no in-app history
- Cross-household IDOR: `POST /api/grocery/toggle` now verifies item ownership (404 otherwise)
- Fresh-install crash: migrations 3 and 10 no-op when their source tables don't exist yet; migration test pollution that masked this fixed
- Unescaped HTML interpolation across bot handlers (`/plan`, welcome, memory, preferences, feedback, reminder fallbacks) breaking messages on names like "Chicken & Rice"
- Reminder poller double-dispatch on overlapping ticks (in-flight guard); reminder/check-in sends now fall back to plain text on Telegram entity-parse errors

### Removed
- GSD workflow references from CLAUDE.md and the release skill (feature-branch workflow now)

## v1.6.2

### Added
- GitHub Actions CI workflow: typecheck, tests, and full build on every PR and push to main
- GitHub Actions deploy workflow: `v*` tag push builds in CI, rsyncs artifacts to the droplet over SSH, installs runtime deps, restarts PM2, and verifies `/health`
- Server-side deploy script (`scripts/server-deploy.sh`) invoked by the deploy workflow

### Changed
- Deploys no longer build on the droplet; the server runs production dependencies only (`npm ci --omit=dev`)
- Production model upgraded from Claude Sonnet 4.6 to Claude Sonnet 5 (`ANTHROPIC_MODEL` env change; adaptive thinking now on by default)
- Release process step 10 rewritten for automated tag-triggered deploys
- `docs/DEPLOYMENT.md` updated with one-time GitHub Actions setup; manual deploy kept as fallback

## v1.6.1

### Fixed
- Streaming cursor stuck after finalize: chain edit promises via editChain so finalize() waits for all in-flight edits before sending final message
- Streaming HTML flickering: close unclosed HTML tags (closeOpenTags) in partial text before each streaming edit, eliminating plain-text fallback that doubled API calls and triggered Telegram 429 rate limits

## v1.6.0

### Added
- All-day meal planning: 6 meal types (breakfast, lunch, snack, dinner, dessert, other) with configurable times per type (phases 42-43)
- Multi-recipe meal slots: multiple recipes per meal on the same day (phase 42)
- Sous memory system: dedicated `memories` table with FTS5 search, dedup pipeline, and categorized atomic facts (phase 49)
- `save_memory`, `delete_memory`, `search_memories` Claude tools for memory CRUD (phase 49)
- `/memory` and `/preferences` bot commands for viewing stored memories (phase 49)
- `application_settings` table (renamed from `reminder_settings`) with meal time columns and reminder toggles (phase 49)
- Deep-link builder module and `attach_deep_link` tool for inline Mini App buttons (phase 46)
- Post-response button injection in pipeline processor for automatic deep-link attachment (phase 46)
- Deep-link buttons on cooking/prep reminder messages (phase 46)
- Recipe deep-link handling in Mini App via `?id=` query parameter (phase 46)
- Start-cooking reminders for all meal types with per-type time offsets (phase 45)
- Mini App meal plan view grouped by meal type with expand/collapse per day (phase 44)
- Side-tabbed settings page with App, Schedule, and Memory sections (phase 50)
- Memory list with delete in Mini App settings (phase 49)
- Notification filtering: new users skip stale release notes (phase 54)
- Onboarding help message with next-steps prompt (phase 53)
- Memory saving during onboarding flow (phase 52)
- Database operation tests: memory CRUD, FTS5 search, dedup thresholds (phase 56)
- Settings-to-reminder integration tests (phase 55)

### Changed
- System prompt updated for multi-meal-type awareness and emoji ban (phases 43, 47)
- Onboarding state machine: removed recipes step, simplified to preferences -> tour -> complete (phase 53)
- Preference dedup threshold lowered from 0.85 to 0.70 (phase 48)
- Mini App font switched to system-ui stack with responsive layout padding (phase 47)
- Stream sender accumulates text properly across multi-turn responses (phase 51)
- Processor uses accumulated text instead of response.text override (phase 51)

### Fixed
- Deep-link buttons now attach to Sous response message, not sent separately (phase 48)
- Dead CSS media queries removed from Layout.css (phase 48)
- Meal entry indentation and font weight hierarchy in Mini App (phase 48)
- Stream finalize text override losing intermediate content (phase 51)
- HTML parse mode during streaming with plain-text fallback (post-UAT fix)
- Settings-to-reminder wiring: three gaps in toggle propagation fixed (phase 55)

## v1.5.0

### Added
- Streaming responses via grammY message editing
- Dark mode and font size settings in Mini App
- Time-aware start-cooking reminders using recipe prep/cook times
- Grocery category mapping for store-aware list formatting
- Deep link navigation from bot messages to Mini App views
- Mini App polish pass (responsive layout, loading states)

### Changed
- Reminder generator factors in actual recipe time estimates
- Grocery formatter groups items by store section

### Fixed
- Various v1.5 UAT fixes (phase 48)

## v1.4.0

### Added
- Recipe URL import (`fetchAndParseRecipe`)
- Recipe photo OCR via Claude vision
- Proactive recipe detection and save offers in conversation
- Knowledge item dedup pipeline (FTS5 + BM25 threshold)
- Store-aware grocery list formatting
- In-place recipe update flow (vs. creating duplicates)
- `/feedback` command for user feedback collection

### Changed
- Knowledge save flow checks for duplicates before creating new items
- Grocery list formatter respects store section preferences
