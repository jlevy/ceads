# tbd Design

Git-native issue tracking for AI agents and humans.

> [!NOTE]
> This is a design document (`tbd design`). See the tbd readme (`tbd readme`) or
> reference docs (`tbd docs`) for general documentation.

## Overview

**tbd** (“To Be Done” or “TypeScript Beads”) is a git-native issue tracker designed for
simplicity and reliability.
It stores issues as Markdown files with YAML frontmatter on a dedicated sync branch,
enabling conflict-free collaboration without daemons or databases.

tbd is the **durable persistence layer** for issues, with four core principles:

- Durable storage in git
- Works in almost any environment
- Simple, self-documenting CLI for agents and humans
- Transparent internal format (Markdown/YAML that is debuggable and friendly to other
  tooling)

It does *not* aim to be a full solution for real-time agent coordination.
Git works best when latency is seconds, not milliseconds and volume is thousands of
issues, not millions.
Real-time agent coordination (such as used by Agent Mail, Gas Town) is a separate
problem—one that can be layered on top of tbd or handled by other tools.

**Related Projects**:

- [Beads](https://github.com/steveyegge/beads) - The original git-backed issue tracker
  tbd is designed to replace
- [ticket](https://github.com/wedow/ticket) - Bash-based Markdown+YAML tracker (~1900
  tickets in production)
- [git-bug](https://github.com/git-bug/git-bug) - Issues stored as git objects
- [git-issue](https://github.com/dspinellis/git-issue) - Shell-based with optional
  GitHub sync
- [ULID spec](https://github.com/ulid/spec) - Universally Unique Lexicographically
  Sortable Identifier

## Motivation

Agents perform *far* better when they can track tasks reliably and stay organized.
Sometimes they can use external issue trackers (GitHub Issues, Linear, Jira), but as
Beads has shown, there is great benefit to lightweight tracking of tasks via CLI.

tbd addresses specific requirements:

| Requirement | Solution |
| --- | --- |
| Works in cloud sandboxes like Claude Code Cloud | Easy setup, no daemon or SQLite, which is incompatible with some network drives |
| Git commit log noise | Issues stored on separate `tbd-sync` branch |
| Synchronized state across Git branches | Always sync from the `tbd-sync` branch |
| Git merging conflicts | One file per issue eliminates most merge conflicts |
| Agent-friendly | Self-documenting, skill-compatible, non-interactive, simple commands |
| Transparent formats | Issues internally are Markdown files with YAML frontmatter |
| Reliable | Clear specs, golden testing of end-to-end use scenarios |

## Architecture

### Three-Layer Design

```
┌─────────────────────────────────────────────────────────────┐
│  CLI Layer     tbd <command> [args] [options]               │
│                Agent and human interface                    │
└─────────────────────────────┬───────────────────────────────┘
                              │
┌─────────────────────────────┼───────────────────────────────┐
│  Git Layer     tbd-sync branch │ fetch/push │ merge         │
│                Distributed sync via standard git            │
└─────────────────────────────┬───────────────────────────────┘
                              │
┌─────────────────────────────┼───────────────────────────────┐
│  File Layer    Markdown+YAML │ Zod schemas │ atomic writes  │
│                Human-readable storage format                │
└─────────────────────────────────────────────────────────────┘
```

### Data Locations

tbd has **3 data locations** (2 synced, 1 local-only):

| Location | Contents | Synced? |
| --- | --- | --- |
| `.tbd/config.yml` | Configuration | Yes (on main branch) |
| `.tbd/data-sync-worktree/.tbd/data-sync/issues/*.md` | Issue files | Yes (on `tbd-sync` branch) |
| `.tbd/cache/` | Local state, index, sync lock | No (gitignored) |

The hidden worktree provides read access to the sync branch without affecting your
working checkout, enabling direct file access and search across all issues.

The cache directory (`.tbd/cache/`) stores local-only data that is never synced:
- `state.yml` — last sync timestamp
- `sync.lock` — prevents concurrent sync operations

### Configuration

The `.tbd/config.yml` file (tracked on main branch) defines project settings:

```yaml
tbd_version: "1.0.0"

sync:
  branch: tbd-sync    # Branch name for synced data
  remote: origin      # Git remote

display:
  id_prefix: tbd      # Prefix for display IDs (e.g., tbd-a1b2)

settings:
  auto_sync: false    # Auto-sync after write operations
```

The `display.id_prefix` is required and set during `tbd init --prefix=<name>` or
auto-detected from Beads during `tbd import --from-beads`.

### Issue File Format

Issues use the standard Markdown + YAML frontmatter pattern (same as Jekyll, Hugo,
Astro):

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
labels: [backend, security]
dependencies:
  - target: is-01hx5zzkbkbctav9wevgemmvrz
    type: blocks
parent_id: null
created_at: 2025-01-07T10:00:00Z
updated_at: 2025-01-08T14:30:00Z
created_by: bob
closed_at: null
close_reason: null
due_date: 2025-01-15T00:00:00Z
deferred_until: null
extensions: {}
---

Users are being logged out after 5 minutes of inactivity.

## Notes

Found the issue in session.ts line 42.
```

**Field summary** (all fields shown above):

| Field | Required | Description |
| --- | --- | --- |
| type | Yes | Entity discriminator, always `is` for issues |
| id | Yes | Internal ULID-based ID |
| version | Yes | Edit counter for merge resolution |
| kind | Yes | Issue type: bug, feature, task, epic, chore |
| title | Yes | Issue title (1-500 chars) |
| status | Yes | open, in_progress, blocked, deferred, closed |
| priority | Yes | 0 (critical) to 4 (backlog), default 2 |
| assignee | No | Who is working on this |
| labels | No | Array of string tags |
| dependencies | No | Array of `{type, target}` objects |
| parent_id | No | Parent issue ID for hierarchies |
| created_at | Yes | ISO8601 creation timestamp |
| updated_at | Yes | ISO8601 last update timestamp |
| created_by | No | Who created this issue |
| closed_at | No | When closed (set automatically) |
| close_reason | No | Why it was closed |
| due_date | No | Target completion date |
| deferred_until | No | Don't show in `ready` until this date |
| extensions | No | Third-party metadata namespace |

### ID System

tbd uses a dual ID system:

| ID Type | Format | Purpose |
| --- | --- | --- |
| Internal | `is-{ulid}` | Time-ordered, collision-free, used in file storage |
| Display | `{prefix}-{base36}` | Human-friendly (e.g., `bd-a7k2`), used in CLI |

[ULIDs](https://github.com/ulid/spec) provide time-ordered sorting and 80-bit randomness
for collision-free generation across distributed systems.

### Sync Mechanism

**Basic flow** (all handled automatically by `tbd sync`):

1. **Commit local changes**: Stage and commit worktree files to `tbd-sync` branch
2. **Push to remote**: Push to sync branch
3. **If push rejected** (remote has changes): fetch, update worktree, re-commit, retry

**Key difference from Beads**: With tbd, you never manually `git push` issue data.
The `tbd sync` command handles all git operations on the sync branch automatically.
Your normal `git push` is only for code changes on your working branch.

**Why most syncs are trivial**:

The file-per-entity design means parallel work rarely conflicts at the git level:

| Scenario | Git behavior | tbd behavior |
| --- | --- | --- |
| A creates issue-1, B creates issue-2 | Different files, trivial merge | Both issues preserved |
| A modifies issue-1, B creates issue-2 | Different files, trivial merge | Both changes preserved |
| A and B both modify issue-1 | Same file modified | Field-level merge (see below) |

**Field-level merge** (when same issue modified by multiple agents):

| Strategy | Fields | Behavior |
| --- | --- | --- |
| Immutable | id, type, created_at, created_by | Never change after creation |
| LWW | title, status, priority, kind, description, notes, assignee, parent_id, due_date, deferred_until, closed_at, close_reason, extensions | Last-write-wins by `updated_at` timestamp |
| Union | labels, dependencies | Combine arrays, deduplicate |
| Max+1 | version | `max(local, remote) + 1` |

Conflicts are recorded and losing values can be recovered from the attic.

**Safety**: All sync operations use an isolated git index (`GIT_INDEX_FILE`), never
touching your staged files.

The sync branch architecture keeps issues separate from code, avoiding merge conflicts
on feature branches and working with protected main branches.

## Design Decisions

### Decision 1: File-per-entity vs JSONL

**Choice**: One Markdown file per issue

**Rationale**:
- Parallel creation has zero conflicts (two agents creating issues simultaneously never
  conflict)
- Git diffs are readable (see exactly what changed in an issue)
- Atomic updates per issue (no read-modify-write on shared file)
- Scales naturally (no need to parse entire file for one issue)

**Tradeoff**: More files to manage, slightly more I/O for bulk operations.

### Decision 2: No Daemon Required

**Choice**: CLI-only, optional background sync

**Rationale**:
- Simpler architecture with fewer failure modes
- Works in restricted environments (CI, cloud sandboxes, containers)
- No daemon conflicts with manual git operations
- Explicit `tbd sync` is predictable

**Tradeoff**: No real-time sync; requires explicit sync commands.

### Decision 3: Sync Branch Architecture

**Choice**: Dedicated `tbd-sync` branch separate from code branches

**Rationale**:
- No merge conflicts between issues and code on feature branches
- Clean separation of concerns (issues don’t pollute code history)
- Easy to allow-list in sandboxed environments (push to `tbd-sync` only)
- Issues automatically shared across all code branches

**Tradeoff**: Requires understanding the two-branch model.

### Decision 4: Markdown + YAML Format

**Choice**: Standard frontmatter format (Jekyll/Hugo compatible)

**Rationale**:
- Human-readable and editable in any text editor
- Mature tooling ecosystem for parsing
- Diffable in git (YAML changes are clear)
- Description and notes are natural Markdown

**Prior Art**: [ticket](https://github.com/wedow/ticket) demonstrated this approach
scales to ~1900 issues in production.

### Decision 5: Hidden Worktree

**Choice**: Git worktree in `.tbd/data-sync-worktree/` for sync branch access

**Rationale**:
- Enables direct file access for search across all issues
- No checkout switching needed
- Files are always accessible (no git plumbing required)
- Worktree is gitignored (not tracked on main)
- Future: enables ripgrep/grep search for performance optimization

**Tradeoff**: Requires Git 2.42+ for `--orphan` worktree support.

### Decision 6: Only “blocks” Dependencies

**Choice**: Support only `blocks` dependency type with “depends on” CLI semantics.

**CLI semantics** (matches Beads):
- `tbd dep add A B` means “A depends on B” (equivalently, “B blocks A”)
- A cannot start until B is completed
- Output: `✓ A now depends on B`

**Data model**:
- When `tbd dep add A B` is run, the dependency is stored on issue B (the blocker)
- B’s file contains: `dependencies: [{type: 'blocks', target: A}]`
- Read as: “B blocks A” — stored on B, pointing to A (the issue being blocked)
- This enables efficient “what does this issue block?”
  queries by reading one file

**Rationale**:
- Covers the primary use case (the `ready` command needs to know what’s blocked)
- Simpler implementation
- Can add `related`, `discovered-from`, etc.
  later without breaking changes

**Tradeoff**: Can’t express all relationship types.

## tbd vs Beads

tbd is designed as a simpler alternative to
[Beads](https://github.com/steveyegge/beads).
This section details what’s different and why.

### Architecture Comparison

| Aspect | Beads | tbd |
| --- | --- | --- |
| Data locations | 4 (SQLite, JSONL, sync branch, main) | 2 (config on main, issues on sync) |
| Storage format | SQLite database + JSONL export | Markdown files |
| Background daemon | Required for real-time sync | Not required |
| Issue format | JSON Lines (one line per issue) | One file per issue |
| Merge conflicts | Common on parallel creation | Zero on parallel creation |
| State inspection | SQLite queries required | `cat` the files |
| Network filesystems | SQLite locking issues | Atomic file writes work |
| Search | SQLite FTS indexes | In-memory scan (ripgrep planned) |

### Pain Points Addressed

#### 1. Four-Location Data Sync

**Beads**: Data flows through SQLite → Local JSONL → Sync Branch → Main Branch.
Each transition can fail or desync, creating mystery state.

**tbd**: Only 2 locations.
Config on main, issues on sync branch.
The files are the truth.

#### 2. Daemon Conflicts

**Beads**: Background daemon required for real-time sync.
Can fight manual git operations, leading to confusing state.
Doesn’t work in containers or sandboxes.

**tbd**: No daemon. `tbd sync` is explicit and predictable.
Works in any environment where git works.

#### 3. Manual Git Operations for Issues

**Beads**: After creating/updating issues, you must manually `git add`, `git commit`,
and `git push` the JSONL file.
Easy to forget, leading to lost work or desync.

**tbd**: `tbd sync` handles everything automatically.
One command commits and pushes to the sync branch.
No manual git operations for issues.

#### 4. JSONL Merge Conflicts

**Beads**: All issues in one `issues.jsonl` file.
Two agents creating issues simultaneously produce a merge conflict requiring manual
resolution.

**tbd**: One file per issue.
Parallel creation never conflicts.
Git handles file-level isolation naturally.

#### 5. SQLite on Network Filesystems

**Beads**: SQLite has documented issues with NFS and SMB due to file locking semantics.
Users on network home directories experience corruption or hangs.

**tbd**: Atomic file writes (write to temp, rename).
Works on any filesystem that supports basic POSIX operations.

#### 6. Debug Difficulty

**Beads**: When sync fails, debugging requires: query SQLite, check JSONL, compare
branches, check daemon logs.
State is spread across multiple representations.

**tbd**: Everything is Markdown files.
`cat`, `grep`, `git log`, `git diff` are all you need.

#### 7. Session Closing Protocol Complexity

**Beads `bd prime`**: 432 lines of Go with 5 conditional code paths:
1. Stealth/Local-only mode
2. Daemon auto-syncing mode
3. Ephemeral branch mode
4. No-push mode
5. Standard mode

Agents may not know which mode they’re in, leading to incorrect behavior.

**tbd `tbd prime`**: 131 lines of TypeScript with 1 code path.
One protocol, always the same:

```
1. git status
2. git add <files>
3. tbd sync
4. git commit -m "..."
5. tbd sync
6. git push
```

### Feature Comparison

| Feature | Beads | tbd | Notes |
| --- | --- | --- | --- |
| Issue CRUD | ✅ | ✅ | Full parity |
| Labels | ✅ | ✅ | Full parity |
| Dependencies | ✅ | ⚠️ | Only `blocks` type |
| Search | ✅ | ✅ | Full parity |
| Sync | ✅ | ✅ | Different mechanism |
| Agent hooks | ✅ | ✅ | `setup claude` command |
| Tree view (`--pretty`) | ✅ | ✅ | Parent-child hierarchy display |
| Daemon | Required | Not needed | Major simplification |
| SQLite | Yes | No | Files instead |
| Molecules/Wisps | ✅ | ❌ | Intentionally omitted |
| Agent Mail | ✅ | ❌ | Use issue comments instead |
| `bd edit` | ✅ | ❌ | Opens $EDITOR, blocks agents |
| `bd graph` | ✅ | ❌ | Execution layer visualization |
| `bd dep tree` | ✅ | ❌ | Dependency tree with directions |

### Intentionally Omitted Features

tbd handles durable persistence.
Real-time coordination is a separate layer.

| Feature | Why Omitted |
| --- | --- |
| Daemon | Adds failure modes; explicit sync is sufficient for async workflows |
| Agent Mail | Real-time messaging requires sub-second latency; out of scope |
| Molecules/Wisps | Workflow orchestration can use tbd as storage backend |
| Real-time claims | Atomic claims require coordination service; advisory claims work for async |
| `bd edit` | Opens $EDITOR; blocks non-interactive agents |

### Migration Path

```bash
# 1. Final Beads sync
bd sync

# 2. Import to tbd
tbd import --from-beads --verbose

# 3. Disable Beads (moves files to .beads-disabled/)
tbd setup beads --disable                     # Preview
tbd setup beads --disable --confirm           # Execute

# 4. Install tbd integrations
tbd setup claude                        # Claude Code hooks

# 5. Verify
tbd stats
tbd list --all
```

The `tbd setup beads --disable` command safely moves all Beads files to
`.beads-disabled/` including `.beads/`, `.beads-hooks/`, Cursor rules, removes bd hooks
from Claude settings, and removes beads merge driver lines from `.gitattributes`. This
preserves data for potential rollback.

Import preserves:
- Issue IDs (numeric portion preserved, prefix from config)
- All fields (status, priority, labels, assignee, etc.)
- Dependencies (blocks relationships)
- Original Beads ID in `extensions.beads.original_id`

## CLI Command Reference

### Core Commands

| Command | Description |
| --- | --- |
| `tbd create <title>` | Create a new issue |
| `tbd list` | List issues (excludes closed by default) |
| `tbd show <id>` | Show issue details |
| `tbd update <id>` | Update issue fields |
| `tbd close <id>` | Close an issue |
| `tbd reopen <id>` | Reopen a closed issue |

### Discovery Commands

| Command | Description |
| --- | --- |
| `tbd ready` | Issues ready to work (open, unblocked, unassigned) |
| `tbd blocked` | Issues blocked by dependencies |
| `tbd stale [--days N]` | Issues not updated recently (default: 7 days) |
| `tbd search <pattern>` | Full-text search across all issues |

### Organization Commands

| Command | Description |
| --- | --- |
| `tbd label add <id> <label>` | Add label to issue |
| `tbd label remove <id> <label>` | Remove label from issue |
| `tbd label list` | List all labels in use |
| `tbd dep add <issue> <depends-on>` | Add dependency (issue depends on depends-on) |
| `tbd dep remove <issue> <depends-on>` | Remove dependency |

### Sync and Maintenance

| Command | Description |
| --- | --- |
| `tbd sync` | Sync with remote (pull then push) |
| `tbd sync --status` | Show pending local/remote changes |
| `tbd status` | Repository status and health check |
| `tbd stats` | Issue statistics (counts by status, type, priority) |
| `tbd doctor` | Diagnose and fix problems |

### Attic Commands

The attic preserves values lost during merge conflicts:

| Command | Description |
| --- | --- |
| `tbd attic list` | List preserved conflict entries |
| `tbd attic show <entry-id>` | Show details of a conflict entry |
| `tbd attic restore <entry-id>` | Restore a lost value |

## Agent Integration

### Context Recovery

The `tbd prime` command outputs workflow context for AI agents.
It’s designed to be called by hooks at session start and before context compaction.

```bash
tbd setup claude   # Install SessionStart and PreCompact hooks
```

The prime output includes:
- Session close protocol (the 6-step checklist)
- Core commands reference
- Common workflow examples

### Setup Commands

tbd provides setup commands for different environments:

| Command | Description |
| --- | --- |
| `tbd setup claude` | Install Claude Code hooks (SessionStart, PreCompact) |
| `tbd setup cursor` | Create Cursor IDE rules file (`.cursor/rules/tbd.mdc`) |
| `tbd setup codex` | Create/update AGENTS.md for OpenAI Codex |
| `tbd setup beads --disable` | Migrate from Beads (moves `.beads/` to `.beads-disabled/`) |
| `tbd setup auto` | Auto-detect and configure all available integrations |

### Agent-Friendly Design

| Feature | Implementation |
| --- | --- |
| Machine output | `--json` flag on all commands |
| Non-interactive | `--non-interactive` flag fails if input needed |
| Dry run | `--dry-run` previews changes |
| Actor identity | `TBD_ACTOR` environment variable |
| Batch close | `tbd close bd-a bd-b bd-c` |

## Performance

Tested benchmarks on realistic workloads:

| Operation | Measured | Target | Notes |
| --- | --- | --- | --- |
| Write 100 issues | 14ms/issue | <30ms | Includes file I/O |
| List 1000 issues | 1.4s | <2s | Full file scan |
| Read single issue | 1.2ms | <5ms | Direct file access |
| Filter 1000 issues | 0.4ms | <50ms | In-memory after load |

## Technical Requirements

- **Node.js**: 18+
- **Git**: 2.42+ (for `--orphan` worktree support)
- **Platform**: macOS, Linux, Windows

## Future Considerations

Explicitly deferred to keep initial release simple:

| Feature | Status |
| --- | --- |
| Additional dependency types (`related`, `discovered-from`) | Planned |
| GitHub Issues bidirectional sync | Under consideration |
| Real-time presence/heartbeats | Deferred |
| TUI/GUI interfaces | Deferred |
| Workflow automation | Deferred |
| Custom fields | Deferred |

Philosophy: Ship a small, reliable core first; add complexity only when proven
necessary.

## References

- **Project Repo**: https://github.com/jlevy/tbd
- **README**: `tbd readme`
- **CLI Documentation**: `tbd docs`
- **Full Design Spec**:
  [docs/project/architecture/current/tbd-design-spec.md](project/architecture/current/tbd-design-spec.md)
- **Beads**: https://github.com/steveyegge/beads
- **ticket**: https://github.com/wedow/ticket
- **ULID Spec**: https://github.com/ulid/spec
