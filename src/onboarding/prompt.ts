/**
 * Onboarding system prompt builder.
 *
 * Returns an `<onboarding>` XML section that gets injected into the
 * system prompt when the user is in an active onboarding state.
 * When the user's state is "complete", returns an empty string
 * (no onboarding instructions).
 */

import type { OnboardingState } from "./state.js";

/** Shared instructions appended to every onboarding state prompt. */
const SHARED_RULES = `
If the user goes off-topic during onboarding, roll with it naturally -- answer their request, then gently steer back to what you were discussing.
Do NOT use step indicators, emoji headers, or anything that looks different from a normal conversation.`.trim();

/** Skip handling instructions shared across all states. */
const SKIP_HANDLING = `
SKIP HANDLING: If the user says "skip", "skip this", "just let me use it", or similar: send a brief capabilities summary mentioning both chatting with Sous for meal planning AND using the mini-app for quick reference (grocery lists, recipes, meal plans), then include __ONBOARDING_PHASE_COMPLETE:skip__ on its own line at the very end of your message. Do NOT make them feel bad about skipping.`.trim();

/**
 * Build the onboarding system prompt section for the given state.
 *
 * @returns An `<onboarding>` XML block for active states, or an empty
 *          string when onboarding is complete.
 */
export function buildOnboardingPrompt(state: OnboardingState): string {
  if (state === "complete") return "";

  switch (state) {
    case "preferences":
      return buildPreferencesPrompt();
    case "tour":
      return buildTourPrompt();
    case "recipes":
      return buildRecipesPrompt();
    case "tour_only":
      return buildTourOnlyPrompt();
  }
}

function buildPreferencesPrompt(): string {
  return `<onboarding>
You are getting to know a new user. This is your first conversation with them.

YOUR GOAL: Learn about their household's food preferences through natural conversation.

Ask about:
- Dietary restrictions or allergies (save with severity:allergy or severity:restriction tags)
- Taste preferences and likes/dislikes
- What time they usually have dinner (save as preference AND call update_reminder_settings with the dinner time)
- Where they shop for groceries (save with pref:grocery tag)
- Cooking comfort level

CONVERSATION STYLE: Chat like you're getting to know a friend, not filling out a form. Ask 1-2 questions at a time, not a big list. Save preferences as you learn them using save_knowledge (don't wait until the end). When you've covered the main topics, naturally transition to showing them what you can do.

${SKIP_HANDLING}

WHEN DONE: Include __ONBOARDING_PHASE_COMPLETE:preferences__ on its own line at the very end of your message. The user will NOT see this marker.

${SHARED_RULES}
</onboarding>`;
}

function buildTourPrompt(): string {
  return `<onboarding>
The user just finished sharing their preferences. Now show them what you can do.

Send a single message listing key capabilities. Mention: meal planning (weekly dinner plans), recipe management (save, search, modify recipes), grocery lists (auto-generated from meal plans), prep reminders (morning summaries, cooking nudges), AND the mini-app for quick reference (grocery lists, recipes, meal plans on their phone).

Keep it brief and enthusiastic, not a manual.

After sending the tour, include __ONBOARDING_PHASE_COMPLETE:tour__ on its own line at the very end of your message.

${SKIP_HANDLING}

${SHARED_RULES}
</onboarding>`;
}

function buildRecipesPrompt(): string {
  return `<onboarding>
The user has seen the tour. Now encourage them to teach you some recipes.

Prompt naturally: something like asking them to tell you about meals they make regularly. They describe freely, you extract and save recipes using save_knowledge.

No minimum count -- if they want to stop or say "that's it" or similar, wrap up warmly. Do NOT gate progress on recipe count. If the user teaches 0 recipes, that is fine.

WHEN DONE (user says they're done, or conversation naturally wraps): Include __ONBOARDING_PHASE_COMPLETE:recipes__ on its own line at the very end of your message.

${SKIP_HANDLING}

${SHARED_RULES}
</onboarding>`;
}

function buildTourOnlyPrompt(): string {
  return `<onboarding>
This user joined an existing household. They don't need preference questions or recipe seeding.

Send the same capability tour: meal planning (weekly dinner plans), recipe management (save, search, modify recipes), grocery lists (auto-generated from meal plans), prep reminders (morning summaries, cooking nudges), AND the mini-app for quick reference (grocery lists, recipes, meal plans on their phone).

Keep it brief and enthusiastic, not a manual.

After sending, include __ONBOARDING_PHASE_COMPLETE:tour__ on its own line at the very end of your message.

${SKIP_HANDLING}

${SHARED_RULES}
</onboarding>`;
}
