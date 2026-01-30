# Testing Architecture

Last updated: 2026-01-30

Maintenance: When revising this doc you must follow instructions in
@shortcut-revise-architecture-doc.md.

## Overview

This document describes the comprehensive testing architecture for tbd, following the
Golden Testing Philosophy for maximum coverage with minimal maintenance burden.
The approach prioritizes **transparent box testing** - capturing every meaningful detail
of execution so behavioral changes show up immediately in diffs.

**Scope**: Testing patterns, infrastructure, and guidelines for tbd.
Covers unit tests, integration tests, and golden tests.
Does not cover manual validation procedures.

**Related Documents:**

- [Golden Testing Guidelines](../../general/agent-guidelines/golden-testing-guidelines.md)
- [TDD Guidelines](../../general/agent-guidelines/general-tdd-guidelines.md)
- [tbd Design v3](tbd-design.md)

## Test Category Philosophy

Tests are organized by **what they require to run**:

| Category | File I/O | Process Spawn | Duration | CI-Safe |
| --- | --- | --- | --- | --- |
| **Unit** | No | No | ~30s total | Yes |
| **Integration** | Temp dirs | No | ~1min | Yes |
| **Tryscript (Golden)** | Temp dirs | Yes (CLI) | ~2.5min | Yes |
| **Vitest Golden** | Temp dirs | Yes (CLI) | ~50s | Yes |
| **Performance** | Temp dirs | No | ~2min | No (time) |

**Key distinctions:**

- **CI-Safe tests** (unit, integration, tryscript, vitest golden): Fast, no external
  dependencies, run every commit
- **Tryscript tests**: Primary golden testing via Markdown-based CLI traces with regex
  pattern matching
- **Vitest Golden tests**: Supplementary YAML-based golden tests for specific scenarios
- **Performance tests**: Validate <50ms operation targets with large datasets

```
┌───────────────────────────────────────────────────┐
│              Performance (7 tests)                 │  Large datasets
│        (Validates timing targets)                  │  1000+ issues
├───────────────────────────────────────────────────┤
│       Tryscript Golden (~3 min, 33 files)         │  CLI subprocess
│     (Markdown-based, pattern matching)            │  Primary golden testing
├───────────────────────────────────────────────────┤
│      Vitest Golden (~50 sec, 7 scenarios)         │  CLI subprocess
│     (YAML-based, exact comparison)                │  Supplementary golden
├───────────────────────────────────────────────────┤
│     Integration (~1.5 min, ~500 tests)            │  Temp directories
│        (File I/O, multi-component)                │  Data round-trips
├───────────────────────────────────────────────────┤
│          Unit (~30 sec, ~300 tests)               │  No I/O
│        (Pure functions, schemas)                   │  Mocked boundaries
└───────────────────────────────────────────────────┘

Total: 843 vitest tests + tryscript tests (~1000+ total assertions)
```

## Terminology

- **Golden Test**: A test that captures complete execution output and compares against
  committed baseline files ("golden files")
- **Stable Field**: A field value that is deterministic and must match exactly (command
  names, counts, error messages)
- **Unstable Field**: A field value that varies between runs and must be normalized
  (ULIDs, timestamps, temp paths)
- **Scenario**: A complete sequence of CLI commands with captured outputs in a golden
  test

## Test Categories

### 1. Unit Tests (CI-Safe)

**Config**: `vitest.config.ts`

**Pattern**: `*.test.ts` (files without file I/O)

**Command**: `pnpm test:unit`

**Timeout**: 10 seconds per test

Unit tests verify isolated functions and components without file system dependencies.
They mock all external boundaries.

**Requirements**: None - runs anywhere

**When to run**: Every commit

**Current Coverage (select examples):**

| File | Scope |
| --- | --- |
| `schemas.test.ts` | Zod schema validation |
| `ids.test.ts` | ULID generation, short ID resolution |
| `parser.test.ts` | YAML frontmatter parsing |
| `merge.test.ts` | Merge strategies, conflict resolution |
| `errors.test.ts` | Error message formatting |
| `priority.test.ts` | Priority parsing and formatting |
| `status.test.ts` | Status icons and colors |
| `truncate.test.ts` | Text truncation utilities |
| `issue-format.test.ts` | Issue line formatting |
| `comparison-chain.test.ts` | Multi-field sorting |

### 2. Integration Tests (CI-Safe)

**Pattern**: `*.test.ts` (files with temp directory usage)

**Command**: `pnpm test:unit` (included in default run)

**Timeout**: 30 seconds per test

Integration tests use temp directories to verify file operations and multi-component
flows. They verify that storage, config, and workflow layers work correctly together.

**Requirements**: None - uses temp directories for isolation

**When to run**: Every commit

**Current Coverage (select examples):**

| File | Scope |
| --- | --- |
| `storage.test.ts` | Atomic writes, issue CRUD |
| `config.test.ts` | Config file operations |
| `workflow.test.ts` | Ready, blocked, stale logic |
| `close-reopen.test.ts` | Issue state transitions |
| `label-depends.test.ts` | Label and dependency operations |
| `doctor-sync.test.ts` | Health checks, sync status |
| `setup-flows.test.ts` | Setup and migration flows |
| `setup-hooks.test.ts` | Claude Code hooks setup |
| `project-paths.test.ts` | Path detection and resolution |
| `doc-sync.test.ts` | Documentation sync operations |
| `github-fetch.test.ts` | GitHub API integration |

### 3. Tryscript Tests (CI-Safe) — Primary Golden Testing

**Pattern**: `*.tryscript.md`

**Command**: `pnpm test:tryscript`

**Timeout**: 30 seconds per file

Tryscript is the **primary golden testing approach** for CLI behavior.
Tests are written in Markdown with embedded console blocks that specify expected command
output. Tryscript handles:

- Sandbox isolation with temp directories
- Regex pattern matching for unstable values
- Automatic git repository setup
- Cross-platform compatibility

**Requirements**: Built CLI (`pnpm build` first)

**When to run**: Every commit

**Current Coverage (33 tryscript files):**

| File | Commands Covered |
| --- | --- |
| `cli-setup.tryscript.md` | --help, --version, init, info |
| `cli-crud.tryscript.md` | create, show, update, list, close, reopen |
| `cli-workflow.tryscript.md` | ready, blocked, stale, label, depends |
| `cli-advanced.tryscript.md` | search, sync, doctor, config, attic, stats |
| `cli-import.tryscript.md` | import (JSONL, validation) |
| `cli-import-e2e.tryscript.md` | import --from-beads (full workflow) |
| `cli-help-all.tryscript.md` | <cmd> --help for all commands |
| `cli-uninitialized.tryscript.md` | commands without init |
| `cli-filesystem.tryscript.md` | file location verification |
| `cli-id-format.tryscript.md` | ID format validation |
| `cli-import-status.tryscript.md` | status mapping coverage |
| `cli-edge-cases.tryscript.md` | error handling edge cases |
| `cli-color-modes.tryscript.md` | --color flag, NO_COLOR env var |
| `cli-sync.tryscript.md` | sync command, worktree operations |
| `cli-sync-remote.tryscript.md` | remote sync scenarios |
| `cli-sync-worktree-scenarios.tryscript.md` | worktree edge cases |
| `cli-status.tryscript.md` | status command output |
| `cli-prime.tryscript.md` | prime command behavior |
| `cli-spec-linking.tryscript.md` | spec-bead linking |
| `cli-spec-inherit.tryscript.md` | spec inheritance |
| `cli-list-*.tryscript.md` | list command variations |
| `cli-setup-commands.tryscript.md` | setup subcommands |
| (+ 11 more files) | Various CLI scenarios |

**Tryscript File Format:**

```markdown
---
sandbox: true
env:
  NO_COLOR: '1'
  FORCE_COLOR: '0'
path:
  - ../dist
timeout: 30000
patterns:
  ULID: '[0-9a-z]{26}'
  TIMESTAMP: "\\d{4}-\\d{2}-\\d{2}T\\d{2}:\\d{2}:\\d{2}(\\.\\d+)?Z"
before: |
  git init --initial-branch=main
  git config user.email "test@example.com"
  git config user.name "Test User"
  echo "# Test repo" > README.md
  git add README.md
  git commit -m "Initial commit"
---

# Test: Create an issue

\`\`\`console
$ tbd create "Test issue" -t task
✓ Created bd-[..]: Test issue
? 0
\`\`\`
```

The `path` option (tryscript 0.1.5+) adds `../dist` to the PATH, enabling clean `tbd`
commands instead of verbose `node $TRYSCRIPT_TEST_DIR/../dist/bin.mjs` invocations.

### 4. Vitest Golden Tests (CI-Safe) — Supplementary

**Config**: `vitest.config.ts`

**Pattern**: `golden/golden.test.ts`

**Command**: `pnpm test -- golden`

**Timeout**: 60 seconds per scenario

Vitest golden tests are a **supplementary golden testing approach** using YAML baseline
files with exact output comparison.
They complement Tryscript for scenarios that benefit from programmatic test setup or
need additional assertions beyond output matching.

**Requirements**: None - uses temp directories and spawns subprocesses

**When to run**: Every commit

**Current Scenarios (7):**

| Scenario | Commands Covered |
| --- | --- |
| `core-workflow` | create, list, show |
| `update-close` | update, close |
| `uninitialized-list` | list (no init) |
| `missing-issue` | show (not found) |
| `input-validation` | create (invalid) |
| `dry-run` | create --dry-run |
| `info-command` | info --json |

### 5. Performance Tests (CI-Safe)

**Pattern**: `performance.test.ts`

**Command**: `pnpm test` (included in default run)

**Timeout**: 2 minutes per test suite

Performance tests validate operation timing targets with 1000+ issues:

- Single issue write: <50ms
- 100 issues write: <3000ms (30ms avg)
- 1000 issues list: <2000ms
- Single issue read: <10ms
- In-memory filtering: <50ms
- In-memory sorting: <50ms

**Requirements**: None - uses temp directories

**When to run**: Every commit (relaxed thresholds for CI environments)

**Current Coverage (7 tests):**

| Test | Target | Description |
| --- | --- | --- |
| writes single issue | <50ms | Single atomic write |
| writes 100 issues | <3s | Batch write throughput |
| lists 1000 issues | <2s | Full directory scan |
| reads single issue | <10ms | Random access read |
| reads 100 random | <500ms | Multi-read throughput |
| filters 1000 by status | <50ms | In-memory filtering |
| sorts 1000 by priority | <50ms | In-memory sorting |

## When to Use Golden Tests vs. Traditional Integration Tests

| Use Case | Approach | Why |
| --- | --- | --- |
| CLI command behavior | Golden | Full trace visibility, regression detection |
| Complex multi-step workflows | Golden | Captures intermediate states |
| Error message verification | Golden | Easy to review diff in PR |
| API response format changes | Golden | Full output comparison |
| Single function logic | Traditional | Programmatic assertions are clearer |
| Edge case validation | Traditional | Explicit expectations |
| Performance constraints | Traditional | Assertions on timing |

## Test File Organization

**Files**: `packages/tbd/tests/`

```
tests/
├── golden/                       # Vitest golden tests (CLI integration)
│   ├── golden.test.ts            # Test runner
│   ├── runner.ts                 # Infrastructure
│   ├── README.md                 # Usage docs
│   └── scenarios/                # Golden baselines (YAML)
│       ├── core-workflow.yaml
│       └── ...
├── test-helpers.ts               # Shared test utilities
├── *.test.ts                     # 47 vitest test files (unit + integration)
│   ├── Unit tests: schemas, ids, parser, merge, errors, priority,
│   │              status, truncate, issue-format, comparison-chain, etc.
│   └── Integration: storage, config, workflow, setup-flows, setup-hooks,
│                    project-paths, doc-sync, github-fetch, etc.
├── performance.test.ts           # Performance: Large dataset tests
└── *.tryscript.md                # 33 tryscript files covering all CLI commands
    ├── cli-setup.tryscript.md    # init, info, help
    ├── cli-crud.tryscript.md     # create, show, update, list
    ├── cli-workflow.tryscript.md # ready, blocked, stale
    ├── cli-sync*.tryscript.md    # sync operations (4 files)
    └── ...                       # (28 more tryscript files)
```

## Golden Test Infrastructure

**Files**: `tests/golden/runner.ts`

### Key Concepts

**Stable vs. Unstable Fields**: Every field in session output must be classified:

- **Stable**: Deterministic values that must match exactly (actions, quantities,
  configuration)
- **Unstable**: Non-deterministic values filtered before comparison (timestamps, IDs,
  paths)

### Field Classification

```typescript
// Stable: Must match exactly
command: string;      // CLI command
args: string[];       // Arguments
exitCode: number;     // Process return code
// (Also: JSON keys, error patterns, counts)

// Unstable: Normalized before comparison
ULID: string;         // -> '[ULID]'
timestamp: string;    // -> '[TIMESTAMP]'
tempPath: string;     // -> '/tmp/tbd-golden-[TEMP]'
```

### Normalization Functions

```typescript
const TIMESTAMP_PATTERN = /\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{3})?Z/g;

export function normalizeOutput(output: string): string {
  let normalized = output;

  // Filter environment noise (npm warnings)
  normalized = normalized.split('\n')
    .filter(line => !line.startsWith('npm warn '))
    .join('\n');

  // Replace ULIDs with placeholder
  normalized = normalized.replace(/\b(is-)[0-9a-z]{26}\b/g, '$1[ULID]');
  normalized = normalized.replace(/\b(bd-)[0-9a-z]{4,26}\b/g, '$1[ULID]');

  // Replace timestamps
  normalized = normalized.replace(TIMESTAMP_PATTERN, '[TIMESTAMP]');

  // Normalize temp paths (cross-platform)
  normalized = normalized.replace(/\/tmp\/tbd-golden-[0-9a-f]+/g, '/tmp/tbd-golden-[TEMP]');
  // ... macOS and Windows patterns

  return normalized;
}
```

### Scenario File Format

```yaml
name: core-workflow
description: Create, list, and show an issue
results:
  - command: tbd
    args:
      - create
      - Test task
      - -t
      - task
    exitCode: 0
    stdout: |
      ✓ Created bd-[ULID]: Test task
    stderr: ''
```

### Command Execution

```typescript
export function runCommand(
  workDir: string,
  _command: string,
  args: string[]
): Promise<CommandResult> {
  const cliPath = join(PACKAGE_DIR, 'src', 'cli', 'bin.ts');
  const cmd = `npx tsx "${cliPath}" ${args.join(' ')}`;

  const result = execSync(cmd, {
    cwd: workDir,
    encoding: 'utf-8',
    env: {
      ...process.env,
      NO_COLOR: '1',      // Disable color for deterministic output
      FORCE_COLOR: '0',
    },
    stdio: ['pipe', 'pipe', 'pipe'],
  });

  return {
    command: 'tbd',
    args: normalizeOutput(args),
    exitCode,
    stdout: normalizeOutput(stdout),
    stderr: normalizeOutput(stderr),
  };
}
```

## Test Helper Utilities

**File**: `tests/test-helpers.ts`

### Deterministic Test IDs

```typescript
export const TEST_ULIDS = {
  ULID_1: '01aaaaaaaaaaaaaaaaaaaaaa01',
  ULID_2: '01aaaaaaaaaaaaaaaaaaaaaa02',
  STORAGE_1: '01storage00000000000000001',
  PARSER_1: '01parser000000000000000001',
};

export function testId(ulid: string): string {
  return `is-${ulid}`;
}
```

### Validation Helpers

```typescript
// Verify display IDs are short format (not internal ULIDs)
export function isValidShortIdFormat(id: string): boolean;

// Verify internal IDs are full ULID format
export function isValidInternalIdFormat(id: string): boolean;

// Check file is in correct worktree location
export function isCorrectWorktreePath(path: string): boolean;

// Verify no extra newline after YAML frontmatter
export function hasCorrectFrontmatterFormat(content: string): boolean;
```

### Status Mapping Constants

```typescript
export const BEADS_TO_TBD_STATUS: Record<string, string> = {
  open: 'open',
  in_progress: 'in_progress',
  done: 'closed',      // Critical mapping
  closed: 'closed',
  tombstone: 'closed',
  blocked: 'blocked',
  deferred: 'deferred'
};
```

## Developer Workflows

### Quick Iteration

```bash
pnpm test:unit       # Fastest feedback loop (~30s)
```

### Before Committing

```bash
pnpm test           # Full test suite (~50s)
# or
pnpm precommit      # Format + lint + typecheck + tests
```

### After Modifying CLI Behavior

```bash
pnpm test                         # Run tests first
UPDATE_GOLDEN=1 pnpm test -- golden  # Update if intentional
git diff tests/golden/scenarios/   # Review changes
```

### Golden Test Workflow

1. **Make changes**: Modify CLI logic, output formatting, error messages
2. **Run golden tests**: `pnpm test -- golden` — tests fail if behavior changed
3. **Review diffs**: Compare actual vs expected in error output
4. **Decide**: Either fix the code (if unintentional) or update golden files
5. **Update if intentional**: `UPDATE_GOLDEN=1 pnpm test -- golden`
6. **Commit**: Include golden files with code changes for PR review

## Test Script Organization

```bash
pnpm test               # Full vitest suite (unit + integration + golden + performance)
pnpm test:tryscript     # Tryscript CLI tests (33 files)
pnpm test:coverage      # Combined coverage report (vitest + tryscript)
pnpm test:watch         # Watch mode for TDD
```

## Choosing the Right Test Category

| What you're testing | Test category | Why |
| --- | --- | --- |
| Pure function | Unit | No dependencies |
| Zod schema validation | Unit | Pure logic |
| File storage round-trip | Integration | Uses temp dirs |
| Multi-step workflow | Integration | Tests component interaction |
| CLI command output | Golden | Full behavior capture |
| Error message format | Golden | Easy diff review |
| Large dataset handling | Performance | Tests timing targets |

## CI Configuration

Tests run on all platforms via GitHub Actions:

```yaml
# .github/workflows/ci.yml
jobs:
  test:
    strategy:
      matrix:
        os: [ubuntu-latest, macos-latest, windows-latest]
    steps:
      - run: pnpm test
```

**Platform-specific notes:**
- Windows: Fixed by renaming `shortcut:*.md` → `shortcut-*.md` (colons invalid)
- macOS: Temp path normalization handles `/private/var/folders/`
- All: `NO_COLOR=1` ensures deterministic golden output

## Usage Guidelines

### DO: Use Consistent Test IDs

```typescript
// ✅ CORRECT: Use predefined ULIDs from test-helpers
import { TEST_ULIDS, testId } from './test-helpers.js';

const issue = createTestIssue({
  id: testId(TEST_ULIDS.STORAGE_1),
  title: 'Test'
});
```

### DON’T: Generate Random IDs in Tests

```typescript
// ❌ WRONG: Non-deterministic tests
const issue = createTestIssue({
  id: `is-${ulid()}`,  // Different every run!
  title: 'Test'
});
```

### DO: Capture Full Command Sequences

```typescript
// ✅ CORRECT: Golden test with full workflow
it('workflow test', async () => {
  const results: CommandResult[] = [];
  results.push(await runCli('create', 'Test', '-t', 'task'));
  results.push(await runCli('list', '--json'));
  await verifyGolden('workflow', { name: 'workflow', results });
});
```

### DON’T: Skip Normalization

```typescript
// ❌ WRONG: Comparing raw output with timestamps
expect(output).toBe('Created is-abc123 at 2026-01-17T05:00:00Z');

// ✅ CORRECT: Normalize unstable fields
expect(normalizeOutput(output)).toBe('Created is-[ULID] at [TIMESTAMP]');
```

## Architecture Diagram

```
Data Flow for Golden Tests:

  Test Code              Runner                  CLI               Golden File
      │                    │                      │                     │
      │ runCli(args)       │                      │                     │
      │───────────────────>│                      │                     │
      │                    │ spawn subprocess     │                     │
      │                    │─────────────────────>│                     │
      │                    │                      │ execute             │
      │                    │<─────────────────────│                     │
      │                    │ capture stdout/err   │                     │
      │                    │                      │                     │
      │                    │ normalize output     │                     │
      │                    │ (ULIDs, timestamps)  │                     │
      │<───────────────────│                      │                     │
      │ CommandResult      │                      │                     │
      │                    │                      │                     │
      │ verifyGolden()     │                      │                     │
      │───────────────────────────────────────────────────────────────>│
      │                    │                      │     compare YAML    │
      │<──────────────────────────────────────────────────────────────│
      │ pass/fail + diff   │                      │                     │
```

## References

- [Golden Testing Guidelines](../../general/agent-guidelines/golden-testing-guidelines.md)
  \- Core methodology
- [TDD Guidelines](../../general/agent-guidelines/general-tdd-guidelines.md) -
  Test-driven development
- [vitest](https://vitest.dev/) - Test runner for unit/integration/golden tests
- [tryscript](https://github.com/jlevy/tryscript) - Markdown-based CLI test runner
- [picocolors](https://github.com/alexeyraspopov/picocolors) - Color output (tested with
  NO_COLOR)
- [commander.js](https://github.com/tj/commander.js) - CLI framework
