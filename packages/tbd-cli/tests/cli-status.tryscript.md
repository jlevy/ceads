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
  ✗ Beads not detected
  ✗ tbd not initialized

To get started:
  tbd init                  # Start fresh
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
  ✓ Beads repository (.beads/ with 1 issues)
  ✗ tbd not initialized

To get started:
  tbd import --from-beads   # Migrate from Beads (recommended)
  tbd init                  # Start fresh
? 0
```

* * *

## Post-Initialization

# Test: Initialize tbd

```console
$ tbd init
✓ Initialized tbd repository

To complete setup, commit the config files:
  git add .tbd/
  git commit -m "Initialize tbd"
? 0
```

# Test: Status after initialization

```console
$ tbd status
tbd v[..]

Repository: [..]
  ✓ Initialized (.tbd/)
  ✓ Git repository (main)

Sync branch: tbd-sync
Remote: origin
ID prefix: bd-

Issues:
  Ready:       0
  In progress: 0
  Open:        0
  Total:       0

Integrations:
  ✗ Claude Code hooks (run: tbd setup claude)
  ✗ Cursor rules (run: tbd setup cursor)
  ✗ Codex AGENTS.md (run: tbd setup codex)

Worktree: [..] (healthy)

Use 'tbd stats' for detailed issue statistics.
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

# Test: Status shows issue counts

```console
$ tbd status | grep -A4 "Issues:"
Issues:
  Ready:       2
  In progress: 0
  Open:        2
  Total:       2
? 0
```

* * *

## Status vs Stats

# Test: Status is not the same as stats

The status command provides orientation, stats provides detailed statistics.

```console
$ tbd stats
Total issues: 2

By status:
  open           2

By kind:
  bug            1
  task           1

By priority:
  2 (Medium  ) 2
? 0
```
