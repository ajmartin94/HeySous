# Changelog

Technical changelog for HeySous. For user-facing release notes, see [RELEASE_NOTES.md](./RELEASE_NOTES.md).

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
