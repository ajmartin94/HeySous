# Phase 5: Preference Learning - Research

**Researched:** 2026-02-06
**Domain:** User preference storage, retrieval, and constraint application within the existing knowledge system; system prompt engineering for preference behavior
**Confidence:** HIGH

## Summary

Phase 5 adds preference learning on top of the existing Phase 3 knowledge system and Phase 4 recipe tools. Preferences are knowledge items -- same table, same FTS5 search, same save/update/delete tools. The work is fundamentally a system prompt engineering exercise: teaching Claude when to capture preferences, how to store them with appropriate tags, how to retrieve and apply them as constraints, and how to handle conflicts and overrides. No new database tables, no new tools, no new external libraries are needed.

The critical architectural question is how preferences get injected into Claude's context so they can actively influence behavior (PREF-02). There are two approaches: (A) proactive tag-based loading where preferences are fetched before every Claude call and injected into the system prompt, or (B) relying entirely on Claude's tool-use search to find relevant preferences during reasoning. This research recommends **Approach A: proactive preference loading** -- a lightweight query that fetches all items tagged `preference` for the current chat and injects them as a system prompt section. This guarantees preferences are always available without depending on Claude remembering to search, which is essential for hard constraints like allergies.

The only new code beyond system prompt changes is: (1) a `listByTag` repository method or raw SQL query to fetch preference items, (2) a preference injection step in the processor that loads preferences and passes them to `buildSystemPrompt()`, (3) a `/preferences` command handler following the existing Composer pattern, and (4) system prompt additions for preference behavior.

**Primary recommendation:** Proactively load all preference knowledge items (tagged `preference`) into the system prompt before every Claude call. This ensures hard constraints like allergies are always visible without relying on tool-use search. Keep preferences concise -- title + summary only -- to stay within token budget. Full content available via get_knowledge_item if Claude needs detail.

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

#### Preference categories
- Open-ended -- no rigid taxonomy of preference types
- Any kind of preference the user states gets stored: dietary, scheduling, cooking style, household members, equipment, budget, serving sizes, etc.
- Household-aware: users can state preferences about other household members ("my kid is allergic to peanuts", "my wife doesn't eat pork") and those apply when planning for the family
- Stored as free-text knowledge items (same as recipes) -- Claude interprets meaning and severity from the wording each time

#### Constraint behavior
- No explicit hard/soft distinction in storage -- Claude interprets severity from context ("allergy" = hard constraint, "we prefer" = soft influence)
- Override behavior: warn and comply -- if user explicitly asks for something that conflicts with a stored preference, flag it ("Just a heads up -- you mentioned a shellfish allergy. Want me to go ahead anyway?") then proceed if confirmed
- Preferences retrieved contextually by relevance (like other knowledge), not all loaded every time -- meal planning pulls schedule prefs, recipe requests pull dietary prefs
- When preferences conflict with each other ("we love rich food" + "low-calorie meals"), Claude flags the tension and asks which to prioritize

#### Capture & confirmation
- Both explicit and inferred capture -- "remember I don't eat pork" (explicit) and patterns like repeated quick-meal requests on Tuesdays (inferred)
- Acknowledge, don't ask -- bot says "Noted -- I'll remember no shellfish" without waiting for confirmation; user can correct if wrong
- Uses existing knowledge write tools (save_knowledge / update_knowledge) with preference-appropriate tagging
- Brief acknowledgment then continue conversation seamlessly -- "Noted: no cilantro. Now for that Thai recipe..."

#### Preference visibility
- Conversational queries work naturally -- "what are my preferences?" / "what do you know about me?"
- Dedicated /preferences command for quick formatted list
- Both show everything including household member preferences ("Your preferences" + "Household")
- Claude organizes the display naturally when presenting (dietary together, schedule together) -- no rigid categories in storage
- Removal is conversational with same brief style -- "Noted, you aren't looking for gluten free anymore" then continues the conversation

### Claude's Discretion
- How inferred preferences are detected (conversation pattern analysis approach)
- Preference tagging strategy within the knowledge system
- Exact formatting of /preferences command output
- How preferences are ranked/selected for context injection when token budget is limited

### Deferred Ideas (OUT OF SCOPE)
None -- discussion stayed within phase scope
</user_constraints>

## Standard Stack

No new dependencies required. The existing stack covers everything.

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| better-sqlite3 | 12.6.2 | SQLite for preference queries via existing knowledge tables | Already installed; tag-based queries for preference loading |
| drizzle-orm | 0.45.1 | ORM for knowledge CRUD (preferences are knowledge items) | Already installed; existing repository handles all operations |
| @anthropic-ai/sdk | 0.73.0 | Same tools as Phase 4; no new tool definitions needed | Already installed; save_knowledge/update_knowledge/delete_knowledge work for preferences |
| grammy | 1.39.3 | /preferences command handler using Composer pattern | Already installed; follows /costs and /debug handler patterns exactly |
| pino | 10.3.0 | Logging preference operations | Already installed |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| vitest | 4.0.18 | Testing preference retrieval query, tag-based loading | Already installed as devDependency |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Proactive preference loading via system prompt | Tool-based search only | Tool-search is lazy -- Claude might not search for preferences when suggesting a recipe, violating PREF-02 (allergies excluded). Proactive loading guarantees visibility. |
| Tag-based preference retrieval | Separate preferences table | Separate table fragments the knowledge system; tags keep everything unified and searchable |
| Compact preference summaries in system prompt | Full preference content in system prompt | Full content is wasteful; summaries provide enough info for Claude to apply constraints; Claude can use get_knowledge_item for detail |

**Installation:**
No new packages needed.

## Architecture Patterns

### Recommended Project Structure
```
src/
  knowledge/
    repository.ts        # MODIFIED: add listByTag() method for preference loading
    schema.ts            # NO CHANGE
    fts.ts               # NO CHANGE
    retrieval.ts         # NO CHANGE
    token-budget.ts      # NO CHANGE
    types.ts             # NO CHANGE
  ai/
    system-prompt.ts     # MODIFIED: accept preferences param, add preference behavior instructions
    tools.ts             # MODIFIED: update tool descriptions to mention preferences alongside recipes
    tool-handler.ts      # NO CHANGE (existing handlers already support preference CRUD)
    claude-client.ts     # MODIFIED: pass preferences to buildSystemPrompt()
  pipeline/
    processor.ts         # MODIFIED: load preferences before Claude call, pass to system prompt
  bot/
    handlers/
      preferences.ts     # NEW: /preferences command handler
    index.ts             # MODIFIED: register preferences handler
  main.ts                # MODIFIED: wire preferences handler
```

### Pattern 1: Preference Tagging Strategy
**What:** All preferences use a `preference` base tag plus optional namespaced subtags for categorization. This mirrors the `recipe` base tag pattern from Phase 4.
**When to use:** Every preference save/update.
**Confidence:** HIGH -- follows the established namespaced tag taxonomy from Phase 4

```
PREFERENCE TAG TAXONOMY:

Base tag (always present):
  preference              -- marks this as a preference, not a recipe or note

Subject tags (who the preference is about):
  subject:self            -- default, about the user themselves
  subject:household       -- about a household member (kid, spouse, etc.)
  subject:family          -- about the whole family

Domain tags (what kind of preference):
  pref:dietary            -- food restrictions, allergies, dislikes
  pref:schedule           -- dinner time, meal prep days, busy nights
  pref:cooking            -- cooking style, equipment, skill level
  pref:household          -- household size, members, ages
  pref:budget             -- grocery budget, price sensitivity
  pref:serving            -- serving sizes, portions, leftovers preference
  pref:grocery            -- preferred stores, shopping habits

Optional severity tags (Claude can add when obvious):
  severity:allergy        -- life-threatening, absolute hard constraint
  severity:restriction    -- strong avoidance (religious, ethical, medical)
  severity:preference     -- soft preference, can be overridden
```

Example stored preferences:

```
Title: "No shellfish - allergy"
Summary: "User has a shellfish allergy. Never include shrimp, crab, lobster, etc."
Content: "Shellfish allergy -- includes shrimp, crab, lobster, crawfish, clams, mussels, oysters, scallops. This is a serious allergy, not just a preference."
Tags: ["preference", "pref:dietary", "subject:self", "severity:allergy"]

Title: "Kid's peanut allergy"
Summary: "User's child is allergic to peanuts. Exclude from all family meals."
Content: "Child (kid) has a peanut allergy. Must exclude peanuts and peanut products from any meal planned for the family."
Tags: ["preference", "pref:dietary", "subject:household", "severity:allergy"]

Title: "Dinner at 6pm on weekdays"
Summary: "Family eats dinner at 6pm on weekday evenings."
Content: "Weekday dinner time is 6pm. This means prep should start by 5-5:30pm depending on recipe complexity."
Tags: ["preference", "pref:schedule", "subject:family"]

Title: "Prefers quick meals on Tuesdays"
Summary: "Tuesdays are busy -- user prefers meals under 30 minutes."
Content: "Inferred from conversation patterns: user frequently asks for quick meal ideas on Tuesdays. Likely a busy day. Suggest 30-minute or less recipes for Tuesday dinners."
Tags: ["preference", "pref:schedule", "subject:self", "inferred"]
```

Note the `inferred` tag on the last example -- this distinguishes preferences Claude detected from patterns vs. ones the user explicitly stated. This allows Claude to present inferred preferences with less certainty ("I noticed you tend to want quick meals on Tuesdays -- is that right?") when reviewing preferences.

### Pattern 2: Proactive Preference Loading into System Prompt
**What:** Before every Claude call, fetch all knowledge items tagged `preference` for the current chat and inject their titles + summaries into the system prompt. This guarantees preferences are always visible to Claude without relying on tool-use search.
**When to use:** Every message processing cycle in the processor.
**Confidence:** HIGH -- this is the only way to guarantee PREF-02 and PREF-04

```typescript
// In knowledge/repository.ts -- add listByTag method
listByTag(chatId: string, tag: string, limit: number = 50): KnowledgeItem[] {
  // Raw SQL because Drizzle doesn't natively support JOIN-based filtering
  // on the tags table in a clean way
  const rows = db
    .select()
    .from(knowledgeItems)
    .where(eq(knowledgeItems.chatId, chatId))
    .all();

  // Filter by tag -- since preference count per user is small (typically <20),
  // this is fine. For scale, use a raw SQL JOIN.
  return rows.filter(item => {
    const tags = db
      .select({ tag: knowledgeTags.tag })
      .from(knowledgeTags)
      .where(eq(knowledgeTags.knowledgeItemId, item.id))
      .all()
      .map(r => r.tag);
    return tags.includes(tag);
  }).slice(0, limit).map(item => {
    const tags = db
      .select({ tag: knowledgeTags.tag })
      .from(knowledgeTags)
      .where(eq(knowledgeTags.knowledgeItemId, item.id))
      .all()
      .map(r => r.tag);
    return buildKnowledgeItem(item, tags);
  });
}
```

**Better approach -- raw SQL for efficiency:**

```typescript
// In knowledge/repository.ts -- more efficient tag-based query
listByTag(chatId: string, tag: string, limit: number = 50): KnowledgeItem[] {
  // Use the underlying SQLite instance for an efficient JOIN query
  // This avoids loading all items just to filter by tag
  const stmt = sqlite.prepare(`
    SELECT DISTINCT ki.*
    FROM knowledge_items ki
    JOIN knowledge_tags kt ON kt.knowledge_item_id = ki.id
    WHERE ki.chat_id = ? AND kt.tag = ?
    ORDER BY ki.last_accessed_at DESC
    LIMIT ?
  `);
  const rows = stmt.all(chatId, tag, limit);
  // ... build KnowledgeItem objects with tags
}
```

**However**, the repository currently only uses Drizzle, not raw SQLite. A cleaner approach is to add this as a method on the repository that uses Drizzle with a subquery or as a utility function that takes the sqlite instance directly. Given the codebase pattern where `fts.ts` uses raw SQLite and `repository.ts` uses Drizzle, the recommendation is:

**Recommendation: Add a `getPreferenceSummaries` function in a new utility (or in `fts.ts` / a new `preferences.ts`) that uses raw SQLite for the efficient JOIN query, similar to how `searchFts` and `getFullItem` in `fts.ts` use raw SQLite.**

```typescript
// Candidate: src/knowledge/preferences.ts (new file)
// or add to fts.ts alongside other raw SQLite queries

export function getPreferenceSummaries(
  sqlite: BetterSqlite3.Database,
  chatId: string,
  limit: number = 30,
): Array<{ id: number; title: string; summary: string; tags: string[] }> {
  const rows = sqlite.prepare(`
    SELECT DISTINCT ki.id, ki.title, ki.summary
    FROM knowledge_items ki
    JOIN knowledge_tags kt ON kt.knowledge_item_id = ki.id
    WHERE ki.chat_id = ? AND kt.tag = 'preference'
    ORDER BY ki.last_accessed_at DESC
    LIMIT ?
  `).all(chatId, limit) as Array<{
    id: number;
    title: string;
    summary: string;
  }>;

  const tagStmt = sqlite.prepare(
    `SELECT tag FROM knowledge_tags WHERE knowledge_item_id = ?`
  );

  return rows.map(row => {
    const tags = (tagStmt.all(row.id) as Array<{ tag: string }>).map(t => t.tag);
    return { id: row.id, title: row.title, summary: row.summary, tags };
  });
}
```

### Pattern 3: System Prompt Preference Injection
**What:** `buildSystemPrompt()` becomes parameterized -- it accepts an optional preferences array and injects them as a `<user_preferences>` section. This section tells Claude what the user's preferences are and instructs constraint application behavior.
**When to use:** Every Claude call in the processor.
**Confidence:** HIGH -- follows the existing pattern where `buildSystemPrompt()` was designed as a function (not constant) specifically for this future injection

```typescript
// system-prompt.ts modification
interface PreferenceSummary {
  id: number;
  title: string;
  summary: string;
  tags: string[];
}

export function buildSystemPrompt(preferences?: PreferenceSummary[]): string {
  const base = `You are Sous, a friendly...`; // existing prompt

  const preferenceSection = buildPreferenceSection(preferences);

  return base + preferenceSection;
}

function buildPreferenceSection(preferences?: PreferenceSummary[]): string {
  if (!preferences || preferences.length === 0) {
    return `

<preference_management>
... preference capture/management instructions (always present) ...
</preference_management>`;
  }

  // Format preferences compactly for context injection
  const prefLines = preferences.map(p => {
    const isInferred = p.tags.includes('inferred');
    const isAllergy = p.tags.includes('severity:allergy');
    const marker = isAllergy ? ' [ALLERGY]' : isInferred ? ' [inferred]' : '';
    return `- ${p.title}${marker}: ${p.summary}`;
  });

  return `

<user_preferences>
The user has the following stored preferences. Apply these as constraints:
${prefLines.join('\n')}

CRITICAL: Items marked [ALLERGY] are absolute hard constraints -- NEVER suggest items containing these allergens.
Items marked [inferred] were detected from conversation patterns -- present with less certainty if reviewing.
All other preferences should influence your suggestions but can be overridden if the user explicitly requests it.
</user_preferences>

<preference_management>
... preference capture/management instructions (always present) ...
</preference_management>`;
}
```

**Key design detail:** The preference management instructions (how to capture, acknowledge, handle conflicts) are ALWAYS present in the system prompt, regardless of whether any preferences exist yet. The `<user_preferences>` data section is only present when preferences exist.

### Pattern 4: Preference Capture and Acknowledgment Flow
**What:** System prompt instructions that teach Claude to detect, capture, and acknowledge preferences in conversation. Both explicit ("remember I don't eat pork") and inferred (patterns detected across conversations).
**When to use:** Always present in system prompt.
**Confidence:** HIGH -- this is prompt engineering following established patterns from recipe management

The system prompt `<preference_management>` section should instruct:

1. **Explicit capture:** When user states a preference, immediately save it via save_knowledge with appropriate tags. Acknowledge briefly: "Noted: no pork." Then continue the conversation.

2. **Inferred capture:** When Claude notices a pattern (e.g., user always asks for quick meals on certain days, always avoids certain ingredients without saying so), save it as an inferred preference with the `inferred` tag. Acknowledge with appropriate uncertainty: "I've noticed you tend to go for quick meals on Tuesdays -- I'll keep that in mind."

3. **No confirmation required:** Unlike recipes, preferences don't need a confirmation step before saving. The user stated it -- save it. If it's wrong, they'll correct it.

4. **Immediate effect:** After saving a preference, it will appear in the system prompt on the NEXT message. For the current turn, Claude should apply it from conversational context.

5. **Updates:** When user changes a preference ("actually dinner is at 6:30 now"), search for the existing preference, update it via update_knowledge, acknowledge briefly.

6. **Removal:** When user says "I'm not doing the gluten-free thing anymore", delete the preference and acknowledge: "Noted, you're not looking for gluten-free anymore."

7. **Conflict detection:** When preferences contradict each other (stored or being stated), flag the tension and ask which takes priority. Example: "Just checking -- you mentioned loving rich food, but also wanting low-calorie meals. Want me to focus on one, or find a balance?"

8. **Override behavior:** When user explicitly requests something that conflicts with a stored preference, warn once and comply: "Just a heads up -- you mentioned a shellfish allergy. Want me to go ahead anyway?" Then proceed if confirmed.

### Pattern 5: /preferences Command Handler
**What:** A new command handler following the exact pattern of `/costs` and `/debug`. Registered as a Composer, wired in bot/index.ts and main.ts.
**When to use:** When user types /preferences.
**Confidence:** HIGH -- exact same pattern as existing handlers

```typescript
// bot/handlers/preferences.ts (NEW)
import { Composer } from "grammy";
import type { BotContext } from "../context.js";
import type BetterSqlite3 from "better-sqlite3";
import { getPreferenceSummaries } from "../../knowledge/preferences.js";
import { sendFormattedMessage } from "../../telegram/sender.js";

export function createPreferencesHandler(
  sqlite: BetterSqlite3.Database,
): Composer<BotContext> {
  const handler = new Composer<BotContext>();

  handler.command("preferences", async (ctx) => {
    const chatId = String(ctx.chat.id);
    const prefs = getPreferenceSummaries(sqlite, chatId);

    if (prefs.length === 0) {
      await ctx.reply(
        "No preferences saved yet! Just tell me things like " +
        "\"we eat dinner at 6pm\" or \"no shellfish\" and I'll remember."
      );
      return;
    }

    // Group preferences by domain for display
    // Claude would organize these naturally in conversation,
    // but for the command we do it in code for consistency
    const grouped = groupPreferences(prefs);
    const message = formatPreferenceList(grouped);

    await sendFormattedMessage(ctx, message);
  });

  return handler;
}
```

**Two approaches for /preferences display:**

**Approach A (recommended): Code-formatted display.** The handler formats the preference list directly using HTML, grouping by domain tag. This is fast (no Claude call), consistent, and cheap (no API cost).

**Approach B: Claude-formatted display.** Route /preferences through the message pipeline and let Claude format the display naturally from the loaded preferences. This is more natural but costs an API call for every /preferences invocation.

**Recommendation: Approach A** -- format in code. The /preferences command should be instant and free. Claude already handles preference questions conversationally ("what do you know about me?") through the normal message flow. The /preferences command is the "quick formatted list" per the user decision.

Formatting structure for /preferences output:

```html
<b>Your Preferences</b>

<b>Dietary</b>
- No shellfish [ALLERGY]
- No pork
- Prefers Mediterranean cuisine

<b>Schedule</b>
- Dinner at 6pm weekdays
- Quick meals on Tuesdays [inferred]

<b>Household</b>
- Kid's peanut allergy [ALLERGY]
- Wife doesn't eat pork

<b>Cooking</b>
- Has an Instant Pot
- Prefers one-pot meals on weeknights

<i>Say "forget [preference]" to remove, or just tell me if anything changed.</i>
```

The grouping logic maps domain tags to display categories:
- `pref:dietary` + `severity:allergy` + `severity:restriction` -> "Dietary"
- `pref:schedule` -> "Schedule"
- `subject:household` -> "Household" (regardless of other domain tags)
- `pref:cooking` + `pref:budget` + `pref:serving` + `pref:grocery` -> other categories
- Untagged/uncategorized -> "Other"

### Pattern 6: Processor Integration
**What:** The processor loads preferences before each Claude call and passes them to `buildSystemPrompt()`. Minimal change to the existing flow.
**When to use:** Every message processing cycle.
**Confidence:** HIGH -- straightforward addition to existing processor flow

```typescript
// In processor.ts, between conversation context build and Claude call:

// Load user preferences for system prompt injection
const preferences = getPreferenceSummaries(sqlite, chatId);

// The system prompt now includes preferences
// buildSystemPrompt is called inside claudeClient, so we need to
// either pass preferences through or restructure slightly

// Option 1: Pass preferences to the claude client
// Option 2: Build system prompt in processor and pass it in
// Option 3: Make buildSystemPrompt a closure that captures preferences
```

**Recommended approach:** Modify `createClaudeClient` to accept an optional `systemPromptOverride` parameter, or better yet, modify the processor to build the system prompt and pass it to the Claude client. Looking at the current code, `buildSystemPrompt()` is called inside `sendMessage` and `sendMessageWithTools` in `claude-client.ts`. The cleanest pattern is:

**Option: Make `sendMessageWithTools` accept a `systemPrompt` parameter.**

```typescript
// claude-client.ts modification
async sendMessageWithTools(
  messages: Anthropic.MessageParam[],
  tools: Anthropic.Tool[],
  onToolCall: (name: string, input: Record<string, unknown>) => string,
  maxIterations?: number,
  systemPrompt?: string, // NEW optional parameter
): Promise<ClaudeResponse> {
  const prompt = systemPrompt ?? buildSystemPrompt();
  // ... rest uses prompt instead of calling buildSystemPrompt()
}
```

Then in processor.ts:

```typescript
const preferences = getPreferenceSummaries(sqlite, chatId);
const systemPrompt = buildSystemPrompt(preferences);
// ...
response = await claudeClient.sendMessageWithTools(
  fullMessages,
  KNOWLEDGE_TOOLS,
  toolHandler.handleToolCall,
  5,
  systemPrompt, // pass built prompt
);
```

This keeps the change minimal and backwards-compatible.

### Anti-Patterns to Avoid
- **Separate preferences table:** Don't create a `user_preferences` table. Preferences ARE knowledge items with the `preference` tag. A separate table fragments the knowledge system and loses FTS5 search capability.
- **Preference-specific tools:** Don't create `save_preference`, `update_preference`, `delete_preference` tools. The generic knowledge tools handle preferences. Tool descriptions just need to mention preferences alongside recipes.
- **Hard-coded preference categories:** Don't create an enum of preference types in code. Preferences are open-ended and Claude interprets them from free text. Tags provide loose categorization but the content itself carries the meaning.
- **Loading all preference content into system prompt:** Summaries are sufficient for constraint application. Full content would waste tokens. Claude can use `get_knowledge_item` to read the full content when needed.
- **Relying solely on tool-use search for preferences:** Claude might not search for "dietary preferences" when a user asks "suggest a dinner recipe." Proactive loading ensures allergies and restrictions are always visible.
- **Asking for confirmation before saving preferences:** Unlike recipes, the user decision is explicit: "Acknowledge, don't ask." Save immediately, acknowledge briefly.

## Don't Hand-Roll

Problems that look simple but have existing solutions:

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Preference storage | Custom preferences table | Knowledge items with `preference` tag | Existing infrastructure handles CRUD, search, FTS5 indexing, token budgeting |
| Preference CRUD | New tool definitions | Existing save/update/delete_knowledge tools | Tools are generic by design; just update descriptions and system prompt |
| Allergy constraint enforcement | Code-level allergy checking | System prompt instructions + proactive loading | Claude understands "allergy" semantically; code-level checks are brittle and incomplete |
| Preference conflict detection | Rule engine for conflicts | System prompt instructions for Claude to reason | Conflicts are contextual and nuanced; Claude handles ambiguity better than rules |
| Preference categorization | NLP classifier | Claude auto-tags per taxonomy + system prompt | Same pattern that works for recipe tagging |
| Inferred preference detection | Statistical pattern analysis | Claude's conversational reasoning + system prompt guidance | Claude naturally notices patterns in conversation context |

**Key insight:** Like Phase 4, this phase is primarily a system prompt engineering exercise. The infrastructure exists. The work is teaching Claude new behaviors.

## Common Pitfalls

### Pitfall 1: Preferences Not Visible When Claude Suggests Recipes
**What goes wrong:** User has a stored shellfish allergy, asks "suggest a dinner recipe", and Claude suggests shrimp scampi. The allergy preference exists in storage but Claude never searched for it.
**Why it happens:** If preferences are only available via tool-use search, Claude must decide to search for "dietary preferences" before suggesting recipes. This is unreliable -- Claude focuses on the recipe request, not on checking constraints.
**How to avoid:** Proactive preference loading. All preferences are injected into the system prompt before every Claude call. Claude SEES the allergy in its context and avoids suggesting shellfish naturally.
**Warning signs:** Users reporting that the bot "forgot" their allergies or preferences.

### Pitfall 2: Preference Summary Too Verbose for System Prompt
**What goes wrong:** A user with 20+ preferences causes the system prompt to balloon, consuming too many tokens and pushing conversation history out of the context window.
**Why it happens:** Each preference summary might be 50-100 tokens. 20 preferences = 1000-2000 tokens just for the preference section, which is significant given the 4K knowledge soft limit.
**How to avoid:** Keep preference summaries extremely concise (1 sentence, ~20-30 tokens each). The system prompt injection uses title + summary only, not full content. For 20 preferences at 25 tokens each, that's 500 tokens -- reasonable. Set a practical limit (30 preferences) and if exceeded, prioritize by: allergy tags first, then by recency. Token budget for preference injection should be separate from the knowledge search budget.
**Warning signs:** Token costs increasing significantly after users add many preferences.

### Pitfall 3: Duplicate Preferences Accumulating
**What goes wrong:** User says "no shellfish" on Monday, then "remember I can't eat shellfish" on Thursday. Two separate preference items are saved for the same constraint.
**Why it happens:** Claude doesn't search for existing preferences before saving a new one. Each statement triggers a fresh save_knowledge call.
**How to avoid:** System prompt must instruct Claude to search for existing preferences before saving. If the preference already exists, update it rather than creating a duplicate. The instruction: "Before saving a new preference, search to check if a similar preference already exists. If it does, update it instead of creating a duplicate."
**Warning signs:** /preferences showing duplicated entries.

### Pitfall 4: Inferred Preferences Saved Too Aggressively
**What goes wrong:** After two Tuesday conversations where the user happened to ask for quick meals, Claude saves "Prefers quick meals on Tuesdays" as a preference. The user finds this creepy or inaccurate.
**Why it happens:** The threshold for "pattern" is subjective. Claude might over-infer from limited data.
**How to avoid:** System prompt should instruct Claude to be conservative with inferred preferences: require at least 3 instances of a pattern before inferring, and when saving, acknowledge it as an inference with lower certainty: "I've noticed you tend to go for quick meals on Tuesdays -- I'll keep that in mind. Let me know if that's not a thing." The `inferred` tag allows distinguishing these from explicit preferences.
**Warning signs:** Users saying "I never said that" about a preference.

### Pitfall 5: /preferences Command Not Registered Before Message Handler
**What goes wrong:** /preferences text gets caught by the message handler (catch-all for message:text) instead of the command handler, triggering a Claude API call instead of the instant formatted list.
**Why it happens:** grammY processes middleware in registration order. The message handler is the catch-all that must be last. If /preferences handler is registered after the message handler, it never fires.
**How to avoid:** Register the preferences handler before the message handler in bot/index.ts, matching the existing pattern where /costs and /debug are registered before the catch-all.
**Warning signs:** /preferences responses looking like conversational Claude responses rather than a formatted list.

### Pitfall 6: Preference Changes Not Reflected Until Next Message
**What goes wrong:** User says "remember I'm vegetarian" -- Claude saves the preference and acknowledges -- but in the SAME message, Claude then suggests a chicken recipe.
**Why it happens:** Preferences are loaded into the system prompt at the START of processing. When Claude saves a new preference mid-conversation, the system prompt doesn't update until the next message.
**How to avoid:** This is inherent to the architecture and acceptable. The system prompt instructs Claude: "After saving a preference in the current turn, apply it immediately from conversational context even though it won't appear in your preference list until the next message." Claude is already aware of the preference from the user's statement in the current turn.
**Warning signs:** Not typically a problem in practice -- Claude already knows the preference from the current message context.

### Pitfall 7: buildSystemPrompt Signature Change Breaks sendMessage
**What goes wrong:** Adding a `preferences` parameter to `buildSystemPrompt()` changes the function signature, but `sendMessage()` (the non-tool variant) also calls it without passing preferences.
**Why it happens:** Both `sendMessage` and `sendMessageWithTools` in `claude-client.ts` call `buildSystemPrompt()`.
**How to avoid:** Make preferences optional with a default of undefined/empty. Or better: pass the system prompt string into both methods as a parameter (built externally in the processor), so the client doesn't need to know about preferences at all.
**Warning signs:** TypeScript compilation errors.

## Code Examples

### Preference Retrieval Function
```typescript
// src/knowledge/preferences.ts (NEW file)
import type BetterSqlite3 from "better-sqlite3";

export interface PreferenceSummary {
  id: number;
  title: string;
  summary: string;
  tags: string[];
}

/**
 * Load all preference summaries for a chat.
 * Returns lightweight title+summary for system prompt injection.
 * Uses raw SQLite for efficient JOIN query (same pattern as fts.ts).
 */
export function getPreferenceSummaries(
  sqlite: BetterSqlite3.Database,
  chatId: string,
  limit: number = 30,
): PreferenceSummary[] {
  const rows = sqlite.prepare(`
    SELECT DISTINCT ki.id, ki.title, ki.summary
    FROM knowledge_items ki
    JOIN knowledge_tags kt ON kt.knowledge_item_id = ki.id
    WHERE ki.chat_id = ? AND kt.tag = 'preference'
    ORDER BY ki.last_accessed_at DESC
    LIMIT ?
  `).all(chatId, limit) as Array<{
    id: number;
    title: string;
    summary: string;
  }>;

  const tagStmt = sqlite.prepare(
    `SELECT tag FROM knowledge_tags WHERE knowledge_item_id = ?`
  );

  return rows.map(row => {
    const tags = (tagStmt.all(row.id) as Array<{ tag: string }>).map(t => t.tag);
    return { id: row.id, title: row.title, summary: row.summary, tags };
  });
}
```

### System Prompt Preference Section
```typescript
// Addition to system-prompt.ts

function buildPreferenceContext(preferences: PreferenceSummary[]): string {
  if (preferences.length === 0) return '';

  const lines = preferences.map(p => {
    const markers: string[] = [];
    if (p.tags.includes('severity:allergy')) markers.push('ALLERGY');
    if (p.tags.includes('severity:restriction')) markers.push('RESTRICTION');
    if (p.tags.includes('inferred')) markers.push('inferred');
    const markerStr = markers.length > 0 ? ` [${markers.join(', ')}]` : '';
    return `- ${p.title}${markerStr}: ${p.summary}`;
  });

  return `
<user_preferences>
The user has the following stored preferences. Apply these as active constraints when making suggestions:

${lines.join('\n')}

HARD CONSTRAINTS: Items marked [ALLERGY] or [RESTRICTION] must NEVER be violated in any suggestion. If a user explicitly asks for something containing an allergen, warn them first.
SOFT PREFERENCES: Other items influence your suggestions but the user can override them.
INFERRED: Items marked [inferred] were detected from conversation patterns. Present with appropriate uncertainty when reviewing.
</user_preferences>`;
}
```

### Preference Management System Prompt Section
```typescript
// Always-present instructions for preference behavior
const PREFERENCE_MANAGEMENT_PROMPT = `
<preference_management>
You can save, update, and delete user preferences using the same knowledge tools as recipes.

DETECTING PREFERENCES:
- When a user states a preference ("I don't eat pork", "dinner is at 6pm", "we love Thai food"), save it immediately
- When you notice a pattern (user repeatedly asks for quick meals on specific days), save it as an inferred preference
- Look for: dietary restrictions, allergies, schedule preferences, cooking style, equipment, household info, budget

SAVING PREFERENCES:
- Use save_knowledge with the "preference" tag PLUS relevant domain tags
- Tag taxonomy: preference, pref:dietary, pref:schedule, pref:cooking, pref:household, pref:budget, pref:serving, pref:grocery
- Subject tags: subject:self (default), subject:household (for family members)
- Severity tags: severity:allergy, severity:restriction (when clearly stated)
- For inferred preferences, add the "inferred" tag
- Title should be concise and descriptive: "No shellfish - allergy", "Dinner at 6pm weekdays"
- Summary should be a single sentence explaining the preference clearly
- Content can include additional context or detail
- IMPORTANT: Before saving, search for existing similar preferences to avoid duplicates. Update existing ones rather than creating new entries.
- Do NOT ask for confirmation -- save immediately and acknowledge briefly

ACKNOWLEDGMENT STYLE:
- Brief and natural: "Noted: no pork." then continue the conversation
- For allergies: "Noted -- I'll remember the shellfish allergy." then continue
- For inferred: "I've noticed you tend to prefer quick meals on Tuesdays -- I'll keep that in mind."
- For removal: "Noted, you're not looking for gluten-free anymore."
- NEVER make it a separate step -- acknowledge and seamlessly continue

APPLYING PREFERENCES:
- Preferences listed in <user_preferences> are active constraints
- [ALLERGY] items: NEVER suggest recipes or ingredients containing these allergens
- [RESTRICTION] items: Treat as strong avoidances -- don't suggest unless user explicitly asks
- Schedule preferences: Use when discussing meal timing or planning
- Cooking preferences: Consider when suggesting recipes (equipment, difficulty, time)
- Household preferences: Apply when planning for the family, not just the individual

CONFLICT HANDLING:
- If stored preferences conflict (e.g., "loves rich food" + "wants low-calorie meals"), flag the tension: "Just checking -- you mentioned wanting both rich food and low-calorie meals. Want me to lean one way or find a balance?"
- If a request conflicts with a stored allergy, warn and ask: "Just a heads up -- you mentioned a shellfish allergy. Want me to go ahead anyway?"
- If confirmed, proceed but don't delete the preference

UPDATING PREFERENCES:
- When user says "actually, dinner is at 6:30 now", search for the existing dinner time preference and update it
- Acknowledge briefly: "Updated -- dinner at 6:30."
- For removal: "forget the low-carb thing" -> search, delete, acknowledge: "Noted, dropping the low-carb preference."

PREFERENCE QUERIES:
- "What are my preferences?" / "What do you know about me?" -> Present all preferences grouped naturally
- Group by category when presenting: dietary together, schedule together, household together
- Include household member preferences in a separate section
- Mark inferred preferences when displaying: "I also noticed: [inferred preferences]"

INFERRED PREFERENCES:
- Be conservative -- require noticing a pattern at least 3 times before saving
- When saving, acknowledge as an inference, not a certainty
- Tag with "inferred" so /preferences can distinguish them
- If user corrects an inferred preference, update or delete it without defensiveness
</preference_management>`;
```

### /preferences Command Handler
```typescript
// src/bot/handlers/preferences.ts (NEW)
import { Composer } from "grammy";
import type { BotContext } from "../context.js";
import type BetterSqlite3 from "better-sqlite3";
import { getPreferenceSummaries, type PreferenceSummary } from "../../knowledge/preferences.js";
import { sendFormattedMessage } from "../../telegram/sender.js";

/**
 * Create a /preferences command handler.
 * Displays all stored preferences grouped by category.
 * No admin restriction -- any user can view their own preferences.
 * Factory pattern matches createCostsHandler, createDebugHandler.
 */
export function createPreferencesHandler(
  sqlite: BetterSqlite3.Database,
): Composer<BotContext> {
  const handler = new Composer<BotContext>();

  handler.command("preferences", async (ctx) => {
    const chatId = String(ctx.chat.id);
    const prefs = getPreferenceSummaries(sqlite, chatId);

    if (prefs.length === 0) {
      await ctx.reply(
        "No preferences saved yet! Just tell me things like " +
        "\"we eat dinner at 6pm\" or \"no shellfish\" and I'll remember."
      );
      return;
    }

    const message = formatPreferenceDisplay(prefs);
    await sendFormattedMessage(ctx, message);
  });

  return handler;
}

interface GroupedPreferences {
  dietary: PreferenceSummary[];
  schedule: PreferenceSummary[];
  household: PreferenceSummary[];
  cooking: PreferenceSummary[];
  other: PreferenceSummary[];
}

function groupPreferences(prefs: PreferenceSummary[]): GroupedPreferences {
  const groups: GroupedPreferences = {
    dietary: [],
    schedule: [],
    household: [],
    cooking: [],
    other: [],
  };

  for (const pref of prefs) {
    if (pref.tags.includes('subject:household')) {
      groups.household.push(pref);
    } else if (pref.tags.includes('pref:dietary')) {
      groups.dietary.push(pref);
    } else if (pref.tags.includes('pref:schedule')) {
      groups.schedule.push(pref);
    } else if (pref.tags.includes('pref:cooking') ||
               pref.tags.includes('pref:budget') ||
               pref.tags.includes('pref:serving') ||
               pref.tags.includes('pref:grocery')) {
      groups.cooking.push(pref);
    } else {
      groups.other.push(pref);
    }
  }

  return groups;
}

function formatPrefLine(pref: PreferenceSummary): string {
  const markers: string[] = [];
  if (pref.tags.includes('severity:allergy')) markers.push('ALLERGY');
  if (pref.tags.includes('inferred')) markers.push('inferred');
  const markerStr = markers.length > 0 ? ` [${markers.join(', ')}]` : '';
  return `- ${pref.title}${markerStr}`;
}

function formatPreferenceDisplay(prefs: PreferenceSummary[]): string {
  const groups = groupPreferences(prefs);
  const sections: string[] = ['<b>Your Preferences</b>'];

  if (groups.dietary.length > 0) {
    sections.push('');
    sections.push('<b>Dietary</b>');
    groups.dietary.forEach(p => sections.push(formatPrefLine(p)));
  }

  if (groups.schedule.length > 0) {
    sections.push('');
    sections.push('<b>Schedule</b>');
    groups.schedule.forEach(p => sections.push(formatPrefLine(p)));
  }

  if (groups.household.length > 0) {
    sections.push('');
    sections.push('<b>Household</b>');
    groups.household.forEach(p => sections.push(formatPrefLine(p)));
  }

  if (groups.cooking.length > 0) {
    sections.push('');
    sections.push('<b>Cooking</b>');
    groups.cooking.forEach(p => sections.push(formatPrefLine(p)));
  }

  if (groups.other.length > 0) {
    sections.push('');
    sections.push('<b>Other</b>');
    groups.other.forEach(p => sections.push(formatPrefLine(p)));
  }

  sections.push('');
  sections.push('<i>Say "forget [preference]" to remove, or tell me if anything changed.</i>');

  return sections.join('\n');
}
```

### Processor Integration
```typescript
// processor.ts modifications (in processBatch, between conversation context build and Claude call)

import { getPreferenceSummaries } from "../knowledge/preferences.js";
import { buildSystemPrompt } from "../ai/system-prompt.js";

// ... inside processBatch, after building fullMessages:

// Load user preferences for system prompt injection
const preferences = getPreferenceSummaries(sqlite, chatId);

// Build system prompt with preferences
const systemPrompt = buildSystemPrompt(preferences);

// Pass to Claude (requires claude-client.ts to accept systemPrompt param)
response = await claudeClient.sendMessageWithTools(
  fullMessages,
  KNOWLEDGE_TOOLS,
  toolHandler.handleToolCall,
  5,
  systemPrompt,
);
```

### Tool Description Updates
```typescript
// Existing save_knowledge description updated to mention preferences explicitly
{
  name: "save_knowledge",
  description:
    "Save a new item to the user's knowledge base (recipe, preference, cooking note). " +
    "Use this after the user confirms they want to save a recipe, or immediately when " +
    "a user states a preference. Include a descriptive title, a brief summary, full content, " +
    "and relevant tags. For preferences, always include the 'preference' tag plus domain " +
    "tags (pref:dietary, pref:schedule, etc.). For recipes, include 'recipe' plus the tag taxonomy.",
  // ... input_schema stays the same
}
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Explicit preference forms ("set your dietary restrictions") | Conversational preference capture | LLM-native interaction | Users state preferences naturally; no forms or menus |
| Hard/soft constraint flags in database | Claude interprets severity from natural language | Agent-first architecture | "allergy" vs "we prefer" carries meaning without explicit flags |
| Pre-defined preference categories | Open-ended knowledge items with loose tags | This phase | Any preference type can be stored without schema changes |
| All preferences loaded every turn | Tag-based proactive loading with token budget | This phase | Scales to many preferences while staying within context limits |

**Deprecated/outdated:**
- Preference-specific CRUD APIs: In agent-first architecture, knowledge CRUD handles all types
- Rigid preference taxonomies: Open-ended knowledge items with Claude interpretation beat rigid schemas
- Preference wizards/setup flows: Conversational capture is more natural and incremental

## Open Questions

1. **Token Budget for Preference Injection**
   - What we know: The existing knowledge soft limit is 4K tokens. Preferences injected into the system prompt consume system prompt tokens, not knowledge search budget tokens. System prompt is cached via `cache_control: ephemeral`.
   - What's unclear: Whether preference injection should have its own token budget cap, or just a hard limit on number of preferences (e.g., 30).
   - Recommendation: Cap at 30 preferences (~750 tokens). If a user somehow has more than 30 preferences, prioritize: allergy/restriction first, then by recency. This is unlikely in practice -- most users will have 5-15 preferences. Note that adding preferences to the system prompt will increase cache writes when preferences change but will be cache hits when they don't.

2. **Preference Caching Impact**
   - What we know: System prompt uses `cache_control: ephemeral` for prompt caching. Preferences are injected into the system prompt text, so the cached system prompt will differ between users and will invalidate when preferences change.
   - What's unclear: Whether per-user system prompts defeat prompt caching benefits.
   - Recommendation: Accept the caching impact. Preferences MUST be in the system prompt for PREF-02/PREF-04. For a single-user bot (typical for this project), caching still works well -- the same user's preferences change infrequently. The system prompt will be cached across turns within a session.

3. **Inferred Preference Threshold**
   - What we know: The user wants both explicit and inferred preference capture. Inferred preferences should be conservative.
   - What's unclear: What "conservative" means exactly -- 3 instances? 5? Within what time window?
   - Recommendation: System prompt guidance says "at least 3 instances of a pattern." This is a prompt engineering guideline, not a code constraint. Claude will use judgment. The `inferred` tag lets users identify and correct over-eager inferences.

4. **Preference-Preference Search Before Save**
   - What we know: To avoid duplicates, Claude should search before saving a new preference.
   - What's unclear: Whether the existing `search_knowledge` tool with a query like "shellfish allergy" will reliably find the existing preference to update.
   - Recommendation: FTS5 should work well for this since preference titles and summaries use descriptive keywords. The system prompt instruction to check for duplicates is sufficient. If FTS5 misses a match, the worst case is a duplicate that the user can notice via /preferences.

## Sources

### Primary (HIGH confidence)
- Existing codebase: `src/knowledge/repository.ts` -- CRUD operations used for both recipes and preferences
- Existing codebase: `src/knowledge/fts.ts` -- Raw SQLite query patterns for tag-based retrieval
- Existing codebase: `src/ai/system-prompt.ts` -- System prompt structure designed for extension (function, not constant)
- Existing codebase: `src/ai/tools.ts` -- Tool definitions that already mention "preferences" in save_knowledge description
- Existing codebase: `src/ai/claude-client.ts` -- buildSystemPrompt() call points that need modification
- Existing codebase: `src/pipeline/processor.ts` -- Processing flow where preference loading hooks in
- Existing codebase: `src/bot/handlers/costs.ts`, `debug.ts` -- Handler patterns for /preferences command
- Existing codebase: `src/bot/index.ts` -- Handler registration order (commands before message catch-all)
- Phase 4 Research (`04-RESEARCH.md`) -- Tag taxonomy, write tool patterns, system prompt extension patterns

### Secondary (MEDIUM confidence)
- [Design Patterns for Long-Term Memory in LLM-Powered Architectures](https://serokell.io/blog/design-patterns-for-long-term-memory-in-llm-powered-architectures) -- Confirmed proactive context injection as standard pattern
- [grammY Composer documentation](https://grammy.dev/ref/core/composer) -- Command handler registration pattern

### Tertiary (LOW confidence)
- WebSearch results on LLM preference memory systems -- Confirmed general patterns but no specific implementation guidance for this architecture

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH -- No new dependencies; extends existing infrastructure
- Architecture (preference tagging): HIGH -- Follows Phase 4 tag taxonomy pattern exactly
- Architecture (proactive loading): HIGH -- Essential for PREF-02/PREF-04; standard LLM context injection
- Architecture (system prompt): HIGH -- Follows Phase 4 prompt engineering pattern exactly
- Architecture (/preferences command): HIGH -- Follows existing handler patterns exactly
- Architecture (processor integration): HIGH -- Minimal change to existing flow, clear insertion point
- Pitfalls: HIGH -- Derived from analysis of existing code paths and known constraints
- Inferred preference detection: MEDIUM -- This is inherently fuzzy and depends on prompt engineering quality

**Research date:** 2026-02-06
**Valid until:** 2026-03-06 (stable domain; all patterns extend existing verified infrastructure)
