# Phase 38: Mini App Theme & Accessibility - Context

**Gathered:** 2026-02-23
**Status:** Ready for planning

<domain>
## Phase Boundary

Customize the Mini App's visual appearance (theme, font size), improve tag readability with sufficient contrast, and update the help page to document all current features including v1.3 and v1.4 additions. No new functional capabilities — this is visual polish and documentation.

</domain>

<decisions>
## Implementation Decisions

### Theme selection
- Two options only: Light and Dark (no system/auto-follow)
- Default theme for new users: Dark
- Instant switch on toggle — no transition animation
- Per-user setting (each household member picks their own)

### Font size control
- Three presets: Small / Medium / Large
- Default for new users: Small
- Per-user setting (independent of household)

### Tag contrast
- Claude's discretion on color approach — must pass readability/contrast checks
- Must work in both light and dark themes

### Help page content
- Written in Sous's personality voice — warm, casual, like the bot itself
- Organized by workflow (what users do: planning meals, saving recipes, grocery lists, etc.)
- Includes example messages users can send to Sous in each section
- Covers both chat features AND Mini App features

### Settings UX
- Dedicated settings page (new page, not embedded in profile)
- Accessed via gear icon in the header navigation bar
- Changes apply immediately (live preview) — no save button
- Persisted client-side in localStorage (device-specific, no API calls)

### Claude's Discretion
- Tag color palette and contrast approach (must pass WCAG checks in both themes)
- Exact font size values for Small/Medium/Large presets
- Help page section ordering and depth per feature
- Settings page layout and toggle/control styling

</decisions>

<specifics>
## Specific Ideas

No specific requirements — open to standard approaches

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope

</deferred>

---

*Phase: 38-mini-app-theme-accessibility*
*Context gathered: 2026-02-23*
