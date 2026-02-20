/**
 * Release notes content for update notifications.
 * Each entry is hand-written in Sous's conversational voice.
 * Only versions with entries here trigger notifications.
 *
 * Format: HTML for Telegram (uses <b>, <i>, plain dashes for lists).
 */
export const RELEASE_NOTES: Record<string, string> = {
  "1.4.0": [
    "Hey, I picked up some new tricks! Here's what's new:",
    "",
    "- <b>Recipe links</b> -- Send me a recipe URL and I'll extract and save it for you",
    "- <b>Recipe photos</b> -- Snap a pic of a cookbook page or recipe card and I'll read it",
    "- <b>Smarter saving</b> -- I'll catch duplicate recipes now and ask before saving",
    "",
    "Try it out! Just paste a recipe link or send me a photo.",
  ].join("\n"),
};
