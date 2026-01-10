# Beads to Ceads Feature Mapping (V2 Phase 1)

**Purpose:** Feature mapping for Ceads V2 Phase 1, a drop-in Beads replacement focused
on durable Git-backed issue tracking without daemon requirements.

**Status:** Current with ceads-design-v2-phase1.md

**Scope:** Phase 1 covers core issue tracking only.
Agent registry, messages, real-time coordination, and bridges are deferred to Phase 2+.

* * *

## Executive Summary

Ceads V2 Phase 1 provides CLI-level compatibility with Beads for core issue tracking
while simplifying the architecture:

| Aspect | Beads | Ceads V2 Phase 1 |
| --- | --- | --- |
| Data locations | 4 (SQLite, local JSONL, sync branch, main) | 2 (files on sync branch, config on main) |
| Storage | SQLite + JSONL | JSON files (file-per-entity) |
| Daemon | Required (recommended) | Not required |
| Agent coordination | External (Agent Mail) | Deferred to Phase 2 |
| Comments | Embedded in issue | Deferred to Phase 2 |
| Conflict resolution | 3-way merge | Version-based LWW + attic |

**Core Finding:** All essential issue tracking workflows in Beads have direct CLI
equivalents in Ceads V2 Phase 1. Advanced features (agent coordination, templates,
real-time sync) are explicitly deferred.

* * *

## 1. CLI Command Mapping

### 1.1 Issue Commands (Full Parity)

| Beads Command | Ceads Command | Status | Notes |
| --- | --- | --- | --- |
| `bd create "Title"` | `cead create "Title"` | ✅ Full | Identical |
| `bd create "Title" -t type` | `cead create "Title" -t type` | ✅ Full | Same flag |
| `bd create "Title" -p N` | `cead create "Title" -p N` | ✅ Full | Priority 0-4 |
| `bd create "Title" -d "desc"` | `cead create "Title" -d "desc"` | ✅ Full | Description |
| `bd create "Title" -f file.md` | `cead create "Title" -f file.md` | ✅ Full | Body from file |
| `bd create "Title" -l label` | `cead create "Title" -l label` | ✅ Full | Repeatable |
| `bd create "Title" --assignee X` | `cead create "Title" --assignee X` | ✅ Full | Identical |
| `bd create "Title" --parent <id>` | `cead create "Title" --parent <id>` | ✅ Full | Hierarchical |
| `bd create "Title" --due <date>` | `cead create "Title" --due <date>` | ✅ Full | Due date |
| `bd create "Title" --defer <date>` | `cead create "Title" --defer <date>` | ✅ Full | Defer until |
| `bd list` | `cead list` | ✅ Full | Identical |
| `bd list --status X` | `cead list --status X` | ✅ Full | Identical |
| `bd list --type X` | `cead list --type X` | ✅ Full | Identical |
| `bd list --priority N` | `cead list --priority N` | ✅ Full | Identical |
| `bd list --assignee X` | `cead list --assignee X` | ✅ Full | Identical |
| `bd list --label X` | `cead list --label X` | ✅ Full | Repeatable |
| `bd list --parent <id>` | `cead list --parent <id>` | ✅ Full | List children |
| `bd list --deferred` | `cead list --deferred` | ✅ Full | Deferred issues |
| `bd list --sort X` | `cead list --sort X` | ✅ Full | priority/created/updated |
| `bd list --limit N` | `cead list --limit N` | ✅ Full | Identical |
| `bd list --json` | `cead list --json` | ✅ Full | JSON output |
| `bd show <id>` | `cead show <id>` | ✅ Full | Identical |
| `bd update <id> --status X` | `cead update <id> --status X` | ✅ Full | Identical |
| `bd update <id> --priority N` | `cead update <id> --priority N` | ✅ Full | Identical |
| `bd update <id> --assignee X` | `cead update <id> --assignee X` | ✅ Full | Identical |
| `bd update <id> --description X` | `cead update <id> --description X` | ✅ Full | Identical |
| `bd update <id> --type X` | `cead update <id> --type X` | ✅ Full | Identical |
| `bd update <id> --due <date>` | `cead update <id> --due <date>` | ✅ Full | Identical |
| `bd update <id> --defer <date>` | `cead update <id> --defer <date>` | ✅ Full | Identical |
| `bd update <id> --parent <id>` | `cead update <id> --parent <id>` | ✅ Full | Identical |
| `bd close <id>` | `cead close <id>` | ✅ Full | Identical |
| `bd close <id> --reason "X"` | `cead close <id> --reason "X"` | ✅ Full | With reason |
| `bd reopen <id>` | `cead reopen <id>` | ✅ Full | Identical |
| `bd ready` | `cead ready` | ✅ Full | Identical algorithm |
| `bd blocked` | `cead blocked` | ✅ Full | Shows blockers |

### 1.2 Label Commands (Full Parity)

| Beads Command | Ceads Command | Status | Notes |
| --- | --- | --- | --- |
| `bd label add <id> <label>` | `cead label add <id> <label>` | ✅ Full | Identical |
| `bd label remove <id> <label>` | `cead label remove <id> <label>` | ✅ Full | Identical |
| `bd label list` | `cead label list` | ✅ Full | All labels in use |

Also available via update:

- `cead update <id> --add-label X`

- `cead update <id> --remove-label X`

### 1.3 Dependency Commands (Partial - blocks only)

| Beads Command | Ceads Command | Status | Notes |
| --- | --- | --- | --- |
| `bd dep add <a> <b>` | `cead dep add <id> <target>` | ✅ Full | Default: blocks |
| `bd dep add <a> <b> --type blocks` | `cead dep add <id> <target> --type blocks` | ✅ Full | Identical |
| `bd dep add <a> <b> --type related` | *(not in Phase 1)* | ⏳ Phase 2 | Only blocks |
| `bd dep add <a> <b> --type discovered-from` | *(not in Phase 1)* | ⏳ Phase 2 | Only blocks |
| `bd dep remove <a> <b>` | `cead dep remove <id> <target>` | ✅ Full | Identical |
| `bd dep tree <id>` | `cead dep tree <id>` | ✅ Full | Visualize deps |

**Note:** Phase 1 supports only `blocks` dependency type.
This is sufficient for the `ready` command algorithm.
`related` and `discovered-from` are Phase 2.

### 1.4 Sync Commands (Full Parity)

| Beads Command | Ceads Command | Status | Notes |
| --- | --- | --- | --- |
| `bd sync` | `cead sync` | ✅ Full | Pull then push |
| `bd sync --pull` | `cead sync --pull` | ✅ Full | Pull only |
| `bd sync --push` | `cead sync --push` | ✅ Full | Push only |
| *(no equivalent)* | `cead sync --status` | ✅ New | Show pending changes |

### 1.5 Maintenance Commands (Full Parity)

| Beads Command | Ceads Command | Status | Notes |
| --- | --- | --- | --- |
| `bd init` | `cead init` | ✅ Full | Identical |
| `bd doctor` | `cead doctor` | ✅ Full | Health checks |
| `bd doctor --fix` | `cead doctor --fix` | ✅ Full | Auto-fix |
| `bd stats` | `cead stats` | ✅ Full | Issue statistics |
| `bd import` | `cead import <file>` | ✅ Full | Beads JSONL import |
| `bd export` | *(not in Phase 1)* | ⏳ Phase 2 | Files are the format |
| `bd config` | `cead config` | ✅ Full | YAML config |
| `bd compact` | *(not in Phase 1)* | ⏳ Phase 2 | Memory decay |

### 1.6 Global Options (Full Parity)

| Beads Option | Ceads Option | Status | Notes |
| --- | --- | --- | --- |
| `--json` | `--json` | ✅ Full | JSON output |
| `--help` | `--help` | ✅ Full | Help text |
| `--version` | `--version` | ✅ Full | Version info |
| `--db <path>` | `--db <path>` | ✅ Full | Custom .ceads path |
| `--no-sync` | `--no-sync` | ✅ Full | Skip auto-sync |
| `--actor <name>` | `--actor <name>` | ✅ Full | Override actor |

* * *

## 2. Explicitly Deferred Features (Phase 2+)

These features are intentionally excluded from Phase 1:

### 2.1 Agent Coordination

| Feature | Beads | Phase 2 Plan |
| --- | --- | --- |
| Agent registry | External (Agent Mail) | Built-in `agents/` directory |
| Agent claim | `--status in_progress` | Explicit `cead agent claim <id>` |
| Agent release | Manual status change | Explicit `cead agent release <id>` |
| Agent list | Not built-in | `cead agent list` |
| Agent heartbeat | Not built-in | Optional with TTL |

### 2.2 Comments/Messages

| Feature | Beads | Phase 2 Plan |
| --- | --- | --- |
| Comments on issues | Embedded in issue | Separate `messages/` directory |
| Comment add | Via SQLite | `cead comment <id> "text"` |
| Comment list | In `bd show` | In `cead show` + dedicated command |

**Phase 1 Workaround:** Use `description` or a `notes` field for working notes.

### 2.3 Daemon

| Feature | Beads | Phase 2 Plan |
| --- | --- | --- |
| Background sync | Required daemon | Optional daemon |
| Auto-flush | On every write | On explicit sync or interval |
| Health monitoring | `bd daemons health` | `cead daemon status` |

**Phase 1 Workaround:** Run `cead sync` manually or via cron/script.

### 2.4 Advanced Features

| Feature | Beads | Phase |
| --- | --- | --- |
| Templates/Molecules | `bd mol pour` | Phase 3 |
| Formulas | `bd formula list` | Phase 3 |
| Conditional deps | `conditional-blocks` | Phase 2 |
| Real-time presence | Not built-in | Phase 2 (bridge layer) |
| GitHub bridge | Not built-in | Phase 2 |
| Full-text search | SQLite FTS | Phase 2 |

* * *

## 3. Data Model Mapping

### 3.1 Issue Schema

| Beads Field | Ceads Field | Status | Notes |
| --- | --- | --- | --- |
| `id` | `id` | ✅ | `bd-xxxx` → display prefix configurable |
| `title` | `title` | ✅ | Identical |
| `description` | `description` | ✅ | Identical |
| `notes` | `notes` | ✅ | Working notes field |
| `issue_type` | `kind` | ✅ | Renamed for clarity |
| `status` | `status` | ✅ | Full parity (see below) |
| `priority` | `priority` | ✅ | 0-4, identical |
| `assignee` | `assignee` | ✅ | Identical |
| `labels` | `labels` | ✅ | Identical |
| `dependencies` | `dependencies` | ✅ | Only `blocks` in Phase 1 |
| `parent_id` | `parent_id` | ✅ | Identical |
| `created_at` | `created_at` | ✅ | Identical |
| `updated_at` | `updated_at` | ✅ | Identical |
| `created_by` | `created_by` | ✅ | Identical |
| `closed_at` | `closed_at` | ✅ | Identical |
| `close_reason` | `close_reason` | ✅ | Identical |
| `due` | `due_date` | ✅ | Renamed |
| `defer` | `deferred_until` | ✅ | Renamed |
| *(implicit)* | `version` | ✅ | New: conflict resolution |
| *(implicit)* | `type` | ✅ | New: entity discriminator ("is") |
| `comments` | *(Phase 2)* | ⏳ | Separate messages entity |
| `design` | *(Future)* | ⏳ | Not in Phase 1 |
| `acceptance_criteria` | *(Future)* | ⏳ | Not in Phase 1 |
| `estimated_minutes` | *(Future)* | ⏳ | Not in Phase 1 |
| `external_ref` | *(Future)* | ⏳ | Bridge layer |

### 3.2 Status Values

| Beads Status | Ceads Status | Migration |
| --- | --- | --- |
| `open` | `open` | ✅ Direct |
| `in_progress` | `in_progress` | ✅ Direct |
| `blocked` | `blocked` | ✅ Direct |
| `deferred` | `deferred` | ✅ Direct |
| `closed` | `closed` | ✅ Direct |
| `tombstone` | *(deleted)* | ✅ Skip or move to attic |
| `pinned` | *(label)* | ✅ Convert to label on import |
| `hooked` | *(label)* | ✅ Convert to label on import |

### 3.3 Issue Types/Kinds

| Beads Type | Ceads Kind | Status |
| --- | --- | --- |
| `bug` | `bug` | ✅ |
| `feature` | `feature` | ✅ |
| `task` | `task` | ✅ |
| `epic` | `epic` | ✅ |
| `chore` | `chore` | ✅ |
| `message` | *(Phase 2)* | ⏳ Separate entity |
| `agent` | *(Phase 2)* | ⏳ Separate entity |

### 3.4 Dependency Types

| Beads Type | Ceads Type | Status |
| --- | --- | --- |
| `blocks` | `blocks` | ✅ Phase 1 |
| `related` | `related` | ⏳ Phase 2 |
| `discovered-from` | `discovered-from` | ⏳ Phase 2 |
| `parent-child` | `parent_id` field | ✅ Different model |

* * *

## 4. Architecture Comparison

### 4.1 Storage

| Aspect | Beads | Ceads V2 Phase 1 |
| --- | --- | --- |
| Primary store | SQLite | JSON files |
| Sync format | JSONL | JSON files (same as primary) |
| File structure | Single `issues.jsonl` | File per entity |
| Location | `.beads/` on main | `.ceads-sync/` on sync branch |
| Config | SQLite + various | `.ceads/config.yml` on main |

### 4.2 Sync

| Aspect | Beads | Ceads V2 Phase 1 |
| --- | --- | --- |
| Mechanism | SQLite ↔ JSONL ↔ git | Files ↔ git |
| Branch | Main or sync branch | Sync branch only |
| Conflict detection | 3-way (base, local, remote) | Content hash difference |
| Conflict resolution | LWW + union | LWW + union (same strategies) |
| Conflict preservation | Partial | Full (attic) |
| Daemon required | Yes (recommended) | No |

### 4.3 Performance (Expected)

| Operation | Beads | Ceads (no index) | Ceads (with index) |
| --- | --- | --- | --- |
| List all | ~5ms | ~50ms | ~5ms |
| Filter by status | ~2ms | ~50ms | ~2ms |
| Create issue | ~10ms | ~10ms | ~10ms |
| Sync | Variable | ~100-500ms | ~100-500ms |

* * *

## 5. LLM Agent Workflow Comparison

### 5.1 Basic Agent Loop (Full Parity)

**Beads:**
```bash
bd ready --json              # Find work
bd update <id> --status in_progress  # Claim (advisory)
# ... work ...
bd close <id> --reason "Done"  # Complete
bd sync                       # Sync
```

**Ceads V2 Phase 1:**
```bash
cead ready --json            # Find work
cead update <id> --status in_progress  # Claim (advisory)
# ... work ...
cead close <id> --reason "Done"  # Complete
cead sync                    # Sync
```

**Assessment:** ✅ Identical workflow.
Claims are advisory in both (no enforcement).

### 5.2 Creating Linked Work (Partial Parity)

**Beads:**
```bash
bd create "Found bug" -t bug -p 1 --deps discovered-from:<id> --json
```

**Ceads V2 Phase 1:**
```bash
# Only blocks dependency supported in Phase 1
cead create "Found bug" -t bug -p 1 --parent <id> --json
# Or wait for Phase 2 for discovered-from
```

**Assessment:** ⚠️ `discovered-from` dependency not available in Phase 1. Use `--parent`
or wait for Phase 2.

### 5.3 End-of-Session Sync (Full Parity)

**Beads:**
```bash
bd sync  # Flushes to git
```

**Ceads V2 Phase 1:**
```bash
cead sync  # Syncs to git
```

**Assessment:** ✅ Identical.

### 5.4 Migration Workflow

```bash
# Export from Beads
bd export -o beads-export.jsonl

# In target repo
cead init
cead import beads-export.jsonl  # Converts format
git add .ceads/
git commit -m "Initialize ceads from beads"
cead sync

# Configure display prefix for familiarity
cead config display.id_prefix bd
```

* * *

## 6. Spec Updates Applied

The following updates have been applied to ceads-design-v2-phase1.md:

### Completed

1. ✅ **Added `notes` field** to IssueSchema for working notes (Beads parity)

2. ✅ **Added `chore` to IssueKind** enum (Beads parity)

3. ✅ **Changed conflict detection** from “same version + different content” to
   “different content hash” (safer, matches V1 design)

4. ✅ **Removed `last_sync` from MetaSchema** - now tracked in local cache (avoids
   conflict hotspot). Added LocalStateSchema.

5. ✅ **Added canonical JSON requirements** - sorted keys, 2-space indent, etc.
   for consistent hashing

6. ✅ **Added atomic write implementation** details with code example

7. ✅ **Clarified Phase 2 priority** for `related` and `discovered-from` dependency types
   (new “Additional Dependency Types” section)

8. ✅ **Added `extensions` field** to BaseEntity for future extensibility

9. ✅ **Added `stale` command** - list issues not updated in N days

### Remaining (Low Priority)

10. **Consider export command** for Phase 1 (though files are already the format)

* * *

## 7. Summary

### Phase 1 Parity Status

| Category | Parity | Notes |
| --- | --- | --- |
| Issue CRUD | ✅ Full | All core operations |
| Labels | ✅ Full | Add, remove, list |
| Dependencies | ⚠️ Partial | Only `blocks` type |
| Sync | ✅ Full | Pull, push, status |
| Maintenance | ✅ Full | Init, doctor, stats, config |
| Import | ✅ Full | Beads JSONL |

### Deferred to Phase 2+

| Category | Priority | Notes |
| --- | --- | --- |
| Agent registry | High | Built-in coordination |
| Comments/Messages | High | Separate entity type |
| `related` deps | Medium | Additional dep type |
| `discovered-from` deps | Medium | Additional dep type |
| Daemon | Medium | Optional background sync |
| GitHub bridge | Low | External integration |
| Templates | Low | Reusable workflows |

### Migration Compatibility

- **CLI:** 95%+ compatible for core workflows

- **Data:** Full import from Beads JSONL

- **Display:** Configurable ID prefix (`bd-xxxx` vs `cd-xxxx`)

- **Behavior:** Advisory claims, manual sync (no daemon)

**Overall Assessment:** Ceads V2 Phase 1 provides sufficient feature parity for LLM
agents to migrate from Beads for basic issue tracking workflows.
The simpler architecture (no SQLite, no daemon, file-per-entity) addresses the key pain
points identified in the Beads experience.
