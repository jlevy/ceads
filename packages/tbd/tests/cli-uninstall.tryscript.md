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
---
# tbd CLI: Uninstall Command

Tests for `tbd uninstall` which removes tbd from a repository.

* * *

## Uninstall Help

# Test: Uninstall --help shows options

```console
$ tbd uninstall --help
Usage: tbd uninstall [options]

Remove tbd from this repository

Options:
  --confirm          Confirm removal (required to proceed)
  --keep-branch      Keep the local sync branch
  --remove-remote    Also remove the remote sync branch
  -h, --help         display help for command

Global Options:
  --version          Show version number
  --dry-run          Show what would be done without making changes
  --verbose          Enable verbose output
  --quiet            Suppress non-essential output
  --json             Output as JSON
  --color <when>     Colorize output: auto, always, never (default: "auto")
  --non-interactive  Disable all prompts, fail if input required
  --yes              Assume yes to confirmation prompts
  --no-sync          Skip automatic sync after write operations
  --debug            Show internal IDs alongside public IDs for debugging

IMPORTANT:
  Agents unfamiliar with tbd should run `tbd prime` for full workflow context.

Getting Started:
  npm install -g get-tbd@latest && tbd setup --auto --prefix=<name>

  This initializes tbd and configures your coding agents automatically.
  To refresh setup (idempotent, safe anytime): `tbd setup --auto`
  For interactive setup: `tbd setup --interactive`

For more on tbd, see: https://github.com/jlevy/tbd
? 0
```

* * *

## Uninstall When Not Initialized

# Test: Uninstall when not initialized shows error

```console
$ tbd uninstall 2>&1
Error: No .tbd directory found. Nothing to uninstall.
? 1
```

# Test: Uninstall --confirm when not initialized

```console
$ tbd uninstall --confirm 2>&1
Error: No .tbd directory found. Nothing to uninstall.
? 1
```

* * *

## Uninstall Requires Confirmation

# Test: Initialize tbd first

```console
$ tbd init --prefix=test --quiet
? 0
```

# Test: Create an issue to have some data

```console
$ tbd create "Test issue" --type=task
✓ Created [..]: Test issue
? 0
```

# Test: Uninstall without --confirm shows preview

```console
$ tbd uninstall | head -5
The following will be removed:

  - Worktree: .tbd/data-sync-worktree [..]
  - Local branch: tbd-sync
  - Directory: .tbd/ [..]
? 0
```

# Test: Uninstall preview shows confirmation requirement

```console
$ tbd uninstall | grep "To confirm"
To confirm, run: tbd uninstall --confirm
? 0
```

# Test: .tbd directory still exists after preview

```console
$ test -d .tbd && echo ".tbd still exists"
.tbd still exists
? 0
```

* * *

## Uninstall with Confirmation

# Test: Uninstall --confirm removes tbd

```console
$ tbd uninstall --confirm | grep "uninstalled"
✓ tbd has been uninstalled from this repository.
? 0
```

# Test: .tbd directory is removed

```console
$ test -d .tbd || echo ".tbd removed"
.tbd removed
? 0
```

# Test: tbd-sync branch is removed

```console
$ git branch --list tbd-sync | wc -l | tr -d ' '
0
? 0
```

* * *

## Uninstall with --keep-branch

# Test: Reinitialize tbd

```console
$ tbd init --prefix=test --quiet
? 0
```

# Test: Create another issue

```console
$ tbd create "Another issue" --type=bug
✓ Created [..]: Another issue
? 0
```

# Test: Verify tbd-sync branch exists before uninstall

```console
$ git branch --list tbd-sync | grep -c tbd-sync
1
? 0
```

# Test: Uninstall with --keep-branch

```console
$ tbd uninstall --confirm --keep-branch | grep "uninstalled"
✓ tbd has been uninstalled from this repository.
? 0
```

# Test: .tbd directory removed with --keep-branch

```console
$ test -d .tbd || echo ".tbd removed"
.tbd removed
? 0
```

# Test: tbd-sync branch preserved with --keep-branch

```console
$ git branch --list tbd-sync | grep -c tbd-sync
1
? 0
```

# Test: Can delete preserved branch manually

```console
$ git branch -D tbd-sync
Deleted branch tbd-sync [..].
? 0
```

* * *

## Uninstall Dry-Run

# Test: Reinitialize for dry-run test

```console
$ tbd init --prefix=test --quiet
? 0
```

# Test: Uninstall --dry-run shows what would happen

```console
$ tbd uninstall --confirm --dry-run | grep "DRY-RUN"
[DRY-RUN] Would remove tbd from repository
? 0
```

# Test: .tbd directory still exists after dry-run

```console
$ test -d .tbd && echo ".tbd still exists"
.tbd still exists
? 0
```

# Test: tbd-sync branch still exists after dry-run

```console
$ git branch --list tbd-sync | grep -c tbd-sync
1
? 0
```

* * *

## Full Uninstall Cleanup Verification

# Test: Final uninstall for cleanup verification

```console
$ tbd uninstall --confirm | grep "uninstalled"
✓ tbd has been uninstalled from this repository.
? 0
```

# Test: No .tbd directory

```console
$ test -d .tbd || echo "no .tbd"
no .tbd
? 0
```

# Test: No tbd-sync branch

```console
$ git branch --list tbd-sync | wc -l | tr -d ' '
0
? 0
```

# Test: No orphaned worktrees

```console
$ git worktree list | grep "data-sync-worktree" || echo "no orphan worktree"
no orphan worktree
? 0
```

# Test: Repository is still valid

```console
$ git status --porcelain
? 0
```
