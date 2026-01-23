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
  # Set up a test git repository but do NOT initialize tbd
  git init --initial-branch=main
  git config user.email "test@example.com"
  git config user.name "Test User"
  git config commit.gpgsign false
  echo "# Test repo" > README.md
  git add README.md
  git commit -m "Initial commit"
---
# tbd CLI: Uninitialized Repository

Tests for commands when tbd has not been initialized.
These tests verify that helpful error messages are shown instead of confusing errors.

* * *

## Status Command Shows Helpful Message

# Test: Status without init shows orientation

Status command should work without init and show orientation info.

```console
$ tbd status
Not a tbd repository.

Detected:
  ✓ Git repository (main branch)
  ✓ Git [..]
  ✗ Beads not detected
  ✗ tbd not initialized

To get started:
  tbd setup --auto          # Full setup with auto-detection
  tbd init --prefix=X       # Surgical init only
? 0
```

* * *

## List Command

# Test: List without init returns error

List command should fail with helpful error message when tbd is not initialized.

```console
$ tbd list 2>&1
Error: Not a tbd repository (run 'tbd setup --auto' first)
? 1
```

* * *

## Show Command

# Test: Show without init gives error

Show command fails with not initialized error when tbd is not set up.

```console
$ tbd show bd-1234 2>&1
Error: Not a tbd repository (run 'tbd setup --auto' first)
? 1
```

* * *

## Init Command

# Test: Init works and provides success message

```console
$ tbd init --prefix=test --quiet
? 0
```

* * *

## Verify Init Created Proper Structure

# Test: Config file exists

```console
$ ls .tbd/config.yml
.tbd/config.yml
? 0
```

# Test: Sync worktree exists

```console
$ ls .tbd/data-sync-worktree/.tbd/data-sync/
attic
issues
mappings
meta.yml
? 0
```

* * *

## Commands Work After Init

# Test: Create works after init

```console
$ tbd create "Test issue"
✓ Created test-[SHORTID]: Test issue
? 0
```

# Test: List shows the issue

```console
$ tbd list
...
? 0
```
