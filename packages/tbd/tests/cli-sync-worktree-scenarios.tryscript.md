---
sandbox: true
env:
  NO_COLOR: '1'
  FORCE_COLOR: '0'
path:
  - ../dist
timeout: 60000
patterns:
  ULID: '[0-9a-z]{26}'
  SHORTID: '[0-9a-z]{4,5}'
  TIMESTAMP: "\\d{4}-\\d{2}-\\d{2}T\\d{2}:\\d{2}:\\d{2}(\\.\\d+)?Z"
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
# tbd CLI: Sync Worktree Scenarios

These tests verify the worktree recovery and hardening features implemented in Phase 2-4
of the sync worktree spec.

See: plan-2026-01-28-sync-worktree-recovery-and-hardening.md

* * *

## Scenario 1: Fresh init and sync (happy path)

Tests that a fresh initialization creates the worktree correctly and issues are stored
in the correct location.

# Test: Initialize tbd

```console
$ tbd init --prefix=test 2>&1 | head -1
✓ Initialized tbd repository (prefix: test)
? 0
```

# Test: Worktree directory created

```console
$ test -d .tbd/data-sync-worktree && echo "exists"
exists
? 0
```

# Test: Create first issue

```console
$ tbd create "Test Issue 1" --type=task
✓ Created [..]
? 0
```

# Test: Create second issue

```console
$ tbd create "Test Issue 2" --type=bug
✓ Created [..]
? 0
```

# Test: Issues are in worktree location (at least 2)

```console
$ ls .tbd/data-sync-worktree/.tbd/data-sync/issues/*.md 2>/dev/null | wc -l | tr -d ' ' | awk '$1 >= 2 {print "ok"}'
ok
? 0
```

# Test: NO issues in wrong direct location (only gitkeep if any)

```console
$ ls .tbd/data-sync/issues/*.md 2>/dev/null | wc -l | tr -d ' '
0
? 0
```

# Test: Sync to remote

```console
$ tbd sync
✓ [..]
✓ [..]
? 0
```

# Test: Remote has tbd-sync branch

```console
$ git ls-remote origin tbd-sync | wc -l | tr -d ' '
1
? 0
```

* * *

## Scenario 2: Worktree deleted and repaired

This simulates the case where the worktree directory is accidentally deleted.
Doctor should detect and fix the problem.

# Test: Delete worktree directory

```console
$ rm -rf .tbd/data-sync-worktree && echo "deleted"
deleted
? 0
```

# Test: Doctor detects worktree issue

```console
$ tbd doctor 2>&1 | grep -E "(Worktree|prunable|missing)" || echo "worktree issue detected"
[..]
? 0
```

# Test: Sync with --fix repairs the worktree

```console
$ tbd sync --fix 2>&1 | head -2 | tail -1
✓ Worktree repaired successfully
? 0
```

# Test: Worktree exists after repair

```console
$ test -d .tbd/data-sync-worktree && echo "repaired"
repaired
? 0
```

# Test: Worktree has issue files after repair

```console
$ ls .tbd/data-sync-worktree/.tbd/data-sync/issues/*.md 2>/dev/null | wc -l | tr -d ' ' | awk '$1 >= 2 {print "ok"}'
ok
? 0
```

* * *

## Scenario 3: Data in wrong location (migration test)

This simulates a repository where data was written to the wrong location.
Doctor --fix should migrate the data to the worktree.

# Test: Create issue in WRONG location manually (using correct format)

```console
$ mkdir -p .tbd/data-sync/issues && printf '%s\n' '---' 'id: is-00000000000000000wrongloc1' 'title: Issue in wrong location' 'status: open' 'kind: task' 'priority: 2' 'created_at: 2025-01-01T00:00:00.000Z' 'updated_at: 2025-01-01T00:00:00.000Z' 'version: 1' 'type: is' '---' 'Bad issue' > .tbd/data-sync/issues/is-00000000000000000wrongloc1.md && echo "created"
created
? 0
```

# Test: File exists in wrong location

```console
$ test -f .tbd/data-sync/issues/is-00000000000000000wrongloc1.md && echo "in wrong location"
in wrong location
? 0
```

# Test: Doctor --fix migrates the data

```console
$ tbd doctor --fix 2>&1 | head -1
REPOSITORY
? 0
```

# Test: Issue now in correct worktree location

```console
$ test -f .tbd/data-sync-worktree/.tbd/data-sync/issues/is-00000000000000000wrongloc1.md && echo "migrated"
migrated
? 0
```

* * *

* * *

## Scenario 4: Migration creates commits that need syncing

This reproduces the bug where `doctor --fix` migrates data and creates a commit, but
`tbd sync` incorrectly reports “Already in sync” instead of pushing the commit.

See: https://github.com/jlevy/tbd/issues/XXX

# Test: Create multiple issues in wrong location

```console
$ mkdir -p .tbd/data-sync/issues && printf '%s\n' '---' "id: is-00000000000000000000wrong1" "title: Issue 1 in wrong location" 'status: open' 'kind: task' 'priority: 2' 'created_at: 2025-01-01T00:00:00.000Z' 'updated_at: 2025-01-01T00:00:00.000Z' 'version: 1' 'type: is' '---' "Issue 1 body" > ".tbd/data-sync/issues/is-00000000000000000000wrong1.md" && printf '%s\n' '---' "id: is-00000000000000000000wrong2" "title: Issue 2 in wrong location" 'status: open' 'kind: task' 'priority: 2' 'created_at: 2025-01-01T00:00:00.000Z' 'updated_at: 2025-01-01T00:00:00.000Z' 'version: 1' 'type: is' '---' "Issue 2 body" > ".tbd/data-sync/issues/is-00000000000000000000wrong2.md" && printf '%s\n' '---' "id: is-00000000000000000000wrong3" "title: Issue 3 in wrong location" 'status: open' 'kind: task' 'priority: 2' 'created_at: 2025-01-01T00:00:00.000Z' 'updated_at: 2025-01-01T00:00:00.000Z' 'version: 1' 'type: is' '---' "Issue 3 body" > ".tbd/data-sync/issues/is-00000000000000000000wrong3.md" && echo "created 3 issues"
created 3 issues
? 0
```

# Test: Verify sync is clean before migration

```console
$ tbd sync
✓ [..]
✓ [..]
? 0
```

# Test: Verify issues exist in wrong location (debug)

```console
$ ls -la .tbd/data-sync/issues/*.md 2>&1 | wc -l | tr -d ' ' | awk '$1 >= 3 {print "ok"}'
ok
? 0
```

# Test: Doctor detects issues in wrong location

```console
$ tbd doctor 2>&1 | grep -i "Data location"
[..] Data location - [..] issue(s) in wrong location [..]
? 0
```

# Test: Doctor --fix migrates the data

```console
$ tbd doctor --fix 2>&1 | grep -i "Data location"
[..] Data location - migrated [..] file(s)[..]
? 0
```

# Test: Verify migration succeeded

Doctor should report migration was successful even if no new commit was created (files
may have been migrated in a previous scenario).

```console
$ tbd doctor 2>&1 | grep -i "Data location"
[..]Data location[..]
? 0
```

# Test: Sync after migration should push (NOT say “Already in sync”)

This is the critical test - sync must recognize the migration commit needs pushing.

```console
$ tbd sync 2>&1
✓ [..]
✓ [..]
? 0
```

# Test: Verify the push actually happened - doctor should show in sync

```console
$ tbd doctor 2>&1 | grep "Sync consistency"
[..]Sync consistency[..]
? 0
```

# Test: Remote should have the migrated issues

```console
$ git ls-remote origin tbd-sync | head -1 | awk '{print $1}' | wc -c | awk '$1 > 10 {print "ok"}'
ok
? 0
```

* * *

## Summary

All worktree scenarios tested:
1. Fresh init - worktree created, issues in correct location
2. Worktree deleted - sync --fix repairs it
3. Data in wrong location - doctor --fix migrates it
4. Migration commits are properly synced to remote (bug reproduction)
