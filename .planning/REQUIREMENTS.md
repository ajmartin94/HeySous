# Requirements: HeySous v1.4 Backlog Sweep

**Defined:** 2026-02-19
**Core Value:** The recipe brain -- an AI agent that remembers everything about your meals and reasons over that knowledge to help you plan.

## v1.4 Requirements

Requirements for v1.4 milestone. Each maps to roadmap phases.

### Recipe Import

- [ ] **IMPORT-01**: User can send a recipe URL and Sous extracts the recipe (JSON-LD/Microdata with Claude AI fallback)
- [ ] **IMPORT-02**: User can send a photo of a recipe and Sous extracts it via Claude vision
- [ ] **IMPORT-03**: Sous auto-detects recipe URLs shared mid-conversation (via Telegram message entities) and offers to import
- [ ] **IMPORT-04**: Imported recipes store their source URL on the knowledge item
- [ ] **IMPORT-05**: User sees extracted recipe for confirmation before it is saved
- [ ] **IMPORT-06**: Sous handles edge cases gracefully (paywalled sites, non-recipe URLs, blurry photos, blocked sites) with helpful messages

### Knowledge Quality

- [ ] **KNOW-01**: save_knowledge checks for existing similar items before creating; returns match info to Claude if found
- [ ] **KNOW-02**: Claude presents existing match to user and asks whether to update or create new (never auto-merges)
- [ ] **KNOW-03**: update_knowledge rejects calls with no substantive fields (title/summary/content/tags) and returns guidance
- [ ] **KNOW-04**: Dedup works for both recipe and preference knowledge types with appropriate matching strategies

### Data Migration

- [x] **MIGR-01**: Lightweight migration runner using PRAGMA user_version tracks which migrations have run
- [x] **MIGR-02**: Each migration runs in a transaction and is idempotent
- [x] **MIGR-03**: Migration runner executes during database init, after pragmas, before table init functions
- [x] **MIGR-04**: Existing migrateToHouseholdId left as-is; framework handles v1.4+ schema changes only

### Notifications

- [ ] **NOTIF-01**: Bot delivers "what's new" notification on next user interaction when updates are pending
- [ ] **NOTIF-02**: Notification delivery tracked per household so each household sees it once
- [ ] **NOTIF-03**: Notifications written in Sous's conversational voice, not generic changelog format

### Tone

- [ ] **TONE-01**: All hardcoded bot messages (errors, timeouts, access gate) rewritten in Sous's conversational voice
- [ ] **TONE-02**: Messages use random variation (multiple phrasings per message type) to avoid repetitive feel
- [ ] **TONE-03**: Centralized message module provides consistent tone across all bot-initiated messages

## Future Requirements

Deferred beyond v1.4. Tracked but not in current roadmap.

### Import Extensions

- **IMPORT-F01**: Multi-photo recipe support (combining multiple cookbook page photos into one recipe)
- **IMPORT-F02**: Recipe import from forwarded Telegram messages
- **IMPORT-F03**: Bulk URL import (batch importing bookmarks)

### Notification Extensions

- **NOTIF-F01**: Admin /notify command for manual broadcast
- **NOTIF-F02**: Rich media notifications (images, inline buttons)

## Out of Scope

Explicitly excluded. Documented to prevent scope creep.

| Feature | Reason |
|---------|--------|
| Paywall bypass / login-wall scraping | Legal liability, technically unreliable |
| Headless browser (Puppeteer/Playwright) | Massive dependency, slow, memory-heavy; JSON-LD is in initial HTML |
| OCR library (Tesseract) | Heavy native dep, worse than Claude vision at recipe understanding |
| Recipe import from video | Extremely complex, slow, expensive |
| Auto-migration rollback | Doubles complexity; forward-only is sufficient |
| Auto-upsert dedup | v1.3 reverted this; Claude-driven decisions are correct approach |
| Broadcast notifications | Spam risk, rate limit issues; lazy delivery is better for small user base |

## Traceability

Which phases cover which requirements. Updated during roadmap creation.

| Requirement | Phase | Status |
|-------------|-------|--------|
| IMPORT-01 | Phase 28 | Pending |
| IMPORT-02 | Phase 29 | Pending |
| IMPORT-03 | Phase 28 | Pending |
| IMPORT-04 | Phase 28 | Pending |
| IMPORT-05 | Phase 28 | Pending |
| IMPORT-06 | Phase 28 | Pending |
| KNOW-01 | Phase 26 | Pending |
| KNOW-02 | Phase 26 | Pending |
| KNOW-03 | Phase 26 | Pending |
| KNOW-04 | Phase 26 | Pending |
| MIGR-01 | Phase 25 | Complete |
| MIGR-02 | Phase 25 | Complete |
| MIGR-03 | Phase 25 | Complete |
| MIGR-04 | Phase 25 | Complete |
| NOTIF-01 | Phase 30 | Pending |
| NOTIF-02 | Phase 30 | Pending |
| NOTIF-03 | Phase 30 | Pending |
| TONE-01 | Phase 27 | Pending |
| TONE-02 | Phase 27 | Pending |
| TONE-03 | Phase 27 | Pending |

**Coverage:**
- v1.4 requirements: 20 total
- Mapped to phases: 20
- Unmapped: 0

---
*Requirements defined: 2026-02-19*
*Last updated: 2026-02-19 after roadmap creation*
