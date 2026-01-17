# Beads to tbd Feature Mapping

**Purpose:** Comprehensive mapping to ensure tbd provides feature parity with Beads for
LLM agent usability.

**Status:** Current (Updated after spec revisions)

* * *

## Executive Summary

tbd provides a clear isomorphism to Beads’ core functionality while simplifying the
architecture. The key differences are:

| Aspect | Beads | tbd |
| --- | --- | --- |
| Data locations | 4 (SQLite, local JSONL, sync branch, main) | 2 (files, sync branch) |
| Storage | SQLite + JSONL | JSON files |
| File format | Single JSONL (one line per entity) | File per entity |
| Daemon | Always recommended | Optional |
| Sync layer | Schema-aware | Schema-agnostic |
| Agent coordination | External (Agent Mail) | Built-in (agents/ directory) |

**Core Finding:** All essential LLM agent workflows in Beads have direct equivalents in
tbd. The spec now includes full parity for core workflows.

* * *

## 1. CLI Command Mapping

### 1.1 Issue Commands

| Beads Command | tbd Command | Status |
| --- | --- | --- |
| `bd create "Title" -p N -t type` | `tbd create "Title" -p N -k kind` | ✅ `-t` → `-k` |
| `bd create "Title" -l label1,label2` | `tbd create "Title" -l label1 -l label2` | ✅ Repeatable flag |
| `bd create "Title" --parent <id>` | `tbd create "Title" --parent <id>` | ✅ Identical |
| `bd create "Title" -d "desc"` | `tbd create "Title" -d "desc"` | ✅ Identical |
| `bd create "Title" --body-file=file.md` | `tbd create "Title" --body-file=file.md` | ✅ Identical |
| `bd create "Title" --deps type:<id>` | `tbd create "Title" --deps type:<id>` | ✅ Identical |
| `bd list` | `tbd list` | ✅ Identical |
| `bd list --status open` | `tbd list --status open` | ✅ Identical |
| `bd list --priority N` | `tbd list --priority N` | ✅ Identical |
| `bd list --label X` | `tbd list --label X` | ✅ Identical |
| `bd list --assignee X` | `tbd list --assignee X` | ✅ Identical |
| `bd show <id>` | `tbd show <id>` | ✅ Identical |
| `bd update <id> --status X` | `tbd issue update <id> --status X` | ✅ Identical |
| `bd update <id> --priority N` | `tbd issue update <id> --priority N` | ✅ Identical |
| `bd close <id> --reason "X"` | `tbd close <id> --reason "X"` | ✅ Identical |
| `bd reopen <id>` | `tbd reopen <id>` | ✅ Identical |
| `bd ready` | `tbd ready` | ✅ Identical |
| `bd blocked` | `tbd blocked` | ✅ Identical |
| `bd stale --days N` | `tbd stale --days N` | ✅ Identical |

### 1.2 Dependency Commands

| Beads Command | tbd Command | Status |
| --- | --- | --- |
| `bd dep add <child> <parent>` | `tbd issue dep add <id> <target> --type blocks` | ✅ Explicit type |
| `bd dep add <a> <b> --type blocks` | `tbd issue dep add <id> <target> --type blocks` | ✅ Identical |
| `bd dep add <a> <b> --type related` | `tbd issue dep add <id> <target> --type related` | ✅ Identical |
| `bd dep add <a> <b> --type discovered-from` | `tbd issue dep add <id> <target> --type discovered-from` | ✅ Identical |
| `bd dep tree <id>` | `tbd issue dep tree <id>` | ✅ Identical |

### 1.3 Label Commands

| Beads Command | tbd Command | Status |
| --- | --- | --- |
| `bd label add <id> <label>` | `tbd issue update <id> --add-label <label>` | ✅ Via update |
| `bd label remove <id> <label>` | `tbd issue update <id> --remove-label <label>` | ✅ Via update |
| `bd label list <id>` | Via `tbd show <id>` | ✅ Part of show |
| `bd label list-all` | Not specified | ⚠️ Future |

### 1.4 Comment Commands

| Beads Command | tbd Command | Status |
| --- | --- | --- |
| Comments in `bd show` | Comments in `tbd show` | ✅ Identical |
| Comments added via SQLite | `tbd issue comment <id> -s "subject" -b "body"` | ✅ Explicit command |

### 1.5 Sync Commands

| Beads Command | tbd Command | Status |
| --- | --- | --- |
| `bd sync` | `tbd sync` | ✅ Identical |
| `bd import -i file.jsonl` | `tbd import file.jsonl --format beads` | ✅ Specified |
| `bd export -o file.jsonl` | Not needed | ✅ Files are the format |

### 1.6 Agent Commands

| Beads Feature | tbd Command | Status |
| --- | --- | --- |
| `bd update <id> --status in_progress` | `tbd agent claim <id>` | ✅ Explicit claim |
| Release (set status back) | `tbd agent release <id>` | ✅ Explicit release |
| No agent registry | `tbd agent register` | ✅ **New in tbd** |
| No agent list | `tbd agent list` | ✅ **New in tbd** |
| No agent status | `tbd agent status <status>` | ✅ **New in tbd** |

### 1.7 Daemon Commands

| Beads Command | tbd Command | Status |
| --- | --- | --- |
| `bd daemons list` | `tbd daemon status` | ✅ Similar |
| `bd daemons start` | `tbd daemon start` | ✅ Identical |
| `bd daemons stop` | `tbd daemon stop` | ✅ Identical |
| `bd daemons health` | `tbd daemon status` | ✅ Combined |
| `bd daemons logs` | Not specified | ⚠️ Future |
| `bd daemons killall` | Not specified | ⚠️ Future |

### 1.8 Health & Maintenance Commands

| Beads Command | tbd Command | Status |
| --- | --- | --- |
| `bd doctor` | `tbd doctor` | ✅ Identical |
| `bd doctor --fix` | `tbd doctor --fix` | ✅ Identical |
| `bd admin compact` | Not specified | ⚠️ Future |
| `bd admin cleanup` | Not specified | ⚠️ Future |
| `bd duplicates` | Not specified | ⚠️ Future |
| `bd merge` | Not specified | ⚠️ Future |
| `bd restore` | `tbd attic restore` | ✅ Via attic |
| `bd rename-prefix` | Via meta.json config | ✅ Configuration |
| `bd audit` | Not specified | ⚠️ Future |
| `bd search` | `tbd list` filters | ✅ Via list |
| `bd stats` | Not specified | ⚠️ Future |

### 1.9 Molecule Commands (Future in tbd)

| Beads Command | tbd Equivalent | Status |
| --- | --- | --- |
| `bd mol pour <proto>` | Not specified | ⚠️ Future |
| `bd mol wisp <proto>` | `tbd local create` | ✅ Similar |
| `bd mol squash` | `tbd local promote` | ✅ Similar |
| `bd mol burn` | `tbd local delete` | ✅ Similar |
| `bd mol bond` | Not specified | ⚠️ Future |
| `bd formula list` | Not specified | ⚠️ Future |

* * *

## 2. Data Model Mapping

### 2.1 Issue Schema

| Beads Field | tbd Field | Status |
| --- | --- | --- |
| `id` | `id` | ✅ Format: `bd-xxxx` → `is-xxxx` |
| `title` | `title` | ✅ Identical |
| `description` | `description` | ✅ Identical |
| `notes` | `notes` | ✅ Identical |
| `status` | `status` | ✅ Full parity |
| `priority` | `priority` | ✅ Identical (0-4) |
| `issue_type` | `kind` | ✅ Renamed |
| `assignee` | `assignee` | ✅ Identical |
| `labels` | `labels` | ✅ Identical |
| `dependencies` | `dependencies` | ✅ Same structure |
| `created_at` | `created_at` | ✅ Identical |
| `updated_at` | `updated_at` | ✅ Identical |
| `created_by` | `created_by` | ✅ Identical |
| `closed_at` | `closed_at` | ✅ Identical |
| `close_reason` | `close_reason` | ✅ Identical |
| `parent_id` | `parent_id` | ✅ Identical |
| `sequence` | `sequence` | ✅ Identical |
| `comments` (embedded) | Messages (separate files) | ✅ Different model |
| `design` | Not specified | ⚠️ Future |
| `acceptance_criteria` | Not specified | ⚠️ Future |
| `estimated_minutes` | Not specified | ⚠️ Future |
| `external_ref` | Not specified | ⚠️ Future (bridge layer) |

### 2.2 Status Values

| Beads Status | tbd Status | Status |
| --- | --- | --- |
| `open` | `open` | ✅ Identical |
| `in_progress` | `in_progress` | ✅ Identical |
| `blocked` | `blocked` | ✅ Identical |
| `deferred` | `deferred` | ✅ Identical |
| `closed` | `closed` | ✅ Identical |
| `tombstone` | Via deletion | ✅ Different mechanism |
| `pinned` | Via label on import | ✅ Import mapping |
| `hooked` | Via label on import | ✅ Import mapping |

### 2.3 Issue Types/Kinds

| Beads Type | tbd Kind | Status |
| --- | --- | --- |
| `bug` | `bug` | ✅ Identical |
| `feature` | `feature` | ✅ Identical |
| `task` | `task` | ✅ Identical |
| `epic` | `epic` | ✅ Identical |
| `chore` | `chore` | ✅ Identical |
| `message` | Separate entity (ms-) | ✅ Different model |
| `merge-request` | Not specified | ⚠️ Future |
| `molecule` | Not specified | ⚠️ Future |
| `gate` | Not specified | ⚠️ Future |
| `agent` | Separate entity (ag-) | ✅ Different model |
| `role` | Not specified | ⚠️ Future |
| `convoy` | Not specified | ⚠️ Future |

### 2.4 Dependency Types

| Beads Type | tbd Type | Status |
| --- | --- | --- |
| `blocks` | `blocks` | ✅ Identical |
| `related` | `related` | ✅ Identical |
| `parent-child` | `parent_id` field | ✅ Different model |
| `discovered-from` | `discovered-from` | ✅ Identical |
| `conditional-blocks` | Not specified | ⚠️ Future |
| `waits-for` | Not specified | ⚠️ Future |
| `replies-to` | `in_reply_to` (messages) | ✅ Different model |

* * *

## 3. Architecture Mapping

### 3.1 Storage Architecture

| Aspect | Beads | tbd |
| --- | --- | --- |
| Primary store | SQLite (`.beads/beads.db`) | JSON files (`.tbd/nodes/`) |
| Sync format | JSONL (`.beads/issues.jsonl`) | JSON files (same as primary) |
| Comments | Embedded in issue | Separate message files |
| Events/audit | Embedded in issue | Via attic (conflict losers) |
| Agent state | External | Built-in (`.tbd/nodes/agents/`) |

### 3.2 Sync Architecture

| Aspect | Beads | tbd |
| --- | --- | --- |
| Sync mechanism | SQLite ↔ JSONL ↔ git | Files ↔ git |
| Branch strategy | Main or sync branch | Sync branch only |
| Merge algorithm | 3-way (base, local, remote) | Version-based + merge rules |
| Conflict resolution | LWW for scalars, union for arrays | Same strategies |
| Conflict preservation | Partial (via tombstones) | Full (attic) |
| Base state tracking | `sync_base.jsonl` | Via version numbers |

### 3.3 Query Performance

| Aspect | Beads | tbd (no daemon) | tbd (with daemon) |
| --- | --- | --- | --- |
| List all issues | ~5ms (SQLite) | ~50ms (read files) | ~5ms (in-memory) |
| Filter by status | ~2ms (indexed) | ~50ms (read+filter) | ~2ms (indexed) |
| Full-text search | ~10ms (FTS) | Not specified | Not specified |

* * *

## 4. LLM Agent Workflow Comparison

### 4.1 Core Agent Loop

**Beads:**

```bash
bd ready --json              # Find work
bd update <id> --status in_progress  # Claim
# ... work ...
bd close <id> --reason "Done"  # Complete
bd sync                       # Sync
```

**tbd:**

```bash
tbd ready --json            # Find work
tbd agent claim <id>        # Claim (explicit)
# ... work ...
tbd close <id> --reason "Done"  # Complete
tbd sync                    # Sync
```

**Assessment:** ✅ Identical workflow, slightly more explicit in tbd.

### 4.2 Creating and Linking Work

**Beads:**

```bash
bd create "Found bug" -t bug -p 1 --deps discovered-from:<parent-id> --json
```

**tbd:**

```bash
tbd create "Found bug" -k bug -p 1 --deps discovered-from:<parent-id> --json
```

**Assessment:** ✅ Identical (after spec update).

### 4.3 Multi-Agent Coordination

**Beads:** Uses external Agent Mail or `bd update --status in_progress` (honor system).

**tbd:** Built-in agent registry with explicit claim/release commands.

**Assessment:** ✅ tbd is stronger for multi-agent coordination.

### 4.4 End-of-Session Sync

**Beads:**

```bash
bd sync  # Immediate flush/commit/push
```

**tbd:**

```bash
tbd sync  # Immediate sync
```

**Assessment:** ✅ Identical.

### 4.5 Migration from Beads

```bash
# Export from Beads
bd export -o beads-export.jsonl

# Import to tbd
tbd import beads-export.jsonl --format beads --dry-run  # Preview
tbd import beads-export.jsonl --format beads            # Execute
```

**Assessment:** ✅ Full import support with status mapping.

* * *

## 5. Remaining Gaps (Future Versions)

### 5.1 CLI Commands

| Gap | Beads Command | Priority | Notes |
| --- | --- | --- | --- |
| List all labels | `bd label list-all` | Low | Convenience feature |
| Daemon logs | `bd daemons logs` | Low | Debugging feature |
| Daemon killall | `bd daemons killall` | Low | Debugging feature |
| Statistics | `bd stats` | Low | Metrics feature |
| Audit trail | `bd audit` | Low | Compliance feature |
| Compaction | `bd admin compact` | Low | Memory decay |
| Cleanup | `bd admin cleanup` | Low | Maintenance |
| Duplicates | `bd duplicates` | Low | Deduplication |

### 5.2 Schema Fields

| Gap | Beads Field | Priority | Notes |
| --- | --- | --- | --- |
| Design notes | `design` | Low | Structured notes |
| Acceptance criteria | `acceptance_criteria` | Low | Structured notes |
| Time estimates | `estimated_minutes` | Low | Effort tracking |
| External refs | `external_ref` | Medium | Bridge layer |

### 5.3 Dependency Types

| Gap | Beads Type | Priority | Notes |
| --- | --- | --- | --- |
| Conditional blocks | `conditional-blocks` | Medium | Error handling |
| Fanout gates | `waits-for` | Medium | Dynamic children |

### 5.4 Molecule/Template System

| Gap | Beads Command | Priority | Notes |
| --- | --- | --- | --- |
| Pour template | `bd mol pour` | Low | Reusable workflows |
| Bond molecules | `bd mol bond` | Low | Compound workflows |
| Formulas | `bd formula *` | Low | Template library |

* * *

## 6. LLM Usability Comparison

### 6.1 Command Discoverability

| Aspect | Beads | tbd |
| --- | --- | --- |
| Command count | ~40+ commands | ~35 commands |
| Subcommand depth | 2-3 levels | 2 levels |
| Consistency | Good | Better (more uniform) |
| JSON output | `--json` on all | `--json` on all |

### 6.2 ID Handling

| Aspect | Beads | tbd |
| --- | --- | --- |
| ID format | `bd-xxxx` | Internal: `is-xxxx`, External: `cd-xxxx` |
| Hierarchical IDs | `bd-xxxx.1.2` | `is-xxxx` + `parent_id` field |
| ID input | Single format | Both formats accepted |

### 6.3 Error Messages

| Aspect | Beads | tbd |
| --- | --- | --- |
| Claim conflict | "already claimed by agent-X" | "already claimed by agent-X" |
| Not found | Standard error | Standard error |
| Sync conflict | Detailed merge info | Detailed merge info |

### 6.4 Output Format

Both systems support `--json` for all commands, making them equally suitable for LLM
parsing.

* * *

## 7. Summary

### 7.1 Full Parity Achieved

The following features now have full parity:

- All core issue CRUD operations

- Dependency management

- Label management

- Status workflow (including `deferred`)

- `notes` field for working notes

- `reopen`, `blocked`, `stale` commands

- `doctor` command for health checks

- `--body-file` and `--deps` flags on create

- Beads import with status mapping

- Agent coordination (enhanced in tbd)

### 7.2 tbd Advantages

- **Simpler architecture:** 2 data locations vs 4

- **No SQLite dependency:** Works on NFS, cloud volumes

- **Built-in agent registry:** Explicit claim/release

- **Full conflict preservation:** Attic stores all lost data

- **Schema-agnostic sync:** Easy to add new entity types

### 7.3 Remaining Work (Future)

- Template/molecule system

- Advanced dependency types (`conditional-blocks`, `waits-for`)

- Statistics and metrics

- Compaction/memory decay

* * *

## 8. Conclusion

tbd now provides **complete feature parity** with Beads for all core LLM agent
workflows:

- Issue CRUD with all common flags

- Dependency tracking

- Full status workflow including `deferred`

- `notes` field for working notes

- Health check (`doctor`)

- Blocked and stale issue detection

- Import from Beads format

- JSON output for parsing

The remaining gaps are advanced features (templates, conditional dependencies,
statistics) that can be added in future versions without affecting core workflows.

**Overall Assessment:** LLMs can migrate from Beads to tbd with no workflow changes.
The core isomorphism is complete.
