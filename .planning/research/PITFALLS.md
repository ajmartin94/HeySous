# Domain Pitfalls

**Domain:** Adding URL recipe import, photo recipe import, knowledge dedup, data migrations framework, update notifications, and notification tone changes to an existing Telegram meal planning bot (HeySous v1.4)
**Researched:** 2026-02-19
**Confidence:** HIGH (based on codebase audit of ~22,650 LOC, Anthropic Vision API official documentation, Telegram Bot API rate limit documentation, SQLite ALTER TABLE documentation, and existing knowledge/FTS5 system review)

**Existing system context:**
- `save_knowledge` currently does blind INSERT via `knowledgeRepository.create()` -- no dedup check
- Dedup auto-upsert attempted in v1.3 and reverted (too aggressive -- merged distinct recipes)
- Claude is the reasoning engine; tools return structured data, Claude decides what to do
- FTS5 full-text search with porter/unicode61 tokenizer, BM25 ranking, already operational
- Single-process Node.js, better-sqlite3 (synchronous), WAL mode enabled
- No formal migration runner -- ad-hoc `PRAGMA table_info` checks and `CREATE TABLE IF NOT EXISTS`
- Telegram HTML parse mode, 4096-char message limit, 300ms chunk delay
- Existing reminder sender already handles 403 (bot blocked by user) gracefully

---

## Critical Pitfalls

Mistakes that cause data loss, wasted API costs, broken features, or require rewrites.

### Pitfall 1: Recipe URL Fetch Hangs the Single-Process Server

**What goes wrong:**
A user sends a URL like `https://www.nytimes.com/cooking/recipe/...` and the bot attempts to fetch it. The fetch hangs for 30+ seconds (DNS timeout, slow server, infinite redirect, or response streaming that never ends). Because HeySous is a single-process Node.js server with synchronous better-sqlite3, the event loop is not blocked by the DB, but the HTTP fetch promise holds the pipeline processor hostage. The 30-second timeout warning fires, but the Claude API call cannot even start because the tool handler is still waiting on the fetch. Other users' messages queue up behind it.

**Why it happens:**
Node.js `fetch()` (or `undici`) has no default timeout. Without an explicit `AbortSignal.timeout()`, a request to a misbehaving server can hang indefinitely. Recipe sites are particularly prone to slow responses because they are ad-heavy, may serve through CDNs with edge-case failures, and some use anti-bot measures that deliberately slow-drip responses to non-browser clients.

**Consequences:**
- Pipeline processor stuck waiting, 30s timeout message fires, user sees "taking longer than usual"
- If multiple users hit bad URLs simultaneously, the entire bot becomes unresponsive
- Anthropic API call never happens, so Claude never responds

**Prevention:**
- Set a hard 10-second timeout on ALL outbound HTTP requests: `fetch(url, { signal: AbortSignal.timeout(10_000) })`
- Implement the URL fetch OUTSIDE the Claude tool loop. The tool call flow should be: user sends URL -> bot acknowledges receipt -> fetch URL in background -> parse result -> feed to Claude for structuring -> present to user. Do NOT make the fetch happen inside a `handleToolCall` synchronous return
- Add a URL validation step before fetching: reject obviously bad URLs (no protocol, local IPs, non-HTTP schemes, known-bad TLDs)
- Set `Content-Length` response size limit (e.g., 2MB max). Stream the response and abort if it exceeds the limit. Recipe pages should never be larger than 500KB of HTML

**Warning signs:**
- Bot stops responding to all users for 30+ seconds after a URL import is attempted
- Logs show fetch promises that never resolve
- Multiple "taking longer than usual" timeout messages in short succession

**Detection:** Monitor `requestDurationMs` in token_usage table. If a pipeline batch takes >30s and involved a URL fetch tool, the fetch is the bottleneck.

**Phase to address:** URL Recipe Import phase. This is architectural -- must be designed correctly from the start.

---

### Pitfall 2: Recipe Schema.org Parsing Produces Garbage Data Silently

**What goes wrong:**
The scraper fetches a URL, finds JSON-LD with `@type: "Recipe"`, extracts data, and saves it as a knowledge item. But the extracted data is garbage: ingredients are a single concatenated string instead of an array, cooking time is an ISO 8601 duration that is not parsed (`PT1H30M` stored as-is), the recipe name includes SEO keywords ("Best Ever Amazing Chicken Parmesan Recipe 2025"), and the instructions contain HTML entities and inline ads. The recipe is saved to the knowledge base as-is, and when Claude tries to use it for meal planning, it produces nonsensical grocery lists and instructions.

**Why it happens:**
Recipe sites implement schema.org markup inconsistently:
- `recipeIngredient` can be a single string, an array of strings, or an array of objects with quantity/name properties
- `recipeInstructions` can be a string, an array of strings, an array of `HowToStep` objects, or an array of `HowToSection` objects containing nested steps
- JSON-LD can appear as a single object, an array, or nested inside a `@graph` array
- Some sites put the Recipe schema in microdata format instead of JSON-LD
- Duration fields use ISO 8601 (`PT45M`, `PT1H30M`) which requires explicit parsing
- Many sites include "life story" preamble text in the description or instructions
- Some sites wrap JSON-LD in CDATA sections or serve it dynamically via JavaScript

**Consequences:**
- Knowledge base polluted with unparseable recipe content
- Claude generates bad grocery lists from garbled ingredients
- User loses trust in URL import feature after 2-3 bad imports

**Prevention:**
- Use a library like `scrape-recipe-schema` for initial extraction, but add a normalization layer on top
- After extraction, validate required fields: `name` (string, non-empty), `recipeIngredient` (array of strings), `recipeInstructions` (array of strings)
- Parse ISO 8601 durations into human-readable strings (`PT1H30M` -> `1 hour 30 minutes`)
- Strip HTML tags from all text fields. Strip common SEO patterns from titles (trailing "Recipe", "Best Ever", year numbers)
- If JSON-LD extraction fails, fall back to passing the raw HTML to Claude with a structured extraction prompt. Claude is better at messy HTML than any regex-based parser
- ALWAYS show the parsed recipe to the user for confirmation before saving. Never auto-save a URL import
- Store the source URL in the `source` field of the knowledge item for attribution and re-fetch

**Warning signs:**
- Recipe content contains raw HTML tags or `&amp;` entities
- Ingredients listed as a single long string instead of individual items
- Cooking times showing as `PT45M` instead of human-readable format
- Recipe titles are excessively long (>80 characters)

**Phase to address:** URL Recipe Import phase. Build the normalization layer alongside the scraper, not after.

---

### Pitfall 3: Photo Import Costs Spiral Due to Image Token Usage

**What goes wrong:**
A user sends a photo of a recipe from a cookbook or a screenshot from a website. Telegram compresses the image, but the bot downloads the highest-resolution version available. The image is sent to Claude's Vision API for extraction. At ~1,334 tokens per 1000x1000px image (official Anthropic documentation), each photo import costs roughly $0.004 in input tokens alone -- plus the output tokens for the structured extraction. If the image is unclear and Claude asks for a re-send, or if the user sends multiple photos for one recipe (one for ingredients, one for steps), costs multiply. Worse: the image tokens are counted in ADDITION to the system prompt tokens (~4,000-6,000 tokens for HeySous's full system prompt), making each photo import call significantly more expensive than a normal chat message.

**Why it happens:**
Anthropic's Vision API charges based on image resolution: `tokens = (width * height) / 750`. A typical phone photo is 3000x4000 pixels, which would be scaled down to ~1568px on the long edge (1568x1176 = ~2,459 tokens). Telegram's `getFile` downloads up to 20MB. Users may send unoptimized screenshots or high-res photos without thinking about cost implications.

**Consequences:**
- Token costs per photo import are 3-5x a normal chat message
- Users who import many photos can burn through API budget quickly
- No visibility into cost difference between text chat and photo import

**Prevention:**
- Resize images to max 1568px on the long edge BEFORE sending to Claude (matches Anthropic's internal downscaling, avoids latency penalty for oversized images)
- Use a MINIMAL system prompt for the extraction call -- do NOT send the full Sous persona + all preferences + plan context. Send only: "Extract the recipe from this image. Return structured JSON with: name, ingredients (array), steps (array), prep_time, cook_time, servings, notes."
- Log image-specific token usage separately (add a `conversationType: "photo_import"` to the token_usage table)
- Set a per-user daily limit on photo imports (e.g., 5 per day) to prevent cost spirals
- Show the user the extracted recipe for confirmation, just like URL imports. Never auto-save
- Accept JPEG format only (smaller than PNG). If Telegram sends a WebP, convert to JPEG before sending to Claude

**Warning signs:**
- `estimatedCost` in token_usage spikes on days with photo imports
- `inputTokens` for photo import calls are 3,000+ vs normal ~2,000
- Users sending 10+ photos in a day

**Phase to address:** Photo Recipe Import phase. Token cost management must be designed in from the start.

---

### Pitfall 4: Knowledge Dedup Search-Before-Save Matches Wrong Items

**What goes wrong:**
The dedup system searches existing knowledge before saving a new recipe. User says "save my chicken parmesan recipe." The FTS5 search for "chicken parmesan" returns an existing item: "Chicken Parmigiana" (different spelling, different recipe from a different source). The dedup system decides these are duplicates and either (a) silently overwrites the existing recipe with the new one, or (b) asks the user "Did you mean to update Chicken Parmigiana?" when they wanted to save a completely new recipe. The v1.3 auto-upsert was reverted for exactly this reason -- it was too aggressive.

**Why it happens:**
FTS5 with porter stemming treats "parmesan" and "parmigiana" as distinct tokens (no fuzzy match). But other cases DO produce false positives:
- "Chicken Stir Fry" matches "Chicken and Vegetable Stir Fry" (high BM25 score due to overlapping terms)
- "Pasta Bolognese" matches "Bolognese Sauce" (the sauce recipe, not the pasta dish)
- "Mom's Chocolate Cake" matches "Chocolate Cake" (different recipe, same search terms)
- Title matching alone is insufficient; content matching produces too many false positives (every chicken recipe mentions "chicken" in ingredients)

The fundamental problem: recipe similarity is SEMANTIC, not lexical. Two recipes with identical titles can be completely different dishes (regional variations), and two recipes with different titles can be the same dish.

**Consequences:**
- False positive: user asked to "update existing recipe?" when they want a new one. Annoying but recoverable
- True silent overwrite: existing recipe content destroyed, changelog has previous content but user may not know to look
- False negative: dedup misses actual duplicates, knowledge base accumulates copies

**Prevention:**
- Do NOT auto-upsert. The v1.3 revert was correct. Instead, implement "search-then-suggest":
  1. When `save_knowledge` is called, first search FTS5 for the title
  2. Return search results to Claude as part of the tool response: `"Similar items found: [id:42 'Chicken Parmigiana', id:67 'Chicken Parmesan (Grandma's)']"`
  3. Let Claude decide whether to create new or update existing, and let Claude ask the user if uncertain
  4. This is the agent pattern: Claude is the reasoning engine, tools provide data, Claude makes decisions
- Set a RELEVANCE THRESHOLD for dedup suggestions. BM25 scores below a threshold (e.g., relevance < 5.0) should not be surfaced as potential duplicates
- Match on title similarity PLUS tag overlap. If both items have tags `recipe`, `cuisine:italian`, `protein:chicken`, the dedup confidence is higher
- Add instructions to the system prompt: "When save_knowledge returns similar items, evaluate whether they are truly the same recipe or just similar. Ask the user if you are unsure. Different recipes can have similar names."

**Warning signs:**
- Users complaining "why did you overwrite my recipe?"
- Knowledge changelog showing updates the user did not request
- Duplicate recipes accumulating despite dedup being "enabled"
- Claude always choosing to update instead of create (system prompt instructions too aggressive)

**Phase to address:** Knowledge Dedup phase. This is a Claude tool + system prompt design issue, not just a DB query issue.

---

### Pitfall 5: Migration Runner Breaks Existing Ad-Hoc Migrations

**What goes wrong:**
HeySous currently has NO formal migration runner. Tables are created via `CREATE TABLE IF NOT EXISTS` in init functions, and the one real migration (`migrateToHouseholdId`) uses `PRAGMA table_info()` to detect if it has already run. A new migration framework introduces a `migrations` table and `PRAGMA user_version` tracking. But the EXISTING database has no version number set (`user_version` defaults to 0). The migration runner sees version 0 and tries to run ALL migrations from scratch, including ones that recreate tables that already exist. The `CREATE TABLE IF NOT EXISTS` statements are safe, but `ALTER TABLE ADD COLUMN` statements will fail with "duplicate column name" if the column was already added by the ad-hoc `migrateToHouseholdId` function.

**Why it happens:**
Bootstrapping a migration framework on an existing database with ad-hoc migrations is a chicken-and-egg problem. The existing database is in a state that no migration version describes. Version 0 does not mean "empty database" -- it means "database created before versioning existed."

**Consequences:**
- Migration runner crashes on startup, bot fails to start
- If crash is not caught, database could be in a half-migrated state (some ALTER TABLEs ran, others did not)
- Rolling back is difficult because there is no previous version to roll back to

**Prevention:**
- The migration runner's FIRST migration must be a "baseline" migration that detects the current database state and sets the version accordingly:
  ```sql
  -- Migration 001: Baseline
  -- If knowledge_items has household_id column, we are at baseline v1.3
  -- Set user_version = 1 and skip all prior setup
  ```
- Use `PRAGMA user_version` as the version tracker. It is a single integer, atomic, and survives crashes
- Each migration must be idempotent: use `ALTER TABLE ... ADD COLUMN ... IF NOT EXISTS` (available in SQLite 3.35.0+, which is bundled with better-sqlite3 on Node 22). Alternatively, check `PRAGMA table_info()` before each ALTER
- Run migrations in a transaction. If any step fails, the entire migration rolls back and `user_version` is not incremented
- Remove the ad-hoc `migrateToHouseholdId` function and replace it with a numbered migration that does the same thing idempotently. The numbered migration checks for `chat_id` column existence before renaming, just like the current code does
- Keep existing `CREATE TABLE IF NOT EXISTS` init functions for now. They are safe to run alongside the migration framework. Eventually, all schema creation should move into migrations, but that is a larger refactor

**Warning signs:**
- Bot fails to start after deploy with "duplicate column name" error
- `PRAGMA user_version` returns 0 on a database that has been through multiple releases
- Migration runner log shows "running migration 1" on a database that already has all tables

**Phase to address:** Data Migration Framework phase. This is foundational infrastructure -- must be implemented before any new schema changes.

---

## Moderate Pitfalls

Issues that cause degraded UX or increased maintenance burden, but not data loss.

### Pitfall 6: URL Fetch Blocked by Recipe Sites (Anti-Scraping)

**What goes wrong:**
Major recipe sites (NYT Cooking, Bon Appetit, Food Network, AllRecipes) employ anti-scraping measures. A bare `fetch()` from a Node.js server gets blocked with 403 Forbidden, a CAPTCHA page, or a Cloudflare challenge. The user sees "Sorry, I couldn't access that recipe." for most URLs they try.

**Why it happens:**
Recipe sites detect non-browser requests via:
- Missing or generic User-Agent header (`node-fetch/1.0` or `undici`)
- Missing browser headers (Accept, Accept-Language, Accept-Encoding, Sec-Fetch-* headers)
- Missing cookies/JavaScript execution (Cloudflare challenge requires JS)
- IP reputation (cloud server IPs are flagged more than residential IPs)
- Rate limiting (multiple fetches from the same IP in short succession)

**Prevention:**
- Set a realistic User-Agent header (e.g., `Mozilla/5.0 ... Chrome/120.0`) and include standard browser headers. This resolves ~60% of blocks
- For Cloudflare-protected sites, consider a headless browser fallback (Puppeteer), but this is heavy and should be a LAST RESORT for a single-process bot. Better to catch the 403 and tell the user to paste the recipe text instead
- Implement graceful degradation: if URL fetch fails, ask the user to copy-paste the recipe text or send a photo instead. Do not just say "failed"
- Cache successful fetches by URL (with a 24-hour TTL) so re-importing the same URL does not hit the site again
- Respect `robots.txt` -- do not fetch URLs where robots.txt disallows scraping. Recipe sites' terms of service often prohibit scraping
- Add the source URL to the saved knowledge item's `source` field so users can visit the original page

**Warning signs:**
- >50% of URL import attempts fail
- All failures are from the same domains (Cloudflare-protected sites)
- Users stop trying URL import after 2-3 failures

**Phase to address:** URL Recipe Import phase. Graceful degradation (paste fallback) must ship alongside the URL fetch feature.

---

### Pitfall 7: JavaScript-Rendered Recipe Pages Return Empty JSON-LD

**What goes wrong:**
The scraper fetches the HTML but finds no JSON-LD or schema.org markup. The recipe content is rendered client-side by React/Vue/Angular, and the initial HTML response contains only a shell `<div id="root"></div>` and JavaScript bundles. This is increasingly common on modern recipe platforms.

**Why it happens:**
Single-page applications (SPAs) load content via JavaScript after the initial HTML loads. A server-side `fetch()` gets the pre-rendered HTML, which has no recipe data. The JSON-LD that Google sees is either server-side rendered (SSR) or injected by the JavaScript at runtime.

**Prevention:**
- Check for JSON-LD first (it is usually present even in SSR apps because Google requires it for rich results)
- If no JSON-LD found, check for microdata format (`itemtype="https://schema.org/Recipe"`) in the HTML
- If neither found, fall back to sending the raw HTML (truncated to 10KB) to Claude with an extraction prompt. Claude can often find recipe structure even in messy HTML
- If the HTML is clearly a JavaScript shell (<1KB of meaningful content), inform the user: "This site loads recipes dynamically. Could you paste the recipe text instead?"
- Do NOT add Puppeteer for a single-process bot. The memory and CPU overhead of headless Chrome is not justified for a side feature. If JS-rendered sites become the majority case, consider a separate microservice

**Warning signs:**
- JSON-LD extraction returns null but the URL is a valid recipe page
- Fetched HTML is <5KB for a page that should have recipe content
- Pattern of failures from specific domains (React-based recipe platforms)

**Phase to address:** URL Recipe Import phase. Multiple fallback strategies in priority order.

---

### Pitfall 8: Telegram Photo Quality Too Low for Recipe Extraction

**What goes wrong:**
User photographs a recipe from a cookbook. Telegram compresses the photo before delivery. The bot downloads it via `getFile`, sends it to Claude Vision, and Claude returns garbled ingredients: "1/2 cup fluor" (flour), "2 tblsp" (tablespoons), "baking sod" (soda). Quantities are wrong because small text was not readable at the compressed resolution.

**Why it happens:**
Telegram applies lossy JPEG compression to photos. The resolution depends on how the image was sent:
- Sent as "Photo": Telegram compresses to ~1280px on the long edge, JPEG quality ~85%. Small cookbook text becomes blurry
- Sent as "Document/File": Original resolution preserved, up to 20MB via getFile
- Screenshots: Usually fine resolution but may have low contrast or small text

Claude Vision limitations (per official Anthropic docs):
- Images under 200px on any edge may degrade performance
- Claude may hallucinate or make mistakes with low-quality, rotated, or very small images
- Spatial reasoning is limited -- tabular recipe layouts may be misread
- Precise numeric extraction (quantities) is not Claude's strongest capability

**Prevention:**
- Instruct users to send photos as DOCUMENTS (not compressed photos) for best quality. Add this to the help text
- In the extraction prompt, tell Claude to flag low-confidence extractions: "If any ingredient quantity is unclear, mark it with [?] so the user can verify"
- After extraction, ALWAYS show the parsed recipe to the user for review. Never auto-save photo imports
- For photos with multiple recipe sections (e.g., a double-page spread), ask the user to crop to one recipe at a time
- Resize to max 1568px before sending to Claude (matches their internal scaling, avoids latency penalty for oversized images but ensures quality is not degraded further)
- Add a minimum quality check: if the image is below 400x400px after Telegram compression, warn the user that the quality may be too low

**Warning signs:**
- Extracted recipes have `[?]` markers on many quantities
- User corrects 3+ ingredients after extraction
- Small fractions (1/4, 1/8) are consistently misread
- Handwritten recipe photos produce unusable results

**Phase to address:** Photo Recipe Import phase. Quality guidance in help text + extraction confidence flagging.

---

### Pitfall 9: Update Notifications Trigger Mass 403 Blocks

**What goes wrong:**
On deploy, the bot sends a "What's new in v1.4" message to all registered users. Some users have not interacted with the bot in weeks. Some have blocked the bot. Some have muted it. Telegram returns 403 for blocked users, and if too many 403s occur in quick succession, Telegram may rate-limit the bot's token entirely (429 with a long `retry_after`). If the bot has 50+ users and sends all notifications at once, it hits the 30 messages/second global limit.

**Why it happens:**
Telegram's rate limits are strict: 30 messages per second per bot token, with per-chat limits of ~1 message per second. A broadcast to 50 users at full speed completes in ~2 seconds but risks rate limiting. More importantly, 403 errors from blocked users are PERMANENT -- retrying is pointless. And broadcasting to users who have not interacted recently increases the chance of spam reports, which can lead to Telegram shadow-banning the bot.

**Consequences:**
- Bot rate-limited by Telegram for hours after a deploy
- Regular chat messages delayed or dropped while rate limit is active
- Users who blocked the bot generate noise in error logs
- Spam reports could get the bot flagged by Telegram

**Prevention:**
- Track `last_seen_version` per user in the database. Only send update notifications for NEW versions the user has not seen
- Send notifications LAZILY: instead of broadcasting on deploy, send the "what's new" message when the user next messages the bot. This ensures they are active and have not blocked the bot
- If broadcasting is required, stagger messages: 1 message per second with jitter, respecting the 30 msg/s global limit
- Handle 403 gracefully (already done in `reminders/sender.ts`). Mark users who return 403 as `blocked: true` and stop sending them ANY proactive messages (reminders, notifications, feedback check-ins)
- Track blocked status in the users table. Check it before any outbound message
- Never send update notifications to users who have been inactive for >30 days

**Warning signs:**
- Error logs flooded with 403 errors during deploy
- Regular users experience delayed responses after a deploy
- Telegram returns 429 with `retry_after > 60` seconds
- `retry_after > 300` seconds indicates a shadow-ban -- back off for hours

**Phase to address:** Update Notifications phase. Lazy delivery (on next user interaction) is strongly preferred over broadcast.

---

### Pitfall 10: Notification Tone Rewrite Breaks Telegram HTML Formatting

**What goes wrong:**
The notification tone is changed from formal/generic to the conversational Sous persona style. The developer rewrites reminder templates and hardcoded fallback messages with new tone, but introduces Markdown syntax (`**bold**`, `*italic*`) instead of HTML (`<b>bold</b>`, `<i>italic</i>`). Or introduces unsupported HTML tags (`<br>`, `<p>`, `<ul>`, `<li>`). Telegram silently strips unsupported tags or returns "can't parse entities" errors. The `sendFormattedMessage` function catches the error and falls back to plain text, but the message looks ugly without any formatting.

**Why it happens:**
Telegram's HTML parse mode supports ONLY: `<b>`, `<i>`, `<u>`, `<s>`, `<tg-spoiler>`, `<a>`, `<code>`, `<pre>`, and `<blockquote>`. No `<br>`, `<p>`, `<div>`, `<span>`, `<ul>`, `<li>`, `<h1>`-`<h6>`. Developers accustomed to web HTML or Markdown introduce unsupported tags. The Claude-generated reminder text is particularly risky because Claude's system prompt says "use HTML" but Claude may still generate unsupported tags.

**Prevention:**
- Add a `sanitizeTelegramHtml()` function that strips unsupported HTML tags before sending. Run ALL outbound messages through it
- In the reminder system prompt and the main Sous system prompt, explicitly list ONLY the supported tags
- Write tests that verify template outputs contain only supported HTML tags
- When testing tone changes, send actual messages to a Telegram test chat and visually verify formatting
- Keep a test matrix: each template, each reminder type, each edge case (empty meal plan, no recipes, etc.)

**Warning signs:**
- Reminder messages arriving as plain text (fallback triggered)
- HTML entity errors in logs: "can't parse entities"
- Messages with literal `<br>` or `<p>` tags visible to users
- Claude-generated reminder text using `**bold**` Markdown instead of `<b>bold</b>` HTML

**Phase to address:** Notification Tone phase. Formatting sanitization should be implemented BEFORE the tone rewrite.

---

## Minor Pitfalls

Issues that cause minor inconvenience or technical debt.

### Pitfall 11: URL Import Creates Orphaned Knowledge Items on Parse Failure

**What goes wrong:**
The URL is fetched successfully, HTML is downloaded, but parsing fails midway. The tool handler has already created a placeholder knowledge item (with the URL as source) before attempting to parse. The parse failure leaves an empty or partially filled knowledge item in the database. The user does not know it exists, and it pollutes search results.

**Prevention:**
- Do NOT create the knowledge item until parsing is complete and the user has confirmed the recipe. The flow should be: fetch -> parse -> present to user -> user confirms -> save. No database writes until the final step
- If using a two-step flow (save draft, then finalize), mark drafts with a tag (`status:draft`) and clean up drafts older than 24 hours

---

### Pitfall 12: Dedup Search Adds Latency to Every Save Operation

**What goes wrong:**
Every `save_knowledge` tool call now runs an FTS5 search before the INSERT. For most saves, the search returns 0 results and adds 5-10ms of latency. But if the knowledge base is large (500+ items), the search takes longer. The tool handler is synchronous (better-sqlite3), so this blocks the event loop during the search.

**Prevention:**
- FTS5 searches on better-sqlite3 are fast (sub-millisecond for <1000 items). This is unlikely to be a real problem at HeySous's scale
- If it becomes an issue, limit the dedup search to title-only matching (not full content search): `WHERE knowledge_fts MATCH '"chicken parmesan"' AND ki.household_id = ?`
- Monitor search latency via `queryTimeMs` in the retrieval metrics

---

### Pitfall 13: Migration Framework Over-Engineering

**What goes wrong:**
The developer builds a sophisticated migration framework with rollback support, dry-run mode, version branches, and a CLI tool. The framework takes longer to build than the actual migrations it needs to run. HeySous has ~12 tables and will add 2-3 more in v1.4. The migration framework is enterprise-grade for a hobby project.

**Prevention:**
- Keep it simple: a numbered array of migration functions, `PRAGMA user_version` for tracking, run-at-startup execution
- Each migration is a function that takes `sqlite: BetterSqlite3.Database` and runs SQL in a transaction
- No rollback support needed -- SQLite migrations are forward-only. If a migration is wrong, write a new migration to fix it
- No CLI tool needed -- migrations run automatically on startup, matching the existing `createDatabase()` pattern
- Total implementation: ~50-80 lines of code. A `runMigrations(sqlite, migrations[])` function that checks `PRAGMA user_version`, runs pending migrations in order, and increments the version

---

## Phase-Specific Warnings

| Phase Topic | Likely Pitfall | Mitigation |
|-------------|---------------|------------|
| URL Recipe Import | Fetch hangs server (Pitfall 1) | 10s timeout, async fetch outside tool loop |
| URL Recipe Import | Anti-scraping blocks (Pitfall 6) | Browser-like headers, graceful degradation to paste |
| URL Recipe Import | Bad schema.org parsing (Pitfall 2) | Normalization layer, Claude fallback for messy HTML |
| URL Recipe Import | JS-rendered pages empty (Pitfall 7) | JSON-LD first, microdata second, Claude extraction third |
| Photo Recipe Import | Cost spirals (Pitfall 3) | Minimal system prompt, resize images, daily limits |
| Photo Recipe Import | Low quality extraction (Pitfall 8) | Confidence flagging, user review, document upload guidance |
| Knowledge Dedup | False positive matches (Pitfall 4) | Claude-driven dedup decisions, relevance threshold, no auto-upsert |
| Knowledge Dedup | Race with concurrent saves | better-sqlite3 is synchronous -- no actual race condition in this codebase. The "race" would only occur if dedup were async, which it should not be |
| Data Migration Framework | Conflicts with ad-hoc migrations (Pitfall 5) | Baseline migration that detects current state, idempotent ALTERs |
| Data Migration Framework | Breaking FTS5 triggers | Same as v1.2 Pitfall 3 -- use ALTER TABLE ADD COLUMN, not table rebuild. Verify triggers after migration |
| Update Notifications | Mass 403 blocks (Pitfall 9) | Lazy delivery on next interaction, staggered broadcast, blocked user tracking |
| Notification Tone | Broken HTML formatting (Pitfall 10) | Sanitization function, supported-tags-only in prompts, visual testing |

---

## Integration Gotchas

Common mistakes when connecting these new features to the existing system.

| Integration Point | Common Mistake | Correct Approach |
|-------------------|----------------|------------------|
| **URL import + Claude tool loop** | Making the HTTP fetch happen inside `handleToolCall` return value. The tool handler is synchronous, and `fetch()` is async. Either the handler becomes async (breaking the interface) or the developer uses a sync HTTP library (blocking the event loop) | Implement URL import as a two-phase flow: (1) Bot handler detects URL in user message, fetches and parses BEFORE entering the Claude pipeline. (2) Parsed recipe data is injected into the user message or a special tool context. Claude receives structured data, not a URL |
| **Photo import + message pipeline** | Sending the image to Claude inside the normal `sendMessageWithTools` call, which includes the full system prompt (4,000+ tokens). The image adds ~1,500 tokens on top. Total input is 6,000+ tokens for what should be a simple extraction | Use a separate, lightweight Claude call for image extraction with a minimal system prompt (~200 tokens). Parse the extraction result, THEN feed the structured recipe into the normal pipeline for Claude to present and confirm with the user |
| **Dedup + save_knowledge tool** | Modifying `save_knowledge` in `tool-handler.ts` to do dedup search before insert. This changes the tool's behavior for ALL saves, including preferences and cooking notes, not just recipes | Option A: Add dedup search only for items tagged `recipe`. Option B (preferred): Return similar items in the save response and let Claude handle the decision. The tool remains simple; the intelligence is in the system prompt |
| **Migration framework + createDatabase()** | Running migrations AFTER `initializeFts()` and other init functions. If a migration adds a new table that an init function references, the init function sees the old schema. Or worse: a migration alters a table that `initializeFts` just created triggers for | Run migrations FIRST, before any init functions. Migration order in `createDatabase()` should be: (1) basic PRAGMA settings, (2) migration runner, (3) init functions (which now only handle IF NOT EXISTS and triggers) |
| **Update notifications + users table** | Broadcasting to all rows in the `users` table without checking if the user has a valid Telegram chat. The users table may have entries for users who joined via invite but never actually sent a message (their Telegram ID is valid but the bot has no chat with them) | Only send notifications to users who have at least one row in the `messages` table (they have actually chatted with the bot). Or use the `last_active` timestamp from user sessions |
| **Notification tone + Claude-generated reminders** | Changing the REMINDER_SYSTEM_PROMPT in `reminders/sender.ts` but not updating the fallback text in `getFallbackText()`. When Claude API fails, users get the old formal tone from the fallback, creating an inconsistent experience | Update BOTH the Claude system prompt AND all hardcoded fallback text strings. Add a test that compares fallback messages against the expected tone |
| **Dedup search + FTS5 edge cases** | Searching for a recipe title that contains FTS5 special characters: "Bob's Amazing Mac & Cheese" breaks FTS5 MATCH because `&` is an operator. The existing `escapeForFts5()` function strips most operators but may miss edge cases | Verify `escapeForFts5()` handles: apostrophes, ampersands, parentheses, colons, and Unicode characters. Add test cases for recipe titles with special characters |

---

## "Looks Done But Isn't" Checklist

Things that appear complete but are missing critical pieces.

- [ ] **URL fetch works** -- but does it set a timeout? Without `AbortSignal.timeout()`, a slow server can hang the bot indefinitely
- [ ] **JSON-LD extraction works** -- but does it handle `@graph` arrays? Many sites nest the Recipe inside `@graph: [{@type: "WebPage"}, {@type: "Recipe"}]`
- [ ] **JSON-LD extraction works** -- but does it handle multiple `<script type="application/ld+json">` tags on the same page? Some sites have separate JSON-LD blocks for Recipe, BreadcrumbList, and Organization
- [ ] **Photo extraction works** -- but was it tested with Telegram-compressed photos? Testing with high-res local files is not representative of real usage
- [ ] **Photo extraction works** -- but does the system prompt for extraction include the supported recipe format? Without explicit format instructions, Claude returns free-form text instead of the structured Ingredients/Steps/Notes format HeySous uses
- [ ] **Dedup search finds matches** -- but does it respect household boundaries? The search must filter by `householdId` to avoid cross-household false positives
- [ ] **Dedup search finds matches** -- but does Claude know what to do with the results? If the save_knowledge tool response includes similar items but the system prompt has no instructions about dedup, Claude ignores them
- [ ] **Migration runner works** -- but does it handle a FRESH database (no tables at all)? The baseline migration must handle both "existing database with tables" and "brand new empty database" cases
- [ ] **Migration runner works** -- but does it run BEFORE FTS5 init? If `initializeFts()` runs before migrations, and a migration adds a column that triggers need, the trigger creation may reference stale schema
- [ ] **Update notification sends** -- but does it check if the user has already seen this version? Without `last_seen_version` tracking, users get the same notification every time the bot restarts
- [ ] **Update notification sends** -- but does it handle 403 (blocked) users? If not, the notification loop logs errors for every blocked user on every deploy
- [ ] **Notification tone is updated** -- but are ALL message templates updated? Check: reminder fallback text, error messages (IN_CHARACTER_ERROR), timeout warning, access gate rejection, onboarding prompts, and feedback check-in text
- [ ] **Notification tone is updated** -- but does the Claude system prompt match? If the system prompt still says "keep things casual" but the reminder system prompt says "be formal", the tone is inconsistent between chat and reminders
- [ ] **URL source stored** -- but is it displayed when Claude references the recipe? If the `source` field is saved but never included in search results or get_knowledge_item responses, Claude cannot tell the user where the recipe came from
- [ ] **Photo import handles errors** -- but what if Telegram's `getFile` fails? The 20MB limit applies, and if the file server is temporarily unavailable, the download fails silently

---

## HeySous-Specific Constraints

Constraints unique to this codebase that affect implementation decisions.

| Constraint | Impact on v1.4 Features | How to Handle |
|------------|------------------------|---------------|
| **Single-process Node.js** | URL fetch and image processing must not block the event loop. No spawning worker threads for scraping | Use async fetch with timeouts. Keep image processing lightweight (resize only, no heavy image manipulation). If scraping becomes a bottleneck, add a simple job queue (in-memory, not Redis) |
| **Synchronous better-sqlite3** | All database operations are synchronous and block the event loop. FTS5 dedup search adds blocking time to save operations | FTS5 queries are sub-millisecond for <1000 items. Not a real concern. But do NOT add async database operations (defeats the purpose of better-sqlite3's synchronous design) |
| **Tool handler is synchronous** | `handleToolCall` returns a string, not a Promise. Cannot do async work (HTTP fetch, Claude vision call) inside a tool handler | URL fetch and photo extraction must happen BEFORE the tool loop, not inside it. Pre-process the data and make it available to Claude as context, not as a tool call result |
| **Claude is the reasoning engine** | Dedup decisions, recipe format validation, extraction quality assessment -- all should be Claude's job, not hardcoded logic | Give Claude the data (similar items, extraction confidence, parse quality) and let Claude decide. Do not build complex decision trees in TypeScript |
| **HTML parse mode only** | All outbound messages use Telegram HTML. No Markdown, no unsupported HTML tags | Sanitize all generated text. Test every template in a real Telegram chat |
| **4096-char message limit** | Recipe imports can produce long content (full recipe with ingredients, steps, notes) | Use the existing `splitMessage()` function. But design the recipe confirmation message to fit in one chunk if possible |
| **WAL mode + foreign keys enabled** | Migrations must respect foreign key constraints. WAL mode means readers do not block writers | Run migrations in transactions. Temporarily disable foreign keys for complex migrations (`PRAGMA foreign_keys = OFF`) |
| **No PRAGMA user_version in use** | Fresh start for migration framework -- no legacy version numbers to worry about, but must handle the "already-migrated" existing database | Baseline migration detects current state via PRAGMA table_info |

---

## Sources

- **Codebase audit:** All knowledge, AI, pipeline, telegram, and reminder modules reviewed. Key files: `src/knowledge/repository.ts`, `src/knowledge/fts.ts`, `src/ai/tools.ts`, `src/ai/tool-handler.ts`, `src/pipeline/processor.ts`, `src/reminders/sender.ts`, `src/db/index.ts`, `src/db/migrate.ts`, `src/telegram/sender.ts`
- **Anthropic Vision API documentation** (official, HIGH confidence): Image limits (5MB API, 8000x8000px max, 1568px optimal, ~1334 tokens per 1MP), supported formats (JPEG, PNG, GIF, WebP), limitations (low-quality image hallucinations, spatial reasoning limits) -- https://platform.claude.com/docs/en/build-with-claude/vision
- **Telegram Bot API rate limits** (MEDIUM confidence, multiple sources): 30 msg/s global limit, ~1 msg/s per chat, 403 for blocked users, 429 with retry_after for rate limits -- https://core.telegram.org/bots/faq, https://telegramhpc.com/news/574/
- **Telegram getFile limit:** 20MB max via Bot API, original quality via Document upload -- https://grammy.dev/guide/files
- **SQLite ALTER TABLE documentation** (official, HIGH confidence): ADD COLUMN, RENAME COLUMN, DROP COLUMN supported; no ADD CONSTRAINT, no ALTER COLUMN type -- https://www.sqlite.org/lang_altertable.html
- **Schema.org Recipe type** (official, HIGH confidence): JSON-LD structure, recipeIngredient array, recipeInstructions variants, ISO 8601 duration format -- https://schema.org/Recipe
- **Recipe scraping libraries** (MEDIUM confidence): `scrape-recipe-schema` npm package for JSON-LD/microdata extraction -- https://github.com/arcetros/scrape-recipe-schema
- **Web scraping anti-bot challenges** (MEDIUM confidence, multiple sources): Cloudflare challenges, User-Agent detection, rate limiting patterns -- https://www.scrapingbee.com/blog/web-scraping-challenges/
- **Previous HeySous pitfalls research:** `.planning/research/PITFALLS.md` (v1.2), covering chatId migration, FTS5 trigger preservation, SQLite migration patterns -- directly applicable patterns reused here
- **v1.3 dedup revert context:** From milestone context -- auto-upsert was too aggressive, merged distinct recipes. Informs Pitfall 4 design (Claude-driven dedup, not automatic)

**Confidence notes:**
- HIGH confidence on all codebase-specific pitfalls (direct code audit of current implementation)
- HIGH confidence on Claude Vision API limits (official Anthropic documentation, fetched and verified)
- HIGH confidence on SQLite migration pitfalls (official documentation, plus experience from v1.2 migrateToHouseholdId)
- MEDIUM confidence on recipe site anti-scraping behavior (web search sources, varies by site)
- MEDIUM confidence on Telegram rate limit specifics (API 8.0 changes are from multiple web sources, not official docs verified via Context7)
- LOW confidence on `scrape-recipe-schema` library quality/maintenance (npm package, should evaluate at implementation time)

---
*Pitfalls research for: Adding URL/photo recipe import, knowledge dedup, data migration framework, update notifications, and notification tone changes to HeySous (v1.4)*
*Researched: 2026-02-19*
