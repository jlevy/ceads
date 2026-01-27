IMPORTANT: You MUST read ./docs/development.md and ./docs/docs-overview.md for project
documentation. (This project uses Speculate project structure.)

## Landing the Plane (Session Completion)

**When ending a work session**, you MUST complete ALL steps below.
Work is NOT complete until `git push` succeeds.

**MANDATORY WORKFLOW:**

1. **File issues for remaining work** - Create issues for anything that needs follow-up
2. **Run quality gates** (if code changed) - Tests, linters, builds
3. **Update issue status** - Close finished work, update in-progress items
4. **PUSH TO REMOTE** - This is MANDATORY:
   ```bash
   git pull --rebase
   bd sync
   git push
   git status  # MUST show "up to date with origin"
   ```
5. **Clean up** - Clear stashes, prune remote branches
6. **Verify** - All changes committed AND pushed
7. **Hand off** - Provide context for next session

**CRITICAL RULES:**

- Work is NOT complete until `git push` succeeds
- NEVER stop before pushing - that leaves work stranded locally
- NEVER say “ready to push when you are” - YOU must push
- If push fails, resolve and retry until it succeeds

<!-- BEGIN TBD INTEGRATION -->
# tbd Workflow

**`tbd` helps humans and agents ship code with greater speed, quality, and discipline.**

1. **Issue Tracking**: Git-native tasks/bugs.
   Never lose work across sessions.
2. **Spec-Driven Workflows**: Plan features → break into issues → implement
   systematically.
3. **Shortcuts**: Pre-built processes for commits, PRs, reviews.
4. **Guidelines**: Best practices for TypeScript, Python, testing.

These features work together to create high-quality workflows.
Be sure to apply the workflows below for all issue tracking, spec driven planning and
implementation, and code review.

## Installation

If `tbd` is not installed, install and set up:

```bash
npm install -g tbd-git@latest
tbd                                # Gives full orientation
tbd setup --auto --prefix=<name>   # Fresh project (--prefix REQUIRED)
tbd setup --auto                   # Existing tbd project (prefix already set)
```

The prefix appears in every issue ID (e.g., `myapp-a1b2`) and is a matter of user
preference for a given project.

**IMPORTANT NOTES ON SETUP:**
- **Fresh projects**: `--prefix` is REQUIRED. NEVER guess or invent a prefix.
  Always ask the user first.
- **Existing tbd projects** (`.tbd/` exists): No `--prefix` needed, just run
  `tbd setup --auto`.
- **Beads migration** (`.beads/` exists): Use `tbd setup --from-beads` (uses beads
  prefix).
- **Refresh configs**: Run `tbd setup --auto` anytime to update skill files, hooks, and
  get the latest shortcuts/guidelines/templates.

> `tbd prime` restores context after compaction/clear (auto-called by hooks).

## How to Use tbd to Help Users

**Don’t just tell users about commands.** Use tbd proactively:

- User describes a bug → `tbd create "Bug: ..." --type=bug`
- User wants a feature → Create a plan spec, then break into issues
- Starting a session → Check `tbd ready` for available work
- Completing work → `tbd close <id>` with clear reason
- User asks what tbd does → Explain the four capabilities above

### Quick Reference Table

| User Need or Request | Command | Notes |
| --- | --- | --- |
| "There is a bug where ..." | `tbd create "..." --type=bug` | Creates issue |
| "Let's plan a new feature" | `tbd shortcut new-plan-spec` | Outputs instructions |
| "Fix current issues" | `tbd ready` | Lists ready issues |
| "Build a TypeScript CLI" | `tbd guidelines typescript-cli-tool-rules` | Outputs guidelines |
| "Improve eslint setup" | `tbd guidelines typescript-monorepo-patterns` | Outputs guidelines |
| "Add better e2e testing" | `tbd guidelines golden-testing-guidelines` | Outputs guidelines |
| "Review these changes" (TypeScript) | `tbd guidelines typescript-rules` | Outputs guidelines |
| "Review these changes" (Python) | `tbd guidelines python-rules` | Outputs guidelines |
| "Commit this" | `tbd shortcut commit-code` | Outputs instructions |
| "Create a PR" | `tbd shortcut create-or-update-pr-simple` | Outputs instructions |
| "Research this topic" | `tbd shortcut new-research-brief` | Outputs template |
| "Document this architecture" | `tbd shortcut new-architecture-doc` | Outputs template |

*“Outputs instructions/guidelines” = Read and follow the guidance.
It tells you HOW to do something well.*

## IMPORTANT: Session Closing Protocol

**CRITICAL**: Before saying “done” or “complete”, you MUST run this checklist:

```
[ ] 1. Stage and commit: git add + git commit
[ ] 2. Push to remote: git push
[ ] 3. Start CI watch (BLOCKS until done): gh pr checks <PR> --watch 2>&1
[ ] 4. While CI runs: tbd close/update <id> for issues worked on
[ ] 5. While CI runs: tbd sync
[ ] 6. Return to step 3 and CONFIRM CI passed
[ ] 7. If CI failed: fix, re-push, restart from step 3
```

### NON-NEGOTIABLE Requirements

#### CI: Wait for `--watch` to finish

The `--watch` flag blocks until ALL checks complete.
Do NOT see “passing” in early output and move on—wait for the **final summary** showing
all checks passed.

#### tbd: Update issues and sync

Every session must end with tbd in a clean state:
- Close/update **every issue** you worked on
- Run `tbd sync` and confirm it completed

**Work is not done until pushed, CI passes, and tbd is synced.**

## IMPORTANT: Issue Tracking Rules

- Track *all task work* not being done immediately as beads using `tbd` (discovered
  work, future work, TODOs for the session, multi-session work)
- When in doubt, prefer tbd for tracking tasks, bugs, and issues
- Use `tbd create` for creating beads
- Git workflow: update or close issues and run `tbd sync` at session end
- If not given specific directions, check `tbd ready` for available work

## Essential Commands

### Finding Work

- `tbd ready` - Show issues ready to work (no blockers)
- `tbd list --status open` - All open issues
- `tbd list --status in_progress` - Your active work
- `tbd show <id>` - Detailed issue view with dependencies

### Creating & Updating

- `tbd create "title" --type task|bug|feature --priority=P2` - New issue
  - Priority: P0-P4 (P0=critical, P2=medium, P4=backlog).
    Do NOT use "high"/"medium"/"low"
- `tbd update <id> --status in_progress` - Claim work
- `tbd update <id> --assignee username` - Assign to someone
- `tbd close <id>` - Mark complete
- `tbd close <id> --reason "explanation"` - Close with reason
- **Tip**: When creating multiple issues, use parallel subagents for efficiency

### Dependencies & Blocking

- `tbd dep add <issue> <depends-on>` - Add dependency (issue depends on depends-on)
- `tbd blocked` - Show all blocked issues
- `tbd show <id>` - See what’s blocking/blocked by this issue

### Sync & Collaboration

- `tbd sync` - Sync with git remote (run at session end)
- `tbd sync --status` - Check sync status without syncing

Note: `tbd sync` handles all git operations for issues--no manual git push needed.

### Project Health

- `tbd stats` - Project statistics (open/closed/blocked counts)
- `tbd doctor` - Check for issues (sync problems, missing hooks)

## Documentation Commands

### Shortcuts

Reusable instruction templates for common tasks:

- `tbd shortcut <name>` - Output a shortcut by name
- `tbd shortcut --list` - List all available shortcuts

### Guidelines

Coding rules and best practices:

- `tbd guidelines <name>` - Output a guideline by name
- `tbd guidelines --list` - List all available guidelines

Example: `tbd guidelines typescript-rules`

### Templates

Document templates for specs, research, architecture:

- `tbd template <name>` - Output a template by name
- `tbd template --list` - List all available templates

Example: `tbd template plan-spec > docs/project/specs/active/plan-YYYY-MM-DD-feature.md`

## Quick Reference

- **Priority levels**: 0=critical, 1=high, 2=medium (default), 3=low, 4=backlog
- **Issue types**: task, bug, feature, epic
- **Status values**: open, in_progress, closed
- **JSON output**: Add `--json` to any command for machine-readable output

<!-- BEGIN SHORTCUT DIRECTORY -->
## Available Shortcuts

Run `tbd shortcut <name>` to use any of these shortcuts:

| Name | Title | Description |
| --- | --- | --- |
| commit-code | Commit Code | Run pre-commit checks, review changes, and commit code |
| create-or-update-pr-simple | Create or Update PR (Simple) | Create or update a pull request with a concise summary |
| create-or-update-pr-with-validation-plan | Create or Update PR with Validation Plan | Create or update a pull request with a detailed test/validation plan |
| implement-beads | Implement Beads | Implement issues from a spec, following TDD and project rules |
| new-architecture-doc | New Architecture Doc | Create an architecture document for a system or component design |
| new-implementation-beads-from-spec | New Implementation Beads from Spec | Create implementation issues (beads) from a feature planning spec |
| new-plan-spec | New Plan Spec | Create a new feature planning specification document |
| new-research-brief | New Research Doc | Create a research document for investigating a topic or technology |
| new-validation-plan | New Validation Plan | Create a validation/test plan for a feature or change |
| precommit-process | Pre-Commit Process | Full pre-commit checklist including spec sync, code review, and testing |
| review-code-python | Review Code (Python) | Perform a code review for Python code following best practices |
| review-code-typescript | Review Code (TypeScript) | Perform a code review for TypeScript code following best practices |
| welcome-user | Welcome User | Welcome message for users after tbd installation or setup |

<!-- END SHORTCUT DIRECTORY -->
<!-- END TBD INTEGRATION -->
