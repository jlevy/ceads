# Tbd CLI Testing Strategy

This document describes the comprehensive testing strategy for tbd-cli, following the
[Golden Testing Philosophy](../../../docs/general/agent-guidelines/golden-testing-guidelines.md).

## Overview

Our testing approach prioritizes **transparent box testing** - capturing every meaningful detail of
execution so that any change—intentional or accidental—shows up in diffs. This provides maximum
visibility into system behavior while minimizing maintenance burden.

## Test Categories

### 1. Unit Tests (`*.test.ts`)

Fast, focused tests for individual functions and modules. These test pure logic in isolation.

**Characteristics:**
- Run in <10ms per test
- No I/O, network, or external dependencies
- Mock external boundaries only
- Focus on edge cases and error conditions

**Current Coverage:**
| File | Tests | Scope |
| --- | --- | --- |
| `schemas.test.ts` | 11 | Zod schema validation |
| `ids.test.ts` | 43 | ULID generation, short ID resolution |
| `hash.test.ts` | 13 | Content hashing for conflicts |
| `parser.test.ts` | 8 | YAML frontmatter parsing |
| `merge.test.ts` | 20 | Merge strategies, conflict resolution |
| `errors.test.ts` | 13 | Error message formatting |

### 2. Integration Tests (`*.test.ts` with file I/O)

Tests that exercise file system operations and multiple components together.

**Characteristics:**
- Use temp directories for isolation
- Test file read/write round-trips
- Verify data persistence
- Run in <500ms per test

**Current Coverage:**
| File | Tests | Scope |
| --- | --- | --- |
| `storage.test.ts` | 13 | Atomic writes, issue CRUD |
| `config.test.ts` | 5 | Config file operations |
| `workflow.test.ts` | 6 | Ready, blocked, stale logic |
| `close-reopen.test.ts` | 8 | Issue state transitions |
| `label-depends.test.ts` | 7 | Label and dependency operations |
| `doctor-sync.test.ts` | 4 | Health checks, sync status |
| `attic-import.test.ts` | 7 | Attic operations, import mapping |

### 3. Golden Tests (`golden/`)

End-to-end CLI tests that capture complete command output and compare against committed baselines.

**Characteristics:**
- Run actual CLI commands via subprocess
- Capture stdout, stderr, exit codes
- Normalize unstable fields (ULIDs, timestamps, paths)
- YAML format for human-readable diffs
- Run in <100ms per scenario (target)

**Current Scenarios:**
| Scenario | Tests | Commands Covered |
| --- | --- | --- |
| `core-workflow` | 1 | create, list, show |
| `update-close` | 1 | update, close |
| `uninitialized-list` | 1 | list (no init) |
| `missing-issue` | 1 | show (not found) |
| `input-validation` | 1 | create (invalid) |
| `dry-run` | 1 | create --dry-run |
| `info-command` | 1 | info --json |

## Golden Testing Implementation

### Event Schema and Field Classification

Per the Golden Testing Philosophy, all fields are classified as **stable** or **unstable**:

**Stable Fields (must match exactly):**
- `command`, `args` - the CLI invocation
- `exitCode` - process return code
- Structural content (JSON keys, YAML structure)
- Error message patterns
- Business logic output (counts, status values)

**Unstable Fields (normalized before comparison):**
- ULIDs: `is-[26 chars]` → `is-[ULID]`
- Display IDs: `bd-[4-6 chars]` → `bd-[ULID]`
- Timestamps: ISO8601 → `[TIMESTAMP]`
- Temp paths: platform-specific → `/tmp/tbd-golden-[TEMP]`

### Normalization Implementation

See `runner.ts` for the normalization functions:

```typescript
// Pattern matching for unstable fields
const TIMESTAMP_PATTERN = /\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{3})?Z/g;

export function normalizeOutput(output: string): string {
  let normalized = output;

  // Filter environment noise
  normalized = normalized.split('\n')
    .filter(line => !line.startsWith('npm warn '))
    .join('\n');

  // Replace ULIDs with placeholder
  normalized = normalized.replace(/\b(is-)[0-9a-z]{26}\b/g, '$1[ULID]');
  normalized = normalized.replace(/\b(bd-)[0-9a-z]{4,26}\b/g, '$1[ULID]');

  // Replace timestamps
  normalized = normalized.replace(TIMESTAMP_PATTERN, '[TIMESTAMP]');

  // Normalize temp paths (cross-platform)
  // ...

  return normalized;
}
```

### Scenario File Format

Golden files use YAML for human-readable PR diffs:

```yaml
name: core-workflow
description: Create, list, and show an issue
results:
  - command: tbd
    args:
      - create
      - Test task
    exitCode: 0
    stdout: |
      ✓ Created bd-[ULID]: Test task
    stderr: ''
```

## Test Helpers (`test-helpers.ts`)

### ID Format Validation

```typescript
// Verify display IDs are short format (not internal ULIDs)
export function isValidShortIdFormat(id: string): boolean {
  const shortPart = id.replace(/^[a-z]+-/, '');
  return /^[a-z0-9]{4,5}$/.test(shortPart);
}

// Verify internal IDs are full ULID format
export function isValidInternalIdFormat(id: string): boolean {
  const ulidPart = id.replace(/^is-/, '');
  return /^[a-z0-9]{26}$/.test(ulidPart);
}
```

### File Location Verification

```typescript
// Check file is in correct worktree location
export function isCorrectWorktreePath(path: string): boolean {
  return path.includes('.tbd/data-sync-worktree/.tbd/data-sync/');
}
```

### Serialization Format Verification

```typescript
// Verify no extra newline after YAML frontmatter
export function hasCorrectFrontmatterFormat(content: string): boolean {
  // Implementation checks for bug tbd-1812
}
```

### Status Mapping Constants

```typescript
// All beads status values that must be handled
export const BEADS_STATUS_VALUES = [
  'open', 'in_progress', 'done', 'closed', 'tombstone', 'blocked', 'deferred'
];

// Expected mapping to tbd status
export const BEADS_TO_TBD_STATUS = {
  open: 'open',
  in_progress: 'in_progress',
  done: 'closed',     // Critical: was missing, causing import bugs
  closed: 'closed',
  tombstone: 'closed',
  blocked: 'blocked',
  deferred: 'deferred'
};
```

## Running Tests

```bash
# All tests
pnpm test

# Unit tests only
pnpm test:unit

# Golden tests only
pnpm test -- golden

# Update golden files after intentional changes
UPDATE_GOLDEN=1 pnpm test -- golden

# Coverage report
pnpm test:coverage

# Watch mode for TDD
pnpm test:watch
```

## Adding New Tests

### Adding a Unit Test

1. Create test file in `tests/` matching the source module
2. Import test helpers from `test-helpers.ts`
3. Use consistent ULID constants (`TEST_ULIDS.XXX`)
4. Follow Arrange-Act-Assert pattern

```typescript
import { describe, it, expect } from 'vitest';
import { TEST_ULIDS, testId, createTestIssue } from './test-helpers.js';

describe('myFunction', () => {
  it('handles expected input', () => {
    const issue = createTestIssue({
      id: testId(TEST_ULIDS.ULID_1),
      title: 'Test'
    });

    const result = myFunction(issue);

    expect(result).toBe('expected');
  });
});
```

### Adding a Golden Test

1. Add test case to `golden/golden.test.ts`
2. Run with `UPDATE_GOLDEN=1` to generate baseline
3. Review generated YAML in `golden/scenarios/`
4. Commit both test code and golden file

```typescript
it('my new scenario', async () => {
  const results: CommandResult[] = [];

  // Run CLI commands
  results.push(await runCli('command', 'args'));

  const scenario: GoldenScenario = {
    name: 'my-scenario',
    description: 'What this tests',
    results
  };

  await verifyGolden('my-scenario', scenario);
}, GOLDEN_TEST_TIMEOUT);
```

## Test Coverage Goals

### Current Status (165 tests, 97.47% line coverage)

- ✅ Core CRUD operations
- ✅ Issue state transitions
- ✅ Label and dependency management
- ✅ Error handling and validation
- ✅ Uninitialized state detection
- ✅ Dry-run mode

### In Progress (Phase 18)

- [ ] Color mode variations (tbd-1846)
- [ ] Performance tests with 1000+ issues (tbd-1851)
- [ ] Sync conflict edge cases (tbd-1847)
- [ ] Unicode/special character handling (tbd-1848)

### Future Enhancements

- Property-based testing for fuzzing
- Contract tests for CLI JSON output schema
- Performance regression detection

## Debugging Test Failures

### Golden Test Failures

1. Check the diff output - shows expected vs actual
2. If intentional change: `UPDATE_GOLDEN=1 pnpm test -- golden`
3. Review the updated `.yaml` file before committing
4. If unintentional: fix the code, don't update golden

### Flaky Tests

Common causes and fixes:
- **Timestamp order**: Use deterministic sorting
- **Race conditions**: Await all async operations
- **Temp file cleanup**: Use `afterEach` with `force: true`

## CI Integration

Tests run on all platforms:
- Linux (ubuntu-latest)
- macOS (macos-latest)
- Windows (windows-latest) ✅ Fixed: renamed shortcut:*.md files

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

## References

- [Golden Testing Guidelines](../../../docs/general/agent-guidelines/golden-testing-guidelines.md)
- [TDD Guidelines](../../../docs/general/agent-guidelines/general-tdd-guidelines.md)
- [Tbd Design Spec](../../../docs/project/architecture/current/tbd-design-v3.md)
