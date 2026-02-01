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
  TIMESTAMP: "\\d{4}-\\d{2}-\\d{2}T\\d{2}:\\d{2}:\\d{2}(\\.\\d+)?Z"
before: |
  # Set up a test git repository
  git init --initial-branch=main
  git config user.email "test@example.com"
  git config user.name "Test User"
  git config commit.gpgsign false
  echo "# Test repo" > README.md
  git add README.md
  git commit -m "Initial commit"
  # Initialize tbd
  tbd init --prefix=test
---
# tbd CLI: Workspace Save Command

Tests for the `tbd save` command which saves issues to workspaces for sync failure
recovery, backups, and bulk editing.

**Critical behaviors tested:**
1. Save all issues to a named workspace
2. Save only updated issues with --outbox or --updates-only
3. Mappings are filtered to only include saved issues
4. Informational messages when no updates exist
5. Filtered count messages when updates exist

* * *

## Basic Save Operations

# Test: Save command requires a target

```console
$ tbd save 2>&1
Error: One of --workspace, --dir, or --outbox is required
? 2
```

# Test: Create some test issues

```console
$ tbd create "Issue 1" --type=task
✓ Created test-[SHORTID]: Issue 1
? 0
```

```console
$ tbd create "Issue 2" --type=bug
✓ Created test-[SHORTID]: Issue 2
? 0
```

```console
$ tbd create "Issue 3" --type=feature
✓ Created test-[SHORTID]: Issue 3
? 0
```

# Test: Save all issues to a named workspace

```console
$ tbd save --workspace=my-backup
✓ Saved 3 issue(s) to my-backup

Remember to commit: git add .tbd/workspaces && git commit -m "tbd: save workspace"
? 0
```

# Test: Workspace directory structure is created

```console
$ ls .tbd/workspaces/my-backup/
attic
issues
mappings
? 0
```

# Test: Workspace contains all 3 issues

```console
$ ls .tbd/workspaces/my-backup/issues/ | wc -l | tr -d ' '
3
? 0
```

# Test: Workspace mappings contain exactly 3 entries

```console
$ grep -c '^[a-z0-9]' .tbd/workspaces/my-backup/mappings/ids.yml
3
? 0
```

* * *

## Outbox and Updates-Only Behavior

The --outbox flag is a shortcut for --workspace=outbox --updates-only.
When there’s no remote, all issues are considered “updated” (fallback behavior).

# Test: Save with --outbox (all issues are updates since no remote)

```console
$ tbd save --outbox
✓ Saved 3 issue(s) to outbox (3 of 3 filtered)

Remember to commit: git add .tbd/workspaces && git commit -m "tbd: save workspace"
? 0
```

# Test: Outbox contains same 3 issues

```console
$ ls .tbd/workspaces/outbox/issues/ | wc -l | tr -d ' '
3
? 0
```

# Test: Outbox mappings contain exactly 3 entries (not all mappings)

```console
$ grep -c '^[a-z0-9]' .tbd/workspaces/outbox/mappings/ids.yml
3
? 0
```

* * *

## Workspace Management

# Test: List workspaces shows both created workspaces with issue counts

```console
$ tbd workspace list
WORKSPACE    open  in_progress  closed   total
my-backup       3            0       0       3
outbox          3            0       0       3
? 0
```

# Test: Delete a workspace

```console
$ tbd workspace delete my-backup
✓ Deleted workspace "my-backup"
? 0
```

# Test: Workspace no longer appears in list

```console
$ tbd workspace list
WORKSPACE    open  in_progress  closed   total
outbox          3            0       0       3
? 0
```

* * *

## Import from Workspace

# Test: Import from outbox to worktree

First, let’s clear the worktree data to simulate a fresh checkout:

```console
$ rm -rf .tbd/data-sync-worktree/.tbd/data-sync/issues/*.md
? 0
```

```console
$ tbd import --outbox
✓ Imported 3 issue(s) from outbox
? 0
```

# Test: Outbox is cleared after import (--outbox implies --clear-on-success)

```console
$ tbd workspace list 2>&1 || echo "No workspaces"
No workspaces
? 0
```

# Test: Issues are back in worktree

```console
$ tbd list --json | grep -c '"id":'
3
? 0
```

* * *

## Arbitrary Directory Support

# Test: Save to arbitrary directory

```console
$ mkdir -p /tmp/tbd-test-backup
? 0
```

```console
$ tbd save --dir=/tmp/tbd-test-backup
✓ Saved 3 issue(s) to /tmp/tbd-test-backup
? 0
```

# Test: Import from arbitrary directory

```console
$ rm -rf .tbd/data-sync-worktree/.tbd/data-sync/issues/*.md
? 0
```

```console
$ tbd import --dir=/tmp/tbd-test-backup
✓ Imported 3 issue(s) from /tmp/tbd-test-backup
? 0
```

# Test: Cleanup temp directory

```console
$ rm -rf /tmp/tbd-test-backup
? 0
```

* * *

## Workspace List with Issue Counts by Status

This section tests that workspace list shows issue counts broken down by status.

# Test: Create additional issues for status testing

```console
$ tbd create "Another open issue" --type=task
✓ Created test-[SHORTID]: Another open issue
? 0
```

# Test: Save to workspace

```console
$ tbd save --workspace=status-test
✓ Saved 4 issue(s) to status-test

Remember to commit: git add .tbd/workspaces && git commit -m "tbd: save workspace"
? 0
```

# Test: Workspace list shows correct counts by status

All 4 issues are open (no in_progress or closed).

```console
$ tbd workspace list
WORKSPACE      open  in_progress  closed   total
status-test       4            0       0       4
? 0
```

# Test: No workspaces shows helpful message

```console
$ tbd workspace delete status-test
✓ Deleted workspace "status-test"
? 0
```

```console
$ tbd workspace list
No workspaces
? 0
```
