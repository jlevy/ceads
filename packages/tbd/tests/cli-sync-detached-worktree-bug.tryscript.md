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
# Bug Reproduction: Detached HEAD worktree prevents sync

This test simulates a repository where the worktree was created with --detach (old tbd
version), causing commits in the worktree to not update the sync branch ref, which
prevents sync from pushing.

## Setup

# Test: Initialize tbd and create initial issues

```console
$ tbd init --prefix=test 2>&1 | head -1
✓ Initialized tbd repository (prefix: test)
? 0
```

```console
$ tbd create "Initial Issue" --type=task
✓ Created [..]
? 0
```

```console
$ tbd sync
✓ [..]
? 0
```

## Simulate old tbd version with detached HEAD worktree

# Test: Detach the worktree HEAD (simulate old version behavior)

```console
$ git -C .tbd/data-sync-worktree checkout --detach
HEAD is now at [..]
? 0
```

# Test: Verify worktree is detached

```console
$ git -C .tbd/data-sync-worktree branch --show-current | wc -l | tr -d ' '
0
? 0
```

## Create issues in wrong location and test migration

# Test: Create issue in wrong location (simulating the bug scenario)

```console
$ mkdir -p .tbd/data-sync/issues
? 0
```

```console
$ printf '%s\n' '---' 'id: is-00000000000000000000000000' 'title: Wrong Location Issue' 'status: open' 'kind: task' 'priority: 2' 'created_at: 2025-01-01T00:00:00.000Z' 'updated_at: 2025-01-01T00:00:00.000Z' 'version: 1' 'type: is' '---' 'Test body' > .tbd/data-sync/issues/is-00000000000000000000000000.md
? 0
```

# Test: Doctor detects the issue

```console
$ tbd doctor 2>&1 | grep -i "Data location"
[..] Data location - [..] issue(s) in wrong location[..]
? 0
```

# Test: Doctor --fix migrates the data

```console
$ tbd doctor --fix 2>&1 | grep -i "Data location"
[..] Data location - migrated [..] file(s)[..]
? 0
```

# Test: Migration created a commit in the worktree

```console
$ git -C .tbd/data-sync-worktree log --oneline -1
[..] tbd: migrate [..] file(s) from incorrect location
? 0
```

# Test: FIX VERIFICATION - Local sync branch WAS updated (bug is fixed!)

After the fix, the migration should detect detached HEAD and re-attach before
committing.

```console
$ git log tbd-sync --oneline -1
[..] tbd: migrate [..] file(s) from incorrect location
? 0
```

# Test: FIX VERIFICATION - Ahead count shows 1 (correct!)

The local branch now points to the migration commit, so we’re 1 commit ahead.

```console
$ git rev-list --count origin/tbd-sync..tbd-sync | tr -d ' '
1
? 0
```

# Test: FIX VERIFICATION - Worktree and branch are in sync (correct!)

```console
$ test "$(git -C .tbd/data-sync-worktree rev-parse HEAD)" = "$(git rev-parse tbd-sync)" && echo "In sync" || echo "Worktree ahead of branch"
In sync
? 0
```

# Test: FIX VERIFICATION - Sync should push the commit

```console
$ tbd sync 2>&1
✓ [..]
? 0
```

# Test: FIX VERIFICATION - After sync, ahead count is 0

```console
$ git rev-list --count origin/tbd-sync..tbd-sync | tr -d ' '
0
? 0
```

# Test: FIX VERIFICATION - Remote has the migration commit

```console
$ git log origin/tbd-sync --oneline -1
[..] tbd: migrate [..] file(s) from incorrect location
? 0
```
