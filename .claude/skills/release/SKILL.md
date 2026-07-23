---
name: release
description: Walk through the full HeySous release process for a milestone. Use this skill whenever the user says "release", "ship it", "cut a release", "deploy to prod", "create a release", "tag a version", or otherwise indicates they want to publish a milestone to production. Also trigger when the user has just completed a milestone and asks "what's next" in the context of shipping.
---

# Release Process

Interactive walkthrough for shipping a HeySous milestone to production. Each step checks prerequisites before proceeding and waits for user confirmation.

The release process has three phases: **preparation** (steps 1-5, done on the milestone branch), **documentation** (steps 6-7, changelog and CLAUDE.md review), and **shipping** (steps 8-10, merging and tagging).

## Step 1: Verify milestone completion

Check that the GSD milestone is complete:

```bash
# Check for incomplete plans
ls .planning/phases/*/*.md 2>/dev/null | grep PLAN | while read plan; do
  summary="${plan/PLAN/SUMMARY}"
  [ ! -f "$summary" ] && echo "INCOMPLETE: $plan"
done
```

If incomplete plans exist, tell the user and suggest `/gsd:execute-phase` for the relevant phase. Do not proceed until all plans have summaries.

If the user hasn't run `/gsd:complete-milestone` yet, suggest it now. This archives the milestone and prepares the branch for merge.

## Step 2: Review pending todos

Read all files in `.planning/todos/pending/`:

```bash
ls .planning/todos/pending/*.md 2>/dev/null
```

For each todo, present it to the user and ask:
- **Close** — already done or no longer relevant (delete the file)
- **Fold** — should be a requirement in the next milestone (note it for later)
- **Keep** — still pending, leave it alone

Present todos in a numbered list so the user can batch their decisions (e.g., "close 1, 3, 5; fold 2; keep 4").

## Step 3: Write release notes

Read `src/notifications/release-notes.ts` to see the existing format and version numbers.

Determine the new version number from the milestone branch name (e.g., `gsd/v1.6-...` → `"1.6.0"`).

Gather what was built by reading the milestone's phase summaries:
```bash
ls .planning/phases/*/*.md 2>/dev/null | grep SUMMARY
```

Draft release notes in Sous's conversational voice following the existing pattern:
- Opening line that's warm and personal
- Bulleted feature list using `<b>` tags for feature names
- Closing call-to-action

Present the draft to the user for approval. On approval:

1. **`src/notifications/release-notes.ts`** — Add the entry to `RELEASE_NOTES`. The key is the version string (e.g., `"1.6.0"`), the value is the HTML string using the `.join("\n")` array pattern. This is what Sous shows users in Telegram — `seedNotifications()` inserts it on startup and it auto-delivers once per household.

2. **`RELEASE_NOTES.md`** — Append the same content in markdown format (not HTML) under a `## vX.Y.Z` heading. This is the human-readable version history in the repo. Convert `<b>text</b>` to `**text**`, keep the same structure otherwise.

## Step 4: Write changelog

Read `CHANGELOG.md` to see the existing format.

Generate a technical changelog entry under a `## vX.Y.Z` heading. Unlike release notes (which are user-facing and conversational), the changelog is developer-facing and covers:

- **Added** — new features, new tools, new API routes, new tables
- **Changed** — modified behavior, renamed endpoints, schema changes
- **Fixed** — bug fixes resolved during the milestone
- **Removed** — deprecated features, deleted code paths

Source this from the phase summaries and git log:
```bash
git log main..HEAD --oneline
```

Group entries by category. Keep entries concise — one line per change, referencing the phase number (e.g., "Add memory FTS5 dedup pipeline (phase 49)"). Present to user for approval before writing.

## Step 5: Update help docs (if needed)

Read `src/bot/handlers/help.ts` and the Mini App help page. If new user-facing features were added that aren't covered in help, suggest updates. If help is already current, confirm and move on.

## Step 6: Review and update CLAUDE.md

This step ensures project documentation stays current with what was actually built. Read the root `CLAUDE.md` and all subdirectory `CLAUDE.md` files:

```bash
find . -name "CLAUDE.md" -not -path "*/node_modules/*" | sort
```

For each file, check whether the milestone's changes require updates:

- **Source Layout** — Were new `src/` directories added? Update the layout table.
- **Architecture Rules** — Were new patterns established or existing conventions changed?
- **Subdirectory CLAUDE.md files** — Do step-by-step recipes still match reality? Were new key files added?
- **Testing** — Were new testing patterns or utilities introduced?
- **Naming/terminology** — Any new domain concepts that should be documented?

Also consider learnings from the development process itself:
- Did the team discover gotchas or footguns that future development should avoid?
- Were there recurring issues during the milestone that better documentation would prevent?
- Did any architecture rules prove wrong or need refinement?

Present proposed changes to the user for approval. If nothing needs updating, confirm and move on.

## Step 7: Commit preparation changes

Commit all preparation work (release notes, changelog, help updates, CLAUDE.md changes) on the milestone branch:

```bash
git add CHANGELOG.md RELEASE_NOTES.md src/notifications/release-notes.ts CLAUDE.md src/*/CLAUDE.md
# Only add files that were actually modified
git status --short
```

Use a commit message like: `docs(release): prepare v1.X release notes, changelog, and docs`

## Step 8: Create PR

This is the shipping boundary — confirm with the user before proceeding.

```bash
# Show what will be in the PR
git log main..HEAD --oneline
```

Create a PR from the milestone branch to `main`:
```bash
gh pr create --base main --title "v1.X: [milestone name]" --body "..."
```

The PR body should include a summary of phases completed and key features. Remind the user: **squash-merge manually** — do not merge from the CLI.

Wait for the user to confirm they've merged the PR before proceeding.

## Step 9: Tag the release

After the user confirms the PR is merged:

```bash
git checkout main && git pull
git tag v1.X
git push origin v1.X
```

Confirm the tag was pushed successfully.

## Step 10: Deploy

Deploys are automated: pushing the `vX.Y` tag (step 9) triggers `.github/workflows/deploy.yml`, which builds in CI, syncs artifacts to the droplet, restarts PM2, and health-checks `https://hey-sous.com/health`. See `docs/DEPLOYMENT.md` for the pipeline details.

### 10a. Environment variable check (before tagging, ideally)

Check if the release introduced new environment variables. Read `src/config.ts` and compare against the current `.env.example`. Present any new variables that need to be added on the server.

Current known variables (update this list when new ones are added):
```
BOT_TOKEN, BOT_MODE, PORT, WEBHOOK_URL, DB_FILE_NAME, LOG_LEVEL, NODE_ENV,
ANTHROPIC_API_KEY, ANTHROPIC_MODEL, ADMIN_USER_IDS, MINI_APP_URL,
LOG_TOOL_INPUTS, DAILY_TOKEN_BUDGET, SESSION_TIMEZONE
```

If new variables exist, tell the user to SSH in and add them **before** the tag push (config validates at startup, so a missing variable fails the deploy's health check):
```bash
ssh prod
nano ~/heysous/.env
# Add new variables, then exit
```

### 10b. Watch the deploy

After the tag push, follow the workflow:

```bash
gh run watch
```

If the workflow fails, read the failed step's logs (`gh run view --log-failed`) and diagnose before retrying. The workflow can be re-run from the Actions tab or with `gh run rerun` — no new tag needed (or trigger manually via `workflow_dispatch`).

### 10c. Smoke test

Once the workflow is green, present this short checklist:

```
1. Send a message to the bot on Telegram
   - Verify response streams correctly
   - If release notes were added: verify they auto-deliver on first message

2. Check webhook health
   curl https://api.telegram.org/bot<TOKEN>/getWebhookInfo
   - pending_update_count should be 0
   - last_error_date should not be recent
```

### 10d. Release summary

After the user confirms deployment, present:
- Version released
- Features shipped / bugs fixed
- Todos folded into next milestone (if any)
- Release notes version key (if applicable)
- CLAUDE.md changes made (if any)
- New env variables added (if any)

Suggest next steps: `/gsd:new-milestone` to start the next cycle.
