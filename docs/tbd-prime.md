# tbd Workflow Context

> **Context Recovery**: Run `tbd prime` after compaction, clear, or new session
> Hooks auto-call this in Claude Code when .tbd/ detected

# SESSION CLOSE PROTOCOL

**CRITICAL**: Before saying "done" or "complete", you MUST run this checklist:

```
[ ] 1. git status              (check what changed)
[ ] 2. git add <files>         (stage code changes)
[ ] 3. tbd sync                (commit tbd changes)
[ ] 4. git commit -m "..."     (commit code)
[ ] 5. tbd sync                (commit any new tbd changes)
[ ] 6. git push                (push to remote)
```

**NEVER skip this.** Work is not done until pushed.

## Core Rules

- Track strategic work in tbd (multi-session, dependencies, discovered work)
- Use `tbd create` for issues, TodoWrite for simple single-session execution
- When in doubt, prefer tbd—persistence you don't need beats lost context
- Git workflow: run `tbd sync` at session end
- Session management: check `tbd ready` for available work

## Essential Commands

### Finding Work

| Command | Purpose |
| --- | --- |
| `tbd ready` | Show issues ready to work (no blockers) |
| `tbd list --status open` | All open issues |
| `tbd list --status in_progress` | Your active work |
| `tbd show <id>` | Detailed issue view with dependencies |

### Creating & Updating

| Command | Purpose |
| --- | --- |
| `tbd create "title" --type task\|bug\|feature --priority 2` | New issue (priority: 0-4, 0=critical) |
| `tbd update <id> --status in_progress` | Claim work |
| `tbd update <id> --assignee username` | Assign to someone |
| `tbd close <id>` | Mark complete |
| `tbd close <id> --reason "explanation"` | Close with reason |

### Dependencies & Blocking

| Command | Purpose |
| --- | --- |
| `tbd dep add <issue> <depends-on>` | Add dependency |
| `tbd blocked` | Show all blocked issues |
| `tbd show <id>` | See what's blocking/blocked by this issue |

### Sync & Collaboration

| Command | Purpose |
| --- | --- |
| `tbd sync` | Sync issues with remote (auto-commits and pushes to tbd-sync branch) |
| `tbd sync --status` | Check sync status without syncing |

Note: `tbd sync` handles all git operations for issues—no manual git push needed.

### Project Health

| Command | Purpose |
| --- | --- |
| `tbd stats` | Project statistics (open/closed/blocked counts) |
| `tbd doctor` | Check for issues (sync problems, health checks) |

## Common Workflows

### Starting work

```bash
tbd ready                              # Find available work
tbd show <id>                          # Review issue details
tbd update <id> --status in_progress   # Claim it
```

### Completing work

```bash
tbd close <id>    # Mark complete
tbd sync          # Push to remote
```

### Creating dependent work

```bash
tbd create "Implement feature X" --type feature
tbd create "Write tests for X" --type task
tbd dep add <tests-id> <feature-id>   # Tests depend on feature
```

## Setup Commands

| Command | Purpose |
| --- | --- |
| `tbd setup claude` | Install Claude Code hooks and skill file |
| `tbd setup cursor` | Create Cursor IDE rules file |
| `tbd setup codex` | Create/update AGENTS.md for Codex |
| `tbd setup beads --disable` | Migrate from Beads to tbd |

## Quick Reference

- **Priority levels**: 0=critical, 1=high, 2=medium (default), 3=low, 4=backlog
- **Issue types**: task, bug, feature, epic
- **Status values**: open, in_progress, closed
- **JSON output**: Add `--json` to any command for machine-readable output
