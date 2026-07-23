/**
 * Centralized message module for all bot-initiated messages.
 *
 * Every user-facing message Sous sends outside of Claude-generated responses
 * lives here. Each message type has multiple variants for natural variation.
 * All messages use HTML formatting (Telegram parse mode).
 */

import { escapeHtml } from "../telegram/formatter.js";

/**
 * Pick a random element from an array.
 * Exported for testing (allows mocking Math.random).
 */
export function pickRandom<T>(items: T[]): T {
  return items[Math.floor(Math.random() * items.length)];
}

// ---------------------------------------------------------------------------
// Pipeline error messages
// ---------------------------------------------------------------------------

export function getErrorMessage(): string {
  return pickRandom([
    "Sorry, I'm having trouble thinking right now. Try again in a moment!",
    "My brain just hiccupped -- give me another shot?",
    "I tripped over my own thoughts there. Mind trying again?",
    "Something got tangled up on my end. One more try?",
    "I got a little lost there -- try sending that again!",
  ]);
}

export function getTimeoutMessage(): string {
  return pickRandom([
    "This is taking longer than usual, hang tight...",
    "Still thinking -- give me just a sec...",
    "Working on it! Taking a little longer than expected...",
    "Bear with me, I'm chewing on this one...",
    "Almost there -- this one's taking me a moment...",
  ]);
}

export function getMessageTooLongResponse(): string {
  return pickRandom([
    "Whoa, that's a novel! I can handle messages up to about 4,000 characters -- mind breaking it up a bit?",
    "That's a lot to take in! I work best with messages under 4,000 characters. Could you split it up?",
    "I appreciate the detail, but that's more than I can chew at once! Try keeping messages under about 4,000 characters.",
    "That message is a bit too long for me to digest -- I'm best with under 4,000 characters. Mind breaking it into smaller bites?",
  ]);
}

// ---------------------------------------------------------------------------
// Access gate messages
// ---------------------------------------------------------------------------

export function getAccessGateMessage(): string {
  return pickRandom([
    "Hey! I'm an invite-only bot. Ask the person who told you about me for an invite link!",
    "Hi there! I work by invite only -- ask whoever told you about me for a link!",
    "Hey! I'd love to help, but I'm invite-only. The person who mentioned me can send you a link!",
  ]);
}

// ---------------------------------------------------------------------------
// /start command messages
// ---------------------------------------------------------------------------

export function getWelcomeBackMessage(): string {
  return pickRandom([
    "Welcome back! What can I help you with?",
    "Hey, welcome back! What's cooking?",
    "Good to see you again! What can I do for you?",
  ]);
}

export function getInvalidTokenMessage(): string {
  return pickRandom([
    "This invite link is no longer valid. Ask for a new one!",
    "Hmm, that invite link has expired or already been used. Ask for a fresh one!",
    "That link isn't working anymore -- ask for a new invite!",
  ]);
}

export function getNoTokenMessage(): string {
  return pickRandom([
    "Hey! I'm an invite-only bot. Ask the person who told you about me for an invite link!",
    "Hi there! I'm invite-only -- the person who told you about me can send you a link!",
    "Hey! I'd love to chat, but I need an invite link first. Ask whoever mentioned me!",
  ]);
}

// ---------------------------------------------------------------------------
// Admin notifications
// ---------------------------------------------------------------------------

export function getAdminJoinNotification(displayName: string): string {
  return pickRandom([
    `${displayName} just joined your household!`,
    `${displayName} just hopped on board!`,
    `New kitchen helper alert -- ${displayName} joined!`,
  ]);
}

// ---------------------------------------------------------------------------
// /grocery command messages
// ---------------------------------------------------------------------------

export function getNoGroceryListMessage(): string {
  return pickRandom([
    "No grocery list yet! Just say something like \"make my grocery list\" and I'll generate one from your meal plan.",
    "No list going right now! Ask me to make a grocery list and I'll put one together from your meal plan.",
    "Nothing on the list yet! Tell me to build a grocery list and I'll pull it from your plan.",
  ]);
}

// ---------------------------------------------------------------------------
// /invite command messages
// ---------------------------------------------------------------------------

export function getInviteUsageMessage(): string {
  return "Usage: /invite, /invite independent, or /invite household:ID";
}

export function getHouseholdNotFoundMessage(): string {
  return "Household not found.";
}

export function getInviteLinkMessage(url: string): string {
  return pickRandom([
    `Invite link (expires in 7 days, single use):\n\n${url}\n\nShare this with the person you want to invite.`,
    `Here's your invite link (good for 7 days, one-time use):\n\n${url}\n\nSend it to whoever you'd like to invite!`,
    `Fresh invite link:\n\n${url}\n\nValid for 7 days, one use only. Share away!`,
  ]);
}

// ---------------------------------------------------------------------------
// /feedback command messages
// ---------------------------------------------------------------------------

export function getFeedbackEmptyMessage(): string {
  return pickRandom([
    "Just type /feedback followed by your thoughts!",
    "Add your thoughts after /feedback -- like: /feedback I love the grocery lists!",
    "Tell me what's on your mind! Use /feedback followed by your message.",
  ]);
}

export function getFeedbackThanksMessage(): string {
  return pickRandom([
    "Thanks for the feedback!",
    "Got it -- thanks for sharing!",
    "Noted, thanks for letting me know!",
    "Appreciate the feedback!",
  ]);
}

// ---------------------------------------------------------------------------
// Feedback check-in messages
// ---------------------------------------------------------------------------

export function getCheckinMessageSingle(recipeName: string): string {
  return pickRandom([
    `How was the <b>${recipeName}</b> tonight?`,
    `How'd the <b>${recipeName}</b> turn out?`,
    `So... <b>${recipeName}</b> night! How was it?`,
    `<b>${recipeName}</b> tonight -- how'd it go?`,
  ]);
}

export function getCheckinMessageMultiple(recipeNames: string[]): string {
  const names = recipeNames.map((n) => `<b>${n}</b>`);
  let nameList: string;
  if (names.length === 2) {
    nameList = `${names[0]} and ${names[1]}`;
  } else {
    nameList = names.slice(0, -1).join(", ") + ", and " + names[names.length - 1];
  }

  return pickRandom([
    `How was dinner tonight? You had ${nameList}.`,
    `Big dinner tonight -- ${nameList}! How'd it all turn out?`,
    `${nameList} on the menu tonight. How was everything?`,
  ]);
}

export function getCheckinMessageGeneric(): string {
  return pickRandom([
    "How was dinner tonight?",
    "How'd dinner go tonight?",
    "So, how was dinner?",
  ]);
}

// ---------------------------------------------------------------------------
// Reminder fallback messages (used when Claude API fails)
// ---------------------------------------------------------------------------

export function getReminderFallbackMorning(
  meals?: Array<{ mealType: string; recipeName: string }>,
  noPlanNudge?: boolean,
): string {
  if (noPlanNudge) {
    return pickRandom([
      "Good morning! No meal plan for today yet -- want to plan something delicious?",
      "Morning! Looks like today's wide open -- want me to help plan some meals?",
      "Hey, good morning! No plan on the books yet. Want to figure out dinner?",
    ]);
  }
  if (meals && meals.length > 0) {
    const mealList = meals
      .map((m) => `  ${escapeHtml(m.mealType)}: ${escapeHtml(m.recipeName)}`)
      .join("\n");
    return pickRandom([
      `Good morning! Here's today's plan:\n${mealList}`,
      `Morning! Here's what's on the menu today:\n${mealList}`,
      `Rise and shine! Today's lineup:\n${mealList}`,
    ]);
  }
  return pickRandom([
    "Good morning! You have meals planned for today.",
    "Morning! You've got a plan in place for today.",
    "Good morning! Today's meals are all set.",
  ]);
}

export function getReminderFallbackPrep(recipeName: string): string {
  const safeName = escapeHtml(recipeName);
  return pickRandom([
    `Heads up! Time to start prepping ${safeName}.`,
    `Just a nudge -- ${safeName} needs some prep work!`,
    `Prep reminder: time to get started on ${safeName}!`,
  ]);
}

export function getReminderFallbackCooking(recipeName: string): string {
  const safeName = escapeHtml(recipeName);
  return pickRandom([
    `Time to start cooking ${safeName}!`,
    `Let's get cooking -- ${safeName} time!`,
    `Stove's calling! Time to start on ${safeName}.`,
  ]);
}

export function getReminderFallbackCheckin(): string {
  return pickRandom([
    "How was dinner tonight?",
    "How'd dinner go tonight?",
    "So, how was dinner?",
  ]);
}

export function getReminderFallbackGeneric(): string {
  return pickRandom([
    "Reminder from Sous!",
    "Hey, just a quick reminder!",
    "Friendly reminder from your kitchen pal!",
  ]);
}

// ---------------------------------------------------------------------------
// Daily token budget messages
// ---------------------------------------------------------------------------

export function getDailyLimitMessage(): string {
  return pickRandom([
    "You've reached your daily message limit. Your limit resets at midnight -- feel free to keep using commands, the Mini App, and your grocery list in the meantime!",
    "You've hit your daily message cap! It'll reset at midnight. Commands, the Mini App, and your grocery list still work in the meantime.",
    "Daily message limit reached! Everything resets at midnight. You can still use commands, the Mini App, and your grocery list until then.",
  ]);
}

// ---------------------------------------------------------------------------
// Resilience messages (retry / rate-limit)
// ---------------------------------------------------------------------------

export function getThinkingLongerMessage(): string {
  return pickRandom([
    "I'm thinking a little longer on this one -- hang tight!",
    "Taking an extra moment to get this right for you...",
    "Still on it! Just need a bit more time...",
    "Bear with me -- putting a little extra thought into this one...",
    "Working through this one carefully, just a moment more...",
  ]);
}

export function getStreamInterruptedMessage(): string {
  return "(response interrupted -- try again)";
}

export function getResilienceFailureMessage(): string {
  return pickRandom([
    "I got a bit overwhelmed there -- mind sending that again when you're ready?",
    "Sorry, I couldn't quite pull that together. Try again in a moment?",
    "My brain's a little overloaded right now. Send it again when you're ready!",
    "Hit a snag on that one -- give me another shot when you have a sec?",
    "I tripped up on that request. Mind trying once more in a minute?",
  ]);
}
