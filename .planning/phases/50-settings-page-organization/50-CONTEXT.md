# Phase 50: Settings Page Organization - Context

**Gathered:** 2026-03-06
**Status:** Ready for planning

<domain>
## Phase Boundary

Reorganize the Mini App settings page from a single long scroll into a tabbed layout with clear section separation. No new settings or functionality — just restructuring what exists.

</domain>

<decisions>
## Implementation Decisions

### Layout structure
- Side tabs (text sidebar on the left), not top tabs
- Three tabs: App, Schedule, Memory — in that order
- Text labels in sidebar: "App", "Schedule", "Memory" (~80px wide sidebar)
- Active tab highlighted, content area fills remaining width

### Tab content
- **App tab**: Theme (light/dark pills), Text Size (S/M/L pills), Preview box (keep it)
- **Schedule tab**: Timezone (read-only), meal time inputs (breakfast through dessert), reminder toggles (morning summary, prep alerts), saved confirmation
- **Memory tab**: Memory items grouped by category with delete buttons, empty state message

### Claude's Discretion
- Active tab indicator styling (background color, border, etc.)
- Transition/animation between tabs (or none)
- Whether to extract into sub-components or keep as single file with tab state
- Responsive behavior if viewport is wider than expected

</decisions>

<specifics>
## Specific Ideas

- User specifically wants side tabs, not top horizontal tabs
- App tab first because it's the lightest/quickest section — schedule and memory are denser
- Preview box stays in the App tab for real-time font size feedback

</specifics>

<code_context>
## Existing Code Insights

### Reusable Assets
- `Settings.tsx` (507 lines) — current single-component implementation with all sections, inline styles, state management, and API calls already working
- `pillStyle()` function — reusable for tab active/inactive states
- `useTheme` hook — already wired for theme/fontSize

### Established Patterns
- Inline styles throughout Settings.tsx (no CSS file for settings)
- `apiFetch` for API calls, debounced saves via `saveSettingsField`
- Optimistic delete for memory items

### Integration Points
- `/memories` and `/settings` API endpoints already exist
- `backButton` from `@tma.js/sdk-react` for navigation
- Theme context from `ThemeContext.js`

</code_context>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope

</deferred>

---

*Phase: 50-settings-page-organization*
*Context gathered: 2026-03-06*
