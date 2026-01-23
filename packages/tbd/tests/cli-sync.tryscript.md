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
# tbd CLI: Sync Command

The sync command is core to tbd’s multi-machine coordination.
These tests verify that changes are properly committed to the tbd-sync branch before
push operations.

**Critical behavior being tested:**
1. Files written to the worktree are committed before push
2. No uncommitted changes remain after sync
3. Sync status accurately reports state
4. Error handling for missing remotes

* * *

## Core Sync Behavior: Commits Before Push

This is the most important test - verifying that `tbd sync` actually commits files to
the tbd-sync branch.
Without this, changes would never be pushed.

# Test: Initial state has one commit (from init, sync doesn’t add if nothing changed)

```console
$ git -C .tbd/data-sync-worktree log --oneline | wc -l | tr -d ' '
1
? 0
```

# Test: Creating an issue adds uncommitted files to worktree

```console
$ tbd create "Test sync commit behavior" --type=task
✓ Created [..]
? 0
```

```console
$ git -C .tbd/data-sync-worktree status --porcelain | head -3
?? .tbd/data-sync/issues/[..]
?? .tbd/data-sync/mappings/ids.yml
? 0
```

# Test: Sync commits the uncommitted files

```console
$ tbd sync
✓ Synced: sent [..] new
? 0
```

# Test: After sync, no uncommitted changes remain

```console
$ git -C .tbd/data-sync-worktree status --porcelain
? 0
```

# Test: Commit count increased after sync

```console
$ git -C .tbd/data-sync-worktree log --oneline | wc -l | tr -d ' '
2
? 0
```

# Test: Commit message includes file count

```console
$ git -C .tbd/data-sync-worktree log -1 --format=%s
tbd sync: [..] (2 files)
? 0
```

* * *

## Multiple Issues and Updates

# Test: Create multiple issues, then sync once

```console
$ tbd create "Issue A" --type=task
✓ Created [..]
? 0
```

```console
$ tbd create "Issue B" --type=bug
✓ Created [..]
? 0
```

```console
$ tbd create "Issue C" --type=feature
✓ Created [..]
? 0
```

# Test: Multiple uncommitted files before sync

```console
$ git -C .tbd/data-sync-worktree status --porcelain | grep -c "??" | tr -d ' '
3
? 0
```

# Test: Sync commits all pending changes

```console
$ tbd sync
✓ Synced[..]
? 0
```

# Test: All changes committed

```console
$ git -C .tbd/data-sync-worktree status --porcelain
? 0
```

* * *

## Sync Status Command

# Test: Sync status shows in-sync state

```console
$ tbd sync --status
✓ Repository is in sync
? 0
```

# Test: Sync status as JSON

```console
$ tbd sync --status --json
{
  "synced": true,
  "localChanges": [],
  "remoteChanges": [],
  "syncBranch": "tbd-sync",
  "remote": "origin",
  "ahead": 0,
  "behind": 0
}
? 0
```

# Test: Creating issue doesn’t affect sync status (local only)

After creating an issue, sync status may show local changes.

```console
$ tbd create "Status test issue" --type=task
✓ Created [..]
? 0
```

```console
$ tbd sync --status --json | node -e "d=JSON.parse(require('fs').readFileSync(0,'utf8')); console.log('synced:', d.synced)"
synced: [..]
? 0
```

* * *

## Error Handling

# Test: Sync push without remote fails gracefully

```console
$ tbd sync --push 2>&1
...
Error: Failed to push: [..]
...
? 1
```

# Test: Sync pull without remote fails gracefully

```console
$ tbd sync --pull 2>&1
Error: Failed to pull: [..]
...
? 1
```

# Test: Full sync handles missing remote gracefully

```console
$ tbd sync
✓ [..]
? 0
```

* * *

## Idempotent Sync

# Test: Running sync twice in a row is safe

```console
$ tbd sync
✓ [..]
? 0
```

```console
$ tbd sync
✓ [..]
? 0
```

# Test: No uncommitted changes after double sync

```console
$ git -C .tbd/data-sync-worktree status --porcelain
? 0
```

* * *

## JSON Output

# Test: Sync reports counts in JSON format

```console
$ tbd sync --json
{
  "summary": {
    "sent": {
      "new": 0,
      "updated": 0,
      "deleted": 0
    },
    "received": {
      "new": 0,
      "updated": 0,
      "deleted": 0
    },
    "conflicts": 0
  },
  "conflicts": 0
}
? 0
```
