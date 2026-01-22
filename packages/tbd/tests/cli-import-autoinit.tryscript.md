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
  cat > .beads/config.yaml << 'EOF'
  display:
    id_prefix: test
  EOF
  echo '{"id":"test-001","title":"Test issue one","status":"open","issue_type":"task","priority":2,"labels":["test"],"created_at":"2025-01-01T00:00:00Z","updated_at":"2025-01-01T00:00:00Z"}' > .beads/issues.jsonl
  echo '{"id":"test-002","title":"Bug to fix","status":"open","issue_type":"bug","priority":1,"labels":["urgent","backend"],"created_at":"2025-01-02T00:00:00Z","updated_at":"2025-01-02T00:00:00Z"}' >> .beads/issues.jsonl
---
# tbd CLI: Setup from Beads Auto-Init

Tests for `tbd setup --from-beads` which initializes tbd and imports from Beads.

* * *

## Verify Not Initialized

# Test: Confirm tbd is not initialized

```console
$ test ! -d .tbd && echo "Not initialized"
Not initialized
? 0
```

# Test: List command fails before setup

```console
$ tbd list 2>&1
Error: Not a tbd repository (run 'tbd setup --auto' first)
? 1
```

* * *

## Setup from Beads

# Test: Setup --from-beads initializes and imports

The `--from-beads` flag initializes tbd and imports from Beads in one command.

```console
$ tbd setup --from-beads 2>&1 | head -30
...
Setup complete!
...
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
test-001,test-002
? 0
```

# Test: Issue details preserved

```console
$ tbd show test-001 | grep "^title:"
title: Test issue one
? 0
```

* * *

## Beads Disabled

# Test: Beads directory was disabled

```console
$ test -d .beads-disabled && echo "beads disabled"
beads disabled
? 0
```

# Test: Original beads directory removed

```console
$ test ! -d .beads && echo "beads removed"
beads removed
? 0
```

* * *

## Commands Work After Setup

# Test: Create works after setup

```console
$ tbd create "New issue after import"
✓ Created test-[SHORTID]: New issue after import
? 0
```

# Test: List shows all issues

```console
$ tbd list --all --json | node -e "d=JSON.parse(require('fs').readFileSync(0,'utf8')); console.log('total:', d.length)"
total: 3
? 0
```
