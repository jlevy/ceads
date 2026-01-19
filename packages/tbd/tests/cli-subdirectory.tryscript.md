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
  SHORTID: '[0-9a-z]{4,5}'
before: |
  # Set up a test git repository with tbd initialized
  git init --initial-branch=main
  git config user.email "test@example.com"
  git config user.name "Test User"
  echo "# Test repo" > README.md
  git add README.md
  git commit -m "Initial commit"
  tbd init --prefix=test --quiet
  tbd create "Test issue" --quiet
  # Create subdirectories for testing
  mkdir -p src/components/ui
  mkdir -p docs/api
---
# tbd CLI: Subdirectory Support

Tests for running tbd commands from subdirectories within a tbd repository.
The CLI should find the tbd root by walking up the directory tree, similar to how git
works.

**Bug**: Currently, running `tbd list` from a subdirectory fails with “Not a tbd
repository” even though the parent directory is a valid tbd repo.

* * *

## List Command from Root Works

# Test: List from root directory works

Verify baseline - list works from the repository root.

```console
$ tbd list
...
? 0
```

* * *

## List Command from Subdirectory

# Test: List from first-level subdirectory should work

Running `tbd list` from a subdirectory should find the tbd root.

**Expected behavior**: Should work and show the same issues.
**Current behavior (BUG)**: Fails with “Not a tbd repository”.

```console
$ cd src && tbd list 2>&1
Error: Not a tbd repository (run 'tbd init' or 'tbd import --from-beads' first)
? 1
```

# Test: List from nested subdirectory should work

Running `tbd list` from a deeply nested subdirectory should also find the tbd root.

```console
$ cd src/components/ui && tbd list 2>&1
Error: Not a tbd repository (run 'tbd init' or 'tbd import --from-beads' first)
? 1
```

* * *

## Other Commands from Subdirectory

# Test: Show from subdirectory should work

```console
$ cd docs && tbd show test-0001 2>&1
Error: Not a tbd repository (run 'tbd init' or 'tbd import --from-beads' first)
? 1
```

# Test: Create from subdirectory should work

```console
$ cd docs/api && tbd create "New issue from subdir" 2>&1
Error: Not a tbd repository (run 'tbd init' or 'tbd import --from-beads' first)
? 1
```

# Test: Status from subdirectory shows not initialized

Status command has special handling - it doesn’t throw an error but shows orientation
info. Note: It shows “tbd not initialized” because it doesn’t find .tbd/ in the
subdirectory.

```console
$ cd src && tbd status 2>&1
Not a tbd repository.

Detected:
  ✓ Git repository
  ✓ Git [..]
  ✗ Beads not detected
  ✗ tbd not initialized

To get started:
  tbd init                  # Start fresh
? 0
```
