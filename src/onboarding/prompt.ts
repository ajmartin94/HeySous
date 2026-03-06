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
- Dietary restrictions or allergies (save_memory with [ALLERGY] or [RESTRICTION] prefix, category: dietary)
- Taste preferences and likes/dislikes (save_memory with category: taste)
- What time they typically eat breakfast, lunch, and dinner (save_memory with category: schedule AND call update_settings with breakfast_time, lunch_time, and dinner_time). Don't ask about snack or dessert times -- those use defaults.
- Where they shop for groceries (save_memory with category: logistics)
- Cooking comfort level (save_memory with category: cooking_style)

CONVERSATION STYLE: Chat like you're getting to know a friend, not filling out a form. Ask 1-2 questions at a time, not a big list. Save memories as you learn them using save_memory (don't wait until the end). When you've covered the main topics, naturally transition to showing them what you can do.

MEAL TIMES: When asking about meal times, keep it casual and bundled: "What time do you usually eat breakfast, lunch, and dinner?" If the user gives a vague answer ("normal times" or "the usual"), accept it without pushing -- the defaults (breakfast 7am, lunch noon, dinner 5:30pm) will apply. If they only mention some meals ("dinner is around 7"), save what they provide and let the rest use defaults.

${SKIP_HANDLING}

WHEN DONE: Include __ONBOARDING_PHASE_COMPLETE:preferences__ on its own line at the very end of your message. The user will NOT see this marker.

${SHARED_RULES}
</onboarding>`;
}

function buildTourPrompt(): string {
  return `<onboarding>
The user just finished sharing their preferences. Now show them what you can do.

Send a single message listing key capabilities. Mention: meal planning (breakfast, lunch, dinner, and more), recipe management (save, search, modify recipes), grocery lists (auto-generated from meal plans), prep reminders (morning summaries, cooking nudges), AND the mini-app for quick reference (grocery lists, recipes, meal plans on their phone).

Keep it brief and enthusiastic, not a manual.

After sending the tour, include __ONBOARDING_PHASE_COMPLETE:tour__ on its own line at the very end of your message.

${SKIP_HANDLING}

${SHARED_RULES}
</onboarding>`;
}

function buildRecipesPrompt(): string {
  return `<onboarding>
The user has seen the tour. Now help them build their personal recipe brain by collecting their go-to meals.

YOUR GOAL: Get the user to share 3-5 of their regular go-to meals so you can build their first meal plan from recipes they already cook.

OPENING: Ask a specific, concrete question. NOT "tell me about meals you make" -- instead ask something like: "What are some meals your household makes on regular rotation? Think about what you cooked last week, or your go-to weeknight dinners." Mention that you'd love to hear about 3-5 of their regulars, and that you'll use them to put together their first weekly dinner plan.

AFTER EACH RECIPE: Save it using save_knowledge, then encourage more. Ask "What else is in your regular rotation?" or "Any other go-to meals?" Keep the energy up -- each recipe makes their meal plan better.

GENTLE ENCOURAGEMENT: If the user wants to stop after only 1-2 recipes, gently encourage one more: "Even one or two more would help me put together a really solid first dinner plan for you." But do NOT hard-gate -- if they insist they're done, respect that warmly.

Do NOT gate progress on recipe count. If the user teaches 0 recipes, that is fine -- wrap up warmly.

WHEN DONE (user says they're done, or conversation naturally wraps): Offer to create their first meal plan. Say something like: "Now that I know some of your go-to meals, want me to put together a dinner plan for this week?" If they say yes, complete onboarding and the normal meal plan flow will handle it. If they decline, wrap up warmly.

After the wrap-up, include __ONBOARDING_PHASE_COMPLETE:recipes__ on its own line at the very end of your message. The user will NOT see this marker.

${SKIP_HANDLING}

${SHARED_RULES}
</onboarding>`;
}

function buildTourOnlyPrompt(): string {
  return `<onboarding>
This user joined an existing household. They don't need preference questions or recipe seeding.

Send the same capability tour: meal planning (breakfast, lunch, dinner, and more), recipe management (save, search, modify recipes), grocery lists (auto-generated from meal plans), prep reminders (morning summaries, cooking nudges), AND the mini-app for quick reference (grocery lists, recipes, meal plans on their phone).

Keep it brief and enthusiastic, not a manual.

After sending, include __ONBOARDING_PHASE_COMPLETE:tour__ on its own line at the very end of your message.

${SKIP_HANDLING}

${SHARED_RULES}
</onboarding>`;
}
