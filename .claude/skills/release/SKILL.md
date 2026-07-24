---
name: release
description: Walk through the full HeySous release process for a release branch. Use this skill whenever the user says "release", "ship it", "cut a release", "deploy to prod", "create a release", "tag a version", or otherwise indicates they want to publish to production. Also trigger when the user has just finished a batch of work and asks "what's next" in the context of shipping.
---

# Release Process

Interactive walkthrough for shipping HeySous to production. Each step checks prerequisites before proceeding and waits for user confirmation.

Three phases: **preparation** (steps 1-4, on the feature branch), **documentation** (steps 5-6, changelog and CLAUDE.md review), and **shipping** (steps 7-9, PR, tag, deploy).

## Step 1: Verify the branch is ready

On the feature branch, everything must be green:

```bash
npm test && npm run typecheck && npm run build:all
```

All work intended for the release must be committed; unrelated local changes stay out of release commits. For behavior changes, verify against the live app too — use the `run-heysous` skill (launch, smoke, dev-DB queries) rather than rediscovering the dev setup.

## Step 2: Write release notes

Read `src/notifications/release-notes.ts` to see the existing format and version numbers.

Determine the new version number from the branch name if it matches `feature/vX.Y-*` or `chore/vX.Y-*` (e.g. `feature/v1.7-feedback-fixes` → `"1.7.0"`). Otherwise, ask the user for the version number.

Gather what was built:
```bash
git log main..HEAD --oneline
```

Draft release notes in Sous's conversational voice following the existing pattern:
- Opening line that's warm and personal
- Bulleted feature list using `<b>` tags for feature names
- Closing call-to-action

Present the draft to the user for approval. On approval:

1. **`src/notifications/release-notes.ts`** — Add the entry to `RELEASE_NOTES`. The key is the version string (e.g., `"1.7.0"`), the value is the HTML string using the `.join("\n")` array pattern. This is what Sous shows users in Telegram — `seedNotifications()` inserts it on startup and it auto-delivers once per household.

2. **`RELEASE_NOTES.md`** — Append the same content in markdown format (not HTML) under a `## vX.Y.Z` heading. This is the human-readable version history in the repo. Convert `<b>text</b>` to `**text**`, keep the same structure otherwise.

## Step 3: Write changelog

Read `CHANGELOG.md` to see the existing format.

Generate a technical changelog entry under a `## vX.Y.Z` heading. Unlike release notes (user-facing, conversational), the changelog is developer-facing:

- **Added** — new features, new tools, new API routes, new tables
- **Changed** — modified behavior, renamed endpoints, schema changes
- **Fixed** — bug fixes, with the root cause named where it's interesting
- **Removed** — deprecated features, deleted code paths

Source it from `git log main..HEAD` and the branch's PR descriptions. One line per change. Present to user for approval before writing.

## Step 4: Update help docs (if needed)

Read `src/bot/handlers/help.ts` and the Mini App help page. If new user-facing features were added that aren't covered in help, suggest updates. If help is already current, confirm and move on.

## Step 5: Review and update CLAUDE.md

Read the root `CLAUDE.md` and all subdirectory `CLAUDE.md` files:

```bash
find . -name "CLAUDE.md" -not -path "*/node_modules/*" | sort
```

For each file, check whether this release's changes require updates:

- **Source Layout** — Were new `src/` directories added? Update the layout table.
- **Architecture Rules** — Were new patterns established or existing conventions changed?
- **Subdirectory CLAUDE.md files** — Do step-by-step recipes still match reality? Were new key files added?
- **Testing** — Were new testing patterns or utilities introduced?

Also consider learnings from the development process itself: gotchas or footguns worth documenting, and architecture rules that proved wrong. Present proposed changes to the user for approval. If nothing needs updating, confirm and move on.

## Step 6: Commit preparation changes

Commit all preparation work (release notes, changelog, help updates, CLAUDE.md changes) on the feature branch:

```bash
git status --short   # only add files that were actually modified
git add CHANGELOG.md RELEASE_NOTES.md src/notifications/release-notes.ts
```

Use a commit message like: `docs(release): prepare v1.X release notes and changelog`

## Step 7: Create PR and verify

This is the shipping boundary — confirm with the user before proceeding.

```bash
git log main..HEAD --oneline   # show what will be in the PR
gh pr create --base main --title "v1.X: [release name]" --body "..."
```

The PR body summarizes what shipped and why. Then **post a human verification plan as a PR comment** (`gh pr comment <n> --body "..."`): a concrete checklist walking each user-facing change against the dev bot/Mini App, in the order most likely to catch regressions. Launch the dev environment for the user with the `run-heysous` skill. Note which items are already covered by automated tests so the human skips them.

The user squash-merges after verifying — do not merge from the CLI unless the user explicitly asks you to (then `gh pr merge <n> --squash` is fine). If the user says they merged, verify before proceeding: `gh pr view <n> --json state,mergedAt` — clicks sometimes don't land.

## Step 8: Tag the release

After the merge is confirmed:

```bash
git checkout main && git pull
git tag v1.X        # e.g. v1.7 — this tag push is what triggers the deploy
git push origin v1.X
```

**Before tagging**, check for new environment variables: read `src/config.ts` and compare against `.env.example`. Config validates at startup, so a missing variable fails the deploy's health check. If new variables exist, the user must SSH in and add them to `~/heysous/.env` first.

Current known variables (update this list when new ones are added):
```
BOT_TOKEN, BOT_MODE, PORT, WEBHOOK_URL, DB_FILE_NAME, LOG_LEVEL, NODE_ENV,
ANTHROPIC_API_KEY, ANTHROPIC_MODEL, ADMIN_USER_IDS, MINI_APP_URL,
LOG_TOOL_INPUTS, DAILY_TOKEN_BUDGET, SESSION_TIMEZONE
```

## Step 9: Deploy and verify

The `vX.Y` tag push triggers `.github/workflows/deploy.yml`: builds in CI, syncs artifacts to the droplet, restarts PM2, health-checks `https://hey-sous.com/health`. See `docs/DEPLOYMENT.md`.

### 9a. Watch the deploy

```bash
gh run watch <run-id> --exit-status    # find the id with: gh run list --limit 3
curl -s https://hey-sous.com/health    # after green: expect "ok"
```

If the workflow fails, read the failed step's logs (`gh run view --log-failed`) and diagnose before retrying (`gh run rerun` — no new tag needed).

### 9b. Prod verification via the debug MCP

If the `heysous-debug` MCP server is connected (`.mcp.json`, ssh to prod), verify data-level effects of the release directly — e.g. after a fix that changes row lifecycle, query the affected table and confirm the expected state transition happened on startup. This catches "deployed but not actually fixed" immediately. If it isn't connected, ask the user to run `/mcp`.

### 9c. Manual smoke test

Present this checklist to the user:

```
1. Send a message to the bot on Telegram
   - Verify the response streams correctly
   - If release notes were added: verify they auto-deliver on first message

2. Check webhook health
   curl https://api.telegram.org/bot<TOKEN>/getWebhookInfo
   - pending_update_count should be 0
   - last_error_date should not be recent
```

### 9d. Release summary

After the user confirms deployment, present: version released, features shipped / bugs fixed, release notes version key, CLAUDE.md changes made (if any), new env variables added (if any).

Suggest next steps: start a new feature branch for the next cycle of work.
