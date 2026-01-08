# Ceads: A Simple Git-Native Coordination System for AI Agents

**Author:** Joshua Levy (github.com/jlevy) and various LLMs

**Status**: Draft

**Date**: January 2025

> *The name “Ceads” (pronounced “seeds”) follows Steve Yegge’s “Beads” in the spirit of
> C following (and learning from) B.*

* * *

## Table of Contents

1. [Introduction](#1-introduction)

   - [Motivation](#11-motivation)

   - [Design Principles](#12-design-principles)

   - [Design Constraints](#13-design-constraints)

   - [Layer Overview](#14-layer-overview)

2. [File Layer](#2-file-layer)

   - [Overview](#21-overview)

   - [Directory Structure](#22-directory-structure)

   - [Entity Collection Pattern](#23-entity-collection-pattern)

   - [ID Generation](#24-id-generation)

   - [Schemas](#25-schemas)

3. [Git Layer](#3-git-layer)

   - [Overview](#31-overview)

   - [Sync Branch Architecture](#32-sync-branch-architecture)

   - [Sync Operations](#33-sync-operations)

   - [Conflict Detection and Resolution](#34-conflict-detection-and-resolution)

   - [Merge Rules](#35-merge-rules)

   - [Merge Algorithm](#36-merge-algorithm)

   - [Attic Structure](#37-attic-structure)

4. [CLI Layer](#4-cli-layer)

   - [Overview](#41-overview)

   - [Command Structure](#42-command-structure)

   - [Initialization](#43-initialization)

   - [Issue Commands](#44-issue-commands)

   - [Agent Commands](#45-agent-commands)

   - [Local Commands](#46-local-commands)

   - [Sync Commands](#47-sync-commands)

   - [Attic Commands](#48-attic-commands)

   - [Global Options](#49-global-options)

   - [Output Formats](#410-output-formats)

5. [Bridge Layer (Future)](#5-bridge-layer-future)

   - [Overview](#51-overview)

   - [Bridge Architecture](#52-bridge-architecture)

   - [GitHub Issues Bridge](#53-github-issues-bridge)

   - [Slack Bridge](#54-slack-bridge)

   - [Native Bridge](#55-native-bridge)

   - [Local UI Bridge](#56-local-ui-bridge)

   - [Bridge CLI Commands](#57-bridge-cli-commands)

   - [Offline-First Architecture](#58-offline-first-architecture)

6. [Implementation Notes](#6-implementation-notes)

   - [Daemon (Optional)](#61-daemon-optional)

   - [Use Cases by Complexity](#62-use-cases-by-complexity)

   - [Examples](#63-examples)

   - [Other Potential Layers](#64-other-potential-layers-not-specified)

7. [Appendices](#7-appendices)

   - [Design Decisions](#71-design-decisions)

   - [Open Questions](#72-open-questions)

   - [Migration from Beads](#73-migration-from-beads)

   - [Comparison with Beads](#74-comparison-with-beads)

   - [File Structure Reference](#75-file-structure-reference)

   - [Key References](#76-key-references)

* * *

## 1. Introduction

### 1.1 Motivation

[Beads](https://github.com/steveyegge/beads) provides git-backed issue tracking for AI
coding agents. While useful, its architecture has accumulated complexity:

- **4-location data sync**: SQLite → Local JSONL → Sync Branch → Main Branch

- **Skip-worktree hacks**: Hide tracked files from `git status` while daemon modifies
  them

- **Worktree complexity**: Separate git worktrees to commit to sync branch without
  checkout; depending on configuration, you can’t manually check out “main”

- **Daemon-user conflicts**: Background process fights manual git operations

- **Tight coupling**: Adding new entity types requires changes throughout the sync layer

**Ceads** (pronounced “seeds”) takes a simpler approach:

1. **The file system is the database, git is the sync protocol.** Each entity is a file.
   Directories are collections.
   Git handles distribution.

2. **Sync should be schema-agnostic.** The sync layer operates on directories of JSON
   files. Adding new entity types (agents, messages, workflows) requires only a new
   directory and schema—no sync code changes.

3. **Coordination is just more entities.** Multi-agent work requires messaging, agent
   registry, and work claims.
   With schema-agnostic sync, these are just more entity types (`agents/`, `messages/`)
   using the same pattern—no separate message queue or coordination service needed.

### 1.2 Design Principles

1. **File system as truth**: Each entity is a JSON file.
   The file system is the canonical state.

2. **Schema-agnostic sync**: Sync layer moves files, doesn’t interpret them.

3. **Layered architecture**: File Layer (format) → Git Layer (sync) → CLI Layer
   (interface) → Bridge Layer (real-time).

4. **Progressive complexity**: Single-agent workflows need no daemon or bridges.
   Multi-agent work adds them as needed.

5. **No data loss**: Conflicts preserve both versions via attic mechanism.

6. **Extensible by convention**: New entity types follow the same pattern.

### 1.3 Design Constraints

These constraints guide architectural decisions throughout the system:

1. **Works with plain filesystems**: [SQLite WAL](https://sqlite.org/wal.html)
   (Write-Ahead Logging) mode requires shared memory via `mmap()` and POSIX advisory
   locking, which fail or behave incorrectly on network file systems (NFS, SMB),
   cloud-mounted volumes, and containerized environments like Claude Code Cloud.
   This causes “database is locked” errors, corruption, and stale reads.
   The system must work reliably on any file system without special locking
   requirements.

2. **Query performance: <50ms for common operations** Listing open issues, finding ready
   work, and similar queries must complete in under 50 milliseconds for projects with up
   to 5,000 issues.

3. **Cross-language file format compatibility** All file formats must be readable from
   TypeScript, Python, and Rust using standard libraries.
   No proprietary or language-specific formats.

4. **Scale target: 5,000-10,000 issues** The system is designed for typical software
   projects. Performance beyond this range is not a design goal for v1.

5. **File system as source of truth** JSON entity files are canonical.
   Any index or cache is derived and can be rebuilt from entity files at any time.

6. **Cross-platform portability** The system must run on macOS, Linux, and Windows
   without platform-specific code paths.
   Implementations should be written in platform-agnostic languages (TypeScript, Python,
   Rust, Go) using standard libraries.
   Must work in local development, cloud-hosted IDEs (Claude Code Cloud, GitHub
   Codespaces), and CI environments.

### 1.4 Layer Overview

Ceads is organized into distinct layers, each with clear responsibilities:

```
┌─────────────────────────────────────────────────────────────────┐
│                      Bridge Layer (Future)                       │
│                      Real-time coordination                      │
│   GitHub Issues │ Slack │ Native Hosted │ ...                   │
└──────────────────────────────┬───────────────────────────────────┘
                               │
┌──────────────────────────────┼───────────────────────────────────┐
│                        CLI Layer                                 │
│                        User/agent interface                      │
│   cead <command> [args] [options]                               │
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

**File Layer**: Defines the format—JSON schemas, directory structure, ID generation.
Storage-agnostic; could theoretically work with any backend.

**Git Layer**: Defines sync using standard git commands.
The `ceads-sync` branch, push/pull operations, merge algorithm.

**CLI Layer**: Defines the command interface for users and agents.
Wraps File and Git layers.

**Bridge Layer** (Future): Real-time coordination via external services (GitHub Issues,
Slack, etc.). Optional; system works fully without it.

**Other potential layers** (not specified here):

- MCP Layer: [Model Context Protocol](https://modelcontextprotocol.io/) tools wrapping
  CLI

- Agent Tool Layer: Definitions for [LangChain](https://www.langchain.com/),
  [CrewAI](https://www.crewai.com/), etc.

- API Layer: TypeScript/Python/Rust library bindings

- Watch Layer: File system watching for UIs/IDEs

* * *

## 2. File Layer

### 2.1 Overview

The File Layer defines **what** entities look like—their schemas, directory layout, and
naming conventions. It makes no assumptions about how files are stored or synced.

Key properties:

- **[Zod](https://zod.dev/) schemas are normative**: TypeScript Zod definitions are the
  specification. Implementations in other languages should produce equivalent JSON.

- **Storage-agnostic**: Could work with local filesystem, S3, or any key-value store.

- **Self-documenting files**: Each JSON file contains a `type` field identifying its
  entity type, making files meaningful in isolation.

### 2.2 Directory Structure

Ceads uses two directories with a clear separation of concerns:

- **`.ceads/`** on the main branch (and all working branches): Configuration and local
  files
- **`.ceads-sync/`** on the `ceads-sync` branch: Synced data (entities, attic, metadata)

#### On Main Branch (all working branches)

```
.ceads/
├── config.yml              # Project configuration (tracked)
├── .gitignore              # Ignores everything except config (tracked)
│
│   # Everything below is gitignored (local/transient):
├── local/                  # Private workspace (never synced)
│   └── lo-l1m2.json
├── cache/                  # Bridge cache
│   ├── outbound/           # Queue: bridge messages to send
│   ├── inbound/            # Buffer: recent bridge messages
│   └── state.json          # Connection state
├── daemon.sock             # Daemon Unix socket
├── daemon.pid              # Daemon PID file
└── daemon.log              # Daemon log file
```

#### On `ceads-sync` Branch

```
.ceads-sync/
├── nodes/                     # Shared graph entities
│   ├── issues/                # Issue nodes
│   │   ├── is-a1b2.json
│   │   └── is-f14c.json
│   ├── agents/                # Agent nodes
│   │   ├── ag-x1y2.json
│   │   └── ag-a3b4.json
│   └── messages/              # Message nodes
│       ├── ms-p1q2.json       # Comment on issue is-a1b2
│       └── ms-r3s4.json
├── attic/                     # Archive
│   ├── conflicts/             # Merge conflict losers
│   │   └── is-a1b2/
│   │       └── 2025-01-07T10-30-00Z_description.json
│   └── orphans/               # Integrity violations
└── meta.json                  # Runtime metadata (last_sync, schema_versions)
```

> **Note on directory split**: The `.ceads/` directory on main contains configuration
> (which versions with your code) and local-only files (which are gitignored). The
> `.ceads-sync/` directory on the sync branch contains all shared data. This separation
> ensures synced data never causes merge conflicts on your working branches.

> **Note on "nodes"**: The `nodes/` directory contains entities that form the shared
> coordination graph—issues, agents, messages, and future entity types.
> These are interconnected (dependencies, `in_reply_to`, `working_on`) and synced across
> machines. The `local/` directory is explicitly outside this graph—a private workspace
> that is never synced.

### 2.3 Entity Collection Pattern

Ceads uses a uniform pattern for all node types.
Each collection is:

1. **A directory** under `.ceads-sync/nodes/` (on the sync branch)

2. **A Zod schema** defining the entity structure

3. **An ID prefix** derived from the directory name

#### Adding a New Node Type

To add a new node type (e.g., `workflows`):

1. Create directory: `.ceads-sync/nodes/workflows/` (on sync branch)

2. Define schema: `WorkflowSchema` in Zod

3. Define ID prefix: `wf-` (derived from directory name)

4. Define merge rules in Git Layer (usually: LWW for scalars, union for arrays)

5. Add CLI commands: `cead workflow create`, etc.

**No changes to Git sync algorithm required.** Sync operates on files, not schemas.
Only the merge rules (in Git Layer) need updating for new node types.

#### Built-in Node Collections (on sync branch)

| Collection | Directory | Internal Prefix | Purpose |
| --- | --- | --- | --- |
| Issues | `.ceads-sync/nodes/issues/` | `is-` | Task tracking |
| Agents | `.ceads-sync/nodes/agents/` | `ag-` | Agent registry |
| Messages | `.ceads-sync/nodes/messages/` | `ms-` | Comments on issues (and future messaging) |

#### Non-Node Collections (on main branch, gitignored)

| Collection | Directory | Internal Prefix | Purpose |
| --- | --- | --- | --- |
| Local | `.ceads/local/` | `lo-` | Private workspace (never synced) |

> **Note**: Local items use the same entity pattern but are not "nodes" because they are
> not part of the shared coordination graph. They live in `.ceads/local/` on the main
> branch and are gitignored—never synced.

#### Future Node Collections (Examples)

| Collection | Directory | Internal Prefix | Purpose |
| --- | --- | --- | --- |
| Templates | `.ceads-sync/nodes/templates/` | `tp-` | Issue templates |
| Workflows | `.ceads-sync/nodes/workflows/` | `wf-` | Multi-step procedures |
| Artifacts | `.ceads-sync/nodes/artifacts/` | `ar-` | File attachments |

> **Note**: Messages support comments on issues and replies to other messages via
> `in_reply_to`. Messages are time-sorted by `created_at`. Future extensions (threading
> UI, ephemeral messages, Bridge Layer real-time delivery) are not specified here.
> See [Decision 10](#decision-10-messages-as-unified-commentmessage-model) for rationale
> and [Bridge Layer](#5-bridge-layer-future) for real-time messaging discussion.

### 2.4 ID Generation

Entity IDs follow a consistent pattern:

```
{prefix}-{hash}
```

- **Prefix**: 2-3 lowercase letters derived from directory name (`is-`, `ag-`, `lo-`)

- **Hash**: Lowercase alphanumeric, typically 4-8 characters

Example: `is-a1b2`, `ag-x1y2`, `lo-p3q4`

#### Internal vs External Prefixes

- **Internal prefixes** match directory names and appear in filenames.
  They are immutable.

- **External prefixes** are configurable aliases for CLI/UI display.

| Internal | External (default) | Notes |
| --- | --- | --- |
| `is-` | `cd-` | Issues display as `cd-xxxx` |
| `ag-` | `agent-` | Agents display as `agent-xxxx` |
| `ms-` | `msg-` | Messages display as `msg-xxxx` |
| `lo-` | `local-` | Local items display as `local-xxxx` |

The CLI accepts both forms and translates automatically.
Internal prefixes are used in file references and cross-entity links.

### 2.5 Schemas

Schemas are defined in Zod (TypeScript) as the normative specification.
Implementations in other languages should produce equivalent JSON.

#### 2.5.1 Common Types

```typescript
import { z } from 'zod';

// ISO8601 timestamp
const Timestamp = z.string().datetime();

// Hash-based ID with prefix
const EntityId = z.string().regex(/^[a-z]+-[a-z0-9]+$/);

// Version counter for optimistic concurrency
const Version = z.number().int().nonnegative();

// Entity type discriminator - matches directory prefix
const EntityType = z.enum(['is', 'ag', 'lo', 'ms']);
```

#### 2.5.2 BaseEntity

All entities share common fields:

```typescript
const BaseEntity = z.object({
  type: EntityType,           // Discriminator: "is", "ag", "lo", "ms"
  id: EntityId,
  version: Version,
  created_at: Timestamp,
  updated_at: Timestamp,
});
```

> **Note on `type` field**: Every entity includes a `type` field that matches its
> directory prefix (e.g., `"is"` for issues in `issues/`). This makes JSON files
> self-documenting—you can identify what kind of entity a file contains without knowing
> its path.

#### 2.5.3 IssueSchema

```typescript
const DependencyType = z.enum(['blocks', 'related', 'discovered-from']);

const Dependency = z.object({
  type: DependencyType,
  target: EntityId,
});

const IssueStatus = z.enum(['open', 'in_progress', 'blocked', 'deferred', 'closed']);
const IssueKind = z.enum(['bug', 'feature', 'task', 'epic', 'chore']);
const Priority = z.number().int().min(0).max(4);

const IssueSchema = BaseEntity.extend({
  type: z.literal('is'),                        // Entity type discriminator
  kind: IssueKind.default('task'),              // Issue classification

  title: z.string().min(1).max(500),
  description: z.string().max(50000).optional(),
  notes: z.string().max(50000).optional(),      // Working notes
  status: IssueStatus.default('open'),
  priority: Priority.default(2),

  assignee: z.string().optional(),
  labels: z.array(z.string()).default([]),
  dependencies: z.array(Dependency).default([]),

  // Parent-child relationship for hierarchical issues
  parent_id: EntityId.optional(),               // If this is a child issue
  sequence: z.array(EntityId).optional(),       // Ordered list of child IDs

  created_by: z.string().optional(),
  closed_at: Timestamp.optional(),
  close_reason: z.string().optional(),
});

type Issue = z.infer<typeof IssueSchema>;
```

> **Note on `type` vs `kind`**: The `type` field is the entity discriminator (`"is"` for
> all issues). The `kind` field classifies the issue (bug, feature, task, etc.). This
> separation avoids overloading `type` with two meanings.

> **Note on comments**: Comments are stored as separate Message entities (see
> [MessageSchema](#256-messageschema)) with `in_reply_to` pointing to the issue ID. To
> retrieve comments: query all messages where `in_reply_to == issue_id`.

#### 2.5.4 AgentSchema

```typescript
const AgentStatus = z.enum(['active', 'idle', 'inactive']);

const FileReservation = z.object({
  path: z.string(),           // Glob pattern, e.g., "src/auth/**"
  exclusive: z.boolean(),
  expires_at: Timestamp,
  reason: z.string().optional(),  // Usually issue ID
});

const AgentSchema = BaseEntity.extend({
  type: z.literal('ag'),                          // Entity type discriminator

  display_name: z.string(),
  status: AgentStatus.default('active'),
  last_heartbeat: Timestamp,

  working_on: z.array(EntityId).default([]),  // Issue IDs
  file_reservations: z.array(FileReservation).default([]),

  capabilities: z.array(z.string()).default([]),  // e.g., ["code", "test", "review"]
  metadata: z.record(z.unknown()).default({}),    // Arbitrary agent-specific data
});

type Agent = z.infer<typeof AgentSchema>;
```

#### 2.5.5 LocalSchema

Local entities are private workspace items (todo lists, scratch notes, etc.)
that are never synced.
They use a similar structure to issues but live in `local/`.

```typescript
const LocalSchema = BaseEntity.extend({
  type: z.literal('lo'),                         // Entity type discriminator

  title: z.string().min(1).max(500),
  description: z.string().max(50000).optional(),
  status: IssueStatus.default('open'),
  priority: Priority.default(2),
  kind: IssueKind.default('task'),

  labels: z.array(z.string()).default([]),

  // Parent-child relationship for hierarchical items
  parent_id: EntityId.optional(),
  sequence: z.array(EntityId).optional(),
});

type Local = z.infer<typeof LocalSchema>;
```

> **Note**: An agent can use `local/` for ephemeral work and later “promote” items to
> `issues/` by copying the file (with new ID) if they become worth tracking.

#### 2.5.6 MessageSchema

Messages are standalone entities used for comments on issues and replies to other
messages. Each message has a subject and body (both required), similar to email.
Messages reference their parent via `in_reply_to`.

```typescript
const MessageSchema = BaseEntity.extend({
  type: z.literal('ms'),                          // Entity type discriminator

  subject: z.string().min(1).max(500),            // Required: like email subject
  body: z.string().min(1).max(50000),             // Required: message content

  author: z.string(),                             // Who wrote the message
  in_reply_to: EntityId,                          // Parent: issue ID or message ID
});

type Message = z.infer<typeof MessageSchema>;
```

**Design notes:**

- **Subject required**: Encourages descriptive headers, improves UI/list views

- **Body required**: Every message should have content

- **`in_reply_to`**: Points to an issue (e.g., `"is-a1b2"`) for comments, or to another
  message (e.g., `"ms-c3d4"`) for replies.
  This enables basic threading.

- **Time-ordered**: Messages sort by `created_at`—no explicit sequence needed

- **No status/priority**: Messages don’t have workflow states like issues

- **No explicit threading features**: Threading emerges from `in_reply_to` chains, but
  v1 displays comments as a flat time-sorted list

**Querying comments:**

```typescript
// All comments on an issue (direct replies only)
messages.filter(m => m.in_reply_to === 'is-a1b2')

// All messages in a thread (recursive)
function getThread(parentId: string): Message[] {
  const direct = messages.filter(m => m.in_reply_to === parentId);
  return direct.flatMap(m => [m, ...getThread(m.id)]);
}
```

See [Decision 10](#decision-10-messages-as-unified-commentmessage-model) for rationale.

#### 2.5.7 ConfigSchema

Project configuration stored in `.ceads/config.yml` on the main branch. This is the
human-editable configuration file that versions with your code.

```yaml
# .ceads/config.yml
# See: https://github.com/[org]/ceads

ceads_version: "0.1.0"

sync:
  branch: ceads-sync       # Branch name for synced data
  # repo: origin           # Remote repository (default: origin)

# Display aliases for entity IDs (internal → external)
prefixes:
  is: cd                   # issues display as cd-xxxx
  ag: agent                # agents display as agent-xxxx
  ms: msg                  # messages display as msg-xxxx
  lo: local                # local items display as local-xxxx

# Runtime settings
settings:
  heartbeat_ttl_seconds: 300   # Agent heartbeat timeout
  message_ttl_days: 7          # Message cache retention
```

```typescript
// TypeScript schema for config.yml validation
const SyncConfig = z.object({
  branch: z.string().default('ceads-sync'),
  repo: z.string().default('origin'),
});

const ConfigSchema = z.object({
  ceads_version: z.string(),
  sync: SyncConfig.default({}),
  prefixes: z.record(z.string(), z.string()).default({
    is: 'cd',
    ag: 'agent',
    ms: 'msg',
    lo: 'local',
  }),
  settings: z.object({
    heartbeat_ttl_seconds: z.number().default(300),
    message_ttl_days: z.number().default(7),
  }).default({}),
});

type Config = z.infer<typeof ConfigSchema>;
```

> **Note**: Configuration is stored in YAML format for human editability (comments,
> cleaner syntax). The CLI validates config.yml against ConfigSchema on startup.

#### 2.5.8 MetaSchema

Runtime metadata stored in `.ceads-sync/meta.json` on the sync branch. This file tracks
sync state and schema versions—it is managed by the system, not edited by users.

```typescript
const SchemaVersion = z.object({
  collection: z.string(),
  version: z.number().int(),
});

const MetaSchema = z.object({
  schema_versions: z.array(SchemaVersion),
  created_at: Timestamp,
  last_sync: Timestamp.optional(),
});

type Meta = z.infer<typeof MetaSchema>;
```

> **Note**: User-editable configuration (prefixes, TTLs, sync settings) is now in
> `.ceads/config.yml` on the main branch. See [ConfigSchema](#257-configschema).

#### 2.5.9 AtticEntrySchema

Preserved conflict losers:

```typescript
const AtticEntrySchema = z.object({
  entity_id: EntityId,
  timestamp: Timestamp,
  field: z.string().optional(),      // If single field, otherwise full entity
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

type AtticEntry = z.infer<typeof AtticEntrySchema>;
```

* * *

## 3. Git Layer

### 3.1 Overview

The Git Layer defines **how** files are synchronized across machines using standard git
commands. It operates on the File Layer without interpreting entity content beyond the
`version` field.

Key properties:

- **Schema-agnostic**: Sync moves files, doesn’t interpret schemas

- **Standard git CLI**: All operations expressible as git commands

- **ceads-sync branch**: Dedicated branch for Ceads data, never pollutes main

- **Version-based conflict detection**: Only `version` field needed for sync decisions

### 3.2 Sync Branch Architecture

Ceads uses a split architecture with configuration on main and data on a sync branch:

```
main branch:                    ceads-sync branch:
├── src/                        └── .ceads-sync/
├── tests/                          ├── nodes/
├── README.md                       │   ├── issues/
├── .ceads/                         │   ├── agents/
│   ├── config.yml (tracked)        │   └── messages/
│   └── .gitignore (tracked)        ├── attic/
│   └── local/     (gitignored)     └── meta.json
│   └── cache/     (gitignored)
│   └── daemon.*   (gitignored)
└── ...
```

#### Why This Architecture?

1. **Discoverable**: Clone repo, see `.ceads/config.yml`, know ceads is configured

2. **Config versions with code**: Configuration changes can be part of PRs

3. **No sync conflicts on main**: All synced data is on a separate branch

4. **No skip-worktree hacks**: Local files are gitignored within `.ceads/`

5. **No git worktrees needed**: Sync uses
   [git plumbing commands](https://git-scm.com/book/en/v2/Git-Internals-Plumbing-and-Porcelain),
   not checkout

6. **Issues shared across code branches**: All feature branches see the same issues

#### Files Tracked on Main Branch

```
.ceads/config.yml       # Project configuration (YAML)
.ceads/.gitignore       # Ignores local/cache/daemon files
```

#### .ceads/.gitignore Contents

```gitignore
# Ignore everything in .ceads/ except config files
*
!.gitignore
!config.yml
```

#### Files Tracked on ceads-sync Branch

```
.ceads-sync/nodes/      # All node types (issues, agents, messages)
.ceads-sync/attic/      # Conflict and orphan archive
.ceads-sync/meta.json   # Runtime metadata
```

#### Files Never Tracked (Local Only)

These live in `.ceads/` on main but are gitignored:

```
.ceads/local/           # Private workspace
.ceads/cache/           # Bridge cache (outbound, inbound, state)
.ceads/daemon.sock      # Daemon socket
.ceads/daemon.pid       # Daemon PID
.ceads/daemon.log       # Daemon log
```

### 3.3 Sync Operations

Sync operations use standard git commands.
The key insight is that we can read and write to the sync branch without checking it
out.

#### 3.3.1 Version Extraction

Sync only needs to read the `version` field from JSON files:

```typescript
function parseVersion(content: string): number {
  const obj = JSON.parse(content);
  return typeof obj.version === 'number' ? obj.version : 0;
}
```

#### 3.3.2 Reading from Sync Branch

```bash
# Read a file from sync branch without checkout
git show ceads-sync:.ceads-sync/nodes/issues/is-a1b2.json

# List files in a directory on sync branch
git ls-tree ceads-sync .ceads-sync/nodes/issues/
```

#### 3.3.3 File-Level Sync Algorithm

For each file, compare local and remote versions:

```
SYNC_FILE(local_path, sync_path):
  local = read_file(local_path)                    # May be null (in .ceads/local/)
  remote = git show ceads-sync:{sync_path}         # May be null (in .ceads-sync/)

  if local is null and remote is null:
    return  # Nothing to do

  if local is null:
    # New from remote - copy to local cache
    git show ceads-sync:{sync_path} > local_path
    return

  if remote is null:
    # New from local - stage for push
    stage_for_push(local_path)
    return

  # Both exist - compare versions
  local_ver = parse_version(local)
  remote_ver = parse_version(remote)

  if local_ver > remote_ver:
    stage_for_push(local_path)      # Local is newer
  else if remote_ver > local_ver:
    write_local(remote)             # Remote is newer
  else:
    # Same version - check content hash
    if hash(local) != hash(remote):
      merged = merge_entities(local, remote)
      write_local(merged)
      stage_for_push(merged)
    # else: identical, no action
```

#### 3.3.4 Pull Operation

Fetch remote changes and apply to local cache:

```bash
# 1. Fetch latest sync branch
git fetch origin ceads-sync

# 2. For each collection, sync files from .ceads-sync/ to local cache
#    (implementation iterates and applies SYNC_FILE)

# 3. Update .ceads-sync/meta.json with last_sync timestamp
```

Expressed as git commands:

```bash
# Fetch
git fetch origin ceads-sync

# Get list of remote files
git ls-tree -r --name-only origin/ceads-sync .ceads-sync/

# Read specific remote file
git show origin/ceads-sync:.ceads-sync/nodes/issues/is-a1b2.json

# Copy remote file to local cache (if remote is newer)
# Note: local cache is in .ceads/cache/ or memory, not .ceads-sync/
git show origin/ceads-sync:.ceads-sync/nodes/issues/is-a1b2.json
```

#### 3.3.5 Push Operation

Push local changes to remote sync branch:

```bash
# 1. Fetch to ensure we have latest
git fetch origin ceads-sync

# 2. Sync all collections (may pull remote changes first)

# 3. Create a tree with updated files
git read-tree ceads-sync
git add .ceads-sync/nodes/ .ceads-sync/attic/ .ceads-sync/meta.json
git write-tree

# 4. Create commit on sync branch
git commit-tree <tree> -p ceads-sync -m "ceads sync: $(date -Iseconds)"

# 5. Update sync branch ref
git update-ref refs/heads/ceads-sync <commit>

# 6. Push to remote
git push origin ceads-sync

# If push rejected (non-fast-forward):
#   Pull, merge, retry (max 3 attempts)
```

#### 3.3.6 Sync Triggers

| Trigger | Action |
| --- | --- |
| `cead sync` command | Immediate full sync |
| Daemon sync interval | Periodic background sync |
| Agent shutdown | Final sync before exit |

### 3.4 Conflict Detection and Resolution

#### When Conflicts Occur

Conflicts happen when the same file is modified in two places before sync:

- Two agents update the same issue simultaneously

- Same agent works on two machines, both modify before sync

#### Detection

```
Same version + different content hash = conflict
```

If `local.version == remote.version` but file contents differ, a merge is needed.

#### Resolution Flow

```
1. Detect: same version, different hash
2. Parse both versions as JSON
3. Apply merge rules (from section 3.5)
4. Increment version: max(local.version, remote.version) + 1
5. Write merged result locally
6. Stage merged result for push
7. Save loser values to attic (if lww_with_attic)
```

### 3.5 Merge Rules

When the same entity is modified in two places, field-level merge rules determine the
outcome. Merge rules are defined per entity type and applied during conflict resolution.

#### Merge Strategies

| Strategy | Behavior | Used For |
| --- | --- | --- |
| `immutable` | Error if different | `type` field |
| `lww` | Last-write-wins by `updated_at` | Scalars (title, status, priority) |
| `lww_with_attic` | LWW, but preserve loser in attic | Long text (description), ordered arrays (sequence) |
| `union` | Combine both arrays, dedupe | Arrays of primitives (labels) |
| `merge_by_id` | Merge arrays by item ID | Arrays of objects (comments, dependencies) |
| `max_plus_one` | `max(local, remote) + 1` | `version` field |
| `recalculate` | Fresh timestamp | `updated_at` field |

#### Issue Merge Rules

```typescript
const issueMergeRules: MergeRules<Issue> = {
  type: { strategy: 'immutable' },
  kind: { strategy: 'lww' },
  title: { strategy: 'lww' },
  description: { strategy: 'lww_with_attic' },
  notes: { strategy: 'lww_with_attic' },
  status: { strategy: 'lww' },
  priority: { strategy: 'lww' },
  assignee: { strategy: 'lww' },
  labels: { strategy: 'union' },
  dependencies: { strategy: 'merge_by_id', key: (d) => `${d.type}:${d.target}` },
  parent_id: { strategy: 'lww' },
  sequence: { strategy: 'lww_with_attic' },
  close_reason: { strategy: 'lww' },
};
```

#### Agent Merge Rules

```typescript
const agentMergeRules: MergeRules<Agent> = {
  type: { strategy: 'immutable' },
  display_name: { strategy: 'lww' },
  status: { strategy: 'lww' },
  last_heartbeat: { strategy: 'lww' },  // Most recent wins
  working_on: { strategy: 'union' },
  file_reservations: { strategy: 'merge_by_id', key: (r) => r.path },
  capabilities: { strategy: 'union' },
  metadata: { strategy: 'lww' },
};
```

#### Message Merge Rules

```typescript
const messageMergeRules: MergeRules<Message> = {
  type: { strategy: 'immutable' },
  subject: { strategy: 'lww' },
  body: { strategy: 'lww_with_attic' },
  author: { strategy: 'immutable' },      // Author cannot change
  in_reply_to: { strategy: 'immutable' }, // Parent cannot change
};
```

### 3.6 Merge Algorithm

The merge algorithm applies the rules defined above:

```typescript
function mergeEntities<T extends BaseEntity>(
  local: T,
  remote: T,
  rules: MergeRules<T>
): { merged: T; atticEntries: AtticEntry[] } {
  const atticEntries: AtticEntry[] = [];

  const merged = {
    ...local,
    version: Math.max(local.version, remote.version) + 1,
    updated_at: new Date().toISOString(),
  };

  for (const [field, rule] of Object.entries(rules)) {
    const localVal = local[field];
    const remoteVal = remote[field];

    switch (rule.strategy) {
      case 'immutable':
        if (localVal !== remoteVal) {
          throw new Error(`Immutable field ${field} differs`);
        }
        break;

      case 'lww':
        merged[field] = local.updated_at >= remote.updated_at
          ? localVal
          : remoteVal;
        break;

      case 'lww_with_attic':
        if (localVal !== remoteVal) {
          const localWins = local.updated_at >= remote.updated_at;
          merged[field] = localWins ? localVal : remoteVal;
          atticEntries.push({
            entity_id: local.id,
            field,
            lost_value: localWins ? remoteVal : localVal,
            winner_source: localWins ? 'local' : 'remote',
            loser_source: localWins ? 'remote' : 'local',
            timestamp: new Date().toISOString(),
            context: {
              local_version: local.version,
              remote_version: remote.version,
              local_updated_at: local.updated_at,
              remote_updated_at: remote.updated_at,
            },
          });
        }
        break;

      case 'union':
        merged[field] = [...new Set([...localVal, ...remoteVal])];
        break;

      case 'merge_by_id':
        merged[field] = mergeArraysById(localVal, remoteVal, rule.key);
        break;
    }
  }

  return { merged, atticEntries };
}

function mergeArraysById<T>(
  local: T[],
  remote: T[],
  keyFn: (item: T) => string
): T[] {
  const merged = new Map<string, T>();

  // Add all local items
  for (const item of local) {
    merged.set(keyFn(item), item);
  }

  // Add remote items (overwrites if same key)
  for (const item of remote) {
    const key = keyFn(item);
    if (!merged.has(key)) {
      merged.set(key, item);
    }
    // If both have same key, keep local (could also compare timestamps)
  }

  return [...merged.values()];
}
```

### 3.7 Attic Structure

The attic preserves data that would otherwise be lost, enabling recovery and auditing.
It lives on the sync branch in `.ceads-sync/attic/`.

#### Directory Layout

```
.ceads-sync/attic/
├── conflicts/                 # Merge conflict losers
│   ├── is-a1b2/
│   │   ├── 2025-01-07T10-30-00Z_description.json
│   │   └── 2025-01-07T11-45-00Z_full.json
│   └── is-f14c/
│       └── 2025-01-08T09-15-00Z_status.json
└── orphans/                   # Integrity violations
    └── ms-x1y2.json           # Message pointing to deleted issue
```

#### Conflicts Directory

Stores data lost during merge conflicts:

- Directory per entity (using internal prefix): `conflicts/{entity-id}/`

- Filename: `{timestamp}_{field}.json` or `{timestamp}_full.json`

#### Orphans Directory

Stores entities with broken references (integrity violations):

- Messages pointing to deleted issues

- Dependencies referencing non-existent targets

- Agents with `working_on` pointing to missing issues

Orphans are detected during sync or integrity checks and moved here rather than deleted.

#### Attic Entry Content

Each attic file contains the `AtticEntrySchema` (defined in File Layer 2.5.7):

```json
{
  "entity_id": "is-a1b2",
  "timestamp": "2025-01-07T10:30:00Z",
  "field": "description",
  "lost_value": "Original description that was overwritten",
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

#### Attic Retention

- Attic entries are synced to the sync branch (audit trail)

- `cead attic prune --days 30` removes old entries

- Configurable TTL in `.ceads/config.yml` (see [ConfigSchema](#257-configschema))

* * *

## 4. CLI Layer

### 4.1 Overview

The CLI Layer defines the **command interface** for users and agents.
It wraps the File and Git layers, providing a consistent way to interact with Ceads.

Key properties:

- **Implementation-agnostic**: Can be implemented in TypeScript, Rust, Python, etc.

- **Wraps lower layers**: CLI commands map to File and Git operations

- **Dual output**: Human-readable by default, JSON for scripting

- **Both prefixes accepted**: Internal (`is-a1b2`) and external (`cd-a1b2`) IDs work

### 4.2 Command Structure

```
cead <command> [subcommand] [args] [options]
```

> **Note**: The CLI command is `cead` (singular) while the project/directory is `ceads`
> (plural). This avoids conflict with the shell `cd` command.

### 4.3 Initialization

```bash
# Initialize Ceads in current repository
cead init

# What it does:
# 1. Creates .ceads/ directory with config.yml and .gitignore
# 2. Creates local subdirectories (.ceads/local/, .ceads/cache/)
# 3. Creates ceads-sync branch with .ceads-sync/ structure
# 4. Pushes sync branch to origin (if remote exists)
# 5. Returns to original branch
# 6. Outputs instructions for user to commit config files
#
# Note: Does NOT auto-commit to main branch. User commits manually.
```

**Output:**
```
Created .ceads/config.yml
Created .ceads/.gitignore
Created sync branch: ceads-sync
Pushed sync branch to origin

To complete setup, commit the config files:
  git add .ceads/config.yml .ceads/.gitignore
  git commit -m "Initialize ceads"
```

**What gets created on main branch:**
```
.ceads/
├── config.yml      # Default configuration
├── .gitignore      # Ignores local/cache/daemon files
├── local/          # Empty, for private workspace
└── cache/          # Empty, for bridge cache
```

**What gets created on ceads-sync branch:**
```
.ceads-sync/
├── nodes/
│   ├── issues/     # Empty
│   ├── agents/     # Empty
│   └── messages/   # Empty
├── attic/
│   ├── conflicts/  # Empty
│   └── orphans/    # Empty
└── meta.json       # Initial metadata
```

### 4.4 Issue Commands

#### Create

```bash
cead issue create <title> [options]
cead create <title> [options]              # Shortcut

Options:
  -p, --priority <0-4>      Priority (0=highest, 4=lowest, default: 2)
  -k, --kind <kind>         Kind: bug, feature, task, epic, chore (default: task)
  -d, --description <text>  Description
  --body-file <path>        Read description from file (use - for stdin)
  -l, --label <label>       Add label (repeatable)
  --parent <id>             Parent issue ID
  --assignee <name>         Assignee
  --deps <type:id>          Add dependency (repeatable)
```

**Examples:**
```bash
cead create "Fix authentication bug" -p 1 -k bug
cead create "Implement OAuth" -k feature -l backend -l security
cead create "Write unit tests" --parent cd-a1b2
cead create "Found bug" --deps discovered-from:cd-a1b2
cead create "Large feature" --body-file=design.md
echo "Description" | cead create "Title" --body-file=-
```

#### List

```bash
cead issue list [options]
cead list [options]                        # Shortcut

Options:
  --status <status>         Filter by status: open, in_progress, blocked, deferred, closed
  --kind <kind>             Filter by kind
  --priority <0-4>          Filter by priority
  --assignee <name>         Filter by assignee
  --label <label>           Filter by label (repeatable)
  --parent <id>             List children of parent
  --sort <field>            Sort by: priority, created_at, updated_at
  --limit <n>               Limit results
```

**Examples:**
```bash
cead list                                  # All open issues
cead list --status open --priority 1       # High-priority open issues
cead list --assignee agent-x1y2            # Issues assigned to agent
```

#### Show

```bash
cead issue show <id>
cead show <id>                             # Shortcut
```

**Output:**
```
cd-a1b2: Fix authentication bug
Status: in_progress | Priority: 1 | Kind: bug
Assignee: agent-x1y2
Labels: backend, security
Created: 2025-01-07 10:00:00 by claude-backend
Updated: 2025-01-07 14:30:00

Description:
  Users are getting logged out after 5 minutes...

Dependencies:
  blocks cd-f14c: Update session handling

Comments (2):                              # Messages with in_reply_to: is-a1b2
  [2025-01-07 11:00] agent-x1y2: Started investigating
    Started looking at session.ts...
  [2025-01-07 14:00] agent-x1y2: Found the root cause
    The timeout is hardcoded to 5 minutes
```

#### Update

```bash
cead issue update <id> [options]

Options:
  --status <status>         Set status
  --priority <0-4>          Set priority
  --kind <kind>             Set kind
  --assignee <name>         Set assignee
  --description <text>      Set description
  --add-label <label>       Add label (repeatable)
  --remove-label <label>    Remove label (repeatable)
  --parent <id>             Set parent
```

**Examples:**
```bash
cead issue update cd-a1b2 --status in_progress
cead issue update cd-a1b2 --add-label urgent --priority 0
```

#### Close

```bash
cead issue close <id> [options]
cead close <id> [options]                  # Shortcut

Options:
  --reason <text>           Close reason
```

**Examples:**
```bash
cead close cd-a1b2 --reason "Fixed in commit abc123"
```

#### Reopen

```bash
cead issue reopen <id> [options]
cead reopen <id> [options]                 # Shortcut

Options:
  --reason <text>           Reopen reason
```

**Examples:**
```bash
cead reopen cd-a1b2 --reason "Not actually fixed"
```

#### Ready

List issues that are ready to work on (open, unblocked, unclaimed):

```bash
cead issue ready [options]
cead ready [options]                       # Shortcut

Options:
  --limit <n>               Limit results
  --kind <kind>             Filter by kind
```

#### Blocked

List issues that are blocked by open dependencies:

```bash
cead issue blocked [options]
cead blocked [options]                     # Shortcut

Options:
  --limit <n>               Limit results
  --kind <kind>             Filter by kind
```

**Output:**
```
ISSUE       TITLE                    BLOCKED BY
cd-c3d4     Write tests              cd-f14c (Implement feature)
cd-e5f6     Deploy to prod           cd-a1b2, cd-c3d4
```

#### Stale

List issues that haven’t been updated in a specified number of days:

```bash
cead issue stale [options]
cead stale [options]                       # Shortcut

Options:
  --days <n>                Days since last update (default: 30)
  --status <status>         Filter by status
  --limit <n>               Limit results
```

**Examples:**
```bash
cead stale --days 14                       # Issues stale for 2 weeks
cead stale --days 7 --status in_progress   # Stale in-progress work
```

#### Dependencies

```bash
# Add dependency
cead issue dep add <id> <target-id> --type <type>

# Remove dependency
cead issue dep remove <id> <target-id>

# Show dependency tree
cead issue dep tree <id>

Dependency types:
  blocks         This issue blocks target
  related        Related to target
  discovered-from  Discovered while working on target
```

**Examples:**
```bash
cead issue dep add cd-c3d4 cd-f14c --type blocks
cead issue dep tree cd-a1b2
```

#### Comment

Add a comment (message) to an issue or reply to another message:

```bash
cead issue comment <id> --subject <subject> --body <body>
cead issue comment <id> -s <subject> -b <body>
cead issue comment <id> --file <path>      # Subject from first line, body from rest

Options:
  -s, --subject <text>      Comment subject (required)
  -b, --body <text>         Comment body (required)
  --file <path>             Read from file (first line = subject, rest = body)
```

**Examples:**
```bash
# Comment on an issue
cead issue comment cd-a1b2 -s "Found the bug" -b "It's in auth.ts line 42"

# Reply to a comment (basic threading)
cead issue comment msg-p1q2 -s "Good find" -b "I'll fix it now"
```

**Note**: Comments are stored as Message entities.
The `<id>` can be an issue ID (for comments) or a message ID (for replies).
Both subject and body are required.
Messages are displayed time-sorted; explicit threading UI is a future extension.

### 4.5 Agent Commands

#### Register

```bash
cead agent register [options]

Options:
  --name <name>             Display name (default: auto-generated)
  --capability <cap>        Capability (repeatable): code, test, review, etc.
```

**Output:**
```
Registered agent-x1y2: claude-backend
```

#### List

```bash
cead agent list [options]

Options:
  --status <status>         Filter: active, idle, inactive
```

**Output:**
```
AGENT           STATUS    WORKING ON      LAST SEEN
agent-x1y2      active    cd-a1b2         now
agent-a3b4      idle      -               2 min ago
agent-c5d6      inactive  -               15 min ago
```

#### Show

```bash
cead agent show <id>
```

#### Claim

Claim an issue for the current agent:

```bash
cead agent claim <issue-id>
```

**Output (success):**
```
Claimed cd-a1b2
```

**Output (already claimed):**
```
Error: cd-a1b2 already claimed by agent-a3b4 (since 2025-01-07 10:25)
```

#### Release

Release a claimed issue:

```bash
cead agent release <issue-id>
```

#### Status

Set agent status:

```bash
cead agent status <status>

Status values:
  active      Actively working
  idle        Available but not working
  inactive    Going offline
```

### 4.6 Local Commands

Commands for private workspace items (`local/` directory):

```bash
# Create local item
cead local create <title> [options]

# List local items
cead local list [options]

# Show local item
cead local show <id>

# Update local item
cead local update <id> [options]

# Delete local item
cead local delete <id>

# Promote local item to issue
cead local promote <id>
```

Options mirror issue commands.
`promote` copies the item to `issues/` with a new ID.

### 4.7 Sync Commands

```bash
# Full sync (pull then push)
cead sync

# Pull only (fetch remote changes)
cead sync --pull

# Push only (push local changes)
cead sync --push

# Show sync status (pending changes)
cead sync --status
```

**Output (sync):**
```
Pulled 3 files, pushed 2 files
No conflicts
```

**Output (sync --status):**
```
Local changes (not yet pushed):
  modified: issues/is-a1b2.json
  new:      issues/is-f14c.json

Remote changes (not yet pulled):
  modified: agents/ag-x1y2.json
```

#### Import

Import issues from external formats (e.g., Beads JSONL):

```bash
cead import <file> [options]

Options:
  --format <format>         Import format: beads (default: auto-detect)
  --dry-run                 Show what would be imported
  --id-map <file>           Write ID mapping to file (old-id → new-id)
```

**Beads Status Mapping:**

| Beads Status | Ceads Import Behavior |
| --- | --- |
| `open` | → `open` |
| `in_progress` | → `in_progress` |
| `blocked` | → `blocked` |
| `deferred` | → `deferred` |
| `closed` | → `closed` |
| `tombstone` | Skipped (deleted) |
| `pinned` | → `open` + label `pinned` |
| `hooked` | → `in_progress` + label `hooked` |

**Examples:**
```bash
# Import Beads export
cead import beads-export.jsonl --format beads

# Preview import
cead import beads-export.jsonl --dry-run

# Import with ID mapping for reference
cead import beads-export.jsonl --id-map mapping.json
```

### 4.8 Attic Commands

```bash
# List attic entries
cead attic list [options]

Options:
  --entity <id>             Filter by entity
  --field <field>           Filter by field
  --since <date>            Filter by date

# Show attic entry
cead attic show <entity-id> <timestamp>

# Restore from attic
cead attic restore <entity-id> <timestamp> [options]

Options:
  --field <field>           Restore specific field only
  --dry-run                 Show what would be restored

# Prune old attic entries
cead attic prune [options]

Options:
  --days <n>                Remove entries older than n days (default: 30)
  --dry-run                 Show what would be removed
```

**Output (attic list):**
```
ENTITY      TIMESTAMP                FIELD        LOST VALUE (preview)
cd-a1b2     2025-01-07T10:30:00Z     description  "Original description..."
cd-a1b2     2025-01-07T11:45:00Z     status       "open"
cd-f14c     2025-01-08T09:15:00Z     full         (full entity backup)
```

### 4.9 Doctor Commands

Health check and repair for the Ceads database:

```bash
# Run health checks
cead doctor [options]

Options:
  --fix                     Attempt to fix issues automatically
  --json                    Output results as JSON
```

**Checks performed:**

- Schema version compatibility

- Orphaned dependencies (pointing to missing issues)

- Orphaned messages (pointing to missing issues)

- Duplicate IDs (should never happen)

- Invalid entity references

- Stale agent heartbeats

**Output:**
```
Running health checks...

✓ Schema version: 0.1.0 (current)
✓ No orphaned dependencies
⚠ 2 orphaned messages found
  ms-p1q2 → is-deleted (issue not found)
  ms-r3s4 → is-missing (issue not found)
✓ No duplicate IDs
✓ All entity references valid
⚠ 1 stale agent (no heartbeat in 15+ minutes)
  agent-x1y2: last seen 2025-01-07T10:00:00Z

Run with --fix to move orphaned entities to attic
```

### 4.10 Global Options

Available on all commands:

```bash
--json           Output as JSON (for scripting/agents)
--no-daemon      Bypass daemon, operate on files directly
--verbose        Detailed output
--quiet          Minimal output
--help           Show help
```

### 4.11 Output Formats

#### Human-Readable (Default)

Formatted for terminal display with colors, tables, and readable dates.

#### JSON (--json)

Structured output for scripting and agent consumption:

```bash
cead list --json
```

```json
[
  {
    "type": "is",
    "id": "is-a1b2",
    "title": "Fix authentication bug",
    "status": "in_progress",
    "priority": 1,
    "kind": "bug",
    "assignee": "ag-x1y2",
    "labels": ["backend", "security"],
    "created_at": "2025-01-07T10:00:00Z",
    "updated_at": "2025-01-07T14:30:00Z"
  }
]
```

> **Note**: JSON output uses internal prefixes (`is-`, `ag-`) for consistency with file
> storage. Human-readable output uses external prefixes (`cd-`, `agent-`).

* * *

## 5. Bridge Layer (Future)

> **Note**: This section describes future capabilities not included in the initial
> implementation. The system works fully with just File, Git, and CLI layers.

### 5.1 Overview

The Bridge Layer provides **real-time coordination** via external services.
It addresses the latency gap between git sync (seconds to minutes) and real-time needs
(sub-second).

Key properties:

- **Optional**: System works without bridges; they’re progressive enhancement

- **Pluggable**: Multiple bridge backends can coexist

- **Explicit promotion**: Entities are explicitly promoted to bridges, not automatic

- **Git remains truth**: Bridges are views/caches; git is always authoritative

- **Graceful degradation**: If bridge unavailable, git sync still works

### 5.2 Bridge Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                      Ceads Core (Git)                            │
│                      Source of truth                             │
│   .ceads-sync/nodes/issues/is-a1b2.json                         │
│     {                                                            │
│       "id": "is-a1b2",                                          │
│       "title": "Fix auth bug",                                  │
│       "bridge": {                        ← Bridge metadata      │
│         "github": {                                              │
│           "number": 42,                                          │
│           "url": "https://github.com/.../issues/42",            │
│           "synced_at": "2025-01-07T10:30:00Z"                   │
│         }                                                        │
│       }                                                          │
│     }                                                            │
└──────────────────────────────┬───────────────────────────────────┘
                               │
                    Bridge sync (bidirectional)
                               │
         ┌─────────────────────┼─────────────────────┐
         │                     │                     │
         ▼                     ▼                     ▼
┌─────────────────┐  ┌─────────────────┐  ┌─────────────────┐
│  GitHub Issues  │  │     Slack       │  │  Native Bridge  │
│                 │  │                 │  │                 │
│  Issue #42      │  │  #coordination  │  │  Hosted Ceads   │
│  Labels, state  │  │  channel        │  │  service        │
└─────────────────┘  └─────────────────┘  └─────────────────┘
```

#### Bridge Metadata Schema

```typescript
const BridgeLink = z.object({
  service: z.string(),           // "github", "slack", "native"
  external_id: z.string(),       // GitHub issue number, Slack channel, etc.
  external_url: z.string().optional(),
  synced_at: Timestamp,
  sync_direction: z.enum(['push', 'pull', 'bidirectional']),
});

// Added to entities that are bridged
const bridge = z.record(z.string(), BridgeLink).optional();
```

#### Configuration in meta.json

```json
{
  "config": {
    "bridges": {
      "github": {
        "enabled": true,
        "repo": "owner/repo",
        "auto_promote": false,
        "promote_filter": { "labels": ["coordinated"] }
      },
      "slack": {
        "enabled": true,
        "channel": "C01234567",
        "workspace": "team-workspace"
      }
    }
  }
}
```

### 5.3 GitHub Issues Bridge

Sync Ceads issues with [GitHub Issues](https://docs.github.com/en/rest/issues) for
real-time coordination and human visibility.

#### Use Cases

- Cross-team coordination with sub-second latency

- Human stakeholder visibility in GitHub

- Claims via GitHub labels

- Notifications via GitHub’s existing systems

#### Promotion

```bash
# Explicitly promote an issue to GitHub
cead github promote <issue-id>

# Promote with specific options
cead github promote <issue-id> --labels "ceads-sync,priority:high"
```

**What happens:**

1. Creates GitHub Issue with mapped fields

2. Adds `bridge.github` metadata to Ceads entity

3. Sets up bidirectional sync

#### Field Mapping

| Ceads Field | GitHub Field | Notes |
| --- | --- | --- |
| `title` | `title` | Direct mapping |
| `description` | `body` | Includes Ceads metadata block |
| `status` | Labels | `status:open`, `status:in_progress`, etc. |
| `priority` | Labels | `priority:0`, `priority:1`, etc. |
| `assignee` | Labels | `claimed:agent-id` |
| `labels` | Labels | Prefixed: `ceads:label-name` |

#### Claiming via Labels

```bash
# Agent claims issue - adds label to GitHub
cead agent claim cd-a1b2

# Under the hood:
gh issue edit 42 --add-label "claimed:agent-x1y2"
```

Other agents see the label via GitHub webhooks or polling.

#### Sync Flow

```
Ceads → GitHub:
  1. Detect local change (version increment)
  2. Update GitHub Issue via API
  3. Update synced_at timestamp

GitHub → Ceads:
  1. Webhook fires (or poll detects change)
  2. Update local entity
  3. Increment version
  4. Git sync propagates to other machines
```

#### Conflict Resolution

When Ceads and GitHub diverge:

- Compare `synced_at` with GitHub’s `updated_at`

- Field-level merge where possible

- On conflict, Ceads wins (configurable)

- Log discrepancies for review

### 5.4 Slack Bridge

Real-time messaging between agents via Slack.

#### Why Slack for Messages?

Messages are inherently real-time.
Rather than building a message queue:

- Use Slack as the primary message transport

- Agents subscribe to channels via [Slack API](https://docs.slack.dev/apis/events-api/)

- Optional: archive messages to git for audit trail

#### Architecture

```
Agent A                    Slack                     Agent B
   │                         │                          │
   │──── post message ──────→│                          │
   │                         │←── webhook/subscribe ────│
   │                         │──── deliver message ────→│
   │                         │                          │
   │                   (optional)                       │
   │                         │                          │
   │            Archive to .ceads-sync/nodes/messages/  │
```

#### Configuration

```json
{
  "config": {
    "bridges": {
      "slack": {
        "enabled": true,
        "channel": "C01234567",
        "archive_to_git": true,
        "archive_after_days": 1
      }
    }
  }
}
```

#### CLI Commands

```bash
# Send message via Slack
cead message send <recipient> --subject "..." --body "..."

# List recent messages (from Slack or git archive)
cead message list --channel coordination

# Archive Slack messages to git
cead message archive --days 7
```

### 5.5 Native Bridge

A hosted Ceads coordination service for teams that want real-time without external
dependencies.

#### Use Cases

- Teams not using GitHub Issues or Slack

- Need sub-100ms coordination latency

- Want a unified coordination layer

- Self-hosted or Ceads-hosted options

#### Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                    Native Bridge Service                         │
│                                                                  │
│  ┌────────────┐  ┌────────────┐  ┌────────────┐                 │
│  │  Presence  │  │   Claims   │  │  Messages  │                 │
│  │            │  │            │  │            │                 │
│  │ Who online │  │ Atomic ops │  │ Real-time  │                 │
│  │ Heartbeats │  │ With TTL   │  │ Pub/sub    │                 │
│  └────────────┘  └────────────┘  └────────────┘                 │
│                                                                  │
│  WebSocket connections from agents                               │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
         ↑                    ↑                    ↑
      Agent A              Agent B              Agent C
         │                    │                    │
         └────────────────────┼────────────────────┘
                              │
                    Git sync (durable)
```

#### Features

- **Presence**: Who’s online, heartbeat tracking

- **Claims**: Atomic claim/release with TTL

- **Messages**: Real-time delivery with optional archival

- **Notifications**: “Entity changed, pull from git”

#### Implementation Options

- **[Convex](https://www.convex.dev/)**: Managed, reactive, TypeScript-native

- **[Supabase Realtime](https://supabase.com/docs/guides/realtime)**: PostgreSQL +
  WebSocket broadcast

- **Self-hosted**: [NATS](https://nats.io/) or
  [Redis pub/sub](https://redis.io/docs/latest/develop/pubsub/)

### 5.6 Local UI Bridge

A local desktop application that connects to Ceads and provides visual interfaces like
Kanban boards, dashboards, or agent activity monitors.
The layered architecture supports diverse clients beyond CLI and remote bridges.

#### Design Rationale

The Local UI Bridge validates our architecture by showing that:

- **File Layer is sufficient for UI**: A GUI can read/write the same JSON files as CLI

- **Git Layer handles sync**: Changes from UI sync to agents via same git mechanisms

- **Daemon is optional**: File-watching provides real-time updates without daemon

- **Bridge Layer adds real-time**: When present, daemon provides instant notifications

#### Architecture: File-Watching Mode (No Daemon)

```
┌─────────────────────────────────────────────────────────────────┐
│                     Local UI (Electron/Tauri)                    │
│                                                                  │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐           │
│  │ Kanban View  │  │  Dashboard   │  │ Agent Panel  │           │
│  │              │  │              │  │              │           │
│  │  Drag/drop   │  │  Metrics     │  │  Activity    │           │
│  │  issues      │  │  Overview    │  │  Feed        │           │
│  └──────────────┘  └──────────────┘  └──────────────┘           │
│                           │                                      │
│                  ┌────────┴────────┐                             │
│                  │ File System API │                             │
│                  │                 │                             │
│                  │ Read JSON files │                             │
│                  │ Write changes   │                             │
│                  │ Watch for mods  │                             │
│                  └────────┬────────┘                             │
└───────────────────────────┼─────────────────────────────────────┘
                            │
                            │ fs.watch()
                            ▼
              ┌─────────────────────────────┐
              │     .ceads/ (local)         │
              │       cache/, local/        │
              │    (local working files)    │
              └─────────────────────────────┘
                            ↑
                            │ sync
                            ▼
              ┌─────────────────────────────┐
              │   .ceads-sync/ (git)        │
              │     nodes/, attic/          │
              │    (synced via git)         │
              └─────────────────────────────┘
                            ↑
                            │ git pull/push
                            ▼
                    ┌───────────────┐
                    │  Git Remote   │
                    └───────────────┘
                            ↑
                            │
                    ┌───────┴───────┐
                    │               │
                Agent A         Agent B
                (writes)        (writes)
```

**Workflow**:

1. UI watches `.ceads/` and cached entity data for changes

2. Agent commits and pushes → git pull brings changes → fs.watch triggers UI refresh

3. User drags issue to “In Progress” → UI writes JSON → git commit/push → agents see
   change

**Latency**: Depends on git sync frequency (seconds to minutes)

#### Architecture: Daemon-Connected Mode (Real-Time)

```
┌─────────────────────────────────────────────────────────────────┐
│                     Local UI (Electron/Tauri)                    │
│                                                                  │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐           │
│  │ Kanban View  │  │  Dashboard   │  │ Agent Panel  │           │
│  └──────────────┘  └──────────────┘  └──────────────┘           │
│                           │                                      │
│                  ┌────────┴────────┐                             │
│                  │ Daemon Client   │                             │
│                  │                 │                             │
│                  │ Unix socket or  │                             │
│                  │ localhost HTTP  │                             │
│                  └────────┬────────┘                             │
└───────────────────────────┼─────────────────────────────────────┘
                            │
                            │ WebSocket / IPC
                            ▼
              ┌─────────────────────────────┐
              │         Cead Daemon         │
              │                             │
              │  • File change events       │
              │  • Bridge notifications     │
              │  • Agent activity stream    │
              └─────────────────────────────┘
                     │              │
          ┌──────────┘              └──────────┐
          ▼                                    ▼
    ┌──────────┐                      ┌──────────────┐
    │ .ceads/  │                      │   Bridges    │
    │  files   │                      │ (Slack, etc) │
    └──────────┘                      └──────────────┘
```

**Workflow**:

1. Daemon watches files and receives bridge events

2. Agent activity → daemon sends WebSocket event → UI updates instantly

3. User action in UI → daemon validates and writes → notifies all clients

**Latency**: Sub-100ms for local changes, depends on bridge for remote

#### Feature Examples

| Feature | File-Watch Mode | Daemon Mode |
| --- | --- | --- |
| **Kanban board** | ✅ Read issues, drag to change status | ✅ Same, with instant sync |
| **Agent activity feed** | ⚠️ Poll agent files | ✅ Real-time stream |
| **Live presence** | ❌ Not available | ✅ "Agent X is working on..." |
| **Notifications** | ⚠️ Must poll | ✅ Push notifications |
| **Offline editing** | ✅ Works completely offline | ✅ Queued, syncs on reconnect |

#### Potential UI Views

- **Kanban Board**: Drag-drop issues between status columns

- **Agent Dashboard**: Which agents exist, their current focus, recent activity

- **Timeline View**: Chronological activity across all agents and issues

- **Dependency Graph**: Visual representation of issue dependencies

- **Message Center**: Real-time agent communications (when bridges configured)

#### Implementation Notes

- **[Electron](https://www.electronjs.org/)**: Full Node.js access, can use existing CLI
  as library

- **[Tauri](https://tauri.app/)**: Rust backend, smaller binary, can shell out to `cead`
  CLI

- **Both**: Can read/write JSON directly, no special API needed

This is a “future” feature, but the architecture supports it today—any application that
can read JSON files and (optionally) connect to the daemon can provide rich UI
experiences.

### 5.7 Bridge CLI Commands

Additional CLI commands when bridges are configured:

```bash
# GitHub bridge
cead github promote <id>           # Promote issue to GitHub
cead github sync                   # Force sync with GitHub
cead github status                 # Show GitHub sync status

# Slack bridge
cead slack connect                 # Connect Slack workspace
cead slack channel <name>          # Set coordination channel

# Native bridge
cead bridge connect <url>          # Connect to native bridge
cead bridge status                 # Show bridge connection status

# General bridge commands
cead bridge list                   # List configured bridges
cead bridge sync                   # Sync all bridges
```

### 5.8 Offline-First Architecture

Bridges require network connectivity, but agents should continue working when offline.
The cache layer provides offline-first semantics with automatic sync on reconnection.

#### Design Goals

- **Non-blocking sends**: `cead message send` returns immediately, even offline

- **No message loss**: Outbound messages queue until bridge confirms delivery

- **Graceful degradation**: Agents keep working; messages sync when connectivity returns

- **Minimal git pollution**: Messages don’t need to be archived to git

#### Cache Directory Structure

```
.ceads/                              # On main branch (gitignored except config)
├── cache/                           # Local cache (never synced to git)
│   ├── outbound/                    # Queue: items waiting to send to bridge
│   │   ├── ms-a1b2.json            # Queued message
│   │   └── ms-c3d4.json
│   ├── inbound/                     # Buffer: recent items from bridge
│   │   └── ms-f14c.json            # Received message (TTL-based cleanup)
│   └── state.json                   # Connection state, retry counts
├── local/                           # Private workspace (gitignored)
└── config.yml                       # Project config (tracked)

.ceads-sync/                         # On ceads-sync branch (all tracked)
├── nodes/issues/                    # Synced entities
├── nodes/agents/
├── nodes/messages/
└── ...
```

#### Cache Types

| Type | Directory | Behavior | Synced |
| --- | --- | --- | --- |
| **Outbound Queue** | `cache/outbound/` | FIFO, deleted after bridge confirms | Never |
| **Inbound Buffer** | `cache/inbound/` | TTL-based cleanup, recent messages | Never |
| **State** | `cache/state.json` | Connection metadata, retry counts | Never |

#### Offline Workflow

```
Agent offline:
  1. cead message send ... → writes to cache/outbound/ms-xxxx.json
  2. CLI returns immediately (non-blocking)
  3. Agent continues working
  4. More messages → more files in outbound/

Agent reconnects (daemon running):
  1. Daemon detects connectivity
  2. Scans cache/outbound/
  3. Sends each message to bridge (Slack, Native, etc.)
  4. On confirmation, deletes from outbound/
  5. Fetches inbound messages → cache/inbound/
  6. Notifies connected agents of new messages

Without daemon:
  1. cead message send → writes to cache/outbound/
  2. cead bridge sync → flushes outbound, fetches inbound
  3. Manual sync when ready
```

#### State Schema

```typescript
const CacheState = z.object({
  last_bridge_sync: Timestamp.optional(),
  connection_status: z.enum(['connected', 'disconnected', 'connecting']),
  retry_count: z.number().default(0),
  last_error: z.string().optional(),
  outbound_count: z.number().default(0),
});
```

#### Message Flow

```
┌─────────────────────────────────────────────────────────────────┐
│                        Agent Process                             │
│                                                                  │
│   cead message send "Hello"                                     │
│         │                                                        │
│         ▼                                                        │
│   ┌─────────────┐                                               │
│   │  Write to   │                                               │
│   │  outbound/  │ ← Immediate return (non-blocking)             │
│   └─────────────┘                                               │
└─────────────────────────────────────────────────────────────────┘
                               │
                               ▼ (when online)
┌─────────────────────────────────────────────────────────────────┐
│                    Daemon / Bridge Sync                          │
│                                                                  │
│   1. Read cache/outbound/ms-xxxx.json                           │
│   2. POST to bridge (Slack API, Native WebSocket, etc.)         │
│   3. On success: delete ms-xxxx.json                            │
│   4. On failure: increment retry_count, exponential backoff     │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

#### Git vs Cache

Not everything needs to be in git:

| Data Type | Storage | Rationale |
| --- | --- | --- |
| Issues | Git | Durable, historical, shared |
| Agents | Git | Durable, historical, shared |
| Messages (archived) | Git (optional) | Audit trail if needed |
| Messages (recent) | Cache only | Ephemeral, high volume |
| Outbound queue | Cache only | Temporary until delivered |
| Connection state | Cache only | Local-only, transient |

* * *

## 6. Implementation Notes

> This section covers implementation considerations that are not part of the layer
> specifications but are useful for implementers.

### 6.1 Daemon (Optional)

The daemon is an **optional component** that serves two purposes:

1. **Local optimization** for multi-agent workflows on a single machine

2. **Bridge Layer runtime** for real-time coordination with external services

**Key insight**: File, Git, and CLI layers work without a daemon.
You need the daemon only for the Bridge Layer or sub-second local coordination.

#### Layer Requirements

| Layer | Without Daemon | With Daemon |
| --- | --- | --- |
| **File** | ✅ Read/write JSON files directly | Same, but cached in memory |
| **Git** | ✅ CLI calls git commands directly | Same, but batched |
| **CLI** | ✅ Each command does file I/O | Routes through daemon socket |
| **Bridge** | ⚠️ Needs persistent process | Daemon handles webhooks, queues |

#### When You Need the Daemon

**For Bridge Layer** (primary use case):

- Receiving webhooks/events from external services (GitHub, Slack)

- Maintaining WebSocket connections to bridges

- Flushing queued messages when connectivity returns

- Sending heartbeats to coordination services

**For Local Optimization** (secondary use case):

- Multiple agents running on the same machine

- Sub-10ms query requirements

- Real-time local notifications between agents

- Atomic claim operations without race conditions

#### When You Don’t Need the Daemon

- Single-agent workflows (File + Git + CLI is sufficient)

- Slow-paced, human-driven work

- CI/CD pipelines (just use CLI directly)

- When git sync latency is acceptable

- No external bridges configured

#### Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                    Daemon (Optional)                             │
│                                                                  │
│  ┌─────────────┐ ┌─────────────┐ ┌─────────────┐                │
│  │   Issues    │ │   Agents    │ │   Indexes   │                │
│  │  (in-mem)   │ │  (in-mem)   │ │  (in-mem)   │                │
│  └─────────────┘ └─────────────┘ └─────────────┘                │
│                                                                  │
│  ┌─────────────┐ ┌─────────────┐ ┌─────────────┐                │
│  │   Cache/    │ │   Bridge    │ │  Webhook    │                │
│  │   Queues    │ │ Connections │ │  Receiver   │                │
│  └─────────────┘ └─────────────┘ └─────────────┘                │
│                                                                  │
│  - Sub-10ms reads/writes (local optimization)                    │
│  - Bridge runtime (webhooks, WebSockets, queues)                │
│  - Lost on daemon restart (rebuilds from files)                  │
│                                                                  │
│                    Flushes every 1-5s ↓                          │
└─────────────────────────────────────────────────────────────────┘
                               │
                               ▼
                         File Layer
```

#### Daemon State

```typescript
interface DaemonState {
  issues: Map<string, Issue>;
  agents: Map<string, Agent>;
  locals: Map<string, Local>;

  // Indexes for fast queries
  issuesByStatus: Map<IssueStatus, Set<string>>;
  issuesByAssignee: Map<string, Set<string>>;

  // Connected agent sessions
  sessions: Map<string, Session>;
}

interface Session {
  agentId: string;
  socket: Socket;
  connectedAt: Date;
}
```

#### Protocol

Communication via Unix socket (`.ceads/daemon.sock`) or TCP on Windows.

**Request/Response format** ([JSON-RPC](https://www.jsonrpc.org/specification) style):

```typescript
interface Request {
  id: string;
  op: string;
  params: Record<string, unknown>;
}

interface Response {
  id: string;
  ok: boolean;
  result?: unknown;
  error?: string;
}
```

#### Operations

| Operation | Description |
| --- | --- |
| `register` | Register agent, get session |
| `heartbeat` | Update last_heartbeat timestamp |
| `claim` | Atomically claim an issue |
| `release` | Release a claimed issue |
| `update` | Update entity fields |
| `query` | Query entities with filters |
| `sync` | Trigger git sync |

#### Notification Events

Daemon pushes events to connected agents:

```typescript
// Entity changed
{ "type": "changed", "data": { "collection": "issues", "id": "is-a1b2" }}

// Agent status changed
{ "type": "agent_status", "data": { "agent_id": "ag-a3b4", "status": "inactive" }}
```

#### Lifecycle

**Startup:**

1. Load all files from `.ceads/` into memory

2. Rebuild indexes

3. Start listening on socket

4. Start flush loop (memory → files)

5. Start sync loop (files → git, if configured)

**Shutdown:**

1. Final flush to files

2. Final sync to git (if configured)

3. Close all sessions

4. Remove socket file

**Crash recovery:**

1. On restart, load from files (memory is reconstructed)

2. No data loss—files are source of truth

#### CLI Commands

```bash
cead daemon start              # Start daemon (detached)
cead daemon start --foreground # Start daemon (attached)
cead daemon stop               # Stop daemon
cead daemon status             # Show daemon status
cead daemon flush              # Force flush memory → files
```

### 6.2 Use Cases by Complexity

Ceads supports a spectrum of usage patterns:

#### 1. Single Developer, Local Workflow

A solo developer tracking tasks in a personal project.

- **Layers used**: File + CLI

- **Sync**: Optional, manual `cead sync` when desired

- **Daemon**: Not needed

```bash
cead init
cead create "Fix bug in login" -p 1
cead list
cead close cd-a1b2 --reason "Fixed"
```

#### 2. Cross-Machine Development

Same developer working from multiple machines.

- **Layers used**: File + Git + CLI

- **Sync**: On push/pull

- **Daemon**: Not needed

```bash
# Machine A
cead create "New feature"
cead sync

# Machine B
cead sync
cead list  # See the new feature
```

#### 3. Team with Human + Agent Collaboration

A team of developers with AI coding agents.

- **Layers used**: File + Git + CLI

- **Sync**: Regular (every few minutes)

- **Daemon**: Optional, helps with claim coordination

```bash
# Human creates issue
cead create "Implement OAuth" -k feature

# Agent claims and works
cead agent claim cd-a1b2
# ... work ...
cead close cd-a1b2 --reason "Implemented"
```

#### 4. Multi-Agent Work Queue

Multiple AI agents running concurrently.

- **Layers used**: File + Git + CLI + Daemon

- **Sync**: Frequent (sub-minute)

- **Daemon**: Recommended for atomic claims

```bash
# Start daemon for coordination
cead daemon start

# Agent 1
cead agent register --name "claude-backend"
cead ready --json  # Find available work
cead agent claim cd-a1b2

# Agent 2 (sees claim immediately via daemon)
cead ready --json  # cd-a1b2 not shown
```

#### 5. Cross-Team Real-Time Coordination

Multiple teams with real-time requirements.

- **Layers used**: File + Git + CLI + Bridge

- **Sync**: Real-time via bridge

- **Bridge**: GitHub Issues or Native

```bash
# Configure GitHub bridge
cead github promote cd-a1b2  # Critical issue

# Other team sees it instantly in GitHub
# Claims, updates propagate in real-time
```

#### 6. CI/CD Integration

Automated systems creating/updating issues.

- **Layers used**: File + Git + CLI

- **Daemon**: Not needed

```bash
# In CI script
cead create "Test failure: auth tests" -k bug -l "ci-failure"
cead sync
```

#### 7. Private Agent Workspace

Agent using local-only items for scratch work.

- **Layers used**: File + CLI (local only)

- **Sync**: Never

```bash
cead local create "TODO: refactor this later"
cead local list
cead local promote lo-a1b2  # Promote to real issue when ready
```

### 6.3 Examples

#### Example 1: Single Agent Workflow

```bash
# Initialize
$ cead init
Created .ceads/config.yml
Created .ceads/.gitignore
Created sync branch: ceads-sync
Pushed sync branch to origin

To complete setup, commit the config files:
  git add .ceads/config.yml .ceads/.gitignore
  git commit -m "Initialize ceads"

$ git add .ceads/config.yml .ceads/.gitignore
$ git commit -m "Initialize ceads"

# Create issues
$ cead create "Set up database schema" -p 1 -k task
Created cd-a1b2: Set up database schema

$ cead create "Implement auth endpoints" -p 1 -k feature
Created cd-f14c: Implement auth endpoints

$ cead create "Write integration tests" -p 2 -k task
Created cd-c3d4: Write integration tests

# Add dependency
$ cead issue dep add cd-c3d4 cd-f14c --type blocks
Added: cd-c3d4 blocks cd-f14c

# See ready work
$ cead ready
Ready issues (no blockers):
  [P1] cd-a1b2: Set up database schema
  [P1] cd-f14c: Implement auth endpoints

# Work and close
$ cead issue update cd-a1b2 --status in_progress
$ cead close cd-a1b2 --reason "Schema created"

# Sync to git
$ cead sync
Pushed 4 files to ceads-sync
```

#### Example 2: Multi-Agent Coordination

```bash
# Terminal 1: Start daemon
$ cead daemon start
Daemon started on .ceads/daemon.sock

# Terminal 2: Agent 1
$ cead agent register --name "claude-backend"
Registered agent-x1y2: claude-backend

$ cead ready --json
[{"id": "is-a1b2", "title": "Fix auth bug", "priority": 1}]

$ cead agent claim cd-a1b2
Claimed cd-a1b2

# Terminal 3: Agent 2
$ cead agent register --name "claude-frontend"
Registered agent-a3b4: claude-frontend

$ cead agent list
AGENT           STATUS   WORKING ON
agent-x1y2      active   cd-a1b2
agent-a3b4      active   -

$ cead ready
Ready issues:
  [P2] cd-f14c: Update UI components
# cd-a1b2 not shown - already claimed

# Agent 2 takes different issue
$ cead agent claim cd-f14c
Claimed cd-f14c
```

#### Example 3: Conflict Resolution

```bash
# Agent A (machine 1)
$ cead issue update cd-a1b2 --status in_progress
$ cead issue update cd-a1b2 --add-label backend

# Agent B (machine 2, before sync)
$ cead issue update cd-a1b2 --status blocked
$ cead issue update cd-a1b2 --add-label urgent

# Agent A syncs first
$ cead sync
Pushed 1 file

# Agent B syncs, conflict detected
$ cead sync
Conflict in cd-a1b2:
  status: in_progress (remote) vs blocked (local) → local wins (newer)
  labels: merged → [backend, urgent]
Merged and pushed

# Check attic
$ cead attic list --entity cd-a1b2
TIMESTAMP              FIELD    LOST VALUE
2025-01-07T10:30:00Z   status   in_progress

# Restore if needed
$ cead attic restore cd-a1b2 2025-01-07T10:30:00Z --field status
```

### 6.4 Other Potential Layers (Not Specified)

These layers could be built on top of the CLI Layer but are not specified in this
document:

#### MCP Layer

Model Context Protocol tools wrapping CLI for Claude, Cursor, etc.

```typescript
// Example MCP tool definition
{
  name: "ceads_create_issue",
  description: "Create a new issue in Ceads",
  parameters: {
    title: { type: "string", required: true },
    priority: { type: "number", default: 2 },
    kind: { type: "string", default: "task" }
  }
}
```

#### Agent Tool Layer

Tool definitions for agent frameworks (LangChain, CrewAI, AutoGen).

#### API Layer

Language-specific library bindings:

- TypeScript: `@ceads/client`

- Python: `ceads-py`

- Rust: `ceads-rs`

#### Watch Layer

File system watching for UIs and IDEs:

- `fswatch` / `inotify` / `ReadDirectoryChangesW`

- WebSocket server for push updates

* * *

## 7. Appendices

### 7.1 Design Decisions

#### Decision 1: Split Architecture (Config on Main, Data on Sync Branch)

**Choice**: Configuration (`.ceads/config.yml`) lives on main branch; synced entities live
exclusively on `ceads-sync` branch in `.ceads-sync/` directory.

**Rationale**:

- **Discoverable**: Clone repo, see `.ceads/config.yml`, know ceads is configured

- **Config versions with code**: Configuration changes can be part of PRs

- Eliminates skip-worktree hacks that caused beads v0.42 issues

- No daemon-vs-user conflicts on tracked files

- No git worktrees needed

- Issues shared across all code branches (correct for multi-agent use case)

**Tradeoff**: Two locations to understand (config on main, data on sync branch).
Mitigated by clear naming (`.ceads/` for config/local, `.ceads-sync/` for synced data)
and `cead init` setting up both locations.

#### Decision 2: File-Per-Entity

**Choice**: Each entity is a separate JSON file in its collection directory.

**Rationale**:

- Creating entities on different machines = no merge conflict (different files)

- Updating different entities = no merge conflict

- Per-entity conflicts are isolated, don’t affect others

- Git efficiently handles thousands of small files

- Human-readable with standard tools

**Tradeoff**: More files than single JSONL. Acceptable since sync branch is rarely
checked out directly.

#### Decision 3: Schema-Agnostic Sync

**Choice**: Git Layer operates on files, doesn’t interpret content beyond `version`
field.

**Rationale**:

- Adding new entity types requires no sync code changes

- Schema migrations don’t affect sync reliability

- Simpler sync implementation, easier to verify correctness

- Version field is stable contract; everything else can evolve

**Tradeoff**: Sync can’t do schema-aware optimization.
Acceptable—sync is already simple.

#### Decision 4: Daemon as Optional

**Choice**: Daemon provides speed and coordination but isn’t required.

**Rationale**:

- Simple single-agent workflows stay simple

- No daemon = no daemon bugs for those who don’t need it

- Files work without daemon; daemon is pure optimization

- Graceful degradation: if daemon dies, fall back to files

**Tradeoff**: Without daemon, no sub-second local coordination.
Acceptable for single-agent or batch workflows.

#### Decision 5: Attic for Conflict Losers

**Choice**: When merge loses data, preserve it in attic directory with full context.

**Rationale**:

- No data loss, ever—builds user trust

- Users can investigate and recover from bad merges

- Context preserved: what was lost, why, when

**Tradeoff**: Attic accumulates over time.
Mitigated by `prune` command with configurable TTL.

#### Decision 6: Directory-Based Internal Prefixes with External Aliases

**Choice**: Internal ID prefixes match directory names (`is-` for `issues/`). External
display prefixes are configurable aliases.

**Rationale**:

- **Consistency**: Prefix always indicates which directory contains the file

- **Immutability**: Internal IDs never change, even if display preferences change

- **Flexibility**: Projects can customize external prefixes without file renames

- **Predictability**: Given `is-a1b2`, you know it’s in `issues/is-a1b2.json`

**Tradeoff**: Two representations to understand.
Mitigated by CLI handling translation transparently.

#### Decision 7: Self-Documenting Type Field

**Choice**: Every entity includes a `type` field matching its directory prefix.

**Rationale**:

- JSON files are meaningful without path context

- Schema validation can verify `type` matches directory

- Files remain useful when copied or viewed in isolation

- Uniform pattern across all entity types

**Tradeoff**: Redundant information.
Intentional—ensures files are self-contained.

#### Decision 8: Hierarchical Issues via Parent-Child

**Choice**: Issues support parent-child via `parent_id` and `sequence`.

**Rationale**:

- `sequence` preserves ordering for checklists

- Single source of order (in parent, not duplicated)

- Clean separation from `dependencies` (different concept)

- Flexible hierarchy depth

**Tradeoff**: Two places to update when reordering.
Acceptable—order changes are infrequent.

#### Decision 9: Layered Architecture

**Choice**: Separate File, Git, CLI, and Bridge layers with clear boundaries.

**Rationale**:

- Each layer can evolve independently

- Easy to add new layers (MCP, API) without changing existing ones

- Clear responsibilities make implementation simpler

- Progressive complexity—use only what you need

**Tradeoff**: More conceptual overhead.
Mitigated by clear documentation.

#### Decision 10: Messages as Unified Comment/Message Model

**Choice**: Comments and messages are the same entity type (Message), stored in
`messages/` with `in_reply_to` pointing to either an issue or another message.

**Rationale**:

- **Similar workflows**: Neither comments nor messages have open/close states like
  issues. Both are created, read, and (rarely) edited—no state machine.

- **Similar features**: Any UI feature for one applies to both (reactions, formatting,
  attachments, search).
  A bridge UI showing comments would reuse the same components for inter-agent messages.

- **Time-ordered by default**: Messages sort by `created_at`, requiring no explicit
  `sequence` array in the parent.
  This differs from subtasks which need manual ordering.

- **Basic threading via `in_reply_to`**: A message can reply to an issue (comment) or to
  another message (reply).
  This enables threading without threading-specific features.
  Queries like “all comments on issue X” just filter by `in_reply_to`.

- **Future-proof**: Explicit threading UI, ephemeral messages, or rich Bridge Layer
  messaging can build on this foundation without schema changes.

**What we’re NOT doing**:

- No explicit thread objects or thread IDs

- No threading UI features in v1 (flat list display)

- No ephemeral/disappearing messages

- No read receipts or delivery status

**Tradeoff**: Comments and messages share a schema even though comments are always
attached to issues. Acceptable—the unified model is simpler and more extensible.

### 7.2 Open Questions

#### Question 1: Git Operations Method

How to update sync branch without checking it out?

**Options**:

1. **Bare git operations** (`git read-tree`, `git write-tree`, `git update-ref`)

   - Pro: No disk I/O for checkout

   - Con: Complex, error-prone

2. **Sparse checkout to temp directory**

   - Pro: Standard git operations

   - Con: Extra disk I/O

3. **Shallow clone of sync branch**

   - Pro: Isolated from main repo

   - Con: Separate clone to manage

**Likely**: Option 2 for simplicity.
Performance acceptable for typical sync frequency.

#### Question 2: Message Retention

How long to keep messages (if stored in git)?

**Options**:

1. **TTL-based** (default 7 days)

2. **Linked to issue lifecycle** (delete when issue closes)

3. **Manual only** (`cead message prune`)

**Likely**: Hybrid—TTL by default, messages linked to open issues preserved.

#### Question 3: Sequence Array Merge Strategy

When two agents reorder the same parent’s `sequence` array concurrently?

**Options**:

1. **LWW with attic** (current choice)

2. **Operational transform**

3. **Union + sort**

4. **Conflict marker**

**Likely**: Option 1. Sequence conflicts should be rare, and attic provides recovery.

### 7.3 Migration from Beads

#### Export from Beads

```bash
# Export all issues to JSONL
bd export -o beads-export.jsonl --format jsonl
```

#### Import to Ceads

```bash
# Initialize ceads
cead init

# Import beads export
cead import beads-export.jsonl --format beads

# The importer:
# - Converts bd-* IDs to is-* internal IDs
# - Configures external prefix alias so CLI displays cd-*
# - Maps beads fields to ceads schema
# - Preserves dependencies, comments, labels
# - Skips wisps (ephemeral issues)
```

#### ID Mapping

A mapping file is created during import (stored on sync branch for audit trail):

```json
// .ceads-sync/migrations/beads-import-2025-01-07.json
{
  "bd-a1b2": "is-x1y2",
  "bd-f14c": "is-a3b4"
}
```

This allows references in commit messages to be traced to new IDs.

### 7.4 Comparison with Beads

| Aspect | Beads | Ceads |
| --- | --- | --- |
| Data locations | 4 (SQLite, local JSONL, sync branch, main) | 3 (config on main, data on sync branch, local cache) |
| File system compatibility | SQLite WAL fails on NFS/cloud | Works on any file system |
| Main branch | JSONL committed | Config only (config.yml) |
| Storage format | Single JSONL file | File per entity |
| Skip-worktree | Required hack | Not needed |
| Git worktrees | Required for sync branch | Not needed |
| Daemon | Always recommended | Optional |
| Sync layer | Schema-aware | Schema-agnostic |
| Merge conflicts | JSONL line-based (cross-entity) | Per-file (per-entity) |
| Entity types | Issues + molecules | Extensible (issues, agents, ...) |
| Agent coordination | External (Agent Mail) | Built-in |
| Architecture | Monolithic | Layered (File, Git, CLI, Bridge) |

### 7.5 File Structure Reference

#### Complete Directory Layout

**On main branch (and all working branches):**

```
.ceads/
├── config.yml              # Project configuration (tracked)
├── .gitignore              # Ignores everything except config (tracked)
│
│   # Everything below is gitignored (local/transient):
├── local/                  # Private workspace (never synced)
│   └── lo-l1m2.json
├── cache/                  # Bridge cache (never synced)
│   ├── outbound/           # Queue: messages to send
│   ├── inbound/            # Buffer: recent messages
│   └── state.json          # Connection state
├── daemon.sock             # Daemon socket (local only)
├── daemon.pid              # Daemon PID file (local only)
└── daemon.log              # Daemon log (local only)
```

**On ceads-sync branch:**

```
.ceads-sync/
├── nodes/                     # Shared graph entities
│   ├── issues/                # Issue nodes
│   │   ├── is-a1b2.json
│   │   ├── is-f14c.json
│   │   └── is-c3d4.json
│   ├── agents/                # Agent nodes
│   │   ├── ag-x1y2.json
│   │   └── ag-a3b4.json
│   └── messages/              # Message nodes
│       ├── ms-p1q2.json       # Comment on issue is-a1b2
│       └── ms-r3s4.json
├── attic/                     # Archive
│   ├── conflicts/             # Merge conflict losers
│   │   └── is-a1b2/
│   │       └── 2025-01-07T10-30-00Z_description.json
│   └── orphans/               # Integrity violations
└── meta.json                  # Runtime metadata
```

#### Files Tracked on Main Branch

```
.ceads/config.yml           # Project configuration (YAML)
.ceads/.gitignore           # Ignores local/cache/daemon files
```

#### .ceads/.gitignore Contents

```gitignore
# Ignore everything in .ceads/ except config files
*
!.gitignore
!config.yml
```

#### Files Tracked on ceads-sync Branch

```
.ceads-sync/nodes/          # All node types (issues, agents, messages)
.ceads-sync/attic/          # Conflict and orphan archive
.ceads-sync/meta.json       # Runtime metadata
```

#### Files Never Tracked (Local Only)

```
.ceads/local/               # Private workspace
.ceads/cache/               # Bridge cache
.ceads/daemon.sock          # Daemon socket
.ceads/daemon.pid           # Daemon PID
.ceads/daemon.log           # Daemon log
```

#### Example Config File

**Config** (`.ceads/config.yml` on main branch):

```yaml
# Ceads configuration
# See: https://github.com/[org]/ceads

ceads_version: "0.1.0"

sync:
  branch: ceads-sync
  # repo: origin

prefixes:
  is: cd
  ag: agent
  ms: msg
  lo: local

settings:
  heartbeat_ttl_seconds: 300
  message_ttl_days: 7
```

#### Example Node Files

**Issue** (`.ceads-sync/nodes/issues/is-a1b2.json`):

```json
{
  "type": "is",
  "id": "is-a1b2",
  "version": 3,
  "created_at": "2025-01-07T10:00:00Z",
  "updated_at": "2025-01-07T14:30:00Z",
  "kind": "bug",
  "title": "Fix authentication timeout",
  "description": "Users are getting logged out after 5 minutes",
  "status": "in_progress",
  "priority": 1,
  "assignee": "ag-x1y2",
  "labels": ["backend", "security"],
  "dependencies": [
    { "type": "blocks", "target": "is-f14c" }
  ]
}
```

**Issue with children** (`.ceads-sync/nodes/issues/is-e5f6.json`):

```json
{
  "type": "is",
  "id": "is-e5f6",
  "version": 2,
  "created_at": "2025-01-07T09:00:00Z",
  "updated_at": "2025-01-07T10:00:00Z",
  "kind": "epic",
  "title": "Implement user authentication",
  "description": "Add login, logout, and session management",
  "status": "open",
  "priority": 1,
  "labels": [],
  "dependencies": [],
  "sequence": ["is-a1b2", "is-f14c", "is-c3d4"]
}
```

**Child issue** (`.ceads-sync/nodes/issues/is-c3d4.json`):

```json
{
  "type": "is",
  "id": "is-c3d4",
  "version": 1,
  "created_at": "2025-01-07T10:05:00Z",
  "updated_at": "2025-01-07T10:05:00Z",
  "kind": "task",
  "title": "Create user database schema",
  "status": "open",
  "priority": 1,
  "parent_id": "is-e5f6",
  "labels": [],
  "dependencies": []
}
```

**Message (comment on issue)** (`.ceads-sync/nodes/messages/ms-p1q2.json`):

```json
{
  "type": "ms",
  "id": "ms-p1q2",
  "version": 1,
  "created_at": "2025-01-07T11:00:00Z",
  "updated_at": "2025-01-07T11:00:00Z",
  "subject": "Found the root cause",
  "body": "The issue is in session.ts - the timeout is hardcoded to 5 minutes instead of reading from config.",
  "author": "ag-x1y2",
  "in_reply_to": "is-a1b2"
}
```

**Agent** (`.ceads-sync/nodes/agents/ag-x1y2.json`):

```json
{
  "type": "ag",
  "id": "ag-x1y2",
  "version": 5,
  "created_at": "2025-01-07T09:00:00Z",
  "updated_at": "2025-01-07T14:30:00Z",
  "display_name": "claude-backend-1",
  "status": "active",
  "last_heartbeat": "2025-01-07T14:30:00Z",
  "working_on": ["is-a1b2"],
  "file_reservations": [
    {
      "path": "src/auth/**",
      "exclusive": true,
      "expires_at": "2025-01-07T15:30:00Z",
      "reason": "is-a1b2"
    }
  ],
  "capabilities": ["code", "test"],
  "metadata": {}
}
```

**Local item** (`.ceads/local/lo-l1m2.json`):

```json
{
  "type": "lo",
  "id": "lo-l1m2",
  "version": 1,
  "created_at": "2025-01-07T14:00:00Z",
  "updated_at": "2025-01-07T14:00:00Z",
  "kind": "task",
  "title": "TODO: Refactor this function later",
  "status": "open",
  "priority": 3,
  "labels": ["refactor"]
}
```

**Meta** (`.ceads-sync/meta.json` on sync branch):

```json
{
  "schema_versions": [
    { "collection": "issues", "version": 1 },
    { "collection": "agents", "version": 1 },
    { "collection": "messages", "version": 1 }
  ],
  "created_at": "2025-01-07T08:00:00Z",
  "last_sync": "2025-01-07T14:30:00Z"
}
```

> **Note**: User-editable configuration (prefixes, TTLs, sync settings) is in
> `.ceads/config.yml` on the main branch. See [Example Config File](#example-config-file).

### 7.6 Key References

#### Predecessor System

- **Beads** — Git-backed issue tracking for AI coding agents

  - Repository: https://github.com/steveyegge/beads

  - Introducing Beads:
    https://steve-yegge.medium.com/introducing-beads-a-coding-agent-memory-system-637d7d92514a

  - Beads Best Practices:
    https://steve-yegge.medium.com/beads-best-practices-2db636b9760c

  - Design Philosophy:
    https://steve-yegge.medium.com/the-beads-revolution-how-i-built-the-todo-system-that-ai-agents-actually-want-to-use-228a5f9be2a9

#### Core Technologies

- **Git**

  - Pro Git Book: https://git-scm.com/book/en/v2

  - Git Internals - Plumbing and Porcelain:
    https://git-scm.com/book/en/v2/Git-Internals-Plumbing-and-Porcelain

  - git-read-tree: https://git-scm.com/docs/git-read-tree

  - git-write-tree: https://git-scm.com/docs/git-write-tree

  - git-update-ref: https://git-scm.com/docs/git-update-ref

  - git-show: https://git-scm.com/docs/git-show

  - git-ls-tree: https://git-scm.com/docs/git-ls-tree

- **SQLite**

  - Write-Ahead Logging: https://sqlite.org/wal.html — Documents WAL mode and its
    network filesystem limitations

  - SQLite Over a Network: https://sqlite.org/useovernet.html — Official guidance on
    network usage caveats

  - File Locking and Concurrency: https://www.sqlite.org/lockingv3.html — Explains POSIX
    advisory locking requirements

- **Zod** — TypeScript-first schema validation with static type inference

  - Documentation: https://zod.dev/

  - Repository: https://github.com/colinhacks/zod

- **JSON-RPC 2.0** — Lightweight RPC protocol used for daemon communication

  - Specification: https://www.jsonrpc.org/specification

#### Distributed Systems Concepts

- **CRDTs** (Conflict-free Replicated Data Types)

  - Resource hub: https://crdt.tech/

  - Foundational paper (Shapiro et al.
    2011): https://link.springer.com/chapter/10.1007/978-3-642-24550-3_29

  - Survey paper: https://arxiv.org/abs/1805.06358

  - Automerge (implementation): https://github.com/automerge/automerge

  - Yjs (implementation): https://github.com/yjs/yjs

- **Operational Transform**

  - Wikipedia overview: https://en.wikipedia.org/wiki/Operational_transformation

  - ShareDB (implementation): https://github.com/share/sharedb

- **Optimistic Concurrency Control**

  - Wikipedia: https://en.wikipedia.org/wiki/Optimistic_concurrency_control

  - AWS DynamoDB versioning:
    https://docs.aws.amazon.com/amazondynamodb/latest/developerguide/BestPractices_ImplementingVersionControl.html

#### File Watching APIs

- **Linux**: inotify — https://man7.org/linux/man-pages/man7/inotify.7.html

  - Efficient kernel-level file system event notification; may overflow under high event
    rates

- **macOS**: FSEvents —
  https://developer.apple.com/documentation/coreservices/file_system_events

  - Scales well with no known performance degradation; 4096 watched path limit

- **Windows**: ReadDirectoryChangesW —
  https://learn.microsoft.com/en-us/windows/win32/api/winbase/nf-winbase-readdirectorychangesw

  - Provides filename details unlike FindFirstChangeNotification; buffer overflow
    possible

- **Cross-platform**: fswatch — https://github.com/emcrisostomo/fswatch

  - Abstracts platform differences; auto-selects best backend per OS

#### Bridge Layer Technologies

- **Convex** — Reactive database with automatic query subscriptions

  - Documentation: https://docs.convex.dev/

  - Repository: https://github.com/get-convex/convex-backend

- **Supabase Realtime** — PostgreSQL change notifications via WebSocket

  - Documentation: https://supabase.com/docs/guides/realtime

  - Repository: https://github.com/supabase/realtime

- **NATS** — Cloud-native messaging (CNCF project)

  - Documentation: https://docs.nats.io

  - Repository: https://github.com/nats-io/nats-server

- **Redis Pub/Sub** — In-memory real-time messaging

  - Documentation: https://redis.io/docs/latest/develop/pubsub/

- **GitHub API**

  - REST API (Issues): https://docs.github.com/en/rest/issues

  - GraphQL API: https://docs.github.com/en/graphql

  - Webhooks: https://docs.github.com/en/webhooks

- **Slack API**

  - Events API: https://docs.slack.dev/apis/events-api/

  - Socket Mode: https://docs.slack.dev/apis/events-api/using-socket-mode/

  - Bolt Framework: https://docs.slack.dev/tools/bolt-python/

#### Desktop UI Frameworks

- **Electron** — https://www.electronjs.org/docs/latest

  - Full Node.js access; larger binaries; mature ecosystem

- **Tauri 2.0** — https://v2.tauri.app/

  - Rust backend; small binaries (~600KB); supports desktop and mobile (iOS/Android)

#### AI Agent Frameworks and Protocols

- **Model Context Protocol (MCP)** — Open standard for AI tool integration (donated to
  Linux Foundation, Dec 2025)

  - Specification: https://modelcontextprotocol.io/specification/2025-11-25

  - Repository: https://github.com/modelcontextprotocol

  - Announcement: https://www.anthropic.com/news/model-context-protocol

- **LangChain** — High-level agent framework (v1.0)

  - Documentation: https://docs.langchain.com

  - Repository: https://github.com/langchain-ai/langchain

- **LangGraph** — Low-level agent orchestration with durable execution

  - Documentation: https://www.langchain.com/langgraph

- **CrewAI** — Multi-agent framework (v1.0)

  - Documentation: https://docs.crewai.com/

  - Repository: https://github.com/crewAIInc/crewAI

- **AutoGen** — Microsoft’s multi-agent framework (merging with Semantic Kernel)

  - Documentation: https://microsoft.github.io/autogen/stable/

  - Repository: https://github.com/microsoft/autogen

#### Alternative Git-Native Issue Trackers

- **git-bug** — https://github.com/git-bug/git-bug

  - Most mature; stores issues as git objects; GraphQL API; GitHub/GitLab bridges

- **git-issue** — https://github.com/dspinellis/git-issue

  - Minimalist; plain text files; zero dependencies; bidirectional sync with
    GitHub/GitLab

- **tk (ticket)** — https://github.com/wedow/ticket

  - Designed for AI agents; single bash script; YAML frontmatter + markdown format

- **git-appraise** — https://github.com/google/git-appraise

  - Google’s distributed code review; structured schemas; uses separate git refs
