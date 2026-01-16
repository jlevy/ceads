# Tbd: A Simple Git-Native Coordination System for AI Agents

**Author:** Joshua Levy (github.com/jlevy) and various LLMs

**Status**: Draft

**Date**: January 2025

* * *

## Table of Contents

1. [Introduction](#1-introduction)

   - [What is Tbd?](#11-what-is-tbd)

   - [Motivation](#12-motivation)

   - [Design Goals](#13-design-goals)

   - [Design Principles](#14-design-principles)

   - [Comparison with Beads](#15-comparison-with-beads)

   - [Design Assumptions](#16-design-assumptions)

   - [Layer Overview](#17-layer-overview)

2. [File Layer](#2-file-layer)

   - [Overview](#21-overview)

   - [Directory Structure](#22-directory-structure)

   - [Entity Collection Pattern](#23-entity-collection-pattern)

   - [ID Generation](#24-id-generation)

   - [Schemas](#25-schemas)

   - [Schema Versioning and Migration](#26-schema-versioning-and-migration)

3. [Git Layer](#3-git-layer)

   - [Overview](#31-overview)

   - [Sync Branch Architecture](#32-sync-branch-architecture)

   - [Sync Operations](#33-sync-operations)

   - [Conflict Detection and Resolution](#34-conflict-detection-and-resolution)

   - [Merge Rules](#35-merge-rules)

   - [Merge Algorithm](#36-merge-algorithm)

   - [Attic Structure](#37-attic-structure)

   - [Deletion Semantics](#38-deletion-semantics)

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

   - [Optional Enhancements](#77-optional-enhancements)

* * *

## 1. Introduction

### 1.1 What is Tbd?

> *The name “Tbd” follows “Beads” in the spirit of C following (and learning from) B.*

**Tbd** (pronounced “seeds”) is a git-native coordination layer for AI coding agents.
It provides issue tracking, agent registry, claims, and messaging—all stored as JSON
files in a git repository and synced using standard git commands.

Tbd draws on several sources:

- **[Beads](https://github.com/steveyegge/beads)**: Steve Yegge’s git-backed issue
  tracker for AI agents, which proved the concept valuable but accumulated architectural
  complexity (see [Section 1.5](#15-comparison-with-beads))

- **Git-native issue trackers**: Projects like
  [git-bug](https://github.com/git-bug/git-bug) and
  [git-issue](https://github.com/dspinellis/git-issue) demonstrated that issue tracking
  can live entirely within a git repository

- **Emerging agent workflows**: Multi-agent coordination patterns like
  [Agent Mail](https://github.com/Dicklesworthstone/mcp_agent_mail), kanban-style agent
  dashboards, and inter-agent messaging systems that are becoming common as AI coding
  agents take on more complex work

The goal is a simple, extensible foundation that makes these workflows easy to build on.

### 1.2 Motivation

AI coding agents are becoming integral to software development workflows.
As these agents take on more complex tasks—bug fixes, feature implementations, code
reviews—they need ways to coordinate their work.
This coordination challenge has several dimensions:

**Issue tracking for agents**: Just as human developers benefit from issue trackers to
organize and prioritize work, AI agents need structured task queues.
An agent should be able to see what work is available, claim tasks, track progress, and
mark completion.

**Multi-agent coordination**: When multiple agents work on the same codebase—whether
simultaneously or across different sessions—they need to avoid duplicate work, respect
each other’s claims, and communicate discoveries.
This requires an agent registry, claiming mechanisms, and messaging.

**Human-agent collaboration**: Humans and agents often work together.
A human might create issues for agents to work on, review agent output, or take over
when agents get stuck.
The coordination system should be transparent to humans, not a black box.

**Why embed this in Git?** Git repositories already contain the code agents work on.
Embedding coordination data in the same repository provides:

- **No external dependencies**: Works offline, in CI, in any environment with git

- **Built-in distribution**: Git push/pull handles sync across machines

- **Audit trail**: All changes tracked, reversible, inspectable

- **Familiar tooling**: Standard git commands, no new infrastructure

- **Code-adjacent context**: Issues live next to the code they describe

Tbd is designed around three core ideas:

1. **The file system is the database, git is the sync protocol.** Each entity is a file.
   Directories are collections.
   Git handles distribution.

2. **Sync is schema-agnostic, merge is schema-aware.** The sync layer detects changes
   using file hashes—it doesn’t interpret JSON content.
   However, when merging conflicting entities, the merge algorithm uses per-entity-type
   rules. Adding new entity types requires only a new directory, schema, and merge
   rules—no sync logic changes.

3. **Coordination is just more entities.** Multi-agent work requires messaging, agent
   registry, and work claims.
   With schema-agnostic sync, these are just more entity types (`agents/`, `messages/`)
   using the same pattern—no separate message queue or coordination service needed.

### 1.3 Design Goals

These are the outcomes we want to achieve:

1. **No data loss**: Conflicts preserve both versions via attic mechanism.
   No silent overwrites.

2. **Works on any filesystem**: Must work reliably on network file systems (NFS, SMB),
   cloud-mounted volumes, and containerized environments like Claude Code Cloud—not just
   local SSDs. This rules out SQLite WAL mode and POSIX advisory locking.

3. **Cross-platform portability**: Runs on macOS, Linux, and Windows without
   platform-specific code paths.
   Works in local development, cloud-hosted IDEs (Claude Code Cloud, GitHub Codespaces),
   and CI environments.

4. **Cross-language compatibility**: All file formats readable from TypeScript, Python,
   and Rust using standard libraries.
   No proprietary or language-specific formats.

5. **Scales to typical projects**: Target 5,000-10,000 issues with <50ms query
   performance for common operations.

6. **Progressive complexity**: Single-agent workflows need no daemon or bridges.
   Multi-agent work adds them as needed.

7. **Extensible by convention**: New entity types follow the same pattern—no core
   changes required.

### 1.4 Design Principles

These principles guide how we achieve the goals:

1. **File system as truth**: Each entity is a JSON file.
   The file system is the canonical state.
   Any index or cache is derived and can be rebuilt from entity files.

2. **Schema-agnostic sync, schema-aware merge**: The sync layer detects and transfers
   file changes using content hashes—it doesn’t parse JSON. The merge layer, invoked
   when content differs, applies per-entity-type field rules.
   Adding new entity types requires only a new directory, schema, and merge rules.

3. **Layered architecture**: File Layer (format) → Git Layer (sync) → CLI Layer
   (interface) → Bridge Layer (real-time).
   Each layer has clear responsibilities.

4. **Git as distribution**: Standard git commands handle all synchronization.
   No custom network protocols or sync services.

### 1.5 Comparison with Beads

Tbd builds on lessons learned from [Beads](https://github.com/steveyegge/beads), an
earlier git-backed issue tracker for AI agents.
While Beads proved the concept valuable, its architecture accumulated complexity:

- **4-location data sync**: SQLite → Local JSONL → Sync Branch → Main Branch

- **Skip-worktree hacks**: Hide tracked files from `git status` while daemon modifies
  them

- **Worktree complexity**: Separate git worktrees to commit to sync branch without
  checkout; depending on configuration, you can’t manually check out “main”

- **Daemon-user conflicts**: Background process fights manual git operations

- **Tight coupling**: Adding new entity types requires changes throughout the sync layer

Tbd addresses these by simplifying the architecture: fewer data locations, no
skip-worktree hacks, no git worktrees required, an optional daemon, and schema-agnostic
sync. See [Appendix 7.4](#74-comparison-with-beads) for a detailed comparison table.

### 1.6 Design Assumptions

These assumptions must hold for the system to work correctly.
If violated, the noted mitigations apply:

1. **Clock sync within seconds**: We assume NTP keeps local clocks accurate to within a
   few seconds. Last-Write-Wins (LWW) using `updated_at` timestamps works reliably under
   this assumption. *If violated*: Conflicts may resolve to the “wrong” winner.
   The attic preserves the loser, enabling manual recovery.
   See Appendix 7.7.1 for HLC enhancement if clock skew becomes problematic.

2. **Git available everywhere**: All environments have git installed and can push/pull
   to the remote. *If violated*: System cannot sync.
   Local operations still work.

3. **Cooperative agents**: Agents follow conventions (check claims, respect status).
   The system is not designed to prevent malicious actors.
   *If violated*: Agents may duplicate work or create conflicts.
   Human oversight can resolve.

4. **Low conflict rate**: Multiple agents editing the same entity simultaneously is
   rare. The design optimizes for this common case.
   *If violated*: More conflicts go to attic.
   LWW still resolves deterministically.
   Consider lease-based claims (Appendix 7.7.2) if racing becomes frequent.

5. **Temporary partitions**: Offline periods are bounded (hours to days, not weeks).
   Eventually all nodes can sync.
   *If violated*: Larger merge conflicts when reconnecting.
   Attic preserves all versions.

6. **Human oversight available**: Edge cases and ambiguous conflicts can be escalated to
   human review via attic inspection.
   *If violated*: Some conflicts may resolve suboptimally, but no data is lost.

### 1.7 Layer Overview

Tbd is organized into distinct layers, each with clear responsibilities:

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
│   tbd <command> [args] [options]                               │
└──────────────────────────────┬───────────────────────────────────┘
                               │
┌──────────────────────────────┼───────────────────────────────────┐
│                        Git Layer                                 │
│                        Distributed sync                          │
│   tbd-sync branch │ git fetch/push │ merge algorithm          │
└──────────────────────────────┬───────────────────────────────────┘
                               │
┌──────────────────────────────┼───────────────────────────────────┐
│                        File Layer                                │
│                        Format specification                      │
│   .tbd/config.yml │ .tbd-sync/ │ JSON schemas (Zod)         │
└─────────────────────────────────────────────────────────────────┘
```

**File Layer**: Defines the format—JSON schemas, directory structure, ID generation.
Storage-agnostic; could theoretically work with any backend.

**Git Layer**: Defines sync using standard git commands.
The `tbd-sync` branch, push/pull operations, merge algorithm.

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

- **Canonical JSON format**: All JSON files MUST use canonical serialization to ensure
  content hashes are consistent across implementations:

  - Keys sorted alphabetically (recursive)

  - 2-space indentation

  - No trailing whitespace

  - Single newline at end of file

  - No trailing commas

  - UTF-8 encoding

- **Storage-agnostic**: Could work with local filesystem, S3, or any key-value store.

- **Self-documenting files**: Each JSON file contains a `type` field identifying its
  entity type, making files meaningful in isolation.

> **Why canonical JSON?** Content hashes are used for conflict detection.
> If different implementations serialize the same object with different key ordering or
> whitespace, identical logical content produces different hashes, causing spurious
> “conflicts.” Canonical serialization ensures `hash(serialize(obj))` is consistent
> everywhere.

#### Atomic File Writes

All file writes MUST be atomic to prevent corruption from crashes or concurrent access:

```typescript
async function atomicWrite(path: string, content: string): Promise<void> {
  const tmpPath = `${path}.tmp.${process.pid}.${Date.now()}`;

  // Write to temporary file
  await fs.writeFile(tmpPath, content, 'utf8');

  // Ensure data is on disk (important for durability)
  const fd = await fs.open(tmpPath, 'r');
  await fd.sync();
  await fd.close();

  // Atomic rename (POSIX guarantees this is atomic)
  await fs.rename(tmpPath, path);
}
```

**Why atomic writes?**

- Prevents half-written files if process crashes mid-write

- Prevents readers from seeing incomplete content

- Works on most filesystems (POSIX rename is atomic)

- Important on network filesystems and Windows

**Cleanup:** On startup, remove any orphaned `.tmp.*` files in tbd directories.

### 2.2 Directory Structure

Tbd uses two directories with a clear separation of concerns:

- **`.tbd/`** on the main branch (and all working branches): Configuration and local
  files

- **`.tbd-sync/`** on the `tbd-sync` branch: Synced data (entities, attic, metadata)

#### On Main Branch (all working branches)

```
.tbd/
├── config.yml              # Project configuration (tracked)
├── .gitignore              # Ignores local/ directory (tracked)
│
└── local/                  # Everything below is gitignored
    ├── state.json          # Per-node sync state (last_sync, node_id)
    ├── worktrees/          # Hidden git worktree for sync operations
    │   └── tbd-sync/     # Checkout of tbd-sync branch
    ├── nodes/              # Private workspace (never synced)
    │   └── lo-l1m2.json
    ├── cache/              # Bridge cache
    │   ├── outbound/       # Queue: bridge messages to send
    │   ├── inbound/        # Buffer: recent bridge messages
    │   ├── dead_letter/    # Failed after max retries
    │   └── state.json      # Connection state
    ├── daemon.sock         # Daemon Unix socket
    ├── daemon.pid          # Daemon PID file
    └── daemon.log          # Daemon log file
```

#### On `tbd-sync` Branch

```
.tbd-sync/
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
│   │       └── 20250107T103000Z_description_theirs.json
│   └── orphans/               # Integrity violations
├── short-ids/                 # Short ID → Internal ID mappings
│   ├── a1b.json               # {"internal_id": "is-a1b2c3d4e5"}
│   └── x7k.json               # {"internal_id": "is-x7y8z9a0b1"}
└── meta.json                  # Shared metadata (schema_versions, created_at)
```

> **Note on directory split**: The `.tbd/` directory on main contains configuration
> (which versions with your code) and local-only files (which are gitignored).
> The `.tbd-sync/` directory on the sync branch contains all shared data.
> This separation ensures synced data never causes merge conflicts on your working
> branches.

> **Note on “nodes”**: The `nodes/` directory contains entities that form the shared
> coordination graph—issues, agents, messages, and future entity types.
> These are interconnected (dependencies, `in_reply_to`, `working_on`) and synced across
> machines. The `local/nodes/` directory is explicitly outside this graph—a private
> workspace that is never synced.

### 2.3 Entity Collection Pattern

Tbd uses a uniform pattern for all node types.
Each collection is:

1. **A directory** under `.tbd-sync/nodes/` (on the sync branch)

2. **A Zod schema** defining the entity structure

3. **An ID prefix** derived from the directory name

#### Adding a New Node Type

To add a new node type (e.g., `workflows`):

1. Create directory: `.tbd-sync/nodes/workflows/` (on sync branch)

2. Define schema: `WorkflowSchema` in Zod

3. Define ID prefix: `wf-` (derived from directory name)

4. Define merge rules in Git Layer (usually: LWW for scalars, union for arrays)

5. Add CLI commands: `tbd workflow create`, etc.

**No changes to Git sync algorithm required.** Sync operates on files, not schemas.
Only the merge rules (in Git Layer) need updating for new node types.

#### Built-in Node Collections (on sync branch)

| Collection | Directory | Internal Prefix | Purpose |
| --- | --- | --- | --- |
| Issues | `.tbd-sync/nodes/issues/` | `is-` | Task tracking |
| Agents | `.tbd-sync/nodes/agents/` | `ag-` | Agent registry |
| Messages | `.tbd-sync/nodes/messages/` | `ms-` | Comments on issues (and future messaging) |

#### Non-Node Collections (on main branch, gitignored)

| Collection | Directory | Internal Prefix | Purpose |
| --- | --- | --- | --- |
| Local | `.tbd/local/nodes/` | `lo-` | Private workspace (never synced) |

> **Note**: Local items use the same entity pattern but are not “nodes” because they are
> not part of the shared coordination graph.
> They live in `.tbd/local/nodes/` on the main branch and are gitignored—never synced.

#### Future Node Collections (Examples)

| Collection | Directory | Internal Prefix | Purpose |
| --- | --- | --- | --- |
| Templates | `.tbd-sync/nodes/templates/` | `tp-` | Issue templates |
| Workflows | `.tbd-sync/nodes/workflows/` | `wf-` | Multi-step procedures |
| Artifacts | `.tbd-sync/nodes/artifacts/` | `ar-` | File attachments |

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

- **Prefix**: 2 lowercase letters matching directory name (`is-`, `ag-`, `lo-`, `ms-`)

- **Hash**: 10 lowercase alphanumeric characters (base36)

Example: `is-a1b2c3d4e5`, `ag-x1y2z3a4b5`, `lo-p3q4r5s6t7`

#### ID Generation Algorithm

```typescript
import { randomBytes } from 'crypto';

const BASE36_ALPHABET = '0123456789abcdefghijklmnopqrstuvwxyz';

function generateId(prefix: string): string {
  // 8 bytes = 64 bits of entropy
  // Converted to 10 base36 chars (~51.7 bits effective)
  const bytes = randomBytes(8);
  const num = bytes.readBigUInt64BE();
  let hash = '';
  let remaining = num;
  for (let i = 0; i < 10; i++) {
    hash = BASE36_ALPHABET[Number(remaining % 36n)] + hash;
    remaining = remaining / 36n;
  }
  return `${prefix}${hash}`;
}
```

**Recommended Alternative: nanoid**

The [nanoid](https://github.com/ai/nanoid) library provides a battle-tested
implementation with the same properties:

```typescript
import { customAlphabet } from 'nanoid';

const BASE36_ALPHABET = '0123456789abcdefghijklmnopqrstuvwxyz';
const nanoid36 = customAlphabet(BASE36_ALPHABET, 10);

function generateId(prefix: string): string {
  return `${prefix}${nanoid36()}`;
}
```

Benefits of nanoid:

- Well-tested and widely used

- Handles secure random generation correctly across environments

- Available for multiple languages (JS, Python, Go, Rust, etc.)

Either implementation is acceptable; nanoid is recommended for production use.

**Properties:**

- **Cryptographically random**: Uses `crypto.randomBytes()`, no timestamp dependency

- **Entropy**: 64 bits of randomness, encoded as 10 base36 characters

- **Collision probability**: At 50,000 entities, probability of any collision is
  approximately `n²/(2×2⁶⁴) ≈ 6.8×10⁻¹¹` (negligible)

- **On collision**: Regenerate ID (detected by file-exists check on write)

- **Cross-language**: Algorithm is straightforward to implement in any language

**ID validation regex:**

```typescript
const EntityId = z.string().regex(/^[a-z]{2}-[a-z0-9]{10}$/);
```

> **Note**: Earlier drafts used 6-character hashes with incorrect entropy calculations.
> The current 10-character format provides ample collision resistance for any realistic
> scale while remaining readable.

#### External Short IDs

Users interact with **external short IDs** that are more readable than internal IDs.
Internal IDs are always 10-character hashes for collision resistance; external IDs use
adaptive-length random hashes that grow as the issue count increases.

**Example:**

```
Internal (storage):   is-a1b2c3d4e5    # Always 10 chars
External (display):   proj-a1b        # 3-6 chars, project prefix
```

##### Project Prefix

The project prefix is configured in the main branch `config.yaml`:

```yaml
tbd:
  project_prefix: proj # User-configurable, e.g., "myapp", "backend"
```

The prefix is **not stored** in `.tbd-sync/`—it’s purely a display concern.
Users can rename the prefix at any time without breaking references.

##### Short ID Generation

External short IDs are **randomly generated** at the appropriate length based on the
current issue count.
They are **not** derived from or prefixes of internal IDs.

**Algorithm:**

```typescript
const BASE36_ALPHABET = '0123456789abcdefghijklmnopqrstuvwxyz';

function createShortId(existingShortIds: Set<string>): string {
  const count = existingShortIds.size;
  const length = computeAdaptiveLength(count);

  for (let attempt = 0; attempt < 10; attempt++) {
    const candidate = randomBase36(length);
    if (!existingShortIds.has(candidate)) {
      return candidate;
    }
  }
  // Collision at current length (rare): try longer
  return createShortId(existingShortIds, length + 1);
}

function randomBase36(length: number): string {
  let result = '';
  for (let i = 0; i < length; i++) {
    result += BASE36_ALPHABET[Math.floor(Math.random() * 36)];
  }
  return result;
}
```

##### Adaptive Length (Birthday Paradox)

The short ID length scales with issue count to maintain low collision probability.
Using the birthday paradox approximation:

```
P(collision) ≈ 1 - e^(-n²/2N)
```

Where `n` = number of issues, `N` = 36^length (total possible IDs).

**Collision probability table:**

| Issue Count | 3-char | 4-char | 5-char | 6-char |
| --- | --- | --- | --- | --- |
| 50 | 2.6% | 0.07% | 0.00% | 0.00% |
| 100 | 10.2% | 0.30% | 0.01% | 0.00% |
| 200 | 34.6% | 1.18% | 0.03% | 0.00% |
| 500 | 95.8% | 7.17% | 0.21% | 0.01% |
| 1,000 | 100% | 25.75% | 0.82% | 0.02% |
| 2,000 | 100% | 69.60% | 3.25% | 0.09% |
| 5,000 | 100% | 99.94% | 18.68% | 0.57% |

**Adaptive length algorithm:**

```typescript
function computeAdaptiveLength(issueCount: number, maxCollisionProb = 0.1): number {
  const minLength = 3;
  const maxLength = 10;

  for (let length = minLength; length <= maxLength; length++) {
    const prob = collisionProbability(issueCount, length);
    if (prob <= maxCollisionProb) {
      return length;
    }
  }
  return maxLength;
}

function collisionProbability(n: number, length: number): number {
  const N = Math.pow(36, length); // Total possible IDs
  const exponent = -(n * n) / (2 * N);
  return 1 - Math.exp(exponent);
}
```

**Default thresholds (10% max collision):**

| Issue Count | Short ID Length |
| --- | --- |
| 0-100 | 3 chars |
| 101-600 | 4 chars |
| 601-3,500 | 5 chars |
| 3,501-21,000 | 6 chars |
| 21,001+ | continues scaling |

##### Short ID Mapping Storage

Short ID mappings are stored as **one file per short ID**, following the same pattern as
entity storage:

```
.tbd-sync/short-ids/
├── a1b.json     # {"internal_id": "is-a1b2c3d4e5"}
├── x7k.json     # {"internal_id": "is-x7y8z9a0b1"}
└── m3p9.json    # {"internal_id": "is-m3n4o5p6q7"}
```

**File schema:**

```typescript
const ShortIdMapping = z.object({
  internal_id: EntityId,
});
```

**Properties:**

- **One file per short ID**: Filename is the short ID (e.g., `a1b.json`)

- **No merge conflicts**: Different short IDs = different files

- **Last-write-wins**: Natural Git behavior on file conflicts

- **Self-describing**: Filename IS the short ID

- **Consistent**: Same storage pattern as entities

##### Resolution Flow

**Display (internal → external):**

```typescript
function toExternalId(internalId: string, shortIdsDir: string, prefix: string): string {
  // Scan short-ids/ for file containing this internal ID
  const files = glob(`${shortIdsDir}/*.json`);
  for (const file of files) {
    const mapping = JSON.parse(readFile(file));
    if (mapping.internal_id === internalId) {
      const shortId = basename(file, '.json');
      return `${prefix}-${shortId}`;
    }
  }
  // No mapping exists - should trigger short ID creation
  return internalId;
}
```

**Parse (external → internal):**

```typescript
function resolveExternalId(externalId: string, shortIdsDir: string, prefix: string): string | null {
  // "proj-a1b" → "a1b" → read a1b.json → "is-a1b2c3d4e5"
  const parts = externalId.split('-');
  if (parts[0] !== prefix) return null;

  const shortId = parts.slice(1).join('-');
  const filePath = `${shortIdsDir}/${shortId}.json`;

  if (!fileExists(filePath)) return null;

  const mapping = JSON.parse(readFile(filePath));
  return mapping.internal_id;
}
```

**Ensure short ID exists (on create or after collision):**

```typescript
function ensureShortId(internalId: string, shortIdsDir: string): string {
  // Check if any short ID already maps to this internal ID
  const files = glob(`${shortIdsDir}/*.json`);
  for (const file of files) {
    const mapping = JSON.parse(readFile(file));
    if (mapping.internal_id === internalId) {
      return basename(file, '.json'); // Already has short ID
    }
  }

  // No mapping exists (new issue or lost collision) - generate new short ID
  const existingShortIds = new Set(files.map((f) => basename(f, '.json')));
  const shortId = createShortId(existingShortIds);

  writeFile(`${shortIdsDir}/${shortId}.json`, JSON.stringify({ internal_id: internalId }));
  return shortId;
}
```

##### Distributed Collision Handling

When two clients simultaneously generate the same random short ID:

1. Client A creates `a1b.json` → `{"internal_id": "is-xxx"}`

2. Client B creates `a1b.json` → `{"internal_id": "is-yyy"}`

3. Git merge: **last-write-wins** on the file (one internal ID wins)

4. Losing client syncs, runs `ensureShortId("is-xxx")`, finds no mapping

5. Losing client generates new short ID (e.g., `b2c.json`)

**No attic needed** for short IDs—the current state is always authoritative.
If an internal ID loses its short ID mapping, it simply regenerates one.

**Orphan cleanup** (optional): Short ID files pointing to non-existent entities can be
deleted during garbage collection.
Not critical since they’re tiny.

##### Internal Prefixes

Internal prefixes are fixed and match directory names:

| Internal Prefix | Entity Type | Directory |
| --- | --- | --- |
| `is-` | Issues | `issues/` |
| `ag-` | Agents | `agents/` |
| `ms-` | Messages | `messages/` |
| `lo-` | Local | `local/` (not synced) |

Internal prefixes are used in file references, cross-entity links, and storage.
The CLI accepts both internal IDs (`is-a1b2c3d4e5`) and external IDs (`proj-a1b`) and
translates automatically.

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
// Using regex pattern (not enum) for extensibility - new entity types
// can be added without changing this definition
const EntityType = z.string().regex(/^[a-z]{2}$/);

// Built-in types: 'is' (issues), 'ag' (agents), 'ms' (messages), 'lo' (local)
// Extension types follow same pattern: 'cl' (claims), 'wf' (workflows), etc.
```

> **Note on extensibility**: `EntityType` uses a regex pattern (`/^[a-z]{2}$/`) rather
> than a closed enum. This allows adding new entity types by convention—create a new
> directory and schema without modifying core type definitions.
> The type must match the ID prefix and directory name.

#### 2.5.2 BaseEntity

All entities share common fields:

```typescript
const BaseEntity = z.object({
  type: EntityType, // 2-letter type code matching ID prefix
  id: EntityId,
  version: Version,
  created_at: Timestamp,
  updated_at: Timestamp,

  // Extensibility namespace for third-party data
  extensions: z.record(z.string(), z.unknown()).optional(),
});
```

> **Note on `type` field**: Every entity includes a `type` field that matches its
> directory prefix (e.g., `"is"` for issues in `issues/`). This makes JSON files
> self-documenting—you can identify what kind of entity a file contains without knowing
> its path.

> **Note on `extensions`**: The `extensions` field provides a namespace for third-party
> tools, bridges, and custom integrations to store metadata without modifying core
> schemas. Keys should be namespaced (e.g., `"github"`, `"slack"`, `"my-tool"`). Unknown
> extensions are preserved during sync and merge (pass-through).
> 
> Example:
> 
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
const DependencyType = z.enum(['blocks', 'related', 'discovered-from']);

const Dependency = z.object({
  type: DependencyType,
  target: EntityId,
});

const IssueStatus = z.enum(['open', 'in_progress', 'blocked', 'deferred', 'closed']);
const IssueKind = z.enum(['bug', 'feature', 'task', 'epic', 'chore']);
const Priority = z.number().int().min(0).max(4);

const IssueSchema = BaseEntity.extend({
  type: z.literal('is'), // Entity type discriminator
  kind: IssueKind.default('task'), // Issue classification

  title: z.string().min(1).max(500),
  description: z.string().max(50000).optional(),
  notes: z.string().max(50000).optional(), // Working notes
  status: IssueStatus.default('open'),
  priority: Priority.default(2),

  assignee: z.string().optional(), // Advisory claim (agent ID or name)
  labels: z.array(z.string()).default([]),
  dependencies: z.array(Dependency).default([]),

  // Parent-child relationship for hierarchical issues
  parent_id: EntityId.optional(), // If this is a child issue
  sequence: z.array(EntityId).optional(), // Ordered list of child IDs (on parent)

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

> **Note on parent-child relationships**: Issues can form hierarchies using `parent_id`
> (on child) and `sequence` (on parent).
> These are **redundant by design** for query efficiency, but can become inconsistent
> during conflicts.
> 
> **Authoritative source**: `parent_id` is authoritative.
> A child “belongs to” whoever it claims as parent.
> The `sequence` array is a convenience for ordering.
> 
> **Invariants:**
> 
> - If child.parent_id = P, then child.id SHOULD appear in P.sequence
> - If P.sequence contains C, then C.parent_id SHOULD equal P
> 
> **When inconsistent** (detected by `tbd doctor`):
> 
> - If child has parent_id but isn’t in parent’s sequence: add to sequence
> - If parent’s sequence contains ID but that issue has different parent_id: remove from
>   sequence
> - If parent’s sequence contains non-existent ID: remove from sequence

#### 2.5.4 AgentSchema

```typescript
const AgentStatus = z.enum(['active', 'idle', 'inactive']);

const FileReservation = z.object({
  path: z.string(), // Glob pattern, e.g., "src/auth/**"
  exclusive: z.boolean(),
  expires_at: Timestamp,
  reason: z.string().optional(), // Usually issue ID
});

const AgentSchema = BaseEntity.extend({
  type: z.literal('ag'), // Entity type discriminator

  display_name: z.string(),
  status: AgentStatus.default('active'),
  last_heartbeat: Timestamp,

  working_on: z.array(EntityId).default([]), // Issue IDs
  file_reservations: z.array(FileReservation).default([]),

  capabilities: z.array(z.string()).default([]), // e.g., ["code", "test", "review"]
  metadata: z.record(z.unknown()).default({}), // Arbitrary agent-specific data
});

type Agent = z.infer<typeof AgentSchema>;
```

> **Heartbeat churn warning**: Frequent updates to `last_heartbeat` create Git sync
> contention. If N agents each update heartbeats every minute, the sync branch sees N×60
> commits/hour, causing push rejections and retry storms.
> 
> **Mitigation strategies:**
> 
> 1. **Throttle heartbeats**: Update every 5-15 minutes, not every minute
> 2. **Separate presence from durable state**: Use Bridge Layer for real-time presence;
>    Git stores only durable changes (status, working_on, file_reservations)
> 3. **Batch updates**: Coalesce multiple field changes into single commits
> 4. **Infer liveness**: Determine agent activity from recent entity updates rather than
>    explicit heartbeats
> 
> **Recommendation for v1**: Update `last_heartbeat` only on meaningful state changes
> (starting work, finishing work, status change), not on a timer.
> Real-time presence should use Bridge Layer when available.

#### 2.5.5 LocalSchema

Local entities are private workspace items (todo lists, scratch notes, etc.)
that are never synced.
They use a similar structure to issues but live in `local/`.

```typescript
const LocalSchema = BaseEntity.extend({
  type: z.literal('lo'), // Entity type discriminator

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

**Messages are immutable after creation.** This eliminates merge conflicts for message
content entirely—no merge logic needed.
“Edits” are represented as new messages with `supersedes` pointing to the original.

```typescript
const MessageSchema = BaseEntity.extend({
  type: z.literal('ms'), // Entity type discriminator

  subject: z.string().min(1).max(500), // Required: like email subject
  body: z.string().min(1).max(50000), // Required: message content

  author: z.string(), // Who wrote the message
  in_reply_to: EntityId, // Parent: issue ID or message ID

  // For "editing" messages (immutable edit pattern)
  supersedes: EntityId.optional(), // If set, this message replaces another
});

type Message = z.infer<typeof MessageSchema>;
```

**Design notes:**

- **Immutable content**: Once created, `subject`, `body`, `author`, and `in_reply_to`
  never change. This means messages never conflict during merge—huge simplification.

- **Edit pattern**: To “edit” a message, create a new message with `supersedes` pointing
  to the original. UIs show the latest version; history preserved via chain.

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
messages.filter((m) => m.in_reply_to === 'is-a1b2');

// All messages in a thread (recursive)
function getThread(parentId: string): Message[] {
  const direct = messages.filter((m) => m.in_reply_to === parentId);
  return direct.flatMap((m) => [m, ...getThread(m.id)]);
}
```

See [Decision 10](#decision-10-messages-as-unified-commentmessage-model) for rationale.

#### 2.5.7 ConfigSchema

Project configuration stored in `.tbd/config.yml` on the main branch.
This is the human-editable configuration file that versions with your code.

```yaml
# .tbd/config.yml
# See: https://github.com/[org]/tbd

tbd_version: '0.1.0'

sync:
  branch: tbd-sync # Branch name for synced data
  # repo: origin           # Remote repository (default: origin)

# Display aliases for entity IDs (internal → external)
prefixes:
  is: cd # issues display as cd-xxxx
  ag: agent # agents display as agent-xxxx
  ms: msg # messages display as msg-xxxx
  lo: local # local items display as local-xxxx

# Runtime settings
settings:
  heartbeat_ttl_seconds: 300 # Agent heartbeat timeout
  message_ttl_days: 7 # Message cache retention
```

```typescript
// TypeScript schema for config.yml validation
const SyncConfig = z.object({
  branch: z.string().default('tbd-sync'),
  repo: z.string().default('origin'),
});

const ConfigSchema = z.object({
  tbd_version: z.string(),
  sync: SyncConfig.default({}),
  prefixes: z.record(z.string(), z.string()).default({
    is: 'cd',
    ag: 'agent',
    ms: 'msg',
    lo: 'local',
  }),
  settings: z
    .object({
      heartbeat_ttl_seconds: z.number().default(300),
      message_ttl_days: z.number().default(7),
    })
    .default({}),
});

type Config = z.infer<typeof ConfigSchema>;
```

> **Note**: Configuration is stored in YAML format for human editability (comments,
> cleaner syntax). The CLI validates config.yml against ConfigSchema on startup.

#### 2.5.8 MetaSchema

Shared metadata stored in `.tbd-sync/meta.json` on the sync branch.
This file tracks schema versions and repository-wide metadata—it is managed by the
system, not edited by users.

```typescript
const SchemaVersion = z.object({
  collection: z.string(),
  version: z.number().int(),
});

const MetaSchema = z.object({
  schema_versions: z.array(SchemaVersion),
  created_at: Timestamp,
});

type Meta = z.infer<typeof MetaSchema>;
```

> **Note**: `last_sync` is intentionally NOT stored in `meta.json`. Syncing this file
> would create a conflict hotspot—every node updates it on every sync, causing constant
> merge conflicts. Instead, sync timestamps are tracked locally (see LocalStateSchema).

> **Note**: User-editable configuration (prefixes, TTLs, sync settings) is in
> `.tbd/config.yml` on the main branch.
> See [ConfigSchema](#257-configschema).

#### 2.5.9 LocalStateSchema

Per-node state stored in `.tbd/local/state.json` (gitignored, never synced).
Each machine maintains its own local state.

```typescript
const LocalStateSchema = z.object({
  node_id: z.string(), // Unique identifier for this node
  last_sync: Timestamp.optional(), // When this node last synced successfully
  last_push: Timestamp.optional(), // When this node last pushed
  last_pull: Timestamp.optional(), // When this node last pulled
});

type LocalState = z.infer<typeof LocalStateSchema>;
```

> **Why local?** The `last_sync` timestamp is inherently per-node.
> Storing it in synced state would cause every sync to modify the same file, creating a
> guaranteed conflict generator.
> Keeping it local eliminates this hotspot.

#### 2.5.10 AtticEntrySchema

Preserved conflict data for recovery and debugging:

```typescript
const AtticEntryKind = z.enum([
  'field_conflict', // Both sides changed same field differently
  'parse_error', // One side had unparsable JSON
  'invariant_violation', // ID/type mismatch or other invariant failure
]);

const AtticEntrySchema = z.object({
  kind: AtticEntryKind,
  entity_id: EntityId,
  path: z.string(), // Repo-relative path
  field: z.string().optional(), // Field name if single field conflict
  timestamp: Timestamp,

  // 3-way merge context (enables better recovery)
  base_value: z.unknown().optional(), // Value in common ancestor (null if new)
  ours_value: z.unknown().optional(), // Local value before merge
  theirs_value: z.unknown().optional(), // Remote value before merge

  // Resolution
  chosen_source: z.enum(['ours', 'theirs', 'merged']),
  chosen_value: z.unknown(),

  context: z.object({
    base_updated_at: Timestamp.optional(),
    ours_updated_at: Timestamp,
    theirs_updated_at: Timestamp,
    ours_version: Version,
    theirs_version: Version,
    merge_reason: z.string().optional(), // Why this winner was chosen
  }),
});

type AtticEntry = z.infer<typeof AtticEntrySchema>;
```

> **Why base/ours/theirs?** Storing all three values enables:
> 
> - Understanding what actually happened (was base modified by both?)
> - Manual recovery (user can see all versions and pick the right one)
> - Debugging merge algorithm issues
> - Future upgrade to 3-way merge if needed

### 2.6 Schema Versioning and Migration

#### Version Tracking

Schema versions are tracked in `.tbd-sync/meta.json` (on the sync branch):

```json
{
  "schema_versions": [
    { "collection": "issues", "version": 1 },
    { "collection": "agents", "version": 1 },
    { "collection": "messages", "version": 1 }
  ],
  "created_at": "2025-01-07T08:00:00Z"
}
```

> **Note:** User-editable configuration (prefixes, TTLs) lives in `.tbd/config.yml` on
> the main branch. Schema versions live in `meta.json` on the sync branch because they
> describe the synced data and must propagate with it.

#### Compatibility Requirements

**Forward compatibility (required):**

- Newer CLI versions MUST read older entity versions

- Unknown fields MUST be preserved on read/write (pass-through)

- Missing fields MUST use schema defaults

**Backward compatibility (best effort):**

- Older CLI versions reading newer entities: unknown fields ignored

- Core fields (`id`, `version`, `type`) never change shape

- Breaking changes require explicit migration

#### Migration Execution

**Automatic (non-breaking):**

- New optional fields: added with defaults on write

- Field renames: handled in code, both names accepted on read

**Manual (breaking):**

```bash
# Check if migration needed
tbd doctor --check-schema

# Run migration
tbd migrate --to 2

# What it does:
# 1. Backs up all entities to .tbd-sync/attic/migrations/
# 2. Transforms each entity to new schema
# 3. Updates .tbd-sync/meta.json schema_versions
# 4. Syncs to propagate changes
```

#### Cross-Version Sync

When Agent A (schema v2) syncs with Agent B (schema v1):

1. A’s entities written in v2 format

2. B reads v2 entities, unknown fields preserved

3. B writes entities (preserving unknown v2 fields)

4. A reads B’s changes, sees preserved v2 fields

5. No data loss; both continue operating

**Warning:** If v2 has breaking changes, B may fail to parse.
CLI should warn: “Remote entities require CLI version >= X.Y.Z”

* * *

## 3. Git Layer

### 3.1 Overview

The Git Layer defines **how** files are synchronized across machines using standard git
commands. It operates on the File Layer without interpreting entity content beyond the
`version` field.

Key properties:

- **Schema-agnostic sync**: File transfer uses content hashes, doesn’t parse JSON

- **Schema-aware merge**: When content differs, merge rules are per-entity-type

- **Standard git CLI**: All operations expressible as git commands

- **tbd-sync branch**: Dedicated branch for Tbd data, never pollutes main

- **Hash-based conflict detection**: Content hash comparison triggers merge

### 3.2 Sync Branch Architecture

Tbd uses a split architecture with configuration on main and data on a sync branch:

```
main branch:                    tbd-sync branch:
├── src/                        └── .tbd-sync/
├── tests/                          ├── nodes/
├── README.md                       │   ├── issues/
├── .tbd/                         │   ├── agents/
│   ├── config.yml (tracked)        │   └── messages/
│   └── .gitignore (tracked)        ├── attic/
│   └── local/     (gitignored)     └── meta.json
│   └── cache/     (gitignored)
│   └── daemon.*   (gitignored)
└── ...
```

#### Why This Architecture?

1. **Discoverable**: Clone repo, see `.tbd/config.yml`, know tbd is configured

2. **Config versions with code**: Configuration changes can be part of PRs

3. **No sync conflicts on main**: All synced data is on a separate branch

4. **No skip-worktree hacks**: Local files are gitignored within `.tbd/`

5. **No git worktrees needed**: Sync uses
   [git plumbing commands](https://git-scm.com/book/en/v2/Git-Internals-Plumbing-and-Porcelain),
   not checkout

6. **Issues shared across code branches**: All feature branches see the same issues

#### Files Tracked on Main Branch

```
.tbd/config.yml       # Project configuration (YAML)
.tbd/.gitignore       # Ignores local/ directory
```

#### .tbd/.gitignore Contents

```gitignore
# All local/transient files are under local/
local/
```

#### Files Tracked on tbd-sync Branch

```
.tbd-sync/nodes/          # All node types (issues, agents, messages)
.tbd-sync/attic/          # Conflict and orphan archive
.tbd-sync/short-ids/      # Short ID → Internal ID mappings (one file per)
.tbd-sync/meta.json       # Shared metadata (schema versions)
```

#### Files Never Tracked (Local Only)

These live in `.tbd/local/` on main and are gitignored:

```
.tbd/local/state.json     # Per-node sync state (last_sync, node_id)
.tbd/local/nodes/         # Private workspace
.tbd/local/cache/         # Bridge cache (outbound, inbound, dead_letter, state)
.tbd/local/daemon.sock    # Daemon socket
.tbd/local/daemon.pid     # Daemon PID
.tbd/local/daemon.log     # Daemon log
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
git show tbd-sync:.tbd-sync/nodes/issues/is-a1b2.json

# List files in a directory on sync branch
git ls-tree tbd-sync .tbd-sync/nodes/issues/
```

#### 3.3.3 File-Level Sync Algorithm

For each file, compare local and remote by **content hash first** (not version):

```
SYNC_FILE(local_path, sync_path):
  local = read_file(local_path)                    # May be null (in .tbd/local/nodes/)
  remote = git show tbd-sync:{sync_path}         # May be null (in .tbd-sync/)

  if local is null and remote is null:
    return  # Nothing to do

  if local is null:
    # New from remote - copy to local
    git show tbd-sync:{sync_path} > local_path
    return

  if remote is null:
    # New from local - stage for push
    stage_for_push(local_path)
    return

  # Both exist - compare content hashes
  if hash(local) == hash(remote):
    return  # Identical, no action needed

  # Content differs - ALWAYS merge, regardless of version
  # Version is used within merge for LWW ordering, not for conflict detection
  merged, attic_entries = merge_entities(local, remote)
  write_local(merged)
  stage_for_push(merged)
  write_attic_entries(attic_entries)
```

> **Critical**: The sync algorithm uses **content hash** as the conflict detector, not
> version comparison. In a distributed system, a higher version number does NOT mean
> “contains the other writer’s changes”—it only means “edited more times locally.”
> 
> **Example of why version-only is unsafe:**
> 
> - Base entity: version 3
> - Agent A edits once → version 4
> - Agent B (without seeing A) edits twice → version 5
> - If A took remote because `5 > 4`, A’s edit would be silently lost.
> 
> By merging whenever content differs, we ensure both writers’ changes are considered
> and the loser is preserved in the attic.

#### 3.3.4 Pull Operation

Fetch remote changes and apply to local cache:

```bash
# 1. Fetch latest sync branch
git fetch origin tbd-sync

# 2. For each collection, sync files from .tbd-sync/ to local cache
#    (implementation iterates and applies SYNC_FILE)

# 3. Update .tbd/local/state.json with last_sync timestamp (local only)
```

Expressed as git commands:

```bash
# Fetch
git fetch origin tbd-sync

# Get list of remote files
git ls-tree -r --name-only origin/tbd-sync .tbd-sync/

# Read specific remote file
git show origin/tbd-sync:.tbd-sync/nodes/issues/is-a1b2.json

# Copy remote file to local cache (if remote is newer)
# Note: local cache is in .tbd/local/cache/ or memory, not .tbd-sync/
git show origin/tbd-sync:.tbd-sync/nodes/issues/is-a1b2.json
```

#### 3.3.5 Push Operation

Push local changes to remote sync branch:

```bash
# 1. Fetch to ensure we have latest
git fetch origin tbd-sync

# 2. Sync all collections (may pull remote changes first)

# 3. Create a tree with updated files
git read-tree tbd-sync
git add .tbd-sync/nodes/ .tbd-sync/attic/ .tbd-sync/short-ids/ .tbd-sync/meta.json
git write-tree

# 4. Create commit on sync branch
git commit-tree <tree> -p tbd-sync -m "tbd sync: $(date -Iseconds)"

# 5. Update sync branch ref
git update-ref refs/heads/tbd-sync <commit>

# 6. Push to remote
git push origin tbd-sync

# If push rejected (non-fast-forward):
#   Pull, merge, retry with backoff
```

#### 3.3.6 Retry with Jitter and Backoff

When push fails (non-fast-forward rejection), retry with exponential backoff and jitter:

```typescript
async function pushWithRetry(maxAttempts = 5): Promise<void> {
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    const result = await gitPush();
    if (result.success) return;

    if (attempt === maxAttempts) {
      throw new Error(`Push failed after ${maxAttempts} attempts`);
    }

    // Exponential backoff: 1s, 2s, 4s, 8s...
    const baseDelay = Math.min(1000 * Math.pow(2, attempt - 1), 30000);

    // Add jitter: ±25% randomization to prevent thundering herd
    const jitter = baseDelay * 0.25 * (Math.random() * 2 - 1);
    const delay = baseDelay + jitter;

    await sleep(delay);

    // Pull and merge before retrying
    await gitFetch();
    await mergeRemoteChanges();
  }
}
```

**Why jitter?** Without randomization, N agents syncing on a fixed interval create
“thundering herd” collisions.
Jitter spreads retries across time, reducing contention.

#### 3.3.7 Sync Triggers

| Trigger | Action |
| --- | --- |
| `tbd sync` command | Immediate full sync |
| Daemon sync interval | Periodic background sync |
| Agent shutdown | Final sync before exit |

### 3.4 Conflict Detection and Resolution

#### When Conflicts Occur

Conflicts (requiring a merge) happen when the same file is modified in two places before
sync:

- Two agents update the same issue simultaneously

- Same agent works on two machines, both modify before sync

#### Detection

```
Different content hash = requires merge
```

If `hash(local) != hash(remote)`, a merge is needed—**regardless of version numbers**.
The `version` field is used within the merge algorithm for LWW ordering, not for
conflict detection.

#### Resolution Flow

```
1. Detect: content hash differs
2. Parse both versions as JSON
3. Apply merge rules (from section 3.5)
4. Increment version: max(local.version, remote.version) + 1
5. Write merged result locally
6. Stage merged result for push
7. Save loser values to attic (any field with lww or lww_with_attic where
   values differed)
```

> **Note**: Every merge produces attic entries for fields where values differed.
> This ensures “no silent overwrites”—even if one version’s timestamp was older, its
> values are preserved for recovery.

### 3.5 Merge Rules

When the same entity is modified in two places, field-level merge rules determine the
outcome. Merge rules are defined per entity type and applied during conflict resolution.

#### Merge Strategies

| Strategy | Behavior | Used For |
| --- | --- | --- |
| `immutable` | Error if different | `type` field, message content |
| `lww` | Last-write-wins by `updated_at` + ID tiebreaker | Scalars (title, status, priority) |
| `lww_with_attic` | LWW, but preserve loser in attic | Long text (description), ordered arrays (sequence) |
| `union` | Combine both arrays, dedupe (add-only) | Arrays of primitives (labels) - v1 default |
| `set_3way` | 3-way set merge (supports removals) | Arrays when base available (future) |
| `merge_by_id` | Merge arrays by item ID | Arrays of objects (dependencies) |
| `max_plus_one` | `max(local, remote) + 1` | `version` field |
| `recalculate` | Fresh timestamp | `updated_at` field |

> **Limitation of `union` strategy**: Union merging is **add-only**. If Agent A removes
> a label while Agent B keeps it, the merged result will contain the label (B’s version
> contributes it). Removals do not propagate—the label reappears after merge.
> 
> This is acceptable for labels (typically additive), but means:
> 
> - To truly remove a label, all copies must remove it before any sync
> - Or, use `set_3way` when base is available (see `mergeSet3Way` in Section 3.6)
> - Or, use LWW for the entire labels array (loses additions, but removals work)
> 
> **Design choice**: We use `union` (add-only) for labels in v1 because:
> 
> 1. Labels are typically additive (adding context is common, removal is rare)
> 2. False additions are less harmful than false removals
> 3. Simple to implement and reason about
> 
> **Future enhancement**: When using a Git merge driver (which provides base), upgrade
> to `set_3way` for correct removal handling.
> The algorithm is already documented.

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
  last_heartbeat: { strategy: 'lww' }, // Most recent wins
  working_on: { strategy: 'union' },
  file_reservations: { strategy: 'merge_by_id', key: (r) => r.path },
  capabilities: { strategy: 'union' },
  metadata: { strategy: 'lww' },
};
```

#### Message Merge Rules

Messages are **fully immutable**—all content fields use the `immutable` strategy.
This eliminates merge conflicts for messages entirely.

```typescript
const messageMergeRules: MergeRules<Message> = {
  type: { strategy: 'immutable' },
  subject: { strategy: 'immutable' }, // Content is immutable
  body: { strategy: 'immutable' }, // Content is immutable
  author: { strategy: 'immutable' }, // Author cannot change
  in_reply_to: { strategy: 'immutable' }, // Parent cannot change
  supersedes: { strategy: 'immutable' }, // Edit reference cannot change
};
```

> **Why immutable messages?** If two copies of the same message somehow diverge
> (extremely rare—would require corrupted file or manual edit), the merge will fail with
> an invariant error. This is intentional: messages should never conflict.
> The only valid operation is creating new messages.

### 3.6 Merge Algorithm

The merge algorithm applies the rules defined above:

```typescript
/**
 * Deterministic comparison for LWW (Last-Write-Wins).
 * Returns true if entity A should win over entity B.
 *
 * Order of precedence:
 * 1. Later updated_at timestamp wins
 * 2. If timestamps equal, higher entity ID wins (deterministic tiebreaker)
 *
 * This ensures that all nodes converge to the same result regardless of
 * which order they see the entities.
 */
function lwwCompare(a: BaseEntity, b: BaseEntity): boolean {
  if (a.updated_at !== b.updated_at) {
    return a.updated_at > b.updated_at;
  }
  // Deterministic tiebreaker: lexicographically larger ID wins
  return a.id > b.id;
}

function mergeEntities<T extends BaseEntity>(
  local: T,
  remote: T,
  rules: MergeRules<T>,
): { merged: T; atticEntries: AtticEntry[] } {
  const atticEntries: AtticEntry[] = [];
  const localWins = lwwCompare(local, remote);

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
        merged[field] = localWins ? localVal : remoteVal;
        break;

      case 'lww_with_attic':
        if (localVal !== remoteVal) {
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

function mergeArraysById<T>(local: T[], remote: T[], keyFn: (item: T) => string): T[] {
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

/**
 * 3-way set merge that correctly handles additions AND removals.
 *
 * Unlike simple union (which is add-only), this algorithm uses the base
 * (common ancestor) to determine intent:
 * - Item in base but removed in ours/theirs → removal wins
 * - Item not in base but added in ours/theirs → addition wins
 * - Both sides agree → take that value
 *
 * This can be used when base is available (e.g., from Git merge driver
 * or when explicitly passing the previous synced version).
 */
function mergeSet3Way(base: string[] | null, ours: string[], theirs: string[]): string[] {
  const B = new Set(base ?? []);
  const O = new Set(ours ?? []);
  const T = new Set(theirs ?? []);

  const universe = new Set<string>([...B, ...O, ...T]);
  const result: string[] = [];

  for (const item of universe) {
    const inBase = B.has(item);
    const inOurs = O.has(item);
    const inTheirs = T.has(item);

    // 3-way boolean merge for set membership:
    // - If ours == theirs: take ours (they agree)
    // - Else if ours == base: only theirs changed, take theirs
    // - Else if theirs == base: only ours changed, take ours
    // - Else: true conflict (both changed differently) - keep item (safer)
    const present =
      inOurs === inTheirs
        ? inOurs
        : inOurs === inBase
          ? inTheirs
          : inTheirs === inBase
            ? inOurs
            : true; // Both changed differently: safer to keep

    if (present) result.push(item);
  }

  result.sort(); // Canonical ordering for set-like fields
  return result;
}
```

> **When to use 3-way set merge**: The `mergeSet3Way` function requires base (common
> ancestor) information.
> This is available when using a Git merge driver, or can be obtained by tracking the
> last-synced version.
> For v1 without a merge driver, the simpler `union` strategy is used (add-only).
> Upgrade to 3-way when base is available.

### 3.7 Attic Structure

The attic preserves data that would otherwise be lost, enabling recovery and auditing.
It lives on the sync branch in `.tbd-sync/attic/`.

#### Directory Layout

```
.tbd-sync/attic/
├── conflicts/                 # Merge conflict losers
│   ├── is-a1b2/
│   │   ├── 20250107T103000Z_description_theirs.json
│   │   └── 20250107T114500Z_full_ours.json
│   └── is-f14c/
│       └── 20250108T091500Z_status_theirs.json
└── orphans/                   # Integrity violations
    └── ms-x1y2.json           # Message pointing to deleted issue
```

#### Conflicts Directory

Stores conflict data for recovery and auditing:

- Directory per entity: `conflicts/{entity-id}/`

- Filename format (Windows-safe, no colons):

  ```
  {yyyymmddTHHMMSSZ}_{field}_{chosen_source}.json
  ```

- Examples:
  ```
  20250107T103000Z_description_theirs.json
  20250107T114500Z_full_ours.json
  ```

#### Orphans Directory

Stores entities with broken references (integrity violations):

- Messages pointing to deleted issues

- Dependencies referencing non-existent targets

- Agents with `working_on` pointing to missing issues

Orphans are detected during sync or integrity checks and moved here rather than deleted.

#### Attic Entry Content

Each attic file contains the `AtticEntrySchema` (defined in File Layer 2.5.10):

```json
{
  "kind": "field_conflict",
  "entity_id": "is-a1b2c3d4e5",
  "path": ".tbd-sync/nodes/issues/is-a1b2c3d4e5.json",
  "field": "description",
  "timestamp": "2025-01-07T10:30:00Z",

  "base_value": "Original description from common ancestor",
  "ours_value": "Our edited description",
  "theirs_value": "Their edited description",

  "chosen_source": "theirs",
  "chosen_value": "Their edited description",

  "context": {
    "base_updated_at": "2025-01-07T10:00:00Z",
    "ours_updated_at": "2025-01-07T10:25:00Z",
    "theirs_updated_at": "2025-01-07T10:28:00Z",
    "ours_version": 3,
    "theirs_version": 3,
    "merge_reason": "theirs had later updated_at timestamp"
  }
}
```

#### Attic Retention

- Attic entries are synced to the sync branch (audit trail)

- `tbd attic prune --days 30` removes old entries

- Configurable TTL in `.tbd/config.yml` (see [ConfigSchema](#257-configschema))

### 3.8 Deletion Semantics

Entity deletion requires careful handling to avoid orphans and data loss.

#### Soft Deletion (Recommended)

Issues are **soft-deleted** by setting status and close_reason:

```json
{
  "status": "closed",
  "close_reason": "deleted",
  "closed_at": "2025-01-07T10:00:00Z"
}
```

**Why soft-delete?**

- Entity file remains, preserving all references

- Messages/dependencies pointing to it remain valid

- Can be “undeleted” by changing status

- Full history preserved in git

#### Hard Deletion (Discouraged)

Physically removing an entity file (deleting `is-a1b2.json`) is **discouraged** because:

1. **Orphans**: Messages with `in_reply_to: "is-a1b2"` become orphaned

2. **Broken dependencies**: Other issues depending on it have dangling references

3. **Sync conflicts**: If another node modified it before seeing the delete, the
   modification recreates the entity

**If hard deletion is necessary:**

```bash
tbd issue delete <id> --hard

# What it does:
# 1. Moves all referencing messages to attic/orphans/
# 2. Removes entity from dependencies arrays
# 3. Deletes the entity file
# 4. Syncs the deletion
```

#### Deletion During Sync

When sync encounters a deleted file:

- If remote has file, local doesn’t: Remote is copied to local (file “reappears”)

- If local has file, remote doesn’t: Local is pushed (file “reappears” on remote)

This means **deletions don’t propagate reliably** without tombstones.
Soft deletion (status change) propagates correctly because it’s a modification, not a
removal.

> **Design choice**: Tbd uses soft-delete as the primary deletion mechanism.
> Hard deletion is available but creates consistency challenges in distributed systems.

* * *

## 4. CLI Layer

### 4.1 Overview

The CLI Layer defines the **command interface** for users and agents.
It wraps the File and Git layers, providing a consistent way to interact with Tbd.

Key properties:

- **Implementation-agnostic**: Can be implemented in TypeScript, Rust, Python, etc.

- **Wraps lower layers**: CLI commands map to File and Git operations

- **Dual output**: Human-readable by default, JSON for scripting

- **Both prefixes accepted**: Internal (`is-a1b2`) and external (`cd-a1b2`) IDs work

### 4.2 Command Structure

```
tbd <command> [subcommand] [args] [options]
```

> **Note**: The CLI command is `tbd` (singular) while the project/directory is `tbd`
> (plural). This avoids conflict with the shell `cd` command.

### 4.3 Initialization

```bash
# Initialize Tbd in current repository
tbd init

# What it does:
# 1. Creates .tbd/ directory with config.yml and .gitignore
# 2. Creates local subdirectory tree (.tbd/local/nodes/, .tbd/local/cache/)
# 3. Creates tbd-sync branch with .tbd-sync/ structure
# 4. Pushes sync branch to origin (if remote exists)
# 5. Returns to original branch
# 6. Outputs instructions for user to commit config files
#
# Note: Does NOT auto-commit to main branch. User commits manually.
```

**Output:**

```
Created .tbd/config.yml
Created .tbd/.gitignore
Created sync branch: tbd-sync
Pushed sync branch to origin

To complete setup, commit the config files:
  git add .tbd/config.yml .tbd/.gitignore
  git commit -m "Initialize tbd"
```

**What gets created on main branch:**

```
.tbd/
├── config.yml      # Default configuration
├── .gitignore      # Ignores local/ directory
└── local/          # Empty, all gitignored content lives here
    ├── nodes/      # For private workspace
    └── cache/      # For bridge cache
```

**What gets created on tbd-sync branch:**

```
.tbd-sync/
├── nodes/
│   ├── issues/     # Empty
│   ├── agents/     # Empty
│   └── messages/   # Empty
├── attic/
│   ├── conflicts/  # Empty
│   └── orphans/    # Empty
├── short-ids/      # Empty directory
└── meta.json       # Initial metadata
```

### 4.4 Issue Commands

#### Create

```bash
tbd issue create <title> [options]
tbd create <title> [options]              # Shortcut

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
tbd create "Fix authentication bug" -p 1 -k bug
tbd create "Implement OAuth" -k feature -l backend -l security
tbd create "Write unit tests" --parent cd-a1b2
tbd create "Found bug" --deps discovered-from:cd-a1b2
tbd create "Large feature" --body-file=design.md
echo "Description" | tbd create "Title" --body-file=-
```

#### List

```bash
tbd issue list [options]
tbd list [options]                        # Shortcut

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
tbd list                                  # All open issues
tbd list --status open --priority 1       # High-priority open issues
tbd list --assignee agent-x1y2            # Issues assigned to agent
```

#### Show

```bash
tbd issue show <id>
tbd show <id>                             # Shortcut
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
tbd issue update <id> [options]

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
tbd issue update cd-a1b2 --status in_progress
tbd issue update cd-a1b2 --add-label urgent --priority 0
```

#### Close

```bash
tbd issue close <id> [options]
tbd close <id> [options]                  # Shortcut

Options:
  --reason <text>           Close reason
```

**Examples:**

```bash
tbd close cd-a1b2 --reason "Fixed in commit abc123"
```

#### Reopen

```bash
tbd issue reopen <id> [options]
tbd reopen <id> [options]                 # Shortcut

Options:
  --reason <text>           Reopen reason
```

**Examples:**

```bash
tbd reopen cd-a1b2 --reason "Not actually fixed"
```

#### Ready

List issues that are ready to work on (open, unblocked, unclaimed):

```bash
tbd issue ready [options]
tbd ready [options]                       # Shortcut

Options:
  --limit <n>               Limit results
  --kind <kind>             Filter by kind
```

#### Blocked

List issues that are blocked by open dependencies:

```bash
tbd issue blocked [options]
tbd blocked [options]                     # Shortcut

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
tbd issue stale [options]
tbd stale [options]                       # Shortcut

Options:
  --days <n>                Days since last update (default: 30)
  --status <status>         Filter by status
  --limit <n>               Limit results
```

**Examples:**

```bash
tbd stale --days 14                       # Issues stale for 2 weeks
tbd stale --days 7 --status in_progress   # Stale in-progress work
```

#### Dependencies

```bash
# Add dependency
tbd issue dep add <id> <target-id> --type <type>

# Remove dependency
tbd issue dep remove <id> <target-id>

# Show dependency tree
tbd issue dep tree <id>

Dependency types:
  blocks         This issue blocks target
  related        Related to target
  discovered-from  Discovered while working on target
```

**Examples:**

```bash
tbd issue dep add cd-c3d4 cd-f14c --type blocks
tbd issue dep tree cd-a1b2
```

#### Comment

Add a comment (message) to an issue or reply to another message:

```bash
tbd issue comment <id> --subject <subject> --body <body>
tbd issue comment <id> -s <subject> -b <body>
tbd issue comment <id> --file <path>      # Subject from first line, body from rest

Options:
  -s, --subject <text>      Comment subject (required)
  -b, --body <text>         Comment body (required)
  --file <path>             Read from file (first line = subject, rest = body)
```

**Examples:**

```bash
# Comment on an issue
tbd issue comment cd-a1b2 -s "Found the bug" -b "It's in auth.ts line 42"

# Reply to a comment (basic threading)
tbd issue comment msg-p1q2 -s "Good find" -b "I'll fix it now"
```

**Note**: Comments are stored as Message entities.
The `<id>` can be an issue ID (for comments) or a message ID (for replies).
Both subject and body are required.
Messages are displayed time-sorted; explicit threading UI is a future extension.

### 4.5 Agent Commands

#### Register

```bash
tbd agent register [options]

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
tbd agent list [options]

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
tbd agent show <id>
```

#### Claim

Claim an issue for the current agent (sets `assignee` field):

```bash
tbd agent claim <issue-id>
```

**Output (success):**

```
Claimed cd-a1b2
```

**Output (already claimed):**

```
Warning: cd-a1b2 already claimed by agent-a3b4 (since 2025-01-07 10:25)
Proceeding anyway (advisory claim)
```

> **Note**: Claims are advisory.
> The `assignee` field indicates who is working on an issue, but the system does not
> enforce exclusivity.
> Agents should check `assignee` before starting work and coordinate via messages if
> conflicts arise. This simple approach works well in practice because:
> 
> - Race conditions are rare (two agents claiming the exact same issue)
> - Git sync propagates claims within seconds to minutes
> - If conflicts occur, the attic preserves all work
> - Explicit coordination is clearer than implicit locking
> 
> See [Appendix 7.7](#77-optional-enhancements) for lease-based claims if stronger
> coordination is needed.

#### Release

Release a claimed issue (clears `assignee` field):

```bash
tbd agent release <issue-id>
```

#### Status

Set agent status:

```bash
tbd agent status <status>

Status values:
  active      Actively working
  idle        Available but not working
  inactive    Going offline
```

### 4.6 Local Commands

Commands for private workspace items (`local/` directory):

```bash
# Create local item
tbd local create <title> [options]

# List local items
tbd local list [options]

# Show local item
tbd local show <id>

# Update local item
tbd local update <id> [options]

# Delete local item
tbd local delete <id>

# Promote local item to issue
tbd local promote <id>
```

Options mirror issue commands.
`promote` copies the item to `issues/` with a new ID.

### 4.7 Sync Commands

```bash
# Full sync (pull then push)
tbd sync

# Pull only (fetch remote changes)
tbd sync --pull

# Push only (push local changes)
tbd sync --push

# Show sync status (pending changes)
tbd sync --status
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
tbd import <file> [options]

Options:
  --format <format>         Import format: beads (default: auto-detect)
  --dry-run                 Show what would be imported
  --id-map <file>           Write ID mapping to file (old-id → new-id)
```

**Beads Status Mapping:**

| Beads Status | Tbd Import Behavior |
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
tbd import beads-export.jsonl --format beads

# Preview import
tbd import beads-export.jsonl --dry-run

# Import with ID mapping for reference
tbd import beads-export.jsonl --id-map mapping.json
```

### 4.8 Attic Commands

```bash
# List attic entries
tbd attic list [options]

Options:
  --entity <id>             Filter by entity
  --field <field>           Filter by field
  --since <date>            Filter by date

# Show attic entry
tbd attic show <entity-id> <timestamp>

# Restore from attic
tbd attic restore <entity-id> <timestamp> [options]

Options:
  --field <field>           Restore specific field only
  --dry-run                 Show what would be restored

# Prune old attic entries
tbd attic prune [options]

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

Health check and repair for the Tbd database:

```bash
# Run health checks
tbd doctor [options]

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
tbd list --json
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
│                      Tbd Core (Git)                            │
│                      Source of truth                             │
│   .tbd-sync/nodes/issues/is-a1b2.json                         │
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
│  Issue #42      │  │  #coordination  │  │  Hosted Tbd   │
│  Labels, state  │  │  channel        │  │  service        │
└─────────────────┘  └─────────────────┘  └─────────────────┘
```

#### Bridge Metadata Schema

```typescript
const BridgeLink = z.object({
  service: z.string(), // "github", "slack", "native"
  external_id: z.string(), // GitHub issue number, Slack channel, etc.
  external_url: z.string().optional(),
  synced_at: Timestamp,
  sync_direction: z.enum(['push', 'pull', 'bidirectional']),
});

// Added to entities that are bridged
const bridge = z.record(z.string(), BridgeLink).optional();
```

#### Consistency Model

Bridges provide eventually consistent views of Git state:

| Guarantee | Description |
| --- | --- |
| **Eventual Consistency** | All agents eventually see the same state |
| **Conflict Preservation** | No data ever lost; conflicts preserved in attic |
| **Git is Truth** | On conflict, Git wins; Bridge changes go to attic |

**Tbd does NOT provide:**

- Linearizability (global ordering)

- Serializable transactions

- Strong consistency

#### Latency Expectations

| Mode | Operation | Expected Latency |
| --- | --- | --- |
| File-only | Read/Write | <10ms |
| Git sync | Pull/Push | 1-30 seconds |
| Bridge (GitHub) | Propagation | 1-5 seconds (webhook) |
| Bridge (Native) | Propagation | <100ms |
| Bridge (Slack) | Message delivery | <1 second |

#### Configuration Example

```json
{
  "config": {
    "bridges": {
      "github": {
        "enabled": true,
        "repo": "owner/repo",
        "auto_promote": false
      },
      "slack": {
        "enabled": true,
        "channel": "C01234567"
      }
    }
  }
}
```

#### Security

- Store secrets in environment variables, never in config files

- Support secret rotation without downtime

- Log validation failures (without exposing secrets)

```bash
# Environment variables for bridge secrets
export TBD_GITHUB_WEBHOOK_SECRET="..."
export TBD_SLACK_SIGNING_SECRET="..."
```

#### Rate Limiting for Webhooks

- Limit webhook endpoints: 100 requests/minute per source IP

- Return 429 when exceeded

- Log rate limit violations for security monitoring

### 5.3 GitHub Issues Bridge

Sync Tbd issues with [GitHub Issues](https://docs.github.com/en/rest/issues) for
real-time coordination and human visibility.

#### Use Cases

- Cross-team coordination with sub-second latency

- Human stakeholder visibility in GitHub

- Claims via GitHub labels

- Notifications via GitHub’s existing systems

#### Promotion

```bash
# Explicitly promote an issue to GitHub
tbd github promote <issue-id>

# Promote with specific options
tbd github promote <issue-id> --labels "tbd-sync,priority:high"
```

**What happens:**

1. Creates GitHub Issue with mapped fields

2. Adds `bridge.github` metadata to Tbd entity

3. Sets up bidirectional sync

#### Field Mapping

| Tbd Field | GitHub Field | Notes |
| --- | --- | --- |
| `title` | `title` | Direct mapping |
| `description` | `body` | Includes Tbd metadata block |
| `status` | Labels | `status:open`, `status:in_progress`, etc. |
| `priority` | Labels | `priority:0`, `priority:1`, etc. |
| `assignee` | Labels | `claimed:agent-id` |
| `labels` | Labels | Prefixed: `tbd:label-name` |

#### Conflict Resolution

On bidirectional sync conflicts:

- **Tbd wins** for most fields (agent is authority)

- **Labels union** (both sources contribute)

- **Comments always merged** (never overwrite)

GitHub API rate limits (5,000 requests/hour) handled via exponential backoff.

#### Claiming via Labels

```bash
# Agent claims issue - adds label to GitHub
tbd agent claim cd-a1b2

# Under the hood:
gh issue edit 42 --add-label "claimed:agent-x1y2"
```

Other agents see the label via GitHub webhooks or polling.

#### Sync Flow

```
Tbd → GitHub:
  1. Detect local change (version increment)
  2. Update GitHub Issue via API
  3. Update synced_at timestamp

GitHub → Tbd:
  1. Webhook fires (or poll detects change)
  2. Update local entity
  3. Increment version
  4. Git sync propagates to other machines
```

#### Conflict Resolution

When Tbd and GitHub diverge:

- Compare `synced_at` with GitHub’s `updated_at`

- Field-level merge where possible

- On conflict, Tbd wins (configurable)

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
   │            Archive to .tbd-sync/nodes/messages/  │
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
tbd message send <recipient> --subject "..." --body "..."

# List recent messages (from Slack or git archive)
tbd message list --channel coordination

# Archive Slack messages to git
tbd message archive --days 7
```

### 5.5 Native Bridge

A hosted Tbd coordination service for teams that want real-time without external
dependencies.

#### Use Cases

- Teams not using GitHub Issues or Slack

- Need sub-100ms coordination latency

- Want a unified coordination layer

- Self-hosted or Tbd-hosted options

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

A local desktop application that connects to Tbd and provides visual interfaces like
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
              │     .tbd/ (local)         │
              │       cache/, local/        │
              │    (local working files)    │
              └─────────────────────────────┘
                            ↑
                            │ sync
                            ▼
              ┌─────────────────────────────┐
              │   .tbd-sync/ (git)        │
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

1. UI watches `.tbd/` and cached entity data for changes

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
              │         tbd Daemon         │
              │                             │
              │  • File change events       │
              │  • Bridge notifications     │
              │  • Agent activity stream    │
              └─────────────────────────────┘
                     │              │
          ┌──────────┘              └──────────┐
          ▼                                    ▼
    ┌──────────┐                      ┌──────────────┐
    │ .tbd/  │                      │   Bridges    │
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

- **[Tauri](https://tauri.app/)**: Rust backend, smaller binary, can shell out to `tbd`
  CLI

- **Both**: Can read/write JSON directly, no special API needed

This is a “future” feature, but the architecture supports it today—any application that
can read JSON files and (optionally) connect to the daemon can provide rich UI
experiences.

### 5.7 Bridge CLI Commands

Additional CLI commands when bridges are configured:

```bash
# GitHub bridge
tbd github promote <id>           # Promote issue to GitHub
tbd github sync                   # Force sync with GitHub
tbd github status                 # Show GitHub sync status

# Slack bridge
tbd slack connect                 # Connect Slack workspace
tbd slack channel <name>          # Set coordination channel

# Native bridge
tbd bridge connect <url>          # Connect to native bridge
tbd bridge status                 # Show bridge connection status

# General bridge commands
tbd bridge list                   # List configured bridges
tbd bridge sync                   # Sync all bridges
```

### 5.8 Offline-First Architecture

Bridges require network connectivity, but agents should continue working when offline.
The cache layer provides offline-first semantics with automatic sync on reconnection.

#### Design Goals

- **Non-blocking sends**: `tbd message send` returns immediately, even offline

- **No message loss**: Outbound messages queue until bridge confirms delivery

- **Graceful degradation**: Agents keep working; messages sync when connectivity returns

- **Minimal git pollution**: Messages don’t need to be archived to git

#### Cache Directory Structure

```
.tbd/local/cache/              # Local cache (never synced to git)
├── outbound/                    # Queue: items waiting to send to bridge
├── inbound/                     # Buffer: recent items from bridge
└── state.json                   # Connection state
```

#### Offline Workflow

```
Agent offline:
  1. tbd message send ... → writes to cache/outbound/
  2. CLI returns immediately (non-blocking)
  3. Agent continues working

Agent reconnects:
  1. Daemon/CLI flushes cache/outbound/ to bridge
  2. On confirmation, deletes from outbound/
  3. Fetches inbound messages
```

**Key properties:**

- Non-blocking sends (always succeeds locally)

- Exponential backoff on failures

- No message loss (queue persists until delivered)

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

Communication via Unix socket (`.tbd/local/daemon.sock`) or TCP on Windows.

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

1. Load all files from `.tbd/` into memory

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
tbd daemon start              # Start daemon (detached)
tbd daemon start --foreground # Start daemon (attached)
tbd daemon stop               # Stop daemon
tbd daemon status             # Show daemon status
tbd daemon flush              # Force flush memory → files
```

### 6.2 Use Cases by Complexity

Tbd supports a spectrum of usage patterns:

#### 1. Single Developer, Local Workflow

A solo developer tracking tasks in a personal project.

- **Layers used**: File + CLI

- **Sync**: Optional, manual `tbd sync` when desired

- **Daemon**: Not needed

```bash
tbd init
tbd create "Fix bug in login" -p 1
tbd list
tbd close cd-a1b2 --reason "Fixed"
```

#### 2. Cross-Machine Development

Same developer working from multiple machines.

- **Layers used**: File + Git + CLI

- **Sync**: On push/pull

- **Daemon**: Not needed

```bash
# Machine A
tbd create "New feature"
tbd sync

# Machine B
tbd sync
tbd list  # See the new feature
```

#### 3. Team with Human + Agent Collaboration

A team of developers with AI coding agents.

- **Layers used**: File + Git + CLI

- **Sync**: Regular (every few minutes)

- **Daemon**: Optional, helps with claim coordination

```bash
# Human creates issue
tbd create "Implement OAuth" -k feature

# Agent claims and works
tbd agent claim cd-a1b2
# ... work ...
tbd close cd-a1b2 --reason "Implemented"
```

#### 4. Multi-Agent Work Queue

Multiple AI agents running concurrently.

- **Layers used**: File + Git + CLI + Daemon

- **Sync**: Frequent (sub-minute)

- **Daemon**: Recommended for atomic claims

```bash
# Start daemon for coordination
tbd daemon start

# Agent 1
tbd agent register --name "claude-backend"
tbd ready --json  # Find available work
tbd agent claim cd-a1b2

# Agent 2 (sees claim immediately via daemon)
tbd ready --json  # cd-a1b2 not shown
```

#### 5. Cross-Team Real-Time Coordination

Multiple teams with real-time requirements.

- **Layers used**: File + Git + CLI + Bridge

- **Sync**: Real-time via bridge

- **Bridge**: GitHub Issues or Native

```bash
# Configure GitHub bridge
tbd github promote cd-a1b2  # Critical issue

# Other team sees it instantly in GitHub
# Claims, updates propagate in real-time
```

#### 6. CI/CD Integration

Automated systems creating/updating issues.

- **Layers used**: File + Git + CLI

- **Daemon**: Not needed

```bash
# In CI script
tbd create "Test failure: auth tests" -k bug -l "ci-failure"
tbd sync
```

#### 7. Private Agent Workspace

Agent using local-only items for scratch work.

- **Layers used**: File + CLI (local only)

- **Sync**: Never

```bash
tbd local create "TODO: refactor this later"
tbd local list
tbd local promote lo-a1b2  # Promote to real issue when ready
```

### 6.3 Examples

#### Example 1: Single Agent Workflow

```bash
# Initialize
$ tbd init
Created .tbd/config.yml
Created .tbd/.gitignore
Created sync branch: tbd-sync
Pushed sync branch to origin

To complete setup, commit the config files:
  git add .tbd/config.yml .tbd/.gitignore
  git commit -m "Initialize tbd"

$ git add .tbd/config.yml .tbd/.gitignore
$ git commit -m "Initialize tbd"

# Create issues
$ tbd create "Set up database schema" -p 1 -k task
Created cd-a1b2: Set up database schema

$ tbd create "Implement auth endpoints" -p 1 -k feature
Created cd-f14c: Implement auth endpoints

$ tbd create "Write integration tests" -p 2 -k task
Created cd-c3d4: Write integration tests

# Add dependency
$ tbd issue dep add cd-c3d4 cd-f14c --type blocks
Added: cd-c3d4 blocks cd-f14c

# See ready work
$ tbd ready
Ready issues (no blockers):
  [P1] cd-a1b2: Set up database schema
  [P1] cd-f14c: Implement auth endpoints

# Work and close
$ tbd issue update cd-a1b2 --status in_progress
$ tbd close cd-a1b2 --reason "Schema created"

# Sync to git
$ tbd sync
Pushed 4 files to tbd-sync
```

#### Example 2: Multi-Agent Coordination

```bash
# Terminal 1: Start daemon
$ tbd daemon start
Daemon started on .tbd/local/daemon.sock

# Terminal 2: Agent 1
$ tbd agent register --name "claude-backend"
Registered agent-x1y2: claude-backend

$ tbd ready --json
[{"id": "is-a1b2", "title": "Fix auth bug", "priority": 1}]

$ tbd agent claim cd-a1b2
Claimed cd-a1b2

# Terminal 3: Agent 2
$ tbd agent register --name "claude-frontend"
Registered agent-a3b4: claude-frontend

$ tbd agent list
AGENT           STATUS   WORKING ON
agent-x1y2      active   cd-a1b2
agent-a3b4      active   -

$ tbd ready
Ready issues:
  [P2] cd-f14c: Update UI components
# cd-a1b2 not shown - already claimed

# Agent 2 takes different issue
$ tbd agent claim cd-f14c
Claimed cd-f14c
```

#### Example 3: Conflict Resolution

```bash
# Agent A (machine 1)
$ tbd issue update cd-a1b2 --status in_progress
$ tbd issue update cd-a1b2 --add-label backend

# Agent B (machine 2, before sync)
$ tbd issue update cd-a1b2 --status blocked
$ tbd issue update cd-a1b2 --add-label urgent

# Agent A syncs first
$ tbd sync
Pushed 1 file

# Agent B syncs, conflict detected
$ tbd sync
Conflict in cd-a1b2:
  status: in_progress (remote) vs blocked (local) → local wins (newer)
  labels: merged → [backend, urgent]
Merged and pushed

# Check attic
$ tbd attic list --entity cd-a1b2
TIMESTAMP              FIELD    LOST VALUE
2025-01-07T10:30:00Z   status   in_progress

# Restore if needed
$ tbd attic restore cd-a1b2 2025-01-07T10:30:00Z --field status
```

### 6.4 Other Potential Layers (Not Specified)

These layers could be built on top of the CLI Layer but are not specified in this
document:

#### MCP Layer

Model Context Protocol tools wrapping CLI for Claude, Cursor, etc.

```typescript
// Example MCP tool definition
{
  name: "tbd_create_issue",
  description: "Create a new issue in Tbd",
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

- TypeScript: `@tbd/client`

- Python: `tbd-py`

- Rust: `tbd-rs`

#### Watch Layer

File system watching for UIs and IDEs:

- `fswatch` / `inotify` / `ReadDirectoryChangesW`

- WebSocket server for push updates

* * *

## 7. Appendices

### 7.1 Design Decisions

#### Decision 1: Split Architecture (Config on Main, Data on Sync Branch)

**Choice**: Configuration (`.tbd/config.yml`) lives on main branch; synced entities live
exclusively on `tbd-sync` branch in `.tbd-sync/` directory.

**Rationale**:

- **Discoverable**: Clone repo, see `.tbd/config.yml`, know tbd is configured

- **Config versions with code**: Configuration changes can be part of PRs

- Eliminates skip-worktree hacks that caused beads v0.42 issues

- No daemon-vs-user conflicts on tracked files

- No git worktrees needed

- Issues shared across all code branches (correct for multi-agent use case)

**Tradeoff**: Two locations to understand (config on main, data on sync branch).
Mitigated by clear naming (`.tbd/` for config/local, `.tbd-sync/` for synced data) and
`tbd init` setting up both locations.

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

#### Question 1: Git Operations Method (RESOLVED)

How to update sync branch without checking it out?

**Options**:

1. **Bare git operations** (`git read-tree`, `git write-tree`, `git update-ref`)

   - Pro: No disk I/O for checkout

   - Con: Complex, error-prone, hard to debug

2. **Hidden worktree** (`git worktree add .tbd/local/worktrees/tbd-sync`)

   - Pro: Standard git porcelain (pull, commit, push)

   - Pro: Enables native Git 3-way merge with merge driver

   - Pro: Easier to debug (normal git commands work)

   - Con: Extra disk space (~size of `.tbd-sync/` directory)

3. **Shallow clone of sync branch**

   - Pro: Isolated from main repo

   - Con: Separate clone to manage, more complex setup

**Resolution: Hidden worktree (Option 2)**

The hidden worktree approach provides the best balance of simplicity and capability:

```bash
# During tbd init:
git worktree add .tbd/local/worktrees/tbd-sync --detach
cd .tbd/local/worktrees/tbd-sync
git switch --orphan tbd-sync  # or checkout if branch exists
# ... create initial structure ...
git add . && git commit -m "tbd init"
git push -u origin tbd-sync

# During tbd sync:
cd .tbd/local/worktrees/tbd-sync
git fetch origin tbd-sync
git merge origin/tbd-sync  # 3-way merge with merge driver if configured
git add .tbd-sync/
git commit -m "tbd sync: $(date -Iseconds)"
git push origin tbd-sync
```

**Benefits:**

- Uses standard git porcelain (easier to understand and debug)

- Enables Git’s native 3-way merge (can use custom merge driver)

- Worktree is gitignored, never pollutes user’s workspace

- If worktree is missing/corrupted, can be recreated from remote

#### Question 2: Message Retention

How long to keep messages (if stored in git)?

**Options**:

1. **TTL-based** (default 7 days)

2. **Linked to issue lifecycle** (delete when issue closes)

3. **Manual only** (`tbd message prune`)

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

#### Import to Tbd

```bash
# Initialize tbd
tbd init

# Import beads export
tbd import beads-export.jsonl --format beads

# The importer:
# - Converts bd-* IDs to is-* internal IDs
# - Configures external prefix alias so CLI displays cd-*
# - Maps beads fields to tbd schema
# - Preserves dependencies, comments, labels
# - Skips wisps (ephemeral issues)
```

#### ID Mapping

A mapping file is created during import (stored on sync branch for audit trail):

```json
// .tbd-sync/migrations/beads-import-2025-01-07.json
{
  "bd-a1b2": "is-x1y2",
  "bd-f14c": "is-a3b4"
}
```

This allows references in commit messages to be traced to new IDs.

### 7.4 Comparison with Beads

| Aspect | Beads | Tbd |
| --- | --- | --- |
| Data locations | 4 (SQLite, local JSONL, sync branch, main) | 3 (config on main, data on sync branch, local cache) |
| File system compatibility | SQLite WAL fails on NFS/cloud | Works on any file system |
| Main branch | JSONL committed | Config only (config.yml) |
| Storage format | Single JSONL file | File per entity |
| Skip-worktree | Required hack | Not needed |
| Git worktrees | Required for sync branch | Not needed |
| Daemon | Always recommended | Optional |
| Sync layer | Schema-aware | Schema-agnostic (sync) / schema-aware (merge) |
| Merge conflicts | JSONL line-based (cross-entity) | Per-file (per-entity) |
| Entity types | Issues + molecules | Extensible (issues, agents, ...) |
| Agent coordination | External (Agent Mail) | Built-in |
| Architecture | Monolithic | Layered (File, Git, CLI, Bridge) |

### 7.5 File Structure Reference

#### Complete Directory Layout

**On main branch (and all working branches):**

```
.tbd/
├── config.yml              # Project configuration (tracked)
├── .gitignore              # Ignores local/ directory (tracked)
│
└── local/                  # Everything below is gitignored
    ├── state.json          # Per-node sync state (last_sync, node_id)
    ├── nodes/              # Private workspace (never synced)
    │   └── lo-l1m2.json
    ├── cache/              # Bridge cache (never synced)
    │   ├── outbound/       # Queue: messages to send
    │   ├── inbound/        # Buffer: recent messages
    │   ├── dead_letter/    # Failed after max retries
    │   └── state.json      # Connection state
    ├── daemon.sock         # Daemon socket (local only)
    ├── daemon.pid          # Daemon PID file (local only)
    └── daemon.log          # Daemon log (local only)
```

**On tbd-sync branch:**

```
.tbd-sync/
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
│   │       └── 20250107T103000Z_description_theirs.json
│   └── orphans/               # Integrity violations
├── short-ids/                 # Short ID → Internal ID mappings
│   ├── a1b.json
│   └── x7k.json
└── meta.json                  # Shared metadata (schema versions)
```

#### Files Tracked on Main Branch

```
.tbd/config.yml           # Project configuration (YAML)
.tbd/.gitignore           # Ignores local/ directory
```

#### .tbd/.gitignore Contents

```gitignore
# All local/transient files are under local/
local/
```

#### Files Tracked on tbd-sync Branch

```
.tbd-sync/nodes/          # All node types (issues, agents, messages)
.tbd-sync/attic/          # Conflict and orphan archive
.tbd-sync/meta.json       # Runtime metadata
```

#### Files Never Tracked (Local Only)

These live in `.tbd/local/` on main and are gitignored:

```
.tbd/local/state.json     # Per-node sync state (last_sync, node_id)
.tbd/local/nodes/         # Private workspace
.tbd/local/cache/         # Bridge cache (outbound, inbound, dead_letter, state)
.tbd/local/daemon.sock    # Daemon socket
.tbd/local/daemon.pid     # Daemon PID
.tbd/local/daemon.log     # Daemon log
```

#### Example Config File

**Config** (`.tbd/config.yml` on main branch):

```yaml
# Tbd configuration
# See: https://github.com/[org]/tbd

tbd_version: '0.1.0'

sync:
  branch: tbd-sync
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

**Issue** (`.tbd-sync/nodes/issues/is-a1b2.json`):

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
  "dependencies": [{ "type": "blocks", "target": "is-f14c" }]
}
```

**Issue with children** (`.tbd-sync/nodes/issues/is-e5f6.json`):

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

**Child issue** (`.tbd-sync/nodes/issues/is-c3d4.json`):

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

**Message (comment on issue)** (`.tbd-sync/nodes/messages/ms-p1q2.json`):

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

**Agent** (`.tbd-sync/nodes/agents/ag-x1y2.json`):

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

**Local item** (`.tbd/local/nodes/lo-l1m2.json`):

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

**Meta** (`.tbd-sync/meta.json` on sync branch):

```json
{
  "schema_versions": [
    { "collection": "issues", "version": 1 },
    { "collection": "agents", "version": 1 },
    { "collection": "messages", "version": 1 }
  ],
  "created_at": "2025-01-07T08:00:00Z"
}
```

> **Note**: User-editable configuration (prefixes, TTLs, sync settings) is in
> `.tbd/config.yml` on the main branch.
> See [Example Config File](#example-config-file).

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

### 7.7 Optional Enhancements

This section documents enhancements that may be added if specific problems arise in
practice. These are not required for v1 but are preserved here for future reference.

#### 7.7.1 Hybrid Logical Clocks (HLC)

**Problem:** Wall-clock timestamps can drift between machines.
If Machine A’s clock is 5 minutes ahead, its writes always “win” in LWW conflicts even
if Machine B’s write was actually later.

**When to add:** If you observe:

- Frequent “wrong winner” conflicts in the attic

- Clock skew issues in your deployment (e.g., cloud VMs without NTP)

- Need for deterministic conflict resolution across untrusted machines

**Implementation:**

```typescript
// Add to BaseEntity
const HybridTimestamp = z.object({
  wall: z.string().datetime(), // Wall clock (for display)
  logical: z.number().int(), // Lamport-style counter
  node: z.string(), // Node identifier for tiebreak
});

// BaseEntity becomes:
const BaseEntity = z.object({
  // ... existing fields ...
  hlc: HybridTimestamp.optional(), // Added for HLC support
});

// Compare function
function hlcCompare(a: HybridTimestamp, b: HybridTimestamp): number {
  if (a.logical !== b.logical) return a.logical - b.logical;
  if (a.wall !== b.wall) return a.wall.localeCompare(b.wall);
  return a.node.localeCompare(b.node);
}
```

**Migration:** Entities without `hlc` field get one synthesized:
`{ wall: updated_at, logical: version, node: "migrated" }`

**Reference:**
[Hybrid Logical Clocks (Kulkarni et al.)](https://cse.buffalo.edu/tech-reports/2014-04.pdf)

#### 7.7.2 Lease-Based Claims

**Problem:** Advisory claims (setting `assignee`) don’t prevent race conditions.
Two agents might claim the same issue before sync propagates.

**When to add:** If you observe:

- Frequent duplicate work (two agents completing the same task)

- Need for stronger coordination guarantees

- Bridge Layer is implemented and can provide atomic operations

**Implementation:**

```typescript
// Add to IssueSchema
claim: z.object({
  agent_id: EntityId,
  claimed_at: Timestamp,
  lease_expires: Timestamp,       // TTL for the claim
  lease_sequence: z.number(),     // Monotonic counter, prevents ABA problem
}).optional(),
```

**CLI additions:**

```bash
tbd agent claim <issue-id> --ttl 3600   # 1 hour lease
tbd agent renew <issue-id>               # Extend lease
```

**Behavior:**

- Expired leases can be claimed without `--force`

- `lease_sequence` prevents ABA problem (stale writes rejected)

- Bridge Layer can provide atomic compare-and-swap for claims

#### 7.7.3 Idempotency Keys and Dead Letter Queue

**Problem:** Network failures during Bridge sync can cause duplicate message delivery or
silent message loss.

**When to add:** If you observe:

- Duplicate messages in production

- Lost messages during network outages

- Need for guaranteed delivery to Bridge endpoints

**Implementation:**

```typescript
// Outbound queue item
const OutboundQueueItem = z.object({
  idempotency_key: z.string().uuid(),
  payload: z.unknown(),
  attempts: z.number().default(0),
  max_attempts: z.number().default(10),
});

// Retry policy
const RetryPolicy = z.object({
  max_attempts: z.number().default(10),
  initial_backoff_ms: z.number().default(1000),
  max_backoff_ms: z.number().default(300000),
  backoff_multiplier: z.number().default(2),
});
```

**Dead letter handling:**

- After `max_attempts`, move to `cache/dead_letter/`

- Preserve indefinitely for manual recovery

- CLI: `tbd cache dead-letter list/retry/discard`

#### 7.7.4 Bridge Conflict Resolution Details

**Problem:** When Git and Bridge both have changes to the same entity, detailed conflict
resolution rules are needed.

**When to add:** When implementing Bridge Layer, specifically bidirectional sync.

**Implementation:**

```typescript
// Per-field sync direction
const SyncDirection = z.enum([
  'tbd_wins', // Tbd overwrites Bridge
  'bridge_wins', // Bridge overwrites Tbd
  'lww', // Last-write-wins by timestamp
  'union', // Merge arrays
]);

// Conflict resolution
function resolveBridgeConflict(gitEntity, bridgeEntity) {
  // Git version > bridge synced_version: Git wins
  // Bridge also changed: preserve in attic with source: "bridge"
}
```

#### 7.7.5 Webhook Security

**Problem:** Bridge webhooks can be spoofed.
Attackers could inject fake events.

**When to add:** When implementing Bridge Layer with external webhooks.

**Implementation:**

```typescript
// GitHub webhook validation
function validateGitHubWebhook(payload, signature, secret) {
  const expected = `sha256=${crypto.createHmac('sha256', secret).update(payload).digest('hex')}`;
  return crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expected));
}
```

**Best practices:**

- Store secrets in environment variables

- Validate every incoming webhook

- Rate limit endpoints (100 req/min per source IP)

- Log validation failures

**References:**

- [GitHub Webhook Security](https://docs.github.com/en/webhooks/using-webhooks/validating-webhook-deliveries)

- [Slack Request Verification](https://api.slack.com/authentication/verifying-requests-from-slack)
