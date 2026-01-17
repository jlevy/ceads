# TBD CLI Testing Strategy

## Overview

TBD CLI uses a multi-layered testing strategy following the golden testing philosophy
for comprehensive, maintainable coverage with minimal test maintenance burden.

## Test Architecture

### Test Layers

| Layer | Framework | Purpose | Count |
|-------|-----------|---------|-------|
| Unit Tests | vitest | Core logic, schemas, file operations | 165 tests |
| Golden Tests | tryscript | CLI integration, full command coverage | 318 tests |
| Benchmark | custom | Performance validation at scale | 5k issues |

### Test File Structure

```
packages/tbd-cli/
├── tests/
│   ├── *.test.ts           # Vitest unit tests (13 files)
│   ├── *.tryscript.md      # Tryscript golden tests (12 files)
│   └── golden/             # Golden test helpers and scenarios
├── scripts/
│   └── benchmark.ts        # Performance benchmarking
└── vitest.config.ts        # Test configuration
```

## Golden Testing Philosophy

Our golden tests follow the principles from `docs/general/agent-guidelines/golden-testing-guidelines.md`:

### Key Principles

1. **Full execution capture**: Each test captures complete command output (stdout, stderr, exit code)
2. **Stable field filtering**: Patterns normalize unstable values (timestamps, ULIDs)
3. **Sandboxed execution**: Each test runs in an isolated git repository
4. **Human-readable diffs**: Test failures show clear before/after comparison

### Pattern System for Unstable Fields

Tryscript tests define patterns to normalize non-deterministic values:

```yaml
patterns:
  ULID: '[0-9a-z]{26}'           # Full ULID identifiers
  SHORTID: '[0-9a-z]{4,5}'       # Short display IDs
  TIMESTAMP: "\\d{4}-\\d{2}-\\d{2}T\\d{2}:\\d{2}:\\d{2}(\\.\\d+)?Z"
```

These patterns replace actual values in expected output, enabling deterministic comparison:

```console
$ tbd create "New issue"
✓ Created bd-[SHORTID]: New issue
? 0
```

## Test Categories

### Unit Tests (vitest)

Fast, focused tests for business logic without external dependencies.

| File | Purpose |
|------|---------|
| schemas.test.ts | Zod schema validation |
| ids.test.ts | ULID generation, short ID resolution |
| hash.test.ts | Content hashing for conflict detection |
| parser.test.ts | YAML frontmatter parsing, round-trips |
| storage.test.ts | Atomic file writes, CRUD operations |
| config.test.ts | Configuration reading/writing |
| workflow.test.ts | Ready, blocked, stale logic |
| close-reopen.test.ts | Issue state transitions |
| label-depends.test.ts | Labels and dependency management |
| doctor-sync.test.ts | Health checks, sync status |
| attic-import.test.ts | Attic operations, beads import |
| merge.test.ts | Conflict resolution, field-level merge |
| errors.test.ts | Error handling and messages |

### Golden Tests (tryscript)

End-to-end CLI integration tests via subprocess execution.

| File | Commands Covered |
|------|------------------|
| cli-setup.tryscript.md | --help, --version, init, info |
| cli-crud.tryscript.md | create, show, update, list, close, reopen |
| cli-workflow.tryscript.md | ready, blocked, stale, label, depends |
| cli-advanced.tryscript.md | search, sync, doctor, config, attic, stats |
| cli-import.tryscript.md | import --from-beads, --validate |
| cli-import-e2e.tryscript.md | Full import workflow |
| cli-import-status.tryscript.md | Status mapping validation |
| cli-edge-cases.tryscript.md | Unicode, errors, boundaries |
| cli-filesystem.tryscript.md | Worktree architecture verification |
| cli-id-format.tryscript.md | ID display and resolution |
| cli-help-all.tryscript.md | Help text for all commands |
| cli-uninitialized.tryscript.md | Behavior before init |

## Running Tests

### Quick Commands

```bash
# Run all unit tests
pnpm test

# Run with coverage
pnpm test:coverage

# Run tryscript golden tests
pnpm test:tryscript

# Run specific test file
pnpm test -- tests/schemas.test.ts

# Run specific tryscript file
pnpm test:tryscript -- tests/cli-crud.tryscript.md
```

### Pre-commit Workflow

```bash
# Full validation (build + lint + test)
pnpm build && pnpm lint && pnpm test && pnpm test:tryscript
```

### Updating Golden Files

When behavior intentionally changes:

```bash
# Update tryscript golden expectations
pnpm test:tryscript -- --update

# Review changes
git diff tests/*.tryscript.md
```

## Writing New Tests

### Unit Test Template

```typescript
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

describe('feature', () => {
  let tempDir: string;

  beforeEach(async () => {
    tempDir = await mkdtemp(join(tmpdir(), 'tbd-test-'));
  });

  afterEach(async () => {
    await rm(tempDir, { recursive: true, force: true });
  });

  it('should do something', async () => {
    // Arrange
    const input = '...';

    // Act
    const result = await doSomething(input);

    // Assert
    expect(result).toBe('expected');
  });
});
```

### Tryscript Test Template

```markdown
---
sandbox: true
env:
  NO_COLOR: '1'
  FORCE_COLOR: '0'
timeout: 30000
patterns:
  ULID: '[0-9a-z]{26}'
  SHORTID: '[0-9a-z]{4,5}'
before: |
  git init --initial-branch=main
  git config user.email "test@example.com"
  git config user.name "Test User"
  echo "# Test" > README.md
  git add README.md
  git commit -m "Initial"
  node $TRYSCRIPT_TEST_DIR/../dist/bin.mjs init
---

# Test Category Name

## Test Group

# Test: Descriptive test name

\`\`\`console
$ node $TRYSCRIPT_TEST_DIR/../dist/bin.mjs command args
expected output with [SHORTID] patterns
? 0
\`\`\`
```

## Test Patterns

### Testing Error Conditions

```markdown
# Test: Invalid input shows helpful error

\`\`\`console
$ node $TRYSCRIPT_TEST_DIR/../dist/bin.mjs show invalid!!! 2>&1 | head -1
✗ Issue not found: invalid!!!
? 0
\`\`\`
```

### Testing JSON Output

```markdown
# Test: JSON output is valid

\`\`\`console
$ node $TRYSCRIPT_TEST_DIR/../dist/bin.mjs list --json | node -e "JSON.parse(require('fs').readFileSync(0,'utf8')); console.log('valid')"
valid
? 0
\`\`\`
```

### Testing File System Operations

```markdown
# Test: Issue file created in correct location

\`\`\`console
$ ls .tbd/data-sync-worktree/.tbd/data-sync/issues/*.md | wc -l
1
? 0
\`\`\`
```

## Coverage Goals

- **Line coverage**: >95%
- **Branch coverage**: >90%
- **All commands**: Tested via tryscript with --json and human-readable output
- **Error paths**: All user-facing errors have test coverage
- **Edge cases**: Unicode, boundaries, concurrent operations

## Performance Testing

The benchmark script validates operations stay fast at scale:

```bash
pnpm bench
```

Targets (5,000 issues):
- list: <500ms
- search: <500ms
- show: <500ms
- stats: <500ms

## CI Integration

Tests run on all platforms in GitHub Actions:

- Ubuntu (linux)
- macOS
- Windows

See `.github/workflows/ci.yml` for configuration.

## Debugging Failed Tests

### Vitest Tests

```bash
# Run with verbose output
pnpm test -- --reporter=verbose

# Run single test with debugging
pnpm test -- tests/ids.test.ts --reporter=verbose
```

### Tryscript Tests

```bash
# Run single test file with verbose
pnpm test:tryscript -- tests/cli-crud.tryscript.md --verbose

# Show full diff on failure
pnpm test:tryscript -- --diff
```

## Related Documentation

- Golden Testing Guidelines: `docs/general/agent-guidelines/golden-testing-guidelines.md`
- TDD Guidelines: `docs/general/agent-guidelines/general-tdd-guidelines.md`
- Design Spec: `docs/project/architecture/current/tbd-design-v3.md`
