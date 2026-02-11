# Phase 19: User Help Functionality - Context

**Gathered:** 2026-02-11
**Status:** Ready for planning

<domain>
## Phase Boundary

Users can discover what the bot does and how to use it through three access points: a `/help` command (lightweight pointer), a Mini App help page (full reference), and a Hub card. Claude also gently suggests help when it detects confusion. Static help content covers all features, commands, and tips.

</domain>

<decisions>
## Implementation Decisions

### Help access points
- Three access points: `/help` command, Mini App help page, Hub "Help" card
- `/help` sends a friendly message with a deep link to the Mini App help page — no inline help content in chat
- Hub card links directly to the Mini App help page
- Claude proactively mentions help when it detects user confusion or misuse — no hard frequency limits, natural tone ("if you need help, just ask!")
- When user explicitly asks for help, Claude sends the Mini App deep link

### Content and scope
- Help covers: feature overview + all commands + usage tips (comprehensive)
- Mini App features (grocery list, recipe browser, meal plan viewer) integrated alongside chat features — unified view
- Admin users see admin-only commands (/invite) in addition to regular content
- Regular users do not see admin commands
- No "what's new" or changelog section — static reference only

### Presentation style
- `/help` is a lightweight pointer: friendly message + Mini App deep link (no full content in chat)
- Mini App help page: sections with headers, grouped by category (Recipes, Meal Planning, Grocery, Reminders, etc.)
- Tips and examples inline with each feature section (not a separate section)
- Help content hardcoded in the Mini App React component (not served from API)
- Warm and friendly tone matching bot personality

### Context awareness
- Static content — same page for all users regardless of onboarding state
- System prompt includes a HELP block so Claude knows /help exists and can reference the Mini App help page
- On confusion detection: Claude mentions help availability naturally ("if you need help, just ask!")
- On explicit help request: Claude sends the Mini App deep link directly

### Claude's Discretion
- Exact wording of the /help response message
- How to group features into sections on the help page
- When confusion warrants a help mention vs when to stay quiet
- System prompt HELP block wording

</decisions>

<specifics>
## Specific Ideas

- /help should feel like a quick signpost, not a wall of text — "Here's everything I can do" + link to the help page
- Help page sections should each have their own tips inline: "Try: paste a recipe URL and I'll save it!"
- Admin extras shown conditionally — not labeled "(admin only)" to regular users, just absent

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope

</deferred>

---

*Phase: 19-user-help-functionality*
*Context gathered: 2026-02-11*
