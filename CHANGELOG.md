# Changelog

Technical changelog for HeySous. For user-facing release notes, see [RELEASE_NOTES.md](./RELEASE_NOTES.md).

## v1.6.0

### Added
- All-day meal planning: 6 meal types (breakfast, lunch, snack, dinner, dessert, other) with configurable times per type (phases 42-43)
- Multi-recipe meal slots: multiple recipes per meal on the same day (phase 42)
- Sous memory system: dedicated `memories` table with FTS5 search, dedup pipeline, and categorized atomic facts (phase 49)
- `save_memory`, `delete_memory`, `search_memories` Claude tools for memory CRUD (phase 49)
- `/memory` and `/preferences` bot commands for viewing stored memories (phase 49)
- `application_settings` table (renamed from `reminder_settings`) with meal time columns and reminder toggles (phase 49)
- Deep-link builder module and `attach_deep_link` tool for inline Mini App buttons (phase 46)
- Post-response button injection in pipeline processor for automatic deep-link attachment (phase 46)
- Deep-link buttons on cooking/prep reminder messages (phase 46)
- Recipe deep-link handling in Mini App via `?id=` query parameter (phase 46)
- Start-cooking reminders for all meal types with per-type time offsets (phase 45)
- Mini App meal plan view grouped by meal type with expand/collapse per day (phase 44)
- Side-tabbed settings page with App, Schedule, and Memory sections (phase 50)
- Memory list with delete in Mini App settings (phase 49)
- Notification filtering: new users skip stale release notes (phase 54)
- Onboarding help message with next-steps prompt (phase 53)
- Memory saving during onboarding flow (phase 52)
- Database operation tests: memory CRUD, FTS5 search, dedup thresholds (phase 56)
- Settings-to-reminder integration tests (phase 55)

### Changed
- System prompt updated for multi-meal-type awareness and emoji ban (phases 43, 47)
- Onboarding state machine: removed recipes step, simplified to preferences -> tour -> complete (phase 53)
- Preference dedup threshold lowered from 0.85 to 0.70 (phase 48)
- Mini App font switched to system-ui stack with responsive layout padding (phase 47)
- Stream sender accumulates text properly across multi-turn responses (phase 51)
- Processor uses accumulated text instead of response.text override (phase 51)

### Fixed
- Deep-link buttons now attach to Sous response message, not sent separately (phase 48)
- Dead CSS media queries removed from Layout.css (phase 48)
- Meal entry indentation and font weight hierarchy in Mini App (phase 48)
- Stream finalize text override losing intermediate content (phase 51)
- HTML parse mode during streaming with plain-text fallback (post-UAT fix)
- Settings-to-reminder wiring: three gaps in toggle propagation fixed (phase 55)

## v1.5.0

### Added
- Streaming responses via grammY message editing
- Dark mode and font size settings in Mini App
- Time-aware start-cooking reminders using recipe prep/cook times
- Grocery category mapping for store-aware list formatting
- Deep link navigation from bot messages to Mini App views
- Mini App polish pass (responsive layout, loading states)

### Changed
- Reminder generator factors in actual recipe time estimates
- Grocery formatter groups items by store section

### Fixed
- Various v1.5 UAT fixes (phase 48)

## v1.4.0

### Added
- Recipe URL import (`fetchAndParseRecipe`)
- Recipe photo OCR via Claude vision
- Proactive recipe detection and save offers in conversation
- Knowledge item dedup pipeline (FTS5 + BM25 threshold)
- Store-aware grocery list formatting
- In-place recipe update flow (vs. creating duplicates)
- `/feedback` command for user feedback collection

### Changed
- Knowledge save flow checks for duplicates before creating new items
- Grocery list formatter respects store section preferences
