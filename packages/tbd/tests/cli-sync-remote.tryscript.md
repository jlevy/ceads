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
  # Create a bare git repository to serve as local "origin" remote
  mkdir -p ../origin.git
  git init --bare ../origin.git

  # Set up a test git repository
  git init --initial-branch=main
  git config user.email "test@example.com"
  git config user.name "Test User"
  git config commit.gpgsign false
  echo "# Test repo" > README.md
  git add README.md
  git commit -m "Initial commit"

  # Add the local bare repo as origin
  git remote add origin ../origin.git
  git push -u origin main

  # Initialize tbd and do initial sync to establish remote branch
  tbd init --prefix=test
  tbd sync
---
# tbd CLI: Sync with Remote

These tests verify sync behavior when a remote repository is available.
This uses a local bare git repository as a mock “origin” remote.

* * *

## Remote Branch Setup

# Test: Remote has tbd-sync branch after initial setup

```console
$ git ls-remote origin tbd-sync | wc -l | tr -d ' '
1
? 0
```

# Test: Immediate sync shows already in sync

```console
$ tbd sync
✓ [..]
✓ [..]
? 0
```

* * *

## Sync After Changes

# Test: Create issue and sync

```console
$ tbd create "Test issue A" --type=task
✓ Created [..]
? 0
```

```console
$ tbd sync
✓ [..]
✓ [..]
? 0
```

# Test: No uncommitted changes after sync

```console
$ git -C .tbd/data-sync-worktree status --porcelain
? 0
```

# Test: Multiple issues then single sync

```console
$ tbd create "Test issue B" --type=bug
✓ Created [..]
? 0
```

```console
$ tbd create "Test issue C" --type=feature
✓ Created [..]
? 0
```

```console
$ tbd sync
✓ [..]
✓ [..]
? 0
```

```console
$ git -C .tbd/data-sync-worktree status --porcelain
? 0
```

* * *

## Push and Pull Commands

# Test: Sync --push when nothing to push

```console
$ tbd sync --push
✓ [..]
? 0
```

# Test: Sync --pull when nothing to pull

```console
$ tbd sync --pull
✓ [..]
? 0
```

* * *

## Sync Status with Remote

# Test: Status shows synced state

```console
$ tbd sync --status
✓ Docs up to date
✓ Repository is in sync
? 0
```

# Test: Status JSON shows synced state

```console
$ tbd sync --status --json | node -e "d=JSON.parse(require('fs').readFileSync(0,'utf8')); console.log('synced:', d.synced)"
synced: true
? 0
```
