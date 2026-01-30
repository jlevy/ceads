# tbd Design Specification

Task management, spec-driven planning, and instant knowledge injection for AI coding
agents.

**Author:** Joshua Levy (github.com/jlevy) and various LLMs

**Status**: Draft

**Date**: January 2025

* * *

## Table of Contents

- [tbd Design Specification](#tbd-design-specification)
  - [Table of Contents](#table-of-contents)
  - [1. Introduction](#1-introduction)
    - [1.1 What is tbd?](#11-what-is-tbd)
    - [1.2 When to Use tbd vs Beads](#12-when-to-use-tbd-vs-beads)
    - [1.3 Why Replace Beads?
      (Architecture Comparison)](#13-why-replace-beads-architecture-comparison)
    - [1.4 Design Goals](#14-design-goals)
    - [1.5 Design Principles](#15-design-principles)
    - [1.6 Non-Goals](#16-non-goals)
    - [1.7 Layer Overview](#17-layer-overview)
  - [2. File Layer](#2-file-layer)
    - [2.1 Overview](#21-overview)
      - [Markdown + YAML Front Matter Format](#markdown--yaml-front-matter-format)
      - [Canonical Serialization](#canonical-serialization)
      - [Atomic File Writes](#atomic-file-writes)
    - [2.2 Directory Structure](#22-directory-structure)
      - [On Main Branch (all working branches)](#on-main-branch-all-working-branches)
      - [On `tbd-sync` Branch](#on-tbd-sync-branch)
    - [2.3 Hidden Worktree Model](#23-hidden-worktree-model)
      - [Worktree Setup](#worktree-setup)
      - [Worktree Gitignore](#worktree-gitignore)
      - [Accessing Issues via Worktree](#accessing-issues-via-worktree)
      - [Worktree Lifecycle](#worktree-lifecycle)
      - [Worktree Initialization Decision Tree](#worktree-initialization-decision-tree)
      - [Worktree Health States](#worktree-health-states)
      - [Path Terminology and Resolution](#path-terminology-and-resolution)
      - [Worktree Error Classes](#worktree-error-classes)
    - [2.4 Entity Collection Pattern](#24-entity-collection-pattern)
      - [Directory Layout](#directory-layout)
      - [Adding New Entity Types (Future)](#adding-new-entity-types-future)
    - [2.5 ID Generation](#25-id-generation)
      - [ID Generation Algorithm](#id-generation-algorithm)
      - [ID Mapping](#id-mapping)
      - [ID Resolution (CLI)](#id-resolution-cli)
      - [File Naming](#file-naming)
      - [Display Format](#display-format)
    - [2.6 Schemas](#26-schemas)
      - [2.6.1 Common Types](#261-common-types)
      - [2.6.2 BaseEntity](#262-baseentity)
      - [2.6.3 IssueSchema](#263-issueschema)
      - [2.6.4 ConfigSchema](#264-configschema)
      - [2.6.5 MetaSchema](#265-metaschema)
      - [2.6.6 LocalStateSchema](#266-localstateschema)
      - [2.6.7 AtticEntrySchema](#267-atticentryschema)
    - [2.7 Relationship Types](#27-relationship-types)
      - [2.7.1 Relationship Model Overview](#271-relationship-model-overview)
      - [2.7.2 Parent-Child Relationships](#272-parent-child-relationships)
      - [2.7.3 Dependency Relationships](#273-dependency-relationships)
      - [2.7.4 Visualization Commands](#274-visualization-commands)
      - [2.7.5 Comparison with Beads](#275-comparison-with-beads)
      - [2.7.6 Future Dependency Types](#276-future-dependency-types)
      - [2.7.7 Future: Transitive Blocking Option](#277-future-transitive-blocking-option)
  - [3. Git Layer](#3-git-layer)
    - [3.1 Overview](#31-overview)
    - [3.2 Sync Branch Architecture](#32-sync-branch-architecture)
      - [Files Tracked on Main Branch](#files-tracked-on-main-branch)
      - [.tbd/.gitignore Contents](#tbdgitignore-contents)
      - [Files Tracked on tbd-sync Branch](#files-tracked-on-tbd-sync-branch)
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
    - [4.1.1 Initialization Requirements](#411-initialization-requirements)
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
      - [Status](#status)
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
      - [5.1.4 ID Mapping and Preservation](#514-id-mapping-and-preservation)
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
    - [6.4 Installation and Agent Integration](#64-installation-and-agent-integration)
      - [6.4.1 Installation Methods](#641-installation-methods)
      - [6.4.2 Claude Code Integration](#642-claude-code-integration)
      - [6.4.3 The `tbd prime` Command](#643-the-tbd-prime-command)
      - [6.4.4 Other Editor Integrations](#644-other-editor-integrations)
      - [6.4.5 Cloud Environment Bootstrapping](#645-cloud-environment-bootstrapping)
  - [7. Appendices](#7-appendices)
    - [7.1 Design Decisions](#71-design-decisions)
      - [Decision 1: File-per-entity vs JSONL](#decision-1-file-per-entity-vs-jsonl)
      - [Decision 2: No daemon required](#decision-2-no-daemon-required)
      - [Decision 3: Sync branch instead of main](#decision-3-sync-branch-instead-of-main)
      - [Decision 4: Dual ID system (ULID + short base36)](#decision-4-dual-id-system-ulid--short-base36)
      - [Decision 5: Only “blocks” dependencies](#decision-5-only-blocks-dependencies)
      - [Decision 6: Markdown + YAML storage](#decision-6-markdown--yaml-storage)
      - [Decision 7: Hidden worktree for sync branch](#decision-7-hidden-worktree-for-sync-branch)
    - [7.2 Future Enhancements](#72-future-enhancements)
      - [Additional Dependency Types (High Priority)](#additional-dependency-types-high-priority)
      - [Ripgrep-Based Search (Performance)](#ripgrep-based-search-performance)
      - [Agent Registry](#agent-registry)
      - [Comments/Messages](#commentsmessages)
      - [GitHub Bridge](#github-bridge)
      - [Real-time Coordination](#real-time-coordination)
      - [Workflow Automation](#workflow-automation)
      - [Time Tracking](#time-tracking)
    - [7.3 File Structure Reference](#73-file-structure-reference)
  - [Appendix A: Beads to tbd Feature Mapping](#appendix-a-beads-to-tbd-feature-mapping)
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
    - [A.6 Parity Summary](#a6-parity-summary)
    - [A.7 Deferred Features](#a7-deferred-features)
    - [A.8 Migration Compatibility](#a8-migration-compatibility)
  - [Appendix B: Beads Commands Not Included](#appendix-b-beads-commands-not-included)
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
    - [8.1 Actor System Design](#81-actor-system-design)
    - [8.2 Git Operations](#82-git-operations)
    - [8.2 Timestamp and Ordering](#82-timestamp-and-ordering)
    - [8.3 Mapping File Structure](#83-mapping-file-structure)
    - [8.4 ID Length](#84-id-length)
    - [8.5 Future Extension Points](#85-future-extension-points)
    - [8.6 Issue Storage Location](#86-issue-storage-location)
    - [8.7 External Issue Tracker Linking](#87-external-issue-tracker-linking)

* * *

## 1. Introduction

### 1.1 What is tbd?

**tbd combines task management, spec-driven planning, and instant knowledge injection
for AI coding agents.**

tbd ("To Be Done" or “TypeScript Beads”) is a git-native issue tracker that stores
issues as Markdown files with YAML frontmatter on a dedicated sync branch, enabling
conflict-free collaboration without daemons or databases.
It also bundles spec-driven workflows, reusable workflow shortcuts, and a curated
knowledge base of engineering best practices that agents can inject into their context
on demand.

tbd provides **three integrated capabilities**:

1. **Task tracking (beads)** — Git-native issues, bugs, epics, and dependencies that
   persist across sessions.
   This alone is a step change in what agents can do.
2. **Spec-driven planning** — Workflows for writing specs, breaking them into issues,
   and implementing systematically.
3. **Instant knowledge injection** — 17+ detailed guideline docs covering TypeScript,
   Python, Convex, monorepo architecture, TDD, and more — injected into the agent’s
   context on demand via shortcuts, guidelines, and templates.

The **issue tracking layer** has four core principles:

- **Durable storage in git** — Issues are version-controlled and distributed via
  standard git
- **Works in almost any environment** — No daemon, no SQLite, no file locking issues on
  network drives
- **Simple, self-documenting CLI** — Designed for both AI agents and humans
- **Transparent internal format** — Markdown/YAML files that are debuggable and friendly
  to other tooling

It does *not* aim to be a full solution for real-time agent coordination.
Git works best when latency is seconds, not milliseconds, and volume is thousands of
issues, not millions.

That said, it may be the base for future coordination layers.
Real-time agent coordination (such as used by
[Agent Mail](https://github.com/Dicklesworthstone/mcp_agent_mail),
[Gas Town](https://github.com/steveyegge/gastown)) is a separate problem—one that can be
layered on top of tbd or handled by other tools.

**Key characteristics:**

- **Drop-in replacement**: Compatible with core
  [Beads](https://github.com/steveyegge/beads) CLI commands and workflows (have agents
  use `tbd` instead of `bd`)

- **Simpler architecture**: No daemon changing your `.beads` directory, no SQLite and
  associated file locking

- **Git-native**: Uses a dedicated sync branch for coordination data

- **Human-readable format**: Markdown + YAML front matter - directly viewable and
  editable in any text editor

- **File-per-entity**: Each issue is a separate `.md` file for fewer merge conflicts

- **Searchable**: Hidden worktree enables search across all issues (manual ripgrep also
  works)

- **Reliable sync**: Git-based conflict detection with field-level LWW merge and attic
  preservation

- **Cross-environment**: Works on local machines, CI, cloud sandboxes, network
  filesystems

**Related Projects:**

- [Beads](https://github.com/steveyegge/beads) — The original git-backed issue tracker
  tbd is designed to replace
- [Agent Mail](https://github.com/Dicklesworthstone/mcp_agent_mail) — Real-time agent
  messaging via MCP (complementary to tbd for coordination)
- [Gas Town](https://github.com/steveyegge/gastown) — Multi-agent orchestration platform
  (complementary to tbd for real-time coordination)
- [ticket](https://github.com/wedow/ticket) — Bash-based Markdown+YAML tracker (~1900
  tickets in production)
- [git-bug](https://github.com/git-bug/git-bug) — Issues stored as git objects
- [git-issue](https://github.com/dspinellis/git-issue) — Shell-based with optional
  GitHub sync

### 1.2 When to Use tbd vs Beads

tbd and Beads serve different use cases:

**Use tbd when:**

| Scenario | Why tbd |
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

| Aspect | tbd | Beads |
| --- | --- | --- |
| Architecture | 2 locations (files + sync branch) | 4 locations (SQLite, JSONL, sync, main) |
| Daemon | Not required | Required for real-time sync |
| Storage | Markdown + YAML files | SQLite + JSONL |
| Coordination | Advisory claims, polling | Atomic claims, real-time |
| Workflow templates | Not supported | Molecules, wisps, protos |
| Agent messaging | Not supported | Agent Mail |
| Debugging | Inspect files directly | Requires SQLite queries |

**tbd is NOT:**

- A real-time coordination system for multiple agents working simultaneously

- A replacement for Beads’ advanced orchestration features (molecules, wisps, formulas)

- A replacement for Agent Mail or other real-time messaging layers

- A workflow automation engine with templates

For advanced coordination needs, continue using Beads or wait for future tbd versions.

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

**tbd Solutions:**

- **2-location data**: Config on main branch, entities on sync branch

- **No daemon required**: Simple CLI tool, optional background sync

- **Hidden worktree**: Managed worktree for sync branch access (also enables manual
  ripgrep)

- **File-per-entity**: Parallel creation has zero conflicts

- **Transparent state**: Everything is inspectable Markdown files with YAML metadata

- **Network-safe**: Atomic file writes, no database locks

**Related Work:**

tbd builds on lessons from the git-native issue tracking ecosystem:

- **[ticket](https://github.com/wedow/ticket)**: An elegantly simple Beads alternative
  implemented as a single bash script (~~900 lines) with Markdown + YAML frontmatter
  storage. Ticket demonstrates that simplicity and minimal dependencies (bash +
  coreutils) can outperform complex architectures—it successfully manages ~~1,900
  tickets in production and provides a `migrate-beads` command for smooth transitions.
  The key insight: “You don’t need to index everything with SQLite when you have awk.”
  tbd shares this philosophy while adding TypeScript implementation, stronger conflict
  resolution, and cross-platform reliability.

- **[git-bug](https://github.com/git-bug/git-bug)**: Stores issues as git objects,
  demonstrating git-native tracking without external files

- **[git-issue](https://github.com/dspinellis/git-issue)**: Shell-based issue tracker
  with optional GitHub sync

- **[beans](https://github.com/hmans/beans)**: Another minimalist git-friendly tracker

The common thread: **simplicity, no background services, git for distribution**. tbd
builds on these proven patterns, adding multi-environment sync and conflict resolution.

### 1.4 Design Goals

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

**Design goals:**

1. **Beads CLI compatibility**: Existing workflows and scripts work with minimal changes
   for the most common beads commands

2. **No data loss**: Conflicts preserve both versions via attic mechanism

3. **Works anywhere**: Just `npm install -g get-tbd` anywhere: local dev, CI, cloud IDEs
   (Claude Code, Codespaces), network filesystems

4. **Simple architecture**: Easy to understand, debug, and maintain

5. **Performance**: <50ms for common operations on 5,000-10,000 issues

6. **Cross-platform**: macOS, Linux, Windows without platform-specific code

7. **Easy migration**: `tbd import <beads-export.jsonl>` or `tbd import --from-beads`
   converts existing Beads databases

### 1.5 Design Principles

1. **Simplicity first**: Prefer boring, well-understood approaches over clever
   optimization

2. **Files as truth**: Markdown + YAML files on disk are the canonical state

3. **Git for sync**: Standard git commands handle all distribution

4. **No required daemon**: CLI-first, background services optional

5. **Debuggable by design**: Every state change is visible in files and git history

6. **Progressive enhancement**: Core works standalone, bridges/UI are optional layers

### 1.6 Non-Goals

Explicitly deferred to future versions:

- Real-time presence/heartbeats

- Atomic claim enforcement

- GitHub bidirectional sync

- Slack/Discord integration

- TUI/GUI interfaces

- Agent messaging beyond issue comments

- Workflow automation

- Time tracking

- Custom fields

**Rationale**: Ship a small, reliable core first; add complexity only when proven
necessary.

### 1.7 Layer Overview

tbd has three layers:

```
┌─────────────────────────────────────────────────────────────────┐
│                        CLI Layer                                 │
│                        User/agent interface                      │
│   tbd <command> [args] [options]                               │
│   Beads-compatible commands                                     │
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
│   .tbd/config.yml │ .tbd/data-sync/*.md │ Zod schemas              │
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
id: is-01hx5zzkbkactav9wevgemmvrz
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
  - target: is-01hx5zzkbkbctav9wevgemmvrz
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

> **Note:** The example above shows fields in a human-friendly logical order for
> readability. Actual files use canonical serialization (alphabetical key ordering) as
> specified below.

#### Canonical Serialization

For consistent git diffs and potential future caching, we use deterministic
serialization:

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
.tbd/data-sync/** text eol=lf
```

> **Why canonical format?** Deterministic serialization ensures:
> 1. Git diffs show only actual content changes (no spurious whitespace/ordering noise)
> 2. Testing is reliable (same input produces same output)
> 3. Future caching/deduplication can use content hashes if needed

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

**Cleanup:** On startup, remove orphaned `.tmp.*` files in tbd directories that are
**older than 1 hour**. This threshold prevents race conditions where one process creates
a temp file while another is cleaning up.
Alternatively, include `node_id` in temp file names and only cleanup files matching the
current node’s prefix.

### 2.2 Directory Structure

tbd uses three directory locations:

- **`.tbd/`** on main branch: Configuration (tracked) + installed docs (gitignored)

- **`.tbd/data-sync-worktree/`** hidden worktree: Checkout of `tbd-sync` branch for
  search

- **`.tbd/data-sync/`** on `tbd-sync` branch: Synced entities and attic

#### On Main Branch (all working branches)

```
.tbd/
├── config.yml              # Project configuration (tracked)
├── .gitignore              # Ignores docs/, state.yml, worktree, data-sync (tracked)
├── state.yml               # Per-node sync state (gitignored)
│
├── docs/                   # Gitignored - installed documentation (regenerated on setup)
│   ├── shortcuts/
│   │   ├── system/         # Core docs (skill.md, shortcut-explanation.md)
│   │   └── standard/       # Workflow shortcuts (new-plan-spec.md, etc.)
│   ├── guidelines/         # Coding rules and best practices
│   └── templates/          # Document templates
│
└── data-sync-worktree/     # Gitignored - hidden worktree
    └── (checkout of tbd-sync branch)
        └── .tbd/
            └── data-sync/
                ├── issues/
                │   ├── is-a1b2c3.md
                │   └── is-f14c3d.md
                └── ...
```

#### On `tbd-sync` Branch

```
.tbd/
└── data-sync/
    ├── issues/                 # Issue entities (Markdown)
    │   ├── is-01hx5zzkbkactav9wevgemmvrz.md
    │   └── is-01hx5zzkbkbctav9wevgemmvrz.md
    ├── attic/                  # Conflict archive
    │   └── conflicts/
    │       └── is-01hx5zzkbkactav9wevgemmvrz/
    │           └── 2025-01-07T10-30-00Z_description.md
    ├── mappings/               # ID mappings
    │   └── ids.yml            # Short ID → ULID mapping (includes preserved import IDs)
    └── meta.yml               # Metadata (schema version)
```

> **Future: Simple Mode** — For users who don’t need multi-machine sync, tbd could
> support a “simple mode” where `data-sync/` is committed directly to main instead of
> using a worktree. This would be enabled by removing `data-sync` from `.tbd/.gitignore`.
> Not implemented in V1, but the naming structure supports this future option.

**Why this structure?**

- Config on main versions with your code

- Synced data on separate branch avoids merge conflicts on working branches

- Local docs and state are gitignored, never synced

- File-per-entity enables parallel operations without conflicts

- **Hidden worktree enables fast search** via ripgrep/grep

### 2.3 Hidden Worktree Model

tbd maintains a **hidden git worktree** at `.tbd/data-sync-worktree/` that checks out
the `tbd-sync` branch.
This provides:

1. **Fast search**: ripgrep can search all issues without git plumbing commands

2. **Direct file access**: Read issues without `git show` overhead

3. **Isolated from main**: Doesn’t pollute working directory or affect main branch

4. **Automatic updates**: Updated on `tbd sync` operations

#### Worktree Setup

Created automatically by `tbd init` or first `tbd sync`:

```bash
# Create hidden worktree (done by tbd internally)
git worktree add .tbd/data-sync-worktree tbd-sync

# Or if tbd-sync doesn't exist yet
git worktree add .tbd/data-sync-worktree --orphan tbd-sync
```

**Key properties:**

- **Attached to sync branch**: Worktree is checked out to `tbd-sync` branch so commits
  update the branch ref.
  This ensures `git push` operations can detect new commits.
  If the worktree becomes detached (from old tbd versions), it’s automatically repaired
  before commits.

- **Hidden location**: Inside `.tbd/` which is partially gitignored

- **Safe updates**: `tbd sync` does `git -C .tbd/data-sync-worktree pull` after push

#### Worktree Gitignore

The `.tbd/.gitignore` must include:

```gitignore
# Installed documentation (regenerated on setup)
docs/

# Hidden worktree for tbd-sync branch
data-sync-worktree/

# Data sync directory (only exists in worktree)
data-sync/

# Local state
state.yml

# Local backups (corrupted worktrees, migrated data)
backups/
```

> **Note:** `data-sync/` is gitignored to support potential future “simple mode” where
> issues could be stored directly on main without a worktree.
> In normal operation, `data-sync/` only exists inside the worktree checkout.
> 
> **Note:** `backups/` on the main branch is for local backups only (corrupted
> worktrees, data migrations).
> This is different from `.tbd/data-sync/attic/` on the sync branch which stores merge
> conflict losers.

#### Accessing Issues via Worktree

```bash
# Files are directly accessible
cat .tbd/data-sync-worktree/.tbd/data-sync/issues/is-a1b2c3.md

# ripgrep search across all issues
rg "authentication" .tbd/data-sync-worktree/.tbd/data-sync/issues/

# List all issues
ls .tbd/data-sync-worktree/.tbd/data-sync/issues/
```

#### Worktree Lifecycle

| Operation | Worktree Action |
| --- | --- |
| `tbd init` | Create worktree if tbd-sync exists |
| `tbd sync --pull` | `git -C data-sync-worktree pull origin tbd-sync` |
| `tbd sync --push` | Update worktree after successful push |
| `tbd doctor` | Verify worktree health, repair if needed |
| Repo clone | Worktree created on first tbd command |

**Invariant:** The hidden worktree at `.tbd/data-sync-worktree/` always reflects the
current state of the `tbd-sync` branch after sync operations.

#### Worktree Initialization Decision Tree

When any `tbd` command runs, it must ensure the worktree is initialized.
The logic depends on the repository state:

```
START: Any tbd command
    │
    ├─ Does .tbd/ directory exist?
    │   ├─ NO → Run `tbd init` first (error: "Not a tbd repository")
    │   └─ YES ↓
    │
    ├─ Does .tbd/data-sync-worktree/ exist and contain valid checkout?
    │   ├─ YES → Worktree ready, proceed with command
    │   └─ NO ↓
    │
    ├─ Does tbd-sync branch exist (local or remote)?
    │   ├─ YES (local) → git worktree add .tbd/data-sync-worktree tbd-sync
    │   ├─ YES (remote only) → git fetch origin tbd-sync
    │   │                      git worktree add .tbd/data-sync-worktree tbd-sync
    │   └─ NO → This is a fresh tbd init, create orphan worktree:
    │           git worktree add .tbd/data-sync-worktree --orphan tbd-sync
    │           (Initialize .tbd/data-sync/ structure in worktree)
    │
    └─ Worktree ready, proceed with command
```

**Scenarios:**

| Repository State | Worktree Action |
| --- | --- |
| Fresh `tbd init` | Create orphan worktree with empty .tbd/data-sync/ |
| Clone of existing tbd repo | Fetch remote, create worktree from origin/tbd-sync |
| Existing local worktree corrupted | `tbd doctor --fix` removes and recreates |
| Worktree exists but stale | `tbd sync` updates to latest commit |

#### Worktree Health States

The worktree can be in one of four states, detected by `checkWorktreeHealth()`:

| State | Description | Detection | Recovery |
| --- | --- | --- | --- |
| `valid` | Healthy, ready to use | Directory exists, `.git` file valid, not prunable | None needed |
| `missing` | Directory doesn't exist | `!exists(.tbd/data-sync-worktree/)` | Create from local or remote branch |
| `prunable` | Directory deleted but git still tracks it | `git worktree list --porcelain` shows prunable | `git worktree prune`, then recreate |
| `corrupted` | Directory exists but invalid | Missing `.git` file or invalid gitdir pointer | **Backup to .tbd/backups/**, then recreate |

**Safety: Backup before removal**

A corrupted worktree may still contain uncommitted issue data.
Before removing, ALWAYS back it up to prevent data loss:

```bash
# Backup corrupted worktree before removal
mv .tbd/data-sync-worktree .tbd/backups/corrupted-worktree-backup-$(date +%Y%m%d-%H%M%S)
```

The backup is placed in `.tbd/backups/` which is gitignored (see §3.6), preserving the
data for manual recovery while not polluting the repository.

**Detection algorithm:**

```typescript
async function checkWorktreeHealth(baseDir: string): Promise<{
  healthy: boolean;
  status: 'valid' | 'missing' | 'prunable' | 'corrupted';
  details?: string;
}> {
  const worktreePath = join(baseDir, '.tbd/data-sync-worktree');

  // Check directory exists
  if (!await pathExists(worktreePath)) {
    return { healthy: false, status: 'missing' };
  }

  // Check .git file exists and is valid
  const gitFile = join(worktreePath, '.git');
  if (!await pathExists(gitFile)) {
    return { healthy: false, status: 'corrupted', details: 'Missing .git file' };
  }

  // Check git worktree list for prunable status
  const worktreeList = await git('worktree', 'list', '--porcelain');
  if (worktreeList.includes('prunable')) {
    return { healthy: false, status: 'prunable', details: 'Git reports prunable' };
  }

  return { healthy: true, status: 'valid' };
}
```

#### Path Terminology and Resolution

**Critical distinction:**

| Term | Path | Purpose |
| --- | --- | --- |
| **Worktree path** | `.tbd/data-sync-worktree/.tbd/data-sync/` | **Production path** — inside hidden worktree checkout |
| **Direct path** | `.tbd/data-sync/` | **Test-only path** — gitignored on main, should NEVER contain data in production |

**Invariant:** In production, the worktree path is the ONLY correct path for issue data.
The direct path exists ONLY for test fixtures that don’t use git.

**Path resolution semantics:**

```typescript
async function resolveDataSyncDir(
  baseDir: string,
  options?: { allowFallback?: boolean; repair?: boolean }
): Promise<string> {
  const worktreePath = join(baseDir, '.tbd/data-sync-worktree/.tbd/data-sync');

  // Check if worktree exists
  if (await pathExists(worktreePath)) {
    return worktreePath;
  }

  // Attempt repair if requested
  if (options?.repair) {
    const result = await initWorktree(baseDir);
    if (result.success) {
      return worktreePath;
    }
  }

  // Only allow fallback in test mode
  if (options?.allowFallback) {
    return join(baseDir, '.tbd/data-sync');
  }

  // Fail with clear error — NEVER silently fall back in production
  throw new WorktreeMissingError(
    'Worktree not found at .tbd/data-sync-worktree/. ' +
    'Run `tbd doctor --fix` to repair.'
  );
}
```

**Rules:**

1. Production code MUST call `resolveDataSyncDir()` without `allowFallback`
2. Only test code may use `allowFallback: true`
3. If `.tbd/data-sync/issues/` contains data on main branch, this indicates a bug — data
   was written to wrong location due to missing worktree

#### Worktree Error Classes

```typescript
// packages/tbd/src/lib/errors.ts

export class WorktreeMissingError extends TbdError {
  constructor(message: string = 'Worktree not found') {
    super(message, 'WORKTREE_MISSING');
  }
}

export class WorktreeCorruptedError extends TbdError {
  constructor(message: string = 'Worktree is corrupted') {
    super(message, 'WORKTREE_CORRUPTED');
  }
}

export class SyncBranchError extends TbdError {
  constructor(message: string) {
    super(message, 'SYNC_BRANCH_ERROR');
  }
}
```

### 2.4 Entity Collection Pattern

tbd has **one core entity type**: Issues

Future phases may add: agents, messages, workflows, templates

#### Directory Layout

| Collection | Directory | Extension | ID Prefix | Purpose |
| --- | --- | --- | --- | --- |
| Issues | `.tbd/data-sync/issues/` | `.md` | `is-` | Task tracking (synced) |

#### Adding New Entity Types (Future)

To add a new entity type:

1. Create directory: `.tbd/data-sync/messages/` (on sync branch)

2. Define schema: `MessageSchema` in Zod

3. Define ID prefix: `ms-`

4. Define merge rules

5. Add CLI commands

No sync algorithm changes needed—sync operates on files, not schemas.

### 2.5 ID Generation

tbd uses a **dual ID system** to balance machine requirements (sorting, uniqueness) with
human usability (short, memorable):

| ID Type | Format | Example | Purpose |
| --- | --- | --- | --- |
| **Internal** | `{type}-{ulid}` | `is-01hx5zzkbkactav9wevgemmvrz` | Storage, sorting, dependencies |
| **External** | `{project}-{short}` | `proj-a7k2` | CLI, docs, commits, references |

**Internal IDs** use [ULID](https://github.com/ulid/spec) (Universally Unique
Lexicographically Sortable Identifier):

- **Fixed prefix**: Entity type discriminator (`is-` for issues, `ms-` for messages)
- **ULID body**: 26 lowercase characters (48-bit timestamp + 80-bit randomness)
- **Lexicographic sorting**: IDs sort chronologically by creation time
- **No collisions**: Monotonic generation within millisecond prevents duplicates

**External IDs** use short alphanumeric codes mapped to internal IDs:

- **Required prefix**: Project-specific (e.g., `proj`, `myapp`, `tk`) via
  `display.id_prefix`
  - Set during `tbd init --prefix=<name>` or automatically from beads import
- **Short code**: 1+ alphanumeric characters (a-z, 0-9)
  - Imported issues: Preserve original short ID (e.g., `100` from `tbd-100`)
  - New issues: Generate random 4-char base36
- **Immutable mapping**: Once assigned, never changes
- **No prefix matching**: Users type the full short ID, always

#### ID Generation Algorithm

```typescript
import { ulid } from 'ulid';

// Generate internal ID (ULID-based)
function generateInternalId(prefix: string = 'is'): string {
  return `${prefix}-${ulid().toLowerCase()}`;
  // e.g., "is-01hx5zzkbkactav9wevgemmvrz"
}

// Generate external short ID (base36)
function generateShortId(): string {
  // 4 base36 chars = 1.7M possibilities, 5 chars = 60M
  const chars = '0123456789abcdefghijklmnopqrstuvwxyz';
  let result = '';
  for (let i = 0; i < 4; i++) {
    result += chars[Math.floor(Math.random() * 36)];
  }
  return result; // e.g., "a7k2"
}
```

**Properties:**

- **Time-ordered**: ULIDs encode creation timestamp, enabling chronological sort by ID
- **No collisions**: ULID spec guarantees monotonic generation within same millisecond
- **Human-friendly**: Short IDs are easy to type, say, and remember
- **Deterministic sorting**: Alphabetical sort = chronological order

#### ID Mapping

The mapping between external and internal IDs is stored in
`.tbd/data-sync/mappings/ids.yml`:

```yaml
# .tbd/data-sync/mappings/ids.yml
# short_id: ulid (without prefix)
#
# Imported issues preserve their original short IDs:
100: 01hx5zzkbkactav9wevgemmvrz    # from tbd-100
101: 01hx5zzkbkbctav9wevgemmvrz    # from tbd-101
1823: 01hx5zzkbkcdtav9wevgemmvrz   # from tbd-1823
#
# New issues get random 4-char base36 IDs:
a7k2: 01hx5zzkbkdetav9wevgemmvrz
b3m9: 01hx5zzkbkeetav9wevgemmvrz
```

**Mapping properties:**

- **Synced**: File lives on sync branch, shared across all machines
- **Immutable entries**: Once a mapping exists, it never changes
- **ID preservation**: Imports preserve original short IDs (no separate beads.yml
  needed)
- **Merge strategy**: Union (no conflicts since short IDs are unique)
- **Collision handling**: On short ID collision (rare for imports), regenerate and retry

#### ID Resolution (CLI)

When a user provides an ID:

```typescript
async function resolveId(input: string, storage: Storage): Promise<string> {
  // Strip display prefix if present (e.g., "proj-a7k2" → "a7k2")
  const shortId = input.replace(/^[a-z]+-/, '');

  // Look up in mapping file
  const mapping = await storage.loadIdMapping();
  const ulid = mapping.get(shortId);

  if (!ulid) {
    throw new CLIError(`Issue not found: ${input}`);
  }

  return `is-${ulid}`; // Return full internal ID
}
```

**No prefix matching**: Unlike git refs, issue IDs are permanent references that appear
in documentation, commit messages, and external systems.
Prefix matching would cause ambiguity as more issues are created.
Users always type the full short ID.

#### File Naming

Issue files use the full internal ID:

```
.tbd/data-sync/issues/is-01hx5zzkbkactav9wevgemmvrz.md
```

**Why ULID in filename?**

- Files sort chronologically in directory listings
- Git diffs show changes in creation order
- No lookup needed to determine file path from internal ID

#### Display Format

```typescript
function formatDisplayId(internalId: string, config: Config): string {
  const ulid = internalId.replace(/^is-/, '');
  const shortId = config.idMapping.getShortId(ulid);
  const prefix = config.display.id_prefix; // Required, no default
  return `${prefix}-${shortId}`; // e.g., "proj-a7k2"
}
```

**CLI flow example (imported issue):**

```
User types:     proj-100 (or original beads ID like tbd-100)
Lookup:         100 → 01hx5zzkbkactav9wevgemmvrz
Internal ID:    is-01hx5zzkbkactav9wevgemmvrz
File path:      .tbd/data-sync/issues/is-01hx5zzkbkactav9wevgemmvrz.md
Display back:   proj-100
```

**CLI flow example (new issue):**

```
User types:     proj-a7k2
Lookup:         a7k2 → 01hx5zzkbkdetav9wevgemmvrz
Internal ID:    is-01hx5zzkbkdetav9wevgemmvrz
File path:      .tbd/data-sync/issues/is-01hx5zzkbkdetav9wevgemmvrz.md
Display back:   proj-a7k2
```

### 2.6 Schemas

Schemas are defined in Zod (TypeScript).
Other languages should produce equivalent YAML/Markdown output.

#### 2.6.1 Common Types

```typescript
import { z } from 'zod';

// ISO8601 timestamp
const Timestamp = z.string().datetime();

// Internal Issue ID: is-{ulid} where ULID is 26 lowercase chars
// Example: is-01hx5zzkbkactav9wevgemmvrz
const InternalIssueId = z.string().regex(/^is-[0-9a-z]{26}$/);

// Short ID: 1+ alphanumeric chars (used in external/display IDs)
// For imports: preserved from source (e.g., "100" from "tbd-100")
// For new issues: random 4-char base36 (e.g., "a7k2")
const ShortId = z.string().regex(/^[0-9a-z]+$/);

// External Issue ID input: accepts {prefix}-{short} or just {short}
// Example: bd-100, bd-a7k2, 100, a7k2
const ExternalIssueIdInput = z.string().regex(/^([a-z]+-)?[0-9a-z]+$/);

// Edit counter - incremented on every local change
// IMPORTANT: Version is NOT used for conflict detection (Git push rejection is used).
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
> Conflict detection uses **Git push rejection** (see §3.4). This avoids the classic
> distributed systems problem where version numbers can diverge when two nodes edit
> independently. The version is useful for debugging ("how many times was this edited?")
> and is set to `max(local, remote) + 1` after merges.

#### 2.6.2 BaseEntity

All entities share common fields:

```typescript
const BaseEntity = z.object({
  type: EntityType, // Always "is" for issues
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
> 
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

// Dependency types - using enum for extensibility (future: 'related', 'discovered-from')
const DependencyType = z.enum(['blocks']); // Currently only "blocks" supported

const Dependency = z.object({
  type: DependencyType,
  target: IssueId,
});

const IssueSchema = BaseEntity.extend({
  type: z.literal('is'),

  title: z.string().min(1).max(500),
  description: z.string().max(50000).optional(),
  notes: z.string().max(50000).optional(), // Working notes (Beads parity)

  kind: IssueKind.default('task'),
  status: IssueStatus.default('open'),
  priority: Priority.default(2),

  assignee: z.string().optional(),
  labels: z.array(z.string()).default([]),
  dependencies: z.array(Dependency).default([]),

  // Hierarchical issues
  parent_id: IssueId.optional(),

  // Spec linking - path to related spec/doc (relative to repo root)
  spec_path: z.string().optional(),

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

- `spec_path`: Optional path to related specification/documentation file (relative to
  repo root). Supports gradual path matching for flexible lookups - queries can match by
  filename only, partial path suffix, or exact path.
  Used for spec-first workflows where planning documents are created before
  implementation beads.

  **Path Validation and Normalization:** When setting spec_path via CLI (`--spec`),
  paths are validated and normalized:
  - File must exist at create/update time
  - Paths outside project root are rejected
  - Absolute paths within project are converted to relative
  - Relative paths from subdirectories are resolved to project root
  - Path separators are normalized (backslashes → forward slashes)
  - Leading `./` is removed

  This ensures consistent storage regardless of how the path was specified.

  **Inheritance from Parent:** When creating a child issue with `--parent` and no
  explicit `--spec`, the child automatically inherits the parent’s `spec_path`. When a
  parent’s `spec_path` is updated, the new value propagates to all children whose
  `spec_path` was null or matched the parent’s old value (i.e., was inherited).
  Children with explicitly different `spec_path` values are not affected.
  Re-parenting a child (via `tbd update --parent`) also inherits the new parent’s
  `spec_path` if the child has no existing `spec_path`.

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
In tbd, we handle deletion differently:

- Closed issues remain in `issues/` directory with `status: closed`

- Hard deletion moves the file to `attic/deleted/`

- No `tombstone` status needed

#### 2.6.4 ConfigSchema

Project configuration stored in `.tbd/config.yml`:

```yaml
# .tbd/config.yml
tbd_version: '3.0.0'

sync:
  branch: tbd-sync # Branch name for synced data
  remote: origin # Remote repository

# Display settings
display:
  id_prefix: proj # Required: project-specific prefix (set during init or import)

# Runtime settings
settings:
  auto_sync: false # Auto-sync after write operations
  index_enabled: true # Enable search indexing
```

```typescript
const ConfigSchema = z.object({
  tbd_version: z.string(),
  sync: z
    .object({
      branch: z.string().default('tbd-sync'),
      remote: z.string().default('origin'),
    })
    .default({}),
  display: z
    .object({
      id_prefix: z.string(), // Required: set during init or auto-detected from beads import
    }),
  settings: z
    .object({
      auto_sync: z.boolean().default(false),
      index_enabled: z.boolean().default(true),
    })
    .default({}),
});
```

#### 2.6.5 MetaSchema

Shared metadata stored in `.tbd/data-sync/meta.yml` on the sync branch:

```typescript
const MetaSchema = z.object({
  schema_version: z.number().int(),
  created_at: Timestamp,
});
```

> **Note**: `last_sync_at` is intentionally NOT stored in `meta.yml`. Syncing this file
> would create a conflict hotspot—every node updates it on every sync, causing constant
> merge conflicts. Instead, sync timestamps are tracked locally in `.tbd/state.yml`
> (gitignored).

#### 2.6.6 LocalStateSchema

Per-node state stored in `.tbd/state.yml` (gitignored, never synced).
Each machine maintains its own local state:

```typescript
const LocalStateSchema = z.object({
  last_sync_at: Timestamp.optional(), // When this node last synced successfully
});
```

> **Why local?** The `last_sync_at` timestamp is inherently per-node.
> Storing it in synced state would cause every sync to modify the same file, creating a
> guaranteed conflict generator.
> Keeping it local eliminates this hotspot.

> **Future extensions:** Additional fields like `node_id`, `last_synced_commit` (for
> incremental sync), or separate `last_push`/`last_pull` timestamps may be added as
> needed.

#### 2.6.7 AtticEntrySchema

Preserved conflict losers:

```typescript
const AtticEntrySchema = z.object({
  entity_id: IssueId,
  timestamp: Timestamp,
  field: z.string().optional(), // Specific field or full entity
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

### 2.7 Relationship Types

tbd supports two distinct types of relationships between issues: **parent-child**
(hierarchical containment) and **dependencies** (blocking relationships).
This section documents the model, compares it to Beads, and explains the design
rationale.

#### 2.7.1 Relationship Model Overview

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                     TBD RELATIONSHIP MODEL                                  │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  PARENT-CHILD (Containment)              DEPENDENCIES (Ordering)            │
│  ─────────────────────────               ──────────────────────             │
│  Field: parent_id                        Field: dependencies[]              │
│  Meaning: "Part of" / "Subtask of"       Meaning: "Blocks" / "Related to"   │
│  Affects ready queue: NO                 Affects ready queue: YES (blocks)  │
│                                                                             │
│     ┌─────────┐                             ┌─────────┐                     │
│     │  Epic   │                             │ Task A  │                     │
│     │         │                             │         │                     │
│     └────┬────┘                             └────┬────┘                     │
│          │ parent_id                             │ dependencies:            │
│     ┌────┴────┐                                  │   type: blocks           │
│     │  Task   │ ← Can be READY                   │   target: B              │
│     │         │   (parent doesn't block)    ┌────▼────┐                     │
│     └─────────┘                             │ Task B  │ ← BLOCKED           │
│                                             │         │   (until A closes)  │
│                                             └─────────┘                     │
│                                                                             │
│  Use case: Organize work into epics,     Use case: Enforce execution order, │
│  group related tasks                     track soft relationships           │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

#### 2.7.2 Parent-Child Relationships

Parent-child relationships use the `parent_id` field for hierarchical organization:

```yaml
# Child issue
id: is-01hx5zzkbkactav9wevgemmvrz
title: Implement OAuth login
parent_id: is-01hx5zzkbkbctav9wevgemmvrz  # Points to parent epic
```

**Key properties:**

- **Non-blocking**: A child can be in `ready` state even if its parent is open
- **Organizational**: Used for grouping tasks under epics or features
- **Single parent**: Each issue can have at most one parent
- **Visualized by**: `tbd list --pretty`, `tbd list --parent <id>`

**Commands:**

```bash
# Create with parent
tbd create "Implement OAuth" --parent proj-a1b2

# Set parent on existing issue
tbd update proj-c3d4 --parent proj-a1b2

# List children of a parent
tbd list --parent proj-a1b2
```

#### 2.7.3 Dependency Relationships

Dependencies use the `dependencies` array for ordering and linking:

```yaml
dependencies:
  - type: blocks
    target: is-01hx5zzkbkbctav9wevgemmvrz
```

**Supported dependency types:**

| Type | Affects Ready? | Use Case |
| --- | --- | --- |
| `blocks` | **Yes** | "This issue must close before target can proceed" |
| `related` | No | Soft link: "See also" references (future) |
| `discovered-from` | No | Provenance: "Found while working on X" (future) |

**Commands:**

```bash
# Add blocking dependency: A blocks B (B can't proceed until A closes)
tbd dep add proj-a1b2 proj-c3d4

# List what an issue blocks / is blocked by
tbd dep list proj-a1b2

# Remove dependency
tbd dep remove proj-a1b2 proj-c3d4
```

#### 2.7.4 Visualization Commands

Each relationship type has dedicated visualization:

| Command | Shows | Data Source |
| --- | --- | --- |
| `tbd list --pretty` | Parent-child hierarchy tree | `parent_id` field |
| `tbd list --parent <id>` | Children of a specific issue | `parent_id` field |
| `tbd blocked` | Issues blocked + their blockers | `dependencies[].type: blocks` |
| `tbd ready` | Unblocked, unassigned issues | Excludes blocked issues |
| `tbd dep tree <id>` | Blocking dependency chain | `dependencies[].type: blocks` (future) |
| `tbd list --format dot` | Full graph (Graphviz) | All relationships |

#### 2.7.5 Comparison with Beads

tbd and Beads have different models for parent-child relationships:

| Aspect | tbd | Beads |
| --- | --- | --- |
| Parent-child storage | `parent_id` field | `dependencies[].type: parent-child` |
| Parent-child blocking | **No** (organizational only) | **Transitive** (inherits parent's blocked state) |
| Dependency types | `blocks` only (more planned) | `blocks`, `parent-child`, `related`, `discovered-from`, + more |

**Understanding Beads’ parent-child behavior:**

In Beads, `parent-child` is listed as affecting ready work:

```go
// Beads: AffectsReadyWork includes parent-child
func (d DependencyType) AffectsReadyWork() bool {
  return d == DepBlocks || d == DepParentChild || ...
}
```

However, this does NOT mean children are blocked until their parent closes.
The actual behavior (from `attic/beads/internal/storage/sqlite/blocked_cache.go`) is
**transitive blocking**:

1. Only `blocks` (and similar types) can DIRECTLY block an issue
2. `parent-child` PROPAGATES blockage: if a parent is blocked, children inherit that
   blockage

So in Beads:
- Creating a task under an open epic does NOT block the task
- If the epic itself becomes blocked (by a `blocks` dependency), children are
  transitively blocked
- If the epic is open (not blocked), children CAN be ready to work on

**tbd’s simpler model:**

tbd separates these concepts entirely:

- **`parent_id`**: Organizational containment (non-blocking, no transitive effects)
- **`blocks`**: Temporal ordering (blocking)

This is simpler because:

```
Epic: "Build Auth System" (open)
├── Task: "Design UI" (open, READY)      ← Can work on this
├── Task: "Implement OAuth" (open, READY) ← Can work on this
└── Task: "Write tests" (blocked by OAuth) ← Must wait for OAuth
```

In tbd, blocking is explicit via `blocks` dependencies only.
There’s no transitive blocking through the parent-child hierarchy.
This makes the blocking model easier to reason about.

#### 2.7.6 Future Dependency Types

Based on real-world Beads usage data (from Beads’ own issue tracker):

| Type | Beads Usage | Priority | Notes |
| --- | --- | --- | --- |
| `blocks` | 47% (156 uses) | ✅ Supported | Core workflow |
| `parent-child` | 42% (140 uses) | ✅ Via `parent_id` | Different model (non-blocking) |
| `discovered-from` | 11% (37 uses) | 🔜 High | Useful for provenance tracking |
| `related` | <1% (2 uses) | ⏳ Low | Rarely used in practice |

Planned additions:

- **`discovered-from`**: Track issue provenance when work reveals new issues
- **`related`**: Soft links for “see also” references

#### 2.7.7 Future: Transitive Blocking Option

**Current design:** `parent_id` is purely organizational with no blocking effects.
Blocking is explicit via `blocks` dependencies only.

**Potential future enhancement:** Add opt-in transitive blocking through parent-child
hierarchy, similar to Beads’ model.

**How it would work:**

```yaml
# .tbd/config.yml
blocking:
  transitive_parent_child: true  # default: false
```

When enabled:
- If a parent epic is blocked (by a `blocks` dependency), children inherit that blockage
- Children are NOT blocked just because their parent is open
- Closing the blocker on the parent automatically unblocks all children

**Use case:** Large projects where blocking an epic should cascade to all child tasks,
preventing work on children when the parent is gated by external factors.

**Trade-offs:**

| Approach | Pros | Cons |
| --- | --- | --- |
| Current (explicit only) | Simpler, predictable | Must manually block children |
| Transitive (opt-in) | Automatic cascading | Hidden transitive effects |

**Decision:** Start with explicit-only blocking (simpler).
Add transitive blocking as an opt-in feature if users request it after real-world usage.

* * *

## 3. Git Layer

### 3.1 Overview

The Git Layer defines synchronization using standard git commands.
It operates on files without interpreting entity schemas beyond what’s needed for
merging.

**Key properties:**

- **Schema-agnostic sync**: File transfer via standard git push/pull

- **Schema-aware merge**: When push rejected, merge rules are applied per-entity-type

- **Standard git**: All operations use git CLI

- **Dedicated sync branch**: `tbd-sync` branch never pollutes main

- **Git-based conflict detection**: Push rejection triggers fetch and field-level merge

**Critical Invariant:** tbd MUST NEVER modify the user’s git index or staging area.
All git plumbing operations that write to the sync branch MUST use an isolated index
file via `GIT_INDEX_FILE` environment variable.
This ensures that a developer’s staged changes are never corrupted by tbd operations.

```bash
# Example: all sync branch writes use isolated index
export GIT_INDEX_FILE="$(git rev-parse --git-dir)/tbd-index"
```

### 3.2 Sync Branch Architecture

```
main branch:                    tbd-sync branch:
├── src/                        └── .tbd/
├── tests/                          └── data-sync/
├── README.md                           ├── issues/
├── .tbd/                               ├── attic/
│   ├── config.yml (tracked)            └── meta.yml
│   ├── .gitignore (tracked)
│   └── docs/      (gitignored)
└── ...
```

**Why separate branches?**

1. **No conflicts on main**: Coordination data never creates merge conflicts in feature
   branches

2. **Simple allow-listing**: Cloud sandboxes can allow push to `tbd-sync` only

3. **Shared across branches**: All feature branches see the same issues

4. **Clean git history**: Issue updates don’t pollute code commit history

#### Files Tracked on Main Branch

```
.tbd/config.yml       # Project configuration (YAML)
.tbd/.gitignore       # Ignores docs/, state.yml, data-sync-worktree/, data-sync/
```

#### .tbd/.gitignore Contents

```gitignore
# Installed documentation (regenerated on setup)
docs/
# Hidden worktree for search access
data-sync-worktree/
# Reserved for potential future "simple mode" (issues on main branch)
data-sync/
# Local state
state.yml
# Local backups (corrupted worktrees, migrated data)
backups/
```

#### Files Tracked on tbd-sync Branch

```
.tbd/data-sync/issues/     # Issue entities
.tbd/data-sync/attic/      # Conflict archive
.tbd/data-sync/mappings/   # ID mappings
  ids.yml                  # Short ID → ULID mapping (includes preserved import IDs)
.tbd/data-sync/meta.yml    # Metadata
```

### 3.3 Sync Operations

Sync uses standard git commands to read/write the sync branch without checking it out.

#### 3.3.1 Reading from Sync Branch

```bash
# Read a file from sync branch without checkout
git show tbd-sync:.tbd/data-sync/issues/is-a1b2.md

# List files in issues directory
git ls-tree tbd-sync .tbd/data-sync/issues/
```

#### 3.3.2 Writing to Sync Branch

All write operations use an isolated index to protect user’s staged changes:

```bash
# Setup isolated index
export GIT_INDEX_FILE="$(git rev-parse --git-dir)/tbd-index"

# 1. Fetch latest
git fetch origin tbd-sync

# 2. Read current sync branch state into isolated index
git read-tree tbd-sync

# 3. Update index with local changes
#    (issue files from .tbd/data-sync/issues/ are added to the tree)
git update-index --add --cacheinfo 100644,<blob-sha>,".tbd/data-sync/issues/is-a1b2c3.md"

# 4. Write tree from isolated index
TREE=$(git write-tree)

# 5. Create commit on sync branch
COMMIT=$(git commit-tree $TREE -p tbd-sync -m "tbd sync: $(date -Iseconds)")

# 6. Update sync branch ref
git update-ref refs/heads/tbd-sync $COMMIT

# 7. Push to remote
git push origin tbd-sync
```

**Push Retry Algorithm (V2-005):**

If push is rejected (non-fast-forward), retry with merge:

```
MAX_RETRIES = 3

for attempt in 1..MAX_RETRIES:
  1. git fetch origin tbd-sync
  2. Compute diff between prepared_commit and origin/tbd-sync
  3. For each conflicting file:
     - Load both versions as JSON
     - Apply merge rules (section 3.5)
     - Write merged result, save losers to attic
  4. Create new tree with merged files
  5. Create new commit with both parents (merge commit)
  6. git push origin tbd-sync
  7. If push succeeds: done
  8. If push rejected: continue to next attempt

If all attempts fail:
  - Exit with error code 1
  - Output: "Sync failed after 3 attempts. Manual resolution required."
  - Suggest: "Run 'tbd sync --status' to see pending changes."
```

#### 3.3.3 Sync Algorithm

High-level sync flow:

```
SYNC(options):
  0. PREREQUISITE: Verify worktree health (see §2.3.4)
     - If unhealthy and options.fix: repair worktree
     - If unhealthy and not options.fix: throw WorktreeMissingError/WorktreeCorruptedError
  1. Resolve data path via resolveDataSyncDir() — uses worktree path
  2. Fetch remote sync branch
  3. Update worktree to remote state (preserving local uncommitted changes)
  4. Commit worktree changes to sync branch
  5. Push to remote
  6. If push rejected (non-fast-forward): retry with merge (see 3.3.2)
```

**Critical Invariant:** All operations in steps 1-6 MUST use the resolved `dataSyncDir`
path consistently. Never read from or write to `.tbd/data-sync/` directly — always go
through the worktree at `.tbd/data-sync-worktree/.tbd/data-sync/`.

**Why most syncs are trivial (no merge needed):**

The file-per-entity design means parallel work rarely conflicts at the git level:

| Scenario | Git behavior | Result |
| --- | --- | --- |
| A creates issue-1, B creates issue-2 | Different files added | Trivial merge |
| A modifies issue-1, B creates issue-2 | Different files | Trivial merge |
| A and B both modify issue-1 | Same file modified | Field-level merge |

Only when two agents modify the **same issue** before syncing does tbd need to perform
field-level merging.
This is rare in practice because:
- Issues are small, focused units of work
- Agents typically work on different issues
- The `ready` command distributes work across agents

### 3.4 Conflict Detection and Resolution

#### When Conflicts Occur

Conflicts (requiring field-level merge) happen when the same issue file is modified in
two places before sync:

- Two environments modify the same issue before syncing

- Same issue modified on two machines offline

#### Detection

Conflict detection uses **Git’s standard push mechanics**:

```
git push fails with non-fast-forward → merge needed
```

When a push is rejected because the remote has changes, tbd:
1. Fetches the remote sync branch
2. For each local issue, checks if a remote version exists via `git show`
3. If remote version exists and differs, triggers the merge algorithm

The `version` field is purely informational (edit counter) and is NOT used for conflict
detection. This avoids the distributed systems problem where version numbers diverge
independently.

> **Why Git-based detection?** Git’s push rejection is reliable, well-tested
> infrastructure. By letting Git handle conflict detection at the transport level, tbd
> keeps its implementation simple and focuses on field-level merge resolution.

#### Resolution Flow

```
1. Detect: git push rejected (non-fast-forward)
2. Fetch remote changes
3. For each local issue:
   a. Try to read remote version via git show
   b. If remote exists and differs, parse both as YAML+Markdown
   c. Apply merge rules (field-level, from section 3.5)
   d. Increment version: max(local, remote) + 1
   e. Write merged result to worktree
   f. Save loser values to attic (for LWW fields that differed)
4. Commit merged changes to sync branch
5. Retry push (up to 3 attempts)
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
  updated_at: { strategy: 'recalculate' }, // Always set to merge time
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
  spec_path: { strategy: 'lww' },
  due_date: { strategy: 'lww' },
  deferred_until: { strategy: 'lww' },
  created_by: { strategy: 'preserve_oldest' },
  closed_at: { strategy: 'lww' }, // See status/closed_at rules below
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
local.extensions = { github: { issue: 123 }, slack: { channel: 'dev' } };
remote.extensions = { github: { pr: 456 }, jira: { key: 'PROJ-1' } };

// Result: union of keys, per-key LWW for conflicts
merged.extensions = {
  github: { pr: 456 }, // remote wins (LWW on github namespace)
  slack: { channel: 'dev' }, // preserved from local
  jira: { key: 'PROJ-1' }, // preserved from remote
};
// Note: github.issue lost because remote's github namespace won LWW
// The losing github namespace is preserved in attic
```

### 3.6 Attic Structure

The attic preserves data lost in conflicts:

```
.tbd/data-sync/attic/
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

### 4.1.1 Initialization Requirements

All tbd commands require the repository to be initialized, except:

- `tbd init` — Creates a new tbd repository
- `tbd import --from-beads` — Can initialize and import in one step (auto-runs init if
  needed)

**Behavior when not initialized:**

If `.tbd/config.yml` does not exist or is invalid, commands exit with an error:

- **Exit code**: 1
- **Error message**:
  `Error: Not a tbd repository (run 'tbd init' or 'tbd import --from-beads' first)`

**Detection logic:**

1. Check for `.tbd/config.yml` existence
2. Validate `tbd_version` field is present and compatible
3. If either check fails → error with initialization instructions

**Commands and their initialization requirements:**

| Command | Requires Init | Behavior if Not Initialized |
| --- | --- | --- |
| `init` | No | Creates `.tbd/` directory and sync branch |
| `status` | No | Shows detection results and guidance (see §4.9) |
| `import --from-beads` | No | Auto-initializes, then imports |
| `import <file>` | Yes | Error: "Not a tbd repository" |
| `list`, `show`, `stats` | Yes | Error: "Not a tbd repository" |
| `create`, `update`, `close`, `reopen` | Yes | Error: "Not a tbd repository" |
| `ready`, `blocked`, `stale` | Yes | Error: "Not a tbd repository" |
| `label`, `dep` | Yes | Error: "Not a tbd repository" |
| `sync`, `search`, `doctor`, `config` | Yes | Error: "Not a tbd repository" |
| `attic list/show/restore` | Yes | Error: "Not a tbd repository" |
| All other commands | Yes | Error: "Not a tbd repository" |

**`import --from-beads` auto-initialization:**

When `--from-beads` is used and `.tbd/` doesn’t exist:

1. Auto-run equivalent of `tbd init` silently
2. Proceed with import from Beads repository
3. Report: “Initialized tbd and imported N issues from Beads”

This enables a one-step migration workflow:

```bash
# In a repo with .beads/ directory
tbd import --from-beads    # Initializes AND imports in one command
```

### 4.2 Command Structure

```
tbd <command> [subcommand] [args] [options]
```

**Note**: CLI command is `tbd` (singular) to avoid conflict with shell `cd`.

### 4.3 Initialization

```bash
tbd init --prefix=<name> [options]

Options:
  --prefix=<name>       Required: project prefix for display IDs (e.g., "proj", "myapp")
  --sync-branch=<name>  Sync branch name (default: tbd-sync)
  --remote=<name>       Remote name (default: origin)
```

The `--prefix` option is **required** unless you’re importing from an existing beads
repository (which automatically detects and uses the beads prefix).

**What it does:**

1. Creates `.tbd/` directory with `config.yml` (including display.id_prefix) and
   `.gitignore`

2. Creates `.tbd/docs/` directories for shortcuts, guidelines, templates (gitignored)

3. Creates `tbd-sync` branch with `.tbd/data-sync/` structure

4. Pushes sync branch to origin (if remote exists)

5. Returns to original branch

6. Outputs instructions to commit config

**Output:**

```
Initialized tbd in /path/to/repo
Created sync branch: tbd-sync
Pushed sync branch to origin

To complete setup, commit the config files:
  git add .tbd/config.yml .tbd/.gitignore
  git commit -m "Initialize tbd"
```

### 4.4 Issue Commands

#### Create

```bash
tbd create [<title>] [options]

Options:
  --from-file <path>        Create from YAML+Markdown file (all fields)
  --type <type>             Issue type: bug, feature, task, epic, chore (default: task)
  --priority <0-4>          Priority (0=critical, 4=lowest, default: 2)
  --description <text>      Description
  --file <path>             Read description from file
  --assignee <name>         Assignee
  --due <date>              Due date (ISO8601)
  --defer <date>            Defer until date (ISO8601)
  --parent=<id>             Parent issue ID
  --label <label>           Add label (repeatable)
  --no-sync                 Don't sync after create
```

> **Note on `--type` flag:** The CLI flag `--type` sets the issue’s `kind` field, NOT
> the `type` field. The `type` field is the entity discriminator (always `is` for issues)
> and is set automatically.
> This naming choice maintains Beads CLI compatibility where `--type` was used for issue
> classification.

**Examples:**

```bash
tbd create "Fix authentication bug" --type=bug --priority=P1
tbd create "Add OAuth" --type=feature --label=backend --label=security
tbd create "Write tests" --parent proj-a1b2
tbd create "API docs" --file design.md

# Create from full YAML+Markdown file
tbd create --from-file new-issue.md
```

**`--from-file` behavior:**

- Reads the YAML frontmatter + Markdown body from file

- Validates against IssueSchema

- Ignores `id` field in file (generates new ID)

- Ignores `version`, `created_at`, `updated_at` (set automatically)

- Title is required in the file’s frontmatter (or use `<title>` argument to override)

**Output:**

```
Created proj-a1b2: Fix authentication bug
```

#### List

```bash
tbd list [options]

Options:
  --status <status>         Filter: open, in_progress, blocked, deferred, closed
  --all                     Include closed issues (default: excludes closed)
  --type <type>             Filter: bug, feature, task, epic
  --priority <0-4>          Filter by priority
  --assignee <name>         Filter by assignee
  --label <label>           Filter by label (repeatable)
  --parent=<id>             List children of parent
  --deferred                Show only deferred issues
  --defer-before <date>     Deferred before date
  --sort <field>            Sort by: priority, created, updated (default: priority)
                            (created/updated are shorthand for created_at/updated_at)
  --limit <n>               Limit results
  --count                   Output only the count of matching issues
  --long                    Show descriptions
  --pretty                  Tree format showing parent-child hierarchy
  --json                    Output as JSON
```

> **Default filtering:** By default, `tbd list` excludes closed issues to focus on
> active work. Use `--all` to include closed issues, or `--status closed` to show only
> closed issues.

**Examples:**

```bash
tbd list                             # Active issues only (excludes closed)
tbd list --all                       # All issues including closed
tbd list --status closed             # Only closed issues
tbd list --status open --priority=P1
tbd list --assignee agent-1 --json
tbd list --deferred
```

**Output (human-readable):**

```
ID          PRI  STATUS           TITLE
proj-a1b2   P1   ◐ in_progress    Fix authentication bug
proj-f14c   P2   ○ open           Add OAuth support
proj-c3d4   P3   ● blocked        Write API tests
```

**Output (--pretty):**

The `--pretty` flag displays issues in a tree format showing parent-child relationships.
Issues with children are shown with their children indented below them using tree
characters.

```
proj-1875  P1  ✓ closed  epic  Phase 24 Epic: Installation and Agent Integration
├── proj-1876  P1  ✓ closed  task  Implement tbd prime command
└── proj-1877  P1  ✓ closed  task  Implement tbd setup claude command
proj-a1b2  P1  ◐ in_progress  bug  Fix authentication bug
proj-f14c  P2  ○ open  feature  Add OAuth support
├── proj-c3d4  P2  ● blocked  task  Write OAuth tests
└── proj-e5f6  P2  ○ open  task  Update OAuth docs
```

**Pretty format columns (left to right):**

| Column | Color | Notes |
| --- | --- | --- |
| Tree prefix | dim | `├── ` or `└── ` for children, with indentation for deeper levels |
| ID | cyan | Display ID (e.g., `proj-a1b2`) |
| Priority | P0=red, P1=yellow, P2+=default | Always with P prefix |
| Status | per status | Icon + word (e.g., `✓ closed`, `◐ in_progress`) |
| Type | dim | Issue kind (bug, feature, task, epic, chore) |
| Title | default | Issue title |

**Tree structure rules:**

- Issues without a parent appear at root level (no indentation)
- Children are grouped under their parent with tree lines
- `├── ` prefix for middle children
- `└── ` prefix for last child in a group
- Multi-level nesting uses additional indentation (`│ ` or ` `)
- Children sorted by priority within each parent group

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
tbd show <id> [options]

Options:
  --json                    Output as JSON instead of YAML+Markdown
```

**Output:**

The `show` command outputs the issue in the exact storage format (YAML frontmatter +
Markdown body). This format is both human-readable and machine-parseable, enabling
round-trip editing workflows.

```markdown
---
type: is
id: is-a1b2c3
version: 3
kind: bug
title: Fix authentication timeout
status: in_progress
priority: 1
assignee: agent-1
labels:
  - backend
  - security
dependencies:
  - target: is-f14c3d
    type: blocks
parent_id: null
created_at: 2025-01-07T10:00:00Z
updated_at: 2025-01-07T14:30:00Z
created_by: alice
closed_at: null
close_reason: null
due_date: null
deferred_until: null
extensions: {}
---

Users are getting logged out after 5 minutes of inactivity.

## Notes

Working on session token expiry. Found issue in refresh logic.
```

Output is colorized when stdout is a TTY (see `--color` global option in §4.10).

**Round-trip editing workflow:**

```bash
# Export, edit, re-import
tbd show proj-a1b2 > issue.md
# ... edit issue.md ...
tbd update proj-a1b2 --from-file issue.md
```

> **Note:** The `notes` field appears as a `## Notes` section in the Markdown body,
> separated from the main description.
> Notes are intended for agent/developer working notes, while the description is the
> issue’s canonical description.

#### Update

```bash
tbd update <id> [options]

Options:
  --from-file <path>        Update all fields from YAML+Markdown file
  --title <text>            Set title
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
  --parent=<id>             Set parent
  --no-sync                 Don't sync after update
```

**Examples:**

```bash
tbd update proj-a1b2 --status=in_progress
tbd update proj-a1b2 --title "New issue title"
tbd update proj-a1b2 --add-label urgent --priority=P0
tbd update proj-a1b2 --defer 2025-02-01

# Round-trip editing: export, modify, re-import
tbd show proj-a1b2 > issue.md
# ... edit issue.md ...
tbd update proj-a1b2 --from-file issue.md
```

**`--from-file` behavior:**

- Reads the YAML frontmatter + Markdown body from file

- Validates against IssueSchema

- Updates all mutable fields (immutable fields `id`, `type`, `created_at`, `created_by`
  are preserved from existing issue)

- Automatically increments `version` and sets `updated_at`

- Reports clear validation errors if schema is invalid

#### Close

```bash
tbd close <id> [options]

Options:
  --reason <text>           Close reason
  --no-sync                 Don't sync after close
```

**Examples:**

```bash
tbd close proj-a1b2
tbd close proj-a1b2 --reason "Fixed in commit abc123"
```

#### Reopen

```bash
tbd reopen <id> [options]

Options:
  --reason <text>           Reopen reason
  --no-sync                 Don't sync after reopen
```

#### Ready

List issues ready to work on (open, unblocked, unclaimed):

```bash
tbd ready [options]

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
tbd blocked [options]

Options:
  --limit <n>               Limit results
  --json                    Output as JSON
```

**Output:**

```
ISSUE       TITLE                    BLOCKED BY
proj-c3d4     Write tests              proj-f14c (Add OAuth)
proj-e5f6     Deploy to prod           proj-a1b2, proj-c3d4
```

#### Stale

List issues not updated recently:

```bash
tbd stale [options]

Options:
  --days <n>                Days since last update (default: 7)
  --status <status>         Filter by status (default: open, in_progress)
  --limit <n>               Limit results
  --json                    Output as JSON
```

**Examples:**

```bash
tbd stale                    # Issues not updated in 7 days
tbd stale --days 14          # Issues not updated in 14 days
tbd stale --status blocked   # Blocked issues that are stale
```

**Output:**

```
ISSUE       DAYS  STATUS       TITLE
proj-a1b2     12    in_progress  Fix authentication bug
proj-f14c     9     open         Add OAuth support
```

### 4.5 Label Commands

```bash
# Add label to issue
tbd label add <id> <label>

# Remove label from issue
tbd label remove <id> <label>

# List all labels in use
tbd label list
```

**Examples:**

```bash
tbd label add proj-a1b2 urgent
tbd label remove proj-a1b2 low-priority
tbd label list
```

### 4.6 Dependency Commands

Dependencies use the semantics **“A depends on B”** (equivalent to **“B blocks A”**).
This matches Beads convention.

```bash
# Add dependency: issue depends on depends-on (depends-on blocks issue)
tbd dep add <issue> <depends-on>

# Remove dependency
tbd dep remove <issue> <depends-on>

# List dependencies for an issue
tbd dep list <id>
```

**Argument semantics:**

- `<issue>`: The issue that depends on something (the dependent/blocked issue)
- `<depends-on>`: The issue that must be completed first (the prerequisite/blocker)

**Examples:**

```bash
# "Write tests" depends on "Add OAuth" (can't write tests until OAuth is done)
tbd dep add proj-c3d4 proj-f14c
# Output: ✓ proj-c3d4 now depends on proj-f14c

# List what blocks/is blocked by an issue
tbd dep list proj-c3d4
# Output:
# Blocked by: proj-f14c
```

**Data model:** Dependencies are stored on the blocker issue with
`{type: 'blocks', target: blocked-issue-id}`. This enables efficient lookup of “what
does this issue block?”
from its own dependencies array.

**Note**: Currently only supports `blocks` dependency type.
Future: `related`, `discovered-from`.

### 4.7 Sync Commands

```bash
# Full sync (pull then push)
tbd sync

# Pull only
tbd sync --pull

# Push only
tbd sync --push

# Show sync status
tbd sync --status

# Force sync (overwrite conflicts)
tbd sync --force

# Repair worktree before syncing
tbd sync --fix
```

**Worktree Health Requirement:**

Before performing any sync operation, `tbd sync` MUST verify worktree health:

```typescript
async run(options: SyncOptions): Promise<void> {
  // FIRST: Ensure worktree exists and is healthy
  const worktreeStatus = await checkWorktreeHealth(tbdRoot);
  if (!worktreeStatus.healthy) {
    if (options.fix) {
      await this.repairWorktree(tbdRoot);
    } else {
      throw new WorktreeError(
        `Worktree is ${worktreeStatus.status}. ` +
        `Run 'tbd sync --fix' or 'tbd doctor --fix' to repair.`
      );
    }
  }

  // Now safe to resolve path - worktree guaranteed to exist
  this.dataSyncDir = await resolveDataSyncDir(tbdRoot);

  // ... rest of sync operations
}
```

**Path Consistency Invariant:** All sync operations MUST use the resolved `dataSyncDir`
path consistently.
Never mix `resolveDataSyncDir()` results with hardcoded `WORKTREE_DIR`
or `DATA_SYNC_DIR` constants.

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

**Output (sync with unhealthy worktree):**

```
Error: Worktree is missing. Run 'tbd sync --fix' or 'tbd doctor --fix' to repair.
```

### 4.8 Search Commands

tbd provides integrated search via the hidden worktree, enabling text search across all
issues. (The worktree also enables manual use of ripgrep/grep if needed.)

```bash
# Search issue content
tbd search <pattern> [options]

Options:
  --field <field>           Search only in specific field (title, description, notes, labels)
  --status <status>         Filter by status
  --case-sensitive          Case-sensitive search (default: case-insensitive)
  --limit <n>               Limit results
  --no-refresh              Skip worktree refresh
  --json                    JSON output

# Future options (not yet implemented):
#   --type <type>           Filter by issue type
#   --label <label>         Filter by label
#   --context <n>           Show n lines of context
#   --files-only            Only show matching file paths
#   --count                 Show match count only
```

**Examples:**

```bash
# Basic search
tbd search "authentication"

# Search in specific field
tbd search "timeout" --field description

# Search open issues only
tbd search "TODO" --status open

# Limit results
tbd search "error" --limit 10
```

**Output (default):**

```
proj-a1b2: Fix authentication timeout
  description (line 5): ...users experiencing authentication timeout after 5 minutes...

proj-f14c: Add OAuth support
  notes (line 2): ...need to handle timeout during OAuth callback...

Found 2 issues with 2 matches
```

**Output (--json):**

```json
{
  "matches": [
    {
      "issue_id": "is-a1b2c3",
      "display_id": "proj-a1b2",
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

Search is currently implemented as an **in-memory scan**:

1. Load all issues from the hidden worktree directory
2. Filter issues by searching fields with string matching
3. Apply additional filters (status, type, label)

**Search algorithm:**

```
SEARCH(pattern, options):
  1. Ensure worktree is initialized and up-to-date
     - If stale (>5 minutes since last fetch), refresh: tbd sync --pull

  2. Load all issues from worktree into memory

  3. For each issue, search specified fields:
     - title, description, notes, labels (default: all)
     - Case-insensitive by default

  4. Apply additional filters (type, status, label)

  5. Format output according to options
```

**Worktree staleness:**

The search command checks worktree freshness.
If the worktree is stale (last fetch was more than 5 minutes ago), search will
automatically pull before searching to ensure results are current.
This can be disabled with `--no-refresh`.

> **Future Enhancement:** For improved performance on large repositories (10K+ issues),
> search could be optimized to use ripgrep (`rg`) against the worktree files directly.
> See §7.2 Future Enhancements for details.

```bash
# Search without refreshing (faster but potentially stale)
tbd search "pattern" --no-refresh
```

### 4.9 Maintenance Commands

#### Status

The `status` command is the “orientation” command—like `git status`, it works regardless
of initialization state and helps users understand where they are.

> **Note:** Unlike Beads where `bd status` is just an alias for `bd stats`, `tbd status`
> is a distinct command that provides system orientation, not issue statistics.
> Use `tbd stats` for issue counts.

```bash
tbd status [options]

Options:
  --json                    JSON output
```

**Behavior when NOT initialized:**

```
$ tbd status
Not a tbd repository.

Detected:
  ✓ Git repository (main branch)
  ✓ Beads repository (.beads/ with 142 issues)
  ✗ tbd not initialized

To get started:
  tbd import --from-beads   # Migrate from Beads (recommended)
  tbd init                  # Start fresh
```

**Behavior when initialized:**

```
$ tbd status
tbd repository: /path/to/repo

tbd Version: 3.0.0
Sync Branch: tbd-sync
Remote: origin
Display Prefix: bd

Sync Status:
  Local:  2 changes (not pushed)
  Remote: 1 change (not pulled)
  Last sync: 5 minutes ago

Issues:
  Ready: 12 (use 'tbd ready' to see them)
  In progress: 3
  Blocked: 2
  Total: 127

Integrations:
  ✓ Claude Code hooks installed (./.claude/settings.json)
  ✗ Codex AGENTS.md not installed

Worktree: .tbd/data-sync-worktree/ (healthy)
```

**Output (--json) when initialized:**

```json
{
  "initialized": true,
  "tbd_version": "3.0.0",
  "sync_branch": "tbd-sync",
  "remote": "origin",
  "display_prefix": "bd",
  "worktree_path": ".tbd/data-sync-worktree/",
  "worktree_healthy": true,
  "last_sync": "2025-01-10T10:00:00Z",
  "last_synced_commit": "abc123def456",
  "sync_status": {
    "local_changes": 2,
    "remote_changes": 1
  },
  "issues": {
    "ready": 12,
    "in_progress": 3,
    "blocked": 2,
    "total": 127
  },
  "integrations": {
    "claude_code": true,
    "cursor": false,
    "codex": false
  },
  "beads_detected": false
}
```

**Output (--json) when NOT initialized:**

```json
{
  "initialized": false,
  "git_repository": true,
  "git_branch": "main",
  "beads_detected": true,
  "beads_issue_count": 142,
  "suggestion": "Run 'tbd import --from-beads' to migrate"
}
```

#### Stats

```bash
tbd stats
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
tbd doctor [options]

Options:
  --fix                     Auto-fix issues
  --json                    Output as JSON
```

**Checks performed:**

The doctor command performs comprehensive health checks organized into categories:

**1. Worktree Health Check**

| Check | Severity | Auto-fixable | Detection |
| --- | --- | --- | --- |
| Worktree missing | error | yes | Directory doesn't exist |
| Worktree prunable | error | yes | `git worktree list` shows prunable |
| Worktree corrupted | error | yes | Missing `.git` file or invalid gitdir |

**2. Sync Branch Health Check**

| Check | Severity | Auto-fixable | Detection |
| --- | --- | --- | --- |
| Local branch missing | error | yes | `refs/heads/tbd-sync` doesn't exist |
| Remote branch missing | warning | no | `refs/remotes/origin/tbd-sync` doesn't exist |
| Local/remote diverged | warning | no | `git merge-base` != either HEAD |

**3. Sync State Consistency Check**

Only runs if worktree is healthy:

| Check | Severity | Auto-fixable | Detection |
| --- | --- | --- | --- |
| Worktree HEAD != local branch | error | yes | Different commit SHAs |
| Local ahead of remote | info | no | `git rev-list` count > 0 |
| Local behind remote | info | no | `git rev-list` count > 0 |

**4. Data Location Check**

| Check | Severity | Auto-fixable | Detection |
| --- | --- | --- | --- |
| Issues in wrong location | error | yes | Files exist in `.tbd/data-sync/issues/` on main |
| Local data exists but remote empty | error | no | Worktree has issues, remote tbd-sync has none |

**5. Schema and Reference Checks**

| Check | Severity | Auto-fixable | Detection |
| --- | --- | --- | --- |
| Schema version incompatible | error | no | `meta.yml` version > supported |
| Orphaned dependencies | warning | yes | Dependency target doesn't exist |
| Duplicate IDs | error | yes | Multiple files with same short ID |
| Invalid references | warning | yes | `parent_id` points to missing issue |

**Example output:**

```
Checking tbd health...

✗ ERROR: Worktree is prunable
  Fix: Run `tbd doctor --fix` to repair

✗ ERROR: Found 951 issues in wrong location (.tbd/data-sync/)
  Fix: Run `tbd doctor --fix` to migrate to worktree

⚠ WARNING: Remote branch 'origin/tbd-sync' does not exist
  Fix: Run `tbd sync` to push local branch to remote

3 error(s), 1 warning(s), 0 info(s)

Run `tbd doctor --fix` to auto-fix 2 issue(s)
```

**`--fix` behavior:**

The `--fix` flag performs repairs in this order:

1. If worktree corrupted:
   - **Backup to `.tbd/backups/corrupted-worktree-backup-YYYYMMDD-HHMMSS/`** (prevents
     data loss)
   - Remove the corrupted worktree directory
2. If worktree prunable: `git worktree prune`
3. If worktree missing (or was just removed):
   - If local tbd-sync exists: `git worktree add .tbd/data-sync-worktree tbd-sync`
   - Else if remote exists: `git fetch && git worktree add ... tbd-sync`
   - Else: `git worktree add --orphan tbd-sync ...`
4. If data in wrong location (`.tbd/data-sync/`):
   - Backup to `.tbd/backups/tbd-data-sync-backup-YYYYMMDD-HHMMSS/`
   - Copy to worktree
   - Commit in worktree
5. Rebuild ID mappings if corrupted
6. Remove orphaned dependency references

> **Note:** Backups are stored in `.tbd/backups/` which is gitignored.
> Users can manually inspect backups to recover any data that wasn’t committed before
> the worktree became corrupted.

#### Compact (Future)

```bash
tbd compact [options]

Options:
  --dry-run                 Show what would be compacted
  --keep-days <n>           Keep closed issues for n days (default: 90)
```

**Note**: All closed issues are kept.
Compaction is a future enhancement.

#### Config

```bash
tbd config show                    # Show all configuration
tbd config get <key>               # Get a configuration value
tbd config set <key> <value>       # Set a configuration value
```

**Examples:**

```bash
tbd config show
tbd config get display.id_prefix
tbd config set sync.remote upstream
tbd config set display.id_prefix cd
```

### 4.10 Global Options

Available on all commands:

```bash
--help                      Show help
--version                   Show version
--db <path>                 Custom .tbd directory path (Beads compat alias)
--dir <path>                Custom .tbd directory path (preferred)
--no-sync                   Disable auto-sync (per command)
--json                      JSON output
--color <when>              Colorize output: auto, always, never (default: auto)
--actor <name>              Override actor name (not yet implemented)
--dry-run                   Show what would be done without making changes
--verbose                   Enable verbose output
--quiet                     Suppress non-essential output
--debug                     Show internal IDs alongside public IDs for debugging
--non-interactive           Disable all prompts, fail if input required
--yes                       Assume yes to confirmation prompts
```

**Color Output:**

The `--color` option controls ANSI color output consistently across all commands:

- `auto` (default): Enable colors when stdout is a TTY, disable when piped/redirected

- `always`: Force colors (useful for `less -R` or capturing colored output)

- `never`: Disable colors entirely

This follows the same convention as `git`, `ls`, `grep`, and other Unix tools.

**Actor Resolution Order:**

> **Implementation note:** The `--actor` flag and `TBD_ACTOR` environment variable are
> not yet implemented.
> Currently, actor defaults to git user.email or system username.
> Full actor system design is tracked as future work.

The actor name (used for `created_by` and recorded in sync commits) is resolved in this
order:

1. `--actor <name>` CLI flag (highest priority) — *not yet implemented*

2. `TBD_ACTOR` environment variable — *not yet implemented*

3. Git user.email from git config

4. System username + hostname (fallback)

Example: `TBD_ACTOR=claude-agent-1 tbd create "Fix bug"`

> **Note:** `--db` is retained for Beads compatibility.
> Prefer `--dir` for new usage.

**Agent/Automation Flags:**

These options enable non-interactive use in CI/CD pipelines and by AI agents:

- `--non-interactive`: Disables all interactive prompts.
  Commands that require user input will fail with an error instead of blocking.
  Automatically enabled when `CI` environment variable is set or when stdin is not a
  TTY.

- `--yes`: Automatically answers “yes” to confirmation prompts.
  Useful for batch operations or scripts.
  Does not bypass `--non-interactive`—combine both for fully automated execution.

- `--dry-run`: Shows what changes would be made without actually making them.
  Essential for verifying agent-planned operations before execution.

- `--verbose`: Enables detailed debug output to stderr.
  Useful for troubleshooting.

- `--quiet`: Suppresses informational messages.
  Only errors and JSON data are output.
  Combine with `--json` for pure machine-readable output.

Example agent workflow:

```bash
# CI pipeline: create issue non-interactively
CI=1 tbd create "Deploy failed" --kind bug --priority=P2 --json

# Agent: preview changes before committing
tbd update td-abc1 --status done --dry-run --json

# Batch script: close multiple issues
tbd close td-abc1 td-abc2 td-abc3 --yes --quiet
```

### 4.11 Attic Commands

The attic preserves data lost in merge conflicts.
These commands enable inspection and recovery.

**Entry ID Format:**

Attic entries are identified by a composite ID derived from the entity, timestamp, and
field:

```
{entity-id}/{timestamp}_{field}

Examples:
  is-01hx5zzkbkactav9wevgemmvrz/2025-01-07T10-30-00Z_description
  is-01hx5zzkbkbctav9wevgemmvrz/2025-01-08T09-00-00Z_title
  is-01hx5zzkbkactav9wevgemmvrz/2025-01-07T11-45-00Z_full    # Full entity conflict (rare)
```

- **entity-id**: The issue ID (e.g., `is-a1b2c3`)

- **timestamp**: ISO8601 timestamp with colons replaced by hyphens (filesystem-safe)

- **field**: The field name that was overwritten, or `full` for complete entity
  conflicts

This format ensures unique, sortable entry IDs that can be easily parsed and allow
filtering by entity or time range.

```bash
# List attic entries
tbd attic list [options]

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
2025-01-07T10:30:00Z      proj-a1b2    description  remote
2025-01-07T11:45:00Z      proj-a1b2    notes        local
2025-01-08T09:00:00Z      proj-f14c    title        remote
```

```bash
# Show attic entry details
tbd attic show <id> <timestamp> [options]

Options:
  --json                    JSON output
```

**Output:**

```
Attic Entry: 2025-01-07T10-30-00Z_description

Issue: proj-a1b2 (Fix authentication bug)
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
tbd attic restore <id> <timestamp> [options]

Options:
  --dry-run                 Show what would be restored
  --no-sync                 Don't sync after restore
```

**Example:**

```bash
# Preview restoration
tbd attic restore proj-a1b2 2025-01-07T10-30-00Z --dry-run

# Apply restoration (creates new version with restored value)
tbd attic restore proj-a1b2 2025-01-07T10-30-00Z
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

- Initial migration from Beads to tbd

- Ongoing sync if some agents still use Beads temporarily

- Recovery if work was accidentally done in Beads

#### 5.1.1 Import Command

The import command supports two modes: **explicit file** and **repository auto-detect**.

```bash
# Mode 1: Explicit file (e.g., from `bd export`)
tbd import <file> [options]

# Mode 2: Auto-detect from Beads repository
tbd import --from-beads [path] [options]

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
tbd import beads-export.jsonl

# Re-import after more Beads work (safe to re-run)
bd export > beads-export.jsonl
tbd import beads-export.jsonl  # Updates existing, adds new, no duplicates

# Preview changes before importing
tbd import beads-export.jsonl --dry-run

# Auto-detect from repository (imports from both main and sync branch)
tbd import --from-beads

# Auto-detect from specific path
tbd import --from-beads /path/to/repo

# Import only from main branch
tbd import --from-beads --branch main

# Import only from sync branch
tbd import --from-beads --branch beads-sync
```

**Auto-initialization with `--from-beads`:**

When using `--from-beads` in a repository that has not been initialized with `tbd init`,
the import command will automatically initialize tbd first.
This enables a one-step migration workflow:

```bash
# One-step migration (no prior tbd init needed)
tbd import --from-beads
# Output: "Initialized tbd and imported 142 issues from Beads"
```

This auto-initialization only applies to `--from-beads` mode.
Explicit file import (`tbd import <file>`) still requires prior initialization with
`tbd init`. See §4.1.1 for full initialization requirements.

#### 5.1.2 Multi-Source Import (--from-beads)

When using `--from-beads`, tbd reads directly from the Beads repository structure
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
$ tbd import --from-beads --verbose

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

#### 5.1.4 ID Mapping and Preservation

The key to idempotent import is **stable ID mapping with ID preservation**. Imported
issues retain their original short IDs, ensuring:

- The same Beads issue always maps to the same tbd issue
- Users don’t need to learn new IDs after migration
- Commit messages, documentation, and external references remain valid

**ID preservation algorithm:**

When importing `tbd-100`, extract the short part (`100`) and use it directly:

```
Beads ID:       tbd-100
Short ID:       100        (extracted, preserved)
Internal ID:    is-01hx5zzkbkactav9wevgemmvrz  (generated ULID)
Display ID:     bd-100     (or tbd-100 with display.id_prefix: tbd)
```

**Mapping storage:**

All short IDs (imported and new) are stored in the unified mapping file:

```yaml
# .tbd/data-sync/mappings/ids.yml
# Imported issues preserve original short IDs:
100: 01hx5zzkbkactav9wevgemmvrz    # was tbd-100
101: 01hx5zzkbkbctav9wevgemmvrz    # was tbd-101
1823: 01hx5zzkbkcdtav9wevgemmvrz   # was tbd-1823
# New issues get random 4-char base36:
a7k2: 01hx5zzkbkdetav9wevgemmvrz
```

**No separate beads.yml needed:** Since the original short ID is preserved in `ids.yml`,
there’s no need for a separate mapping file.
The `extensions.beads` field stores metadata about the import for debugging:

```yaml
extensions:
  beads:
    original_id: tbd-100           # Full original ID (for reference)
    imported_at: 2025-01-10T10:00:00Z
```

**Properties:**

- **ID preserved**: `tbd-100` becomes `bd-100` (same short ID, configurable prefix)
- **Synced**: Mapping file lives on sync branch, shared across all machines
- **Immutable entries**: Once a short ID is mapped, it never changes
- **Collision handling**: If a short ID already exists (rare), skip import of that issue
  and warn—this indicates the issue was already imported

**Mapping recovery:** If `ids.yml` is corrupted or lost, it can be reconstructed by
scanning all issue files.
Each issue’s internal ID provides the ULID, and the `extensions.beads.original_id`
provides the short ID for imported issues.
Run `tbd doctor --fix` to rebuild.

#### 5.1.5 Import Algorithm

```
IMPORT_BEADS(jsonl_file):
  1. Load existing ID mapping from .tbd/data-sync/mappings/ids.yml
     (create empty {} if not exists)

  2. For each line in jsonl_file:
     a. Parse Beads issue JSON
     b. beads_id = issue.id (e.g., "tbd-100")
     c. short_id = extract_short_id(beads_id)  # "100" from "tbd-100"

     d. Look up short_id in id_mapping:
        - If found: This issue was already imported
          tbd_id = "is-" + id_mapping[short_id]
          Load existing tbd issue for merge
        - If not found: New import
          tbd_id = generate_new_ulid("is-")
          Add id_mapping[short_id] = tbd_id.ulid_part
          # Preserves original short ID!

     e. Convert Beads fields to tbd format (see Field Mapping)

     f. Set extensions.beads.original_id = beads_id
        Set extensions.beads.imported_at = now()

     g. If existing tbd issue:
        - Compare updated_at timestamps
        - If Beads is newer: apply merge using standard rules
        - If tbd is newer: skip (tbd changes preserved)
        - If same: no-op (already imported)
     h. If new issue:
        - Write new tbd issue file

  3. Save updated ids.yml mapping file

  4. Report: N new, M updated, K unchanged, J skipped (tbd newer)

  5. Sync (unless --no-sync)

extract_short_id(beads_id):
  # "tbd-100" → "100"
  # "bd-a1b2" → "a1b2"
  return beads_id.replace(/^[a-z]+-/, "")
```

#### 5.1.6 Merge Behavior on Re-Import

When re-importing an issue that already exists in tbd:

| Scenario | Behavior |
| --- | --- |
| Beads unchanged, tbd unchanged | No-op |
| Beads updated, tbd unchanged | Update tbd with Beads changes |
| Beads unchanged, tbd updated | Keep tbd changes (skip) |
| Both updated | Merge using LWW rules, loser to attic |

**Merge uses standard issue merge rules:**

- `updated_at` determines winner for scalar fields

- Labels use union (both additions preserved)

- Description/notes use LWW with attic preservation

**Example re-import scenario:**

```
Time 0: Import bd-a1b2 → is-x1y2 (initial import)
Time 1: Agent updates bd-a1b2 in Beads (adds label "urgent")
Time 2: Human updates is-x1y2 in tbd (changes priority to 1)
Time 3: Re-import bd-a1b2

Result: is-x1y2 has both changes:
  - Label "urgent" (from Beads, union merge)
  - Priority 1 (from tbd, more recent updated_at wins)
```

#### 5.1.7 Handling Deletions and Tombstones

> **Canonical reference:** This section is the authoritative specification for
> tombstone/deletion handling.
> See also: §2.5.3 (Notes on tombstone status), §5.4 (Status Mapping), §5.5 (Migration
> Gotchas).

Beads uses `tombstone` status for soft-deleted issues.
On import:

| Beads Status | tbd Behavior | Rationale |
| --- | --- | --- |
| `tombstone` (first import) | Skip by default | Don't import deleted issues |
| `tombstone` (re-import) | Set `status: closed`, add label `deleted-in-beads` | Preserve history |

**Options:**

```bash
tbd import beads.jsonl --include-tombstones  # Import tombstones as closed
tbd import beads.jsonl --skip-tombstones     # Skip tombstones (default)
```

#### 5.1.8 Dependency ID Translation

Beads dependencies reference Beads IDs.
On import, these must be translated:

```
Beads: { "type": "blocks", "target": "bd-m5n6" }
tbd: { "type": "blocks", "target": "is-d4e5f6" }  # Looked up from mapping
```

**Algorithm:**

1. Import all issues first (build complete mapping)

2. Second pass: translate dependency target IDs

3. If target not in mapping: log warning, skip dependency (orphan reference)

#### 5.1.9 Import Output

```bash
$ tbd import beads-export.jsonl

Importing from beads-export.jsonl...
  New issues:      23
  Updated:         5
  Unchanged:       142
  Skipped (newer): 2
  Tombstones:      3 (skipped)

Dependency translation:
  Translated: 45
  Orphaned:   1 (bd-z9a0 not found, skipped)

Import complete. Run 'tbd sync' to push changes.
```

**With --dry-run:**

```bash
$ tbd import beads-export.jsonl --dry-run

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
    bd-p1q2 (is-g7h8) - tbd newer by 1 day
```

#### 5.1.10 Migration Workflow

**One-step migration (recommended):**

```bash
# In a repo with .beads/ directory - simplest approach
tbd import --from-beads
git add .tbd/
git commit -m "Initialize tbd and import from beads"
tbd sync
```

This auto-initializes tbd and imports all issues in a single command.

**Two-step migration (explicit file):**

```bash
# In Beads repo
bd export > beads-export.jsonl

# In target repo (may be same repo)
tbd init
tbd import beads-export.jsonl
git add .tbd/
git commit -m "Initialize tbd and import from beads"
tbd sync
```

**Ongoing sync (transition period):**

```bash
# If agents are still using Beads occasionally
bd export > beads-export.jsonl
tbd import beads-export.jsonl  # Safe to re-run

# After import, tbd is authoritative
# New work should use tbd commands
```

**Recovery (accidental Beads usage):**

```bash
# Agent accidentally used Beads commands
# Recover that work into tbd
bd export > beads-export.jsonl
tbd import beads-export.jsonl
tbd sync
# Agent's work is now in tbd
```

### 5.2 Command Mapping

| Beads Command | tbd Equivalent | Status | Notes |
| --- | --- | --- | --- |
| `bd init` | `tbd init` | ✅ Full | Identical behavior |
| `bd create` | `tbd create` | ✅ Full | All options supported |
| `bd list` | `tbd list` | ✅ Full | All filters supported |
| `bd show` | `tbd show` | ✅ Full | Same output format |
| `bd update` | `tbd update` | ✅ Full | All options supported |
| `bd close` | `tbd close` | ✅ Full | With `--reason` |
| `bd ready` | `tbd ready` | ✅ Full | Same algorithm |
| `bd blocked` | `tbd blocked` | ✅ Full | Shows blocking issues |
| `bd label add` | `tbd label add` | ✅ Full | Identical |
| `bd label remove` | `tbd label remove` | ✅ Full | Identical |
| `bd label list` | `tbd label list` | ✅ Full | Lists all labels |
| `bd dep add` | `tbd dep add` | ✅ Full | Only "blocks" type |
| `bd dep tree` | `tbd dep tree` | 🔄 Future | Visualize dependencies |
| `bd sync` | `tbd sync` | ✅ Full | Different mechanism, same UX |
| `bd stats` | `tbd stats` | ✅ Full | Same statistics |
| `bd doctor` | `tbd doctor` | ✅ Full | Different checks |
| `bd info` | `tbd status` | ⚡ Enhanced | Renamed; works pre-init, shows integrations |
| `bd status` | `tbd stats` | ⚡ Different | Beads aliases status=stats; tbd separates them |
| `bd config` | `tbd config` | ✅ Full | YAML not SQLite |
| `bd compact` | `tbd compact` | 🔄 Future | Deferred |
| `bd prime` | `tbd prime` | ⚡ Partial | No --mcp/--full flags; always outputs full context |
| `bd diagnose` | `tbd doctor` | ✅ Partial | Subset of diagnostics |
| `bd import` | `tbd import` | ✅ Full | Beads JSONL import |
| `bd export` | `tbd export` | 🔄 Future | Can export as JSON |

**Legend:**

- ✅ Full: Complete compatibility

- ✅ Partial: Core functionality, some options differ

- 🔄 Future: Planned for later phase

- ❌ Not planned: Intentionally excluded

### 5.3 Field Mapping

| Beads Field | tbd Field | Notes |
| --- | --- | --- |
| `id` | `id` | New format: `is-xxxx` vs `bd-xxxx` |
| `title` | `title` | Identical |
| `description` | `description` | Identical |
| `type` | `kind` | Renamed for clarity (`type` = entity discriminator) |
| `status` | `status` | See status mapping below |
| `priority` | `priority` | Identical (0-4) |
| `assignee` | `assignee` | Identical |
| `labels` | `labels` | Identical |
| `dependencies` | `dependencies` | Only "blocks" type currently |
| `created_at` | `created_at` | Identical |
| `updated_at` | `updated_at` | Identical |
| `closed_at` | `closed_at` | Identical |
| `due` | `due_date` | Renamed |
| `defer` | `deferred_until` | Renamed |
| `parent` | `parent_id` | Renamed |
| *(implicit)* | `version` | New: conflict resolution |
| *(implicit)* | `type` | New: entity discriminator ("is") |

### 5.4 Status Mapping

| Beads Status | tbd Status | Migration Behavior |
| --- | --- | --- |
| `open` | `open` | Direct mapping |
| `in_progress` | `in_progress` | Direct mapping |
| `blocked` | `blocked` | Direct mapping |
| `deferred` | `deferred` | Direct mapping |
| `closed` | `closed` | Direct mapping |
| `tombstone` | *(deleted)* | Skip on import or move to attic |

**Tombstone handling:**

Beads uses `tombstone` for soft-deleted issues.
tbd options:

1. **Skip on import**: Don’t import tombstoned issues (default)

2. **Import as closed**: Convert to `closed` with label `tombstone`

3. **Import to attic**: Store in `.tbd/data-sync/attic/deleted/`

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

- tbd: File-per-issue in `.tbd/data-sync/issues/`

**Database:**

- Beads: SQLite cache

- tbd: Optional index, rebuildable from files

**Daemon:**

- Beads: Required background daemon

- tbd: No daemon (optional background sync planned)

**Git integration:**

- Beads: Complex worktree setup

- tbd: Simple sync branch

**Conflict handling:**

- Beads: JSONL merge conflicts

- tbd: Field-level merge with attic

**ID format:**

- Beads: `bd-xxxx` (4-6 hex chars, random)

- tbd: Dual ID system
  - Internal: `is-{ulid}` (26 chars, time-sortable)
  - External: `{prefix}-{short}` (4-5 base36 chars, e.g., `bd-a7k2`)
  - Display prefix configurable via `display.id_prefix` config

### 5.6 Compatibility Contract

This section defines the stability guarantees for scripts and tooling that depend on tbd
CLI output.

**Stable (will not change without major version bump):**

- JSON output schema from `--json` flag (additive changes only)

- Exit codes: 0 = success, 1 = error, 2 = usage error

- Initialization error: Commands in uninitialized repos exit with code 1 and message
  `Error: Not a tbd repository (run 'tbd init' or 'tbd import --from-beads' first)`

- Command names and primary flags listed in this spec

- External ID format: `{prefix}-{4-5 base36 chars}` (e.g., `proj-a7k2`)

- Internal ID format: `is-{26 char ulid}` (e.g., `is-01hx5zzkbkactav9wevgemmvrz`)

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

- Display prefix (e.g., `proj-`) set via `display.id_prefix` during init or import

#### Migration Gotchas

1. **IDs are preserved**: Beads `tbd-100` becomes `bd-100` (same short ID!)
   - Internal ID is ULID-based: `is-01hx5zzkbk...`
   - Short ID is preserved: `100`
   - Set `display.id_prefix: tbd` to keep exact same display format
   - Commit messages and documentation references remain valid

2. **No daemon**: Background sync must be manual or cron-based

3. **No auto-flush**: Beads auto-syncs on write
   - tbd syncs on `tbd sync` or with `settings.auto_sync: true` in config

4. **Tombstone issues**: Decide import behavior (skip/convert/attic)

* * *

## 6. Implementation Notes

### 6.1 Performance Optimization

#### Query Index

> **Note:** This optional caching layer is not currently implemented.
> The current implementation scans issue files directly on each query.

**Optional caching layer** (potential future feature):

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
  last_updated: string; // ISO8601 timestamp
  baseline_commit: string; // Git commit hash this index was built from
}
```

> **Note:** Index uses plain objects and arrays (JSON-serializable), not Map/Set.
> Arrays are kept sorted for deterministic serialization.

**Checksum strategy:**

The index freshness is determined by comparing `baseline_commit` to the current
`tbd-sync` branch HEAD:

```bash
# Check if index is fresh
CURRENT=$(git rev-parse tbd-sync)
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

4. Store index in a local file (gitignored, never synced)

**Performance targets:**

- Cold start (no index): <500ms for 5,000 issues

- Warm start (index hit): <50ms for common queries

- Index rebuild: <1s for 10,000 issues

- Incremental update: <100ms for typical sync (10-50 changed files)

**Incremental operations:** Common operations like `tbd list`, `tbd ready`, and
`tbd sync --status` use the index and diff-based updates to meet performance targets
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

**Beads → tbd migration workflow:**

```bash
# 1. Final Beads sync (stop daemon first)
bd sync

# 2. Import issues to tbd (auto-initializes if needed)
tbd import --from-beads --verbose

# 3. Disable Beads (moves files to .beads-disabled/)
tbd setup beads --disable               # Preview what will be moved
tbd setup beads --disable --confirm     # Actually disable

# 4. Install tbd integrations
tbd setup claude                        # Claude Code hooks
tbd setup codex                         # AGENTS.md (for Codex, Cursor, etc.)

# 5. Verify and commit
tbd stats
git add .tbd/ && git commit -m "Migrate from Beads to tbd"
git push origin tbd-sync
```

**What `tbd setup beads --disable` does:**

The command safely moves all Beads files to `.beads-disabled/` for potential rollback:

| Source | Destination | Description |
| --- | --- | --- |
| `.beads/` | `.beads-disabled/.beads/` | Beads data and config |
| `.beads-hooks/` | `.beads-disabled/.beads-hooks/` | Beads git hooks |
| `.cursor/rules/beads.mdc` | `.beads-disabled/.cursor/rules/beads.mdc` | Cursor rules |
| `.claude/settings.local.json` | `.beads-disabled/.claude/settings.local.json` | Backup (bd hooks removed) |
| `AGENTS.md` | `.beads-disabled/AGENTS.md` | Backup (Beads section removed) |
| `.gitattributes` | `.beads-disabled/.gitattributes` | Backup (beads merge driver lines removed) |

To restore Beads, move files back from `.beads-disabled/`.

**Gradual rollout alternative:**

- Keep Beads running alongside tbd initially (don’t run `tbd setup beads --disable`)

- Compare outputs (`bd list` vs `tbd list`)

- Migrate one team/agent at a time

- Run `tbd setup beads --disable --confirm` for full cutover when confident

### 6.4 Installation and Agent Integration

tbd is distributed as an npm package (`get-tbd`), enabling simple installation across
all environments including cloud sandboxes.

#### 6.4.1 Installation Methods

| Method | Command | Best For |
| --- | --- | --- |
| **npm** (primary) | `npm install -g get-tbd` | Most users, cloud environments |
| **npx** (no install) | `npx get-tbd <command>` | One-off usage, testing |
| **From source** | `pnpm install && pnpm build` | Contributors |

**npm is the recommended approach** because:

- Works in all environments (local, CI, Claude Code Cloud)
- Cross-platform (macOS, Linux, Windows)
- Version management via package.json
- No compilation required

#### 6.4.2 Claude Code Integration

Claude Code hooks are always installed to the **project-local** `.claude/` directory,
adjacent to `.git/` and `.tbd/` at the git repository root.
There is no global/user-level installation — this avoids confusion and ensures hooks
work in any environment (local dev, Claude Code Cloud, etc.).

**A. JSON Settings Hooks** (installed to `.claude/settings.json` at project root)

```json
{
  "hooks": {
    "SessionStart": [{
      "matcher": "",
      "hooks": [{ "type": "command", "command": "bash .claude/scripts/tbd-session.sh" }]
    }],
    "PreCompact": [{
      "matcher": "",
      "hooks": [{ "type": "command", "command": "bash .claude/scripts/tbd-session.sh --brief" }]
    }],
    "PostToolUse": [{
      "matcher": "Bash",
      "hooks": [{ "type": "command", "command": "\"$CLAUDE_PROJECT_DIR\"/.claude/hooks/tbd-closing-reminder.sh" }]
    }]
  }
}
```

- **SessionStart**: Ensures tbd is installed, then runs `tbd prime` for workflow context
- **PreCompact**: Runs `tbd prime --brief` before context compaction
- **PostToolUse**: Reminds about `tbd sync` after `git push`

All hook commands use project-relative paths (e.g.,
`bash .claude/scripts/tbd-session.sh`) so they work regardless of where tbd was
installed globally.

**B. Session Script** (installed to `.claude/scripts/tbd-session.sh`)

The session script handles tbd CLI installation (if missing) and runs `tbd prime`. It is
committed to the repo so cloud environments bootstrap automatically.

**Setup command:**

```bash
tbd setup --auto --prefix=myapp   # Fresh project: initialize + configure hooks
tbd setup --auto                  # Existing project: update hooks and skill files
```

Setup requires a git repository.
Running `tbd setup` outside a git repo produces an error.
When run from a subdirectory, setup resolves to the git root so `.tbd/` and `.claude/`
are always placed adjacent to `.git/`.

#### 6.4.3 The `tbd prime` Command

The `tbd prime` command outputs workflow context for AI agents.
It’s designed to be called by hooks at session start and before context compaction to
ensure agents remember the tbd workflow.

```bash
tbd prime [options]

Options:
  --export        Output default content (ignores PRIME.md override)
```

**Behavior:**

- **Silent exit** (code 0, no stderr) if not in a tbd project
- **Custom override**: Users can place `.tbd/PRIME.md` to fully customize output

**Output** (~1-2k tokens, full command reference):

```markdown
# tbd Workflow Context

> **Context Recovery**: Run `tbd prime` after compaction, clear, or new session
> Hooks auto-call this in Claude Code when .tbd/ detected

# SESSION CLOSING PROTOCOL

**CRITICAL**: Before saying "done" or "complete", you MUST run this checklist:

[ ] 1. git status              (check what changed)
[ ] 2. git add <files>         (stage code changes)
[ ] 3. tbd sync                (commit tbd changes)
[ ] 4. git commit -m "..."     (commit code)
[ ] 5. tbd sync                (commit any new tbd changes)
[ ] 6. git push                (push to remote)

**NEVER skip this.** Work is not done until pushed.

## Core Rules
- Track strategic work in tbd (multi-session, dependencies, discovered work)
- Use `tbd create` for issues, TodoWrite for simple single-session execution
- When in doubt, prefer tbd—persistence you don't need beats lost context
- Git workflow: run `tbd sync` at session end
- Session management: check `tbd ready` for available work

## Essential Commands

### Finding Work
- `tbd ready` - Show issues ready to work (no blockers)
- `tbd list --status open` - All open issues
- `tbd list --status=in_progress` - Your active work
- `tbd show <id>` - Detailed issue view with dependencies

### Creating & Updating
- `tbd create "title" --type=task|bug|feature --priority=P2` - New issue
  - Priority: P0-P4 (P0=critical, P2=medium, P4=backlog)
- `tbd update <id> --status=in_progress` - Claim work
- `tbd update <id> --assignee username` - Assign to someone
- `tbd close <id>` - Mark complete
- `tbd close <id> --reason "explanation"` - Close with reason

### Dependencies & Blocking
- `tbd dep add <issue> <depends-on>` - Add dependency
- `tbd blocked` - Show all blocked issues
- `tbd show <id>` - See what's blocking/blocked by this issue

### Sync & Collaboration
- `tbd sync` - Sync with git remote (run at session end)
- `tbd sync --status` - Check sync status without syncing

### Project Health
- `tbd stats` - Project statistics (open/closed/blocked counts)
- `tbd doctor` - Check for issues (sync problems, health checks)

## Common Workflows

**Starting work:**
tbd ready           # Find available work
tbd show <id>       # Review issue details
tbd update <id> --status=in_progress  # Claim it

**Completing work:**
tbd close <id>      # Mark complete
tbd sync            # Push to remote

**Creating dependent work:**
tbd create "Implement feature X" --type=feature
tbd create "Write tests for X" --type=task
tbd dep add <tests-id> <feature-id>  # Tests depend on feature
```

**Custom Override:**

Users can place a `.tbd/PRIME.md` file to fully customize the output.
When this file exists, `tbd prime` outputs its contents instead of the default.
Use `--export` to see the default content for customization:

```bash
# Export default content to customize
tbd prime --export > .tbd/PRIME.md
# Edit .tbd/PRIME.md to add project-specific instructions
```

**Key design principle:** Global hooks + project-aware logic.
The hooks run on every session, but `tbd prime` only outputs context when `.tbd/`
exists. This creates a “just works” experience without breaking non-tbd projects.

#### 6.4.4 Other Editor Integrations

**Cursor IDE and AGENTS.md-compatible tools:**

Cursor (v1.6+) and other AGENTS.md-compatible tools read the `AGENTS.md` file
automatically. Run `tbd setup codex` to create/update AGENTS.md with tbd instructions.

**Generic (any editor):**

For editors without specific integration, add to your project’s `AGENTS.md`:

```markdown
## Issue Tracking

This project uses tbd for issue tracking:

- Find work: `tbd ready`
- Create issues: `tbd create "title" --type=task`
- Claim work: `tbd update <id> --status=in_progress`
- Complete: `tbd close <id>`
- Sync: `tbd sync`
```

#### 6.4.5 Cloud Environment Bootstrapping

For fresh cloud environments (Claude Code Cloud, GitHub Codespaces, etc.), commit the
bootstrap script to your repository:

```bash
# .claude/hooks/session-start.sh
#!/bin/bash
command -v tbd &>/dev/null || npm install -g get-tbd --quiet
[ -d ".tbd" ] && tbd prime
```

Make it executable:

```bash
chmod +x .claude/hooks/session-start.sh
git add .claude/hooks/session-start.sh
git commit -m "Add tbd bootstrap for cloud environments"
```

**Why npm over direct binary download?**

| Criterion | npm | Direct Download |
| --- | --- | --- |
| Lines of code | 2 | 25+ |
| Dependencies | npm (always present) | curl, tar |
| Version management | Automatic | Manual |
| Error handling | Built-in | Must implement |
| Cross-platform | Automatic | Must detect OS/arch |

Direct binary download is faster (~~3s vs ~~5-10s) but adds complexity.
Use npm unless you have specific requirements.

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

#### Decision 2: No daemon required

**Choice**: Optional daemon, not required

**Rationale**:

- Simpler architecture

- Fewer failure modes

- Works in restricted environments (CI, cloud sandboxes)

- Manual sync is predictable

**Tradeoffs**:

- No automatic background sync

- Users must run `tbd sync` manually or via cron

#### Decision 3: Sync branch instead of main

**Choice**: Dedicated `tbd-sync` branch

**Rationale**:

- No merge conflicts on feature branches

- Clean separation of concerns

- Easy to allow-list in sandboxed environments

- Issues shared across all code branches

**Tradeoffs**:

- Slightly more complex git setup

- Users must understand two branches

#### Decision 4: Dual ID system (ULID + short base36)

**Choice**: Internal IDs use ULID (`is-{ulid}`), external IDs use short base36
(`{prefix}-{short}`)

**Rationale**:

- **Time-ordered sorting**: ULIDs sort chronologically, useful for debugging and
  listings
- **No collisions**: ULID’s 80-bit randomness eliminates collision retry logic
- **Cross-project merging**: Multiple projects can merge their issues without internal
  ID collisions (external IDs may need different prefixes)
- **Human-friendly**: Short base36 IDs (4-5 chars) are easy to type and remember
- **Permanent references**: External IDs are stable for docs, commits, external systems
- **Beads compatibility**: Configurable display prefix (`bd-`) for migration

**Tradeoffs**:

- Two ID formats to understand (internal vs external)
- Mapping file adds small complexity
- Longer internal IDs in file paths

**Mitigations**:

- Users only interact with short external IDs
- Mapping file syncs automatically
- ULID sorting benefits outweigh longer paths

#### Decision 5: Only “blocks” dependencies

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
We adopt this approach.

**Prior art**:

- ticket (~1400 GitHub stars): YAML front matter + Markdown body

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

**Context**: tbd stores issues on a sync branch (`tbd-sync`) that’s separate from the
user’s working branch.
We need a way to access and search sync branch content without affecting the user’s
checkout.

**Alternatives Considered**:

1. **Isolated index (`GIT_INDEX_FILE`)**: Use git plumbing with isolated index

   - Pro: Minimal disk usage, no extra checkout

   - Con: Files not accessible to ripgrep/grep for searching

2. **Sparse checkout**: Checkout only `.tbd/data-sync/` directory

   - Pro: Files accessible, minimal overhead

   - Con: Pollutes user’s working directory, shows in `git status`

3. **Hidden worktree**: Separate checkout at `.tbd/data-sync-worktree/`

   - Pro: Files accessible for search, isolated from user’s work

   - Con: Additional disk space for second checkout

**Rationale for Hidden Worktree**:

- **Search integration**: ripgrep/grep work directly on issue files

- **User isolation**: Hidden in `.tbd/`, doesn’t pollute working directory

- **Git-native**: Uses standard `git worktree` mechanics

- **Clean status**: Gitignored, doesn’t appear in user’s `git status`

**Implementation Notes**:

- Worktree created at `.tbd/data-sync-worktree/`

- Worktree directory added to `.tbd/.gitignore`

- `tbd init` creates worktree automatically

- Worktree kept in sync via `tbd sync` commands

- **No silent fallback**: If worktree is missing, commands error with repair
  instructions (see §2.3.5 Path Terminology and Resolution)

**Tradeoffs**:

- Additional disk space (~2x issue storage)

- Worktree must be kept in sync

- Edge case: stale worktree if not synced recently

- Edge case: worktree can become “prunable” if directory deleted outside of git

**Mitigations**:

- Search commands auto-refresh if worktree is stale

- `tbd doctor` detects and repairs worktree issues (see §4.9)

- `tbd sync --fix` repairs worktree before syncing

- Space overhead is minimal (issues are small files)

- Clear error messages guide users to repair commands

### 7.2 Future Enhancements

#### Additional Dependency Types (High Priority)

Currently only `blocks` dependencies are supported.
Future versions should add:

**`related`**: Link related issues without blocking semantics

- Use case: “See also” references, grouping related work

- No effect on `ready` command

**`discovered-from`**: Track issue provenance

- Use case: When working on issue A, agent discovers issue B

- Pattern: `tbd create "Found bug" --deps discovered-from:<parent-id>`

- Common in Beads workflows for linking discovered work to parent issues

**Implementation**: Extend `Dependency.type` enum, update CLI `--deps` parsing.
No changes to sync algorithm needed.

#### Ripgrep-Based Search (Performance)

Currently search loads all issues into memory and filters with JavaScript string
matching. For large repositories (10K+ issues), this could be optimized:

**Approach:**

1. If `rg` (ripgrep) is available, use it for initial pattern matching
2. Fall back to `grep -r` if ripgrep unavailable
3. Emit warning on first fallback: “ripgrep not found, using grep (slower)”

**Benefits:**

- Faster initial pattern matching (ripgrep is highly optimized)
- Lower memory usage (don’t load all issues upfront)
- Context lines support (`-C` flag)
- External commands visible in `--verbose` mode for debugging

**Implementation:**

```bash
rg -i -C 2 --type md "pattern" .tbd/data-sync-worktree/.tbd/data-sync/issues/
```

Post-process results to:
- Map file paths to issue IDs
- Apply field filters (title, description, notes)
- Apply status/type/label filters by reading matched files

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

**Complete file tree after `tbd init`:**

```
repo/
├── .git/
├── .tbd/                         # On main branch
│   ├── config.yml                  # Tracked: project config
│   ├── .gitignore                  # Tracked: ignores docs/, state.yml, data-sync-worktree/, data-sync/
│   ├── docs/                       # Gitignored: installed documentation
│   ├── state.yml                   # Gitignored: local state (sync timestamps)
│   └── data-sync-worktree/         # Gitignored: worktree checkout of tbd-sync
│
└── (on tbd-sync branch)
    └── .tbd/
        └── data-sync/
            ├── issues/                 # Issue entities (ULID-named files)
            │   ├── is-01hx5zzkbkactav9wevgemmvrz.md
            │   └── is-01hx5zzkbkbctav9wevgemmvrz.md
            ├── mappings/               # ID mappings
            │   └── ids.yml            # short → ULID (preserves import IDs)
            ├── attic/                  # Conflict archive
            │   └── conflicts/
            │       └── is-01hx5zzkbkactav9wevgemmvrz/
            │           └── 2025-01-07T10-30-00Z_description.yml
            └── meta.yml               # Metadata
```

**File counts (example with 1,000 issues):**

| Location | Files | Size |
| --- | --- | --- |
| `.tbd/` | 3 | <1 KB |
| `.tbd/docs/` | ~30 | ~100 KB |
| `.tbd/data-sync/issues/` | 1,000 | ~2 MB |
| `.tbd/data-sync/attic/` | 10-50 | <100 KB |

* * *

## Appendix A: Beads to tbd Feature Mapping

This appendix provides a comprehensive mapping between Beads and tbd for migration
planning and compatibility reference.

### A.1 Executive Summary

tbd provides CLI-level compatibility with Beads for core issue tracking while
simplifying the architecture:

| Aspect | Beads | tbd |
| --- | --- | --- |
| Data locations | 4 (SQLite, local JSONL, sync branch, main) | 2 (files on sync branch, config on main) |
| Storage | SQLite + JSONL | Markdown + YAML (file-per-entity) |
| Daemon | Required (recommended) | Not required |
| Agent coordination | External (Agent Mail) | Deferred |
| Comments | Embedded in issue | Deferred |
| Conflict resolution | 3-way merge | Git-based detection + field-level LWW + attic |

**Core finding:** All essential Beads issue-tracking workflows have direct CLI
equivalents in tbd.
Advanced features (agent coordination, templates, real-time sync) are
explicitly deferred.

### A.2 CLI Command Mapping

#### A.2.1 Issue Commands (Full Parity)

| Beads Command | tbd Command | Status | Notes |
| --- | --- | --- | --- |
| `bd create "Title"` | `tbd create "Title"` | ✅ Full | Identical |
| `bd create "Title" --type type` | `tbd create "Title" --type type` | ✅ Full | Same flag |
| `bd create "Title" --priority N` | `tbd create "Title" --priority N` | ✅ Full | Priority 0-4 |
| `bd create "Title" --description "desc"` | `tbd create "Title" --description "desc"` | ✅ Full | Description |
| `bd create "Title" --file file.md` | `tbd create "Title" --file file.md` | ✅ Full | Body from file |
| `bd create "Title" --label label` | `tbd create "Title" --label label` | ✅ Full | Repeatable |
| `bd create "Title" --assignee X` | `tbd create "Title" --assignee X` | ✅ Full | Identical |
| `bd create "Title" --parent=<id>` | `tbd create "Title" --parent=<id>` | ✅ Full | Hierarchical |
| `bd create "Title" --due <date>` | `tbd create "Title" --due <date>` | ✅ Full | Due date |
| `bd create "Title" --defer <date>` | `tbd create "Title" --defer <date>` | ✅ Full | Defer until |
| `bd list` | `tbd list` | ✅ Full | Identical |
| `bd list --status X` | `tbd list --status X` | ✅ Full | Identical |
| `bd list --type X` | `tbd list --type X` | ✅ Full | Identical |
| `bd list --priority N` | `tbd list --priority N` | ✅ Full | Identical |
| `bd list --assignee X` | `tbd list --assignee X` | ✅ Full | Identical |
| `bd list --label X` | `tbd list --label X` | ✅ Full | Repeatable |
| `bd list --parent=<id>` | `tbd list --parent=<id>` | ✅ Full | List children |
| `bd list --deferred` | `tbd list --deferred` | ✅ Full | Deferred issues |
| `bd list --sort X` | `tbd list --sort X` | ✅ Full | priority/created/updated |
| `bd list --limit N` | `tbd list --limit N` | ✅ Full | Identical |
| `bd list --json` | `tbd list --json` | ✅ Full | JSON output |
| `bd show <id>` | `tbd show <id>` | ✅ Full | Identical |
| `bd update <id> --status X` | `tbd update <id> --status X` | ✅ Full | Identical |
| `bd update <id> --priority N` | `tbd update <id> --priority N` | ✅ Full | Identical |
| `bd update <id> --assignee X` | `tbd update <id> --assignee X` | ✅ Full | Identical |
| `bd update <id> --description X` | `tbd update <id> --description X` | ✅ Full | Identical |
| `bd update <id> --type X` | `tbd update <id> --type X` | ✅ Full | Identical |
| `bd update <id> --due <date>` | `tbd update <id> --due <date>` | ✅ Full | Identical |
| `bd update <id> --defer <date>` | `tbd update <id> --defer <date>` | ✅ Full | Identical |
| `bd update <id> --parent=<id>` | `tbd update <id> --parent=<id>` | ✅ Full | Identical |
| `bd close <id>` | `tbd close <id>` | ✅ Full | Identical |
| `bd close <id> --reason "X"` | `tbd close <id> --reason "X"` | ✅ Full | With reason |
| `bd reopen <id>` | `tbd reopen <id>` | ✅ Full | Identical |
| `bd ready` | `tbd ready` | ✅ Full | Identical algorithm |
| `bd blocked` | `tbd blocked` | ✅ Full | Shows blockers |

#### A.2.2 Label Commands (Full Parity)

| Beads Command | tbd Command | Status | Notes |
| --- | --- | --- | --- |
| `bd label add <id> <label>` | `tbd label add <id> <label>` | ✅ Full | Identical |
| `bd label remove <id> <label>` | `tbd label remove <id> <label>` | ✅ Full | Identical |
| `bd label list` | `tbd label list` | ✅ Full | All labels in use |

Also available via update: `tbd update <id> --add-label X` and `--remove-label X`

#### A.2.3 Dependency Commands (Partial - blocks only)

| Beads Command | tbd Command | Status | Notes |
| --- | --- | --- | --- |
| `bd dep add <a> <b>` | `tbd dep add <id> <target>` | ✅ Full | Default: blocks |
| `bd dep add <a> <b> --type blocks` | `tbd dep add <id> <target> --type blocks` | ✅ Full | Identical |
| `bd dep add <a> <b> --type related` | *(not yet)* | ⏳ Future | Only blocks |
| `bd dep add <a> <b> --type discovered-from` | *(not yet)* | ⏳ Future | Only blocks |
| `bd dep remove <a> <b>` | `tbd dep remove <id> <target>` | ✅ Full | Identical |
| `bd dep tree <id>` | `tbd dep tree <id>` | 🔄 Future | Visualize deps |

**Note:** Currently supports only `blocks` dependency type.
This is sufficient for the `ready` command algorithm.
`related` and `discovered-from` are planned for the future.

#### A.2.4 Sync Commands (Full Parity)

| Beads Command | tbd Command | Status | Notes |
| --- | --- | --- | --- |
| `bd sync` | `tbd sync` | ✅ Full | Pull then push |
| `bd sync --pull` | `tbd sync --pull` | ✅ Full | Pull only |
| `bd sync --push` | `tbd sync --push` | ✅ Full | Push only |
| *(no equivalent)* | `tbd sync --status` | ✅ New | Show pending changes |

#### A.2.5 Maintenance Commands (Full Parity)

| Beads Command | tbd Command | Status | Notes |
| --- | --- | --- | --- |
| `bd init` | `tbd init` | ✅ Full | Identical |
| `bd info` | `tbd status` | ⚡ Enhanced | Renamed; works pre-init, shows integrations |
| `bd status` | `tbd stats` | ⚡ Different | Beads aliases status=stats; tbd separates them |
| *(no equivalent)* | `tbd status` | ✅ New | Works pre-init, detects beads, shows integrations |
| `bd doctor` | `tbd doctor` | ✅ Full | Health checks |
| `bd doctor --fix` | `tbd doctor --fix` | ✅ Full | Auto-fix |
| `bd stats` | `tbd stats` | ✅ Full | Issue statistics |
| `bd import` | `tbd import <file>` | ✅ Full | Beads JSONL import |
| `bd export` | *(not yet)* | ⏳ Future | Files are the format |
| `bd config` | `tbd config` | ✅ Full | YAML config |
| `bd compact` | *(not yet)* | ⏳ Future | Memory decay |

#### A.2.6 Global Options (Full Parity)

| Beads Option | tbd Option | Status | Notes |
| --- | --- | --- | --- |
| `--json` | `--json` | ✅ Full | JSON output |
| `--help` | `--help` | ✅ Full | Help text |
| `--version` | `--version` | ✅ Full | Version info |
| `--db <path>` | `--db <path>` | ✅ Full | Custom .tbd path |
| `--no-sync` | `--no-sync` | ✅ Full | Skip auto-sync |
| `--actor <name>` | `--actor <name>` | 🔄 Future | Override actor |
| *(n/a)* | `--dry-run` | ✅ tbd | Preview changes |
| *(n/a)* | `--verbose` | ✅ tbd | Debug output |
| *(n/a)* | `--quiet` | ✅ tbd | Minimal output |
| *(n/a)* | `--non-interactive` | ✅ tbd | Agent/CI mode |
| *(n/a)* | `--yes` | ✅ tbd | Auto-confirm |
| *(n/a)* | `--color <when>` | ✅ tbd | Color control |

### A.3 Data Model Mapping

#### A.3.1 Issue Schema

| Beads Field | tbd Field | Status | Notes |
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
| `dependencies` | `dependencies` | ✅ | Only `blocks` currently |
| `parent_id` | `parent_id` | ✅ | Identical |
| *(n/a)* | `spec_path` | ✅ | New: links to spec docs |
| `created_at` | `created_at` | ✅ | Identical |
| `updated_at` | `updated_at` | ✅ | Identical |
| `created_by` | `created_by` | ✅ | Identical |
| `closed_at` | `closed_at` | ✅ | Identical |
| `close_reason` | `close_reason` | ✅ | Identical |
| `due` | `due_date` | ✅ | Renamed |
| `defer` | `deferred_until` | ✅ | Renamed |
| *(implicit)* | `version` | ✅ | New: conflict resolution |
| *(implicit)* | `type` | ✅ | New: entity discriminator ("is") |
| `comments` | *(future)* | ⏳ | Separate messages entity |

#### A.3.2 Status Values

| Beads Status | tbd Status | Migration |
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

| Beads Type | tbd Kind | Status |
| --- | --- | --- |
| `bug` | `bug` | ✅ |
| `feature` | `feature` | ✅ |
| `task` | `task` | ✅ |
| `epic` | `epic` | ✅ |
| `chore` | `chore` | ✅ |
| `message` | *(future)* | ⏳ Separate entity |
| `agent` | *(future)* | ⏳ Separate entity |

#### A.3.4 Dependency Types

> **See also:** [§2.7 Relationship Types](#27-relationship-types) for detailed
> documentation of tbd’s relationship model, including rationale for differences from
> Beads.

| Beads Type | tbd Type | Status | Notes |
| --- | --- | --- | --- |
| `blocks` | `blocks` | ✅ Supported | Identical semantics |
| `related` | `related` | ⏳ Future | Non-blocking soft links |
| `discovered-from` | `discovered-from` | ⏳ Future | Provenance tracking |
| `parent-child` | `parent_id` field | ✅ Different model | See below |

**Parent-child model difference:**

- **Beads**: `parent-child` enables **transitive blocking**—if a parent is blocked (by a
  `blocks` dependency), children inherit that blockage.
  Children are NOT blocked just because their parent is open.
  (See `attic/beads/internal/storage/sqlite/blocked_cache.go` for implementation
  details.)
- **tbd**: `parent_id` is a separate field for **organizational hierarchy only** (no
  blocking effects, no transitive propagation)

This is intentional—tbd’s simpler model avoids hidden transitive effects while still
allowing organizational hierarchy.
See [§2.7.7](#277-future-transitive-blocking-option) for discussion of adding opt-in
transitive blocking in the future.

### A.4 Architecture Comparison

#### A.4.1 Storage

| Aspect | Beads | tbd |
| --- | --- | --- |
| Primary store | SQLite | Markdown + YAML files |
| Sync format | JSONL | Markdown + YAML (same as primary) |
| File structure | Single `issues.jsonl` | File per entity |
| Location | `.beads/` on main | `.tbd/data-sync/` on sync branch |
| Config | SQLite + various | `.tbd/config.yml` on main |

#### A.4.2 Sync

| Aspect | Beads | tbd |
| --- | --- | --- |
| Mechanism | SQLite ↔ JSONL ↔ git | Files ↔ git |
| Branch | Main or sync branch | Sync branch only |
| Conflict detection | 3-way (base, local, remote) | Git push rejection |
| Conflict resolution | LWW + union | LWW + union (same strategies) |
| Conflict preservation | Partial | Full (attic) |
| Daemon required | Yes (recommended) | No |

### A.5 LLM Agent Workflow Comparison

#### A.5.1 Basic Agent Loop (Full Parity)

**Beads:**

```bash
bd ready --json              # Find work
bd update <id> --status=in_progress  # Claim (advisory)
# ... work ...
bd close <id> --reason "Done"  # Complete
bd sync                       # Sync
```

**tbd:**

```bash
tbd ready --json            # Find work
tbd update <id> --status=in_progress  # Claim (advisory)
# ... work ...
tbd close <id> --reason "Done"  # Complete
tbd sync                    # Sync
```

**Assessment:** ✅ Identical workflow.
Claims are advisory in both (no enforcement).

#### A.5.2 Creating Linked Work (Partial Parity)

**Beads:**

```bash
bd create "Found bug" --type=bug --priority=P1 --deps discovered-from:<id> --json
```

**tbd:**

```bash
# Only blocks dependency supported currently
tbd create "Found bug" --type=bug --priority=P1 --parent=<id> --json
# Or wait for future version for discovered-from
```

**Assessment:** ⚠️ `discovered-from` dependency not yet available.
Use `--parent` or wait for a future version.

#### A.5.3 Migration Workflow

```bash
# Export from Beads
bd export -o beads-export.jsonl

# In target repo
tbd init
tbd import beads-export.jsonl  # Converts format
git add .tbd/
git commit -m "Initialize tbd from beads"
tbd sync

# Configure display prefix for familiarity
tbd config display.id_prefix bd
```

### A.6 Parity Summary

| Category | Parity | Notes |
| --- | --- | --- |
| Issue CRUD | ✅ Full | All core operations |
| Labels | ✅ Full | Add, remove, list |
| Dependencies | ⚠️ Partial | Only `blocks` type |
| Sync | ✅ Full | Pull, push, status |
| Maintenance | ✅ Full | Init, doctor, stats, config |
| Import | ✅ Full | Beads JSONL + multi-source |

### A.7 Deferred Features

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

**Overall assessment:** tbd provides sufficient feature parity for LLM agents to migrate
from Beads for basic issue tracking.
The simpler architecture (no SQLite, no daemon, file-per-entity) addresses the key pain
points from real-world Beads use.

* * *

## Appendix B: Beads Commands Not Included

This appendix provides a comprehensive list of Beads commands and features that are
explicitly **not** included in tbd.

### B.1 Daemon Commands

These commands are not applicable since tbd has no daemon:

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

Workflow orchestration features are deferred to future:

| Beads Command | Why Not Included |
| --- | --- |
| `bd mol pour` | Template instantiation - future |
| `bd mol wisp` | Ephemeral work tracking - future |
| `bd mol bond` | Workflow composition - future |
| `bd mol squash` | Compress to digest - future |
| `bd mol burn` | Discard wisp - future |
| `bd mol wisp list` | Wisp management - future |
| `bd mol wisp gc` | Garbage collection - future |
| `bd mol distill` | Extract template - future |
| `bd mol show` | Template inspection - future |
| `bd formula list` | Template listing - future |

### B.3 Agent Coordination Commands

Real-time agent coordination is deferred:

| Beads Command | Why Not Included |
| --- | --- |
| `bd agent register` | Agent registry - future |
| `bd agent heartbeat` | Presence tracking - future |
| `bd agent claim` | Atomic claims - future |
| Agent Mail | Real-time messaging - future |

### B.4 Advanced Data Operations

| Beads Command | Why Not Included |
| --- | --- |
| `bd compact` | Memory decay - future |
| `bd compact --auto` | AI-powered compaction - future |
| `bd admin cleanup` | Bulk deletion - future |
| `bd duplicates` | Duplicate detection - not planned |
| `bd merge` | Merge duplicates - not planned |
| `bd rename-prefix` | ID prefix rename - low priority |

### B.5 Comment Commands

Comments will be a separate entity type in the future:

| Beads Command | Why Not Included |
| --- | --- |
| `bd comment add` | Comments entity - future |
| `bd comment list` | Comments entity - future |
| `bd comments show` | Comments entity - future |

### B.6 Editor Integration Commands

| Beads Command | tbd Equivalent | Status |
| --- | --- | --- |
| `bd setup claude` | `tbd setup claude` | ✅ Implemented |
| `bd setup cursor` | `tbd setup cursor` | ✅ Implemented |
| `bd setup aider` | *(not implemented)* | Not planned |
| `bd setup factory` | `tbd setup codex` | ✅ Implemented (renamed) |
| `bd edit` | *(not implemented)* | Not planned (use `tbd show` + editor) |

### B.7 Additional Dependency Types

> **See also:** [§2.7 Relationship Types](#27-relationship-types) for tbd’s complete
> relationship model.

Currently only `blocks` is supported.
Based on real-world Beads usage data:

| Beads Type | Usage | tbd Status | Rationale |
| --- | --- | --- | --- |
| `blocks` | 47% | ✅ Supported | Core workflow dependency |
| `parent-child` | 42% | ✅ Via `parent_id` | Different model (non-blocking) |
| `discovered-from` | 11% | 🔜 Planned | Useful for provenance tracking |
| `related` | <1% | ⏳ Future | Rarely used in practice |
| `waits-for` | — | ⏳ Future | Fanout gates (advanced) |
| `conditional-blocks` | — | ⏳ Future | Error handling (advanced) |

**Note:** In Beads, `parent-child` enables transitive blocking (if parent is blocked,
children inherit that blockage), while tbd’s `parent_id` is purely organizational with
no blocking effects.
See [§2.7.5](#275-comparison-with-beads) for details.

### B.8 State Label Commands

| Beads Command | Why Not Included |
| --- | --- |
| `bd state` | Label-as-cache pattern - not planned |
| `bd set-state` | Label-as-cache pattern - not planned |

### B.9 Other Commands

| Beads Command | Why Not Included |
| --- | --- |
| `bd audit` | Audit trail command - use git log |
| `bd activity` | Activity feed - not planned |
| `bd context` | Context management - not planned |
| `bd migrate` | SQLite migration - not applicable |
| `bd export` | Files are the format - future (JSONL export) |
| `bd cook` | Internal command - not applicable |

### B.10 Global Flags Not Supported

| Beads Flag | Why Not Included |
| --- | --- |
| `--no-daemon` | No daemon to disable |
| `--no-auto-flush` | No auto-flush mechanism |
| `--no-auto-import` | Different sync model |
| `--sandbox` | tbd is always "sandbox safe" |
| `--allow-stale` | Different staleness model |

### B.11 Issue Types/Statuses Not Supported

| Beads Value | Why Not Included |
| --- | --- |
| `issue_type: message` | Messages are future |
| `issue_type: agent` | Agent registry is future |
| `issue_type: role` | Advanced orchestration |
| `issue_type: convoy` | Advanced orchestration |
| `issue_type: molecule` | Workflow templates |
| `issue_type: gate` | Async gates |
| `issue_type: merge-request` | External integration |
| `status: pinned` | Convert to label on import |
| `status: hooked` | Convert to label on import |

* * *

## 8. Open Questions

These items from the design review need further discussion before implementation.
See `tbd-design-v2-phase1-tracking.md` for full context.

### 8.1 Actor System Design

**Status:** Partially designed, not implemented.

The actor system tracks who creates and modifies issues.
Current implementation status:

**Implemented:**
- Schema fields: `created_by` and `assignee` exist in IssueSchema
- CLI option: `--assignee` can be set when creating/updating issues
- Display: `assignee` shown in list and show commands

**NOT Implemented:**
- `created_by` field is never populated when creating issues
- `--actor` CLI flag does not exist
- `TBD_ACTOR` environment variable not checked
- No git user.email fallback for actor resolution
- No system username fallback

**Design Questions:**

1. **Actor vs Assignee distinction:**
   - `created_by`: Who created the issue (tracked automatically)
   - `assignee`: Who is working on it (set explicitly)
   - Should these always use the same resolution?

2. **Multi-agent workflows:**
   - Should agents be assigned random ULID-based actor IDs?
   - How should agents claim/release issues?
   - Is advisory claiming sufficient or do we need atomic claims?

3. **Actor resolution order:**
   - Design doc specifies: `--actor` > `TBD_ACTOR` > git user.email > username+hostname
   - Is this order correct?
     Should git user.name be considered?

4. **Sync commit authorship:**
   - Should sync commits use the actor name?
   - How does this interact with git commit signing?

**Recommendation:** Defer full implementation until multi-agent coordination patterns
are better understood.
Current fallback to git user.email is sufficient for single-user and simple multi-agent
scenarios.

### 8.2 Git Operations

**V2-004: Remote vs local branch reference ambiguity**

After `git fetch origin tbd-sync`, should reads use `origin/tbd-sync` (remote tracking)
or local `tbd-sync`? Current spec uses `tbd-sync:` in examples, which may read stale
data if not updated after fetch.

**Options:**

1. Always read from `origin/tbd-sync` after fetch

2. Update local `tbd-sync` ref after fetch, then read from it

3. Document both patterns with guidance on when to use each

### 8.2 Timestamp and Ordering

**V2-012: Clock skew assumptions**

LWW merge relies on `updated_at` timestamps.
Clock skew between machines can cause counterintuitive winners.
The attic preserves losers, but UX may suffer if the “wrong” version consistently wins.

**Options:**

1. Add a note acknowledging the limitation, rely on attic for recovery

2. Implement Hybrid Logical Clocks (HLC) in the future

3. Add optional “prefer remote” or “prefer local” config override

### 8.3 Mapping File Structure

**V2-016: Single mapping file as potential conflict hotspot**

**RESOLVED**: The unified `.tbd/data-sync/mappings/ids.yml` file handles all short ID
mappings (both imported and newly created).
Conflicts are resolved via union merge—since short IDs are unique, adding new mappings
never conflicts with existing ones.

Concurrent imports with the same source would produce identical mappings (idempotent).
Concurrent imports from different sources have distinct short IDs (no conflict).

### 8.4 ID Length

**RESOLVED**: Adopted ULID-based internal IDs.

Internal IDs now use full 26-character ULIDs (128 bits: 48-bit timestamp + 80-bit
randomness). This provides:

- Effectively unlimited ID space (no collision concerns even across merged projects)
- Time-ordered sorting as a bonus
- Human interaction uses short 4-5 character base36 external IDs

The original concern about 6-hex-char limitations is moot with the dual ID system.

### 8.5 Future Extension Points

**Idea 7: Reserve directory structure for future bridges**

Should we reserve `.tbd/outbox/` and `.tbd/inbox/` directories for future bridge runtime
use?

**Options:**

1. Reserve now (empty dirs, documented for future use)

2. Add when needed (avoid premature structure)

> **Note:** The cache/ directory has been removed.
> Any future local state should use `.tbd/` directly with appropriate gitignore entries.

### 8.6 Issue Storage Location

**Hybrid sync branch vs main branch storage**

The current design stores all issues on the `tbd-sync` branch, keeping main branch
clean. However, there may be use cases where some issues should live on the main branch
(e.g., for visibility in PRs, code review context) while others remain on the sync
branch.

**Possible configurations:**

1. **All sync branch** (current design): All issues on `tbd-sync`, main branch stays
   clean. Simplest model, no reconciliation needed.

2. **All main branch**: Issues stored in `.tbd` and/or other folders on main or
   development branches, tracked with code.
   Simpler git model but adds more noise to commit history and creates merge
   complexities.

3. **Status-based split**: Active issues (open, in_progress) on main or development
   branches for visibility; closed/archived issues moved to sync branch automatically.
   tbd enforces the invariant.
   Challenge: What happens when working on different feature branches?
   Need to think through sync behavior.

4. **Gitignored working copies**: Sync branch remains authoritative and complete.
   Allow gitignored copies in a working directory (e.g., `.tbd/local/`) for convenient
   reading and editing.
   A `tbd save` command would push edits from the gitignored copy to the sync branch.
   This avoids reconciliation since sync branch is always the source of truth.

**Considerations:**

- Reconciliation complexity: Having issues in multiple locations creates sync challenges
  (the pain point that motivated moving away from Beads’ 4-location model)

- Branch-specific issues: How do issues get edited and merged on main and feature
  branches? Do they diverge?
  Get merged?

- Visibility vs cleanliness tradeoff: Main branch storage provides GitHub visibility but
  adds noise to diffs and history

**Recommendation:** Defer for now.
The gitignored working copy approach (Option 4) seems promising as it preserves the
single-source-of-truth model while adding convenience.

### 8.7 External Issue Tracker Linking

**Linking tbd issues to GitHub issues (and other providers)**

A common workflow need is linking tbd issues to external issue trackers like GitHub
Issues, Jira, Linear, etc.
This would enable bidirectional sync of status and comments.

**ID Convention Approach:**

If all issue systems use clean, identifiable prefixes with unique patterns, linking
could be convention-based:

- tbd: `is-a1b2c3` internal, `proj-a1b2c3` display (configurable prefix)

- GitHub: `github#456` or `gh#456`

- Jira: `PROJ-123`

- Linear: `LIN-abc`

These patterns are recognizable via regex, allowing automatic detection and linking when
referenced in descriptions, comments, or commit messages.

**Metadata Model:**

Issues could have a `linked` field (or use `extensions`) to store external references:

```yaml
linked:
  - provider: github
    repo: owner/repo
    issue: 456
    synced_at: 2025-01-10T10:00:00Z
  - provider: jira
    project: PROJ
    key: PROJ-123
```

**Sync Behaviors:**

- Closing a tbd issue could automatically close the linked GitHub issue (or vice versa)

- Comments could sync bidirectionally

- Status changes could propagate

- Labels/tags could map between systems

**Implementation Considerations:**

- Provider plugins/adapters for different external systems

- Conflict resolution when both sides change

- Rate limiting and API authentication

- Webhook-driven vs polling sync

- Which system is authoritative for which fields

**Recommendation:** Design the `linked` metadata structure now (even if unused),
implement GitHub bridge later with plugin architecture for other providers.

* * *

**End of tbd Design Specification**
