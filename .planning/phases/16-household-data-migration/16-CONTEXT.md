# Phase 16: Household Data Migration - Context

**Gathered:** 2026-02-11
**Status:** Ready for planning

<domain>
## Phase Boundary

Migrate all data paths from chatId to householdId so household members share the same recipes, meal plans, grocery lists, and cooking history. Claude knows the current user's name. Both household-join and independent invite types produce working, fully isolated households.

</domain>

<decisions>
## Implementation Decisions

### Personal vs shared boundaries
- Everything is household-level: recipes, meal plans, grocery lists, preferences, dietary restrictions, cooking history
- Users are identities for access control only — not data partitions
- No per-user data beyond Telegram identity (stored in users table from Phase 15)
- Single shared taste/dietary profile per household

### Activity attribution
- No per-user attribution on data tables (no created_by/updated_by columns)
- Household is the unit of ownership for all data
- "What did we cook last week?" answers with household history, no names attached

### Household isolation
- Households are fully isolated silos — no data crosses household boundaries
- Both invite types (household-join and independent) work in this phase
- No admin cross-household visibility — admin role is developer-only, not a product concept
- Household merging (moving data between households) is explicitly not in scope

### Claude's household voice
- Household is plumbing, not personality — Claude just talks to whoever is messaging it
- No "we" framing, no "your household" language — just natural "you" conversation
- System prompt includes the current user's first name (from Telegram profile) — that's it
- No household size hints or household context in system prompt
- Claude addresses the user by name naturally, treats all shared data as "yours"

### Claude's Discretion
- Migration strategy (how to move chatId → householdId across tables)
- Transaction safety and rollback approach
- FTS5 trigger handling during migration
- Order of table migrations

</decisions>

<specifics>
## Specific Ideas

- "Stop making features for me as the admin" — admin role is not a product concept, just developer access
- "No reason to harp on households for anything — it's just a sharing feature"
- Household should be invisible to the user experience — data just works across members

</specifics>

<deferred>
## Deferred Ideas

- Household manager role — future concept if needed, not for now
- Household merging (moving standalone user's data into a household they join) — future problem
- Per-user activity attribution / "added by [name]" — could add later if wanted
- Onboarding name override (let user set preferred name vs Telegram name) — Phase 17

</deferred>

---

*Phase: 16-household-data-migration*
*Context gathered: 2026-02-11*
