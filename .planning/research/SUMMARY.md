# Project Research Summary

**Project:** HeySous v1.4 Backlog Sweep
**Domain:** Telegram meal planning bot — recipe import, knowledge quality, infrastructure, notifications
**Researched:** 2026-02-19
**Confidence:** HIGH

## Executive Summary

HeySous v1.4 is a focused backlog sweep adding two user-facing import features (URL and photo recipe import), two data-quality fixes (knowledge dedup, update_knowledge validation), one infrastructure foundation (migration framework), one internal delivery system (update notifications), and a content polish pass (notification tone). Research confirms this is achievable with a single new npm dependency: cheerio for HTML parsing. The Anthropic SDK at v0.73.0 already supports vision natively — `ImageBlockParam` and `Base64ImageSource` types are verified in node_modules. grammY already has photo message handling. SQLite's built-in `PRAGMA user_version` provides a migration framework in ~50 lines of code with no external libraries. Every feature either extends existing patterns or patches existing gaps.

The recommended approach uses strict dependency ordering: migration framework first (it adds the `last_seen_version` column that update notifications need), dedup fix second (imported recipes should run through dedup before import features ship), URL import third (establishes the import-to-save flow pattern), photo import fourth (reuses URL import patterns but uses a different acquisition path), then tone overhaul and update notifications as the final polish layer. Photo import is architecturally distinct from URL import: it goes through the existing message pipeline as a multimodal content block rather than as a Claude tool call. This means extending three pipeline files (`message.ts`, `message-queue.ts`, `processor.ts`) rather than adding a new tool, and means Claude sees the image alongside the full system prompt and all tools in one pass — avoiding doubled API costs.

The dominant risk across this milestone is the async tool handler problem: `handleToolCall` currently returns a synchronous `string`, but URL fetch requires `async`. The recommended fix is making the handler async (small type change, propagates cleanly). The second risk is photo import token costs — each image adds ~1,500 tokens on top of the full system prompt. Mitigation is using a minimal extraction system prompt (~200 tokens) for the vision call, not the full Sous persona. The third risk is the dedup design: v1.3's auto-upsert was already reverted once. The solution is non-negotiable — search-then-suggest with Claude + user deciding, never auto-merge in TypeScript logic.

## Key Findings

### Recommended Stack

v1.4 requires exactly one new production dependency. Everything else is already installed and verified.

**Core technologies:**
- `cheerio ^1.2.0` (NEW): HTML parsing for recipe JSON-LD/Microdata extraction — 28M+ weekly downloads, actively maintained, ~1MB; handles malformed HTML and Microdata that regex cannot
- `@anthropic-ai/sdk ^0.73.0` (existing): Vision API already present — `ImageBlockParam`, `Base64ImageSource`, `URLImageSource` confirmed in installed types at `/workspace/node_modules/@anthropic-ai/sdk/resources/messages/messages.d.ts`
- `grammY ^1.39.3` (existing): `ctx.getFile()` + `bot.on("message:photo")` filter for photo handling — no plugin needed; manual 5-line download is simpler than `@grammyjs/files` plugin
- `better-sqlite3 ^12.6.2` (existing): `PRAGMA user_version` for migration tracking — synchronous, atomic, zero schema overhead
- Node.js >= 22 (existing): Built-in `fetch()` for URL import and Telegram photo download; `Buffer.from()` for base64 encoding

**What NOT to add:** Puppeteer/Playwright (200MB Chromium for static HTML scraping is not justified), any recipe-scraper npm package (fragile, <100 downloads each, abandoned), sharp/jimp (Telegram photos already within Anthropic 5MB API limit), Tesseract.js (Claude vision handles OCR natively), jsdom (9MB for a task cheerio handles in ~90KB).

See [STACK.md](.planning/research/STACK.md) for full alternatives analysis and Anthropic SDK type verification details.

### Expected Features

All six features in scope are confirmed appropriate for v1.4. The ordering below reflects implementation priority based on dependencies.

**Must have (table stakes):**
- Recipe URL import — every cooking app competitor (Paprika, Whisk, Plan to Eat) has this; a meal planning bot that cannot read a recipe link feels broken
- Recipe photo import — "just snap a photo" is the natural UX for cookbooks and handwritten recipes; Claude vision handles OCR and semantic understanding in one API call
- Knowledge dedup fix — duplicates from import will immediately erode trust; v1.3 auto-upsert was reverted, so search-then-suggest is the only safe pattern
- update_knowledge validation — 4-line fix to prevent silent no-ops when no update fields are provided
- Migration framework — existing ad-hoc `migrateToHouseholdId` is a warning sign; numbered framework prevents "did this run?" ambiguity going forward

**Should have (differentiators):**
- Conversational notification tone — every bot-initiated message currently breaks Sous persona; centralized `src/telegram/messages.ts` module with randomized alternatives fixes this across all message types
- Proactive update notifications — lazy delivery (on next user interaction, not broadcast) announces import features without risking Telegram rate-limit bans

**Defer to v2+:**
- Multi-photo recipe batching in one debounce window — single photo covers 90% of use cases
- URL detection mid-conversation without explicit command — adds entity-parsing complexity
- Bulk URL import — one at a time is sufficient; 50-URL batch = $5+ in API costs
- Recipe import from video (TikTok/YouTube) — complex, slow, expensive
- Auto-migration rollback — forward-only is appropriate for SQLite; rollbacks double complexity for zero practical value at this scale

See [FEATURES.md](.planning/research/FEATURES.md) for detailed specs and edge case tables per feature.

### Architecture Approach

v1.4 touches three layers: the AI layer (new tools, vision multimodal content blocks, system prompt additions), the bot layer (photo message handling, notification delivery), and the infrastructure layer (migration framework). The critical architectural decision is that photo import goes through the existing pipeline as a multimodal message — not through a separate tool and not a separate Claude API call. The user's photo becomes part of the `PendingBatch.images` array, the pipeline processor builds an `ImageBlockParam` content block, and Claude sees the image with full system prompt and all tools available, then naturally extracts the recipe and offers to save it.

**New components to create:**
1. `src/knowledge/url-import.ts` — HTTP fetch + cheerio HTML parsing + JSON-LD/Microdata/Claude-fallback extraction pipeline; called from tool handler
2. `src/db/migrations.ts` — ~50 LOC runner using `PRAGMA user_version`; `src/db/migrations/001-baseline.ts` detects existing database state
3. `src/notifications/update-notifier.ts` — startup routine, version tracking per user, lazy delivery

**Existing files to modify:**
1. `src/ai/tool-handler.ts` — make async (for URL import); dedup search-before-save in `save_knowledge`; empty-fields validation in `update_knowledge`
2. `src/pipeline/message-queue.ts` — extend `PendingBatch` with `images: Array<{base64, mediaType}>` for photo attachments
3. `src/pipeline/processor.ts` — build multimodal content blocks when batch includes images; text-only path unchanged
4. `src/bot/handlers/message.ts` — add `message:photo` handler; downloads file, base64-encodes, enqueues with image attachment
5. `src/ai/system-prompt.ts` — recipe import instructions + dedup behavior instructions + tone consistency
6. `src/db/index.ts` — call migration runner before init functions (order matters for schema consistency)

**Key patterns to follow:**
- Tool handler delegation: URL import module does the heavy lifting; tool handler case calls it and returns the result
- Graceful degradation for external fetches: every failure mode returns a user-friendly suggestion (paste text, send photo, check the link)
- Claude as reasoning engine: dedup returns similar items to Claude with match details; Claude + user decide; no TypeScript decision logic
- Migration idempotency: each migration runs in a transaction; baseline migration handles both fresh and existing databases

See [ARCHITECTURE.md](.planning/research/ARCHITECTURE.md) for full data flow diagrams, build order rationale, and anti-patterns with explanations.

### Critical Pitfalls

1. **URL fetch hangs the single-process server** — Node.js `fetch()` has no default timeout; a slow or misbehaving recipe site blocks the entire event loop and holds the pipeline processor hostage. Prevention: `AbortSignal.timeout(10_000)` on every outbound request; 2MB response size cap via streaming; async tool handler so the fetch does not block synchronous paths.

2. **Schema.org parsing produces garbage data silently** — Recipe sites implement the spec inconsistently: `recipeIngredient` can be string or array, `recipeInstructions` can be `HowToStep[]`, ISO 8601 durations stored as-is (`PT1H30M`), titles bloated with SEO keywords. Garbage data saved to knowledge base makes grocery lists nonsensical. Prevention: normalization layer (duration parsing, HTML strip, title cleanup); always present to user before saving; Claude fallback for unstructured pages.

3. **Photo import costs spiral from token usage** — Each Telegram photo at ~1280px adds ~2,200 tokens; combined with the 4,000-6,000 token system prompt, each photo import call is 3-5x more expensive than normal chat. Multi-photo sends multiply this. Prevention: minimal extraction system prompt (~200 tokens) for the vision call; resize images to 1568px max; always show user before saving (avoid re-tries from silent failures).

4. **Knowledge dedup matches wrong items (false positives)** — FTS5 BM25 search produces false positives: "Chicken Stir Fry" matches "Chicken and Vegetable Stir Fry"; "Pasta Bolognese" matches "Bolognese Sauce." Auto-upsert was already reverted in v1.3 for exactly this reason. Prevention: non-negotiable search-then-suggest; return similar items to Claude with match details; Claude + user decide; relevance threshold filters low-confidence matches.

5. **Migration runner breaks existing ad-hoc migrations** — Fresh `user_version = 0` on existing databases means the runner tries to run all migrations including ones that replicate what `migrateToHouseholdId` already did; `ALTER TABLE ADD COLUMN` fails with "duplicate column name." Prevention: baseline migration (version 1) detects current database state via `PRAGMA table_info()` and is a no-op on existing databases; idempotent SQL for all schema changes; run migrations before init functions in `createDatabase()`.

See [PITFALLS.md](.planning/research/PITFALLS.md) for 15 total pitfalls including 5 moderate, 5 minor, and integration gotchas per feature.

## Implications for Roadmap

Based on research, suggested phase structure — 6 phases, sequenced by dependencies:

### Phase 1: Data Migration Framework
**Rationale:** Foundation with no dependencies. Update notifications (Phase 6) need `last_seen_version` column; that column needs a safe migration path before the feature can ship.
**Delivers:** `src/db/migrations.ts` runner (~50 LOC), `src/db/migrations/001-baseline.ts` (no-op on existing databases), integration into `createDatabase()` before init functions.
**Addresses:** Migration framework table-stakes feature; unblocks Phase 6 schema change.
**Avoids:** Pitfall 5 (runner breaking existing ad-hoc migrations) — baseline migration handles both fresh and existing databases; idempotent ALTERs via `PRAGMA table_info()` pre-checks.
**Research flag:** Standard pattern — skip `/gsd:research-phase`.

### Phase 2: Knowledge Dedup Fix
**Rationale:** Must exist before URL import or photo import ship. Every imported recipe flows through `save_knowledge`; without dedup, the first thing users do is import duplicates. The `update_knowledge` validation fix is a bonus 4-line change.
**Delivers:** Search-before-save in `save_knowledge` tool handler (FTS5 title search, return match to Claude); `update_knowledge` no-op validation; system prompt dedup behavior instructions.
**Addresses:** Dedup and validation table-stakes features.
**Avoids:** Pitfall 4 (wrong FTS5 matches, false positives) — search-then-suggest with relevance threshold, Claude decides.
**Research flag:** Standard pattern — skip `/gsd:research-phase`.

### Phase 3: Notification Tone Overhaul
**Rationale:** Independent of all other features, no dependencies. Doing it here establishes Sous voice before new notification types (Phase 6 release notes) are written, preventing a second tone audit later.
**Delivers:** `src/telegram/messages.ts` with randomized alternatives per message type and `pick()` function; updated `reminders/sender.ts`, `feedback/sender.ts`, error fallback strings in `processor.ts`; Telegram HTML sanitization function.
**Addresses:** Notification tone differentiator feature; HTML formatting safety for all future message templates.
**Avoids:** Pitfall 10 (tone rewrite breaking Telegram HTML) — sanitization function built before content changes; only supported tags in all templates.
**Research flag:** Content task — skip `/gsd:research-phase`.

### Phase 4: Recipe URL Import
**Rationale:** Highest user-facing value. Depends on dedup fix (Phase 2) being in place. URL import establishes the save-to-knowledge flow pattern that photo import (Phase 5) reuses.
**Delivers:** `src/knowledge/url-import.ts` (fetch + cheerio JSON-LD/Microdata extraction + normalization + Claude fallback); `import_from_url` tool definition; async tool handler; graceful degradation messages; `npm install cheerio`.
**Uses:** cheerio ^1.2.0 (only new dependency); Node.js `fetch()` with `AbortSignal.timeout(10_000)`.
**Implements:** Three-strategy extraction pipeline: JSON-LD -> Microdata -> Claude raw-text fallback.
**Avoids:** Pitfall 1 (server hangs) via 10s timeout and 2MB cap; Pitfall 2 (garbage data) via normalization layer; Pitfall 6 (anti-scraping blocks) via browser-like User-Agent + paste fallback.
**Research flag:** Medium complexity — skip `/gsd:research-phase`; extraction patterns fully documented in ARCHITECTURE.md.

### Phase 5: Recipe Photo Import
**Rationale:** Second-highest user-facing value. Shares save-to-knowledge flow with Phase 4 but uses a different acquisition path (pipeline extension, not tool call). Building URL import first means photo import can reuse the same confirmation and dedup flow.
**Delivers:** `message:photo` handler in `message.ts`; `PendingBatch.images` extension in `message-queue.ts`; multimodal content block assembly in `processor.ts`; minimal extraction system prompt (not full Sous persona).
**Uses:** Existing `@anthropic-ai/sdk` vision types (`ImageBlockParam`, `Base64ImageSource`) — already in node_modules.
**Implements:** Pipeline extension where photo arrives as message content block, not tool call; image placed before text in content array per Anthropic recommendation.
**Avoids:** Pitfall 3 (cost spirals) via minimal extraction prompt; Pitfall 8 (low quality extraction) via confidence flagging + always-show-before-save.
**Research flag:** Medium complexity, highest regression risk (touches core message pipeline) — skip `/gsd:research-phase` but treat text-only path preservation as a test gate.

### Phase 6: Update Notification System
**Rationale:** Depends on Phase 1 migration framework for `last_seen_version` schema migration. Ships last so it can announce the import features (Phases 4 and 5). Uses Sous voice established in Phase 3.
**Delivers:** `src/notifications/update-notifier.ts` (startup routine, lazy delivery); migration 002 (`last_seen_version TEXT` on users table); v1.4.0 release notes in Sous voice.
**Implements:** Version tracking per user; 403 handling (reuse pattern from `reminders/sender.ts`); 100ms rate limiting between sends; lazy delivery (on next user interaction, not startup broadcast).
**Avoids:** Pitfall 9 (mass 403 blocks and rate-limit bans) via lazy delivery; blocked-user tracking prevents repeated failed sends.
**Research flag:** Standard pattern — skip `/gsd:research-phase`; lazy delivery is simpler than broadcast.

### Phase Ordering Rationale

- Migration framework before update notifications: the schema change is a hard dependency; no column means no tracking.
- Dedup fix before both import features: every imported recipe flows through `save_knowledge`; dedup must exist before imports ship or users immediately hit duplicates.
- URL import before photo import: URL is simpler, establishes the recipe-extraction-to-knowledge-save flow, and means photo import can share that confirmed flow without re-solving it.
- Tone overhaul third: independent and unblocking; doing it here means Phase 6 release notes are written with the voice already established.
- Update notifications last: depends on migration framework, most time-sensitive to ship after the features it announces.

### Research Flags

All phases have well-documented patterns — no phase requires `/gsd:research-phase`:

- **Phase 1:** `PRAGMA user_version` is fully documented; runner is ~50 LOC; baseline migration pattern is in ARCHITECTURE.md.
- **Phase 2:** FTS5 integration is already operational in the codebase; fix is tool handler modification, not new infrastructure.
- **Phase 3:** Content task; Telegram HTML constraints are known; `messages.ts` is a straightforward utility module.
- **Phase 4:** Extraction strategies fully documented in ARCHITECTURE.md and FEATURES.md; async handler change is a small type update; cheerio API is simple.
- **Phase 5:** Vision API types verified in node_modules; all three pipeline extension points identified in ARCHITECTURE.md; no unknown integration surface.
- **Phase 6:** Lazy delivery is simpler than broadcast; 403 handling already implemented in `reminders/sender.ts` to copy from.

**Implementation-time validation needed (not blocking):**
- Phase 4: Test real URLs (AllRecipes, Serious Eats, NYT Cooking) to validate extraction coverage.
- Phase 5: Test with actual Telegram-compressed photos (not high-res local files) to validate extraction quality.
- Phase 2: Tune FTS5 relevance threshold empirically based on test cases with similar recipe titles.

## Confidence Assessment

| Area | Confidence | Notes |
|------|------------|-------|
| Stack | HIGH | Anthropic SDK vision types verified in installed node_modules; cheerio npm stats confirmed (28M+ weekly downloads); all other technologies already in production use on this codebase |
| Features | HIGH | Detailed spec per feature with edge cases; anti-features explicitly excluded with rationale; dedup design informed by v1.3 revert context (no auto-merge) |
| Architecture | HIGH | Based on codebase analysis of ~22,650 LOC; all integration points identified; data flow diagrams per feature; async handler change is the only non-trivial decision and has a clear recommendation |
| Pitfalls | HIGH | 15 pitfalls documented with prevention strategies (5 critical, 5 moderate, 5 minor); all codebase-specific pitfalls from direct code audit; phase-specific warnings table included |

**Overall confidence:** HIGH

### Gaps to Address

- **Recipe site anti-scraping behavior (MEDIUM confidence):** Exact failure rate from anti-bot measures varies by site and deployment IP. Graceful degradation path (paste fallback) mitigates this regardless of failure rate. Validate at Phase 4 implementation time with real URLs.
- **Photo extraction quality with Telegram-compressed JPEG (LOW confidence):** Telegram compression behavior documented but not tested with real device uploads. Always-show-before-save requirement mitigates quality risk. Validate at Phase 5 implementation time with real device photos.
- **FTS5 relevance threshold for dedup (LOW confidence on exact values):** Right BM25 threshold to avoid false positives without missing real duplicates is empirical. Start with exact title match (case-insensitive) as the hard trigger; surface fuzzy matches as informational context for Claude only. Tune during Phase 2 testing.
- **`handleToolCall` async propagation:** Making the return type `string | Promise<string>` requires updating the `onToolCall` callback type in `claude-client.ts`. Small change but must be verified against all 10+ existing tool call paths to confirm none break. Build this verification into Phase 4 test gates.

## Sources

### Primary (HIGH confidence)
- Anthropic Vision API documentation — image limits, supported formats, token formula, content block structure: https://platform.claude.com/docs/en/build-with-claude/vision
- `@anthropic-ai/sdk@0.73.0` installed types — `ImageBlockParam`, `Base64ImageSource`, `URLImageSource` confirmed in `/workspace/node_modules/@anthropic-ai/sdk/resources/messages/messages.d.ts`
- grammY file handling documentation — `ctx.getFile()`, `message:photo` filter, 20MB limit: https://grammy.dev/guide/files
- Schema.org Recipe type — JSON-LD structure, field names, duration format: https://schema.org/Recipe
- SQLite `PRAGMA user_version` — built-in migration tracking: https://sqlite.org/pragma.html#pragma_user_version
- HeySous codebase audit — all src/ modules reviewed; ~22,650 LOC analyzed; key files: `src/ai/tool-handler.ts`, `src/pipeline/processor.ts`, `src/knowledge/repository.ts`, `src/db/index.ts`, `src/reminders/sender.ts`

### Secondary (MEDIUM confidence)
- cheerio v1.2.0 — HTML parsing API, npm download stats: https://cheerio.js.org/
- Telegram Bot API rate limits — 30 msg/s global, 403 for blocked users: https://core.telegram.org/bots/faq
- Recipe JSON-LD scraping patterns — practical Node.js extraction approach: https://www.raymondcamden.com/2024/06/12/scraping-recipes-using-nodejs-pipedream-and-json-ld
- Web scraping anti-bot challenges — User-Agent detection, Cloudflare patterns: https://www.scrapingbee.com/blog/web-scraping-challenges/
- NN/g ChatGPT and tone research — authoritative UX research on AI voice consistency: https://www.nngroup.com/articles/chatgpt-and-tone/

### Tertiary (LOW confidence — needs empirical validation)
- "~80% of recipe sites have JSON-LD" — inferred from Google rich snippet requirements, not measured
- Telegram photo typical size (~1280px JPEG) — from documentation patterns, not tested with real devices
- FTS5 dedup relevance threshold values — empirical, needs tuning during Phase 2 implementation

---
*Research completed: 2026-02-19*
*Ready for roadmap: yes*
