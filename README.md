# tbd

Git-native issue tracking for AI agents and humans.

**tbd** is a command-line issue tracker that stores issues as files in git.
No external services, no databases—just Markdown files you can read, search, and version
control.

Designed for AI coding agents: simple commands, JSON output, works in sandboxed cloud
environments.

## Why tbd?

- **Git-native**: Issues live in your repo, synced to a dedicated `tbd-sync` branch.
  Your code history stays clean—no issue churn polluting your logs.
- **Markdown + YAML frontmatter**: One file per issue, human-readable and editable.
  Eliminates the merge conflicts common with JSONL formats.
- **AI-agent friendly**: JSON output, non-interactive mode, simple commands that agents
  understand.
- **No SQLite, no fighting with a daemon that modifies your files**: Works on network
  filesystems (like Claude Code Cloud).
  No file locking or sync state confusions.
- **Beads alternative**: A simpler alternative to
  [Beads](https://github.com/steveyegge/beads) with an easier mental model.
  Imports from Beads and preserves issue IDs.

## Quick Start

```bash
# Install
npm install -g tbd-cli

# Initialize in your repo
cd my-project
tbd init

# Create issues
tbd create "API returns 500 on malformed input" --type=bug --priority=1
tbd create "Add rate limiting to /api/upload" --type=feature

# Find and claim work
tbd ready                                    # What's available?
tbd update proj-a7k2 --status=in_progress    # Claim it

# Complete and sync
tbd close proj-a7k2 --reason="Fixed in commit abc123"
tbd sync
```

## Installation

Requires Node.js 20+.

```bash
# Global install (recommended)
npm install -g tbd-cli

# Or run without installing
npx tbd-cli <command>
```

## Commands

### Core Workflow

```bash
tbd ready                      # Issues ready to work on (open, unblocked, unassigned)
tbd list                       # List open issues
tbd list --all                 # Include closed
tbd show proj-a7k2             # View issue details
tbd create "Title" --type=bug  # Create issue (bug/feature/task/epic/chore)
tbd update proj-a7k2 --status=in_progress
tbd close proj-a7k2            # Close issue
tbd sync                       # Sync with remote (auto-commits and pushes issues)
```

### Dependencies

```bash
tbd dep add proj-b3m9 proj-a7k2  # b3m9 is blocked by a7k2
tbd blocked                      # Show blocked issues
```

### Labels

```bash
tbd label add proj-a7k2 urgent backend
tbd label remove proj-a7k2 urgent
tbd label list                   # All labels in use
```

### Search

```bash
tbd search "authentication"
tbd search "TODO" --status=open
```

### Maintenance

```bash
tbd status                   # Repository status (works before init too)
tbd stats                    # Issue statistics
tbd doctor                   # Check for problems
tbd doctor --fix             # Auto-fix issues
```

## For AI Agents

tbd is designed for AI coding agents.

### Agent Workflow Loop

```bash
tbd ready --json                          # Find work
tbd update proj-xxxx --status=in_progress # Claim (advisory)
# ... do the work ...
tbd close proj-xxxx --reason="Done"       # Complete
tbd sync                                  # Push
```

### Agent-Friendly Flags

| Flag | Purpose |
| --- | --- |
| `--json` | Machine-parseable output |
| `--non-interactive` | Fail if input required |
| `--yes` | Auto-confirm prompts |
| `--dry-run` | Preview changes |
| `--quiet` | Minimal output |

### Claude Code Integration

```bash
tbd setup claude             # Install hooks (one-time)
```

This runs `tbd prime` at session start, injecting workflow context so the agent
remembers to use tbd.

### Actor Identity

```bash
TBD_ACTOR=claude-agent tbd create "Fix bug" --type=bug
```

Resolution order: `--actor` flag → `TBD_ACTOR` env → git user.email → system username.

## Documentation

```bash
tbd readme                   # This file
tbd docs                     # Full CLI reference
```

Or read online:
- [CLI Reference](docs/tbd-docs.md) — Complete command documentation
- [Design Doc](docs/project/architecture/current/tbd-design-spec.md) — Technical
  architecture

## Migration from Beads

```bash
# One-step migration (auto-initializes tbd, uses beads prefix)
tbd import --from-beads

# Verify
tbd stats
tbd list --all
```

Issue IDs are preserved: `proj-123` in beads becomes `proj-123` in tbd.
The prefix from your beads configuration is automatically used.

## How It Works

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

**Why a separate branch?**
- No noisy issue commits in your code history
- No conflicts across main or feature branches
- Issues shared across all branches

**Automatic sync**: Unlike Beads (where you manually `git add`/`commit`/`push` the JSONL
file), `tbd sync` handles all git operations automatically.
One command commits and pushes issues to the sync branch.
Your normal `git push` is only for code changes.

**Conflict handling:**
- Separate issues never conflict since they are separate files.
- If two agents modify the same issue at the same time, does field-level merge
  (last-write-wins for scalars, union for arrays)
- In that case lost values preserved in attic—no data loss ever

Issues have a short display ID like `proj-a7k2` (where `proj` is your project’s prefix)
but these map to unique ULID-based internal IDs for reliable sorting and storage.

## Issue File Format

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

## Contributing

See [docs/development.md](docs/development.md) for build and test instructions.

## License

MIT
