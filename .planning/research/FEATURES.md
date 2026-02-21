# Feature Landscape

**Domain:** v1.4 Backlog Sweep -- Recipe import, knowledge dedup, migration framework, update notifications, tone overhaul
**Researched:** 2026-02-19
**Overall confidence:** HIGH

## Table Stakes

Features that are expected given the v1.4 scope. Missing = feature feels incomplete.

| Feature | Why Expected | Complexity | Notes |
|---------|--------------|------------|-------|
| Recipe URL import | Users share recipe links constantly. A cooking bot that can't read a URL feels broken. Every competitor (Paprika, Whisk, Plan to Eat) has this. | Medium | cheerio for JSON-LD/Microdata extraction + Claude fallback. New tool + module. |
| Recipe photo import | Cookbook photos, handwritten recipes, screenshots. "Just snap a photo" is the natural UX for physical media. | Medium | Pipeline extension for multimodal messages. Claude vision API handles OCR + understanding in one step. |
| Dedup check on save | Users will import the same recipe twice, or describe conversationally what they already imported from a URL. Duplicates erode trust in the knowledge base. | Low | Search-before-save in existing tool handler. Claude-driven decisions. |
| update_knowledge validation | Calling update with no fields should return an error, not silently succeed. | Low | Add 4-line validation check. |
| Migration tracking | The codebase already has ad-hoc migrations (`migrateToHouseholdId` checks column names). A framework prevents "did this run?" ambiguity. | Low | ~50 LOC runner + PRAGMA user_version. |

## Differentiators

Features that set the product apart. Not expected, but valued.

| Feature | Value Proposition | Complexity | Notes |
|---------|-------------------|------------|-------|
| Proactive update notifications | Users learn about new features without checking a changelog. Drives adoption of new capabilities. | Medium | Startup routine + version tracking + rate-limited delivery to all households. |
| Conversational notification tone | Reminders and system messages feel like they come from Sous the friend, not a system. Reinforces persona across ALL bot-initiated messages. | Low | Content rewrite of existing templates + fallback text + centralized message module. |
| JSON-LD + Microdata extraction | Recipes import cleanly with ingredients, steps, and metadata preserved. Handles both major structured data formats covering ~80%+ of recipe blogs. | Medium | cheerio parses HTML, extracts schema.org Recipe data. ISO 8601 duration parsing utility. |
| AI fallback for unstructured pages | When no structured data found (~20% of recipe pages), Claude extracts recipe from raw page text. Dramatically improves import success rate. | Medium | Increases token cost per import (~2K-5K tokens) but catches pages that JSON-LD misses. |
| Claude vision for photos | Handles handwritten recipes, non-standard layouts, cookbook photos, social media screenshots -- anything a human could read. | Low (existing capability) | Claude vision natively handles text extraction + semantic understanding. |
| URL detection mid-conversation | User says "I found this: https://..." while chatting. Bot detects URL via Telegram message entities and offers to import. | Medium | Parse `ctx.message.entities` for URL type, no separate command needed. |
| Dedup warning with existing item details | Instead of silently creating a dupe or hard-rejecting, show the user what already exists and let them decide. | Low | Return existing match data in tool result. Claude reasons about it. |
| Multi-photo recipe support | Recipe spans two cookbook pages. User sends both photos, bot combines into one recipe. | Medium | Debounce queue already batches messages; extend to batch photos within window. |

## Anti-Features

Features to explicitly NOT build.

| Anti-Feature | Why Avoid | What to Do Instead |
|--------------|-----------|-------------------|
| Automatic recipe save from URL (no confirmation) | Users may share links in conversation without wanting to save. Auto-save creates clutter. | Claude decides when to offer saving, user confirms before save_knowledge is called. |
| Paywall bypass / login-wall scraping | Legal liability, technically unreliable, sites change paywalls frequently. | "That page looks like it needs a login. Try copy-pasting the recipe text to me directly!" |
| Full DOM scraping with headless browser | Massive dependency (Puppeteer/Playwright), slow, memory-heavy for single-process bot. JSON-LD is in initial HTML. | cheerio for static HTML parsing, Claude fallback for unstructured content. |
| Image OCR library (Tesseract) | Heavy native dependency, worse than Claude at understanding recipe context and layout. | Claude vision handles OCR + understanding in one step. |
| Recipe import from video | TikTok/YouTube video analysis is extremely complex, slow, and expensive. | Suggest user screenshot the recipe card overlay and send as photo. |
| Recipe modification from imported URL | Complex merge logic between imported content and user edits. Versioning nightmare. | Import creates a standard knowledge item. User edits via existing update_knowledge flow. |
| Bulk URL import | "Import all my bookmarks" creates 50+ Claude calls and $5+ in API costs. | Support one URL at a time. Batch import is a v2+ feature if needed. |
| Auto-migration rollback | Rollback logic doubles complexity. SQLite doesn't support DROP COLUMN easily pre-3.35. | Forward-only migrations. Backup before deploy. Migrations tested before production. |
| Version-specific notification customization per user | "Show feature X only if user has tried Y" -- overcomplicated for a personal bot. | Same release notes to all users. Keep it simple. |
| Auto-upsert dedup | v1.3 tried this and it was reverted -- merged distinct recipes with similar names. | Search-then-suggest. Claude + user make the decision, not automatic logic. |
| Rich media notifications | Telegram supports images but building rich update notifications adds complexity for marginal value. | Plain text notifications in Sous voice are sufficient and more personal. |

## Feature Dependencies

```
Migration Framework -> Update Notifications (needs notification + delivery tables)
Knowledge Dedup Fix -> URL Import (imported recipes should dedup)
Knowledge Dedup Fix -> Photo Import (extracted recipes should dedup)
URL Import -> Photo Import (URL establishes the import-to-save flow pattern)
Tone Overhaul -> Update Notifications (notifications must use correct voice)
```

Independent features (no dependencies):
- Notification Tone Overhaul
- update_knowledge validation fix

## MVP Recommendation

Prioritize:
1. **Migration framework** -- Foundation for future schema changes. Low complexity, high structural value.
2. **Knowledge dedup fix** -- Prevents data quality degradation. Low complexity, immediate user value. Must exist before import ships.
3. **Recipe URL import** -- Highest user-facing value. Medium complexity but well-scoped.
4. **Recipe photo import** -- Second-highest user-facing value. Builds on URL import patterns.

Defer to later in milestone:
5. **Notification tone overhaul** -- Important but not blocking. Polish before announcing features.
6. **Update notifications** -- Ship last. Use it to announce the import features.

---

## URL Import: Detailed Feature Spec

**User flow:**
1. User sends: "Hey, save this recipe: https://www.seriouseats.com/chicken-parm-recipe"
2. Claude detects URL, calls `import_from_url` tool
3. Tool fetches URL, parses HTML with cheerio, extracts recipe via JSON-LD/Microdata or returns raw text
4. Claude formats the recipe and presents for review (same display format as manually created recipes)
5. User says "looks good" or makes tweaks
6. Claude calls `save_knowledge` (with dedup check, source URL populated)
7. Claude confirms: "Saved your chicken parm recipe!"

**Extraction strategy (in priority order):**
1. JSON-LD with `@type: "Recipe"` -- handles `@graph` arrays, top-level arrays, nested objects
2. Microdata with `itemtype="https://schema.org/Recipe"` -- `itemprop` attributes for ingredients, instructions
3. Claude fallback -- truncated page text sent to Claude for freeform extraction

**Schema.org Recipe field mapping:**

| schema.org Field | HeySous Format | Notes |
|-----------------|----------------|-------|
| `name` | title | Direct mapping |
| `description` | summary (1-2 sentences) | Truncate if needed |
| `recipeIngredient[]` | Ingredients section | Array of strings, one per line |
| `recipeInstructions[]` | Steps section | string[] or HowToStep[].text -- flatten to plain strings |
| `prepTime` | Prep Time | ISO 8601 (PT30M) -> "30 min" |
| `cookTime` | Cook Time | Same format |
| `totalTime` | Total Time | Same format |
| `recipeYield` | Servings | String or number |
| `recipeCategory` | meal type tag | Map to meal:dinner, meal:lunch, etc. |
| `recipeCuisine` | cuisine tag | Map to cuisine:italian, etc. |

**Normalization applied to extracted data:**
- Parse ISO 8601 durations (`PT1H30M` -> `1 hour 30 minutes`)
- Flatten `HowToStep` / `HowToSection` objects to plain step strings
- Strip HTML tags from all text fields
- Clean SEO spam from titles (trailing "Recipe", "Best Ever", year numbers)
- Store source URL in knowledge item's `source` field

**Edge cases:**

| Edge Case | Detection | Response |
|-----------|-----------|----------|
| Paywalled recipe (NYT, Bon Appetit) | Short HTML / login redirect / no recipe data | "That page looks like it needs a login. Try copy-pasting the recipe text to me directly!" |
| Non-recipe URL | No Recipe in structured data; AI fallback finds nothing | "I didn't find a recipe on that page. Is there a specific recipe link?" |
| URL returns 404/500 | HTTP fetch error | "I couldn't reach that page -- can you double-check the link?" |
| Multiple recipes on one page | JSON-LD array of Recipe objects | Take first/primary. "I found a few recipes on that page -- here's the main one." |
| Missing fields (no ingredients) | Structured data incomplete | "I got the name but the ingredients weren't on the page. Want to add them?" |
| Non-English recipe | JSON-LD in page language | Save as-is. Claude translates if asked. |
| Bot-blocked site (429/Cloudflare) | HTTP error or challenge | "That site seems to be blocking me. Try copy-pasting the recipe text instead!" |
| Redirect chains / shortened URLs | Follow redirects (Node.js fetch default) | Transparent to user |

**Technical requirements:**
- HTTP client: Node.js built-in `fetch()` (Node 22, no new dep)
- HTML parsing: `cheerio` (new dependency, ~90KB, TypeScript support, well-maintained)
- Duration parsing: Simple regex utility (PT30M -> "30 min", PT1H15M -> "1 hr 15 min")
- User-Agent header: Set to something reasonable to avoid bot detection
- No headless browser needed (JSON-LD is in initial HTML for recipe blogs)

---

## Photo Import: Detailed Feature Spec

**User flow:**
1. User sends photo (from camera, gallery, or forwarded message)
2. Optional: user includes caption like "save this recipe" or "what do you think of this?"
3. Photo is downloaded via grammY `ctx.getFile()`, base64 encoded, sent to Claude as multimodal content
4. Claude sees the image with full system prompt + all tools, extracts recipe information
5. Claude presents extracted recipe for review
6. User confirms -> Claude calls `save_knowledge` (with dedup check)

**Claude Vision API content block:**

```typescript
{
  type: "image",
  source: {
    type: "base64",
    media_type: "image/jpeg",  // Telegram compresses photos to JPEG
    data: base64ImageData       // string
  }
}
```

**Key parameters (verified from official docs):**
- Formats: JPEG, PNG, GIF, WebP (Telegram delivers JPEG for photos)
- Max: 5MB/image (API limit), 20MB (Telegram download limit)
- Token cost: ~1,334 tokens per 1MP image (~$0.004 at Haiku 4.5 pricing)
- Auto-resize above 1568px long edge (adds TTFT latency, no quality gain)
- grammY: `ctx.getFile()` returns file path valid ~60 min, download via `https://api.telegram.org/file/bot<token>/<file_path>`

**Pipeline changes required:**
- Extend `PendingBatch.messages` to carry optional image data: `{ text: string; imageBase64?: string; imageMimeType?: string }`
- Add `message:photo` handler alongside existing `message:text`
- Build Claude message content array with image block + text extraction prompt
- Caption extracted from `ctx.message.caption` and included as text alongside image
- Handle `message:document` for uncompressed images (optional, lower priority)

**Edge cases:**

| Edge Case | Detection | Response |
|-----------|-----------|----------|
| Blurry / low-quality photo | Claude returns incomplete extraction | "That was a bit hard to read. Try a clearer photo, or I can help fill in the gaps!" |
| Photo of food dish (not a recipe) | Claude recognizes dish, not text | "That looks delicious! Want me to help write up a recipe for it?" |
| Screenshot with non-recipe content | Claude identifies non-recipe content | "That doesn't look like a recipe to me." |
| Multi-page recipe (2-3 photos) | Multiple photos in debounce window | Batch photos, send all to Claude as multi-image request |
| Handwritten with unclear text | Claude attempts but may misread | Show extraction for confirmation; user corrects before save |
| Photo > 5MB | Size check before API call | "That photo's a bit large -- try cropping or sending a smaller version!" |
| Sticker / GIF / video | Different Telegram message types | "I can read recipe photos but not videos -- try a screenshot!" |
| Photo with caption | `ctx.message.caption` present | Include caption as additional context for Claude |

---

## Knowledge Dedup: Detailed Feature Spec

**Problem:** The system prompt says "search before saving" but Claude sometimes skips search, doesn't recognize matches (different phrasing: "Chicken Parmesan" vs "Chicken Parm"), or saves anyway. v1.3 attempted auto-upsert and it was reverted because it merged distinct recipes with similar names.

**Solution: Defensive dedup at tool handler level (Claude-driven decisions)**

1. Before creating a new knowledge item in `save_knowledge` handler, call `findSimilar(title, householdId, tags)`
2. `findSimilar()` runs FTS5 search with the title as query, then compares results:
   - Normalize titles: lowercase, strip articles ("the", "a"), trim whitespace
   - Token overlap scoring on normalized titles
   - For recipes: match on >80% token overlap
   - For preferences: match on domain tag overlap + title similarity
3. If match found:
   - Return tool result: `{ duplicate_found: true, existing_id: 42, existing_title: "Chicken Parmesan", existing_summary: "..." }`
   - Claude asks user: "You already have 'Chicken Parmesan' saved. Want me to update it instead?"
   - Claude uses `update_knowledge` if user agrees, or proceeds with `save_knowledge` if user says they're different
4. If no match: proceed with normal save

**Critical design constraint:** Never auto-merge. Always return match info to Claude, let Claude + user decide. This was the lesson from the v1.3 revert.

**Dedup by item type:**

| Type | Approach | Action on Match |
|------|----------|-----------------|
| Recipes (`recipe` tag) | FTS5 title search + normalized title comparison | Return match to Claude; Claude asks user |
| Preferences (`preference` tag) | FTS5 + same domain tag overlap | Return match to Claude; Claude proposes update |
| Other knowledge | Skip dedup | Duplicates of notes are low-risk |

---

## Migration Framework: Detailed Feature Spec

**Current state:** `CREATE TABLE IF NOT EXISTS` in init functions + one ad-hoc `migrateToHouseholdId` that checks PRAGMA table_info for column names.

**Design: `user_version` pragma + numbered migration functions**

```typescript
interface Migration {
  version: number;
  description: string;
  up: (sqlite: BetterSqlite3.Database) => void;
}

function runMigrations(sqlite: BetterSqlite3.Database): void {
  const currentVersion = sqlite.pragma("user_version", { simple: true });
  for (const migration of migrations) {
    if (migration.version > currentVersion) {
      sqlite.transaction(() => {
        migration.up(sqlite);
        sqlite.pragma(`user_version = ${migration.version}`);
      })();
    }
  }
}
```

**Key decisions:**
- Forward-only (no rollback) -- SQLite ALTER TABLE limitations make rollbacks unreliable
- Keep existing `CREATE TABLE IF NOT EXISTS` in init functions (harmless, idempotent)
- Migrations handle: ALTER TABLE, data transforms, new tables beyond init
- Each migration atomic (runs in transaction)
- Version tracked via `user_version` pragma (no extra table needed)
- Slot into `createDatabase()` after pragmas, before init functions
- Existing `migrateToHouseholdId` remains as-is (already idempotent)

---

## Update Notification System: Detailed Feature Spec

**Schema:**

```sql
notifications:
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  version TEXT NOT NULL UNIQUE,       -- e.g., "1.4.0" or "2026-02-url-import"
  content TEXT NOT NULL,               -- Message text (HTML format, Sous voice)
  created_at INTEGER NOT NULL

notification_deliveries:
  notification_id INTEGER NOT NULL,
  household_id TEXT NOT NULL,
  sent_at INTEGER NOT NULL,
  PRIMARY KEY (notification_id, household_id)
```

**Delivery:**
- Admin creates via `/notify` command or notifications defined in code
- Sender iterates all active households, rate-limited at ~33ms between messages (~30/sec)
- Delivery tracked per-household; survives server restart
- Failed deliveries (blocked bot, deleted chat) logged and skipped, not retried

**Telegram rate limits:** ~30 msgs/sec across all chats. For small user base (<100 households): `setTimeout(33)` suffices. Implement backoff on 429 errors for safety.

**Message tone:** Pre-written by developer in Sous voice. Notifications are infrequent; hand-crafting the message is worth the consistency.

---

## Notification Tone Overhaul: Detailed Feature Spec

**Messages needing rewrite (audit of hardcoded strings):**

| Current | Location | Sous Version(s) |
|---------|----------|-----------------|
| "Sorry, I'm having trouble thinking right now. Try again in a moment!" | `processor.ts` IN_CHARACTER_ERROR | "My brain's a bit scrambled -- try again in a sec!" / "Ugh, kitchen emergency in my head. Give me a moment!" |
| "This is taking longer than usual, hang tight..." | `processor.ts` timeout | "Still working on that -- bear with me!" / "Taking a little extra time to think this through..." |
| Fallback reminder text | `sender.ts` getFallbackText() | Already decent; add 3-4 varied alternatives per reminder type |
| Access gate rejection | middleware | "Hey! I'm a private kitchen assistant. You'll need an invite to get started." |

**What makes tone authentic (research-backed):**
1. **Consistency** -- every message same character voice. Friendly greeting + corporate error = trust broken.
2. **Contractions always** -- "I'm", "can't", not "I am", "cannot"
3. **Variability** -- multiple phrasings per message type, randomly selected
4. **Brevity** -- system messages = one line, not a paragraph
5. **Food metaphors where natural** -- "scrambled" (eggs), "simmer on that" (cooking). Don't force it.
6. **No exclamation overload** -- one per message max. Enthusiasm through word choice, not punctuation.

**Implementation:** New `src/telegram/messages.ts` module with arrays of alternatives per message type and a `pick()` random selection function.

---

## Sources

- Codebase analysis of existing tool definitions, handler patterns, knowledge schema (HIGH confidence)
- [Schema.org Recipe type](https://schema.org/Recipe) -- structured data format for recipes (HIGH confidence)
- [Anthropic Vision Documentation](https://platform.claude.com/docs/en/build-with-claude/vision) -- image processing capabilities and limits (HIGH confidence, verified Feb 2026)
  - Formats: JPEG, PNG, GIF, WebP | Max 5MB/image | ~1,334 tokens/1MP image | Auto-resize >1568px
- [grammY File Handling](https://grammy.dev/guide/files) -- photo download via `getFile()`, 20MB limit (HIGH confidence)
- [cheerio](https://cheerio.js.org/) -- HTML parsing for JSON-LD and Microdata extraction (HIGH confidence)
- [Scraping recipes with Node.js and JSON-LD](https://www.raymondcamden.com/2024/06/12/scraping-recipes-using-nodejs-pipedream-and-json-ld) -- practical implementation guide (MEDIUM confidence)
- [Telegram Bot FAQ](https://core.telegram.org/bots/faq) -- broadcast rate limits: ~30 msgs/sec (HIGH confidence)
- [NN/g: ChatGPT and Tone](https://www.nngroup.com/articles/chatgpt-and-tone/) -- authoritative UX research on AI tone (HIGH confidence)
- [Chatbot personality design](https://www.chatbot.com/blog/personality/) -- conversational AI voice design (MEDIUM confidence)
- [SQLite user_version pragma](https://sqlite.org/forum/forumpost/0f9dd8806f) -- native migration versioning (HIGH confidence)
- [Paprika Recipe Manager](https://www.paprikaapp.com/) -- competitor UX for URL import flow (HIGH confidence)
- v1.3 dedup revert context -- informs Claude-driven dedup design, never auto-merge (HIGH confidence)
