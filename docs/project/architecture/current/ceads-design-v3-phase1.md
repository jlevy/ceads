# Ceads Design V3 Phase 1: Beads Replacement

**Author:** Joshua Levy (github.com/jlevy) and various LLMs

**Status**: Draft

**Date**: January 2025

* * *

## Table of Contents

- [Ceads Design V3 Phase 1: Beads Replacement](#ceads-design-v3-phase-1-beads-replacement)

  - [Table of Contents](#table-of-contents)

  - [1. Introduction](#1-introduction)

    - [1.1 What is Ceads?](#11-what-is-ceads)

    - [1.2 When to Use Ceads vs Beads](#12-when-to-use-ceads-vs-beads)

    - [1.3 Why Replace Beads?
      (Architecture Comparison)](#13-why-replace-beads-architecture-comparison)

    - [1.4 Design Goals](#14-design-goals)

    - [1.5 Design Principles](#15-design-principles)

    - [1.6 Non-Goals for Phase 1](#16-non-goals-for-phase-1)

    - [1.7 Layer Overview](#17-layer-overview)

  - [2. File Layer](#2-file-layer)

    - [2.1 Overview](#21-overview)

      - [Markdown + YAML Front Matter Format](#markdown--yaml-front-matter-format)

      - [Canonical Serialization](#canonical-serialization)

      - [Atomic File Writes](#atomic-file-writes)

    - [2.2 Directory Structure](#22-directory-structure)

      - [On Main Branch (all working branches)](#on-main-branch-all-working-branches)

      - [On `ceads-sync` Branch](#on-ceads-sync-branch)

    - [2.3 Hidden Worktree Model](#23-hidden-worktree-model)

      - [Worktree Setup](#worktree-setup)

      - [Worktree Gitignore](#worktree-gitignore)

      - [Accessing Issues via Worktree](#accessing-issues-via-worktree)

      - [Worktree Lifecycle](#worktree-lifecycle)

      - [Worktree Initialization Decision Tree](#worktree-initialization-decision-tree)

    - [2.4 Entity Collection Pattern](#24-entity-collection-pattern)

      - [Directory Layout](#directory-layout)

      - [Adding New Entity Types (Future)](#adding-new-entity-types-future)

    - [2.5 ID Generation](#25-id-generation)

      - [ID Generation Algorithm](#id-generation-algorithm)

    - [2.6 Schemas](#26-schemas)

      - [2.6.1 Common Types](#261-common-types)

      - [2.6.2 BaseEntity](#262-baseentity)

      - [2.6.3 IssueSchema](#263-issueschema)

      - [2.6.4 ConfigSchema](#264-configschema)

      - [2.6.5 MetaSchema](#265-metaschema)

      - [2.6.6 LocalStateSchema](#266-localstateschema)

      - [2.6.7 AtticEntrySchema](#267-atticentryschema)

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

      - [BaseEntity Merge Rules](#baseentity-merge-rules)

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

    - [4.8 Search Commands](#48-search-commands)

      - [Implementation Notes](#implementation-notes)

    - [4.9 Maintenance Commands](#49-maintenance-commands)

      - [Info](#info)

      - [Stats](#stats)

      - [Doctor](#doctor)

      - [Compact (Future)](#compact-future)

      - [Config](#config)

    - [4.10 Global Options](#410-global-options)

    - [4.11 Attic Commands](#411-attic-commands)

    - [4.12 Output Formats](#412-output-formats)

  - [5. Beads Compatibility](#5-beads-compatibility)

    - [5.1 Import Strategy](#51-import-strategy)

      - [5.1.1 Import Command](#511-import-command)

      - [5.1.2 Multi-Source Import (--from-beads)](#512-multi-source-import---from-beads)

      - [5.1.3 Multi-Source Merge Algorithm](#513-multi-source-merge-algorithm)

      - [5.1.4 ID Mapping](#514-id-mapping)

      - [5.1.5 Import Algorithm](#515-import-algorithm)

      - [5.1.6 Merge Behavior on Re-Import](#516-merge-behavior-on-re-import)

      - [5.1.7 Handling Deletions and Tombstones](#517-handling-deletions-and-tombstones)

      - [5.1.8 Dependency ID Translation](#518-dependency-id-translation)

      - [5.1.9 Import Output](#519-import-output)

      - [5.1.10 Migration Workflow](#5110-migration-workflow)

    - [5.2 Command Mapping](#52-command-mapping)

    - [5.3 Field Mapping](#53-field-mapping)

    - [5.4 Status Mapping](#54-status-mapping)

    - [5.5 Compatibility Notes](#55-compatibility-notes)

      - [What Works Identically](#what-works-identically)

      - [Key Differences](#key-differences)

    - [5.6 Compatibility Contract](#56-compatibility-contract)

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

      - [Decision 3: Sync branch instead of main](#decision-3-sync-branch-instead-of-main)

      - [Decision 4: Display ID prefix for Beads compat](#decision-4-display-id-prefix-for-beads-compat)

      - [Decision 5: Only “blocks” dependencies in Phase 1](#decision-5-only-blocks-dependencies-in-phase-1)

      - [Decision 6: Markdown + YAML storage](#decision-6-markdown--yaml-storage)

      - [Decision 7: Hidden worktree for sync branch](#decision-7-hidden-worktree-for-sync-branch)

    - [7.2 Future Enhancements (Phase 2+)](#72-future-enhancements-phase-2)

      - [Additional Dependency Types (High Priority)](#additional-dependency-types-high-priority)

      - [Agent Registry](#agent-registry)

      - [Comments/Messages](#commentsmessages)

      - [GitHub Bridge](#github-bridge)

      - [Real-time Coordination](#real-time-coordination)

      - [Workflow Automation](#workflow-automation)

      - [Time Tracking](#time-tracking)

    - [7.3 File Structure Reference](#73-file-structure-reference)

  - [Appendix A: Beads to Ceads Feature Mapping](#appendix-a-beads-to-ceads-feature-mapping)

    - [A.1 Executive Summary](#a1-executive-summary)

    - [A.2 CLI Command Mapping](#a2-cli-command-mapping)

      - [A.2.1 Issue Commands (Full Parity)](#a21-issue-commands-full-parity)

      - [A.2.2 Label Commands (Full Parity)](#a22-label-commands-full-parity)

      - [A.2.3 Dependency Commands (Partial - blocks only)](#a23-dependency-commands-partial---blocks-only)

      - [A.2.4 Sync Commands (Full Parity)](#a24-sync-commands-full-parity)

      - [A.2.5 Maintenance Commands (Full Parity)](#a25-maintenance-commands-full-parity)

      - [A.2.6 Global Options (Full Parity)](#a26-global-options-full-parity)

    - [A.3 Data Model Mapping](#a3-data-model-mapping)

      - [A.3.1 Issue Schema](#a31-issue-schema)

      - [A.3.2 Status Values](#a32-status-values)

      - [A.3.3 Issue Types/Kinds](#a33-issue-typeskinds)

      - [A.3.4 Dependency Types](#a34-dependency-types)

    - [A.4 Architecture Comparison](#a4-architecture-comparison)

      - [A.4.1 Storage](#a41-storage)

      - [A.4.2 Sync](#a42-sync)

    - [A.5 LLM Agent Workflow Comparison](#a5-llm-agent-workflow-comparison)

      - [A.5.1 Basic Agent Loop (Full Parity)](#a51-basic-agent-loop-full-parity)

      - [A.5.2 Creating Linked Work (Partial Parity)](#a52-creating-linked-work-partial-parity)

      - [A.5.3 Migration Workflow](#a53-migration-workflow)

    - [A.6 Phase 1 Parity Summary](#a6-phase-1-parity-summary)

    - [A.7 Deferred to Phase 2+](#a7-deferred-to-phase-2)

    - [A.8 Migration Compatibility](#a8-migration-compatibility)

  - [Appendix B: Beads Commands NOT Included in Phase 1](#appendix-b-beads-commands-not-included-in-phase-1)

    - [B.1 Daemon Commands](#b1-daemon-commands)

    - [B.2 Molecule/Workflow Commands](#b2-moleculeworkflow-commands)

    - [B.3 Agent Coordination Commands](#b3-agent-coordination-commands)

    - [B.4 Advanced Data Operations](#b4-advanced-data-operations)

    - [B.5 Comment Commands](#b5-comment-commands)

    - [B.6 Editor Integration Commands](#b6-editor-integration-commands)

    - [B.7 Additional Dependency Types](#b7-additional-dependency-types)

    - [B.8 State Label Commands](#b8-state-label-commands)

    - [B.9 Other Commands](#b9-other-commands)

    - [B.10 Global Flags Not Supported](#b10-global-flags-not-supported)

    - [B.11 Issue Types/Statuses Not Supported](#b11-issue-typesstatuses-not-supported)

  - [8. Open Questions](#8-open-questions)

    - [8.1 Git Operations](#81-git-operations)

    - [8.2 Timestamp and Ordering](#82-timestamp-and-ordering)

    - [8.3 Mapping File Structure](#83-mapping-file-structure)

    - [8.4 ID Length](#84-id-length)

    - [8.5 Future Extension Points](#85-future-extension-points)

    - [8.6 Issue Storage Location](#86-issue-storage-location)

* * *

## 1. Introduction

### 1.1 What is Ceads?

**Ceads** is an alternative to [Beads](https://github.com/steveyegge/beads) that
eliminates some rough edges and architectural complexity while maintaining CLI
compatibility.

Ceads is pronounced “seeds” and follows Beads in the spirit of C following B.

**Key characteristics:**

- **Drop-in replacement**: Compatible with core Beads CLI commands and workflows at the
  CLI level (have agents use `cead` instead of `bd`)

- **Simpler architecture**: No daemon changing your `.beads` directory, no SQLite and
  associated file locking

- **Git-native**: Uses a dedicated sync branch for coordination data

- **Human-readable format**: Markdown + YAML front matter - directly viewable and
  editable in any text editor

- **File-per-entity**: Each issue is a separate `.md` file for fewer merge conflicts

- **Searchable**: Hidden worktree enables fast ripgrep/grep search across all issues

- **Reliable sync**: Hash-based conflict detection with LWW merge and attic preservation

- **Cross-environment**: Works on local machines, CI, cloud sandboxes, network
  filesystems

### 1.2 When to Use Ceads vs Beads

Ceads and Beads serve different use cases.
This section clarifies when each is appropriate.

**Use Ceads when:**

| Scenario | Why Ceads |
| --- | --- |
| Single agent, simple ticket tracking | Simpler, no daemon, fewer failure modes |
| Multi-agent with async handoffs | Git sync is sufficient, advisory claims work |
| Cloud sandbox / restricted environment | No daemon required, works with isolated git |
| Network filesystem (NFS/SMB) | No SQLite, no file locking issues |
| Need to debug sync issues | Markdown files are inspectable, no hidden state |
| Protected main branch | Sync branch architecture keeps main clean |

**Use Beads when:**

| Scenario | Why Beads |
| --- | --- |
| Multi-agent requiring real-time coordination | Agent Mail, daemon-based sync, atomic claims |
| Complex workflow orchestration | Molecules, wisps, formulas, bonding |
| Need ephemeral work tracking | Wisps (never synced, squash to digest) |
| High-performance queries on 10K+ issues | SQLite with indexes is faster than file scan |
| Need automatic "memory decay" | AI-powered compaction of old issues |
| Need interactive edit mode | `bd edit` opens in $EDITOR |

**Key Differences Summary:**

| Aspect | Ceads V3 Phase 1 | Beads |
| --- | --- | --- |
| Architecture | 2 locations (files + sync branch) | 4 locations (SQLite, JSONL, sync, main) |
| Daemon | Not required | Required for real-time sync |
| Storage | Markdown + YAML files | SQLite + JSONL |
| Coordination | Advisory claims, polling | Atomic claims, real-time |
| Workflow templates | Not supported | Molecules, wisps, protos |
| Agent messaging | Not supported | Agent Mail |
| Debugging | Inspect files directly | Requires SQLite queries |

**Ceads V3 Phase 1 is NOT:**

- A real-time coordination system for multiple agents working simultaneously

- A replacement for Beads’ advanced orchestration features (molecules, wisps, formulas)

- A replacement for Agent Mail or other real-time messaging layers

- A workflow automation engine with templates

For advanced coordination needs, continue using Beads or wait for Ceads Phase 2+.

### 1.3 Why Replace Beads? (Architecture Comparison)

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

- **Hidden worktree**: Managed worktree for sync branch access, searchable with ripgrep

- **File-per-entity**: Parallel creation has zero conflicts

- **Transparent state**: Everything is inspectable Markdown files with YAML metadata

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

### 1.4 Design Goals

1. **Beads CLI compatibility**: Existing workflows and scripts work with minimal changes
   for the most common beads commands

2. **No data loss**: Conflicts preserve both versions via attic mechanism

3. **Works anywhere**: Just `npm install -g ceads` anywhere: local dev, CI, cloud IDEs
   (Claude Code, Codespaces), network filesystems

4. **Simple architecture**: Easy to understand, debug, and maintain

5. **Performance**: <50ms for common operations on 5,000-10,000 issues

6. **Cross-platform**: macOS, Linux, Windows without platform-specific code

7. **Easy migration**: `cead import <beads-export.jsonl>` or `cead import --from-beads`
   converts existing Beads databases

### 1.5 Design Principles

1. **Simplicity first**: Prefer boring, well-understood approaches over clever
   optimization

2. **Files as truth**: Markdown + YAML files on disk are the canonical state

3. **Git for sync**: Standard git commands handle all distribution

4. **No required daemon**: CLI-first, background services optional

5. **Debuggable by design**: Every state change is visible in files and git history

6. **Progressive enhancement**: Core works standalone, bridges/UI are optional layers

### 1.6 Non-Goals for Phase 1

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

### 1.7 Layer Overview

Ceads V3 Phase 1 has three layers:

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
│   .ceads/config.yml │ .ceads-sync/*.md │ Zod schemas              │
└─────────────────────────────────────────────────────────────────┘
```

**File Layer**: Defines Markdown/YAML format, directory structure, ID generation

**Git Layer**: Defines sync using standard git commands, conflict resolution

**CLI Layer**: Beads-compatible command interface

* * *

## 2. File Layer

### 2.1 Overview

The File Layer defines entity schemas and storage format using **Markdown files with
YAML front matter** - the same format used by static site generators (Jekyll, Hugo,
Astro).

**Key properties:**

- **Zod schemas are normative**: TypeScript Zod definitions are the specification

- **Human-readable**: Issues are viewable/editable in any text editor

- **Self-documenting**: Each `.md` file has YAML front matter with `type` field

- **Markdown body**: Description and notes are natural Markdown

- **Canonical serialization**: Deterministic format for content hashing

- **Atomic writes**: Write to temp file, then atomic rename (see below)

#### Markdown + YAML Front Matter Format

Issue files use the standard front matter pattern:

```markdown
---
type: is
id: is-a1b2c3
version: 3
kind: bug
title: Fix authentication timeout
status: in_progress
priority: 1
assignee: claude
labels:
  - backend
  - security
dependencies:
  - target: is-f14c3d
    type: blocks
parent_id: null
created_at: 2025-01-07T10:00:00Z
updated_at: 2025-01-08T14:30:00Z
created_by: alice
closed_at: null
close_reason: null
due_date: 2025-01-15T00:00:00Z
deferred_until: null
extensions: {}
---

Users are being logged out after exactly 5 minutes of inactivity.

## Steps to Reproduce

1. Log in to the application
2. Wait 5 minutes
3. Try to navigate to another page

## Notes

Found the issue in session.ts line 42. Working on fix.
```

**File structure:**

- `---` delimiters enclose YAML front matter

- Metadata fields in YAML (structured data)

- Body is the description (Markdown)

- `## Notes` section separates working notes from description

#### Canonical Serialization

For content hashing and conflict detection, we need deterministic serialization:

**YAML front matter rules:**

- Keys sorted alphabetically at each level

- Block style for arrays/objects (no flow style)

- Arrays sorted by defined rules (labels: lexicographic, dependencies: by target)

- Timestamps in ISO8601 with Z suffix (UTC)

- Null values explicit (not omitted)

- Empty objects/arrays explicit (`extensions: {}`, `labels: []`)

- No trailing whitespace

- LF line endings (not CRLF)

**Body rules:**

- Trim leading/trailing whitespace from description and notes

- Normalize multiple blank lines to single blank line

- Single newline at end of file

- LF line endings

**Recommended `.gitattributes`:**
```
.ceads-sync/** text eol=lf
```

> **Why canonical format?** Content hashes are used for conflict detection.
> If different implementations serialize the same content differently, identical logical
> content produces different hashes, causing spurious “conflicts.”

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

**Cross-platform notes:**

- POSIX local filesystems: `rename()` is atomic and durable after `fsync()`

- Windows: `rename()` is atomic but may fail if target exists (use `MoveFileEx` with
  `MOVEFILE_REPLACE_EXISTING`)

- Network filesystems (NFS, SMB): Best-effort atomicity; may not be fully atomic but
  still prevents partial writes

- Implementations should use a well-tested atomic-write library when available

**Cleanup:** On startup, remove orphaned `.tmp.*` files in ceads directories that are
**older than 1 hour**. This threshold prevents race conditions where one process creates
a temp file while another is cleaning up.
Alternatively, include `node_id` in temp file names and only cleanup files matching the
current node’s prefix.

### 2.2 Directory Structure

Ceads uses three directory locations:

- **`.ceads/`** on main branch: Configuration (tracked) + local cache (gitignored)

- **`.ceads/.worktree/`** hidden worktree: Checkout of `ceads-sync` branch for search

- **`.ceads-sync/`** on `ceads-sync` branch: Synced entities and attic

#### On Main Branch (all working branches)

```
.ceads/
├── config.yml             # Project configuration (tracked)
├── .gitignore              # Ignores cache/ and .worktree/ (tracked)
│
├── cache/                  # Gitignored - local state
│   ├── state.yml          # Per-node sync state (last_sync, node_id)
│   ├── index.json          # Optional query index (rebuildable)
│   └── sync.lock           # Sync coordination file
│
└── .worktree/              # Gitignored - hidden worktree
    └── (checkout of ceads-sync branch)
        └── .ceads-sync/
            ├── issues/
            │   ├── is-a1b2c3.md
            │   └── is-f14c3d.md
            └── ...
```

#### On `ceads-sync` Branch

```
.ceads-sync/
├── issues/                 # Issue entities (Markdown)
│   ├── is-a1b2c3.md
│   └── is-f14c3d.md
├── attic/                  # Conflict archive
│   └── conflicts/
│       └── is-a1b2c3/
│           └── 2025-01-07T10-30-00Z_description.md
├── mappings/               # Import ID mappings
│   └── beads.yml          # Beads ID → Ceads ID mapping
└── meta.yml               # Metadata (schema version)
```

**Why this structure?**

- Config on main versions with your code

- Synced data on separate branch avoids merge conflicts on working branches

- Local cache is gitignored, never synced

- File-per-entity enables parallel operations without conflicts

- **Hidden worktree enables fast search** via ripgrep/grep

### 2.3 Hidden Worktree Model

Ceads maintains a **hidden git worktree** at `.ceads/.worktree/` that checks out the
`ceads-sync` branch.
This provides:

1. **Fast search**: ripgrep can search all issues without git plumbing commands

2. **Direct file access**: Read issues without `git show` overhead

3. **Isolated from main**: Doesn’t pollute working directory or affect main branch

4. **Automatic updates**: Updated on `cead sync` operations

#### Worktree Setup

Created automatically by `cead init` or first `cead sync`:

```bash
# Create hidden worktree (done by ceads internally)
git worktree add .ceads/.worktree ceads-sync --detach

# Or if ceads-sync doesn't exist yet
git worktree add .ceads/.worktree --orphan ceads-sync
```

**Key properties:**

- **Detached HEAD**: Worktree tracks commits, not branch name, to avoid branch lock

- **Hidden location**: Inside `.ceads/` which is partially gitignored

- **Safe updates**: `cead sync` does `git -C .ceads/.worktree pull` after push

#### Worktree Gitignore

The `.ceads/.gitignore` must include:

```gitignore
cache/
.worktree/
```

#### Accessing Issues via Worktree

```bash
# Files are directly accessible
cat .ceads/.worktree/.ceads-sync/issues/is-a1b2c3.md

# ripgrep search across all issues
rg "authentication" .ceads/.worktree/.ceads-sync/issues/

# List all issues
ls .ceads/.worktree/.ceads-sync/issues/
```

#### Worktree Lifecycle

| Operation | Worktree Action |
| --- | --- |
| `cead init` | Create worktree if ceads-sync exists |
| `cead sync --pull` | `git -C .worktree pull origin ceads-sync` |
| `cead sync --push` | Update worktree after successful push |
| `cead doctor` | Verify worktree health, repair if needed |
| Repo clone | Worktree created on first cead command |

**Invariant:** The hidden worktree at `.ceads/.worktree/` always reflects the current
state of the `ceads-sync` branch after sync operations.

#### Worktree Initialization Decision Tree

When any `cead` command runs, it must ensure the worktree is initialized.
The logic depends on the repository state:

```
START: Any cead command
    │
    ├─ Does .ceads/ directory exist?
    │   ├─ NO → Run `cead init` first (error: "Not a ceads repository")
    │   └─ YES ↓
    │
    ├─ Does .ceads/.worktree/ exist and contain valid checkout?
    │   ├─ YES → Worktree ready, proceed with command
    │   └─ NO ↓
    │
    ├─ Does ceads-sync branch exist (local or remote)?
    │   ├─ YES (local) → git worktree add .ceads/.worktree ceads-sync --detach
    │   ├─ YES (remote only) → git fetch origin ceads-sync
    │   │                      git worktree add .ceads/.worktree origin/ceads-sync --detach
    │   └─ NO → This is a fresh ceads init, create orphan worktree:
    │           git worktree add .ceads/.worktree --orphan ceads-sync
    │           (Initialize .ceads-sync/ structure in worktree)
    │
    └─ Worktree ready, proceed with command
```

**Scenarios:**

| Repository State | Worktree Action |
| --- | --- |
| Fresh `cead init` | Create orphan worktree with empty .ceads-sync/ |
| Clone of existing ceads repo | Fetch remote, create worktree from origin/ceads-sync |
| Existing local worktree corrupted | `cead doctor --fix` removes and recreates |
| Worktree exists but stale | `cead sync` updates to latest commit |

### 2.4 Entity Collection Pattern

Phase 1 has **one core entity type**: Issues

Future phases may add: agents, messages, workflows, templates

#### Directory Layout

| Collection | Directory | Extension | ID Prefix | Purpose |
| --- | --- | --- | --- | --- |
| Issues | `.ceads-sync/issues/` | `.md` | `is-` | Task tracking (synced) |

#### Adding New Entity Types (Future)

To add a new entity type:

1. Create directory: `.ceads-sync/messages/` (on sync branch)

2. Define schema: `MessageSchema` in Zod

3. Define ID prefix: `ms-`

4. Define merge rules

5. Add CLI commands

No sync algorithm changes needed—sync operates on files, not schemas.

### 2.5 ID Generation

Entity IDs follow this pattern:

```
{prefix}-{hash}
```

- **Prefix**: 2 lowercase letters (`is-` for issues)

- **Hash**: 6 lowercase hex characters (stored form)

Example: `is-a1b2c3`, `is-f14c3a`

> **Note:** Users may type shorter prefixes (4-6 chars) when referring to issues; these
> are resolved to the unique matching full ID. Stored IDs are always 6 hex chars.

#### ID Generation Algorithm

```typescript
import { randomBytes } from 'crypto';

function generateId(prefix: string): string {
  // 3 bytes = 24 bits of entropy = 6 hex chars
  const bytes = randomBytes(3);
  const hash = bytes.toString('hex').toLowerCase();
  return `${prefix}-${hash}`;  // e.g., "is-a1b2c3"
}
```

**Properties:**

- **Cryptographically random**: No timestamp or content dependency

- **Entropy**: 24 bits = 16.7 million possibilities

- **Collision probability**: With birthday paradox, ~~1% collision chance at ~~13,000
  issues; ~~50% at ~~5,000 simultaneous concurrent creations.
  Acceptable for Phase 1 with collision retry.

- **On collision**: Regenerate ID (detected by file-exists check before write)

**ID validation regex:**
```typescript
// Stored IDs are always 6 hex chars
const IssueId = z.string().regex(/^is-[a-f0-9]{6}$/);

// For CLI input, accept 4-6 chars and resolve to unique match
const IssueIdInput = z.string().regex(/^(is-|bd-)?[a-f0-9]{4,6}$/);
```

**Display prefix note:** Internal IDs use `is-` prefix.
The `display.id_prefix` config (default: `bd`) controls how IDs are shown to users for
Beads compatibility.
When a user types `bd-a1b2c3`, it is resolved to internal `is-a1b2c3`. When displaying,
the internal ID is shown with the configured prefix.

### 2.6 Schemas

Schemas are defined in Zod (TypeScript).
Other languages should produce equivalent YAML/Markdown output.

#### 2.6.1 Common Types

```typescript
import { z } from 'zod';

// ISO8601 timestamp
const Timestamp = z.string().datetime();

// Issue ID (stored IDs always have exactly 6 hex chars)
const IssueId = z.string().regex(/^is-[a-f0-9]{6}$/);

// Edit counter - incremented on every local change
// IMPORTANT: Version is NOT used for conflict detection (content hash is used instead).
// Version is informational only, used for:
// - Debugging: track how many times an entity was edited
// - Merge result ordering: max(local, remote) + 1
// - Display: show edit count to users
const Version = z.number().int().nonnegative();

// Entity type discriminator
const EntityType = z.literal('is');
```

> **Version Field Clarification:** The `version` field is **purely informational**. It
> is incremented on every local change but is NOT used to detect conflicts.
> Conflict detection uses **content hash comparison** (see §3.4). This avoids the
> classic distributed systems problem where version numbers can diverge when two nodes
> edit independently. The version is useful for debugging ("how many times was this
> edited?") and is set to `max(local, remote) + 1` after merges.

#### 2.6.2 BaseEntity

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
> schemas. Keys should be namespaced (e.g., `github`, `slack`, `my-tool`). Unknown
> extensions are preserved during sync and merge (pass-through).
> 
> Example (in YAML front matter):
> ```yaml
> extensions:
>   github:
>     issue_number: 123
>     synced_at: 2025-01-07T10:00:00Z
>   my-tool:
>     custom_field: value
> ```

#### 2.6.3 IssueSchema

```typescript
const IssueStatus = z.enum(['open', 'in_progress', 'blocked', 'deferred', 'closed']);
const IssueKind = z.enum(['bug', 'feature', 'task', 'epic', 'chore']);
const Priority = z.number().int().min(0).max(4);

// Dependency types - using enum for extensibility (Phase 2 will add 'related', 'discovered-from')
const DependencyType = z.enum(['blocks']);  // Phase 1: only "blocks" supported

const Dependency = z.object({
  type: DependencyType,
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

- `kind`: Matches Beads types (bug, feature, task, epic, chore).
  Note: CLI uses `--type` flag for Beads compatibility, which maps to the `kind` field
  internally.

- `priority`: 0 (highest/critical) to 4 (lowest), matching Beads

- `notes`: Working notes field for agents to track progress (Beads parity)

- `dependencies`: Only “blocks” type for now (affects `ready` command)

- `labels`: Arbitrary string tags

- `due_date` / `deferred_until`: Beads compatibility fields.
  Stored as full ISO8601 datetime.
  CLI accepts flexible input:

  - Full datetime: `2025-02-15T10:00:00Z`

  - Date only: `2025-02-15` (normalized to `2025-02-15T00:00:00Z` UTC)

  - Relative: `+7d` (7 days from now), `+2w` (2 weeks)

**Notes on tombstone status:**

Beads has a `tombstone` status for soft-deleted issues.
In Ceads, we handle deletion differently:

- Closed issues remain in `issues/` directory with `status: closed`

- Hard deletion moves the file to `attic/deleted/`

- No `tombstone` status needed

#### 2.6.4 ConfigSchema

Project configuration stored in `.ceads/config.yml`:

```yaml
# .ceads/config.yml
ceads_version: "3.0.0"

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

#### 2.6.5 MetaSchema

Shared metadata stored in `.ceads-sync/meta.yml` on the sync branch:

```typescript
const MetaSchema = z.object({
  schema_version: z.number().int(),
  created_at: Timestamp,
});
```

> **Note**: `last_sync` is intentionally NOT stored in `meta.yml`. Syncing this file
> would create a conflict hotspot—every node updates it on every sync, causing constant
> merge conflicts. Instead, sync timestamps are tracked locally in
> `.ceads/cache/state.yml` (gitignored).

#### 2.6.6 LocalStateSchema

Per-node state stored in `.ceads/cache/state.yml` (gitignored, never synced).
Each machine maintains its own local state:

```typescript
const LocalStateSchema = z.object({
  node_id: z.string().optional(),             // Unique identifier for this node
  last_sync: Timestamp.optional(),            // When this node last synced successfully
  last_push: Timestamp.optional(),            // When this node last pushed
  last_pull: Timestamp.optional(),            // When this node last pulled
  last_synced_commit: z.string().optional(),  // Git commit hash of last successful sync
});
```

> **Why local?** The `last_sync` timestamp is inherently per-node.
> Storing it in synced state would cause every sync to modify the same file, creating a
> guaranteed conflict generator.
> Keeping it local eliminates this hotspot.

**Sync Baseline:** The `last_synced_commit` field stores the git commit hash on
`ceads-sync` that was last successfully synced.
This enables:

- `cead sync --status` to compute pending changes via
  `git diff --name-status <baseline>..origin/ceads-sync`

- Incremental sync operations without full scans

- Clear definition of “local changes” (modified since baseline) and “remote changes”
  (commits after baseline on remote)

#### 2.6.7 AtticEntrySchema

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

**Critical Invariant:** Ceads MUST NEVER modify the user’s git index or staging area.
All git plumbing operations that write to the sync branch MUST use an isolated index
file via `GIT_INDEX_FILE` environment variable.
This ensures that a developer’s staged changes are never corrupted by ceads operations.

```bash
# Example: all sync branch writes use isolated index
export GIT_INDEX_FILE="$(git rev-parse --git-dir)/ceads-index"
```

### 3.2 Sync Branch Architecture

```
main branch:                    ceads-sync branch:
├── src/                        └── .ceads-sync/
├── tests/                          ├── issues/
├── README.md                       ├── attic/
├── .ceads/                         └── meta.yml
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
.ceads-sync/meta.yml   # Metadata
```

### 3.3 Sync Operations

Sync uses standard git commands to read/write the sync branch without checking it out.

#### 3.3.1 Reading from Sync Branch

```bash
# Read a file from sync branch without checkout
git show ceads-sync:.ceads-sync/issues/is-a1b2.md

# List files in issues directory
git ls-tree ceads-sync .ceads-sync/issues/
```

#### 3.3.2 Writing to Sync Branch

All write operations use an isolated index to protect user’s staged changes:

```bash
# Setup isolated index
export GIT_INDEX_FILE="$(git rev-parse --git-dir)/ceads-index"

# 1. Fetch latest
git fetch origin ceads-sync

# 2. Read current sync branch state into isolated index
git read-tree ceads-sync

# 3. Update index with local changes
#    (files from .ceads/cache/entities/ are added to the tree)
git update-index --add --cacheinfo 100644,<blob-sha>,".ceads-sync/issues/is-a1b2c3.md"

# 4. Write tree from isolated index
TREE=$(git write-tree)

# 5. Create commit on sync branch
COMMIT=$(git commit-tree $TREE -p ceads-sync -m "ceads sync: $(date -Iseconds)")

# 6. Update sync branch ref
git update-ref refs/heads/ceads-sync $COMMIT

# 7. Push to remote
git push origin ceads-sync
```

**Push Retry Algorithm (V2-005):**

If push is rejected (non-fast-forward), retry with merge:

```
MAX_RETRIES = 3

for attempt in 1..MAX_RETRIES:
  1. git fetch origin ceads-sync
  2. Compute diff between prepared_commit and origin/ceads-sync
  3. For each conflicting file:
     - Load both versions as JSON
     - Apply merge rules (section 3.5)
     - Write merged result, save losers to attic
  4. Create new tree with merged files
  5. Create new commit with both parents (merge commit)
  6. git push origin ceads-sync
  7. If push succeeds: done
  8. If push rejected: continue to next attempt

If all attempts fail:
  - Exit with error code 1
  - Output: "Sync failed after 3 attempts. Manual resolution required."
  - Suggest: "Run 'cead sync --status' to see pending changes."
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

> **Note on Attic Entries**: Attic entries are created only when a merge strategy
> **discards** data (e.g., LWW picks one scalar over another, or one text block over
> another). Union-style merges that retain both values (e.g., labels, dependencies) do
> not create attic entries since no data is lost.
> This ensures the attic remains focused on actual data loss, not routine merges.

### 3.5 Merge Rules

Field-level merge strategies:

| Strategy | Behavior | Used For |
| --- | --- | --- |
| `immutable` | Error if different | `type`, `id` |
| `lww` | Last-write-wins by timestamp | Scalars (title, status, priority) |
| `lww_with_attic` | LWW, preserve loser in attic | Long text (description) |
| `union` | Combine arrays, dedupe, sort | Labels |
| `merge_by_id` | Merge arrays by item ID, sort | Dependencies |
| `max_plus_one` | `max(local, remote) + 1` | `version` |
| `recalculate` | Fresh timestamp | `updated_at` |
| `preserve_oldest` | Keep earliest value | `created_at`, `created_by` |
| `deep_merge_by_key` | Union keys, LWW per key | `extensions` |

**LWW Tie-Breaker Rule:**

When `updated_at` timestamps are equal, use this deterministic tie-breaker:

1. Prefer remote over local (convention: remote is “more shared”)

2. If still ambiguous (e.g., same node), prefer lexically greater content hash

3. Always preserve losing value in attic

> **Rationale:** Equal timestamps are common with coarse clocks, imports, or identical
> writes. A deterministic tie-breaker prevents oscillation and ensures consistent merges
> across nodes.

#### BaseEntity Merge Rules

All entities share these base field merge rules:

```typescript
const baseEntityMergeRules = {
  type: { strategy: 'immutable' },
  id: { strategy: 'immutable' },
  version: { strategy: 'max_plus_one' },
  created_at: { strategy: 'preserve_oldest' },
  updated_at: { strategy: 'recalculate' },  // Always set to merge time
  extensions: { strategy: 'deep_merge_by_key' },
};
```

#### Issue Merge Rules

```typescript
const issueMergeRules: MergeRules<Issue> = {
  // BaseEntity fields (inherited)
  ...baseEntityMergeRules,

  // Issue-specific fields
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
  created_by: { strategy: 'preserve_oldest' },
  closed_at: { strategy: 'lww' },  // See status/closed_at rules below
  close_reason: { strategy: 'lww' },
};
```

**Status and closed_at Interaction:**

- If merged `status` becomes `closed` and `closed_at` is not set, set it to merge time

- If merged `status` changes from `closed` to another status (reopen), clear `closed_at`

- `close_reason` follows LWW independently

**Extensions Deep Merge:**

The `extensions` field uses per-namespace merging to preserve third-party data:

```typescript
// Example: merging extensions
local.extensions = { github: { issue: 123 }, slack: { channel: "dev" } };
remote.extensions = { github: { pr: 456 }, jira: { key: "PROJ-1" } };

// Result: union of keys, per-key LWW for conflicts
merged.extensions = {
  github: { pr: 456 },        // remote wins (LWW on github namespace)
  slack: { channel: "dev" },  // preserved from local
  jira: { key: "PROJ-1" }     // preserved from remote
};
// Note: github.issue lost because remote's github namespace won LWW
// The losing github namespace is preserved in attic
```

### 3.6 Attic Structure

The attic preserves data lost in conflicts:

```
.ceads-sync/attic/
└── conflicts/
    └── is-a1b2/
        ├── 2025-01-07T10-30-00Z_description.yml
        └── 2025-01-07T11-45-00Z_full.yml
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
  -t, --type <type>         Issue type: bug, feature, task, epic, chore (default: task)
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

> **Note on `--type` flag:** The CLI flag `--type` (or `-t`) sets the issue’s `kind`
> field, NOT the `type` field.
> The `type` field is the entity discriminator (always `is` for issues) and is set
> automatically. This naming choice maintains Beads CLI compatibility where `--type` was
> used for issue classification.

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
  --all                     Include closed issues (default: excludes closed)
  --type <type>             Filter: bug, feature, task, epic
  --priority <0-4>          Filter by priority
  --assignee <name>         Filter by assignee
  --label <label>           Filter by label (repeatable)
  --parent <id>             List children of parent
  --deferred                Show only deferred issues
  --defer-before <date>     Deferred before date
  --sort <field>            Sort by: priority, created, updated (default: priority)
                            (created/updated are shorthand for created_at/updated_at)
  --limit <n>               Limit results
  --json                    Output as JSON
```

> **Default filtering:** By default, `cead list` excludes closed issues to focus on
> active work. Use `--all` to include closed issues, or `--status closed` to show only
> closed issues.

**Examples:**
```bash
cead list                             # Active issues only (excludes closed)
cead list --all                       # All issues including closed
cead list --status closed             # Only closed issues
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

Notes:
  Working on session token expiry. Found issue in refresh logic.

Dependencies:
  blocks bd-f14c: Update session handling
```

> **Note:** The `notes` field is displayed separately from `description`. Notes are
> intended for agent/developer working notes, while description is the issue’s canonical
> description.

#### Update

```bash
cead update <id> [options]

Options:
  --status <status>         Set status
  --type <type>             Set type
  --priority <0-4>          Set priority
  --assignee <name>         Set assignee
  --description <text>      Set description
  --notes <text>            Set working notes
  --notes-file <path>       Set notes from file
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

> **Performance note:** The `ready` command uses the query index when enabled to avoid
> loading all issues. Dependency target status is checked via index lookup.
> Without index, dependency targets are loaded on-demand.

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
  modified: is-a1b2.md
  new:      is-f14c.md

Remote changes (not yet pulled):
  modified: is-x1y2.md
```

### 4.8 Search Commands

Ceads provides integrated search via the hidden worktree, enabling direct text search
across all issues using standard tools like ripgrep or grep.

```bash
# Search issue content
cead search <pattern> [options]

Options:
  --field <field>           Search only in specific field (title, description, notes)
  --type <type>             Filter by issue type (bug, feature, task, epic, chore)
  --status <status>         Filter by status
  --label <label>           Filter by label
  --case-sensitive          Case-sensitive search (default: case-insensitive)
  --context <n>             Show n lines of context (default: 2)
  --files-only              Only show matching file paths
  --count                   Show match count only
  --json                    JSON output
```

**Examples:**
```bash
# Basic search
cead search "authentication"

# Search in specific field
cead search "timeout" --field description

# Search only bugs
cead search "error" --type bug

# Search open issues only
cead search "TODO" --status open

# Show file paths only
cead search "security" --files-only

# Count matches
cead search "FIXME" --count
```

**Output (default):**
```
bd-a1b2: Fix authentication timeout
  description (line 5): ...users experiencing authentication timeout after 5 minutes...

bd-f14c: Add OAuth support
  notes (line 2): ...need to handle timeout during OAuth callback...

Found 2 issues with 2 matches
```

**Output (--json):**
```json
{
  "matches": [
    {
      "issue_id": "is-a1b2c3",
      "display_id": "bd-a1b2",
      "field": "description",
      "line": 5,
      "content": "users experiencing authentication timeout after 5 minutes",
      "context_before": ["The session expires and"],
      "context_after": ["This affects all users"]
    }
  ],
  "total_issues": 2,
  "total_matches": 2
}
```

#### Implementation Notes

Search is implemented by running ripgrep (or grep as fallback) against the hidden
worktree directory:

```
.ceads/.worktree/.ceads-sync/issues/
```

**Tool selection:**

1. If `rg` (ripgrep) is available, use it (recommended for speed)

2. Fall back to `grep -r` if ripgrep unavailable

3. Emit warning on first fallback: “ripgrep not found, using grep (slower)”

**Search algorithm:**

```
SEARCH(pattern, options):
  1. Ensure worktree is initialized and up-to-date
     - If stale (>5 minutes since last fetch), refresh: cead sync --pull

  2. Build search command:
     rg_args = [
       "-i" if not options.case_sensitive,
       "-C", options.context,
       "--type", "md",  # Only search .md files
       pattern,
       worktree_path + "/.ceads-sync/issues/"
     ]

  3. If field filter specified:
     - Post-process results to filter by YAML field or body section

  4. Parse results and map to issue IDs

  5. Apply additional filters (type, status, label) by reading matched files

  6. Format output according to options
```

**Worktree staleness:**

The search command checks worktree freshness.
If the worktree is stale (last fetch was more than 5 minutes ago), search will
automatically pull before searching to ensure results are current.
This can be disabled with `--no-refresh`.

> **Why 5 minutes?** The default staleness threshold of 5 minutes balances freshness vs
> performance. During active work, agents typically sync more frequently than this, so
> the auto-refresh rarely triggers.
> For long-running sessions where remote changes may accumulate, the refresh ensures
> search results include recent work from other agents.
> The threshold is configurable via `settings.search_staleness_minutes` in config.yml.

**Configuration:**
```yaml
# .ceads/config.yml
settings:
  search_staleness_minutes: 5  # Default: 5, set to 0 to always refresh, -1 to never
```

```bash
# Search without refreshing (faster but potentially stale)
cead search "pattern" --no-refresh
```

### 4.9 Maintenance Commands

#### Info

```bash
cead info [options]

Options:
  --json                    JSON output
```

**Output:**
```
Ceads Version: 3.0.0
Sync Branch: ceads-sync
Remote: origin
Display Prefix: bd
Worktree: .ceads/.worktree/ (healthy)
Last Sync: 2025-01-10T10:00:00Z
Issue Count: 127
```

**Output (--json):**
```json
{
  "ceads_version": "3.0.0",
  "sync_branch": "ceads-sync",
  "remote": "origin",
  "display_prefix": "bd",
  "worktree_path": ".ceads/.worktree/",
  "worktree_healthy": true,
  "last_sync": "2025-01-10T10:00:00Z",
  "last_synced_commit": "abc123def456",
  "issue_count": 127
}
```

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

### 4.10 Global Options

Available on all commands:

```bash
--help                      Show help
--version                   Show version
--db <path>                 Custom .ceads directory path (Beads compat alias)
--dir <path>                Custom .ceads directory path (preferred)
--no-sync                   Disable auto-sync (per command)
--json                      JSON output
--actor <name>              Override actor name
```

**Actor Resolution Order:**

The actor name (used for `created_by` and recorded in sync commits) is resolved in this
order:

1. `--actor <name>` CLI flag (highest priority)

2. `CEAD_ACTOR` environment variable

3. Git user.email from git config

4. System username + hostname (fallback)

Example: `CEAD_ACTOR=claude-agent-1 cead create "Fix bug"`

> **Note:** `--db` is retained for Beads compatibility.
> Prefer `--dir` for new usage.

### 4.11 Attic Commands

The attic preserves data lost in merge conflicts.
These commands enable inspection and recovery.

**Entry ID Format:**

Attic entries are identified by a composite ID derived from the entity, timestamp, and
field:

```
{entity-id}/{timestamp}_{field}

Examples:
  is-a1b2c3/2025-01-07T10-30-00Z_description
  is-f14c3d/2025-01-08T09-00-00Z_title
  is-a1b2c3/2025-01-07T11-45-00Z_full    # Full entity conflict (rare)
```

- **entity-id**: The issue ID (e.g., `is-a1b2c3`)

- **timestamp**: ISO8601 timestamp with colons replaced by hyphens (filesystem-safe)

- **field**: The field name that was overwritten, or `full` for complete entity
  conflicts

This format ensures unique, sortable entry IDs that can be easily parsed and allow
filtering by entity or time range.

```bash
# List attic entries
cead attic list [options]

Options:
  --id <id>                 Filter by issue ID
  --field <field>           Filter by field name
  --since <date>            Entries since date
  --limit <n>               Limit results
  --json                    JSON output
```

**Output:**
```
TIMESTAMP                  ISSUE      FIELD        WINNER
2025-01-07T10:30:00Z      bd-a1b2    description  remote
2025-01-07T11:45:00Z      bd-a1b2    notes        local
2025-01-08T09:00:00Z      bd-f14c    title        remote
```

```bash
# Show attic entry details
cead attic show <entry-id> [options]

Options:
  --json                    JSON output
```

**Output:**
```
Attic Entry: 2025-01-07T10-30-00Z_description

Issue: bd-a1b2 (Fix authentication bug)
Field: description
Timestamp: 2025-01-07T10:30:00Z

Winner: remote (version 4)
Loser: local (version 3)

Lost value:
  Original description text that was overwritten...

Context:
  Local updated_at: 2025-01-07T10:25:00Z
  Remote updated_at: 2025-01-07T10:28:00Z
```

```bash
# Restore value from attic
cead attic restore <entry-id> [options]

Options:
  --dry-run                 Show what would be restored
  --no-sync                 Don't sync after restore
```

**Example:**
```bash
# Preview restoration
cead attic restore 2025-01-07T10-30-00Z_description --dry-run

# Apply restoration (creates new version with restored value)
cead attic restore 2025-01-07T10-30-00Z_description
```

> **Note:** Restore creates a new version of the issue with the attic value applied to
> the specified field.
> The original winning value is preserved in a new attic entry, maintaining the “no data
> loss” invariant.

### 4.12 Output Formats

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

### 5.1 Import Strategy

The import command is designed to be **idempotent and safe to re-run**. This enables
workflows where:

- Initial migration from Beads to Ceads

- Ongoing sync if some agents still use Beads temporarily

- Recovery if work was accidentally done in Beads

#### 5.1.1 Import Command

The import command supports two modes: **explicit file** and **repository auto-detect**.

```bash
# Mode 1: Explicit file (e.g., from `bd export`)
cead import <file> [options]

# Mode 2: Auto-detect from Beads repository
cead import --from-beads [path] [options]

Options:
  --format beads          Import format (default: beads)
  --from-beads [path]     Auto-detect from .beads/ directory (default: current dir)
  --branch <name>         Specific branch to import from (default: both main + sync)
  --dry-run               Show what would be imported without making changes
  --no-sync               Don't sync after import
  --verbose               Show detailed import progress
```

**Examples:**
```bash
# Explicit file import (recommended for controlled migration)
bd export > beads-export.jsonl
cead import beads-export.jsonl

# Re-import after more Beads work (safe to re-run)
bd export > beads-export.jsonl
cead import beads-export.jsonl  # Updates existing, adds new, no duplicates

# Preview changes before importing
cead import beads-export.jsonl --dry-run

# Auto-detect from repository (imports from both main and sync branch)
cead import --from-beads

# Auto-detect from specific path
cead import --from-beads /path/to/repo

# Import only from main branch
cead import --from-beads --branch main

# Import only from sync branch
cead import --from-beads --branch beads-sync
```

#### 5.1.2 Multi-Source Import (--from-beads)

When using `--from-beads`, Ceads reads directly from the Beads repository structure
instead of an exported file.
This is useful when you want to import without running `bd export` first, or when you
need to capture changes from both main and sync branches.

**Beads Repository Structure:**

Beads stores issues in two potential locations that may contain different data:

```
.beads/
├── issues.jsonl          # JSONL on current branch (may be main or feature branch)
├── beads.db              # SQLite cache (gitignored, not imported)
└── config.yml           # Contains sync.branch setting

# If sync.branch is configured (e.g., "beads-sync"):
# The sync branch also has .beads/issues.jsonl
```

**Why both branches matter:**

1. **Sync branch** (`beads-sync`): Where daemon commits changes automatically

2. **Main branch**: Where sync branch is periodically merged

These can diverge when:

- Daemon has committed to sync branch but not yet pushed/merged to main

- Agent work happened on sync branch after last merge to main

- Different machines have committed to different branches

**Auto-Detection Algorithm:**

```
DETECT_BEADS_SOURCES(path):
  1. Find .beads/ directory at path (or current directory)
  2. Read .beads/config.yaml to get sync.branch setting
  3. Collect JSONL sources:

     sources = []

     # Check current branch / working directory
     if exists(.beads/issues.jsonl):
       sources.append({
         branch: "working-copy",
         path: .beads/issues.jsonl
       })

     # Check main branch (via git show)
     main_branch = detect_default_branch()  # main or master
     if git_file_exists(main_branch, ".beads/issues.jsonl"):
       sources.append({
         branch: main_branch,
         content: git_show(main_branch + ":.beads/issues.jsonl")
       })

     # Check sync branch if configured
     if sync_branch = config.yaml["sync.branch"]:
       if git_file_exists(sync_branch, ".beads/issues.jsonl"):
         sources.append({
           branch: sync_branch,
           content: git_show(sync_branch + ":.beads/issues.jsonl")
         })

  4. Return sources (may be 1-3 depending on configuration)
```

**Reading from Git Branches Without Checkout:**

```bash
# Read JSONL from a specific branch without checking it out
git show beads-sync:.beads/issues.jsonl

# Check if file exists on branch
git cat-file -e beads-sync:.beads/issues.jsonl 2>/dev/null && echo "exists"
```

#### 5.1.3 Multi-Source Merge Algorithm

When importing from multiple sources (e.g., main + sync branch), issues are merged using
**Last-Write-Wins (LWW)** based on `updated_at` timestamp, matching Beads’ own merge
behavior.

```
MERGE_JSONL_SOURCES(sources):
  merged = {}  # beads_id -> issue

  for source in sources:
    for line in source.content:
      issue = parse_json(line)
      beads_id = issue.id

      if beads_id not in merged:
        # First occurrence
        merged[beads_id] = issue
        merged[beads_id]._source = source.branch
      else:
        existing = merged[beads_id]
        # LWW: newer updated_at wins
        if issue.updated_at > existing.updated_at:
          merged[beads_id] = issue
          merged[beads_id]._source = source.branch
        # If timestamps equal, prefer sync branch over main
        # (sync branch has the "true" latest state)
        elif issue.updated_at == existing.updated_at:
          if source.branch == sync_branch:
            merged[beads_id] = issue
            merged[beads_id]._source = source.branch

  return merged.values()
```

**Priority Order (when timestamps are equal):**

1. Sync branch (most authoritative for Beads data)

2. Working copy (uncommitted changes)

3. Main branch (last merged state)

**Attic preservation during import:** When multiple sources have conflicting values for
the same Beads issue, the losing version is preserved in the attic with source
information. This maintains the “no data loss” invariant even during import merges.

**Example Scenario:**

```
Main branch .beads/issues.jsonl:
  bd-a1b2: title="Fix bug", updated_at="2025-01-10T10:00:00Z"
  bd-c3d4: title="Add feature", updated_at="2025-01-09T08:00:00Z"

Sync branch .beads/issues.jsonl:
  bd-a1b2: title="Fix bug (WIP)", updated_at="2025-01-10T14:00:00Z"  # Newer!
  bd-c3d4: title="Add feature", updated_at="2025-01-09T08:00:00Z"    # Same
  bd-e5f6: title="New task", updated_at="2025-01-10T12:00:00Z"       # New!

Merged result:
  bd-a1b2: title="Fix bug (WIP)" (from sync, newer)
  bd-c3d4: title="Add feature" (from sync, same timestamp, sync preferred)
  bd-e5f6: title="New task" (from sync, only exists there)
```

**Import Output with Multi-Source:**

```bash
$ cead import --from-beads --verbose

Detecting Beads sources...
  ✓ Working copy: .beads/issues.jsonl (23 issues)
  ✓ Main branch: main:.beads/issues.jsonl (21 issues)
  ✓ Sync branch: beads-sync:.beads/issues.jsonl (25 issues)

Merging 3 sources...
  Merged: 27 unique issues
  Conflicts resolved: 4 (LWW by updated_at)
    bd-a1b2: sync > main (14:00 > 10:00)
    bd-x7y8: working > sync (16:00 > 15:00)
    ...

Importing merged issues...
  New issues:      5
  Updated:         3
  Unchanged:       19

Import complete.
```

#### 5.1.4 ID Mapping

The key to idempotent import is **stable ID mapping**. The same Beads issue must always
map to the same Ceads issue, even across multiple imports on different machines.

**Mapping storage:**

Each imported issue stores its original Beads ID in the `extensions` field:

```json
{
  "type": "is",
  "id": "is-a1b2c3",
  "title": "Fix authentication bug",
  "extensions": {
    "beads": {
      "original_id": "bd-x7y8",
      "imported_at": "2025-01-10T10:00:00Z",
      "source_file": "beads-export.jsonl"
    }
  }
}
```

**Mapping file (for performance):**

To enable O(1) lookups on large issue sets, import also maintains a mapping file:

```
.ceads-sync/mappings/beads.yml
```

```json
{
  "bd-x7y8": "is-a1b2c3",
  "bd-m5n6": "is-d4e5f6",
  "bd-p1q2": "is-g7h8i9"
}
```

This file:

- Is synced with other Ceads data on the sync branch

- Enables instant lookup of existing mappings

- Is authoritative (extensions field is for reference/debugging)

**Mapping recovery:** If the mapping file is corrupted or lost, it can be reconstructed
by scanning all issues and reading `extensions.beads.original_id`. Run:
`cead doctor --fix` to rebuild mappings from extensions data.

#### 5.1.5 Import Algorithm

```
IMPORT_BEADS(jsonl_file):
  1. Load existing mapping from .ceads-sync/mappings/beads.yml
     (create empty {} if not exists)

  2. For each line in jsonl_file:
     a. Parse Beads issue JSON
     b. beads_id = issue.id (e.g., "bd-x7y8")

     c. Look up beads_id in mapping:
        - If found: ceads_id = mapping[beads_id]
          Load existing Ceads issue for merge
        - If not found: ceads_id = generate_new_id("is-")
          Add mapping[beads_id] = ceads_id

     d. Convert Beads fields to Ceads format (see Field Mapping)

     e. Set extensions.beads.original_id = beads_id
        Set extensions.beads.imported_at = now()

     f. If existing Ceads issue:
        - Compare updated_at timestamps
        - If Beads is newer: apply merge using standard rules
        - If Ceads is newer: skip (Ceads changes preserved)
        - If same: no-op (already imported)
     g. If new issue:
        - Write new Ceads issue file

  3. Save updated mapping file

  4. Report: N new, M updated, K unchanged, J skipped (Ceads newer)

  5. Sync (unless --no-sync)
```

#### 5.1.6 Merge Behavior on Re-Import

When re-importing an issue that already exists in Ceads:

| Scenario | Behavior |
| --- | --- |
| Beads unchanged, Ceads unchanged | No-op |
| Beads updated, Ceads unchanged | Update Ceads with Beads changes |
| Beads unchanged, Ceads updated | Keep Ceads changes (skip) |
| Both updated | Merge using LWW rules, loser to attic |

**Merge uses standard issue merge rules:**

- `updated_at` determines winner for scalar fields

- Labels use union (both additions preserved)

- Description/notes use LWW with attic preservation

**Example re-import scenario:**

```
Time 0: Import bd-a1b2 → is-x1y2 (initial import)
Time 1: Agent updates bd-a1b2 in Beads (adds label "urgent")
Time 2: Human updates is-x1y2 in Ceads (changes priority to 1)
Time 3: Re-import bd-a1b2

Result: is-x1y2 has both changes:
  - Label "urgent" (from Beads, union merge)
  - Priority 1 (from Ceads, more recent updated_at wins)
```

#### 5.1.7 Handling Deletions and Tombstones

> **Canonical reference:** This section is the authoritative specification for
> tombstone/deletion handling.
> See also: §2.5.3 (Notes on tombstone status), §5.4 (Status Mapping), §5.5 (Migration
> Gotchas).

Beads uses `tombstone` status for soft-deleted issues.
On import:

| Beads Status | Ceads Behavior | Rationale |
| --- | --- | --- |
| `tombstone` (first import) | Skip by default | Don't import deleted issues |
| `tombstone` (re-import) | Set `status: closed`, add label `deleted-in-beads` | Preserve history |

**Options:**
```bash
cead import beads.jsonl --include-tombstones  # Import tombstones as closed
cead import beads.jsonl --skip-tombstones     # Skip tombstones (default)
```

#### 5.1.8 Dependency ID Translation

Beads dependencies reference Beads IDs.
On import, these must be translated:

```
Beads: { "type": "blocks", "target": "bd-m5n6" }
Ceads: { "type": "blocks", "target": "is-d4e5f6" }  # Looked up from mapping
```

**Algorithm:**

1. Import all issues first (build complete mapping)

2. Second pass: translate dependency target IDs

3. If target not in mapping: log warning, skip dependency (orphan reference)

#### 5.1.9 Import Output

```bash
$ cead import beads-export.jsonl

Importing from beads-export.jsonl...
  New issues:      23
  Updated:         5
  Unchanged:       142
  Skipped (newer): 2
  Tombstones:      3 (skipped)

Dependency translation:
  Translated: 45
  Orphaned:   1 (bd-z9a0 not found, skipped)

Import complete. Run 'cead sync' to push changes.
```

**With --dry-run:**
```bash
$ cead import beads-export.jsonl --dry-run

DRY RUN - no changes will be made

Would import from beads-export.jsonl:
  New issues:      23
    bd-a1b2 → is-??? "Fix authentication bug"
    bd-c3d4 → is-??? "Add OAuth support"
    ...
  Would update:    5
    bd-x7y8 (is-m1n2) - Beads newer by 2 hours
    ...
  Unchanged:       142
  Would skip:      2
    bd-p1q2 (is-g7h8) - Ceads newer by 1 day
```

#### 5.1.10 Migration Workflow

**Initial migration (one-time):**

```bash
# In Beads repo
bd export > beads-export.jsonl

# In target repo (may be same repo)
cead init
cead import beads-export.jsonl
git add .ceads/
git commit -m "Initialize ceads and import from beads"
cead sync
```

**Ongoing sync (transition period):**

```bash
# If agents are still using Beads occasionally
bd export > beads-export.jsonl
cead import beads-export.jsonl  # Safe to re-run

# After import, Ceads is authoritative
# New work should use cead commands
```

**Recovery (accidental Beads usage):**

```bash
# Agent accidentally used Beads commands
# Recover that work into Ceads
bd export > beads-export.jsonl
cead import beads-export.jsonl
cead sync
# Agent's work is now in Ceads
```

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
| `bd info` | `cead info` | ✅ Full | System status |
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

### 5.6 Compatibility Contract

This section defines the stability guarantees for scripts and tooling that depend on
Ceads CLI output.

**Stable (will not change without major version bump):**

- JSON output schema from `--json` flag (additive changes only)

- Exit codes: 0 = success, 1 = error, 2 = usage error

- Command names and primary flags listed in this spec

- ID format pattern: `{prefix}-{6 hex chars}`

**Stable with deprecation warnings:**

- Flag aliases (e.g., `--db` → `--dir`)

- Field renames in JSON output (old name continues to work)

**Not guaranteed stable:**

- Human-readable output formatting (column widths, colors, wording)

- Error message text

- Timing of sync operations

- Internal file formats (index.json structure)

**Beads compatibility aliases:**

These flags/behaviors are maintained for Beads script compatibility:

- `--db <path>` → `--dir <path>`

- `--type <kind>` → maps to `kind` field (not `type`)

- Display prefix `bd-` configurable via `display.id_prefix`

#### Migration Gotchas

1. **IDs change**: Beads `bd-a1b2` becomes Ceads `is-a1b2` internally

   - Set `display.id_prefix: bd` to show as `bd-a1b2`

   - Old references in commit messages won’t auto-link

2. **No daemon**: Background sync must be manual or cron-based

3. **No auto-flush**: Beads auto-syncs on write

   - Ceads syncs on `cead sync` or with `settings.auto_sync: true` in config

4. **Tombstone issues**: Decide import behavior (skip/convert/attic)

* * *

## 6. Implementation Notes

### 6.1 Performance Optimization

#### Query Index

**Optional caching layer** (`.ceads/cache/index.json`):

```typescript
// JSON-serializable index structure
interface Index {
  // Main issue lookup (object, not Map)
  issues: { [id: string]: IssueSummary };

  // Secondary indexes (arrays, not Sets)
  by_status: { [status: string]: string[] };
  by_assignee: { [assignee: string]: string[] };
  by_label: { [label: string]: string[] };

  // Freshness tracking
  last_updated: string;           // ISO8601 timestamp
  baseline_commit: string;        // Git commit hash this index was built from
}
```

> **Note:** Index uses plain objects and arrays (JSON-serializable), not Map/Set.
> Arrays are kept sorted for deterministic serialization.

**Checksum strategy:**

The index freshness is determined by comparing `baseline_commit` to the current
`ceads-sync` branch HEAD:

```bash
# Check if index is fresh
CURRENT=$(git rev-parse ceads-sync)
if [ "$CURRENT" == "$INDEX_BASELINE_COMMIT" ]; then
  # Index is fresh, use it
else
  # Index is stale, rebuild or incrementally update
  git diff --name-only $INDEX_BASELINE_COMMIT..$CURRENT
fi
```

**Rebuild strategy:**

1. Check if index exists and baseline_commit matches current sync branch HEAD

2. If stale, incrementally update by processing only changed files (via git diff)

3. If no index or baseline missing, full rebuild from all issue files

4. Store in `.ceads/cache/index.json`

5. Cache is gitignored, never synced

**Performance targets:**

- Cold start (no index): <500ms for 5,000 issues

- Warm start (index hit): <50ms for common queries

- Index rebuild: <1s for 10,000 issues

- Incremental update: <100ms for typical sync (10-50 changed files)

**Incremental operations:** Common operations like `cead list`, `cead ready`, and
`cead sync --status` use the index and diff-based updates to meet performance targets
even at scale.

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

#### Decision 6: Markdown + YAML storage

**Choice**: Markdown + YAML front matter for issue storage

**Context**: [ticket](https://github.com/wedow/ticket), TrackDown, and other tools
successfully use Markdown + YAML frontmatter.
We adopt this approach in V3.

**Prior Art Validation**:

- ticket (1400+ GitHub stars): YAML front matter + Markdown body

- TrackDown: Markdown files with structured headers

- Hugo/Jekyll: Mature tooling for YAML front matter parsing

- git-issue: Pure text format for issue tracking

**Rationale for Markdown + YAML**:

- **Human-readable**: Issues readable/editable without special tools

- **IDE integration**: Native Markdown support in all editors

- **Search integration**: ripgrep/grep work directly on issue files

- **AI-friendly**: Agents can search without parsing bloat

- **Long-form descriptions**: Rich formatting (headings, lists, code blocks)

- **Familiar format**: Developers already know Markdown + YAML

**Structured Data Handling**:

- YAML front matter contains all schema fields (structured data)

- Markdown body contains `description` and optional `## Notes` section

- Canonical serialization ensures deterministic hashing

- Schema validation via Zod after parsing

**Tradeoffs**:

- Parsing slightly more complex than JSON

- Requires YAML + Markdown parsers (vs JSON only)

- Multi-line fields need careful YAML escaping

**Mitigations**:

- Use established libraries (gray-matter, js-yaml)

- Canonical serialization rules ensure consistency

- Attic entries use pure YAML (no Markdown body needed)

#### Decision 7: Hidden worktree for sync branch

**Choice**: Use a hidden git worktree for sync branch access

**Context**: Ceads stores issues on a sync branch (`ceads-sync`) that’s separate from
the user’s working branch.
We need a way to access and search sync branch content without affecting the user’s
checkout.

**Alternatives Considered**:

1. **Isolated index (`GIT_INDEX_FILE`)**: Use git plumbing with isolated index

   - Pro: Minimal disk usage, no extra checkout

   - Con: Files not accessible to ripgrep/grep for searching

2. **Sparse checkout**: Checkout only `.ceads-sync/` directory

   - Pro: Files accessible, minimal overhead

   - Con: Pollutes user’s working directory, shows in `git status`

3. **Hidden worktree**: Separate checkout at `.ceads/.worktree/`

   - Pro: Files accessible for search, isolated from user’s work

   - Con: Additional disk space for second checkout

**Rationale for Hidden Worktree**:

- **Search integration**: ripgrep/grep work directly on issue files

- **User isolation**: Hidden in `.ceads/`, doesn’t pollute working directory

- **Git-native**: Uses standard `git worktree` mechanics

- **Clean status**: Gitignored, doesn’t appear in user’s `git status`

**Implementation Notes**:

- Worktree created at `.ceads/.worktree/`

- Worktree directory added to `.ceads/.gitignore`

- `cead init` creates worktree automatically

- Worktree kept in sync via `cead sync` commands

- Falls back to `git show` if worktree unavailable

**Tradeoffs**:

- Additional disk space (~2x issue storage)

- Worktree must be kept in sync

- Edge case: stale worktree if not synced recently

**Mitigations**:

- Search commands auto-refresh if worktree is stale

- `cead doctor` can detect/repair worktree issues

- Space overhead is minimal (issues are small files)

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
        │   ├── is-a1b2.md
        │   └── is-f14c.md
        ├── attic/                  # Conflict archive
        │   └── conflicts/
        │       └── is-a1b2/
        │           └── 2025-01-07T10-30-00Z_description.yml
        └── meta.yml               # Metadata
```

**File counts (example with 1,000 issues):**

| Location | Files | Size |
| --- | --- | --- |
| `.ceads/` | 3 | <1 KB |
| `.ceads/cache/` | 1-2 | <500 KB |
| `.ceads-sync/issues/` | 1,000 | ~2 MB |
| `.ceads-sync/attic/` | 10-50 | <100 KB |

* * *

## Appendix A: Beads to Ceads Feature Mapping

This appendix provides a comprehensive mapping between Beads and Ceads V3 Phase 1 for
migration planning and compatibility reference.

### A.1 Executive Summary

Ceads V3 Phase 1 provides CLI-level compatibility with Beads for core issue tracking
while simplifying the architecture:

| Aspect | Beads | Ceads V3 Phase 1 |
| --- | --- | --- |
| Data locations | 4 (SQLite, local JSONL, sync branch, main) | 2 (files on sync branch, config on main) |
| Storage | SQLite + JSONL | Markdown + YAML (file-per-entity) |
| Daemon | Required (recommended) | Not required |
| Agent coordination | External (Agent Mail) | Deferred to Phase 2 |
| Comments | Embedded in issue | Deferred to Phase 2 |
| Conflict resolution | 3-way merge | Content hash LWW + attic |

**Core Finding:** All essential issue tracking workflows in Beads have direct CLI
equivalents in Ceads V3 Phase 1. Advanced features (agent coordination, templates,
real-time sync) are explicitly deferred.

### A.2 CLI Command Mapping

#### A.2.1 Issue Commands (Full Parity)

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

#### A.2.2 Label Commands (Full Parity)

| Beads Command | Ceads Command | Status | Notes |
| --- | --- | --- | --- |
| `bd label add <id> <label>` | `cead label add <id> <label>` | ✅ Full | Identical |
| `bd label remove <id> <label>` | `cead label remove <id> <label>` | ✅ Full | Identical |
| `bd label list` | `cead label list` | ✅ Full | All labels in use |

Also available via update: `cead update <id> --add-label X` and `--remove-label X`

#### A.2.3 Dependency Commands (Partial - blocks only)

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

#### A.2.4 Sync Commands (Full Parity)

| Beads Command | Ceads Command | Status | Notes |
| --- | --- | --- | --- |
| `bd sync` | `cead sync` | ✅ Full | Pull then push |
| `bd sync --pull` | `cead sync --pull` | ✅ Full | Pull only |
| `bd sync --push` | `cead sync --push` | ✅ Full | Push only |
| *(no equivalent)* | `cead sync --status` | ✅ New | Show pending changes |

#### A.2.5 Maintenance Commands (Full Parity)

| Beads Command | Ceads Command | Status | Notes |
| --- | --- | --- | --- |
| `bd init` | `cead init` | ✅ Full | Identical |
| `bd info` | `cead info` | ✅ Full | System status |
| `bd doctor` | `cead doctor` | ✅ Full | Health checks |
| `bd doctor --fix` | `cead doctor --fix` | ✅ Full | Auto-fix |
| `bd stats` | `cead stats` | ✅ Full | Issue statistics |
| `bd import` | `cead import <file>` | ✅ Full | Beads JSONL import |
| `bd export` | *(not in Phase 1)* | ⏳ Phase 2 | Files are the format |
| `bd config` | `cead config` | ✅ Full | YAML config |
| `bd compact` | *(not in Phase 1)* | ⏳ Phase 2 | Memory decay |

#### A.2.6 Global Options (Full Parity)

| Beads Option | Ceads Option | Status | Notes |
| --- | --- | --- | --- |
| `--json` | `--json` | ✅ Full | JSON output |
| `--help` | `--help` | ✅ Full | Help text |
| `--version` | `--version` | ✅ Full | Version info |
| `--db <path>` | `--db <path>` | ✅ Full | Custom .ceads path |
| `--no-sync` | `--no-sync` | ✅ Full | Skip auto-sync |
| `--actor <name>` | `--actor <name>` | ✅ Full | Override actor |

### A.3 Data Model Mapping

#### A.3.1 Issue Schema

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

#### A.3.2 Status Values

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

#### A.3.3 Issue Types/Kinds

| Beads Type | Ceads Kind | Status |
| --- | --- | --- |
| `bug` | `bug` | ✅ |
| `feature` | `feature` | ✅ |
| `task` | `task` | ✅ |
| `epic` | `epic` | ✅ |
| `chore` | `chore` | ✅ |
| `message` | *(Phase 2)* | ⏳ Separate entity |
| `agent` | *(Phase 2)* | ⏳ Separate entity |

#### A.3.4 Dependency Types

| Beads Type | Ceads Type | Status |
| --- | --- | --- |
| `blocks` | `blocks` | ✅ Phase 1 |
| `related` | `related` | ⏳ Phase 2 |
| `discovered-from` | `discovered-from` | ⏳ Phase 2 |
| `parent-child` | `parent_id` field | ✅ Different model |

### A.4 Architecture Comparison

#### A.4.1 Storage

| Aspect | Beads | Ceads V3 Phase 1 |
| --- | --- | --- |
| Primary store | SQLite | Markdown + YAML files |
| Sync format | JSONL | Markdown + YAML (same as primary) |
| File structure | Single `issues.jsonl` | File per entity |
| Location | `.beads/` on main | `.ceads-sync/` on sync branch |
| Config | SQLite + various | `.ceads/config.yml` on main |

#### A.4.2 Sync

| Aspect | Beads | Ceads V3 Phase 1 |
| --- | --- | --- |
| Mechanism | SQLite ↔ JSONL ↔ git | Files ↔ git |
| Branch | Main or sync branch | Sync branch only |
| Conflict detection | 3-way (base, local, remote) | Content hash difference |
| Conflict resolution | LWW + union | LWW + union (same strategies) |
| Conflict preservation | Partial | Full (attic) |
| Daemon required | Yes (recommended) | No |

### A.5 LLM Agent Workflow Comparison

#### A.5.1 Basic Agent Loop (Full Parity)

**Beads:**
```bash
bd ready --json              # Find work
bd update <id> --status in_progress  # Claim (advisory)
# ... work ...
bd close <id> --reason "Done"  # Complete
bd sync                       # Sync
```

**Ceads V3 Phase 1:**
```bash
cead ready --json            # Find work
cead update <id> --status in_progress  # Claim (advisory)
# ... work ...
cead close <id> --reason "Done"  # Complete
cead sync                    # Sync
```

**Assessment:** ✅ Identical workflow.
Claims are advisory in both (no enforcement).

#### A.5.2 Creating Linked Work (Partial Parity)

**Beads:**
```bash
bd create "Found bug" -t bug -p 1 --deps discovered-from:<id> --json
```

**Ceads V3 Phase 1:**
```bash
# Only blocks dependency supported in Phase 1
cead create "Found bug" -t bug -p 1 --parent <id> --json
# Or wait for Phase 2 for discovered-from
```

**Assessment:** ⚠️ `discovered-from` dependency not available in Phase 1. Use `--parent`
or wait for Phase 2.

#### A.5.3 Migration Workflow

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

### A.6 Phase 1 Parity Summary

| Category | Parity | Notes |
| --- | --- | --- |
| Issue CRUD | ✅ Full | All core operations |
| Labels | ✅ Full | Add, remove, list |
| Dependencies | ⚠️ Partial | Only `blocks` type |
| Sync | ✅ Full | Pull, push, status |
| Maintenance | ✅ Full | Init, doctor, stats, config |
| Import | ✅ Full | Beads JSONL + multi-source |

### A.7 Deferred to Phase 2+

| Category | Priority | Notes |
| --- | --- | --- |
| Agent registry | High | Built-in coordination |
| Comments/Messages | High | Separate entity type |
| `related` deps | Medium | Additional dep type |
| `discovered-from` deps | Medium | Additional dep type |
| Daemon | Medium | Optional background sync |
| GitHub bridge | Low | External integration |
| Templates | Low | Reusable workflows |

### A.8 Migration Compatibility

- **CLI:** 95%+ compatible for core workflows

- **Data:** Full import from Beads JSONL (including multi-source from main + sync
  branch)

- **Display:** Configurable ID prefix (`bd-xxxx` vs `cd-xxxx`)

- **Behavior:** Advisory claims, manual sync (no daemon)

**Overall Assessment:** Ceads V3 Phase 1 provides sufficient feature parity for LLM
agents to migrate from Beads for basic issue tracking workflows.
The simpler architecture (no SQLite, no daemon, file-per-entity) addresses the key pain
points identified in the Beads experience.

* * *

## Appendix B: Beads Commands NOT Included in Phase 1

This appendix provides a comprehensive list of Beads commands and features that are
explicitly **not** included in Ceads V3 Phase 1.

### B.1 Daemon Commands

These commands are not applicable since Ceads has no daemon:

| Beads Command | Why Not Included |
| --- | --- |
| `bd daemon start` | No daemon architecture |
| `bd daemon stop` | No daemon architecture |
| `bd daemon status` | No daemon architecture |
| `bd daemons list` | No daemon architecture |
| `bd daemons health` | No daemon architecture |
| `bd daemons killall` | No daemon architecture |
| `bd daemons logs` | No daemon architecture |
| `bd daemons restart` | No daemon architecture |

### B.2 Molecule/Workflow Commands

Workflow orchestration features are deferred to Phase 2+:

| Beads Command | Why Not Included |
| --- | --- |
| `bd mol pour` | Template instantiation - Phase 2+ |
| `bd mol wisp` | Ephemeral work tracking - Phase 2+ |
| `bd mol bond` | Workflow composition - Phase 2+ |
| `bd mol squash` | Compress to digest - Phase 2+ |
| `bd mol burn` | Discard wisp - Phase 2+ |
| `bd mol wisp list` | Wisp management - Phase 2+ |
| `bd mol wisp gc` | Garbage collection - Phase 2+ |
| `bd mol distill` | Extract template - Phase 2+ |
| `bd mol show` | Template inspection - Phase 2+ |
| `bd formula list` | Template listing - Phase 2+ |

### B.3 Agent Coordination Commands

Real-time agent coordination is deferred:

| Beads Command | Why Not Included |
| --- | --- |
| `bd agent register` | Agent registry - Phase 2+ |
| `bd agent heartbeat` | Presence tracking - Phase 2+ |
| `bd agent claim` | Atomic claims - Phase 2+ |
| Agent Mail | Real-time messaging - Phase 2+ |

### B.4 Advanced Data Operations

| Beads Command | Why Not Included |
| --- | --- |
| `bd compact` | Memory decay - Phase 2 |
| `bd compact --auto` | AI-powered compaction - Phase 2 |
| `bd admin cleanup` | Bulk deletion - Phase 2 |
| `bd duplicates` | Duplicate detection - not planned |
| `bd merge` | Merge duplicates - not planned |
| `bd rename-prefix` | ID prefix rename - low priority |

### B.5 Comment Commands

Comments are a separate entity type in Phase 2:

| Beads Command | Why Not Included |
| --- | --- |
| `bd comment add` | Comments entity - Phase 2+ |
| `bd comment list` | Comments entity - Phase 2+ |
| `bd comments show` | Comments entity - Phase 2+ |

### B.6 Editor Integration Commands

| Beads Command | Why Not Included |
| --- | --- |
| `bd setup claude` | Editor hooks - not planned |
| `bd setup cursor` | Editor rules - not planned |
| `bd setup aider` | Editor config - not planned |
| `bd setup factory` | AGENTS.md - not planned |
| `bd edit` | Interactive edit (human only) - not planned |

### B.7 Additional Dependency Types

Phase 1 only supports `blocks`:

| Beads Type | Why Not Included |
| --- | --- |
| `related` | Soft linking - Phase 2 |
| `discovered-from` | Provenance tracking - Phase 2 |
| `waits-for` | Fanout gates - Phase 2+ |
| `conditional-blocks` | Error handling - Phase 2+ |

### B.8 State Label Commands

| Beads Command | Why Not Included |
| --- | --- |
| `bd state` | Label-as-cache pattern - not planned |
| `bd set-state` | Label-as-cache pattern - not planned |

### B.9 Other Commands

| Beads Command | Why Not Included |
| --- | --- |
| `bd prime` | Beads-specific priming - not applicable |
| `bd audit` | Audit trail command - use git log |
| `bd activity` | Activity feed - not planned |
| `bd context` | Context management - not planned |
| `bd migrate` | SQLite migration - not applicable |
| `bd export` | Files are the format - Phase 2 (JSONL export) |
| `bd cook` | Internal command - not applicable |

### B.10 Global Flags Not Supported

| Beads Flag | Why Not Included |
| --- | --- |
| `--no-daemon` | No daemon to disable |
| `--no-auto-flush` | No auto-flush mechanism |
| `--no-auto-import` | Different sync model |
| `--sandbox` | Ceads is always "sandbox safe" |
| `--allow-stale` | Different staleness model |

### B.11 Issue Types/Statuses Not Supported

| Beads Value | Why Not Included |
| --- | --- |
| `issue_type: message` | Messages are Phase 2+ |
| `issue_type: agent` | Agent registry is Phase 2+ |
| `issue_type: role` | Advanced orchestration |
| `issue_type: convoy` | Advanced orchestration |
| `issue_type: molecule` | Workflow templates |
| `issue_type: gate` | Async gates |
| `issue_type: merge-request` | External integration |
| `status: pinned` | Convert to label on import |
| `status: hooked` | Convert to label on import |

* * *

## 8. Open Questions

The following items from the GPT-5 Pro design review require further discussion before
implementation. See `ceads-design-v2-phase1-tracking.md` for full context.

### 8.1 Git Operations

**V2-004: Remote vs local branch reference ambiguity**

After `git fetch origin ceads-sync`, should reads use `origin/ceads-sync` (remote
tracking) or local `ceads-sync`? Current spec uses `ceads-sync:` in examples, which may
read stale data if not updated after fetch.

**Options:**

1. Always read from `origin/ceads-sync` after fetch

2. Update local `ceads-sync` ref after fetch, then read from it

3. Document both patterns with guidance on when to use each

### 8.2 Timestamp and Ordering

**V2-012: Clock skew assumptions**

LWW merge relies on `updated_at` timestamps.
Clock skew between machines can cause counterintuitive winners.
The attic preserves losers, but UX may suffer if the “wrong” version consistently wins.

**Options:**

1. Add a note acknowledging the limitation, rely on attic for recovery

2. Implement Hybrid Logical Clocks (HLC) in Phase 2

3. Add optional “prefer remote” or “prefer local” config override

### 8.3 Mapping File Structure

**V2-016: Single mapping file as potential conflict hotspot**

`.ceads-sync/mappings/beads.yml` could see conflicts if multiple nodes import
concurrently (though this is rare).

**Options:**

1. Accept single file (low risk, concurrent imports are rare)

2. File-per-beads-id mappings (consistent with file-per-entity pattern)

3. Define merge semantics for mapping file (union of keys)

### 8.4 ID Length

**Idea 2: Longer internal IDs for long-term scaling**

Current 6-hex-char IDs (24 bits, 16.7M possibilities) are sufficient for Phase 1. Should
we extend to 8 chars (32 bits, 4B possibilities) for future-proofing?

**Considerations:**

- 6 chars: More readable, sufficient for most projects

- 8 chars: More headroom, matches git short-hash conventions

- Could migrate later by adding chars (old IDs remain valid)

### 8.5 Future Extension Points

**Idea 7: Reserve directory structure for Phase 2 bridges**

Should Phase 1 reserve `.ceads/cache/outbox/` and `.ceads/cache/inbox/` directories for
future bridge runtime use?

**Options:**

1. Reserve now (empty dirs, documented for Phase 2)

2. Add when needed (avoid premature structure)

### 8.6 Issue Storage Location

**Hybrid sync branch vs main branch storage**

The current design stores all issues on the `ceads-sync` branch, keeping main branch
clean. However, there may be use cases where some issues should live on the main branch
(e.g., for visibility in PRs, code review context) while others remain on the sync
branch.

**Possible configurations:**

1. **All sync branch** (current design): All issues on `ceads-sync`, main branch stays
   clean. Simplest model, no reconciliation needed.

2. **All main branch**: Issues stored in `.ceads` and/or other folders on main or
   development branches, tracked with code.
   Simpler git model but adds more noise to commit history and creates merge
   complexities.

3. **Status-based split**: Active issues (open, in_progress) on main or development
   branches for visibility; closed/archived issues moved to sync branch automatically.
   Ceads enforces the invariant.
   Challenge: What happens when working on different feature branches?
   Need to think through sync behavior.

4. **Gitignored working copies**: Sync branch remains authoritative and complete.
   Allow gitignored copies in a working directory (e.g., `.ceads/local/`) for convenient
   reading and editing.
   A `cead save` command would push edits from the gitignored copy to the sync branch.
   This avoids reconciliation since sync branch is always the source of truth.

**Considerations:**

- Reconciliation complexity: Having issues in multiple locations creates sync challenges
  (the pain point that motivated moving away from Beads’ 4-location model)

- Branch-specific issues: How do issues get edited and merged on main and feature
  branches? Do they diverge?
  Get merged?

- Visibility vs cleanliness tradeoff: Main branch storage provides GitHub visibility but
  adds noise to diffs and history

**Recommendation:** Defer to Phase 2. The gitignored working copy approach (Option 4)
seems promising as it preserves the single-source-of-truth model while adding
convenience.

* * *

**End of Ceads V3 Phase 1 Design Specification**
