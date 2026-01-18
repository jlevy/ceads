# tbd CLI Documentation

Git-native issue tracking for AI agents and humans.

> [!NOTE]
> This is the tbd reference (`tbd docs`). See the tbd readme (`tbd readme`) for a quick
> intro or the design doc (`tbd design`) for more technical details.

## Key Design Features

### Issues stored in one place

tbd stores issues on a dedicated `tbd-sync` branch, separate from your code:

```
.tbd/
├── config.yml                    # Configuration (tracked on main)
└── data-sync-worktree/           # Hidden worktree (gitignored)
    └── .tbd/data-sync/
        ├── issues/               # One .md file per issue
        ├── mappings/ids.yml      # Short ID → ULID mapping
        └── attic/                # Conflict archive (no data loss)
```

Why a separate branch?

- No noisy issue commits in your code history
- No conflicts across main or feature branches
- Issues shared across all branches

## File format

You usually don’t need to worry about where issues are stored, but it may be comforting
to know that internally it’s very simple and transparent.
Every issue is a Markdown file with YAML frontmatter, stored on the `tbd-sync` branch.

```markdown
---
id: is-01hx5zzkbkactav9wevgemmvrz
kind: bug
title: API returns 500 on malformed input
status: open
priority: 1
labels: [backend, urgent]
created_at: 2025-01-15T10:30:00Z
updated_at: 2025-01-15T10:30:00Z
---

The /api/users endpoint crashes when given invalid JSON.
```

### Automatic git push

Unlike Beads (where you manually `git add`/`commit`/`push` the JSONL file), `tbd sync`
handles all git operations automatically.
One command commits and pushes issues to the sync branch.
Your normal `git push` is only for code changes.

### Conflict handling

- Separate issues never conflict since they are separate files.
- If two agents modify the same issue at the same time, does field-level merge
  (last-write-wins for scalars, union for arrays)
- In that case lost values preserved in attic—no data loss ever

### Unique internal ids

Issues have a short display ID like `proj-a7k2` (where `proj` is your project’s prefix)
but these map to unique ULID-based internal IDs for reliable sorting and storage.

## Requirements and Installation

**Requirements:**

- Node.js 20+
- Git 2.42+ (for orphan worktree support)

```bash
# Check your Git version
git --version  # Should be 2.42.0 or higher

# Global install (recommended)
npm install -g tbd-git@latest

# Or run without installing
npx tbd-git@latest <command>
```

tbd requires Git 2.42+ for orphan worktree support (`git worktree add --orphan`). See
[git-scm.com/downloads](https://git-scm.com/downloads) for platform-specific
instructions.

## Quick Reference

### Find and claim work

```bash
tbd ready                                  # What's available to work on?
tbd show proj-1847                           # Review the issue details
tbd update proj-1847 --status=in_progress    # Claim it
```

### Complete work

```bash
tbd close proj-1847 --reason="Fixed in auth.ts, added retry logic"
tbd sync                                   # Push to remote
```

### Create issues

```bash
tbd create "API returns 500 on malformed input" --type=bug --priority=P1
tbd create "Add rate limiting to /api/upload" --type=feature
tbd create "Refactor database connection pooling" --type=task --priority=P3

# With description and labels
tbd create "Users can't reset password" --type=bug --priority=P0 \
  --description="Reset emails not sending. Affects all users since deploy." \
  --label=urgent --label=auth
```

### Track dependencies

```bash
tbd create "Write integration tests" --type=task
tbd dep add proj-1850 proj-1847           # 1850 depends on 1847 (can't test until 1847 done)
tbd blocked                                # See what's waiting
```

### Daily workflow

```bash
tbd sync                    # Start of session
tbd ready                   # Find work
# ... do the work ...
tbd close proj-xxxx           # Mark complete
tbd sync                    # End of session
```

### Issue lifecycle

```
open → in_progress → closed
  ↓
blocked/deferred
```

## Commands

### init

Initialize tbd in a git repository.

```bash
tbd init --prefix=proj             # Initialize with prefix (required)
tbd init --prefix=myapp --sync-branch=my-sync  # Custom sync branch name
tbd init --prefix=tk --remote=upstream         # Use different remote
```

Options:
- `--prefix <name>` - **Required.** Project prefix for display IDs (e.g., "proj", "myapp")
- `--sync-branch <name>` - Sync branch name (default: tbd-sync)
- `--remote <name>` - Remote name (default: origin)

Note: When importing from Beads (`tbd import --from-beads`), the prefix is auto-detected.

### create

Create a new issue.

```bash
tbd create "Implement user auth"                                   # Basic task
tbd create "Fix crash on login" --type=bug --priority=P0            # Critical bug
tbd create "Dark mode support" --type=feature                      # Feature request
tbd create "Refactor database layer" --type=chore                  # Technical debt
tbd create "Q1 Goals" --type=epic                                  # Epic for grouping

# With description
tbd create "Add rate limiting" --description="Prevent API abuse with 100 req/min limit"

# With labels
tbd create "Fix mobile layout" --label=frontend --label=urgent

# With assignee and due date
tbd create "Security audit" --assignee=alice --due=2025-02-01

# From YAML file
tbd create --from-file=issue.yml
```

Options:
- `--type <type>` - Issue type: bug, feature, task, epic, chore (default: task)
- `--priority <0-4>` - Priority: 0=critical, 1=high, 2=medium, 3=low, 4=backlog
  (default: 2)
- `--description <text>` - Issue description
- `--file <path>` - Read description from file
- `--assignee <name>` - Assign to someone
- `--due <date>` - Due date (ISO8601 format)
- `--defer <date>` - Defer until date
- `--parent <id>` - Parent issue ID (for sub-issues)
- `--label <label>` - Add label (can repeat)
- `--from-file <path>` - Create from YAML+Markdown file

### list

List issues with filtering and sorting.

```bash
tbd list                                    # Open issues, sorted by priority
tbd list --all                              # Include closed issues
tbd list --status=in_progress               # Currently being worked on
tbd list --status=blocked                   # Blocked issues
tbd list --type=bug                         # Only bugs
tbd list --priority=P0                       # Critical priority only
tbd list --assignee=alice                   # Assigned to alice
tbd list --label=urgent                     # With 'urgent' label
tbd list --label=backend --label=api        # Multiple labels (AND)
tbd list --parent=proj-x1y2                   # Children of an epic
tbd list --sort=created                     # Sort by creation date
tbd list --sort=updated                     # Sort by last update
tbd list --limit=10                         # Limit results
tbd list --count                            # Just show count
tbd list --long                             # Show descriptions
tbd list --pretty                           # Tree view with parent-child hierarchy
tbd list --pretty --long                    # Tree view with descriptions

# JSON output for scripting
tbd list --json | jq '.[].title'
```

Options:
- `--status <status>` - Filter: open, in_progress, blocked, deferred, closed
- `--all` - Include closed issues
- `--type <type>` - Filter: bug, feature, task, epic, chore
- `--priority <0-4>` - Filter by priority
- `--assignee <name>` - Filter by assignee
- `--label <label>` - Filter by label (repeatable, AND logic)
- `--parent <id>` - List children of parent issue
- `--deferred` - Show only deferred issues
- `--defer-before <date>` - Deferred before date
- `--sort <field>` - Sort by: priority, created, updated (default: priority)
- `--limit <n>` - Limit number of results
- `--count` - Output only the count of matching issues
- `--long` - Show issue descriptions on a second line
- `--pretty` - Show tree view with parent-child relationships

### show

Display detailed information about an issue.

```bash
tbd show proj-a7k2                            # YAML output
tbd show proj-a7k2 --json                     # JSON output
```

Output includes all fields: title, description, status, priority, labels, dependencies,
timestamps, and working notes.

### update

Modify an existing issue.

```bash
tbd update proj-a7k2 --status=in_progress    # Start working
tbd update proj-a7k2 --status=blocked        # Mark as blocked
tbd update proj-a7k2 --priority=P0            # Escalate priority
tbd update proj-a7k2 --assignee=bob          # Reassign
tbd update proj-a7k2 --description="New description"
tbd update proj-a7k2 --notes="Found root cause in auth.ts"
tbd update proj-a7k2 --notes-file=notes.md   # Notes from file
tbd update proj-a7k2 --due=2025-03-01        # Set due date
tbd update proj-a7k2 --defer=2025-02-15      # Defer until later
tbd update proj-a7k2 --add-label=blocked     # Add label
tbd update proj-a7k2 --remove-label=urgent   # Remove label
tbd update proj-a7k2 --parent=proj-x1y2        # Set parent epic

# Update from YAML file
tbd update proj-a7k2 --from-file=updated.yml
```

Options:
- `--from-file <path>` - Update all fields from YAML+Markdown file
- `--status <status>` - Set status
- `--type <type>` - Set type
- `--priority <0-4>` - Set priority
- `--assignee <name>` - Set assignee
- `--description <text>` - Set description
- `--notes <text>` - Set working notes
- `--notes-file <path>` - Set notes from file
- `--due <date>` - Set due date
- `--defer <date>` - Set deferred until date
- `--add-label <label>` - Add label
- `--remove-label <label>` - Remove label
- `--parent <id>` - Set parent issue

### close

Close a completed issue.

```bash
tbd close proj-a7k2                           # Close issue
tbd close proj-a7k2 --reason="Fixed in PR #42"
```

Options:
- `--reason <text>` - Reason for closing

### reopen

Reopen a closed issue.

```bash
tbd reopen proj-a7k2                          # Reopen issue
tbd reopen proj-a7k2 --reason="Bug reappeared"
```

Options:
- `--reason <text>` - Reason for reopening

### ready

List issues ready to work on (open, unblocked, unassigned).

```bash
tbd ready                                   # All ready issues
tbd ready --type=bug                        # Ready bugs
tbd ready --limit=5                         # Top 5 ready issues
tbd ready --long                            # Show descriptions
```

Options:
- `--type <type>` - Filter by type
- `--limit <n>` - Limit results
- `--long` - Show issue descriptions

### blocked

List issues that are blocked by dependencies.

```bash
tbd blocked                                 # All blocked issues
tbd blocked --limit=10                      # Limit results
tbd blocked --long                          # Show descriptions
```

Options:
- `--limit <n>` - Limit results
- `--long` - Show issue descriptions

### stale

List issues not updated recently.

```bash
tbd stale                                   # Not updated in 7 days
tbd stale --days=30                         # Not updated in 30 days
tbd stale --status=open                     # Only open stale issues
tbd stale --limit=20                        # Limit results
```

Options:
- `--days <n>` - Days since last update (default: 7)
- `--status <status>` - Filter by status (default: open, in_progress)
- `--limit <n>` - Limit results

### label

Manage issue labels.

```bash
tbd label add proj-a7k2 urgent               # Add single label
tbd label add proj-a7k2 backend api          # Add multiple labels
tbd label remove proj-a7k2 urgent            # Remove label
tbd label list                             # List all labels in use
```

Subcommands:
- `add <id> <labels...>` - Add labels to an issue
- `remove <id> <labels...>` - Remove labels from an issue
- `list` - List all labels currently in use

### dep

Manage issue dependencies.

**Semantics:** `tbd dep add A B` means “A depends on B” (B must complete before A can
start).

```bash
# proj-b3m9 depends on proj-a7k2 (a7k2 must be done first)
tbd dep add proj-b3m9 proj-a7k2
# Output: ✓ proj-b3m9 now depends on proj-a7k2

# Remove dependency
tbd dep remove proj-b3m9 proj-a7k2

# List what blocks/is blocked by an issue
tbd dep list proj-a7k2
# Output shows "Blocks:" and "Blocked by:" sections
```

Subcommands:
- `add <issue> <depends-on>` - Issue depends on depends-on (depends-on blocks issue)
- `remove <issue> <depends-on>` - Remove dependency
- `list <id>` - List dependencies for an issue (what it blocks and what blocks it)

### sync

Synchronize issues with remote repository.

```bash
tbd sync                                    # Full sync (pull + push)
tbd sync --status                           # Check sync status
tbd sync --pull                             # Pull only
tbd sync --push                             # Push only
tbd sync --force                            # Force sync (overwrite conflicts)
```

Options:
- `--push` - Push local changes only
- `--pull` - Pull remote changes only
- `--status` - Show sync status without syncing
- `--force` - Force sync, overwriting conflicts

### search

Search issues by text content.

```bash
tbd search "login"                          # Search all fields
tbd search "auth" --field=title             # Search only titles
tbd search "TODO" --field=notes             # Search working notes
tbd search "api" --status=open              # Filter by status
tbd search "bug" --limit=10                 # Limit results
tbd search "Error" --case-sensitive         # Case-sensitive search
```

Options:
- `--status <status>` - Filter by status
- `--field <field>` - Search specific field: title, description, notes, labels
- `--limit <n>` - Limit results
- `--no-refresh` - Skip worktree refresh
- `--case-sensitive` - Case-sensitive search

### stats

Show repository statistics.

```bash
tbd stats                                   # Show statistics
tbd stats --json                            # JSON output
```

Displays: issue counts by status, type, priority, and label.

### doctor

Diagnose and repair repository issues.

```bash
tbd doctor                                  # Check for problems
tbd doctor --fix                            # Attempt to fix issues
```

Options:
- `--fix` - Attempt to automatically fix detected issues

### config

Manage tbd configuration.

```bash
tbd config show                             # Show all config
tbd config get display.id_prefix            # Get specific value
tbd config set display.id_prefix "tk"       # Set value
```

Subcommands:
- `show` - Show all configuration
- `get <key>` - Get a configuration value
- `set <key> <value>` - Set a configuration value

Common config keys:
- `display.id_prefix` - ID prefix (required, set during init or import)
- `sync.branch` - Sync branch name
- `sync.remote` - Remote name

### attic

Manage conflict archive.
When sync conflicts occur, the losing values are preserved in the attic for recovery.

```bash
tbd attic list                              # List all attic entries
tbd attic list proj-a7k2                      # Entries for specific issue
tbd attic show proj-a7k2 2025-01-15T10:30:00Z # Show specific entry
tbd attic restore proj-a7k2 2025-01-15T10:30:00Z # Restore from attic
```

Subcommands:
- `list [id]` - List attic entries (optionally for specific issue)
- `show <id> <timestamp>` - Show attic entry details
- `restore <id> <timestamp>` - Restore a value from the attic

### import

Import issues from Beads or JSONL file.

```bash
tbd import issues.jsonl                     # Import from JSONL file
tbd import --from-beads                     # Import directly from Beads
tbd import --from-beads --beads-dir=~/.beads # Custom Beads directory
tbd import issues.jsonl --merge             # Merge with existing
tbd import --validate                       # Validate existing import
tbd import issues.jsonl --verbose           # Show detailed progress
```

Options:
- `--from-beads` - Import directly from Beads database
- `--beads-dir <path>` - Beads data directory
- `--merge` - Merge with existing issues instead of skipping duplicates
- `--verbose` - Show detailed import progress
- `--validate` - Validate existing import against Beads source

### beads

Beads migration utilities.

```bash
tbd setup beads                             # Show usage
tbd setup beads --disable                   # Preview what will be moved
tbd setup beads --disable --confirm         # Actually disable Beads
```

The `--disable` option safely moves all Beads files to `.beads-disabled/`:
- `.beads/` → `.beads-disabled/beads/`
- `.beads-hooks/` → `.beads-disabled/beads-hooks/`
- `.cursor/rules/beads.mdc` → `.beads-disabled/cursor-rules-beads.mdc`
- Removes `bd` hooks from `.claude/settings.local.json` (with backup)
- Removes Beads section from `AGENTS.md` (with backup)

This preserves all data for potential rollback.
To restore Beads, move files back from `.beads-disabled/`.

### status

Show repository status.
Works even when tbd is not initialized.

```bash
tbd status                                  # Show repo status
tbd status --json                           # JSON output
```

Displays: initialization state, sync status, issue counts, detected integrations.

When not initialized, detects Beads and suggests migration:
```
Not a tbd repository.

Detected:
  ✓ Git repository (main branch)
  ✓ Beads repository (.beads/ with 142 issues)

To get started:
  tbd import --from-beads   # Migrate from Beads
  tbd init                  # Start fresh
```

### prime

Output workflow context for AI agents.
Called automatically by Claude Code hooks.

```bash
tbd prime                                   # Output workflow context
tbd prime --export                          # Output default (ignores PRIME.md)
```

Behavior:
- Silent exit (code 0) if not in a tbd project
- Custom output: create `.tbd/PRIME.md` to override default content

### setup

Configure editor and agent integrations.

```bash
tbd setup claude                            # Install Claude Code hooks
tbd setup claude --check                    # Verify installation status
tbd setup claude --remove                   # Remove tbd hooks

tbd setup cursor                            # Create Cursor rules file
tbd setup cursor --check                    # Verify Cursor rules
tbd setup cursor --remove                   # Remove Cursor rules

tbd setup codex                             # Create/update AGENTS.md
tbd setup codex --check                     # Verify AGENTS.md
tbd setup codex --remove                    # Remove tbd section from AGENTS.md

tbd setup auto                              # Auto-detect and configure all integrations
tbd setup beads --disable                   # Disable Beads (for migration)
```

### Documentation Commands

Built-in documentation viewers:

```bash
tbd readme                                  # Display README (same as GitHub landing page)
tbd docs                                    # Display CLI reference documentation
tbd docs --list                             # List available documentation sections
tbd design                                  # Display design documentation
tbd design --list                           # List design doc sections
tbd closing                                 # Display session closing protocol reminder
```

### uninstall

Remove tbd from a repository.

```bash
tbd uninstall --confirm                     # Remove tbd (requires --confirm)
tbd uninstall --confirm --keep-branch       # Keep local sync branch
tbd uninstall --confirm --remove-remote     # Also remove remote sync branch
```

Options:
- `--confirm` - Required to proceed with removal
- `--keep-branch` - Keep the local sync branch
- `--remove-remote` - Also remove the remote sync branch

## Global Options

These options work with any command:

```bash
tbd list --json                             # JSON output
tbd list --quiet                            # Suppress non-essential output
tbd list --verbose                          # Enable verbose output
tbd create "Test" --dry-run                 # Show what would happen
tbd close proj-a7k2 --no-sync                 # Skip automatic sync
tbd list --debug                            # Show internal IDs
tbd update proj-a7k2 --yes                    # Assume yes to prompts
tbd list --non-interactive                  # Fail if input required
tbd list --color=never                      # Disable colors
```

Options:
- `--version` - Show version number
- `--dry-run` - Show what would be done without making changes
- `--verbose` - Enable verbose output
- `--quiet` - Suppress non-essential output
- `--json` - Output as JSON
- `--color <when>` - Colorize output: auto, always, never
- `--non-interactive` - Disable all prompts, fail if input required
- `--yes` - Assume yes to confirmation prompts
- `--no-sync` - Skip automatic sync after write operations
- `--debug` - Show internal IDs alongside display IDs

## For AI Agents

tbd is designed for AI coding agents.
This section covers agent-specific patterns.

### Agent Workflow Loop

```bash
tbd ready --json                            # Find available work
tbd update proj-xxxx --status=in_progress     # Claim it (advisory)
# ... do the work ...
tbd close proj-xxxx --reason="Fixed in commit abc123"
tbd sync                                    # Push changes
```

### Agent-Friendly Flags

| Flag | Purpose |
| --- | --- |
| `--json` | Machine-parseable output |
| `--non-interactive` | Fail if input required (auto-enabled in CI) |
| `--yes` | Auto-confirm prompts |
| `--dry-run` | Preview changes before applying |
| `--quiet` | Suppress informational output |

### Actor Resolution

The actor name (for `created_by` field) is resolved in order:

1. `--actor <name>` flag
2. `TBD_ACTOR` environment variable
3. Git `user.email` from config
4. System username

```bash
TBD_ACTOR=claude-agent tbd create "Fix bug" --type=bug
```

### Claude Code Integration

Install hooks for automatic context injection:

```bash
tbd setup claude                            # One-time global setup
```

This runs `tbd prime` at session start and before context compaction, ensuring the agent
remembers the tbd workflow.

### Closing Multiple Issues

Close several issues at once (more efficient than one at a time):

```bash
tbd close proj-a1 proj-b2 proj-c3 --reason="Sprint complete"
```

## Common Workflows

### Starting a New Project

```bash
cd my-project
git init
tbd init
tbd create "Initial setup" --type=chore
```

### Daily Workflow

```bash
# Start of day - sync and find work
tbd sync
tbd ready

# Pick up an issue
tbd update proj-a7k2 --status=in_progress --assignee=myname

# Work on it...

# Add notes as you work
tbd update proj-a7k2 --notes="Found the bug in auth.ts line 42"

# Complete and sync
tbd close proj-a7k2 --reason="Fixed in commit abc123"
tbd sync
```

### Managing an Epic

```bash
# Create epic
tbd create "User Authentication System" --type=epic --priority=P1

# Create child tasks
tbd create "Design auth API" --parent=proj-epic
tbd create "Implement login endpoint" --parent=proj-epic
tbd create "Add password reset" --parent=proj-epic

# View epic and children
tbd show proj-epic
tbd list --parent=proj-epic
```

### Handling Dependencies

```bash
# Create issues
tbd create "Set up database" --type=task
tbd create "Implement API" --type=task

# API depends on database (database blocks API)
tbd dep add proj-api proj-database

# Check what's blocked
tbd blocked

# Once database is done
tbd close proj-database
tbd ready  # API now appears as ready
```

### Bug Triage

```bash
# List all open bugs by priority
tbd list --type=bug --sort=priority

# Escalate a critical bug
tbd update proj-bug1 --priority=P0 --label=critical

# Assign bugs
tbd update proj-bug1 --assignee=alice
tbd update proj-bug2 --assignee=bob
```

### Code Review Workflow

```bash
# Find stale issues (awaiting review?)
tbd stale --days=3

# Search for review-related issues
tbd search "review" --status=open
```

### Migration from Beads

```bash
# 1. Stop Beads daemon and sync
bd sync                                 # Final Beads sync

# 2. Import issues to tbd (optional, preserves history)
tbd import --from-beads --verbose       # Import all issues

# 3. Disable Beads (moves files to .beads-disabled/)
tbd setup beads --disable               # Preview what will be moved
tbd setup beads --disable --confirm     # Actually disable Beads

# 4. Install tbd integrations
tbd setup claude                        # Install Claude Code hooks
tbd setup cursor                        # Cursor rules (optional)
tbd setup codex                         # AGENTS.md section (optional)

# 5. Verify migration
tbd stats
tbd list --all
```

The `tbd setup beads --disable` command safely moves all Beads files to
`.beads-disabled/` for potential rollback, including:

- `.beads/` directory (data and config)
- `.beads-hooks/` directory (git hooks)
- `.cursor/rules/beads.mdc` (Cursor rules)
- `bd` hooks from `.claude/settings.local.json`
- Beads section from `AGENTS.md`

## File Structure

tbd stores data in the following locations:

```
my-project/
├── .tbd/
│   ├── config.yml                    # Project configuration (tracked)
│   ├── .gitignore                    # Ignores local files
│   ├── cache/                        # Local state (gitignored)
│   └── data-sync-worktree/           # Hidden worktree (gitignored)
│       └── .tbd/
│           └── data-sync/
│               ├── issues/           # Issue files (*.md)
│               ├── mappings/         # ID mappings
│               │   └── ids.yml       # Short ID → ULID mapping
│               ├── attic/            # Conflict archive
│               └── meta.yml          # Schema version
```

### Issue File Format

Each issue is stored as a Markdown file with YAML frontmatter:

```markdown
---
created_at: 2025-01-15T10:30:00Z
dependencies: []
id: is-01hx5zzkbkactav9wevgemmvrz
kind: task
labels: [backend, urgent]
priority: 2
status: open
title: Fix login bug
type: is
updated_at: 2025-01-15T10:30:00Z
version: 1
---

User reports intermittent login failures.

## Notes

Found the issue in auth.ts - race condition in token refresh.
```

## Configuration Reference

Configuration is stored in `.tbd/config.yml`:

```yaml
tbd_version: "0.1.0"

display:
  id_prefix: proj            # Prefix for display IDs (required, set during init)

sync:
  branch: tbd-sync           # Sync branch name
  remote: origin             # Remote name
  auto_sync: true            # Auto-sync after writes
```

## Priority Scale

| Value | Alias | Meaning |
| --- | --- | --- |
| 0 | P0 | Critical—drop everything |
| 1 | P1 | High—this sprint |
| 2 | P2 | Medium—soon (default) |
| 3 | P3 | Low—backlog |
| 4 | P4 | Lowest—maybe/someday |

Both formats work: `--priority=P1` or `--priority=1` (P-prefix is the canonical display
format)

## Date Formats

Commands like `--due` and `--defer` accept flexible date input:

| Format | Example | Result |
| --- | --- | --- |
| Full datetime | `2025-02-15T10:00:00Z` | Exact time (UTC) |
| Date only | `2025-02-15` | Midnight UTC |
| Relative | `+7d` | 7 days from now |
| Relative | `+2w` | 2 weeks from now |

## How Sync Works

tbd stores issues on a dedicated `tbd-sync` branch, separate from your code branches.

**Fully automatic**: Unlike Beads (where you manually `git add`/`commit`/`push` the
JSONL file), `tbd sync` handles all git operations on the sync branch automatically.
You never need to manually push issue data—just run `tbd sync` and it’s done.

**Why this matters:**
- No merge conflicts in feature branches
- Issues shared across all branches
- Clean code history (no issue churn)
- No manual git operations for issues

**Conflict handling:**
- Detection via content hash comparison
- Automatic field-level merge (last-write-wins for scalars, union for arrays)
- Lost values preserved in the attic—no data loss

**Daily usage:**
```bash
tbd sync                    # Pull + push (run at session start/end)
tbd sync --status           # Check what's pending
```

Note: Your normal `git push` is only for code changes.
Issue sync is separate and automatic.

## Troubleshooting

### Sync Issues

```bash
# Check sync status
tbd sync --status

# Force sync if conflicts
tbd sync --force

# Run diagnostics
tbd doctor
tbd doctor --fix
```

### ID Not Found

If you get “Unknown issue ID” errors:

```bash
# Verify the issue exists
tbd list --all | grep <partial-id>

# Use --debug to see internal IDs
tbd list --debug
# proj-a7k2 (is-01hx5zzkbkactav9wevgemmvrz)  Fix login bug
```

### Debugging with Internal IDs

tbd uses short display IDs (`proj-a7k2`) that map to internal ULIDs
(`is-01hx5zzkbk...`). You normally don’t need internal IDs, but they’re useful for:

```bash
# Find the actual issue file
ls .tbd/data-sync-worktree/.tbd/data-sync/issues/is-01hx5*.md

# Internal IDs sort chronologically (creation order)
ls .tbd/data-sync-worktree/.tbd/data-sync/issues/ | sort
```

### Performance

For large repositories with many issues:

```bash
# Limit results
tbd list --limit=50

# Use specific filters
tbd list --status=open --type=bug
```

## Tips

1. **Use labels for workflow states**: `needs-review`, `blocked-external`, `wontfix`

2. **Set priorities consistently**: 0=drop everything, 1=this sprint, 2=soon, 3=backlog,
   4=maybe

3. **Use epics for grouping**: Create an epic and link child tasks with `--parent`

4. **Add working notes**: Use `--notes` to track investigation progress

5. **Sync regularly**: Run `tbd sync` at start and end of work sessions

6. **Use JSON for scripting**: `tbd list --json | jq '.[] | select(.priority == 0)'`

7. **Alias for convenience**: `alias bd=tbd` for muscle memory from Beads

## Getting Help

```bash
tbd --help                    # General help
tbd <command> --help          # Command-specific help
tbd help <command>            # Alternative help syntax
```

**Project Repo**: https://github.com/jlevy/tbd
