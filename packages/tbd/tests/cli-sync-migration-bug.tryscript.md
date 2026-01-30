---
sandbox: true
env:
  NO_COLOR: '1'
  FORCE_COLOR: '0'
path:
  - ../dist
timeout: 60000
before: |
  # Create a bare git repository to serve as local "origin" remote
  mkdir -p ../origin.git
  git init --bare ../origin.git

  # Set up a test git repository (primary repo)
  git init --initial-branch=main
  git config user.email "test@example.com"
  git config user.name "Test User"
  git config commit.gpgsign false
  echo "# Test repo" > README.md
  git add README.md
  git commit -m "Initial commit"

  # Add the local bare repo as origin and push
  git remote add origin ../origin.git
  git push -u origin main
---
# Bug Reproduction: Sync after doctor migration

This test reproduces the bug where `tbd doctor --fix` migrates data and creates a
commit, but `tbd sync` incorrectly reports “Already in sync” instead of pushing the
commit.

## Setup

# Test: Initialize tbd

```console
$ tbd init --prefix=test 2>&1 | head -1
✓ Initialized tbd repository (prefix: test)
? 0
```

# Test: Create and sync some initial issues

```console
$ tbd create "Initial Issue 1" --type=task
✓ Created [..]
? 0
```

```console
$ tbd create "Initial Issue 2" --type=bug
✓ Created [..]
? 0
```

```console
$ tbd sync
✓ [..]
✓ [..]
? 0
```

## Reproduce the bug

# Test: Manually place issues in WRONG location (simulate the bug scenario)

```console
$ mkdir -p .tbd/data-sync/issues
? 0
```

```console
$ printf '%s\n' '---' 'id: is-00000000000000000wrongloc1' 'title: Migrated Issue 1' 'status: open' 'kind: task' 'priority: 2' 'created_at: 2025-01-01T00:00:00.000Z' 'updated_at: 2025-01-01T00:00:00.000Z' 'version: 1' 'type: is' '---' 'Body 1' > .tbd/data-sync/issues/is-00000000000000000wrongloc1.md
? 0
```

```console
$ printf '%s\n' '---' 'id: is-00000000000000000wrongloc2' 'title: Migrated Issue 2' 'status: open' 'kind: bug' 'priority: 2' 'created_at: 2025-01-01T00:00:00.000Z' 'updated_at: 2025-01-01T00:00:00.000Z' 'version: 1' 'type: is' '---' 'Body 2' > .tbd/data-sync/issues/is-00000000000000000wrongloc2.md && echo "created 2 issues in wrong location"
created 2 issues in wrong location
? 0
```

# Test: Verify files exist in wrong location

```console
$ ls .tbd/data-sync/issues/is-*.md | wc -l | tr -d ' '
2
? 0
```

# Test: Doctor detects the misplaced issues

```console
$ tbd doctor 2>&1 | grep -E "Data location.*issue.*wrong" || echo "SKIP: doctor might not detect yet"
[..]
```

# Test: Run doctor --fix to migrate the data

```console
$ tbd doctor --fix >/dev/null 2>&1
? 0
```

# Test: Verify migration created files in correct worktree location

```console
$ ls .tbd/data-sync-worktree/.tbd/data-sync/issues/is-00000000000000000wrongloc*.md 2>/dev/null | wc -l | tr -d ' '
2
? 0
```

# Test: Check worktree git status - should have committed migration

```console
$ git -C .tbd/data-sync-worktree log --oneline -1
[..] tbd: migrate [..] file(s) from incorrect location
? 0
```

# Test: Check local sync branch - should point to migration commit

```console
$ git log tbd-sync --oneline -1
[..] tbd: migrate [..] file(s) from incorrect location
? 0
```

# Test: Check ahead count - should be 1 commit ahead of remote

```console
$ git rev-list --count origin/tbd-sync..tbd-sync | tr -d ' '
1
? 0
```

# Test: Run tbd sync - THIS IS THE BUG - should push, not say “Already in sync”

```console
$ tbd sync 2>&1
✓ Docs up to date
✓ [..]
? 0
```

# Test: Verify sync actually pushed - ahead count should now be 0

```console
$ git rev-list --count origin/tbd-sync..tbd-sync | tr -d ' '
0
? 0
```

# Test: Doctor should now show everything in sync

```console
$ tbd doctor 2>&1 | grep "Sync consistency"
[..]Sync consistency[..]
? 0
```

# Test: Verify remote has the migration commit

```console
$ git log origin/tbd-sync --oneline -1
[..] tbd: migrate [..] file(s) from incorrect location
? 0
```
