# Plan Spec: Tbd V1 Complete Implementation

## Purpose

This is the master implementation plan for Tbd V1, a Beads replacement CLI tool for
git-native issue tracking.
This plan covers the complete implementation from initial project setup through a fully
functional CLI with comprehensive golden test coverage.

## Background

**What is Tbd?**

Tbd is an alternative to [Beads](https://github.com/steveyegge/beads) that eliminates
architectural complexity while maintaining CLI compatibility.
Key characteristics:

- **Drop-in replacement**: Compatible with core Beads CLI commands and workflows
- **Simpler architecture**: No daemon, no SQLite, no file locking
- **Git-native**: Uses a dedicated sync branch for coordination data
- **Human-readable format**: Markdown + YAML front matter
- **File-per-entity**: Each issue is a separate `.md` file for fewer merge conflicts
- **Searchable**: Hidden worktree enables fast ripgrep/grep search

**Reference Documentation:**

- @docs/project/architecture/current/tbd-design-v3.md — Complete design specification
- @docs/general/research/current/research-modern-typescript-cli-patterns.md — CLI
  architecture patterns
- @docs/general/research/current/research-modern-typescript-monorepo-patterns.md — Build
  and packaging patterns
- @docs/general/agent-guidelines/golden-testing-guidelines.md — Testing approach

## Summary of Task

Implement Tbd V1 as a TypeScript CLI application following the design specification in
`tbd-design-v3.md`. The implementation includes:

1. **Project Setup**: pnpm monorepo with tsdown, Changesets, and proper package exports
2. **File Layer**: Markdown + YAML parsing, Zod schemas, atomic file operations
3. **Git Layer**: Sync branch operations, worktree management, conflict resolution
4. **CLI Layer**: Commander.js-based CLI with Beads-compatible commands
5. **Testing**: Golden test coverage using tryscript for TDD approach

## Backward Compatibility

### API/CLI Compatibility

| Area               | Compatibility Level | Notes                                               |
| ------------------ | ------------------- | --------------------------------------------------- |
| CLI command names  | Full                | `tbd` command with Beads-compatible subcommands     |
| CLI options        | Full                | Same flags as Beads (`--json`, `-t`, `-p`, etc.)    |
| JSON output schema | Full                | Matches Beads JSON output structure                 |
| Exit codes         | Full                | 0=success, 1=error, 2=usage error                   |
| ID format          | Compatible          | Internal `is-xxxx`, display as `bd-xxxx` via config |

### Data Compatibility

| Area          | Compatibility Level | Notes                                            |
| ------------- | ------------------- | ------------------------------------------------ |
| Beads import  | Full                | Import from JSONL export or `--from-beads`       |
| Issue fields  | Full                | All Beads fields mapped to Tbd equivalents       |
| Status values | Full                | Direct mapping except `tombstone` (skip/convert) |
| Dependencies  | Partial             | Only `blocks` type in V1                         |

### Breaking Changes

- None - this is a new implementation

---

## Stage 1: Planning Stage

### 1.1 Scope Definition

**In Scope for V1:**

- Complete File Layer (schemas, parsing, atomic writes)
- Complete Git Layer (sync branch, worktree, conflict resolution)
- Core CLI commands matching Beads:
  - `init`, `create`, `list`, `show`, `update`, `close`, `reopen`
  - `ready`, `blocked`, `stale`
  - `label add/remove/list`
  - `dep add/remove/tree`
  - `sync`, `sync --pull`, `sync --push`, `sync --status`
  - `search`
  - `info`, `stats`, `doctor`, `config`
  - `attic list/show/restore`
  - `import` (Beads JSONL and `--from-beads`)
- Dual output modes (human-readable + JSON)
- Golden test coverage for all commands

**Out of Scope for V1 (Future):**

- `compact` command (memory decay)
- `export` command
- Agent registry
- Comments/Messages entity type
- GitHub bridge
- Real-time coordination
- `related` and `discovered-from` dependency types
- Daemon/background sync

### 1.2 Success Criteria

- [ ] All CLI commands from design spec implemented
- [ ] All commands have golden test coverage
- [ ] `tbd import beads.jsonl` successfully imports Beads data
- [ ] Multi-machine sync works without conflicts
- [ ] Performance targets met (<50ms for common operations on 5K issues)
- [ ] Cross-platform compatibility (macOS, Linux, Windows)

### 1.3 Technical Decisions

| Decision          | Choice                | Rationale                                       |
| ----------------- | --------------------- | ----------------------------------------------- |
| Package manager   | pnpm                  | Best monorepo support, disk efficiency          |
| Build tool        | tsdown                | Modern, fast, proper ESM/CJS dual output        |
| CLI framework     | Commander.js          | Industry standard, excellent TypeScript support |
| Schema validation | Zod                   | Type inference, excellent error messages        |
| YAML parsing      | gray-matter + js-yaml | Mature, handles front matter correctly          |
| Testing           | tryscript             | Golden testing for CLI, Markdown-based tests    |
| Colors            | picocolors            | Tiny, fast, TTY-aware                           |
| Prompts           | @clack/prompts        | Beautiful, accessible prompts                   |

---

## Stage 2: Architecture Stage

### 2.1 Project Structure

```
tbd/
├── packages/
│   └── tbd/                      # Main package
│       ├── src/
│       │   ├── index.ts          # Library exports
│       │   ├── version.ts        # VERSION constant
│       │   ├── core/             # Core library (node-free where possible)
│       │   │   ├── schemas/      # Zod schemas
│       │   │   │   ├── common.ts
│       │   │   │   ├── issue.ts
│       │   │   │   ├── config.ts
│       │   │   │   ├── meta.ts
│       │   │   │   └── attic.ts
│       │   │   ├── serialization/
│       │   │   │   ├── parse.ts     # YAML + Markdown parsing
│       │   │   │   ├── serialize.ts # Canonical serialization
│       │   │   │   └── hash.ts      # Content hashing
│       │   │   ├── merge/
│       │   │   │   ├── strategies.ts
│       │   │   │   └── merge.ts
│       │   │   └── types.ts
│       │   ├── git/              # Git operations (node:child_process)
│       │   │   ├── sync.ts       # Sync branch operations
│       │   │   ├── worktree.ts   # Hidden worktree management
│       │   │   ├── plumbing.ts   # Low-level git commands
│       │   │   └── index.ts
│       │   ├── storage/          # File storage (node:fs)
│       │   │   ├── atomic.ts     # Atomic file writes
│       │   │   ├── issues.ts     # Issue file operations
│       │   │   ├── config.ts     # Config file operations
│       │   │   └── index.ts
│       │   ├── cli/              # CLI implementation
│       │   │   ├── bin.ts        # Entry point
│       │   │   ├── cli.ts        # Commander program setup
│       │   │   ├── commands/
│       │   │   │   ├── init.ts
│       │   │   │   ├── issue.ts      # create, list, show, update, close, reopen
│       │   │   │   ├── workflow.ts   # ready, blocked, stale
│       │   │   │   ├── label.ts
│       │   │   │   ├── dep.ts
│       │   │   │   ├── sync.ts
│       │   │   │   ├── search.ts
│       │   │   │   ├── maintenance.ts # info, stats, doctor, config
│       │   │   │   ├── attic.ts
│       │   │   │   └── import.ts
│       │   │   └── lib/
│       │   │       ├── baseCommand.ts
│       │   │       ├── outputManager.ts
│       │   │       ├── formatters.ts
│       │   │       ├── errors.ts
│       │   │       └── context.ts
│       │   └── index.ts
│       ├── tests/
│       │   ├── golden/           # tryscript golden tests
│       │   │   ├── init.md
│       │   │   ├── issue-crud.md
│       │   │   ├── labels.md
│       │   │   ├── deps.md
│       │   │   ├── sync.md
│       │   │   ├── search.md
│       │   │   ├── import.md
│       │   │   └── fixtures/
│       │   └── unit/             # Unit tests
│       │       ├── schemas.test.ts
│       │       ├── serialization.test.ts
│       │       └── merge.test.ts
│       ├── package.json
│       ├── tsconfig.json
│       └── tsdown.config.ts
├── .changeset/
│   └── config.json
├── .github/
│   └── workflows/
│       ├── ci.yml
│       └── release.yml
├── package.json                  # Root workspace config
├── pnpm-workspace.yaml
├── tsconfig.base.json
├── eslint.config.js
├── .prettierrc
└── lefthook.yml
```

### 2.2 Package Exports

```json
{
  "name": "tbd",
  "type": "module",
  "exports": {
    ".": {
      "import": { "types": "./dist/index.d.ts", "default": "./dist/index.js" },
      "require": { "types": "./dist/index.d.cts", "default": "./dist/index.cjs" }
    },
    "./package.json": "./package.json"
  },
  "bin": {
    "tbd": "./dist/bin.js"
  }
}
```

### 2.3 Key Dependencies

```json
{
  "dependencies": {
    "commander": "^14.0.0",
    "zod": "^4.0.0",
    "gray-matter": "^4.0.3",
    "js-yaml": "^4.1.0",
    "ulid": "^3.0.0",
    "picocolors": "^1.1.0",
    "@clack/prompts": "^0.11.0",
    "cli-table3": "^0.6.5"
  },
  "devDependencies": {
    "typescript": "^5.8.0",
    "tsdown": "^0.20.0",
    "@types/node": "^22.0.0",
    "tryscript": "^0.1.4",
    "vitest": "^4.0.0"
  }
}
```

### 2.4 Data Flow Architecture

```
User Command
     │
     ▼
┌─────────────────────────────────────────────────────────────┐
│                     CLI Layer (Commander.js)                 │
│  - Parse arguments                                          │
│  - Validate options                                         │
│  - Route to handlers                                        │
└──────────────────────────┬──────────────────────────────────┘
                           │
                           ▼
┌─────────────────────────────────────────────────────────────┐
│                    Storage Layer                             │
│  - Read/write issue files (.md)                             │
│  - Manage config (.tbd/config.yml)                          │
│  - Atomic file operations                                   │
└──────────────────────────┬──────────────────────────────────┘
                           │
                           ▼
┌─────────────────────────────────────────────────────────────┐
│                     Git Layer                                │
│  - Sync branch operations                                   │
│  - Worktree management                                      │
│  - Conflict detection and resolution                        │
└──────────────────────────┬──────────────────────────────────┘
                           │
                           ▼
                    Git Repository
                    (tbd-sync branch)
```

---

## Stage 3: Refine Architecture

### 3.1 Reusable Components Identified

From the research docs, we will use:

| Pattern              | Source              | Usage                                      |
| -------------------- | ------------------- | ------------------------------------------ |
| Base Command         | CLI patterns doc §3 | Centralize context, output, error handling |
| OutputManager        | CLI patterns doc §4 | Dual text/JSON output                      |
| Handler + Command    | CLI patterns doc §5 | Separate concerns                          |
| Named Option Types   | CLI patterns doc §6 | TypeScript safety                          |
| Formatter Pattern    | CLI patterns doc §7 | Consistent output formatting               |
| Git-based versioning | Monorepo doc §7     | Dynamic version strings                    |
| Atomic writes        | Design spec §2.1    | Safe file operations                       |

### 3.2 Performance Considerations

- **Index caching**: Optional `.tbd/cache/index.json` for O(1) lookups
- **Incremental sync**: Use git diff to process only changed files
- **Lazy loading**: Parse issue files only when needed
- **Worktree for search**: Direct file access vs git show overhead

### 3.3 Simplified Architecture Decisions

- **Single package**: Start with one package, split later if needed
- **No daemon**: All operations are synchronous CLI calls
- **Files as truth**: No SQLite, no caching required for correctness
- **Standard git**: Use git CLI, no libgit2 binding

---

## Stage 4: Implementation Stage

> **Note**: This plan assumes the pnpm monorepo skeleton is already set up with tsdown,
> TypeScript, ESLint, Prettier, lefthook, and Changesets configured.
> The focus is on application design and implementation.

### Implementation Tracking

This plan is tracked using beads. The master epic is **tbd-100**.

| Phase      | Epic ID  | Title                                | Tasks                     | Status      |
| ---------- | -------- | ------------------------------------ | ------------------------- | ----------- |
| 1          | tbd-101  | Core Schemas & Serialization         | tbd-102 through tbd-111   | ✅ Complete |
| 2          | tbd-200  | Storage Layer & Basic Git Operations | tbd-201 through tbd-209   | ✅ Complete |
| 3          | tbd-300  | CLI Foundation & Init Command        | tbd-301 through tbd-309   | ✅ Complete |
| 4          | tbd-400  | Issue CRUD Commands                  | tbd-401 through tbd-409   | ✅ Complete |
| 5          | tbd-500  | Workflow Commands                    | tbd-501 through tbd-504   | ✅ Complete |
| 6          | tbd-600  | Label & Dependency Commands          | tbd-601 through tbd-607   | ✅ Complete |
| 7          | tbd-700  | Sync Operations                      | tbd-701 through tbd-708   | ✅ Complete |
| 8          | tbd-800  | Search Command                       | tbd-801 through tbd-804   | ✅ Complete |
| 9          | tbd-900  | Maintenance Commands                 | tbd-901 through tbd-904   | ✅ Complete |
| 10         | tbd-1000 | Attic Commands                       | tbd-1001 through tbd-1004 | ✅ Complete |
| 11         | tbd-1100 | Import Command                       | tbd-1101 through tbd-1105 | ✅ Complete |
| 12         | tbd-1200 | Polish & Documentation               | tbd-1201 through tbd-1206 | ⚠️ Partial  |
| Validation | tbd-1300 | Stage 5 Validation                   | tbd-1301 through tbd-1306 | 🔲 Pending  |

**Status Legend:** ✅ Complete | ⚠️ Partial (needs review) | 🔲 Pending

**Implementation Progress (2026-01-15):**

- Core functionality implemented and passing 104 tests
- All CLI commands implemented (Phases 1-11 complete)
- Sync operations with isolated index, merge algorithm, and push retry (Phase 7)
- Search with worktree staleness check (Phase 8)
- Golden tests passing for all commands
- Build and lint passing
- Remaining work: Phase 12 polish and documentation

### Phase 1: Core Schemas & Serialization

**Epic:** tbd-101

**Goal**: Implement the File Layer with Zod schemas and YAML+Markdown serialization.

#### Phase 1 Tasks

- [x] Implement Zod schemas:
  - [x] Common types (Timestamp, IssueId, Version) — **tbd-102** ✅
  - [x] IssueSchema — **tbd-103** ✅
  - [x] ConfigSchema — **tbd-104** ✅
  - [x] MetaSchema — **tbd-105** ✅
  - [x] LocalStateSchema — **tbd-106** ✅
  - [x] AtticEntrySchema — **tbd-107** ✅
- [x] Implement serialization:
  - [x] YAML + Markdown parsing (gray-matter) — **tbd-108** ✅
  - [x] Canonical serialization for hashing — **tbd-109** ✅
  - [x] Content hash generation — **tbd-110** ✅
- [x] Write unit tests for schemas and serialization — **tbd-111** ✅

#### Phase 1 Key Design Details

**Canonical Serialization Rules** (for deterministic content hashing):

```typescript
// Keys sorted alphabetically at each level
// Block style for arrays/objects (no flow style)
// Arrays sorted: labels lexicographic, dependencies by target
// Timestamps in ISO8601 with Z suffix (UTC)
// Null values explicit (not omitted)
// Empty objects/arrays explicit (extensions: {}, labels: [])
// No trailing whitespace, LF line endings
```

**Issue File Format** (.md with YAML frontmatter):

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

## Notes

Found the issue in session.ts line 42. Working on fix.
```

**Content Hash Calculation**:

```typescript
function contentHash(issue: Issue): string {
  const canonical = canonicalSerialize(issue);
  return crypto.createHash('sha256').update(canonical).digest('hex').slice(0, 16);
}
```

#### Phase 1 Tests

Unit tests for:

- Schema validation (valid/invalid inputs)
- Parsing YAML+Markdown to Issue object
- Serializing Issue to canonical YAML+Markdown
- Round-trip: parse → serialize → parse = identical
- Content hash stability (same content = same hash)

### Phase 2: Storage Layer & Basic Git Operations

**Epic:** tbd-200

**Goal**: Implement file operations and basic git layer.

#### Phase 2 Tasks

- [x] Implement atomic file writes — **tbd-201** ✅
- [x] Implement issue file operations:
  - [x] `readIssue(id)` - Parse .md file to Issue — **tbd-202** ✅
  - [x] `writeIssue(issue)` - Serialize Issue to .md file — **tbd-203** ✅
  - [x] `listIssues()` - Enumerate all issue files — **tbd-204** ✅
  - [x] `deleteIssue(id)` - Remove issue file — **tbd-205** ✅
- [x] Implement config operations (readConfig, writeConfig, initConfig) — **tbd-206** ✅
- [x] Implement basic git plumbing (gitExec, getCurrentBranch, branchExists, getRemoteUrl) — **tbd-207** ✅
- [x] Implement worktree management (initWorktree, updateWorktree, checkWorktreeHealth) — **tbd-208** ✅
- [x] Write unit tests for storage and git operations — **tbd-209** ✅

#### Phase 2 Key Design Details

**Atomic File Writes** (prevent corruption from crashes):

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

**Directory Structure on Main Branch**:

```
.tbd/
├── config.yml              # Project configuration (tracked)
├── .gitignore              # Ignores cache/ and .worktree/ (tracked)
├── cache/                  # Gitignored - local state
│   ├── state.yml           # Per-node sync state
│   ├── index.json          # Optional query index
│   └── sync.lock           # Sync coordination
└── .worktree/              # Gitignored - hidden worktree
    └── (checkout of tbd-sync branch)
```

**Directory Structure on tbd-sync Branch**:

```
.tbd-sync/
├── issues/                 # Issue entities (ULID-named files)
│   ├── is-01hx5zzkbkactav9wevgemmvrz.md
│   └── is-01hx5zzkbkbctav9wevgemmvrz.md
├── attic/                  # Conflict archive
│   └── conflicts/
│       └── is-01hx5zzkbkactav9wevgemmvrz/
│           └── 2025-01-07T10-30-00Z_description.md
├── mappings/               # ID mappings
│   ├── ids.yml            # short → ULID (e.g., a7k2 → 01hx5zzk...)
│   └── beads.yml          # Beads imports
└── meta.yml                # Metadata (schema version)
```

**Git Isolated Index** (protect user’s staging area):

```typescript
// All sync branch writes use isolated index
async function withIsolatedIndex<T>(fn: () => Promise<T>): Promise<T> {
  const gitDir = await git('rev-parse', '--git-dir');
  const isolatedIndex = path.join(gitDir, 'tbd-index');

  return withEnv({ GIT_INDEX_FILE: isolatedIndex }, fn);
}
```

**Worktree Initialization Decision Tree**:

```
Does .tbd/.worktree/ exist and valid?
├── YES → Worktree ready
└── NO → Does tbd-sync branch exist?
    ├── YES (local) → git worktree add .tbd/.worktree tbd-sync --detach
    ├── YES (remote) → git fetch origin tbd-sync
    │                  git worktree add .tbd/.worktree origin/tbd-sync --detach
    └── NO → git worktree add .tbd/.worktree --orphan tbd-sync
             Initialize .tbd-sync/ structure
```

### Phase 3: CLI Foundation & Init Command

**Epic:** tbd-300

**Goal**: Set up CLI infrastructure and implement `tbd init`.

#### Phase 3 Tasks

- [x] Implement CLI infrastructure:
  - [x] bin.ts entry point with shebang — **tbd-301** ✅
  - [x] Commander program setup with global options — **tbd-302** ✅
  - [x] BaseCommand class — **tbd-303** ✅
  - [x] OutputManager for dual output — **tbd-304** ✅
  - [x] CLIError classes — **tbd-305** ✅
  - [x] Context management (getCommandContext) — **tbd-306** ✅
- [x] Implement `tbd init` — **tbd-307** ✅
- [x] Implement `tbd info` — **tbd-308** ✅
- [x] Write golden tests for init and info commands — **tbd-309** ✅

#### Phase 3 Key Design Details

**CLI Architecture** (following Commander.js patterns):

```typescript
// cli.ts - Main program setup
const program = new Command()
  .name('tbd')
  .version(VERSION)
  .description('Git-native issue tracking')
  .option('--json', 'Output as JSON')
  .option('--color <when>', 'Colorize output: auto, always, never', 'auto')
  .option('--dir <path>', 'Custom .tbd directory path')
  .option('--db <path>', 'Alias for --dir (Beads compat)')
  .option('--no-sync', 'Disable auto-sync')
  .option('--actor <name>', 'Override actor name')
  .showHelpAfterError();

program.addCommand(initCommand);
program.addCommand(issueCommands); // create, list, show, update, close, reopen
program.addCommand(labelCommands);
program.addCommand(depCommands);
program.addCommand(syncCommand);
program.addCommand(searchCommand);
program.addCommand(maintenanceCommands); // info, stats, doctor, config
program.addCommand(atticCommands);
program.addCommand(importCommand);
```

**BaseCommand Pattern**:

```typescript
export abstract class BaseCommand {
  protected ctx: CommandContext;
  protected output: OutputManager;

  constructor(command: Command) {
    this.ctx = getCommandContext(command);
    this.output = new OutputManager(this.ctx);
  }

  protected async execute<T>(action: () => Promise<T>, errorMessage: string): Promise<T> {
    try {
      return await action();
    } catch (error) {
      this.output.error(errorMessage, error);
      throw new CLIError(errorMessage);
    }
  }

  abstract run(options: unknown): Promise<void>;
}
```

**OutputManager** (dual text/JSON output):

```typescript
export class OutputManager {
  constructor(private ctx: CommandContext) {}

  // Structured data - respects --json flag
  data<T>(data: T, textFormatter?: (data: T) => void): void {
    if (this.ctx.json) {
      console.log(JSON.stringify(data, null, 2));
    } else if (textFormatter) {
      textFormatter(data);
    }
  }

  // Status messages - text mode only
  success(message: string): void {
    if (!this.ctx.json && !this.ctx.quiet) {
      console.log(pc.green('✓') + ' ' + message);
    }
  }

  // Errors - always stderr
  error(message: string, err?: Error): void {
    if (this.ctx.json) {
      console.error(JSON.stringify({ error: message, details: err?.message }));
    } else {
      console.error(pc.red('Error:') + ' ' + message);
    }
  }
}
```

**Global Options Context**:

```typescript
interface CommandContext {
  json: boolean;
  color: 'auto' | 'always' | 'never';
  dir: string | null; // Custom .tbd path
  noSync: boolean;
  actor: string; // Resolved actor name
  quiet: boolean;
}

function getCommandContext(command: Command): CommandContext {
  const opts = command.optsWithGlobals();
  return {
    json: opts.json ?? false,
    color: opts.color ?? 'auto',
    dir: opts.dir ?? opts.db ?? null,
    noSync: opts.noSync ?? false,
    actor: resolveActor(opts.actor),
    quiet: opts.quiet ?? false,
  };
}

function resolveActor(override?: string): string {
  if (override) return override;
  if (process.env.TBD_ACTOR) return process.env.TBD_ACTOR;
  // Try git user.email
  try {
    return execSync('git config user.email', { encoding: 'utf8' }).trim();
  } catch {
    return `${os.userInfo().username}@${os.hostname()}`;
  }
}
```

#### Phase 3 Golden Tests

````markdown
---
sandbox: true
env:
  NO_COLOR: '1'
---

# Test: tbd init creates directory structure

```console
$ git init test-repo && cd test-repo
[..]
? 0
$ tbd init
Initialized tbd in [CWD]/test-repo
Created sync branch: tbd-sync
[..]
? 0
$ ls -la .tbd/
[..]config.yml
[..].gitignore
[..]
? 0
```

# Test: tbd info shows system status

```console
$ tbd info
Tbd Version: [..]
Sync Branch: tbd-sync
[..]
? 0
```

# Test: tbd info --json

```console
$ tbd info --json
{
  "tbd_version": "[..]",
  "sync_branch": "tbd-sync",
[..]
}
? 0
```
````

### Phase 4: Issue CRUD Commands

**Epic:** tbd-400

**Goal**: Implement create, list, show, update, close, reopen commands.

#### Phase 4 Tasks

- [x] Implement dual ID generation — **tbd-401** ✅
- [x] Implement ID mapping storage and resolution — **tbd-402** ✅
- [x] Implement `tbd create` — **tbd-403** ✅
- [x] Implement `tbd list` — **tbd-404** ✅
- [x] Implement `tbd show` — **tbd-405** ✅
- [x] Implement `tbd update` — **tbd-406** ✅
- [x] Implement `tbd close` — **tbd-407** ✅
- [x] Implement `tbd reopen` — **tbd-408** ✅
- [x] Write golden tests for issue CRUD commands — **tbd-409** ✅

#### Phase 4 Key Design Details

**Dual ID Generation** (ULID internal + base36 external):

Tbd uses a dual ID system:

- **Internal IDs**: `is-{ulid}` - 26 char ULID for storage, sorting, dependencies
- **External IDs**: `{prefix}-{short}` - 4-5 char base36 for CLI, docs, commits

```typescript
import { ulid } from 'ulid';

// Generate internal ID (ULID-based, time-sortable)
function generateInternalId(prefix: string = 'is'): string {
  return `${prefix}-${ulid().toLowerCase()}`;
  // e.g., "is-01hx5zzkbkactav9wevgemmvrz"
}

// Generate short ID (base36 for human use)
function generateShortId(): string {
  const chars = '0123456789abcdefghijklmnopqrstuvwxyz';
  let result = '';
  for (let i = 0; i < 4; i++) {
    result += chars[Math.floor(Math.random() * 36)];
  }
  return result; // e.g., "a7k2"
}

// Create new issue with both IDs
async function createIssueIds(storage: Storage): Promise<{ internal: string; short: string }> {
  const internalId = generateInternalId();
  const ulid = internalId.replace(/^is-/, '');

  // Generate unique short ID
  const mapping = await storage.loadIdMapping();
  let shortId: string;
  const MAX_ATTEMPTS = 10;
  for (let i = 0; i < MAX_ATTEMPTS; i++) {
    shortId = generateShortId();
    if (!mapping.hasShortId(shortId)) {
      break;
    }
    if (i === MAX_ATTEMPTS - 1) {
      throw new Error('Failed to generate unique short ID');
    }
  }

  // Save mapping
  mapping.set(shortId!, ulid);
  await storage.saveIdMapping(mapping);

  return { internal: internalId, short: shortId! };
}
```

**ID Mapping Storage** (`.tbd-sync/mappings/ids.yml`):

```yaml
# short_id: ulid (without prefix)
a7k2: 01hx5zzkbkactav9wevgemmvrz
b3m9: 01hx5zzkbkbctav9wevgemmvrz
c4p1: 01hx5zzkbkcdtav9wevgemmvrz
```

**ID Resolution** (exact lookup, no prefix matching):

```typescript
async function resolveIssueId(storage: Storage, input: string): Promise<string> {
  // Strip any prefix (e.g., "bd-a7k2" → "a7k2")
  const shortId = input.replace(/^[a-z]+-/, '');

  // Look up in mapping file
  const mapping = await storage.loadIdMapping();
  const ulid = mapping.getUlid(shortId);

  if (!ulid) {
    throw new CLIError(`Issue not found: ${input}`);
  }

  return `is-${ulid}`; // Return full internal ID
}

// Format internal ID for display
function formatDisplayId(internalId: string, config: Config, mapping: IdMapping): string {
  const ulid = internalId.replace(/^is-/, '');
  const shortId = mapping.getShortId(ulid);
  const prefix = config.display?.id_prefix ?? 'bd';
  return `${prefix}-${shortId}`; // e.g., "bd-a7k2"
}
```

**Why no prefix matching?** Issue IDs are permanent references that appear in
documentation, commit messages, and external systems.
Prefix matching would cause ambiguity as more issues are created.
Users always type the full short ID.

**List Filtering and Sorting**:

```typescript
interface ListOptions {
  status?: IssueStatus[];
  kind?: IssueKind[];
  priority?: number[];
  assignee?: string;
  label?: string[];
  parent?: string;
  deferred?: boolean;
  sort?: 'priority' | 'created' | 'updated';
  limit?: number;
  all?: boolean; // Include closed
}

function filterIssues(issues: Issue[], options: ListOptions): Issue[] {
  return issues.filter((issue) => {
    // By default, exclude closed unless --all
    if (!options.all && issue.status === 'closed') return false;

    // Apply filters
    if (options.status && !options.status.includes(issue.status)) return false;
    if (options.kind && !options.kind.includes(issue.kind)) return false;
    if (options.priority && !options.priority.includes(issue.priority)) return false;
    if (options.assignee && issue.assignee !== options.assignee) return false;
    if (options.label?.length) {
      if (!options.label.every((l) => issue.labels.includes(l))) return false;
    }
    if (options.parent !== undefined) {
      if (options.parent === '' && issue.parent_id !== null) return false;
      if (options.parent && issue.parent_id !== options.parent) return false;
    }
    if (options.deferred === true && !issue.deferred_until) return false;
    if (options.deferred === false && issue.deferred_until) return false;

    return true;
  });
}

function sortIssues(issues: Issue[], sortBy: string = 'priority'): Issue[] {
  return [...issues].sort((a, b) => {
    switch (sortBy) {
      case 'priority':
        return a.priority - b.priority; // Lower = higher priority
      case 'created':
        return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
      case 'updated':
        return new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime();
      default:
        return 0;
    }
  });
}
```

**Table Formatting** (human-readable list output):

```typescript
function formatIssueTable(issues: Issue[], ctx: CommandContext): void {
  const idPrefix = ctx.config?.display?.id_prefix ?? 'bd';

  const table = new Table({
    head: ['ID', 'PRI', 'STATUS', 'TITLE'],
    colWidths: [12, 5, 14, 50],
    wordWrap: true,
    style: { head: ctx.color !== 'never' ? ['cyan'] : [] },
  });

  for (const issue of issues) {
    const displayId = issue.id.replace('is-', `${idPrefix}-`);
    table.push([
      displayId,
      issue.priority.toString(),
      formatStatus(issue.status, ctx),
      truncate(issue.title, 48),
    ]);
  }

  console.log(table.toString());
}
```

**Round-Trip Editing** (show → edit → update workflow):

```typescript
// tbd show bd-abc123 > issue.md
// (user edits issue.md in their editor)
// tbd update --from-file issue.md

async function updateFromFile(path: string, storage: Storage): Promise<void> {
  const content = await fs.readFile(path, 'utf8');
  const parsed = parseIssueFile(content);

  // Get existing issue to preserve immutable fields
  const existing = await storage.readIssue(parsed.id);
  if (!existing) {
    throw new CLIError(`Issue not found: ${parsed.id}`);
  }

  // Merge: user file wins for mutable fields, preserve immutables
  const updated: Issue = {
    ...existing,
    ...parsed,
    // Immutable fields preserved
    id: existing.id,
    created_at: existing.created_at,
    created_by: existing.created_by,
    // Version incremented
    version: existing.version + 1,
    updated_at: new Date().toISOString(),
  };

  await storage.writeIssue(updated);
}
```

#### Phase 4 Golden Tests

````markdown
---
sandbox: true
env:
  NO_COLOR: '1'
---

# Test: Create issue with minimal options

```console
$ tbd init --quiet
? 0
$ tbd create "Fix authentication bug"
Created bd-[..]: Fix authentication bug
? 0
```

# Test: Create issue with all options

```console
$ tbd create "Add OAuth support" -t feature -p 1 -l backend -l security --assignee alice
Created bd-[..]: Add OAuth support
? 0
```

# Test: List issues

```console
$ tbd list
ID        PRI  STATUS  TITLE
bd-[..]   1    open    Add OAuth support
bd-[..]   2    open    Fix authentication bug
? 0
```

# Test: List issues as JSON

```console
$ tbd list --json
[
  {
    "type": "is",
    "id": "is-[..]",
    "title": "[..]",
[..]
  }
]
? 0
```

# Test: Show issue

```console
$ ID=$(tbd create "Test issue" --json | jq -r '.id')
$ tbd show $ID
---
type: is
id: is-[..]
[..]
title: Test issue
[..]
---
? 0
```

# Test: Update issue

```console
$ ID=$(tbd create "Update test" --json | jq -r '.id')
$ tbd update $ID --status in_progress --priority 0
Updated bd-[..]
? 0
$ tbd show $ID --json | jq '.status, .priority'
"in_progress"
0
? 0
```

# Test: Close and reopen issue

```console
$ ID=$(tbd create "Close test" --json | jq -r '.id')
$ tbd close $ID --reason "Fixed in commit abc"
Closed bd-[..]
? 0
$ tbd show $ID --json | jq '.status, .close_reason'
"closed"
"Fixed in commit abc"
? 0
$ tbd reopen $ID
Reopened bd-[..]
? 0
$ tbd show $ID --json | jq '.status'
"open"
? 0
```
````

### Phase 5: Workflow Commands

**Epic:** tbd-500

**Goal**: Implement ready, blocked, stale commands.

#### Phase 5 Tasks

- [x] Implement `tbd ready` — **tbd-501** ✅
- [x] Implement `tbd blocked` — **tbd-502** ✅
- [x] Implement `tbd stale` — **tbd-503** ✅
- [x] Write golden tests for workflow commands — **tbd-504** ✅

#### Phase 5 Key Design Details

**Ready Filter Logic** (unblocked, unassigned, open):

```typescript
async function getReadyIssues(storage: Storage, options: ReadyOptions): Promise<Issue[]> {
  const issues = await storage.listIssues();

  return issues.filter((issue) => {
    // Must be open
    if (issue.status !== 'open') return false;

    // Must not be assigned
    if (issue.assignee) return false;

    // Must not have open blocking dependencies
    if (hasOpenBlockers(issue, issues)) return false;

    // Optional type filter
    if (options.kind && issue.kind !== options.kind) return false;

    return true;
  });
}

function hasOpenBlockers(issue: Issue, allIssues: Issue[]): boolean {
  const blockers = issue.dependencies.filter((d) => d.type === 'blocks');

  for (const dep of blockers) {
    const target = allIssues.find((i) => i.id === dep.target);
    if (target && target.status !== 'closed') {
      return true; // Has an open blocker
    }
  }
  return false;
}
```

**Blocked Filter** (issues with unresolved dependencies):

```typescript
interface BlockedIssue {
  issue: Issue;
  blockedBy: Array<{ id: string; title: string }>;
}

async function getBlockedIssues(storage: Storage): Promise<BlockedIssue[]> {
  const issues = await storage.listIssues();
  const result: BlockedIssue[] = [];

  for (const issue of issues) {
    if (issue.status === 'closed') continue;

    const blockers = issue.dependencies
      .filter((d) => d.type === 'blocks')
      .map((d) => issues.find((i) => i.id === d.target))
      .filter((i): i is Issue => i !== undefined && i.status !== 'closed');

    if (blockers.length > 0) {
      result.push({
        issue,
        blockedBy: blockers.map((b) => ({ id: b.id, title: b.title })),
      });
    }
  }

  return result;
}
```

**Stale Detection** (configurable age threshold):

```typescript
function getStaleIssues(issues: Issue[], options: StaleOptions): Issue[] {
  const threshold = Date.now() - (options.days ?? 7) * 24 * 60 * 60 * 1000;

  return issues.filter((issue) => {
    // Filter by status if provided
    if (options.status && issue.status !== options.status) return false;

    // Check if updated_at is older than threshold
    const updatedAt = new Date(issue.updated_at).getTime();
    return updatedAt < threshold;
  });
}
```

#### Phase 5 Golden Tests

````markdown
---
sandbox: true
env:
  NO_COLOR: '1'
---

# Test: Ready shows unblocked, unassigned issues

```console
$ tbd init --quiet
$ tbd create "Ready issue" --json > /dev/null
$ tbd create "Assigned issue" --assignee bob --json > /dev/null
$ tbd ready
ID        PRI  TITLE
bd-[..]   2    Ready issue
? 0
```

# Test: Blocked shows issues with unresolved deps

```console
$ BLOCKER=$(tbd create "Blocker" --json | jq -r '.id')
$ BLOCKED=$(tbd create "Blocked issue" --json | jq -r '.id')
$ tbd dep add $BLOCKED $BLOCKER
[..]
? 0
$ tbd blocked
ISSUE       TITLE            BLOCKED BY
bd-[..]     Blocked issue    bd-[..] (Blocker)
? 0
$ tbd close $BLOCKER
[..]
? 0
$ tbd blocked
(no blocked issues)
? 0
```
````

### Phase 6: Label & Dependency Commands

**Epic:** tbd-600

**Goal**: Implement label and dependency management.

#### Phase 6 Tasks

- [x] Implement `tbd label add` — **tbd-601** ✅
- [x] Implement `tbd label remove` — **tbd-602** ✅
- [x] Implement `tbd label list` — **tbd-603** ✅
- [x] Implement `tbd dep add` — **tbd-604** ✅
- [x] Implement `tbd dep remove` — **tbd-605** ✅
- [x] Implement `tbd dep tree` — **tbd-606** ✅
- [x] Write golden tests for label and dependency commands — **tbd-607** ✅

#### Phase 6 Key Design Details

**Label Operations** (sorted, deduplicated arrays):

```typescript
async function addLabel(issueId: string, label: string, storage: Storage): Promise<void> {
  const issue = await storage.readIssue(issueId);
  if (!issue) throw new CLIError(`Issue not found: ${issueId}`);

  // Deduplicate and sort
  const labels = new Set(issue.labels);
  labels.add(label);
  issue.labels = Array.from(labels).sort();

  issue.version++;
  issue.updated_at = new Date().toISOString();
  await storage.writeIssue(issue);
}

async function removeLabel(issueId: string, label: string, storage: Storage): Promise<void> {
  const issue = await storage.readIssue(issueId);
  if (!issue) throw new CLIError(`Issue not found: ${issueId}`);

  issue.labels = issue.labels.filter((l) => l !== label);
  issue.version++;
  issue.updated_at = new Date().toISOString();
  await storage.writeIssue(issue);
}

async function listLabels(storage: Storage): Promise<string[]> {
  const issues = await storage.listIssues();
  const labels = new Set<string>();

  for (const issue of issues) {
    for (const label of issue.labels) {
      labels.add(label);
    }
  }

  return Array.from(labels).sort();
}
```

**Dependency Operations**:

```typescript
interface Dependency {
  target: string; // Issue ID this depends on
  type: 'blocks'; // V1 only supports 'blocks'
}

async function addDependency(
  issueId: string,
  targetId: string,
  type: string,
  storage: Storage,
): Promise<void> {
  // Validate both issues exist
  const issue = await storage.readIssue(issueId);
  const target = await storage.readIssue(targetId);
  if (!issue) throw new CLIError(`Issue not found: ${issueId}`);
  if (!target) throw new CLIError(`Target issue not found: ${targetId}`);

  // Prevent self-reference
  if (issueId === targetId) {
    throw new CLIError('Cannot add dependency to self');
  }

  // Check for duplicate
  const exists = issue.dependencies.some((d) => d.target === targetId && d.type === type);
  if (exists) {
    throw new CLIError('Dependency already exists');
  }

  // Add and sort by target
  issue.dependencies.push({ target: targetId, type: type as 'blocks' });
  issue.dependencies.sort((a, b) => a.target.localeCompare(b.target));

  issue.version++;
  issue.updated_at = new Date().toISOString();
  await storage.writeIssue(issue);
}
```

**Dependency Tree Visualization** (ASCII art):

```typescript
async function printDependencyTree(
  issueId: string,
  storage: Storage,
  ctx: CommandContext,
): Promise<void> {
  const issues = await storage.listIssues();
  const issueMap = new Map(issues.map((i) => [i.id, i]));
  const visited = new Set<string>();

  function printNode(id: string, prefix: string, isLast: boolean): void {
    const issue = issueMap.get(id);
    if (!issue) return;

    // Detect cycles
    if (visited.has(id)) {
      console.log(`${prefix}${isLast ? '└── ' : '├── '}${formatId(id)} (cycle)`);
      return;
    }
    visited.add(id);

    const connector = isLast ? '└── ' : '├── ';
    console.log(`${prefix}${connector}${formatId(id)} ${issue.title}`);

    // Get dependencies of this node
    const deps = issue.dependencies.filter((d) => d.type === 'blocks');
    deps.forEach((dep, i) => {
      const childPrefix = prefix + (isLast ? '    ' : '│   ');
      printNode(dep.target, childPrefix, i === deps.length - 1);
    });
  }

  const root = issueMap.get(issueId);
  if (!root) throw new CLIError(`Issue not found: ${issueId}`);

  console.log(`${formatId(issueId)} ${root.title}`);
  const deps = root.dependencies.filter((d) => d.type === 'blocks');
  deps.forEach((dep, i) => {
    printNode(dep.target, '', i === deps.length - 1);
  });
}
```

#### Phase 6 Golden Tests

````markdown
---
sandbox: true
env:
  NO_COLOR: '1'
---

# Test: Label management

```console
$ tbd init --quiet
$ ID=$(tbd create "Label test" --json | jq -r '.id')
$ tbd label add $ID urgent
Added label 'urgent' to bd-[..]
? 0
$ tbd label add $ID backend
Added label 'backend' to bd-[..]
? 0
$ tbd show $ID --json | jq '.labels'
["backend", "urgent"]
? 0
$ tbd label remove $ID urgent
Removed label 'urgent' from bd-[..]
? 0
$ tbd label list
backend
? 0
```

# Test: Dependency management

```console
$ A=$(tbd create "Issue A" --json | jq -r '.id')
$ B=$(tbd create "Issue B" --json | jq -r '.id')
$ tbd dep add $B $A --type blocks
Added dependency: bd-[..] blocks bd-[..]
? 0
$ tbd dep tree $B
bd-[..] Issue B
└── bd-[..] Issue A (blocks)
? 0
```
````

### Phase 7: Sync Operations

**Epic:** tbd-700

**Goal**: Implement full sync functionality.

#### Phase 7 Tasks

- [x] Implement isolated index operations — **tbd-701** ✅
- [x] Implement `tbd sync --pull` — **tbd-702** ✅
- [x] Implement `tbd sync --push` — **tbd-703** ✅
- [x] Implement `tbd sync` (full) — **tbd-704** ✅
- [x] Implement `tbd sync --status` — **tbd-705** ✅
- [x] Implement merge algorithm with field-level strategies — **tbd-706** ✅
- [x] Implement push retry algorithm — **tbd-707** ✅
- [x] Write golden tests for sync operations — **tbd-708** ✅

#### Phase 7 Key Design Details

**Isolated Index Operations** (protect user’s staging area):

```typescript
async function withIsolatedIndex<T>(gitDir: string, fn: () => Promise<T>): Promise<T> {
  const isolatedIndex = path.join(gitDir, 'tbd-index');
  const originalIndex = process.env.GIT_INDEX_FILE;

  try {
    process.env.GIT_INDEX_FILE = isolatedIndex;
    return await fn();
  } finally {
    if (originalIndex) {
      process.env.GIT_INDEX_FILE = originalIndex;
    } else {
      delete process.env.GIT_INDEX_FILE;
    }
  }
}

// Usage: Commit to sync branch without touching user's staging area
async function commitToSyncBranch(message: string): Promise<string> {
  const gitDir = await git('rev-parse', '--git-dir');

  return withIsolatedIndex(gitDir, async () => {
    // Read existing tree from sync branch
    await git('read-tree', 'tbd-sync');

    // Add changed files to index
    await git('add', '.tbd-sync/');

    // Write tree object
    const tree = await git('write-tree');

    // Create commit
    const parent = await git('rev-parse', 'tbd-sync').catch(() => null);
    const commitArgs = ['commit-tree', tree, '-m', message];
    if (parent) commitArgs.push('-p', parent);

    return git(...commitArgs);
  });
}
```

**Field-Level Merge Strategies**:

```typescript
type MergeStrategy = 'lww' | 'union' | 'max' | 'immutable';

const FIELD_STRATEGIES: Record<keyof Issue, MergeStrategy> = {
  // Immutable - never change after creation
  type: 'immutable',
  id: 'immutable',
  created_at: 'immutable',
  created_by: 'immutable',

  // LWW (Last-Write-Wins) - compare updated_at
  version: 'max', // Always increment
  kind: 'lww',
  title: 'lww',
  description: 'lww',
  notes: 'lww',
  status: 'lww',
  priority: 'lww',
  assignee: 'lww',
  parent_id: 'lww',
  updated_at: 'max',
  closed_at: 'lww',
  close_reason: 'lww',
  due_date: 'lww',
  deferred_until: 'lww',

  // Union - combine arrays, deduplicate
  labels: 'union',
  dependencies: 'union',

  // Extensions - deep merge
  extensions: 'lww', // Simplified: LWW for whole object
};
```

**Three-Way Merge Algorithm**:

```typescript
interface MergeResult {
  merged: Issue;
  conflicts: ConflictEntry[];
}

function mergeIssues(
  base: Issue | null, // Common ancestor (or null for new)
  local: Issue, // Local version
  remote: Issue, // Remote version
): MergeResult {
  const conflicts: ConflictEntry[] = [];

  // If one side is null, other wins
  if (!base) {
    // Both created independently - LWW based on created_at
    const winner = local.created_at <= remote.created_at ? local : remote;
    const loser = winner === local ? remote : local;
    if (loser !== winner) {
      conflicts.push(createAtticEntry(loser, 'create_conflict'));
    }
    return { merged: winner, conflicts };
  }

  // Field-by-field merge
  const merged = { ...base };

  for (const [field, strategy] of Object.entries(FIELD_STRATEGIES)) {
    const key = field as keyof Issue;
    const localVal = local[key];
    const remoteVal = remote[key];
    const baseVal = base[key];

    // Skip if both unchanged from base
    if (deepEqual(localVal, baseVal) && deepEqual(remoteVal, baseVal)) {
      continue;
    }

    // Only one changed - take changed value
    if (deepEqual(localVal, baseVal)) {
      merged[key] = remoteVal;
      continue;
    }
    if (deepEqual(remoteVal, baseVal)) {
      merged[key] = localVal;
      continue;
    }

    // Both changed - apply strategy
    switch (strategy) {
      case 'immutable':
        // Keep base value (shouldn't change)
        break;

      case 'lww':
        // Compare updated_at timestamps
        if (local.updated_at >= remote.updated_at) {
          merged[key] = localVal;
          conflicts.push(createAtticEntry(remote, field, remoteVal));
        } else {
          merged[key] = remoteVal;
          conflicts.push(createAtticEntry(local, field, localVal));
        }
        break;

      case 'union':
        // Combine arrays and deduplicate
        merged[key] = unionArrays(localVal, remoteVal);
        break;

      case 'max':
        // Take maximum value (for version numbers)
        merged[key] = Math.max(localVal as number, remoteVal as number);
        break;
    }
  }

  // Always increment version after merge
  merged.version = Math.max(local.version, remote.version) + 1;
  merged.updated_at = new Date().toISOString();

  return { merged, conflicts };
}
```

**Push with Retry and Merge** (optimistic concurrency):

```typescript
const MAX_PUSH_RETRIES = 3;

async function pushWithRetry(ctx: SyncContext): Promise<PushResult> {
  for (let attempt = 1; attempt <= MAX_PUSH_RETRIES; attempt++) {
    try {
      // Try to push
      await git('push', 'origin', 'tbd-sync');
      return { success: true, attempt };
    } catch (error) {
      if (!isNonFastForward(error)) {
        throw error; // Unrecoverable error
      }

      if (attempt === MAX_PUSH_RETRIES) {
        throw new CLIError(
          `Push failed after ${MAX_PUSH_RETRIES} attempts. ` +
            `Remote has conflicting changes. Try 'tbd sync --pull' first.`,
        );
      }

      // Fetch and merge remote changes
      await git('fetch', 'origin', 'tbd-sync');
      const conflicts = await mergeRemoteChanges(ctx);

      if (conflicts.length > 0) {
        ctx.output.warn(`Resolved ${conflicts.length} conflicts (see attic)`);
      }

      // Loop to retry push
    }
  }
}

function isNonFastForward(error: unknown): boolean {
  const msg = error instanceof Error ? error.message : String(error);
  return (
    msg.includes('non-fast-forward') || msg.includes('fetch first') || msg.includes('rejected')
  );
}
```

**Attic Entry Creation** (preserve conflict losers):

```typescript
interface AtticEntry {
  issue_id: string;
  field: string;
  timestamp: string;
  lost_value: unknown;
  winner_value: unknown;
  local_version: number;
  remote_version: number;
  resolution: 'lww' | 'manual';
}

function createAtticEntry(loser: Issue, field: string, lostValue: unknown): AtticEntry {
  const timestamp = new Date()
    .toISOString()
    .replace(/:/g, '-')
    .replace(/\.\d+Z$/, 'Z'); // is-abc123/2025-01-07T10-30-00Z_description

  return {
    issue_id: loser.id,
    field,
    timestamp,
    lost_value: lostValue,
    winner_value: null, // Filled by caller
    local_version: loser.version,
    remote_version: 0, // Filled by caller
    resolution: 'lww',
  };
}

// Attic file path: .tbd-sync/attic/conflicts/{issue_id}/{timestamp}_{field}.md
```

**Sync Status Detection**:

```typescript
interface SyncStatus {
  localChanges: FileChange[];
  remoteChanges: FileChange[];
  behind: number;
  ahead: number;
}

async function getSyncStatus(): Promise<SyncStatus> {
  // Get local HEAD of tbd-sync
  const localHead = await git('rev-parse', 'tbd-sync').catch(() => null);

  // Fetch remote (non-destructive)
  await git('fetch', 'origin', 'tbd-sync');
  const remoteHead = await git('rev-parse', 'origin/tbd-sync').catch(() => null);

  if (!localHead || !remoteHead) {
    return { localChanges: [], remoteChanges: [], behind: 0, ahead: 0 };
  }

  // Find merge base
  const base = await git('merge-base', localHead, remoteHead);

  // Count commits
  const behind = parseInt(await git('rev-list', '--count', `${localHead}..${remoteHead}`));
  const ahead = parseInt(await git('rev-list', '--count', `${remoteHead}..${localHead}`));

  // Diff files
  const localChanges = await getChangedFiles(base, localHead);
  const remoteChanges = await getChangedFiles(base, remoteHead);

  return { localChanges, remoteChanges, behind, ahead };
}
```

#### Phase 7 Golden Tests

````markdown
---
sandbox: true
env:
  NO_COLOR: '1'
---

# Test: Sync status shows pending changes

```console
$ tbd init --quiet
$ tbd create "Local change" --no-sync
Created bd-[..]
? 0
$ tbd sync --status
Local changes (not yet pushed):
  new: is-[..].md
? 0
```

# Test: Full sync workflow

```console
$ tbd sync
Pushed 1 issues
No conflicts
? 0
$ tbd sync --status
No pending changes
? 0
```
````

### Phase 8: Search Command

**Epic:** tbd-800

**Goal**: Implement search using hidden worktree.

#### Phase 8 Tasks

- [x] Implement search backend (ripgrep/grep detection) — **tbd-801** ✅
- [x] Implement `tbd search` command — **tbd-802** ✅
- [x] Implement worktree staleness check and auto-refresh — **tbd-803** ✅
- [x] Write golden tests for search command — **tbd-804** ✅

#### Phase 8 Key Design Details

**Search Backend Selection** (ripgrep preferred, grep fallback):

```typescript
async function detectSearchTool(): Promise<'rg' | 'grep'> {
  try {
    await execAsync('rg --version');
    return 'rg';
  } catch {
    return 'grep';
  }
}

interface SearchOptions {
  pattern: string;
  field?: 'title' | 'description' | 'notes' | 'all';
  kind?: IssueKind;
  status?: IssueStatus;
  labels?: string[];
  caseSensitive?: boolean;
  context?: number;
  filesOnly?: boolean;
  count?: boolean;
}
```

**Search Command Builder** (construct rg/grep args):

```typescript
function buildSearchCommand(
  tool: 'rg' | 'grep',
  pattern: string,
  options: SearchOptions,
): string[] {
  const issuesPath = '.tbd/.worktree/.tbd-sync/issues';

  if (tool === 'rg') {
    const args = ['rg'];

    // Case sensitivity
    if (!options.caseSensitive) args.push('-i');

    // Context lines
    if (options.context) args.push('-C', String(options.context));

    // Output mode
    if (options.filesOnly) args.push('-l');
    if (options.count) args.push('-c');

    // Include line numbers
    args.push('-n');

    // Pattern and path
    args.push(pattern, issuesPath);

    return args;
  }

  // grep fallback
  const args = ['grep', '-r'];
  if (!options.caseSensitive) args.push('-i');
  if (options.context) args.push(`-C${options.context}`);
  if (options.filesOnly) args.push('-l');
  if (options.count) args.push('-c');
  args.push('-n', pattern, issuesPath);

  return args;
}
```

**Search Result Processing** (map to issues):

```typescript
interface SearchMatch {
  issueId: string;
  title: string;
  field: string;
  lineNumber: number;
  matchText: string;
  context?: string[];
}

async function search(options: SearchOptions): Promise<SearchMatch[]> {
  // Ensure worktree is up to date
  await ensureWorktreeFresh();

  // Run search command
  const tool = await detectSearchTool();
  const args = buildSearchCommand(tool, options.pattern, options);
  const output = await execAsync(args.join(' ')).catch(() => '');

  // Parse results
  const matches: SearchMatch[] = [];
  const lines = output.trim().split('\n').filter(Boolean);

  for (const line of lines) {
    // Format: path/to/is-abc123.md:lineNum:matchText
    const match = line.match(/is-([a-f0-9]+)\.md:(\d+):(.*)$/);
    if (!match) continue;

    const [, idSuffix, lineNum, text] = match;
    const issueId = `is-${idSuffix}`;

    // Determine which field the match is in
    const field = determineField(parseInt(lineNum), text);

    // Apply post-filters (kind, status, labels)
    const issue = await storage.readIssue(issueId);
    if (!issue) continue;
    if (options.kind && issue.kind !== options.kind) continue;
    if (options.status && issue.status !== options.status) continue;
    if (options.labels?.length) {
      if (!options.labels.every((l) => issue.labels.includes(l))) continue;
    }

    matches.push({
      issueId,
      title: issue.title,
      field,
      lineNumber: parseInt(lineNum),
      matchText: text.trim(),
    });
  }

  return matches;
}
```

**Worktree Staleness Check**:

```typescript
const STALE_THRESHOLD_MS = 5 * 60 * 1000; // 5 minutes

async function ensureWorktreeFresh(options?: { noRefresh?: boolean }): Promise<void> {
  if (options?.noRefresh) return;

  const stateFile = '.tbd/cache/state.yml';
  const state = await readState(stateFile);

  const lastSync = state?.last_sync_at ? new Date(state.last_sync_at).getTime() : 0;
  const now = Date.now();

  if (now - lastSync > STALE_THRESHOLD_MS) {
    // Auto-pull to refresh worktree
    await syncPull();
    await updateState(stateFile, { last_sync_at: new Date().toISOString() });
  }
}
```

#### Phase 8 Golden Tests

````markdown
---
sandbox: true
env:
  NO_COLOR: '1'
---

# Test: Basic search

```console
$ tbd init --quiet
$ tbd create "Authentication timeout bug" -d "Users get logged out after 5 minutes"
[..]
? 0
$ tbd create "Add OAuth support" -d "Implement OAuth 2.0 flow"
[..]
? 0
$ tbd search "timeout"
bd-[..]: Authentication timeout bug
  description (line 1): [..]timeout[..]
[..]
? 0
```

# Test: Search with filters

```console
$ tbd search "OAuth" --type feature --json
{
  "matches": [
    {
      "issue_id": "is-[..]",
[..]
    }
  ],
[..]
}
? 0
```
````

### Phase 9: Maintenance Commands

**Epic:** tbd-900

**Goal**: Implement stats, doctor, config commands.

#### Phase 9 Tasks

- [x] Implement `tbd stats` — **tbd-901** ✅
- [x] Implement `tbd doctor` — **tbd-902** ✅
- [x] Implement `tbd config` — **tbd-903** ✅
- [x] Write golden tests for maintenance commands — **tbd-904** ✅

#### Phase 9 Key Design Details

**Stats Aggregation**:

```typescript
interface Stats {
  total: number;
  byStatus: Record<IssueStatus, number>;
  byKind: Record<IssueKind, number>;
  byPriority: Record<number, number>;
  byAssignee: Record<string, number>;
  unassigned: number;
}

async function getStats(storage: Storage): Promise<Stats> {
  const issues = await storage.listIssues();

  const stats: Stats = {
    total: issues.length,
    byStatus: { open: 0, in_progress: 0, closed: 0 },
    byKind: { bug: 0, feature: 0, task: 0, epic: 0 },
    byPriority: {},
    byAssignee: {},
    unassigned: 0,
  };

  for (const issue of issues) {
    stats.byStatus[issue.status]++;
    stats.byKind[issue.kind]++;
    stats.byPriority[issue.priority] = (stats.byPriority[issue.priority] || 0) + 1;

    if (issue.assignee) {
      stats.byAssignee[issue.assignee] = (stats.byAssignee[issue.assignee] || 0) + 1;
    } else {
      stats.unassigned++;
    }
  }

  return stats;
}
```

**Doctor Health Checks**:

```typescript
interface HealthCheck {
  name: string;
  status: 'ok' | 'warning' | 'error';
  message: string;
  fixable?: boolean;
}

async function runDoctorChecks(options: { fix?: boolean }): Promise<HealthCheck[]> {
  const checks: HealthCheck[] = [];

  // Check 1: Schema version
  const meta = await storage.readMeta();
  if (meta?.schema_version === CURRENT_SCHEMA_VERSION) {
    checks.push({ name: 'Schema version', status: 'ok', message: 'OK' });
  } else {
    checks.push({
      name: 'Schema version',
      status: 'warning',
      message: `Expected ${CURRENT_SCHEMA_VERSION}, found ${meta?.schema_version}`,
      fixable: true,
    });
  }

  // Check 2: Orphaned dependencies
  const issues = await storage.listIssues();
  const issueIds = new Set(issues.map((i) => i.id));
  const orphaned: Array<{ issue: string; dep: string }> = [];

  for (const issue of issues) {
    for (const dep of issue.dependencies) {
      if (!issueIds.has(dep.target)) {
        orphaned.push({ issue: issue.id, dep: dep.target });
      }
    }
  }

  if (orphaned.length === 0) {
    checks.push({ name: 'Orphaned dependencies', status: 'ok', message: '0' });
  } else {
    checks.push({
      name: 'Orphaned dependencies',
      status: 'warning',
      message: `${orphaned.length} found`,
      fixable: true,
    });

    if (options.fix) {
      await fixOrphanedDependencies(orphaned);
    }
  }

  // Check 3: Duplicate IDs
  const idCounts = new Map<string, number>();
  for (const issue of issues) {
    idCounts.set(issue.id, (idCounts.get(issue.id) || 0) + 1);
  }
  const duplicates = Array.from(idCounts).filter(([_, count]) => count > 1);

  if (duplicates.length === 0) {
    checks.push({ name: 'Duplicate IDs', status: 'ok', message: '0' });
  } else {
    checks.push({
      name: 'Duplicate IDs',
      status: 'error',
      message: `${duplicates.length} found - manual fix required`,
    });
  }

  // Check 4: Worktree health
  const worktreeOk = await checkWorktreeHealth();
  checks.push({
    name: 'Worktree',
    status: worktreeOk ? 'ok' : 'warning',
    message: worktreeOk ? 'healthy' : 'needs rebuild',
    fixable: !worktreeOk,
  });

  return checks;
}
```

**Config Get/Set with Dot Notation**:

```typescript
function getConfigValue(config: Config, path: string): unknown {
  const parts = path.split('.');
  let current: unknown = config;

  for (const part of parts) {
    if (current === null || typeof current !== 'object') return undefined;
    current = (current as Record<string, unknown>)[part];
  }

  return current;
}

function setConfigValue(config: Config, path: string, value: unknown): void {
  const parts = path.split('.');
  const lastKey = parts.pop()!;
  let current: Record<string, unknown> = config as Record<string, unknown>;

  for (const part of parts) {
    if (!(part in current) || typeof current[part] !== 'object') {
      current[part] = {};
    }
    current = current[part] as Record<string, unknown>;
  }

  current[lastKey] = value;
}

// Usage:
// tbd config display.id_prefix         → get value
// tbd config display.id_prefix cd      → set value
// tbd config --list                    → show all
```

#### Phase 9 Golden Tests

````markdown
---
sandbox: true
env:
  NO_COLOR: '1'
---

# Test: Stats shows issue counts

```console
$ tbd init --quiet
$ tbd create "Bug 1" -t bug
[..]
$ tbd create "Bug 2" -t bug
[..]
$ tbd create "Feature 1" -t feature
[..]
$ tbd stats
Issues: 3
  Open: 3
[..]
By Type:
  bug: 2
  feature: 1
[..]
? 0
```

# Test: Doctor checks health

```console
$ tbd doctor
Checking tbd health...
✓ Schema version: OK
✓ Orphaned dependencies: 0
✓ Duplicate IDs: 0
✓ Worktree: healthy
? 0
```

# Test: Config management

```console
$ tbd config display.id_prefix
bd
? 0
$ tbd config display.id_prefix cd
Set display.id_prefix = cd
? 0
$ tbd config --list
tbd_version: [..]
sync:
  branch: tbd-sync
  remote: origin
display:
  id_prefix: cd
[..]
? 0
```
````

### Phase 10: Attic Commands

**Epic:** tbd-1000

**Goal**: Implement attic inspection and restore.

#### Phase 10 Tasks

- [x] Implement `tbd attic list` — **tbd-1001** ✅
- [x] Implement `tbd attic show` — **tbd-1002** ✅
- [x] Implement `tbd attic restore` — **tbd-1003** ✅
- [x] Write golden tests for attic commands — **tbd-1004** ✅

#### Phase 10 Key Design Details

**Attic Entry Storage Format**:

```
.tbd-sync/attic/conflicts/{issue_id}/{timestamp}_{field}.md

Example: .tbd-sync/attic/conflicts/is-a1b2c3/2025-01-07T10-30-00Z_description.md
```

**Attic Entry File Format** (YAML + original content):

```yaml
---
issue_id: is-a1b2c3
field: description
timestamp: '2025-01-07T10:30:00Z'
local_version: 5
remote_version: 6
resolution: lww
winner: remote
loser: local
---
Original description content that was replaced.

This can be multiple lines of text that was the losing
value during the merge conflict resolution.
```

**Attic List Operations**:

```typescript
interface AtticFilter {
  issueId?: string;
  field?: string;
  since?: Date;
  limit?: number;
}

async function listAtticEntries(filter: AtticFilter): Promise<AtticEntry[]> {
  const atticPath = '.tbd/.worktree/.tbd-sync/attic/conflicts';

  // List all directories (issue IDs)
  const issueDirs = await fs.readdir(atticPath).catch(() => []);

  const entries: AtticEntry[] = [];

  for (const issueDir of issueDirs) {
    // Filter by issue ID if specified
    if (filter.issueId && issueDir !== filter.issueId) continue;

    const issueAtticPath = path.join(atticPath, issueDir);
    const files = await fs.readdir(issueAtticPath);

    for (const file of files) {
      const entry = await parseAtticEntry(path.join(issueAtticPath, file));

      // Apply filters
      if (filter.field && entry.field !== filter.field) continue;
      if (filter.since && new Date(entry.timestamp) < filter.since) continue;

      entries.push(entry);
    }
  }

  // Sort by timestamp (newest first)
  entries.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

  // Apply limit
  if (filter.limit) {
    return entries.slice(0, filter.limit);
  }

  return entries;
}
```

**Attic Restore Logic**:

```typescript
interface RestoreOptions {
  dryRun?: boolean;
}

async function restoreAtticEntry(entryPath: string, options: RestoreOptions): Promise<void> {
  // Parse the attic entry
  const entry = await parseAtticEntry(entryPath);

  // Get current issue state
  const issue = await storage.readIssue(entry.issue_id);
  if (!issue) {
    throw new CLIError(`Issue not found: ${entry.issue_id}`);
  }

  // Get current value for the field (will become new attic entry)
  const currentValue = issue[entry.field as keyof Issue];

  if (options.dryRun) {
    console.log(`Would restore ${entry.field} for ${entry.issue_id}`);
    console.log(`Current value: ${JSON.stringify(currentValue)}`);
    console.log(`Restored value: ${JSON.stringify(entry.lost_value)}`);
    return;
  }

  // Create new attic entry for current value
  const timestamp = new Date()
    .toISOString()
    .replace(/:/g, '-')
    .replace(/\.\d+Z$/, 'Z');

  const newAtticEntry: AtticEntry = {
    issue_id: entry.issue_id,
    field: entry.field,
    timestamp,
    lost_value: currentValue,
    winner_value: entry.lost_value,
    local_version: issue.version,
    remote_version: issue.version,
    resolution: 'manual',
  };

  await writeAtticEntry(newAtticEntry);

  // Update the issue with restored value
  (issue as Record<string, unknown>)[entry.field] = entry.lost_value;
  issue.version++;
  issue.updated_at = new Date().toISOString();

  await storage.writeIssue(issue);
}
```

#### Phase 10 Golden Tests

````markdown
---
sandbox: true
env:
  NO_COLOR: '1'
---

# Test: Attic list (empty initially)

```console
$ tbd init --quiet
$ tbd attic list
No attic entries
? 0
```

# Test: Attic show entry

```console
$ tbd attic show is-abc123/2025-01-07T10-30-00Z_description
Attic Entry: 2025-01-07T10-30-00Z_description

Issue: bd-[..] [..]
Field: description
[..]
? 0
```
````

### Phase 11: Import Command

**Epic:** tbd-1100

**Goal**: Implement Beads import functionality.

#### Phase 11 Tasks

- [x] Implement JSONL parsing for Beads export format — **tbd-1101** ✅
- [x] Implement ID mapping for import — **tbd-1102** ✅
- [x] Implement `tbd import <file>` — **tbd-1103** ✅
- [x] Implement `tbd import --from-beads` — **tbd-1104** ✅
- [x] Write golden tests for import command — **tbd-1105** ✅

#### Phase 11 Key Design Details

**Beads JSONL Format** (input format from `beads export`):

```typescript
// Each line is a JSON object - one per issue
interface BeadsExportLine {
  id: string; // "bd-a1b2c3" format
  title: string;
  description?: string;
  notes?: string;
  type: string; // "bug", "feature", "task", "epic"
  status: string; // "open", "in_progress", "closed", "tombstone"
  priority: number; // 0-5
  assignee?: string;
  labels?: string[];
  blocks?: string[]; // IDs this issue blocks
  parent?: string; // Parent issue ID
  created_at: string; // ISO timestamp
  updated_at: string;
  closed_at?: string;
  due?: string; // Due date
  deferred_until?: string;
  close_reason?: string;
}
```

**Field Mapping** (Beads → Tbd):

```typescript
const FIELD_MAP: Record<string, string> = {
  // Direct mappings
  id: 'id',
  title: 'title',
  description: 'description',
  notes: 'notes',
  status: 'status',
  priority: 'priority',
  assignee: 'assignee',
  labels: 'labels',
  created_at: 'created_at',
  updated_at: 'updated_at',
  closed_at: 'closed_at',
  close_reason: 'close_reason',
  deferred_until: 'deferred_until',

  // Renamed fields
  type: 'kind', // Beads "type" → Tbd "kind"
  due: 'due_date', // Beads "due" → Tbd "due_date"
  parent: 'parent_id', // Beads "parent" → Tbd "parent_id"
  blocks: 'dependencies', // Transformed to dependency array
};

const STATUS_MAP: Record<string, string> = {
  open: 'open',
  in_progress: 'in_progress',
  closed: 'closed',
  tombstone: 'skip', // Skip by default, --include-tombstones to convert to closed
};
```

**ID Mapping File** (`.tbd-sync/mappings/beads.yml`):

```yaml
# Maps Beads IDs to Tbd IDs for re-import support
# Format: beads_id: tbd_id
bd-a1b2c3: is-x7y8z9
bd-d4e5f6: is-a1b2c3
bd-parent: is-parent1
```

**ID Mapping Logic**:

```typescript
interface IdMapping {
  beadsToTbd: Map<string, string>;
  tbdToBeads: Map<string, string>;
}

async function loadIdMapping(storage: Storage): Promise<IdMapping> {
  const mappingPath = '.tbd-sync/mappings/beads.yml';
  const content = await storage.readFile(mappingPath).catch(() => '');
  const data = (yaml.load(content) as Record<string, string>) || {};

  const beadsToTbd = new Map(Object.entries(data));
  const tbdToBeads = new Map(Object.entries(data).map(([k, v]) => [v, k]));

  return { beadsToTbd, tbdToBeads };
}

function getOrCreateTbdId(beadsId: string, mapping: IdMapping, storage: Storage): string {
  // Check existing mapping
  const existing = mapping.beadsToTbd.get(beadsId);
  if (existing) return existing;

  // Generate new ID
  const newId = generateUniqueId(storage);
  mapping.beadsToTbd.set(beadsId, newId);
  mapping.tbdToBeads.set(newId, beadsId);

  return newId;
}
```

**Dependency Translation** (convert Beads IDs in deps):

```typescript
function translateDependencies(beadsIssue: BeadsExportLine, mapping: IdMapping): Dependency[] {
  if (!beadsIssue.blocks?.length) return [];

  return beadsIssue.blocks.map((beadsTargetId) => {
    const tbdTargetId = mapping.beadsToTbd.get(beadsTargetId);
    if (!tbdTargetId) {
      // Target not imported yet - will be resolved on second pass
      return { target: `pending:${beadsTargetId}`, type: 'blocks' };
    }
    return { target: tbdTargetId, type: 'blocks' };
  });
}

// Second pass: resolve pending dependencies after all issues imported
async function resolvePendingDependencies(issues: Issue[], mapping: IdMapping): Promise<void> {
  for (const issue of issues) {
    issue.dependencies = issue.dependencies
      .map((dep) => {
        if (dep.target.startsWith('pending:')) {
          const beadsId = dep.target.replace('pending:', '');
          const tbdId = mapping.beadsToTbd.get(beadsId);
          if (tbdId) {
            return { ...dep, target: tbdId };
          }
          // Target not found - log warning and remove
          console.warn(`Dependency target not found: ${beadsId}`);
          return null;
        }
        return dep;
      })
      .filter(Boolean);
  }
}
```

**Import Algorithm**:

```typescript
interface ImportResult {
  created: number;
  updated: number;
  unchanged: number;
  skipped: number;
  errors: ImportError[];
}

async function importFromJsonl(filePath: string, options: ImportOptions): Promise<ImportResult> {
  const result: ImportResult = {
    created: 0,
    updated: 0,
    unchanged: 0,
    skipped: 0,
    errors: [],
  };

  // Load existing ID mapping
  const mapping = await loadIdMapping(storage);

  // Read JSONL file
  const lines = await fs.readFile(filePath, 'utf8');
  const beadsIssues = lines
    .split('\n')
    .filter((line) => line.trim())
    .map((line) => JSON.parse(line) as BeadsExportLine);

  // First pass: create/update issues
  const tbdIssues: Issue[] = [];
  for (const beadsIssue of beadsIssues) {
    // Skip tombstones unless --include-tombstones
    if (beadsIssue.status === 'tombstone' && !options.includeTombstones) {
      result.skipped++;
      continue;
    }

    const tbdId = getOrCreateTbdId(beadsIssue.id, mapping, storage);
    const existing = await storage.readIssue(tbdId).catch(() => null);

    const issue = mapBeadsToTbd(beadsIssue, tbdId, mapping);

    if (!existing) {
      // New issue
      if (!options.dryRun) {
        await storage.writeIssue(issue);
      }
      result.created++;
    } else if (needsUpdate(existing, issue)) {
      // Merge with existing
      const merged = mergeImportedIssue(existing, issue);
      if (!options.dryRun) {
        await storage.writeIssue(merged);
      }
      result.updated++;
    } else {
      result.unchanged++;
    }

    tbdIssues.push(issue);
  }

  // Second pass: resolve pending dependencies
  await resolvePendingDependencies(tbdIssues, mapping);

  // Save updated ID mapping
  if (!options.dryRun) {
    await saveIdMapping(mapping, storage);
  }

  return result;
}
```

**--from-beads Direct Import** (read from Beads database):

```typescript
async function importFromBeads(options: FromBeadsOptions): Promise<ImportResult> {
  const beadsDir = options.dir || '.beads';

  // Detect Beads data sources
  const sources: BeadsSource[] = [];

  // Check main branch .beads/
  if (await fs.pathExists(path.join(beadsDir, 'db.sqlite'))) {
    sources.push({ type: 'sqlite', path: path.join(beadsDir, 'db.sqlite') });
  }

  // Check sync branch
  if (options.branch) {
    const syncData = await git('show', `${options.branch}:beads-sync.jsonl`);
    sources.push({ type: 'jsonl', data: syncData });
  }

  // Read and merge all sources
  const allIssues = new Map<string, BeadsExportLine>();
  for (const source of sources) {
    const issues = await readBeadsSource(source);
    for (const issue of issues) {
      const existing = allIssues.get(issue.id);
      if (!existing || issue.updated_at > existing.updated_at) {
        allIssues.set(issue.id, issue); // LWW merge
      }
    }
  }

  // Convert to JSONL and import
  const jsonl = Array.from(allIssues.values())
    .map((i) => JSON.stringify(i))
    .join('\n');

  const tmpFile = await writeTempFile(jsonl);
  return importFromJsonl(tmpFile, options);
}
```

#### Phase 11 Golden Tests

````markdown
---
sandbox: true
env:
  NO_COLOR: '1'
---

# Test: Import from JSONL file

```console
$ tbd init --quiet
$ cat > beads.jsonl << 'EOF'
{"id":"bd-a1b2","title":"Test issue","type":"bug","status":"open","priority":1}
{"id":"bd-c3d4","title":"Another issue","type":"feature","status":"in_progress","priority":2}
EOF
$ tbd import beads.jsonl
Importing from beads.jsonl...
  New issues: 2
  Updated: 0
  Unchanged: 0
[..]
Import complete.
? 0
$ tbd list
ID        PRI  STATUS       TITLE
bd-[..]   1    open         Test issue
bd-[..]   2    in_progress  Another issue
? 0
```

# Test: Import dry-run

```console
$ cat > beads2.jsonl << 'EOF'
{"id":"bd-x1y2","title":"New issue","type":"task","status":"open","priority":3}
EOF
$ tbd import beads2.jsonl --dry-run
DRY RUN - no changes will be made

Would import from beads2.jsonl:
  New issues: 1
    bd-x1y2 → is-??? "New issue"
[..]
? 0
```
````

### Phase 12: Polish & Documentation

**Epic:** tbd-1200

**Goal**: Final polish, documentation, and release preparation.

#### Phase 12 Tasks

- [x] Implement colored output with TTY detection — **tbd-1201** ✅
- [x] Implement help improvements — **tbd-1202** ✅
- [ ] Performance optimization — **tbd-1203** ⚠️ (pending benchmarks)
- [ ] Cross-platform testing — **tbd-1204** ⚠️ (needs CI setup)
- [ ] Documentation (README, migration guide) — **tbd-1205** ⚠️ (pending)
- [ ] Release preparation — **tbd-1206** ⚠️ (pending)

---

## Stage 5: Validation Stage

**Epic:** tbd-1300

### Validation Checklist

- [x] All golden tests pass — **tbd-1301** ✅ (104 tests passing)
- [ ] Unit test coverage > 80% — **tbd-1302** ⚠️ (needs measurement)
- [ ] Performance targets met (<50ms common operations) — **tbd-1303** ⚠️ (needs benchmarks)
- [ ] Cross-platform CI passes (Linux, macOS, Windows) — **tbd-1304** ⚠️ (needs CI)
- [ ] Manual testing of full workflow — **tbd-1305** ⚠️ (pending)
- [ ] Security review (no command injection, safe file operations) — **tbd-1306** ⚠️ (pending)

### Definition of Done

1. **Functional**: All CLI commands work as specified in design doc
2. **Tested**: Golden test coverage for all commands, unit tests for core logic
3. **Documented**: README, help text, migration guide
4. **Published**: npm package published and installable
5. **Compatible**: Beads import works, CLI flags compatible

---

## Testing Strategy: tryscript Golden Tests

### Test Organization

```
tests/golden/
├── 00-init.md           # Initialization tests
├── 01-issue-crud.md     # Create, list, show, update, close, reopen
├── 02-workflow.md       # ready, blocked, stale
├── 03-labels.md         # Label management
├── 04-deps.md           # Dependency management
├── 05-sync.md           # Sync operations
├── 06-search.md         # Search functionality
├── 07-maintenance.md    # info, stats, doctor, config
├── 08-attic.md          # Attic operations
├── 09-import.md         # Beads import
└── fixtures/
    ├── beads-export.jsonl
    └── issue-template.md
```

### Test Configuration

Each test file includes YAML frontmatter:

```yaml
---
env:
  NO_COLOR: '1' # Disable colors for stable output
  TBD_ACTOR: 'test-actor' # Consistent actor name
sandbox: true # Isolate in temp directory
---
```

### Elision Patterns

| Pattern  | Matches                   |
| -------- | ------------------------- |
| `[..]`   | Any text on that line     |
| `...`    | Zero or more lines        |
| `[CWD]`  | Current working directory |
| `[ROOT]` | Sandbox root directory    |
| `? N`    | Exit code N               |

### Running Tests

```bash
# Run all golden tests
pnpm test:golden

# Update expected output
pnpm test:golden --update

# Run specific test file
pnpm test:golden tests/golden/01-issue-crud.md

# Run with verbose output
pnpm test:golden --verbose

# Run with coverage (experimental)
pnpm test:golden --coverage
```

### CI Integration

```yaml
# .github/workflows/ci.yml
jobs:
  test:
    steps:
      - run: pnpm test:golden
      - run: pnpm test:unit
```

---

## Open Questions

### Resolved

- **CLI name**: `tbd` (to avoid conflict with shell `cd`)
- **Storage format**: Markdown + YAML front matter
- **Test framework**: tryscript for golden tests

### To Be Resolved During Implementation

1. **Index caching**: Implement in Phase 12 or defer?
2. **Windows path handling**: Test and fix during Phase 12
3. **Error message formatting**: Refine during testing

---

## Revision History

| Date       | Author | Changes                                                                                        |
| ---------- | ------ | ---------------------------------------------------------------------------------------------- |
| 2026-01-15 | Claude | Initial plan spec created                                                                      |
| 2026-01-15 | Claude | Updated bead status tracking: Phases 1-6 complete, Phases 7-12 partial, 104 tests passing      |
| 2026-01-15 | Claude | Implemented Phase 7 (sync: isolated index, merge, retry) and Phase 8 (search: staleness check) |
