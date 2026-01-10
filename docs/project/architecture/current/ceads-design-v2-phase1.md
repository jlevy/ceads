# Ceads Design V2 Phase 1: Beads Replacement

**Author:** Joshua Levy (github.com/jlevy) and various LLMs

**Status**: Draft

**Date**: January 2025

* * *

## Table of Contents

- [Ceads Design V2 Phase 1: Beads
  Replacement](#ceads-design-v2-phase-1-beads-replacement)

  - [Table of Contents](#table-of-contents)

  - [1. Introduction](#1-introduction)

    - [1.1 What is Ceads?](#11-what-is-ceads)

    - [1.2 Why Replace Beads?](#12-why-replace-beads)

    - [1.3 Design Goals](#13-design-goals)

    - [1.4 Design Principles](#14-design-principles)

    - [1.5 Non-Goals for Phase 1](#15-non-goals-for-phase-1)

    - [1.6 Layer Overview](#16-layer-overview)

  - [2. File Layer](#2-file-layer)

    - [2.1 Overview](#21-overview)

      - [Canonical JSON Format](#canonical-json-format)

      - [Atomic File Writes](#atomic-file-writes)

    - [2.2 Directory Structure](#22-directory-structure)

      - [On Main Branch (all working branches)](#on-main-branch-all-working-branches)

      - [On `ceads-sync` Branch](#on-ceads-sync-branch)

    - [2.3 Entity Collection Pattern](#23-entity-collection-pattern)

      - [Directory Layout](#directory-layout)

      - [Adding New Entity Types (Future)](#adding-new-entity-types-future)

    - [2.4 ID Generation](#24-id-generation)

      - [ID Generation Algorithm](#id-generation-algorithm)

    - [2.5 Schemas](#25-schemas)

      - [2.5.1 Common Types](#251-common-types)

      - [2.5.2 BaseEntity](#252-baseentity)

      - [2.5.3 IssueSchema](#253-issueschema)

      - [2.5.4 ConfigSchema](#254-configschema)

      - [2.5.5 MetaSchema](#255-metaschema)

      - [2.5.6 LocalStateSchema](#256-localstateschema)

      - [2.5.7 AtticEntrySchema](#257-atticentryschema)

  - [3. Git Layer](#3-git-layer)

    - [3.1 Overview](#31-overview)

    - [3.2 Sync Branch Architecture](#32-sync-branch-architecture)

      - [Files Tracked on Main Branch](#files-tracked-on-main-branch)

      - [.ceads/.gitignore Contents](#ceadsgitignore-contents)

      - [Files Tracked on ceads-sync Branch](#files-tracked-on-ceads-sync-branch)

    - [3.3 Sync Operations](#33-sync-operations)

      - [3.3.1 Reading from Sync Branch](#331-reading-from-sync-branch)

      - [3.3.2 Writing to Sync Branch](#332-writing-to-sync-branch)

      - [3.3.3 Sync Algorithm](#333-sync-algorithm)

    - [3.4 Conflict Detection and Resolution](#34-conflict-detection-and-resolution)

      - [When Conflicts Occur](#when-conflicts-occur)

      - [Detection](#detection)

      - [Resolution Flow](#resolution-flow)

    - [3.5 Merge Rules](#35-merge-rules)

      - [Issue Merge Rules](#issue-merge-rules)

    - [3.6 Attic Structure](#36-attic-structure)

  - [4. CLI Layer](#4-cli-layer)

    - [4.1 Overview](#41-overview)

    - [4.2 Command Structure](#42-command-structure)

    - [4.3 Initialization](#43-initialization)

    - [4.4 Issue Commands](#44-issue-commands)

      - [Create](#create)

      - [List](#list)

      - [Show](#show)

      - [Update](#update)

      - [Close](#close)

      - [Reopen](#reopen)

      - [Ready](#ready)

      - [Blocked](#blocked)

      - [Stale](#stale)

    - [4.5 Label Commands](#45-label-commands)

    - [4.6 Dependency Commands](#46-dependency-commands)

    - [4.7 Sync Commands](#47-sync-commands)

    - [4.8 Maintenance Commands](#48-maintenance-commands)

      - [Stats](#stats)

      - [Doctor](#doctor)

      - [Compact (Future)](#compact-future)

      - [Config](#config)

    - [4.9 Global Options](#49-global-options)

    - [4.10 Output Formats](#410-output-formats)

  - [5. Beads Compatibility](#5-beads-compatibility)

    - [5.1 Migration Strategy](#51-migration-strategy)

    - [5.2 Command Mapping](#52-command-mapping)

    - [5.3 Field Mapping](#53-field-mapping)

    - [5.4 Status Mapping](#54-status-mapping)

    - [5.5 Compatibility Notes](#55-compatibility-notes)

      - [What Works Identically](#what-works-identically)

      - [Key Differences](#key-differences)

      - [Migration Gotchas](#migration-gotchas)

  - [6. Implementation Notes](#6-implementation-notes)

    - [6.1 Performance Optimization](#61-performance-optimization)

      - [Query Index](#query-index)

      - [File I/O Optimization](#file-io-optimization)

    - [6.2 Testing Strategy](#62-testing-strategy)

    - [6.3 Migration Path](#63-migration-path)

  - [7. Appendices](#7-appendices)

    - [7.1 Design Decisions](#71-design-decisions)

      - [Decision 1: File-per-entity vs JSONL](#decision-1-file-per-entity-vs-jsonl)

      - [Decision 2: No daemon in Phase 1](#decision-2-no-daemon-in-phase-1)

      - [Decision 3: Sync branch instead of
        main](#decision-3-sync-branch-instead-of-main)

      - [Decision 4: Display ID prefix for Beads
        compat](#decision-4-display-id-prefix-for-beads-compat)

      - [Decision 5: Only “blocks” dependencies in Phase
        1](#decision-5-only-blocks-dependencies-in-phase-1)

      - [Decision 6: JSON storage vs Markdown +
        YAML](#decision-6-json-storage-vs-markdown--yaml)

    - [7.2 Future Enhancements (Phase 2+)](#72-future-enhancements-phase-2)

      - [Additional Dependency Types (High
        Priority)](#additional-dependency-types-high-priority)

      - [Agent Registry](#agent-registry)

      - [Comments/Messages](#commentsmessages)

      - [GitHub Bridge](#github-bridge)

      - [Real-time Coordination](#real-time-coordination)

      - [Workflow Automation](#workflow-automation)

      - [Time Tracking](#time-tracking)

    - [7.3 File Structure Reference](#73-file-structure-reference)

* * *

## 1. Introduction

### 1.1 What is Ceads?

**Ceads** is an alternative to [Beads](https://github.com/steveyegge/beads) that
eliminates some rough edges and architectural complexity while maintaining CLI
compatibility.

Ceads is pronounced “seeds” and follows Beads in the spirit of C following B.

**Key characteristics:**

- **Drop-in replacement**: Compatible with Beads CLI commands and workflows at the CLI
  level (have agents use `cead` instead of `bd`)

- **Simpler architecture**: No daemon changing your `.beads` directory, no SQLite and
  associated file locking, no git worktree complexity

- **Git-native**: Uses a dedicated sync branch for coordination data

- **File-per-entity**: Internally, each issue is a separate JSON file for fewer merge
  conflicts

- **Reliable sync**: Version-based conflict resolution with attic preservation

- **Cross-environment**: Works on local machines, CI, cloud sandboxes, network
  filesystems

### 1.2 Why Replace Beads?

Beads proved that git-backed issue tracking works well for AI agents and humans, but its
architecture accumulated complexity:

**Beads Pain Points:**

- **4-location data sync**: SQLite → Local JSONL → Sync Branch → Main Branch

- **Daemon conflicts**: Background process fights manual git operations

- **Worktree complexity**: Special git worktree setup breaks normal git workflows

- **JSONL merge conflicts**: Single file creates conflicts on parallel issue creation

- **Debug difficulty**: Mystery state spread across SQLite, JSONL, and git branches

- **Network filesystem issues**: SQLite doesn’t work well on NFS/SMB

**Ceads Solutions:**

- **2-location data**: Config on main branch, entities on sync branch

- **No daemon required**: Simple CLI tool, optional background sync

- **Standard git**: No worktrees, just branches

- **File-per-entity**: Parallel creation has zero conflicts

- **Transparent state**: Everything is inspectable JSON files

- **Network-safe**: Atomic file writes, no database locks

**Related Work:**

Ceads builds on lessons from the git-native issue tracking ecosystem:

- **[ticket](https://github.com/wedow/ticket)**: A fast, simple Beads replacement
  implemented as a single bash script (about 900 lines) with Markdown + YAML frontmatter
  storage. Created by a frustrated Beads user, ticket demonstrates that simplicity and
  minimal dependencies (bash + coreutils) can outperform complex architectures.
  Successfully manages about 1,900 tickets in production.
  Provides `migrate-beads` command for smooth transitions.
  Key insight: “You don’t need to index everything with SQLite when you have awk.”
  Ceads shares this philosophy while adding TypeScript implementation, stronger conflict
  resolution, and cross-platform reliability.

- **[git-bug](https://github.com/git-bug/git-bug)**: Stores issues as git objects,
  demonstrating git-native tracking without external files

- **[git-issue](https://github.com/dspinellis/git-issue)**: Shell-based issue tracker
  with optional GitHub sync

- **[beans](https://github.com/hmans/beans)**: Another minimalist git-friendly tracker

The common thread: **simplicity, no background services, git for distribution**. Ceads
combines these proven patterns with multi-environment sync and conflict resolution.

### 1.3 Design Goals

1. **Beads CLI compatibility**: Existing workflows and scripts work with minimal changes
   for the most common beads commands

2. **No data loss**: Conflicts preserve both versions via attic mechanism

3. **Works anywhere**: Just `npm install -g ceads` anywhere: local dev, CI, cloud IDEs
   (Claude Code, Codespaces), network filesystems

4. **Simple architecture**: Easy to understand, debug, and maintain

5. **Performance**: <50ms for common operations on 5,000-10,000 issues

6. **Cross-platform**: macOS, Linux, Windows without platform-specific code

7. **Easy migration**: `cead import beads` converts existing Beads databases

### 1.4 Design Principles

1. **Simplicity first**: Prefer boring, well-understood approaches over clever
   optimization

2. **Files as truth**: JSON files on disk are the canonical state

3. **Git for sync**: Standard git commands handle all distribution

4. **No required daemon**: CLI-first, background services optional

5. **Debuggable by design**: Every state change is visible in files and git history

6. **Progressive enhancement**: Core works standalone, bridges/UI are optional layers

### 1.5 Non-Goals for Phase 1

These are explicitly **deferred** to Phase 2 or later:

- Real-time presence/heartbeats

- Atomic claim enforcement

- GitHub bidirectional sync

- Slack/Discord integration

- TUI/GUI interfaces

- Agent messaging beyond issue comments

- Workflow automation

- Time tracking

- Custom fields

**Rationale**: Ship a small, reliable core first.
Add complexity only when proven necessary.

### 1.6 Layer Overview

Ceads V2 Phase 1 has three layers:

```
┌─────────────────────────────────────────────────────────────────┐
│                        CLI Layer                                 │
│                        User/agent interface                      │
│   cead <command> [args] [options]                               │
│   Beads-compatible commands                                     │
└──────────────────────────────┬───────────────────────────────────┘
                               │
┌──────────────────────────────┼───────────────────────────────────┐
│                        Git Layer                                 │
│                        Distributed sync                          │
│   ceads-sync branch │ git fetch/push │ merge algorithm          │
└──────────────────────────────┬───────────────────────────────────┘
                               │
┌──────────────────────────────┼───────────────────────────────────┐
│                        File Layer                                │
│                        Format specification                      │
│   .ceads/config.yml │ .ceads-sync/ │ JSON schemas (Zod)         │
└─────────────────────────────────────────────────────────────────┘
```

**File Layer**: Defines JSON schemas, directory structure, ID generation

**Git Layer**: Defines sync using standard git commands, conflict resolution

**CLI Layer**: Beads-compatible command interface

* * *

## 2. File Layer

### 2.1 Overview

The File Layer defines entity schemas and storage format.
It is storage-agnostic and could theoretically work with any key-value backend.

**Key properties:**

- **Zod schemas are normative**: TypeScript Zod definitions are the specification

- **Storage-agnostic**: Could work with local filesystem, S3, etc.

- **Self-documenting**: Each JSON file contains a `type` field

- **Canonical JSON format**: All JSON files use canonical serialization for consistent
  content hashing (see below)

- **Atomic writes**: Write to temp file, then atomic rename (see below)

#### Canonical JSON Format

All JSON files MUST use canonical serialization to ensure content hashes are consistent
across implementations:

- Keys sorted alphabetically (recursive)

- 2-space indentation

- No trailing whitespace

- Single newline at end of file

- No trailing commas

- UTF-8 encoding

> **Why canonical JSON?** Content hashes are used for conflict detection.
> If different implementations serialize the same object with different key ordering or
> whitespace, identical logical content produces different hashes, causing spurious
> “conflicts.”

#### Atomic File Writes

All file writes MUST be atomic to prevent corruption from crashes or concurrent access:

```typescript
async function atomicWrite(path: string, content: string): Promise<void> {
  const tmpPath = `${path}.tmp.${process.pid}.${Date.now()}`;

  // Write to temporary file
  await fs.writeFile(tmpPath, content, 'utf8');

  // Ensure data is on disk
  const fd = await fs.open(tmpPath, 'r');
  await fd.sync();
  await fd.close();

  // Atomic rename (POSIX guarantees atomicity)
  await fs.rename(tmpPath, path);
}
```

**Why atomic writes?**

- Prevents half-written files if process crashes mid-write

- Prevents readers from seeing incomplete content

- Works on most filesystems (POSIX rename is atomic)

- Important on network filesystems

**Cleanup:** On startup, remove any orphaned `.tmp.*` files in ceads directories.

### 2.2 Directory Structure

Ceads uses two directories:

- **`.ceads/`** on main branch: Configuration (tracked) + local cache (gitignored)

- **`.ceads-sync/`** on `ceads-sync` branch: Synced entities and attic

#### On Main Branch (all working branches)

```
.ceads/
├── config.yml              # Project configuration (tracked)
├── .gitignore              # Ignores cache/ directory (tracked)
│
└── cache/                  # Everything below is gitignored
    ├── state.json          # Per-node sync state (last_sync, node_id)
    ├── index.json          # Optional query index (rebuildable)
    └── sync.lock           # Optional sync coordination file
```

#### On `ceads-sync` Branch

```
.ceads-sync/
├── issues/                 # Issue entities
│   ├── is-a1b2.json
│   └── is-f14c.json
├── attic/                  # Conflict archive
│   └── conflicts/
│       └── is-a1b2/
│           └── 2025-01-07T10-30-00Z_description.json
└── meta.json               # Metadata (schema version, last sync)
```

**Why this structure?**

- Config on main versions with your code

- Synced data on separate branch avoids merge conflicts on working branches

- Local cache is gitignored, never synced

- File-per-entity enables parallel operations without conflicts

### 2.3 Entity Collection Pattern

Phase 1 has **one core entity type**: Issues

Future phases may add: agents, messages, workflows, templates

#### Directory Layout

| Collection | Directory | ID Prefix | Purpose |
| --- | --- | --- | --- |
| Issues | `.ceads-sync/issues/` | `is-` | Task tracking (synced) |

#### Adding New Entity Types (Future)

To add a new entity type:

1. Create directory: `.ceads-sync/messages/` (on sync branch)

2. Define schema: `MessageSchema` in Zod

3. Define ID prefix: `ms-`

4. Define merge rules

5. Add CLI commands

No sync algorithm changes needed—sync operates on files, not schemas.

### 2.4 ID Generation

Entity IDs follow this pattern:

```
{prefix}-{hash}
```

- **Prefix**: 2 lowercase letters (`is-` for issues)

- **Hash**: 4-6 lowercase hex characters

Example: `is-a1b2`, `is-f14c3a`

#### ID Generation Algorithm

```typescript
import { randomBytes } from 'crypto';

function generateId(prefix: string): string {
  // 4 bytes = 32 bits of entropy
  const bytes = randomBytes(4);
  const hash = bytes.toString('hex').toLowerCase().slice(0, 6);
  return `${prefix}-${hash}`;
}
```

**Properties:**

- **Cryptographically random**: No timestamp or content dependency

- **Collision probability**: Very low (1 in 16 million at 4 hex chars)

- **On collision**: Regenerate ID (detected by file-exists check)

**ID validation regex:**
```typescript
const IssueId = z.string().regex(/^is-[a-f0-9]{4,6}$/);
```

### 2.5 Schemas

Schemas are defined in Zod (TypeScript).
Other languages should produce equivalent JSON.

#### 2.5.1 Common Types

```typescript
import { z } from 'zod';

// ISO8601 timestamp
const Timestamp = z.string().datetime();

// Issue ID
const IssueId = z.string().regex(/^is-[a-f0-9]{4,6}$/);

// Version counter for optimistic concurrency
const Version = z.number().int().nonnegative();

// Entity type discriminator
const EntityType = z.literal('is');
```

#### 2.5.2 BaseEntity

All entities share common fields:

```typescript
const BaseEntity = z.object({
  type: EntityType,           // Always "is" for issues
  id: IssueId,
  version: Version,
  created_at: Timestamp,
  updated_at: Timestamp,

  // Extensibility namespace for third-party data
  extensions: z.record(z.string(), z.unknown()).optional(),
});
```

> **Note on `extensions`**: The `extensions` field provides a namespace for third-party
> tools, bridges, and custom integrations to store metadata without modifying core
> schemas. Keys should be namespaced (e.g., `"github"`, `"slack"`, `"my-tool"`). Unknown
> extensions are preserved during sync and merge (pass-through).
> 
> Example:
> ```json
> {
>   "extensions": {
>     "github": { "issue_number": 123, "synced_at": "2025-01-07T10:00:00Z" },
>     "my-tool": { "custom_field": "value" }
>   }
> }
> ```

#### 2.5.3 IssueSchema

```typescript
const IssueStatus = z.enum(['open', 'in_progress', 'blocked', 'deferred', 'closed']);
const IssueKind = z.enum(['bug', 'feature', 'task', 'epic', 'chore']);
const Priority = z.number().int().min(0).max(4);

const Dependency = z.object({
  type: z.literal('blocks'),  // Phase 1: only "blocks" supported
  target: IssueId,
});

const IssueSchema = BaseEntity.extend({
  type: z.literal('is'),

  title: z.string().min(1).max(500),
  description: z.string().max(50000).optional(),
  notes: z.string().max(50000).optional(),      // Working notes (Beads parity)

  kind: IssueKind.default('task'),
  status: IssueStatus.default('open'),
  priority: Priority.default(2),

  assignee: z.string().optional(),
  labels: z.array(z.string()).default([]),
  dependencies: z.array(Dependency).default([]),

  // Hierarchical issues
  parent_id: IssueId.optional(),

  // Beads compatibility
  due_date: Timestamp.optional(),
  deferred_until: Timestamp.optional(),

  created_by: z.string().optional(),
  closed_at: Timestamp.optional(),
  close_reason: z.string().optional(),
});

type Issue = z.infer<typeof IssueSchema>;
```

**Design notes:**

- `status`: Matches Beads statuses (open, in_progress, blocked, deferred, closed)

- `kind`: Matches Beads types (bug, feature, task, epic, chore)

- `priority`: 0 (highest/critical) to 4 (lowest), matching Beads

- `notes`: Working notes field for agents to track progress (Beads parity)

- `dependencies`: Only “blocks” type for now (affects `ready` command)

- `labels`: Arbitrary string tags

- `due_date` / `deferred_until`: Beads compatibility fields

**Notes on tombstone status:**

Beads has a `tombstone` status for soft-deleted issues.
In Ceads, we handle deletion differently:

- Closed issues remain in `issues/` directory with `status: closed`

- Hard deletion moves the file to `attic/deleted/`

- No `tombstone` status needed

#### 2.5.4 ConfigSchema

Project configuration stored in `.ceads/config.yml`:

```yaml
# .ceads/config.yml
ceads_version: "2.0.0"

sync:
  branch: ceads-sync       # Branch name for synced data
  remote: origin           # Remote repository

# Display settings
display:
  id_prefix: bd            # Show IDs as "bd-xxxx" for Beads compatibility

# Runtime settings
settings:
  auto_sync: false         # Auto-sync after write operations
  index_enabled: true      # Use optional query index
```

```typescript
const ConfigSchema = z.object({
  ceads_version: z.string(),
  sync: z.object({
    branch: z.string().default('ceads-sync'),
    remote: z.string().default('origin'),
  }).default({}),
  display: z.object({
    id_prefix: z.string().default('bd'),  // Beads compat
  }).default({}),
  settings: z.object({
    auto_sync: z.boolean().default(false),
    index_enabled: z.boolean().default(true),
  }).default({}),
});
```

#### 2.5.5 MetaSchema

Shared metadata stored in `.ceads-sync/meta.json` on the sync branch:

```typescript
const MetaSchema = z.object({
  schema_version: z.number().int(),
  created_at: Timestamp,
});
```

> **Note**: `last_sync` is intentionally NOT stored in `meta.json`. Syncing this file
> would create a conflict hotspot—every node updates it on every sync, causing constant
> merge conflicts. Instead, sync timestamps are tracked locally in
> `.ceads/cache/state.json` (gitignored).

#### 2.5.6 LocalStateSchema

Per-node state stored in `.ceads/cache/state.json` (gitignored, never synced).
Each machine maintains its own local state:

```typescript
const LocalStateSchema = z.object({
  node_id: z.string().optional(),         // Unique identifier for this node
  last_sync: Timestamp.optional(),        // When this node last synced successfully
  last_push: Timestamp.optional(),        // When this node last pushed
  last_pull: Timestamp.optional(),        // When this node last pulled
});
```

> **Why local?** The `last_sync` timestamp is inherently per-node.
> Storing it in synced state would cause every sync to modify the same file, creating a
> guaranteed conflict generator.
> Keeping it local eliminates this hotspot.

#### 2.5.7 AtticEntrySchema

Preserved conflict losers:

```typescript
const AtticEntrySchema = z.object({
  entity_id: IssueId,
  timestamp: Timestamp,
  field: z.string().optional(),      // Specific field or full entity
  lost_value: z.unknown(),
  winner_source: z.enum(['local', 'remote']),
  loser_source: z.enum(['local', 'remote']),
  context: z.object({
    local_version: Version,
    remote_version: Version,
    local_updated_at: Timestamp,
    remote_updated_at: Timestamp,
  }),
});
```

* * *

## 3. Git Layer

### 3.1 Overview

The Git Layer defines synchronization using standard git commands.
It operates on files without interpreting entity schemas beyond what’s needed for
merging.

**Key properties:**

- **Schema-agnostic sync**: File transfer uses content hashes, doesn’t parse JSON

- **Schema-aware merge**: When content differs, merge rules are per-entity-type

- **Standard git**: All operations use git CLI

- **Dedicated sync branch**: `ceads-sync` branch never pollutes main

- **Hash-based conflict detection**: Content hash comparison triggers merge

### 3.2 Sync Branch Architecture

```
main branch:                    ceads-sync branch:
├── src/                        └── .ceads-sync/
├── tests/                          ├── issues/
├── README.md                       ├── attic/
├── .ceads/                         └── meta.json
│   ├── config.yml (tracked)
│   ├── .gitignore (tracked)
│   └── cache/     (gitignored)
└── ...
```

**Why separate branches?**

1. **No conflicts on main**: Coordination data never creates merge conflicts in feature
   branches

2. **Simple allow-listing**: Cloud sandboxes can allow push to `ceads-sync` only

3. **Shared across branches**: All feature branches see the same issues

4. **Clean git history**: Issue updates don’t pollute code commit history

#### Files Tracked on Main Branch

```
.ceads/config.yml       # Project configuration (YAML)
.ceads/.gitignore       # Ignores cache/ directory
```

#### .ceads/.gitignore Contents

```gitignore
# Local cache (rebuildable)
cache/
```

#### Files Tracked on ceads-sync Branch

```
.ceads-sync/issues/     # Issue entities
.ceads-sync/attic/      # Conflict archive
.ceads-sync/meta.json   # Metadata
```

### 3.3 Sync Operations

Sync uses standard git commands to read/write the sync branch without checking it out.

#### 3.3.1 Reading from Sync Branch

```bash
# Read a file from sync branch without checkout
git show ceads-sync:.ceads-sync/issues/is-a1b2.json

# List files in issues directory
git ls-tree ceads-sync .ceads-sync/issues/
```

#### 3.3.2 Writing to Sync Branch

```bash
# 1. Fetch latest
git fetch origin ceads-sync

# 2. Create a tree with updated files
git read-tree ceads-sync
git add .ceads-sync/issues/
git write-tree

# 3. Create commit on sync branch
git commit-tree <tree> -p ceads-sync -m "ceads sync: $(date -Iseconds)"

# 4. Update sync branch ref
git update-ref refs/heads/ceads-sync <commit>

# 5. Push to remote
git push origin ceads-sync

# If push rejected (non-fast-forward):
#   Pull, merge, retry (max 3 attempts)
```

#### 3.3.3 Sync Algorithm

High-level sync flow:

```
SYNC():
  1. Fetch remote sync branch
  2. For each issue in local cache:
       - Compare with remote version
       - If local newer: stage for push
       - If remote newer: update local cache
       - If conflict: merge and save to attic
  3. For each issue on remote not in local:
       - Pull to local cache
  4. Commit local changes to sync branch
  5. Push to remote (retry on conflict)
```

### 3.4 Conflict Detection and Resolution

#### When Conflicts Occur

Conflicts (requiring a merge) happen when the same file is modified in two places before
sync:

- Two environments modify the same issue before syncing

- Same issue modified on two machines offline

#### Detection

```
Different content hash = requires merge
```

If `hash(local) != hash(remote)`, a merge is needed—**regardless of version numbers**.
The `version` field is used within the merge algorithm for LWW ordering, not for
conflict detection.

> **Why content hash, not version?** In a distributed system, a higher version number
> does NOT mean “contains the other writer’s changes”—it only means “edited more times
> locally.”
> 
> **Example of why version-only is unsafe:**
>
> - Base entity: version 3
>
> - Agent A edits once → version 4
>
> - Agent B (without seeing A) edits twice → version 5
>
> - If A took remote because `5 > 4`, A’s edit would be silently lost.
> 
> By merging whenever content differs, we ensure both writers’ changes are considered
> and the loser is preserved in the attic.

#### Resolution Flow

```
1. Detect: content hash differs
2. Parse both versions as JSON
3. Apply merge rules (field-level, from section 3.5)
4. Increment version: max(local, remote) + 1
5. Update timestamps
6. Write merged result locally
7. Stage merged result for push
8. Save loser values to attic (any field where values differed)
```

> **Note**: Every merge produces attic entries for fields where values differed.
> This ensures “no silent overwrites”—even if one version’s timestamp was older, its
> values are preserved for recovery.

### 3.5 Merge Rules

Field-level merge strategies:

| Strategy | Behavior | Used For |
| --- | --- | --- |
| `immutable` | Error if different | `type`, `id` |
| `lww` | Last-write-wins by timestamp | Scalars (title, status, priority) |
| `lww_with_attic` | LWW, preserve loser in attic | Long text (description) |
| `union` | Combine arrays, dedupe | Labels |
| `merge_by_id` | Merge arrays by item ID | Dependencies |
| `max_plus_one` | `max(local, remote) + 1` | `version` |
| `recalculate` | Fresh timestamp | `updated_at` |

#### Issue Merge Rules

```typescript
const issueMergeRules: MergeRules<Issue> = {
  type: { strategy: 'immutable' },
  id: { strategy: 'immutable' },
  kind: { strategy: 'lww' },
  title: { strategy: 'lww' },
  description: { strategy: 'lww_with_attic' },
  notes: { strategy: 'lww_with_attic' },
  status: { strategy: 'lww' },
  priority: { strategy: 'lww' },
  assignee: { strategy: 'lww' },
  labels: { strategy: 'union' },
  dependencies: { strategy: 'merge_by_id', key: (d) => d.target },
  parent_id: { strategy: 'lww' },
  due_date: { strategy: 'lww' },
  deferred_until: { strategy: 'lww' },
  close_reason: { strategy: 'lww' },
  extensions: { strategy: 'lww' },  // Preserve third-party data
};
```

### 3.6 Attic Structure

The attic preserves data lost in conflicts:

```
.ceads-sync/attic/
└── conflicts/
    └── is-a1b2/
        ├── 2025-01-07T10-30-00Z_description.json
        └── 2025-01-07T11-45-00Z_full.json
```

**Attic entry format:**

```json
{
  "entity_id": "is-a1b2",
  "timestamp": "2025-01-07T10:30:00Z",
  "field": "description",
  "lost_value": "Original description text",
  "winner_source": "remote",
  "loser_source": "local",
  "context": {
    "local_version": 3,
    "remote_version": 3,
    "local_updated_at": "2025-01-07T10:25:00Z",
    "remote_updated_at": "2025-01-07T10:28:00Z"
  }
}
```

* * *

## 4. CLI Layer

### 4.1 Overview

The CLI Layer provides a Beads-compatible command interface.

**Key properties:**

- **Implementation-agnostic**: Can be in TypeScript, Rust, Python, etc.

- **Beads-compatible**: Same command names and common options

- **Dual output**: Human-readable by default, JSON for scripting

- **Exit codes**: 0 for success, non-zero for errors

### 4.2 Command Structure

```
cead <command> [subcommand] [args] [options]
```

**Note**: CLI command is `cead` (singular) to avoid conflict with shell `cd`.

### 4.3 Initialization

```bash
cead init [options]

Options:
  --sync-branch <name>  Sync branch name (default: ceads-sync)
  --remote <name>       Remote name (default: origin)
```

**What it does:**

1. Creates `.ceads/` directory with `config.yml` and `.gitignore`

2. Creates `.ceads/cache/` (gitignored)

3. Creates `ceads-sync` branch with `.ceads-sync/` structure

4. Pushes sync branch to origin (if remote exists)

5. Returns to original branch

6. Outputs instructions to commit config

**Output:**
```
Initialized ceads in /path/to/repo
Created sync branch: ceads-sync
Pushed sync branch to origin

To complete setup, commit the config files:
  git add .ceads/config.yml .ceads/.gitignore
  git commit -m "Initialize ceads"
```

### 4.4 Issue Commands

#### Create

```bash
cead create <title> [options]

Options:
  -t, --type <type>         Issue type: bug, feature, task, epic (default: task)
  -p, --priority <0-4>      Priority (0=critical, 4=lowest, default: 2)
  -d, --description <text>  Description
  -f, --file <path>         Read description from file
  --assignee <name>         Assignee
  --due <date>              Due date (ISO8601)
  --defer <date>            Defer until date (ISO8601)
  --parent <id>             Parent issue ID
  -l, --label <label>       Add label (repeatable)
  --no-sync                 Don't sync after create
```

**Examples:**
```bash
cead create "Fix authentication bug" -t bug -p 1
cead create "Add OAuth" -t feature -l backend -l security
cead create "Write tests" --parent bd-a1b2
cead create "API docs" -f design.md
```

**Output:**
```
Created bd-a1b2: Fix authentication bug
```

#### List

```bash
cead list [options]

Options:
  --status <status>         Filter: open, in_progress, blocked, deferred, closed
  --type <type>             Filter: bug, feature, task, epic
  --priority <0-4>          Filter by priority
  --assignee <name>         Filter by assignee
  --label <label>           Filter by label (repeatable)
  --parent <id>             List children of parent
  --deferred                Show only deferred issues
  --defer-before <date>     Deferred before date
  --sort <field>            Sort by: priority, created, updated (default: priority)
  --limit <n>               Limit results
  --json                    Output as JSON
```

**Examples:**
```bash
cead list
cead list --status open --priority 1
cead list --assignee agent-1 --json
cead list --deferred
```

**Output (human-readable):**
```
ID        PRI  STATUS       TITLE
bd-a1b2   1    in_progress  Fix authentication bug
bd-f14c   2    open         Add OAuth support
bd-c3d4   3    blocked      Write API tests
```

**Output (--json):**
```json
[
  {
    "type": "is",
    "id": "is-a1b2",
    "title": "Fix authentication bug",
    "status": "in_progress",
    "priority": 1,
    "kind": "bug",
    "version": 3,
    "created_at": "2025-01-07T10:00:00Z",
    "updated_at": "2025-01-07T14:30:00Z"
  }
]
```

#### Show

```bash
cead show <id>
```

**Output:**
```
bd-a1b2: Fix authentication bug

Status: in_progress | Priority: 1 | Type: bug
Assignee: agent-1
Labels: backend, security
Created: 2025-01-07 10:00:00 by claude
Updated: 2025-01-07 14:30:00

Description:
  Users are getting logged out after 5 minutes...

Dependencies:
  blocks bd-f14c: Update session handling
```

#### Update

```bash
cead update <id> [options]

Options:
  --status <status>         Set status
  --type <type>             Set type
  --priority <0-4>          Set priority
  --assignee <name>         Set assignee
  --description <text>      Set description
  --due <date>              Set due date
  --defer <date>            Set deferred until date
  --add-label <label>       Add label
  --remove-label <label>    Remove label
  --parent <id>             Set parent
  --no-sync                 Don't sync after update
```

**Examples:**
```bash
cead update bd-a1b2 --status in_progress
cead update bd-a1b2 --add-label urgent --priority 0
cead update bd-a1b2 --defer 2025-02-01
```

#### Close

```bash
cead close <id> [options]

Options:
  --reason <text>           Close reason
  --no-sync                 Don't sync after close
```

**Examples:**
```bash
cead close bd-a1b2
cead close bd-a1b2 --reason "Fixed in commit abc123"
```

#### Reopen

```bash
cead reopen <id> [options]

Options:
  --reason <text>           Reopen reason
  --no-sync                 Don't sync after reopen
```

#### Ready

List issues ready to work on (open, unblocked, unclaimed):

```bash
cead ready [options]

Options:
  --type <type>             Filter by type
  --limit <n>               Limit results
  --json                    Output as JSON
```

**Algorithm:**

- Status = `open`

- No `assignee` set

- No blocking dependencies (where dependency.status != ‘closed’)

#### Blocked

List blocked issues:

```bash
cead blocked [options]

Options:
  --limit <n>               Limit results
  --json                    Output as JSON
```

**Output:**
```
ISSUE       TITLE                    BLOCKED BY
bd-c3d4     Write tests              bd-f14c (Add OAuth)
bd-e5f6     Deploy to prod           bd-a1b2, bd-c3d4
```

#### Stale

List issues not updated recently:

```bash
cead stale [options]

Options:
  --days <n>                Days since last update (default: 7)
  --status <status>         Filter by status (default: open, in_progress)
  --limit <n>               Limit results
  --json                    Output as JSON
```

**Examples:**
```bash
cead stale                    # Issues not updated in 7 days
cead stale --days 14          # Issues not updated in 14 days
cead stale --status blocked   # Blocked issues that are stale
```

**Output:**
```
ISSUE       DAYS  STATUS       TITLE
bd-a1b2     12    in_progress  Fix authentication bug
bd-f14c     9     open         Add OAuth support
```

### 4.5 Label Commands

```bash
# Add label to issue
cead label add <id> <label>

# Remove label from issue
cead label remove <id> <label>

# List all labels in use
cead label list
```

**Examples:**
```bash
cead label add bd-a1b2 urgent
cead label remove bd-a1b2 low-priority
cead label list
```

### 4.6 Dependency Commands

```bash
# Add dependency
cead dep add <id> <target-id> [--type blocks]

# Remove dependency
cead dep remove <id> <target-id>

# Show dependency tree
cead dep tree <id>
```

**Examples:**
```bash
cead dep add bd-c3d4 bd-f14c --type blocks
cead dep tree bd-a1b2
```

**Note**: Phase 1 only supports `blocks` dependency type.

### 4.7 Sync Commands

```bash
# Full sync (pull then push)
cead sync

# Pull only
cead sync --pull

# Push only
cead sync --push

# Show sync status
cead sync --status
```

**Output (sync):**
```
Pulled 3 issues, pushed 2 issues
No conflicts
```

**Output (sync --status):**
```
Local changes (not yet pushed):
  modified: is-a1b2.json
  new:      is-f14c.json

Remote changes (not yet pulled):
  modified: is-x1y2.json
```

### 4.8 Maintenance Commands

#### Stats

```bash
cead stats
```

**Output:**
```
Issues: 127
  Open: 43
  In Progress: 12
  Blocked: 8
  Deferred: 5
  Closed: 59

By Type:
  bug: 34
  feature: 52
  task: 38
  epic: 3

By Priority:
  0 (critical): 3
  1: 15
  2: 45
  3: 42
  4: 22
```

#### Doctor

```bash
cead doctor [options]

Options:
  --fix                     Auto-fix issues
  --json                    Output as JSON
```

**Checks:**

- Schema version compatibility

- Orphaned dependencies (pointing to missing issues)

- Duplicate IDs

- Invalid references

- Sync branch integrity

#### Compact (Future)

```bash
cead compact [options]

Options:
  --dry-run                 Show what would be compacted
  --keep-days <n>           Keep closed issues for n days (default: 90)
```

**Note**: Phase 1 keeps all closed issues.
Compaction is Phase 2.

#### Config

```bash
cead config <key> [value]
cead config --list
```

**Examples:**
```bash
cead config sync.remote upstream
cead config display.id_prefix cd
cead config --list
```

### 4.9 Global Options

Available on all commands:

```bash
--help                      Show help
--version                   Show version
--db <path>                 Custom .ceads directory path
--no-sync                   Disable auto-sync (per command)
--json                      JSON output
--actor <name>              Override actor name
```

### 4.10 Output Formats

**Human-readable** (default):

- Aligned columns

- Relative timestamps ("2 hours ago")

- Color coding (if terminal supports)

**JSON** (`--json`):

- Complete entity objects

- Absolute ISO8601 timestamps

- Parseable by scripts

* * *

## 5. Beads Compatibility

### 5.1 Migration Strategy

**One-time migration:**

```bash
# From Beads repo:
bd export > beads-export.jsonl

# In new Ceads repo:
cead init
cead import beads-export.jsonl
git add .ceads/
git commit -m "Initialize ceads and import from beads"
cead sync
```

**Import behavior:**

1. Reads Beads JSONL export

2. Converts each issue to Ceads JSON format

3. Maps statuses (see [Status Mapping](#54-status-mapping))

4. Preserves metadata (created_at, updated_at, etc.)

5. Writes to `.ceads-sync/issues/`

6. Generates new IDs (`is-xxxx`) but can optionally preserve old IDs in metadata

### 5.2 Command Mapping

| Beads Command | Ceads Equivalent | Status | Notes |
| --- | --- | --- | --- |
| `bd init` | `cead init` | ✅ Full | Identical behavior |
| `bd create` | `cead create` | ✅ Full | All options supported |
| `bd list` | `cead list` | ✅ Full | All filters supported |
| `bd show` | `cead show` | ✅ Full | Same output format |
| `bd update` | `cead update` | ✅ Full | All options supported |
| `bd close` | `cead close` | ✅ Full | With `--reason` |
| `bd ready` | `cead ready` | ✅ Full | Same algorithm |
| `bd blocked` | `cead blocked` | ✅ Full | Shows blocking issues |
| `bd label add` | `cead label add` | ✅ Full | Identical |
| `bd label remove` | `cead label remove` | ✅ Full | Identical |
| `bd label list` | `cead label list` | ✅ Full | Lists all labels |
| `bd dep add` | `cead dep add` | ✅ Full | Only "blocks" type |
| `bd dep tree` | `cead dep tree` | ✅ Full | Visualize dependencies |
| `bd sync` | `cead sync` | ✅ Full | Different mechanism, same UX |
| `bd stats` | `cead stats` | ✅ Full | Same statistics |
| `bd doctor` | `cead doctor` | ✅ Full | Different checks |
| `bd config` | `cead config` | ✅ Full | YAML not SQLite |
| `bd compact` | `cead compact` | 🔄 Phase 2 | Deferred |
| `bd prime` | *(none)* | ❌ Not planned | Beads-specific feature |
| `bd diagnose` | `cead doctor` | ✅ Partial | Subset of diagnostics |
| `bd import` | `cead import` | ✅ Full | Beads JSONL import |
| `bd export` | `cead export` | 🔄 Phase 2 | Can export as JSON |

**Legend:**

- ✅ Full: Complete compatibility

- ✅ Partial: Core functionality, some options differ

- 🔄 Phase 2: Planned for later phase

- ❌ Not planned: Intentionally excluded

### 5.3 Field Mapping

| Beads Field | Ceads Field | Notes |
| --- | --- | --- |
| `id` | `id` | New format: `is-xxxx` vs `bd-xxxx` |
| `title` | `title` | Identical |
| `description` | `description` | Identical |
| `type` | `kind` | Renamed for clarity (`type` = entity discriminator) |
| `status` | `status` | See status mapping below |
| `priority` | `priority` | Identical (0-4) |
| `assignee` | `assignee` | Identical |
| `labels` | `labels` | Identical |
| `dependencies` | `dependencies` | Only "blocks" type in Phase 1 |
| `created_at` | `created_at` | Identical |
| `updated_at` | `updated_at` | Identical |
| `closed_at` | `closed_at` | Identical |
| `due` | `due_date` | Renamed |
| `defer` | `deferred_until` | Renamed |
| `parent` | `parent_id` | Renamed |
| *(implicit)* | `version` | New: conflict resolution |
| *(implicit)* | `type` | New: entity discriminator ("is") |

### 5.4 Status Mapping

| Beads Status | Ceads Status | Migration Behavior |
| --- | --- | --- |
| `open` | `open` | Direct mapping |
| `in_progress` | `in_progress` | Direct mapping |
| `blocked` | `blocked` | Direct mapping |
| `deferred` | `deferred` | Direct mapping |
| `closed` | `closed` | Direct mapping |
| `tombstone` | *(deleted)* | Skip on import or move to attic |

**Tombstone handling:**

Beads uses `tombstone` for soft-deleted issues.
Ceads options:

1. **Skip on import**: Don’t import tombstoned issues (default)

2. **Import as closed**: Convert to `closed` with label `tombstone`

3. **Import to attic**: Store in `.ceads-sync/attic/deleted/`

### 5.5 Compatibility Notes

#### What Works Identically

- Issue creation and updates

- Label management

- Dependency tracking (`blocks` type)

- Priority and status workflows

- Filtering and queries

- `ready` command logic

#### Key Differences

**Storage format:**

- Beads: Single `issues.jsonl` file

- Ceads: File-per-issue in `.ceads-sync/issues/`

**Database:**

- Beads: SQLite cache

- Ceads: Optional index, rebuildable from files

**Daemon:**

- Beads: Required background daemon

- Ceads: No daemon (optional background sync in Phase 2)

**Git integration:**

- Beads: Complex worktree setup

- Ceads: Simple sync branch

**Conflict handling:**

- Beads: JSONL merge conflicts

- Ceads: Field-level merge with attic

**ID format:**

- Beads: `bd-xxxx` (4-6 hex chars)

- Ceads: `is-xxxx` (4-6 hex chars)

  - Display as `bd-xxxx` via `display.id_prefix` config

#### Migration Gotchas

1. **IDs change**: Beads `bd-a1b2` becomes Ceads `is-a1b2` internally

   - Set `display.id_prefix: bd` to show as `bd-a1b2`

   - Old references in commit messages won’t auto-link

2. **No daemon**: Background sync must be manual or cron-based

3. **No auto-flush**: Beads auto-syncs on write

   - Ceads syncs on `cead sync` or with `--auto-sync` config

4. **Tombstone issues**: Decide import behavior (skip/convert/attic)

* * *

## 6. Implementation Notes

### 6.1 Performance Optimization

#### Query Index

**Optional caching layer** (`.ceads/cache/index.json`):

```typescript
interface Index {
  issues: Map<string, IssueSummary>;  // id -> summary
  by_status: Map<string, Set<string>>;
  by_assignee: Map<string, Set<string>>;
  by_label: Map<string, Set<string>>;

  last_updated: Timestamp;
  checksum: string;  // Hash of issues directory
}
```

**Rebuild strategy:**

1. Check if index exists and is fresh (checksum matches)

2. If stale, scan all issue files and rebuild

3. Store in `.ceads/cache/index.json`

4. Cache is gitignored, never synced

**Performance targets:**

- Cold start (no index): <500ms for 5,000 issues

- Warm start (index hit): <50ms for common queries

- Index rebuild: <1s for 10,000 issues

#### File I/O Optimization

- Batch reads when possible

- Atomic writes: temp file + rename

- Lazy loading: only parse JSON when needed

- Streaming for large operations

### 6.2 Testing Strategy

**Unit tests:**

- Schema validation (Zod)

- Merge algorithm

- ID generation

- Timestamp handling

**Integration tests:**

- CLI command parsing

- File I/O

- Git operations

- Sync algorithm

**End-to-end tests:**

- Full workflows (create → update → sync → close)

- Multi-machine sync scenarios

- Conflict resolution

- Beads import

**Platform tests:**

- macOS, Linux, Windows

- Network filesystems (NFS, SMB)

- Cloud environments (simulated)

### 6.3 Migration Path

**Beads → Ceads migration checklist:**

1. ✅ Export Beads data: `bd export > backup.jsonl`

2. ✅ Initialize Ceads: `cead init`

3. ✅ Import: `cead import backup.jsonl`

4. ✅ Verify: `cead list --json | wc -l` matches Beads count

5. ✅ Configure display: `cead config display.id_prefix bd`

6. ✅ Test workflows: create, update, sync

7. ✅ Commit config: `git add .ceads/ && git commit`

8. ✅ Sync team: `git push origin ceads-sync`

9. ✅ Update docs: Replace `bd` with `cead` in scripts (or keep `bd` alias)

**Gradual rollout:**

- Keep Beads running alongside Ceads initially

- Compare outputs (`bd list` vs `cead list`)

- Migrate one team/agent at a time

- Full cutover when confident

* * *

## 7. Appendices

### 7.1 Design Decisions

#### Decision 1: File-per-entity vs JSONL

**Choice**: File-per-entity

**Rationale**:

- Parallel creation has zero conflicts (vs JSONL merge conflicts)

- Git diffs are readable

- Atomic updates per issue

- Scales better (no need to read entire file for one issue)

**Tradeoffs**:

- More inodes (not a problem on modern filesystems)

- Slightly more disk space (negligible)

#### Decision 2: No daemon in Phase 1

**Choice**: Optional daemon, not required

**Rationale**:

- Simpler architecture

- Fewer failure modes

- Works in restricted environments (CI, cloud sandboxes)

- Manual sync is predictable

**Tradeoffs**:

- No automatic background sync

- Users must run `cead sync` manually or via cron

#### Decision 3: Sync branch instead of main

**Choice**: Dedicated `ceads-sync` branch

**Rationale**:

- No merge conflicts on feature branches

- Clean separation of concerns

- Easy to allow-list in sandboxed environments

- Issues shared across all code branches

**Tradeoffs**:

- Slightly more complex git setup

- Users must understand two branches

#### Decision 4: Display ID prefix for Beads compat

**Choice**: Internal `is-xxxx`, display as `bd-xxxx`

**Rationale**:

- Smooth migration from Beads

- Familiar UX for existing users

- Internal prefix distinguishes entity types

**Tradeoffs**:

- Two ID formats to understand

- Config adds complexity

#### Decision 5: Only “blocks” dependencies in Phase 1

**Choice**: Support only `blocks` dependency type

**Rationale**:

- Simpler implementation

- Matches Beads’ primary use case (`ready` command)

- Can add more types later without breaking changes

**Tradeoffs**:

- Can’t express “related” or “discovered-from” relationships yet

#### Decision 6: JSON storage vs Markdown + YAML

**Choice**: JSON files for issue storage (not Markdown + YAML frontmatter)

**Context**: [ticket](https://github.com/wedow/ticket) successfully uses Markdown + YAML
frontmatter, which offers:

- Human-readable format

- Direct editing in IDEs

- Better for long-form descriptions

- AI agents can search without context bloat

**Rationale for JSON**:

- **Structured merging**: Field-level conflict resolution easier with pure data

- **Schema validation**: Zod schemas ensure type safety

- **Language-agnostic**: All languages have excellent JSON parsers

- **Atomic operations**: Easier to read/write partial fields without parsing text

- **Consistency**: Same format for all entity types (issues, future agents/messages)

- **Performance**: Faster parsing for bulk operations

**Tradeoffs**:

- Less human-readable than Markdown

- Can’t edit descriptions in Markdown editors as easily

- Issue descriptions lack formatting (no headings, lists, code blocks)

**Mitigation**:

- Description field supports Markdown syntax (stored as string)

- `cead show` can render Markdown

- Future: `cead edit <id>` opens in $EDITOR with Markdown preview

**Credit**: ticket’s Markdown approach is elegant for simple workflows.
Ceads chooses JSON for multi-environment sync robustness, but we may add Markdown
export/import in Phase 2 for best of both worlds.

### 7.2 Future Enhancements (Phase 2+)

#### Additional Dependency Types (High Priority)

Phase 1 only supports `blocks` dependencies.
Phase 2 should add:

**`related`**: Link related issues without blocking semantics

- Use case: “See also” references, grouping related work

- No effect on `ready` command

**`discovered-from`**: Track issue provenance

- Use case: When working on issue A, agent discovers issue B

- Pattern: `cead create "Found bug" --deps discovered-from:<parent-id>`

- Common in Beads workflows for linking discovered work to parent issues

**Implementation**: Extend `Dependency.type` enum, update CLI `--deps` parsing.
No changes to sync algorithm needed.

#### Agent Registry

**Entities**: `agents/` collection on sync branch

**Use cases**:

- Track which agents are working on what

- Agent capabilities and metadata

- Heartbeats and presence (ephemeral)

#### Comments/Messages

**Entities**: `messages/` collection on sync branch

**Use cases**:

- Comments on issues

- Agent-to-agent messaging

- Threaded discussions

#### GitHub Bridge

**Architecture**:

- Optional bridge process

- Webhook-driven sync

- Outbox/inbox pattern

- Rate limit aware

**Use cases**:

- Mirror issues to GitHub for visibility

- Sync comments bidirectionally

- Trigger workflows on issue changes

#### Real-time Coordination

**Components**:

- WebSocket presence service

- Atomic claim leases

- Live updates

**Use cases**:

- Sub-second coordination

- Multiple agents on same codebase

- Distributed teams

#### Workflow Automation

**Entities**: `workflows/` collection

**Use cases**:

- Multi-step procedures

- State machines

- Triggers and actions

#### Time Tracking

**Fields**: `time_estimate`, `time_spent`

**Use cases**:

- Effort estimation

- Sprint planning

- Agent performance metrics

### 7.3 File Structure Reference

**Complete file tree after `cead init`:**

```
repo/
├── .git/
├── .ceads/                         # On main branch
│   ├── config.yml                  # Tracked: project config
│   ├── .gitignore                  # Tracked: ignores cache/
│   └── cache/                      # Gitignored: local only
│       ├── index.json              # Optional query cache
│       └── sync.lock               # Optional sync coordination
│
└── (on ceads-sync branch)
    └── .ceads-sync/
        ├── issues/                 # Issue entities
        │   ├── is-a1b2.json
        │   └── is-f14c.json
        ├── attic/                  # Conflict archive
        │   └── conflicts/
        │       └── is-a1b2/
        │           └── 2025-01-07T10-30-00Z_description.json
        └── meta.json               # Metadata
```

**File counts (example with 1,000 issues):**

| Location | Files | Size |
| --- | --- | --- |
| `.ceads/` | 3 | <1 KB |
| `.ceads/cache/` | 1-2 | <500 KB |
| `.ceads-sync/issues/` | 1,000 | ~2 MB |
| `.ceads-sync/attic/` | 10-50 | <100 KB |

* * *

**End of Ceads V2 Phase 1 Design Specification**
