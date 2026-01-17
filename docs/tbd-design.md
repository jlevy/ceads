# tbd Design

Git-native issue tracking for AI agents and humans.

---

## Overview

**tbd** ("To Be Done" or "TypeScript Beads") is a git-native issue tracker designed for simplicity and reliability. It stores issues as Markdown files with YAML frontmatter on a dedicated sync branch, enabling conflict-free collaboration without daemons or databases.

**Core Philosophy**: Files as truth, git for sync, simplicity over features.

tbd is the **durable persistence layer** for issues: reliable git storage, transparent Markdown+YAML format, simple CLI. It is not a real-time coordination system. Latency is seconds (git operations), not milliseconds. Volume is thousands of issues, not millions. Real-time agent coordination (Agent Mail, Gas Town) is a separate problem—one that can be layered on top of tbd or handled by other tools.

**Related Projects**:
- [Beads](https://github.com/steveyegge/beads) - The original git-backed issue tracker tbd is designed to replace
- [ticket](https://github.com/wedow/ticket) - Elegant bash-based Markdown+YAML tracker (~1900 tickets in production)
- [git-bug](https://github.com/git-bug/git-bug) - Issues stored as git objects
- [git-issue](https://github.com/dspinellis/git-issue) - Shell-based with optional GitHub sync
- [ULID spec](https://github.com/ulid/spec) - Universally Unique Lexicographically Sortable Identifier

---

## Motivation

Modern development increasingly involves AI coding agents working alongside humans. Existing issue trackers either require external services (Jira, GitHub Issues) or have architectural complexity that causes friction (Beads' daemon and SQLite).

tbd addresses specific requirements:

| Requirement | Solution |
|-------------|----------|
| Works in cloud sandboxes | No daemon, no database locks |
| Parallel issue creation | One file per issue = zero merge conflicts |
| Agent-friendly | JSON output, non-interactive mode, simple commands |
| Debuggable | Everything is inspectable Markdown files |
| Context recovery | `tbd prime` restores workflow knowledge after compaction |
| Network filesystems | Atomic file writes instead of database locks |

---

## Architecture

### Three-Layer Design

```
┌─────────────────────────────────────────────────────────────┐
│  CLI Layer     tbd <command> [args] [options]               │
│                Agent and human interface                     │
└─────────────────────────────┬───────────────────────────────┘
                              │
┌─────────────────────────────┼───────────────────────────────┐
│  Git Layer     tbd-sync branch │ fetch/push │ merge         │
│                Distributed sync via standard git             │
└─────────────────────────────┬───────────────────────────────┘
                              │
┌─────────────────────────────┼───────────────────────────────┐
│  File Layer    Markdown+YAML │ Zod schemas │ atomic writes  │
│                Human-readable storage format                 │
└─────────────────────────────────────────────────────────────┘
```

### Data Locations

tbd has exactly **2 data locations**:

| Location | Contents | Branch |
|----------|----------|--------|
| `.tbd/config.yml` | Configuration | Main (tracked) |
| `.tbd/data-sync-worktree/.tbd/data-sync/issues/*.md` | Issue files | `tbd-sync` (via hidden worktree) |

The hidden worktree provides read access to the sync branch without affecting your working checkout, enabling ripgrep search across all issues.

### Issue File Format

Issues use the standard Markdown + YAML frontmatter pattern (same as Jekyll, Hugo, Astro):

```markdown
---
type: is
id: is-01hx5zzkbkactav9wevgemmvrz
version: 3
kind: bug
title: Fix authentication timeout
status: in_progress
priority: 1
labels: [backend, security]
dependencies:
  - target: is-01hx5zzkbkbctav9wevgemmvrz
    type: blocks
created_at: 2025-01-07T10:00:00Z
updated_at: 2025-01-08T14:30:00Z
---

Users are being logged out after 5 minutes of inactivity.

## Notes

Found the issue in session.ts line 42.
```

### ID System

tbd uses a dual ID system:

| ID Type | Format | Purpose |
|---------|--------|---------|
| Internal | `is-{ulid}` | Time-ordered, collision-free, used in file storage |
| Display | `{prefix}-{base36}` | Human-friendly (e.g., `bd-a7k2`), used in CLI |

[ULIDs](https://github.com/ulid/spec) provide time-ordered sorting and 80-bit randomness for collision-free generation across distributed systems.

### Sync Mechanism

1. **Local changes**: Written to hidden worktree, committed to `tbd-sync` branch
2. **Push**: Standard `git push` to remote
3. **Pull**: Fetch remote, merge with local (field-level merge, LWW)
4. **Conflict preservation**: Losing values saved to "attic" for recovery

The sync branch architecture keeps issues separate from code, avoiding merge conflicts on feature branches and working with protected main branches.

---

## Design Decisions

### Decision 1: File-per-entity vs JSONL

**Choice**: One Markdown file per issue

**Rationale**:
- Parallel creation has zero conflicts (two agents creating issues simultaneously never conflict)
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
- Clean separation of concerns (issues don't pollute code history)
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

**Prior Art**: [ticket](https://github.com/wedow/ticket) demonstrated this approach scales to ~1900 issues in production.

### Decision 5: Hidden Worktree

**Choice**: Git worktree in `.tbd/data-sync-worktree/` for sync branch access

**Rationale**:
- Enables ripgrep/grep search across all issues
- No checkout switching needed
- Files are always accessible (no git plumbing required)
- Worktree is gitignored (not tracked on main)

**Tradeoff**: Requires Git 2.42+ for `--orphan` worktree support.

### Decision 6: Only "blocks" Dependencies

**Choice**: Support only `blocks` dependency type (A blocks B = B cannot start until A is done)

**Rationale**:
- Covers the primary use case (the `ready` command needs to know what's blocked)
- Simpler implementation
- Can add `related`, `discovered-from`, etc. later without breaking changes

**Tradeoff**: Can't express all relationship types.

---

## tbd vs Beads

tbd is designed as a simpler alternative to [Beads](https://github.com/steveyegge/beads). This section details what's different and why.

### Architecture Comparison

| Aspect | Beads | tbd |
|--------|-------|-----|
| Data locations | 4 (SQLite, JSONL, sync branch, main) | 2 (config on main, issues on sync) |
| Storage format | SQLite database + JSONL export | Markdown files |
| Background daemon | Required for real-time sync | Not required |
| Issue format | JSON Lines (one line per issue) | One file per issue |
| Merge conflicts | Common on parallel creation | Zero on parallel creation |
| State inspection | SQLite queries required | `cat` the files |
| Network filesystems | SQLite locking issues | Atomic file writes work |
| Search | SQLite FTS indexes | ripgrep on worktree |

### Pain Points Addressed

#### 1. Four-Location Data Sync

**Beads**: Data flows through SQLite → Local JSONL → Sync Branch → Main Branch. Each transition can fail or desync, creating mystery state.

**tbd**: Only 2 locations. Config on main, issues on sync branch. The files are the truth.

#### 2. Daemon Conflicts

**Beads**: Background daemon required for real-time sync. Can fight manual git operations, leading to confusing state. Doesn't work in containers or sandboxes.

**tbd**: No daemon. `tbd sync` is explicit and predictable. Works in any environment where git works.

#### 3. JSONL Merge Conflicts

**Beads**: All issues in one `issues.jsonl` file. Two agents creating issues simultaneously produce a merge conflict requiring manual resolution.

**tbd**: One file per issue. Parallel creation never conflicts. Git handles file-level isolation naturally.

#### 4. SQLite on Network Filesystems

**Beads**: SQLite has documented issues with NFS and SMB due to file locking semantics. Users on network home directories experience corruption or hangs.

**tbd**: Atomic file writes (write to temp, rename). Works on any filesystem that supports basic POSIX operations.

#### 5. Debug Difficulty

**Beads**: When sync fails, debugging requires: query SQLite, check JSONL, compare branches, check daemon logs. State is spread across multiple representations.

**tbd**: Everything is Markdown files. `cat`, `grep`, `git log`, `git diff` are all you need.

#### 6. Session Close Protocol Complexity

**Beads `bd prime`**: 432 lines of Go with 5 conditional code paths:
1. Stealth/Local-only mode
2. Daemon auto-syncing mode
3. Ephemeral branch mode
4. No-push mode
5. Standard mode

Agents may not know which mode they're in, leading to incorrect behavior.

**tbd `tbd prime`**: 131 lines of TypeScript with 1 code path. One protocol, always the same:

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
|---------|-------|-----|-------|
| Issue CRUD | ✅ | ✅ | Full parity |
| Labels | ✅ | ✅ | Full parity |
| Dependencies | ✅ | ⚠️ | Only `blocks` type |
| Search | ✅ | ✅ | Full parity |
| Sync | ✅ | ✅ | Different mechanism |
| Agent hooks | ✅ | ✅ | `setup claude` command |
| Daemon | Required | Not needed | Major simplification |
| SQLite | Yes | No | Files instead |
| Molecules/Wisps | ✅ | ❌ | Intentionally omitted |
| Agent Mail | ✅ | ❌ | Use issue comments instead |
| `bd edit` | ✅ | ❌ | Opens $EDITOR, blocks agents |

### Intentionally Omitted Features

tbd handles durable persistence. Real-time coordination is a separate layer.

| Feature | Why Omitted |
|---------|-------------|
| Daemon | Adds failure modes; explicit sync is sufficient for async workflows |
| Agent Mail | Real-time messaging requires sub-second latency; out of scope |
| Molecules/Wisps | Workflow orchestration can use tbd as storage backend |
| SQLite indexes | File scan handles <10K issues; optional index layer planned for larger scale |
| Real-time claims | Atomic claims require coordination service; advisory claims work for async |
| `bd edit` | Opens $EDITOR; blocks non-interactive agents |

### Migration Path

```bash
# Final Beads sync
bd sync

# Import to tbd
tbd import --from-beads --verbose

# Verify
tbd stats
tbd list --all

# Use tbd going forward
alias bd=tbd  # Optional muscle-memory compatibility
```

Import preserves:
- Issue IDs (numeric portion preserved, prefix from config)
- All fields (status, priority, labels, assignee, etc.)
- Dependencies (blocks relationships)
- Original Beads ID in `extensions.beads.original_id`

---

## Agent Integration

### Context Recovery

The `tbd prime` command outputs workflow context for AI agents. It's designed to be called by hooks at session start and before context compaction.

```bash
tbd setup claude   # Install SessionStart and PreCompact hooks
```

The prime output includes:
- Session close protocol (the 6-step checklist)
- Core commands reference
- Common workflow examples

### Agent-Friendly Design

| Feature | Implementation |
|---------|---------------|
| Machine output | `--json` flag on all commands |
| Non-interactive | `--non-interactive` flag fails if input needed |
| Dry run | `--dry-run` previews changes |
| Actor identity | `TBD_ACTOR` environment variable |
| Batch close | `tbd close bd-a bd-b bd-c` |

---

## Performance

Tested benchmarks on realistic workloads:

| Operation | Measured | Target | Notes |
|-----------|----------|--------|-------|
| Write 100 issues | 14ms/issue | <30ms | Includes file I/O |
| List 1000 issues | 1.4s | <2s | Full file scan |
| Read single issue | 1.2ms | <5ms | Direct file access |
| Filter 1000 issues | 0.4ms | <50ms | In-memory after load |

For repositories approaching 10K+ issues, consider the future optional SQLite index layer.

---

## Technical Requirements

- **Node.js**: 18+
- **Git**: 2.42+ (for `--orphan` worktree support)
- **Platform**: macOS, Linux, Windows

---

## Future Considerations

Explicitly deferred to keep initial release simple:

| Feature | Status |
|---------|--------|
| Additional dependency types (`related`, `discovered-from`) | Planned |
| GitHub Issues bidirectional sync | Under consideration |
| Optional SQLite index layer | For 10K+ issues |
| Real-time presence/heartbeats | Deferred |
| TUI/GUI interfaces | Deferred |
| Workflow automation | Deferred |
| Custom fields | Deferred |

Philosophy: Ship a small, reliable core first; add complexity only when proven necessary.

---

## References

- **CLI Documentation**: `tbd docs` or [docs/tbd-docs.md](tbd-docs.md)
- **Full Design Spec**: [docs/project/architecture/current/tbd-design-v3.md](project/architecture/current/tbd-design-v3.md)
- **Beads**: https://github.com/steveyegge/beads
- **ticket**: https://github.com/wedow/ticket
- **ULID Spec**: https://github.com/ulid/spec
