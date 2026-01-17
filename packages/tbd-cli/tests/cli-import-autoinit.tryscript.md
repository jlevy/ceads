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
  # Set up a test git repository but do NOT initialize tbd
  git init --initial-branch=main
  git config user.email "test@example.com"
  git config user.name "Test User"
  echo "# Test repo" > README.md
  git add README.md
  git commit -m "Initial commit"
  # Create synthetic beads data for testing (not copying from repo)
  mkdir -p .beads
  echo '{"id":"test-001","title":"Test issue one","status":"open","issue_type":"task","priority":2,"labels":["test"],"created_at":"2025-01-01T00:00:00Z","updated_at":"2025-01-01T00:00:00Z"}' > .beads/issues.jsonl
  echo '{"id":"test-002","title":"Bug to fix","status":"open","issue_type":"bug","priority":1,"labels":["urgent","backend"],"created_at":"2025-01-02T00:00:00Z","updated_at":"2025-01-02T00:00:00Z"}' >> .beads/issues.jsonl
---
# tbd CLI: Auto-Init Import

Tests for importing issues from Beads in an uninitialized repository.
Per the design spec, `tbd import --from-beads` should auto-initialize tbd if needed.

* * *

## Verify Not Initialized

# Test: Confirm tbd is not initialized

```console
$ test ! -d .tbd && echo "Not initialized"
Not initialized
? 0
```

# Test: List command fails before import

```console
$ tbd list 2>&1
Error: Not a tbd repository (run 'tbd init' or 'tbd import --from-beads' first)
? 1
```

* * *

## Auto-Init Import

# Test: Import from beads auto-initializes and imports

The `--from-beads` flag should auto-initialize tbd and then import the issues.

```console
$ tbd import --from-beads
Initializing tbd repository...
✓ Initialized tbd repository
✓ Import complete from .beads/issues.jsonl
  New issues:   2
  Merged:       0
  Skipped:      0

Tip: To disable Beads and prevent agent confusion:
  bd hooks uninstall                 # Remove git hooks
  bd setup claude --remove           # Remove Claude Code hooks
  bd setup <editor> --remove         # cursor, codex, etc.
? 0
```

* * *

## Verify Initialization

# Test: .tbd directory was created

```console
$ test -d .tbd && echo "tbd initialized"
tbd initialized
? 0
```

# Test: Config file exists

```console
$ test -f .tbd/config.yml && echo "config exists"
config exists
? 0
```

# Test: Worktree was created

```console
$ test -d .tbd/data-sync-worktree && echo "worktree exists"
worktree exists
? 0
```

* * *

## Verify Import

# Test: Issues were imported

```console
$ tbd list --all --json | node -e "d=JSON.parse(require('fs').readFileSync(0,'utf8')); console.log('imported:', d.length)"
imported: 2
? 0
```

# Test: IDs are preserved from beads

```console
$ tbd list --all --json | node -e "d=JSON.parse(require('fs').readFileSync(0,'utf8')); ids=d.map(i=>i.id).sort(); console.log(ids.join(','))"
bd-001,bd-002
? 0
```

# Test: Issue details preserved

```console
$ tbd show bd-001 | grep "^title:"
title: Test issue one
? 0
```

* * *

## Commands Work After Auto-Init

# Test: Create works after auto-init import

```console
$ tbd create "New issue after import"
✓ Created bd-[SHORTID]: New issue after import
? 0
```

# Test: List shows all issues

```console
$ tbd list --all --json | node -e "d=JSON.parse(require('fs').readFileSync(0,'utf8')); console.log('total:', d.length)"
total: 3
? 0
```
