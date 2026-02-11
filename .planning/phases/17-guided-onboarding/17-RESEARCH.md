# Phase 17: Guided Onboarding - Research

**Researched:** 2026-02-11
**Domain:** Conversational onboarding flow, Claude-driven state management, system prompt augmentation
**Confidence:** HIGH

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

#### Conversation style
- Natural chat -- feels like texting a friend, not a wizard or form
- No visual distinction from normal bot messages (no step indicators, no emoji headers)
- Off-topic messages during onboarding: roll with it naturally, answer the request, then gently steer back
- "Skip" triggers a quick summary of capabilities before dropping into normal mode, not an instant exit

#### Preference gathering
- Ask about dietary restrictions AND taste preferences (allergies, likes/dislikes, cooking comfort)
- Also ask dinner time, preferred stores, and cooking comfort level -- all in one conversational flow
- Freeform text input -- user describes naturally, Claude extracts structured data
- All preferences stored at the household level (not per-user)

#### Capability tour
- Quick single message listing key capabilities
- Must mention both chat interaction with Sous and the mini-app for quick reference
- Tour happens BEFORE recipe seeding -- user understands context before teaching recipes

#### Recipe seeding
- Open-ended prompt: "Tell me about meals you make regularly" -- user describes freely, Claude extracts
- No minimum recipe count -- just encouragement, no gate
- User can teach 0 recipes and move on without friction

#### Household join experience
- Minimal welcome message only -- no stats, no household details
- No preference questions -- preferences are household-level and already set
- Capability tour only -- skip recipe seeding since household already has recipes
- No join notification sent (no household admin concept)

### Claude's Discretion
- Exact wording of onboarding messages
- How to extract structured preferences from freeform text
- How to handle edge cases (user teaches 0 recipes, gives contradictory preferences)
- Progressive learning strategy after initial setup

### Deferred Ideas (OUT OF SCOPE)
None -- discussion stayed within phase scope

</user_constraints>

## Summary

Phase 17 implements a conversational onboarding experience for new HeySous users. The core challenge is NOT building a rigid state machine but rather augmenting the existing Claude pipeline with onboarding-aware system prompt instructions that guide Claude to naturally lead a new user through preference gathering, a capability tour, and recipe seeding. The critical architectural insight is that this project already has all the tools Claude needs (save_knowledge for preferences/recipes, update_reminder_settings for dinner time) -- onboarding is primarily about *teaching Claude when and how to use them* for a first-run experience.

The existing codebase has an `onboardingState` field on the users table with values `"registered"` and `"complete"`. Currently, `start.ts` creates all new users with `onboardingState: "complete"`, bypassing any onboarding. The field infrastructure is already in place -- we need to expand its values to track onboarding progress, change the start handler to use the proper initial state, inject onboarding-specific system prompt sections when the user is in an onboarding state, and update the state as the user progresses.

Two distinct flows are required: (1) **New household creator** (via `independent` invite type or first member of a household) gets the full flow: warm welcome, preference Q&A, capability tour, recipe seeding. (2) **Household joiner** (via `household` invite type into a household that already has members) gets an abbreviated flow: minimal welcome, capability tour, done. The `inviteType` from the redeemed token (`"household"` vs `"independent"`) plus checking `getHouseholdMembers` count at registration time tells us which flow to enter.

**Primary recommendation:** Implement onboarding as a system prompt augmentation layer -- when `user.onboardingState !== "complete"`, inject an `<onboarding>` section into the system prompt that tells Claude what phase of onboarding the user is in and what to do next, letting Claude drive the conversation naturally while using the existing tool suite.

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| grammy | ^1.39.3 | Bot framework, message handling | Already in use |
| @anthropic-ai/sdk | ^0.73.0 | Claude API, tool use loop | Already in use |
| better-sqlite3 | ^12.6.2 | Direct DB for user state updates | Already in use |
| drizzle-orm | ^0.45.1 | Schema definitions, typed queries | Already in use |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| pino | ^10.3.0 | Logging onboarding events | Already in use |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| System prompt augmentation | Separate onboarding pipeline | Massive code duplication; existing pipeline already handles tools, retry, timeout |
| DB-stored onboarding phase | In-memory state | Would not survive restarts (requirement violation) |
| Rigid state machine (code-driven) | Claude-driven (prompt-driven) | State machine fights the "natural chat" requirement; Claude is already the conversation engine |

**Installation:**
No new packages needed. All functionality builds on existing stack.

## Architecture Patterns

### Recommended Project Structure
```
src/
  onboarding/
    schema.ts           # (not needed -- users.onboarding_state already exists)
    state.ts            # Onboarding state types, transitions, helpers
    prompt.ts           # Onboarding system prompt sections per state
    repository.ts       # updateOnboardingState, getOnboardingState helpers
  bot/handlers/
    start.ts            # Modified: different initial states per invite type
  pipeline/
    processor.ts        # Modified: inject onboarding prompt when state != complete
  ai/
    system-prompt.ts    # Modified: accept + inject onboarding context
```

### Pattern 1: System Prompt Augmentation for Onboarding
**What:** When the pipeline processes a message from a user with `onboardingState !== "complete"`, inject an `<onboarding>` section into the system prompt that instructs Claude on what to do. Claude uses the existing tools (save_knowledge, update_reminder_settings) to save preferences and recipes the user mentions.
**When to use:** Every message from a user in onboarding.
**Why this works:** The existing pipeline already has conversation history, tools, retry logic, and response delivery. Onboarding is a conversation, and Claude is already the conversation engine. By using prompt injection rather than a separate flow, we get all existing behaviors (off-topic handling, preference saving, recipe creation) for free.

**Example:**
```typescript
// In pipeline/processor.ts, before Claude call:
const onboardingPrompt = user.onboardingState !== "complete"
  ? buildOnboardingPrompt(user.onboardingState, householdId, sqlite)
  : "";

const systemPrompt = buildSystemPrompt(
  preferences, planContext, groceryContext,
  reminderContext, feedbackContext, userName,
  onboardingPrompt  // NEW parameter
);
```

```typescript
// In onboarding/prompt.ts:
export function buildOnboardingPrompt(
  state: OnboardingState,
  householdId: string,
  sqlite: BetterSqlite3.Database,
): string {
  switch (state) {
    case "preferences":
      return `<onboarding>
You are getting to know a new user. This is your first conversation with them.

YOUR GOAL: Learn about their household's food preferences through natural conversation.
Ask about:
- Dietary restrictions or allergies (SAVE as preferences with severity:allergy or severity:restriction tags)
- Taste preferences and likes/dislikes
- What time they usually have dinner (SAVE as preference AND call update_reminder_settings with dinner_time)
- Where they shop for groceries (SAVE as preference with pref:grocery tag)
- Cooking comfort level (beginner, comfortable, adventurous)

CONVERSATION STYLE:
- Chat like you're getting to know a friend, not filling out a form
- Ask 1-2 questions at a time, not a big list
- Save preferences as you learn them using save_knowledge (don't wait until the end)
- When you've covered the main topics above, naturally transition to showing them what you can do

WHEN DONE with preferences:
- Include the EXACT marker __ONBOARDING_PHASE_COMPLETE:preferences__ at the very end of your message (after your visible text, on its own line)
- The user will NOT see this marker -- it's stripped before delivery
</onboarding>`;

    case "tour":
      return `<onboarding>
...tour instructions...
</onboarding>`;

    case "recipes":
      return `<onboarding>
...recipe seeding instructions...
</onboarding>`;
  }
}
```

### Pattern 2: Hidden Marker-Based State Transitions
**What:** Claude includes a special marker string (e.g., `__ONBOARDING_PHASE_COMPLETE:preferences__`) in its response when it determines the onboarding phase is complete. The pipeline strips this marker before sending the message to the user and uses it to advance the `onboardingState` in the database.
**When to use:** At the end of each onboarding phase.
**Why this is better than alternatives:**
- Better than counting messages (fragile, doesn't account for off-topic tangents)
- Better than requiring specific user input (user might phrase "done" many ways)
- Better than a separate API endpoint (overengineered for this use case)
- Claude already understands conversational context and can judge when the user has provided enough info
- The marker is stripped before delivery so the user never sees it

**Example:**
```typescript
// In pipeline/processor.ts, after getting Claude response:
const { text: cleanedText, completedPhase } = extractOnboardingMarker(response.text);
if (completedPhase) {
  advanceOnboardingState(sqlite, userId, completedPhase);
  // Refresh user in cache
}
// Send cleanedText (not response.text) to user

function extractOnboardingMarker(text: string): { text: string; completedPhase: string | null } {
  const markerMatch = text.match(/__ONBOARDING_PHASE_COMPLETE:(\w+)__/);
  if (markerMatch) {
    return {
      text: text.replace(/__ONBOARDING_PHASE_COMPLETE:\w+__/, "").trim(),
      completedPhase: markerMatch[1],
    };
  }
  return { text, completedPhase: null };
}
```

### Pattern 3: Expanded Onboarding State Enum
**What:** Expand `onboarding_state` from `("registered", "complete")` to `("new_household", "joining_household", "preferences", "tour", "recipes", "complete")`. The start handler sets the initial state based on invite type and household membership. The pipeline advances through states as Claude signals phase completion.
**When to use:** User registration and throughout the onboarding flow.
**State machine:**
```
New user + independent invite (or first in household):
  "new_household" -> start handler sends warm welcome, sets state to "preferences"
  "preferences"   -> Claude gathers preferences, signals complete -> "tour"
  "tour"          -> Claude sends capability tour, signals complete -> "recipes"
  "recipes"       -> Claude prompts recipe seeding, user teaches or says done -> "complete"

New user + household invite (existing members):
  "joining_household" -> start handler sends minimal welcome, sets state to "tour_only"
  "tour_only"         -> Claude sends capability tour, signals complete -> "complete"
```

### Pattern 4: Skip Handling via System Prompt
**What:** The onboarding system prompt always includes skip detection instructions. If the user says "skip", Claude sends a brief capabilities summary and includes the marker to jump straight to "complete".
**When to use:** Any onboarding state.
**Example in prompt:**
```
SKIP HANDLING:
If the user says "skip", "skip this", "just let me use it", or similar:
- Send a brief summary of what you can do (meal planning, recipes, grocery lists, reminders, the mini-app)
- Include __ONBOARDING_PHASE_COMPLETE:skip__ to end onboarding immediately
- Do NOT make them feel bad about skipping
```

### Anti-Patterns to Avoid
- **Separate pipeline for onboarding messages:** Creates massive code duplication and means onboarding can't use tools. The whole pipeline (tool loop, retry, conversation history) must be available during onboarding.
- **Rigid code-driven state machine with exact message templates:** Fighting the "natural chat" requirement. Claude should generate messages, not repeat canned text.
- **Storing onboarding state in memory:** Violates the "survives bot restarts" requirement. Must be in SQLite.
- **Using separate DB tables for onboarding:** The existing `users.onboarding_state` column is the right place. Just expand the enum.
- **Blocking normal bot functionality during onboarding:** The user said off-topic messages should be handled naturally. The onboarding prompt should guide, not restrict.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Preference extraction from freeform text | Custom NLP parser | Claude via existing save_knowledge tool | Claude already extracts structured data; the preference management prompt already teaches it tagging |
| Recipe extraction from freeform descriptions | Separate recipe parser | Claude via existing save_knowledge tool | Same -- Claude already does this in normal operation |
| Dinner time parsing ("we eat at 7") | Time parser | Claude + update_reminder_settings tool | Preference management prompt already handles dinner time sync |
| Conversation state tracking | Custom session store | SQLite onboarding_state column | Simple enum in existing users table |
| Message formatting | Onboarding-specific formatter | Existing sendFormattedMessage | Already handles HTML, splitting, etc. |

**Key insight:** Onboarding is NOT a separate system. It is the existing conversation system with additional system prompt instructions. Every tool (save_knowledge, update_reminder_settings, search_knowledge) is already available and battle-tested. Onboarding just tells Claude when and how to use them for a first-run context.

## Common Pitfalls

### Pitfall 1: State Desync Between Cache and Database
**What goes wrong:** The access gate caches User objects. If onboarding state is updated in SQLite but the cached User still has the old state, the pipeline will inject the wrong onboarding prompt.
**Why it happens:** `addToCache` in the access gate stores a User snapshot at registration. The access gate never refreshes from DB.
**How to avoid:** After advancing onboarding state in the pipeline, update the cached user object. Either: (a) add a `refreshCache` function to the access gate alongside `addToCache`, or (b) have the pipeline read `user.onboardingState` fresh from DB each request (since the access gate check already passed, this is a lightweight additional read).
**Warning signs:** User gets the same onboarding prompt repeatedly despite advancing through phases.

### Pitfall 2: Claude Marker Leaking to User
**What goes wrong:** The `__ONBOARDING_PHASE_COMPLETE:...` marker appears in the Telegram message.
**Why it happens:** Marker stripping happens after the pipeline but the message goes through sendFormattedMessage which does splitting. If the marker is in a split chunk, the regex might not match.
**How to avoid:** Strip the marker BEFORE any other processing (splitting, formatting). Do it immediately after getting Claude's response text, before passing to sendFormattedMessage.
**Warning signs:** Users see `__ONBOARDING_PHASE_COMPLETE:preferences__` in messages.

### Pitfall 3: Onboarding State Stuck After Bot Restart
**What goes wrong:** Bot restarts mid-onboarding, and the user's next message doesn't trigger onboarding continuation.
**Why it happens:** If state is only tracked in memory and not persisted.
**How to avoid:** State is in SQLite (already solved by design). The access gate loads the user from DB on restart and injects it into context. The pipeline reads `user.onboardingState` and injects the appropriate onboarding prompt. As long as the access gate populates `ctx.user` with the full User record (which it does), restarts are transparent.
**Warning signs:** User completes onboarding, bot restarts, and the user is back in onboarding.

### Pitfall 4: New Household vs Joining Household Detection Wrong
**What goes wrong:** A user joining an existing household gets the full onboarding flow (with preference Q&A), or a new independent user gets the abbreviated flow.
**Why it happens:** The invite type alone isn't sufficient. A `"household"` type invite could go to a household with only the admin (who uses a different chatId). Need to check member count.
**How to avoid:** At registration time, check: (a) `redeemed.inviteType === "independent"` => new household flow. (b) `redeemed.inviteType === "household"` => check `getHouseholdMembers(sqlite, redeemed.householdId).length`. If this is > 1 after the new user is created, they're joining an existing household -> abbreviated flow. If exactly 1 member (the new user -- but wait, admin used a different mechanism), we need to be careful. Actually, for `household` type invites: the admin already exists in that household. So after creating the new user, `getHouseholdMembers` will return >= 2. The correct check is: at registration time, BEFORE creating the user, check if the household already has members. If yes -> joining. If no -> new household (independent).
**Warning signs:** Household joiners get asked about dietary restrictions that are already set.

### Pitfall 5: Skip Flow Incomplete
**What goes wrong:** User says "skip" but onboarding state isn't set to "complete", so next message re-enters onboarding.
**Why it happens:** Claude doesn't include the marker, or the marker parsing handles "skip" differently.
**How to avoid:** The skip marker (`__ONBOARDING_PHASE_COMPLETE:skip__`) should be mapped to set state directly to "complete" in the state transition logic, regardless of current state.
**Warning signs:** User says "skip", gets a capabilities summary, then next message still triggers onboarding.

### Pitfall 6: Onboarding Prompt Bloating System Prompt
**What goes wrong:** The onboarding instructions make the system prompt too large, eating into the context window and increasing costs.
**Why it happens:** Detailed onboarding instructions on top of an already large system prompt.
**How to avoid:** Keep onboarding prompt sections concise (100-200 words each). Only inject the current phase's instructions, not all phases. When state is "complete", inject nothing. Consider that the existing system prompt is already substantial (meal planning, grocery, reminders, feedback, recipe management, preference management sections).
**Warning signs:** Increased token costs during onboarding, or Claude struggling to follow both onboarding and normal instructions.

## Code Examples

Verified patterns from existing codebase:

### Expanding the Onboarding State Enum
```typescript
// Source: src/users/types.ts (existing pattern, needs expansion)
export interface User {
  // ... existing fields ...
  onboardingState: "new_household" | "joining_household" | "preferences" | "tour" | "recipes" | "tour_only" | "complete";
}

// Source: src/users/schema.ts (existing pattern, needs expansion)
export const users = sqliteTable("users", {
  // ... existing columns ...
  onboardingState: text("onboarding_state", {
    enum: ["new_household", "joining_household", "preferences", "tour", "recipes", "tour_only", "complete"],
  }).notNull().default("new_household"),
});
```

### Updating Onboarding State in SQLite (new function needed)
```typescript
// Source: follows existing repository.ts patterns
export function updateOnboardingState(
  sqlite: BetterSqlite3.Database,
  telegramId: string,
  newState: User["onboardingState"],
): void {
  sqlite
    .prepare(`UPDATE users SET onboarding_state = ?, updated_at = unixepoch() WHERE telegram_id = ?`)
    .run(newState, telegramId);
}
```

### Modifying Start Handler for Onboarding
```typescript
// Source: src/bot/handlers/start.ts (line 50-70, needs modification)
// After successful token redemption, determine onboarding flow:
const existingMembers = getHouseholdMembers(deps.sqlite, redeemed.householdId);
const isJoiningExisting = existingMembers.length > 0;

const newUser = createUser(deps.sqlite, {
  telegramId,
  displayName,
  username,
  householdId: redeemed.householdId,
  role: "member",
  onboardingState: isJoiningExisting ? "tour_only" : "preferences",
});
// Cache immediately
deps.addToCache(newUser);

if (isJoiningExisting) {
  // Abbreviated flow: minimal welcome
  await ctx.reply(`Hey ${displayName}! Welcome aboard!`);
} else {
  // Full flow: warm welcome, Claude will continue in preferences phase
  await ctx.reply(
    `Hey ${displayName}! I'm Sous, your new kitchen sidekick. I'd love to get to know your cooking style so I can be actually helpful. Mind if I ask a few questions?`
  );
}
```

### System Prompt Injection Point
```typescript
// Source: src/ai/system-prompt.ts (buildSystemPrompt signature needs new parameter)
export function buildSystemPrompt(
  preferences?: PreferenceSummary[],
  planContext?: string,
  groceryContext?: string,
  reminderContext?: string,
  feedbackContext?: string,
  userName?: string,
  onboardingContext?: string,  // NEW
): string {
  // ... existing prompt building ...
  // Inject onboarding context at the END so it has highest priority
  return `${existingPrompt}${onboardingContext ? "\n" + onboardingContext : ""}`;
}
```

### Pipeline Processor Integration
```typescript
// Source: src/pipeline/processor.ts (in processBatch, before Claude call)
// Build onboarding context if user is in onboarding
let onboardingContext = "";
if (ctx.user && ctx.user.onboardingState !== "complete") {
  onboardingContext = buildOnboardingPrompt(ctx.user.onboardingState);
}

// After Claude response, check for phase completion marker
const { text: cleanText, completedPhase } = extractOnboardingMarker(response.text);
if (completedPhase && ctx.user) {
  const nextState = getNextOnboardingState(ctx.user.onboardingState, completedPhase);
  updateOnboardingState(deps.sqlite, ctx.user.telegramId, nextState);
  // Update cached user
  ctx.user.onboardingState = nextState;
  if (deps.refreshUserCache) {
    deps.refreshUserCache(ctx.user);
  }
}

// Send cleaned text (marker stripped) instead of raw response
await sendFormattedMessage(ctx, cleanText);
```

### Onboarding State Transitions
```typescript
// Source: new file, src/onboarding/state.ts
export type OnboardingState = "new_household" | "joining_household" | "preferences" | "tour" | "recipes" | "tour_only" | "complete";

const TRANSITIONS: Record<string, OnboardingState> = {
  "preferences": "tour",       // After preferences gathered -> show tour
  "tour": "recipes",           // After tour shown -> prompt for recipes
  "recipes": "complete",       // After recipe seeding -> done
  "tour_only": "complete",     // Abbreviated flow: tour only -> done
  "skip": "complete",          // Skip at any point -> done
};

export function getNextOnboardingState(
  current: OnboardingState,
  completedPhase: string,
): OnboardingState {
  if (completedPhase === "skip") return "complete";
  return TRANSITIONS[completedPhase] ?? current;
}
```

### DB Migration for Expanded Enum
```typescript
// Source: src/db/migrate.ts (new migration function)
// SQLite CHECK constraint needs to be updated for expanded enum
export function migrateOnboardingStates(sqlite: BetterSqlite3.Database): void {
  // SQLite doesn't support ALTER CHECK constraints directly.
  // The CHECK constraint on onboarding_state only allows ('registered', 'complete').
  // We need to either:
  // 1. Drop and recreate the table (complex with data preservation)
  // 2. Remove the CHECK constraint via table rebuild
  // 3. Use a pragmatic approach: since SQLite CHECK constraints only validate
  //    on INSERT/UPDATE, and we control all writes, we can just proceed
  //    if the DB was created fresh with the new enum.
  //
  // For existing databases with data:
  // - Update existing 'registered' users to 'new_household' or 'complete'
  // - Rebuild table without old CHECK, add new CHECK
  //
  // Safest approach: Use CREATE TABLE ... AS SELECT pattern
  // to rebuild with new constraint.
}
```

**IMPORTANT NOTE on SQLite CHECK constraints:** The existing `users` table has `CHECK(onboarding_state IN ('registered', 'complete'))`. This will reject new enum values. The migration must handle this. The safest approach is to detect whether the constraint exists and rebuild the table if needed, or simply recreate the DDL in init.ts with the expanded enum and handle existing DB migration separately.

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Rigid wizard flows (step 1, step 2...) | Claude-driven conversational flows | With LLM-first architectures | Natural UX, handles edge cases gracefully |
| Separate onboarding pipeline | System prompt augmentation | Pattern from this codebase | Reuses existing tools, no code duplication |
| onboardingState: registered/complete | Expanded enum with phases | This phase | Enables restart-safe progress tracking |

**Not deprecated but avoided:**
- Inline keyboards for onboarding choices: User decided on natural chat, not buttons
- Step indicators / progress bars: User decided no visual distinction from normal messages

## Open Questions

1. **How to handle the admin user's onboarding**
   - What we know: The admin is seeded via `initializeUsers` with `onboardingState: "complete"`. The admin was the original user before the invite system existed.
   - What's unclear: Should the admin get retroactive onboarding if they never went through it? Probably not -- they've been using the bot.
   - Recommendation: Leave admin as "complete". Only new users via invites get onboarding.

2. **Conversation history during onboarding**
   - What we know: The start handler sends the welcome message directly via `ctx.reply()`, NOT through the pipeline. This means the welcome message is NOT saved to the `messages` table and NOT in conversation history for Claude.
   - What's unclear: Should the welcome be sent through the pipeline instead?
   - Recommendation: Keep the welcome in the start handler for immediate delivery (no debounce delay). Save the welcome message to the messages table manually after sending, so Claude has context on the next message from the user.

3. **Progressive learning after onboarding (ONBD-08)**
   - What we know: The existing preference management prompt already teaches Claude to detect and save preferences from conversation. The inferred preference system (3+ consistent instances) is already built.
   - What's unclear: Does this already satisfy ONBD-08, or does something extra need to happen?
   - Recommendation: This is already satisfied by the existing preference management system. No additional work needed beyond ensuring the system prompt's preference detection instructions remain active after onboarding completes (which they will -- they're always present).

4. **SQLite CHECK constraint migration**
   - What we know: The `users` table has `CHECK(onboarding_state IN ('registered', 'complete'))` which will reject new enum values.
   - What's unclear: Best migration strategy for existing databases.
   - Recommendation: In `initializeUsers`, update the CREATE TABLE IF NOT EXISTS to use the new enum. For existing databases, add a migration function that rebuilds the table with the new constraint. Since the bot is personal-scale (one admin, few users), a table rebuild is safe.

## Sources

### Primary (HIGH confidence)
- Codebase analysis: `src/users/schema.ts`, `src/users/types.ts`, `src/users/repository.ts` -- existing onboarding_state infrastructure
- Codebase analysis: `src/bot/handlers/start.ts` -- current registration flow
- Codebase analysis: `src/pipeline/processor.ts` -- message processing pipeline
- Codebase analysis: `src/ai/system-prompt.ts` -- system prompt construction
- Codebase analysis: `src/ai/tool-handler.ts` -- existing tool handlers (save_knowledge, update_reminder_settings)
- Codebase analysis: `src/bot/middlewares/access-gate.ts` -- user caching and identity injection
- Codebase analysis: `src/invites/types.ts` -- invite type enum (household vs independent)
- Codebase analysis: `src/users/init.ts` -- table DDL with CHECK constraint

### Secondary (MEDIUM confidence)
- Pattern inference: System prompt augmentation as the onboarding mechanism (derived from existing architecture patterns in the codebase)
- Pattern inference: Hidden marker approach for Claude-to-pipeline signaling (common pattern in LLM-driven workflows)

### Tertiary (LOW confidence)
- None -- all findings verified against codebase

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH -- all dependencies already in project, no new packages needed
- Architecture: HIGH -- pattern directly follows existing codebase conventions (system prompt injection, tool-based actions, factory patterns)
- Pitfalls: HIGH -- identified from direct code analysis of caching, state management, and pipeline flow
- Migration: MEDIUM -- SQLite CHECK constraint rebuild is straightforward but needs careful implementation

**Research date:** 2026-02-11
**Valid until:** 2026-03-11 (stable -- internal architecture, no external dependencies changing)
