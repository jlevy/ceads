# Plan Spec: Gitignore Utils Library

## Purpose

Create a reusable utility library for idempotent .gitignore editing with atomic writes.

## Background

Currently, gitignore handling is duplicated in
[init.ts:70-89](packages/tbd/src/cli/commands/init.ts#L70-L89) and
[setup.ts:1114-1136](packages/tbd/src/cli/commands/setup.ts#L1114-L1136). Both use
full-file overwrite which:
- Loses user-added patterns
- Is not idempotent
- Has no pattern detection

## Summary of Task

Create `packages/tbd/src/utils/gitignore-utils.ts` with:
1. **Detection function** - check if patterns exist (regex-based)
2. **Edit function** - idempotent append with atomic write
3. **Refactor** - update init.ts and setup.ts to use the new lib

## Backward Compatibility

- **CLI:** No changes
- **File formats:** .gitignore files gain patterns, never lose existing ones
- **Breaking changes:** None

## Stage 1: Planning

### Requirements

- Idempotent: running twice produces same result
- Atomic: uses `atomically.writeFile()`
- Creates file if missing
- Appends only missing patterns
- Preserves existing user patterns

### Not In Scope

- Removing patterns
- Reordering patterns
- Parsing negation patterns (!)

## Stage 2: Architecture

### API Design

```typescript
// packages/tbd/src/utils/gitignore-utils.ts

/**
 * Check if a pattern exists in gitignore content.
 * Matches exact lines (ignoring comments and blanks).
 */
export function hasGitignorePattern(content: string, pattern: string): boolean;

/**
 * Ensure patterns exist in a .gitignore file.
 * Creates file if missing. Appends only missing patterns.
 * Always uses atomic write.
 */
export async function ensureGitignorePatterns(
  gitignorePath: string,
  patterns: string[],
  header?: string
): Promise<{ added: string[]; skipped: string[]; created: boolean }>;
```

### Pattern Matching Rules

- Normalize trailing slashes: `foo/` matches `foo/`
- Exact line match (not substring)
- Skip comment lines (`#`) and blank lines when checking
- Case-sensitive (gitignore is case-sensitive on Linux)

### File Structure

```
packages/tbd/src/utils/
├── gitignore-utils.ts    # NEW
├── file-utils.ts
├── markdown-utils.ts
├── time-utils.ts
└── index.ts              # Add export
```

## Stage 3: Implementation

### Phase 1: Create gitignore-utils.ts

```typescript
/**
 * Gitignore file utilities for idempotent pattern management.
 */

import { readFile } from 'node:fs/promises';
import { writeFile } from 'atomically';
import { pathExists } from './file-utils.js';

/**
 * Check if a pattern exists in gitignore content.
 * Matches exact lines, normalizing trailing slashes for directories.
 */
export function hasGitignorePattern(content: string, pattern: string): boolean {
  const normalizedPattern = pattern.replace(/\/+$/, '');
  const lines = content.split('\n');

  for (const line of lines) {
    const trimmed = line.trim();
    // Skip comments and empty lines
    if (trimmed === '' || trimmed.startsWith('#')) continue;

    const normalizedLine = trimmed.replace(/\/+$/, '');
    if (normalizedLine === normalizedPattern) {
      return true;
    }
  }
  return false;
}

/**
 * Ensure patterns exist in a .gitignore file.
 * Creates file if missing. Appends only missing patterns.
 * Always uses atomic write.
 *
 * @param gitignorePath - Path to .gitignore file
 * @param patterns - Patterns to ensure exist (can include comments)
 * @param header - Optional header comment for new patterns section
 */
export async function ensureGitignorePatterns(
  gitignorePath: string,
  patterns: string[],
  header?: string
): Promise<{ added: string[]; skipped: string[]; created: boolean }> {
  // Read existing content or empty string
  let content = '';
  let created = false;

  if (await pathExists(gitignorePath)) {
    content = await readFile(gitignorePath, 'utf-8');
  } else {
    created = true;
  }

  // Determine which patterns need to be added
  const added: string[] = [];
  const skipped: string[] = [];

  for (const pattern of patterns) {
    const trimmed = pattern.trim();
    // Always add comments and blank lines (for formatting)
    if (trimmed === '' || trimmed.startsWith('#')) {
      added.push(pattern);
    } else if (hasGitignorePattern(content, trimmed)) {
      skipped.push(trimmed);
    } else {
      added.push(pattern);
    }
  }

  // If nothing to add (all skipped), return early
  if (added.length === 0) {
    return { added: [], skipped, created: false };
  }

  // Build new content
  let newContent = content;

  // Ensure content ends with newline before appending
  if (newContent && !newContent.endsWith('\n')) {
    newContent += '\n';
  }

  // Add blank line separator if file has existing content
  if (newContent && !newContent.endsWith('\n\n')) {
    newContent += '\n';
  }

  // Add header if provided
  if (header) {
    newContent += header + '\n';
  }

  // Add patterns
  newContent += added.join('\n') + '\n';

  // Atomic write
  await writeFile(gitignorePath, newContent);

  // Filter out comments/blanks from "added" for return value
  const addedPatterns = added.filter(p => p.trim() && !p.trim().startsWith('#'));

  return { added: addedPatterns, skipped, created };
}
```

### Phase 2: Export from index.ts

Add to `packages/tbd/src/utils/index.ts`:
```typescript
export * from './gitignore-utils.js';
```

### Phase 3: Refactor init.ts and setup.ts

Replace duplicated gitignore creation in both files with:
```typescript
import { ensureGitignorePatterns } from '../../utils/gitignore-utils.js';

// In initializeTbd() method:
const gitignorePath = join(cwd, TBD_DIR, '.gitignore');
await ensureGitignorePatterns(gitignorePath, [
  '# Installed documentation (regenerated on setup)',
  'docs/',
  '',
  '# Hidden worktree for tbd-sync branch',
  `${WORKTREE_DIR_NAME}/`,
  '',
  '# Data sync directory (only exists in worktree)',
  `${DATA_SYNC_DIR_NAME}/`,
  '',
  '# Local state',
  'state.yml',
  '',
  '# Temporary files',
  '*.tmp',
  '*.temp',
]);
```

## Stage 4: Validation

- [x] Unit tests for `hasGitignorePattern()` - 9 tests in gitignore-utils.test.ts
- [x] Unit tests for `ensureGitignorePatterns()` - 8 tests in gitignore-utils.test.ts
- [x] E2E integration test - full workflow test included
- [x] Refactored init.ts to use ensureGitignorePatterns
- [x] Refactored setup.ts to use ensureGitignorePatterns
- [x] Added .claude/.gitignore with *.bak pattern
- [x] All 505 tests passing, typecheck clean

## Implementation Complete

All tasks completed 2026-01-25. Files changed:
- `packages/tbd/src/utils/gitignore-utils.ts` - NEW
- `packages/tbd/src/utils/index.ts` - Added export
- `packages/tbd/src/cli/commands/init.ts` - Refactored
- `packages/tbd/src/cli/commands/setup.ts` - Refactored + .claude/.gitignore
- `packages/tbd/tests/gitignore-utils.test.ts` - NEW (18 tests)
