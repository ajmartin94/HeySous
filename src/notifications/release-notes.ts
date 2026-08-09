/**
 * Release notes content for update notifications.
 * Each entry is hand-written in Sous's conversational voice.
 * Only versions with entries here trigger notifications.
 *
 * Format: HTML for Telegram (uses <b>, <i>, plain dashes for lists).
 */
export const RELEASE_NOTES: Record<string, string> = {
  "1.7.1": [
    "Turns out I'd been quietly dropping the ball in a few places. Here's what's fixed:",
    "",
    "- <b>No more silent treatment</b> -- Sometimes I'd think so hard about a tricky ask that I ran out of room before answering, and you'd just get nothing back. Worst on the big ones, like building a whole grocery list. That's fixed.",
    "- <b>I do what I say now</b> -- If I tell you a meal's on the plan or a recipe is saved, it's genuinely saved. No more cheerfully confirming something I never actually did.",
    "- <b>\"Next week\" means next week</b> -- Ask for something next Tuesday and it lands on next Tuesday, not the one after.",
    "- <b>Recipes link up properly</b> -- When a meal on your plan matches something in your recipe book, I'll connect the right one -- and stop attaching a random recipe that just happens to share a word.",
    "- <b>Quicker on my feet</b> -- I re-read a lot less of our conversation every time you message, so replies come back faster.",
    "",
    "Keep the feedback coming -- this whole release came from it. Just type /feedback anytime.",
  ].join("\n"),
  "1.7.0": [
    "This one's all about fixing the things you told me about. Here's what's better:",
    "",
    "- <b>Sharper recipe search</b> -- A few keywords is enough now. Ask for \"miso glazed fish\" and I'll find your salmon and tilapia recipes instead of coming up empty",
    "- <b>Dates I can trust</b> -- Moving meals between days and picking the right week works reliably now. Say \"Tuesday\" and I'll always mean the upcoming one",
    "- <b>Plan changes that stick</b> -- When you tell me you swapped a meal, I actually update the plan instead of just nodding along",
    "- <b>Back button fixed</b> -- Opening a recipe from chat no longer strands you in the app; back always takes you somewhere sensible",
    "- <b>Meal check-ins that arrive</b> -- My after-meal check-ins were getting lost behind the scenes; they'll show up properly now",
    "- <b>No more repeating myself</b> -- Fixed the bug where I'd save the same memory two or three times",
    "",
    "Keep the feedback coming -- it's how this update happened! Just type /feedback anytime.",
  ].join("\n"),
  "1.6.2": [
    "Small update, big brain. Here's what changed:",
    "",
    "- <b>Smarter Sous</b> -- I've been upgraded to Anthropic's newest model, so expect sharper meal plans, better recipe understanding, and fewer moments where I miss what you meant",
    "- <b>Faster fixes</b> -- New plumbing behind the scenes means improvements and bug fixes reach you quicker from now on",
    "",
    "Nothing to do on your end -- just keep cooking!",
  ].join("\n"),
  "1.6.0": [
    "I can do a lot more with your day now -- not just dinner anymore. Here's what's new:",
    "",
    "- <b>All-day meal planning</b> -- Breakfast, lunch, snacks, dessert -- tell me about any meal and I'll plan, track, and remind you for all of them",
    "- <b>Sous memory</b> -- I remember all sorts of things about you now to make our conversations smoother. Check out the new Settings page to see what I've picked up",
    "- <b>Tap to open</b> -- When I mention a recipe or update your plan, you'll see buttons that jump straight to it",
    "- <b>Reorganized settings</b> -- Meal times, reminder toggles, and your stored memories are all in one place with a cleaner layout",
    "- <b>Better onboarding</b> -- New users get a friendlier welcome that explains what I can do and how to get started",
    "- <b>Smoother replies</b> -- My responses flow more cleanly now, no more lost text mid-conversation",
    "",
    "Open the Mini App and check out your new Settings page!",
  ].join("\n"),
  "1.5.0": [
    "A bunch of under-the-hood upgrades just landed. Things should feel noticeably snappier:",
    "",
    "- <b>Streaming replies</b> -- My responses now appear word-by-word instead of making you wait for the whole thing",
    "- <b>Dark mode</b> -- Open the Mini App settings to switch between light and dark themes, plus adjust font size",
    "- <b>Smarter reminders</b> -- Start-cooking alerts now factor in actual recipe prep and cook times",
    "- <b>Tougher behind the scenes</b> -- Better handling of busy periods, safer data handling, and cost guardrails so things stay reliable",
    "",
    "Open the Mini App and check out Settings to try the new theme options!",
  ].join("\n"),
  "1.4.0": [
    "Hey! I've been busy learning new tricks since we last caught up. Here's the highlight reel:",
    "",
    "- <b>Recipe links</b> -- Drop a recipe URL into our chat and I'll pull out the recipe for you",
    "- <b>Recipe photos</b> -- Snap a pic of a cookbook page or handwritten recipe and I'll read it",
    "- <b>Smarter saving</b> -- I check for duplicates now, and I'll notice recipes in conversation and offer to save them",
    "- <b>Store-aware groceries</b> -- Your grocery lists now split items by your store preferences",
    "- <b>Recipe tweaks</b> -- Ask me to modify a recipe and I'll update it in place instead of creating a new one",
    "",
    "Try sending me a recipe link or photo!",
    "",
    "P.S. Your feedback helps me get better -- just type /feedback anytime to share what's working and what's not.",
  ].join("\n"),
};
