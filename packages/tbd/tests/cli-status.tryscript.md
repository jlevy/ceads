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
# tbd CLI: Status Command

Tests for the `tbd status` command - the orientation command that works regardless of
initialization state (like `git status`).

* * *

## Pre-Initialization

# Test: Status shows helpful info when not initialized

The status command works without initialization and shows orientation info.

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

# Test: Status JSON when not initialized

```console
$ tbd status --json
{
  "initialized": false,
  "tbd_version": [..],
  "working_directory": [..],
  "git_repository": true,
  "git_branch": "main",
  "git_version": [..],
  "git_version_supported": true,
  "beads_detected": false,
  "beads_issue_count": null,
...
}
? 0
```

* * *

## With Beads Present

# Test: Status detects beads repository

Create a mock beads directory and verify it’s detected.

```console
$ mkdir -p .beads && echo '{"id":"beads-123","title":"Test issue"}' > .beads/issues.jsonl
? 0
```

```console
$ tbd status
Not a tbd repository.

Detected:
  ✓ Git repository (main branch)
  ✓ Git [..]
  ✓ Beads repository (.beads/ with 1 issues)
  ✗ tbd not initialized

To get started:
  tbd setup --auto          # Migrate from Beads (recommended)
  tbd init --prefix=X       # Surgical init only
? 0
```

* * *

## Post-Initialization

# Test: Initialize tbd

```console
$ tbd init --prefix=bd --quiet
? 0
```

# Test: Status shows initialized

```console
$ tbd status | grep "✓ Initialized"
  ✓ Initialized (.tbd/)
? 0
```

# Test: Status shows git repository

```console
$ tbd status | grep "✓ Git repository"
  ✓ Git repository (main)
? 0
```

# Test: Status shows prefix

```console
$ tbd status | grep "ID prefix"
ID prefix: bd-
? 0
```

# Test: Status no longer shows issue counts (moved to stats)

```console
$ tbd status | grep "Total:"
? 1
```

# Test: Status shows worktree health

```console
$ tbd status | grep -c "(healthy)"
1
? 0
```

# Test: Status JSON after initialization

```console
$ tbd status --json
{
  "initialized": true,
  "tbd_version": [..],
  "working_directory": [..],
  "git_repository": true,
  "git_branch": "main",
  "git_version": [..],
  "git_version_supported": true,
  "beads_detected": true,
  "beads_issue_count": 1,
  "sync_branch": "tbd-sync",
  "remote": "origin",
  "display_prefix": "bd",
...
}
? 0
```

* * *

## With Issues

# Test: Create some issues to verify issue counts

```console
$ tbd create "First issue" --type=task
✓ Created bd-[SHORTID]: First issue
? 0
```

```console
$ tbd create "Second issue" --type=bug
✓ Created bd-[SHORTID]: Second issue
? 0
```

# Test: Status no longer shows issue counts (moved to stats)

Status no longer includes issue counts - these are now in `tbd stats`.

```console
$ tbd status | grep -A4 "Issues:"
? 1
```

* * *

## Status vs Stats

# Test: Status shows footer pointing to stats and doctor

The status command provides orientation and points to stats for issue counts.

```console
$ tbd stats
Summary:
  Ready:       2
  In progress: 0
  Blocked:     0
  Open:        2
  Total:       2

By status:
  open           2

By kind:
  bug            1
  task           1

By priority:
  P2 (Medium  ) 2

Use 'tbd status' for setup info, 'tbd doctor' for health checks.
? 0
```
