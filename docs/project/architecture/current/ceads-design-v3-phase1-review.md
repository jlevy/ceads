# Senior Engineering Review: Ceads V3 Phase 1 Design Spec

**Reviewer:** Senior Engineering Review (LLM-assisted) **Document:**
ceads-design-v3-phase1.md **Date:** January 2025 **Status:** Comprehensive Review

* * *

## Executive Summary

The Ceads V3 Phase 1 design spec is a well-thought-out replacement for Beads that
addresses real architectural pain points.
The spec demonstrates mature engineering thinking around distributed systems, conflict
resolution, and CLI compatibility.

**Overall Assessment:** Strong design with clear scope.
Recommend proceeding with implementation after addressing the clarifications and issues
identified below.

**Key Strengths:**

- Clear separation of concerns (File/Git/CLI layers)

- Explicit conflict resolution with attic preservation

- Simpler architecture (2 locations vs 4 in Beads)

- Good Beads CLI compatibility for core workflows

**Key Concerns:**

- Use case positioning needs clarification (vs Beads advanced features)

- Some Beads commands not mapped or explicitly excluded

- A few technical gaps in the spec

* * *

## 1. Use Case Clarification

### 1.1 What Ceads IS (and IS NOT)

The spec should add a clear “Positioning” section at the top.
Based on the design:

**Ceads V3 Phase 1 IS:**

- A durable, Git-backed issue tracker for AI agents and humans

- A drop-in replacement for Beads’ core issue tracking workflows

- Optimized for: straightforward ticket tracking, async workflows, environments where
  daemon/SQLite are problematic (CI, cloud sandboxes, network filesystems)

- Simpler to debug: all state is visible in Markdown files and Git history

**Ceads V3 Phase 1 IS NOT:**

- A real-time coordination system for multiple agents

- A replacement for Beads’ advanced orchestration features (molecules, wisps, formulas)

- A replacement for Agent Mail or other real-time messaging layers

- A workflow automation engine

### 1.2 When to Use Beads vs Ceads

| Scenario | Recommended | Rationale |
| --- | --- | --- |
| Single agent, simple ticket tracking | **Ceads** | Simpler, no daemon, fewer failure modes |
| Multi-agent with async handoffs | **Ceads** | Git sync is sufficient, advisory claims work |
| Multi-agent requiring real-time coordination | **Beads** | Agent Mail, daemon-based sync, atomic claims |
| Cloud sandbox / restricted environment | **Ceads** | No daemon required, works with isolated git |
| Complex workflow orchestration | **Beads** | Molecules, wisps, formulas, bonding |
| Need ephemeral work tracking | **Beads** | Wisps (never synced, squash to digest) |
| Protected main branch | **Both** | Both support sync branch architecture |
| Debugging sync issues | **Ceads** | Markdown files are inspectable, no SQLite |
| High-performance queries on 10K+ issues | **Beads** | SQLite with indexes, faster than file scan |

### 1.3 Pros and Cons Comparison

**Ceads Advantages:**

- No daemon process to manage or debug

- No SQLite file locking issues on network filesystems

- Human-readable Markdown files (view issues with `cat`)

- Simpler mental model: files on disk = source of truth

- File-per-entity = zero merge conflicts on parallel creation

- Searchable with ripgrep without special tooling

- Works in restricted sandboxed environments

**Ceads Disadvantages:**

- No real-time coordination (polling via `cead sync`)

- No atomic claim enforcement (advisory claims only)

- No workflow templates (molecules/wisps/protos)

- No ephemeral work tracking (all work is persistent)

- Slower queries at scale (file I/O vs SQLite indexes)

- No built-in “memory decay” (compaction)

**Beads Advantages:**

- Real-time sync via daemon

- SQLite provides fast indexed queries

- Agent Mail for real-time inter-agent messaging

- Molecules/wisps for complex workflow orchestration

- Compaction for automatic cleanup of old issues

- Atomic operations via daemon RPC

**Beads Disadvantages:**

- 4-location data model is complex to debug

- Daemon can conflict with manual git operations

- SQLite doesn’t work well on NFS/SMB

- JSONL single file creates merge conflicts

- Complex worktree setup requirements

* * *

## 2. Complete Beads Command Mapping

The spec’s Appendix A is good but incomplete.
Here is a **comprehensive** mapping of ALL Beads commands based on the actual Beads CLI
source code:

### 2.1 Core Issue Commands

| Beads Command | Ceads Equivalent | Status | Notes |
| --- | --- | --- | --- |
| `bd create` | `cead create` | ✅ Full | All flags supported |
| `bd list` | `cead list` | ✅ Full | All filters supported |
| `bd show` | `cead show` | ✅ Full | Single or multiple IDs |
| `bd update` | `cead update` | ✅ Full | All flags supported |
| `bd close` | `cead close` | ✅ Full | With reason |
| `bd reopen` | `cead reopen` | ✅ Full | With reason |
| `bd ready` | `cead ready` | ✅ Full | Same algorithm |
| `bd blocked` | `cead blocked` | ✅ Full | Shows blockers |
| `bd stale` | `cead stale` | ✅ Full | Days since update |

### 2.2 Label & Dependency Commands

| Beads Command | Ceads Equivalent | Status | Notes |
| --- | --- | --- | --- |
| `bd label add` | `cead label add` | ✅ Full | Multiple IDs |
| `bd label remove` | `cead label remove` | ✅ Full | Multiple IDs |
| `bd label list` | `cead label list` | ✅ Full | All labels |
| `bd label list-all` | `cead label list` | ✅ Full | Same behavior |
| `bd dep add` | `cead dep add` | ⚠️ Partial | Only `blocks` type |
| `bd dep remove` | `cead dep remove` | ✅ Full |  |
| `bd dep tree` | `cead dep tree` | ✅ Full | Visualization |
| `bd state` | ❌ Not planned | - | Label-as-cache pattern |
| `bd set-state` | ❌ Not planned | - | Label-as-cache pattern |

### 2.3 Sync & Database Commands

| Beads Command | Ceads Equivalent | Status | Notes |
| --- | --- | --- | --- |
| `bd sync` | `cead sync` | ✅ Full | Different mechanism |
| `bd import` | `cead import` | ✅ Full | JSONL + auto-detect |
| `bd export` | `cead export` | ⏳ Phase 2 | Files are the format |
| `bd init` | `cead init` | ✅ Full | Creates sync branch |
| `bd doctor` | `cead doctor` | ✅ Full | Different checks |
| `bd stats` | `cead stats` | ✅ Full | Same output |
| `bd config` | `cead config` | ✅ Full | YAML-based |
| `bd migrate` | ❌ Not applicable | - | No SQLite to migrate |
| `bd info` | `cead info` | ✅ Full | Version, sync status, worktree health |

### 2.4 Daemon Commands (NOT INCLUDED)

| Beads Command | Ceads Equivalent | Status | Notes |
| --- | --- | --- | --- |
| `bd daemon start` | ❌ Not planned | - | No daemon in Ceads |
| `bd daemon stop` | ❌ Not planned | - |  |
| `bd daemon status` | ❌ Not planned | - |  |
| `bd daemons list` | ❌ Not planned | - |  |
| `bd daemons health` | ❌ Not planned | - |  |
| `bd daemons killall` | ❌ Not planned | - |  |
| `bd daemons logs` | ❌ Not planned | - |  |

### 2.5 Molecule/Workflow Commands (NOT INCLUDED)

| Beads Command | Ceads Equivalent | Status | Notes |
| --- | --- | --- | --- |
| `bd mol pour` | ❌ Not planned | - | Templates not in Phase 1 |
| `bd mol wisp` | ❌ Not planned | - | Ephemeral work |
| `bd mol bond` | ❌ Not planned | - | Workflow composition |
| `bd mol squash` | ❌ Not planned | - | Compress wisp to digest |
| `bd mol burn` | ❌ Not planned | - | Discard wisp |
| `bd mol wisp gc` | ❌ Not planned | - | Garbage collect |
| `bd formula list` | ❌ Not planned | - | Template listing |
| `bd mol distill` | ❌ Not planned | - | Extract template |

### 2.6 Advanced Commands (NOT INCLUDED)

| Beads Command | Ceads Equivalent | Status | Notes |
| --- | --- | --- | --- |
| `bd compact` | ⏳ Phase 2 | - | Memory decay |
| `bd compact --auto` | ⏳ Phase 2 | - | AI-powered compaction |
| `bd admin cleanup` | ⏳ Phase 2 | - | Bulk deletion |
| `bd duplicates` | ❌ Not planned | - | Duplicate detection |
| `bd merge` | ❌ Not planned | - | Merge duplicates |
| `bd restore` | `cead attic restore` | ✅ Different | Attic-based, not git history |
| `bd prime` | ❌ Not planned | - | Beads-specific priming |
| `bd diagnose` | `cead doctor` | ✅ Partial | Subset of diagnostics |
| `bd audit` | ❌ Not planned | - | Audit trail command |
| `bd activity` | ❌ Not planned | - | Activity feed |
| `bd count` | `cead stats` | ✅ Covered | Part of stats |
| `bd context` | ❌ Not planned | - | Context management |
| `bd search` | `cead search` | ✅ Full | ripgrep-based |

### 2.7 Agent-Specific Commands (NOT INCLUDED)

| Beads Command | Ceads Equivalent | Status | Notes |
| --- | --- | --- | --- |
| `bd agent register` | ⏳ Phase 2 | - | Agent registry |
| `bd agent heartbeat` | ⏳ Phase 2 | - | Presence tracking |
| `bd agent claim` | ❌ Not planned | - | Atomic claims |

### 2.8 Editor Integration Commands (NOT INCLUDED)

| Beads Command | Ceads Equivalent | Status | Notes |
| --- | --- | --- | --- |
| `bd setup claude` | ❌ Not planned | - | Claude hooks |
| `bd setup cursor` | ❌ Not planned | - | Cursor rules |
| `bd setup aider` | ❌ Not planned | - | Aider config |
| `bd setup factory` | ❌ Not planned | - | AGENTS.md |
| `bd edit` | ❌ Not planned | - | Interactive edit (human only) |

### 2.9 Comments (NOT INCLUDED in Phase 1)

| Beads Command | Ceads Equivalent | Status | Notes |
| --- | --- | --- | --- |
| `bd comment add` | ⏳ Phase 2 | - | Separate entity type |
| `bd comment list` | ⏳ Phase 2 | - |  |
| `bd comments show` | ⏳ Phase 2 | - |  |

### 2.10 `cead info` Command ✅ ADDED

The `cead info` command has been added to the spec (Section 4.9) for parity with `bd info`:

```bash
cead info [--json]

Output:
  ceads_version: 3.0.0
  sync_branch: ceads-sync
  remote: origin
  display_prefix: bd
  worktree: .ceads/.worktree/
  last_sync: 2025-01-10T10:00:00Z
  issue_count: 127
```

* * *

## 3. Technical Review

### 3.1 Spec Strengths

1. **Layer separation is clean**: File/Git/CLI layers are well-defined with clear
   responsibilities.

2. **Conflict resolution is robust**: Content-hash detection + LWW + attic preservation
   is a solid approach.
   The tie-breaker rule (prefer remote) is well-reasoned.

3. **Canonical serialization**: Specifying deterministic YAML/Markdown format for
   hashing is essential and often overlooked.

4. **Hidden worktree for search**: Using a hidden worktree at `.ceads/.worktree/` is a
   clever solution that enables ripgrep search while keeping sync branch isolated.

5. **Atomic writes**: The atomic write pattern with fsync is correct for data integrity.

6. **Extensions field**: Providing a namespace for third-party integrations is
   forward-thinking.

7. **Import design**: The multi-source import with LWW merge is well-designed for
   migration scenarios.

### 3.2 Issues and Gaps

> **Status:** ✅ All 8 issues below have been addressed in the design spec as of January 2025.

#### ISSUE 1: Missing `cead info` command ✅ RESOLVED

**Severity:** Low **Location:** Section 4 (CLI Layer) **Problem:** No equivalent to `bd
info --json` which agents use to verify database status.
**Recommendation:** Add `cead info` command showing version, sync status, worktree
health.
**Resolution:** Added `cead info` command in Section 4.9 of the design spec.

#### ISSUE 2: Worktree creation timing unclear ✅ RESOLVED

**Severity:** Medium **Location:** Section 2.6 **Problem:** The spec says worktree is
created by `cead init` or first `cead sync`, but also mentions "if ceads-sync exists."
The logic for handling fresh repos vs clones of existing ceads repos needs
clarification. **Recommendation:** Add a decision tree for worktree initialization based
on repo state.
**Resolution:** Added detailed decision tree in Section 2.6.1 covering all scenarios.

#### ISSUE 3: `--type` flag semantics ✅ RESOLVED

**Severity:** Low **Location:** Section 2.5.3, Section 5.3 **Problem:** The spec says
CLI uses `--type` flag which maps to `kind` field internally.
This is mentioned but could cause confusion.
**Recommendation:** Add explicit note in CLI section: "The `--type` flag sets the `kind`
field (not `type`, which is the entity discriminator)."
**Resolution:** Added clarifying note in Section 4.2 (Create) of the design spec.

#### ISSUE 4: Version field purpose unclear ✅ RESOLVED

**Severity:** Low **Location:** Section 2.5.1 **Problem:** The spec says version is for
"merge ordering and debugging" but also says conflicts are detected by content hash, not
version comparison. This is confusing.
**Recommendation:** Clarify that version is purely informational/debugging; it's
incremented on every change but not used for conflict detection.
**Resolution:** Added clarifying note in Section 2.5.1 of the design spec.

#### ISSUE 5: Search staleness threshold ✅ RESOLVED

**Severity:** Low **Location:** Section 4.8 **Problem:** Search auto-refreshes if
worktree is "stale (>5 minutes since last fetch)." This is arbitrary and may not match
user expectations. **Recommendation:** Make this configurable via
`settings.search_staleness_threshold` or document the rationale for 5 minutes.
**Resolution:** Added `search_staleness_minutes` config option in Section 4.8 with configurable values.

#### ISSUE 6: Missing `--include-closed` filter ✅ RESOLVED

**Severity:** Low **Location:** Section 4.4 (List) **Problem:** No explicit way to
include closed issues in list output.
Beads has this. **Recommendation:** Add `--include-closed` or document that `--status
closed` achieves this.
**Resolution:** Added `--all` flag to list command in Section 4.4 of the design spec.

#### ISSUE 7: Dependency type extensibility ✅ RESOLVED

**Severity:** Low **Location:** Section 2.5.3 **Problem:** `Dependency.type` is
`z.literal('blocks')` which is not extensible.
**Recommendation:** Change to `z.enum(['blocks'])` to allow easy addition of new types
in Phase 2 without schema migration.
**Resolution:** Changed schema to use `z.enum(['blocks'])` in Section 2.5.3.

#### ISSUE 8: Attic entry ID format undefined ✅ RESOLVED

**Severity:** Low **Location:** Section 4.11 **Problem:** `cead attic show <entry-id>`
but entry-id format is not defined.
**Recommendation:** Define entry-id format, e.g., `{entity-id}_{timestamp}_{field}` or
auto-generated UUID.
**Resolution:** Defined entry ID format as `{entity-id}/{timestamp}_{field}` in Section 4.11.

### 3.3 Open Questions Assessment

The spec’s Section 8 (Open Questions) is well-considered.
My recommendations:

| Question | Recommendation |
| --- | --- |
| V2-004: Remote vs local branch | Option 2: Update local after fetch, read from local |
| V2-012: Clock skew | Option 1 (acknowledge) + Option 3 (config override) |
| V2-016: Mapping file conflicts | Option 1: Accept single file (concurrent imports rare) |
| ID Length | Keep 6 chars; add 2 more when >10K issues (progressive) |
| Reserved directories | Option 2: Add when needed |

* * *

## 4. Recommendations

### 4.1 Spec Improvements (Before Implementation) ✅ ALL ADDRESSED

1. ✅ **Add Use Case Positioning section** (Section 1.0 or 1.1) - Added Section 1.2 "When to Use Ceads vs Beads" with comparison tables.

2. ✅ **Add complete Beads command mapping** - Added Appendix B with explicitly excluded commands.

3. ✅ **Add `cead info` command** - Added in Section 4.9.

4. ✅ **Clarify worktree initialization logic** - Added decision tree in Section 2.6.1.

5. ✅ **Fix Dependency.type schema** - Changed to z.enum in Section 2.5.3.

### 4.2 Documentation Improvements

1. **Create migration guide** - Standalone document for Beads→Ceads migration with
   worked examples.

2. **Add troubleshooting section** - Common issues and recovery procedures.

3. **Create quick reference card** - One-page command mapping for Beads users.

### 4.3 Implementation Priorities

Based on the spec, recommended implementation order:

1. **Core File Layer** - Schema definitions, canonical serialization, atomic writes

2. **Git Layer** - Sync branch creation, isolated index operations

3. **Basic CLI** - init, create, list, show, update, close

4. **Sync** - pull, push, conflict detection

5. **Advanced CLI** - ready, blocked, stale, search, label, dep

6. **Import** - Beads JSONL import with multi-source merge

7. **Maintenance** - doctor, stats, config, attic commands

* * *

## 5. Conclusion

The Ceads V3 Phase 1 design is a well-architected replacement for Beads’ core issue
tracking functionality.
The simpler architecture (no daemon, no SQLite, file-per-entity) addresses real pain
points while maintaining CLI compatibility for the most common workflows.

**The spec is ready for implementation** with the minor clarifications noted above.
The explicit scoping of Phase 1 (no molecules, no real-time coordination) is the right
call - ship a reliable core first.

**Key success criteria for implementation:**

- `cead` commands work identically to `bd` for basic issue tracking

- Import from Beads preserves all data

- Sync works reliably across multiple machines/agents

- Conflicts are detected and resolved without data loss

- Performance meets targets (<50ms common operations)

* * *

## Appendix: Features Explicitly NOT in Ceads Phase 1

For clarity, here is a consolidated list of Beads features **not** included in Ceads V3
Phase 1:

### Daemon & Real-Time

- Background daemon process

- Auto-sync on write

- RPC communication

- Daemon health monitoring

### Molecules & Workflows

- Proto templates (solid phase)

- Wisps (ephemeral issues, vapor phase)

- Pour (template instantiation)

- Bond (workflow composition)

- Squash (wisp to digest)

- Burn (wisp discard)

- Formulas (JSON compile-time macros)

### Agent Coordination

- Agent registry

- Heartbeat/presence

- Atomic claims

- Agent Mail messaging

### Advanced Operations

- AI-powered compaction

- Duplicate detection and merge

- Interactive edit (`bd edit`)

- State labels (`bd state`, `bd set-state`)

### Editor Integrations

- Claude Code hooks setup

- Cursor rules setup

- Aider config setup

- Factory.ai AGENTS.md

### Data Types (Phase 2+)

- Comments as separate entities

- Messages entity type

- Agent entity type

- Dependency types: `related`, `discovered-from`, `waits-for`, `conditional-blocks`

* * *

*End of Review*
