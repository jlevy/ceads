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
$ node $TRYSCRIPT_TEST_DIR/../dist/bin.mjs info
tbd version 0.1.0

Not initialized. Run tbd init to set up.
? 0
```

---

## List Command

# Test: List without init shows message

Currently shows "No issues found" but should say "Not initialized".
Bug: tbd-1809

```console
$ node $TRYSCRIPT_TEST_DIR/../dist/bin.mjs list
No issues found
? 0
```

---

## Show Command

# Test: Show without init gives error

Show command fails gracefully since no .tbd-sync directory exists.

```console
$ node $TRYSCRIPT_TEST_DIR/../dist/bin.mjs show bd-1234
✗ Issue not found: bd-1234
? 0
```

---

## Create Command Works After Bug Is Fixed

Note: Currently create works without init (bug). After fix, should require init.

# Test: Create without init - currently works

```console
$ node $TRYSCRIPT_TEST_DIR/../dist/bin.mjs create "Test issue"
✓ Created bd-[ULID]: Test issue
? 0
```

---

## Init Command

# Test: Init works and provides success message

```console
$ node $TRYSCRIPT_TEST_DIR/../dist/bin.mjs init
✓ Initialized tbd repository
...
? 0
```

# Test: After init, list shows the issue created earlier

```console
$ node $TRYSCRIPT_TEST_DIR/../dist/bin.mjs list
...
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

# Test: Sync directory exists

```console
$ ls .tbd-sync/
issues
...
? 0
```
