# Phase 11: Mini App Foundation - Context

**Gathered:** 2026-02-09
**Status:** Ready for planning

<domain>
## Phase Boundary

Deliver the infrastructure that all three Mini Apps depend on: initData HMAC-SHA256 authentication, React+Vite SPA scaffold, Express static serving and API routes, iOS platform fixes (scroll collapse, keyboard, safe areas), Telegram theme integration, and BotFather menu button configuration. No user-facing features — this is plumbing for Phases 12-14.

</domain>

<decisions>
## Implementation Decisions

### Entry Points & Navigation
- BotFather menu button opens a **hub page** (not a specific Mini App)
- Bot responses include **contextual inline keyboard buttons** — e.g., grocery list response gets "View List" button, meal plan response gets "View Plan"
- Users can navigate **between Mini App views without closing** — the hub page or in-app navigation supports cross-view switching (grocery → recipes → plan)
- Contextual buttons **deep-link directly to the relevant view** — tapping "View List" opens the grocery list, not the hub. Hub is only reached via the menu button
- This means the Mini App is a **single React SPA with client-side routing** — hub, grocery, recipes, and meal plan are all routes within one app

### Landing Experience
- Hub page shows **dashboard cards with live data previews** — e.g., "12 items on your list", "3 meals planned this week", "24 recipes saved"
- Each card is tappable to navigate to that Mini App view
- **Skeleton screens** for loading states — gray placeholder shapes matching the layout, content fills in
- Empty states use a **helpful nudge tone** — e.g., "No recipes yet — ask me to save one in chat!" with guidance back to the bot
- Hub page has a **brief header** with "HeySous" branding at the top, then dashboard cards below — personality without wasting space

### Theme & Styling
- **Telegram-native base with HeySous personality** — use @telegram-apps/telegram-ui components as the foundation, add subtle brand touches
- Personality via **accent color + food-related icons** (no emoji) — section headers, empty states, and interactive elements get food-themed iconography
- Accent color: **fresh/green palette** — sage green, herb green tones. Must work in both light and dark Telegram themes
- **Spacious layout** — generous padding, larger text, breathing room. Comfortable for scanning, not dense

### Claude's Discretion
- Exact green accent color values (light/dark mode variants)
- Specific food icon choices and icon library
- Skeleton screen shapes and animation style
- Hub card layout (grid vs stacked)
- Navigation pattern between views (tabs, back arrows, or hub-centric)
- All technical architecture: middleware patterns, file structure, build config

</decisions>

<specifics>
## Specific Ideas

- Hub should feel like a dashboard, not a menu — live data makes it useful even before tapping in
- Food icons, not emoji — keep it polished
- The "helpful nudge" empty states should guide users back to the bot conversation, since that's where content creation happens
- Deep-linking from bot responses should feel instant — user taps "View List" and they're looking at their list, no intermediate screens

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope

</deferred>

---

*Phase: 11-mini-app-foundation*
*Context gathered: 2026-02-09*
