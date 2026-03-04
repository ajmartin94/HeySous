# Phase 47: Mini App Polish & Prompt Cleanup - Context

**Gathered:** 2026-03-04
**Status:** Ready for planning

<domain>
## Phase Boundary

Make the Mini App more readable with a proper font stack and responsive layout, and ban all emoji from Sous responses and hardcoded bot messages. No new features — visual polish and prompt hygiene only.

</domain>

<decisions>
## Implementation Decisions

### Font family
- Use `system-ui, sans-serif` as the global font family
- Apply once at the root level (html or body in variables.css)
- Keep the existing font size scale (small/medium/large) as-is — it already works via CSS custom properties

### Large screen layout
- No fixed max-width — content fills available space naturally
- Add responsive padding that scales up on larger screens so content doesn't hit edges
- Content should respond to the viewport size, not be capped at a fixed width
- Layout.tsx is the root wrapper — natural place for this

### Emoji ban
- Hard ban on all emoji in all bot output, no exceptions
- Add a clear rule to the system prompt: Sous must never use emoji characters
- Audit hardcoded bot messages (reminders, notifications, onboarding) for emoji — grep found none currently, but the rule should be codified
- This is a blanket rule — even if a user asks for emoji, Sous does not use them

### Claude's Discretion
- Exact responsive padding breakpoints and values
- Whether to use CSS media queries or container queries for responsive padding
- How to structure the font-family declaration (variables.css root vs separate rule)

</decisions>

<specifics>
## Specific Ideas

- "It's an annoying AI trait" — the emoji ban is a strong preference, not just cosmetic. The bot should feel clean and text-forward.
- Simple solutions preferred — `system-ui, sans-serif` over a longer stack, responsive padding over fixed max-width

</specifics>

<code_context>
## Existing Code Insights

### Reusable Assets
- `variables.css`: CSS custom properties for colors, spacing, font sizes — font-family declaration fits here naturally
- `Layout.tsx`: Root layout wrapper with safe-area padding — responsive padding fits here
- `ThemeContext.tsx` + `tokens.ts`: Theme system with font size presets — no changes needed, already works

### Established Patterns
- CSS custom properties for all design tokens (`--hs-*` prefix)
- Font sizes use `var(--hs-font-size-*)` throughout all CSS files and inline styles
- Dark/light theme via `[data-theme]` attribute selectors on root

### Integration Points
- `variables.css` `:root` — add `font-family` declaration
- `Layout.tsx` — add responsive padding wrapper
- `src/ai/system-prompt.ts` — add emoji ban instruction
- Hardcoded messages in `src/reminders/`, `src/notifications/`, `src/onboarding/` — audit for emoji (none found currently)

</code_context>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope

</deferred>

---

*Phase: 47-mini-app-polish-prompt-cleanup*
*Context gathered: 2026-03-04*
