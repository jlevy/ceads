# tbd

**Git-native issue tracking for AI agents and humans.**

**tbd** (which stands for “To Be Done” or “TypeScript beads,” depending on your
preference) is a command-line issue tracker that stores issues as files in git.

It’s ideal for AI coding agents as well as humans: simple commands, pretty console and
JSON output. It installs via `npm` and works in almost any agent or sandboxed cloud
environment.

## Why?

tbd is inspired by [Beads](https://github.com/steveyegge/beads) by Steve Yegge.
I love the power of Beads and am grateful for it!
Unfortunately, after using it heavily for about a month, I found architectural issues
and glitches that were too much of a distraction to ignore.
Things like Claude Code Cloud’s network filesystems unable to use SQLite, fighting with
the daemon modifying files in the active working tree, merge conflicts, and a confusing
4-way sync algorithm.

tbd uses a simpler architecture with (I hope) fewer edge cases and bugs.
If you want to try it, you can import issues from Beads, preserving issue IDs.
Internally, everything is Markdown files so you can debug or migrate in the future if
you wish.

## Features

- **Git-native:** Issues live in your repo, synced to a separate, dedicated `tbd-sync`
  branch. Your code history stays clean—no issue churn polluting your logs.
- **Agent friendly:** JSON output, non-interactive mode, simple commands that agents
  understand. Installs itself as a skill in Claude Code.
- **Markdown + YAML frontmatter:** One file per issue, human-readable and editable.
  This eliminates most merge conflicts.
- **Beads alternative:** `tbd` is largely compatible with `bd` at the CLI level.
  But has no JSONL merge conflicts in git.
  No daemon modifying your current working tree.
  No agents confused by error messages about which of several “modes” you’re running in.
  No SQLite file locking issues on network filesystems (like what is used by Claude Code
  Cloud).
- **Future extensions:** By keeping this CLI/API/file layer simple, I think we can more
  easily build more complex UI and coordination layers on top.
  (Hope to have more on this soon.)

> [!NOTE]
> See the [design doc](docs/tbd-design.md) (`tbd design`) or
> [reference docs](docs/tbd-docs.md) (`tbd docs`) for more details.

> [!NOTE]
> I use *Beads* (capitalized) to refer to the original `bd` tool.
> In the docs and prompts I sometimes use lowercase “beads” as a generic way to refer to
> issues stored in `tbd` or `bd`.

## Quick Start

**Requirements:**
- Node.js 20+
- Git 2.42+ (for orphan worktree support)

```bash
# Install
npm install -g tbd-git@latest

# Initialize in your repo
cd my-project
tbd setup --auto         # Full setup with auto-detection (recommended)
tbd setup --from-beads   # Migrate from existing Beads setup
tbd init --prefix=proj   # Surgical init only (advanced)

# Create issues
tbd create "API returns 500 on malformed input" --type=bug --priority=P1
tbd create "Add rate limiting to /api/upload" --type=feature
tbd list --pretty  # View issues

# Find and claim work
tbd ready                                    # What's available?
tbd update proj-a7k2 --status=in_progress    # Claim it

# Complete and sync
tbd closing  # Get a reminder of the closing protocol (this is also in the skill docs)
tbd close proj-a7k2 --reason="Fixed in commit abc123"
tbd sync
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
tbd setup --auto             # Recommended: full setup including Claude hooks
tbd setup claude             # Install Claude hooks only
```

This configures a SessionStart hook that runs `tbd prime` at session start, injecting
workflow context so the agent remembers to use tbd.

## Documentation

```bash
tbd readme                   # This file
tbd docs                     # Full CLI reference
```

Or read online:
- [CLI Reference](docs/tbd-docs.md) — Complete command documentation
- [Design Doc](docs/tbd-design.md) — Technical architecture

## Migration from Beads

```bash
# Recommended: full setup with migration
tbd setup --auto             # Auto-detects beads and migrates

# Or explicit migration
tbd setup --from-beads       # Migrate from beads with full setup

# Verify
tbd stats
tbd list --all

# If you wish to disable beads after migration
tbd setup beads --disable
```

Issue IDs are preserved: `proj-123` in beads becomes `proj-123` in tbd.
The prefix from your beads configuration is automatically used.

## How It Works

tbd stores issues on a dedicated `tbd-sync` branch, separate from your code.
One file per issue means parallel creation never conflicts.
Run `tbd sync` to push changes—no manual git operations needed for issues.
See the [design doc](docs/tbd-design.md) for details.

## Contributing

See [docs/development.md](docs/development.md) for build and test instructions.

## License

MIT
