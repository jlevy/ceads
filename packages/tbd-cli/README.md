# tbd-cli

Git-native issue tracking for AI agents and humans.

**tbd** (To Be Done) is a CLI tool for tracking issues in git repositories.
It’s designed as a simpler alternative to [Beads](https://github.com/steveyegge/beads)
with full CLI compatibility.

## Features

- **Git-native**: Uses a dedicated sync branch for coordination data
- **Human-readable**: Markdown + YAML front matter - directly viewable and editable
- **File-per-entity**: Each issue is a separate `.md` file for fewer merge conflicts
- **Searchable**: Hidden worktree enables fast ripgrep/grep search across all issues
- **Reliable sync**: Hash-based conflict detection with LWW merge
- **No daemon required**: Simple CLI tool, works everywhere

## Installation

```bash
npm install -g tbd-cli
# or
pnpm add -g tbd-cli
```

## Quick Start

```bash
# Initialize tbd in your repository
tbd init

# Create an issue
tbd create "Fix authentication bug" -t bug -p 1

# List all issues
tbd list

# Show an issue
tbd show bd-a1b2

# Update an issue
tbd update bd-a1b2 --status in_progress --assignee alice

# Close an issue
tbd close bd-a1b2 --reason completed

# Sync with remote
tbd sync
```

## Commands

### Issue Management

| Command | Description |
| --- | --- |
| `tbd create <title>` | Create a new issue |
| `tbd list` | List all issues |
| `tbd show <id>` | Show issue details |
| `tbd update <id>` | Update an issue |
| `tbd close <id>` | Close an issue |
| `tbd reopen <id>` | Reopen a closed issue |

### Workflow

| Command | Description |
| --- | --- |
| `tbd ready` | List issues ready to work on |
| `tbd blocked` | List blocked issues |
| `tbd stale` | List stale issues |

### Labels & Dependencies

| Command | Description |
| --- | --- |
| `tbd label add <id> <label>` | Add a label |
| `tbd label remove <id> <label>` | Remove a label |
| `tbd label list` | List all labels |
| `tbd dep add <id> <blocker-id>` | Add a dependency |
| `tbd dep remove <id> <blocker-id>` | Remove a dependency |
| `tbd dep tree [id]` | Show dependency tree |

### Sync & Search

| Command | Description |
| --- | --- |
| `tbd sync` | Sync with remote |
| `tbd sync --push` | Push local changes only |
| `tbd sync --pull` | Pull remote changes only |
| `tbd sync --status` | Show sync status |
| `tbd search <query>` | Search issues |

### Maintenance

| Command | Description |
| --- | --- |
| `tbd status` | Show repository status |
| `tbd stats` | Show issue statistics |
| `tbd doctor` | Check repository health |
| `tbd config [key] [value]` | Get/set configuration |

### Import

| Command | Description |
| --- | --- |
| `tbd import <file>` | Import from JSONL file |
| `tbd import --from-beads` | Import from Beads database |

### Attic

| Command | Description |
| --- | --- |
| `tbd attic list` | List attic entries |
| `tbd attic show <entry>` | Show attic entry |
| `tbd attic restore <entry>` | Restore from attic |

## Global Options

| Option | Description |
| --- | --- |
| `--json` | Output as JSON |
| `--dry-run` | Show what would be done |
| `--quiet` | Suppress non-essential output |
| `--verbose` | Show detailed output |

## Configuration

Configuration is stored in `.tbd/config.yml`:

```yaml
tbd_version: 1.0.0
sync:
  branch: tbd-sync
  remote: origin
display:
  id_prefix: bd
```

### Configuration Options

| Key | Default | Description |
| --- | --- | --- |
| `sync.branch` | `tbd-sync` | Branch used for sync |
| `sync.remote` | `origin` | Git remote for sync |
| `display.id_prefix` | `bd` | Prefix for display IDs |

## Issue File Format

Issues are stored as Markdown files with YAML front matter:

```markdown
---
type: is
id: is-01hx5zzkbkactav9wevgemmvrz
version: 3
kind: bug
title: Fix authentication timeout
status: in_progress
priority: 1
assignee: alice
labels:
  - backend
  - security
created_at: 2025-01-07T10:00:00Z
updated_at: 2025-01-08T14:30:00Z
---

Users are being logged out after 5 minutes of inactivity.

## Notes

Investigation shows the session TTL is hardcoded.
```

## Migration from Beads

tbd is designed as a drop-in replacement for core Beads functionality:

```bash
# Export from Beads
beads export > beads-export.jsonl

# Import to tbd
tbd import beads-export.jsonl
```

### Command Mapping

| Beads | tbd |
| --- | --- |
| `bd create` | `tbd create` |
| `bd list` | `tbd list` |
| `bd show` | `tbd show` |
| `bd update` | `tbd update` |
| `bd close` | `tbd close` |
| `bd sync` | `tbd sync` |

## For AI Agents

tbd is optimized for AI agent workflows:

```bash
# Get ready issues in JSON format
tbd ready --json

# Create and assign in one command
tbd create "Implement feature X" -t feature --assignee agent-1

# Mark as in progress
tbd update bd-xxxx --status in_progress

# Close when done
tbd close bd-xxxx --reason completed

# Sync changes
tbd sync
```

### Best Practices

1. Use `--json` for parsing output programmatically
2. Use `--dry-run` to preview changes
3. Sync frequently to avoid conflicts
4. Use labels for categorization

## Architecture

```
.tbd/                    # Config directory (tracked on main)
  config.yml             # Repository configuration
  .gitignore             # Ignores cache/local files

.tbd/data-sync/               # Hidden worktree (from tbd-sync branch)
  issues/                # Issue files
    is-{ulid}.md
  mappings/              # ID mappings
    ids.yml
  attic/                 # Conflict resolution history
```

## License

MIT
