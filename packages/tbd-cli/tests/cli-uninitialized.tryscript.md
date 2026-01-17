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
  echo "# Test repo" > README.md
  git add README.md
  git commit -m "Initial commit"
---

# TBD CLI: Uninitialized Repository

Tests for commands when tbd has not been initialized.
These tests verify that helpful error messages are shown instead of confusing errors.

---

## Info Command Shows Helpful Message

# Test: Info without init shows status

Info command should work and tell user to run init.

```console
$ tbd info
tbd version [..]

Not initialized. Run tbd init to set up.
? 0
```

---

## List Command

# Test: List without init returns error

List command should fail with helpful error message when tbd is not initialized.

```console
$ tbd list 2>&1
Error: Not a tbd repository. Run "tbd init" first.
? 1
```

---

## Show Command

# Test: Show without init gives error

Show command fails gracefully since no .tbd directory exists.

```console
$ tbd show bd-1234 2>&1
✗ Issue not found: bd-1234
? 0
```

---

## Init Command

# Test: Init works and provides success message

```console
$ tbd init
✓ Initialized tbd repository

To complete setup, commit the config files:
  git add .tbd/
  git commit -m "Initialize tbd"
? 0
```

---

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

---

## Commands Work After Init

# Test: Create works after init

```console
$ tbd create "Test issue"
✓ Created bd-[SHORTID]: Test issue
? 0
```

# Test: List shows the issue

```console
$ tbd list
...
? 0
```
