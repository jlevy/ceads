# Bug Fix Validation: Subdirectory Support

## Purpose

Validation for the bug fix that enables running tbd commands from subdirectories within
a tbd repository.

**Bug Report:** Running `tbd list` from a subdirectory fails with “Not a tbd repository”
even though the parent directory is a valid tbd repo.

**Priority:** P1 (significantly hurts usability)

**Related Beads:**

- tbd-nsx0: Add findTbdRoot function (Closed)
- tbd-drxs: Update CLI commands (Closed)
- tbd-wadz: Status command enhancement (Closed)

## Root Cause

The `isInitialized` function in `packages/tbd/src/file/config.ts` only checked the
immediate directory for `.tbd/` - it didn’t walk up the directory tree like git does
with `.git/`.

## Solution

Added `findTbdRoot()` function that walks up the directory tree looking for `.tbd/`,
similar to how git finds `.git/` directories.
Updated all CLI commands to use this function.

## Automated Validation (Testing Performed)

### Unit Testing

- **`tests/subdirectory.test.ts`** - 12 tests covering:
  - `isInitialized()` returns true for root, subdirectory, and nested subdirectory
  - `isInitialized()` returns false for parent of tbd root
  - `findTbdRoot()` returns correct path from root, subdirectory, nested subdirectory
  - `findTbdRoot()` returns null when not in tbd repo
  - `findTbdRoot()` returns null at filesystem root

### Golden Tests (End-to-End)

- **`tests/cli-subdirectory.tryscript.md`** - 6 tests covering:
  - `tbd list` works from root directory
  - `tbd list` works from first-level subdirectory
  - `tbd list` works from deeply nested subdirectory
  - `tbd create` works from subdirectory
  - Issues created from subdirectory appear in list
  - `tbd status` shows initialized from subdirectory

### Test Results

- All 418 unit tests pass
- All 6 golden tests in cli-subdirectory.tryscript.md pass
- Pre-commit hooks (format, lint, typecheck) all pass

## Manual Validation Needed

The user should perform the following manual validation:

### 1. Basic Subdirectory Test

```bash
# Navigate to any tbd-initialized repo
cd /path/to/your/tbd-repo

# Create a subdirectory if needed
mkdir -p src/deep/nested/dir

# Run tbd commands from subdirectory
cd src/deep/nested/dir
tbd list        # Should show issues
tbd status      # Should show "✓ Initialized (.tbd/)"
tbd create "Test from subdir"  # Should work
cd /path/to/your/tbd-repo
tbd list        # Should show the new issue
```

### 2. Verify Status Output

From a subdirectory, run `tbd status` and verify:

- Shows “Repository: /path/to/subdirectory” (current directory)
- Shows “✓ Initialized (.tbd/)”
- Shows “✓ Git repository”

### 3. Edge Cases

```bash
# From parent of tbd root (should fail correctly)
cd /tmp
tbd list  # Should show "Not a tbd repository"

# From root of filesystem (should fail correctly)
cd /
tbd list  # Should show "Not a tbd repository"
```

## Files Changed

- `src/file/config.ts` - Added `findTbdRoot()`, updated `isInitialized()`
- `src/cli/lib/errors.ts` - Updated `requireInit()` to return tbd root
- `src/cli/lib/dataContext.ts` - Updated to pass tbdRoot to functions
- `src/cli/commands/*.ts` - 15 command files updated to use tbdRoot
- `tests/subdirectory.test.ts` - New unit tests
- `tests/cli-subdirectory.tryscript.md` - New golden tests
