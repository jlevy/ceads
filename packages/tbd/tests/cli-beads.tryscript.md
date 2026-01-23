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

  # Create mock Beads installation (.beads/)
  mkdir -p .beads
  cat > .beads/config.yaml << 'EOF'
  # Beads Configuration File
  no-db: true
  sync-branch: 'beads-sync'
  display:
    id_prefix: test
  EOF
  echo '{"id":"test-001","title":"Test issue one","status":"open","issue_type":"task","priority":2,"created_at":"2025-01-01T00:00:00Z","updated_at":"2025-01-01T00:00:00Z"}' > .beads/issues.jsonl
  echo '{"id":"test-002","title":"Test issue two","status":"closed","issue_type":"bug","priority":1,"created_at":"2025-01-02T00:00:00Z","updated_at":"2025-01-02T00:00:00Z"}' >> .beads/issues.jsonl
  touch .beads/beads.db
  touch .beads/daemon.log
---
# tbd CLI: Beads Migration

Tests for `tbd setup --from-beads` which migrates from Beads to tbd.

* * *

## Setup Help

# Test: Setup help shows --from-beads option

```console
$ tbd setup --help | grep -E "(--from-beads|Migrate)"
  --from-beads       Migrate from Beads to tbd
? 0
```

* * *

## Beads Detection

# Test: Running tbd setup --auto detects beads

```console
$ tbd setup --auto 2>&1 | grep -c "Beads detected"
2
? 0
```

* * *

## Migration with --from-beads

# Test: Setup --from-beads migrates and initializes

```console
$ rm -rf .tbd && mv .beads-disabled .beads  # Clean init and restore beads
? 0
```

```console
$ tbd setup --from-beads 2>&1 | grep "Setup complete"
Setup complete!
? 0
```

# Test: Issues were imported

```console
$ tbd list --all --json | node -e "d=JSON.parse(require('fs').readFileSync(0,'utf8')); console.log('imported:', d.length)"
imported: 2
? 0
```

# Test: Beads directory was disabled

```console
$ test -d .beads-disabled && echo "beads disabled" || echo "beads not disabled"
beads disabled
? 0
```

# Test: Original .beads directory no longer exists

```console
$ test -d .beads && echo "beads exists" || echo "beads removed"
beads removed
? 0
```

* * *

## ID Preservation

# Test: Imported IDs preserve original prefix

```console
$ tbd list --all --json | node -e "d=JSON.parse(require('fs').readFileSync(0,'utf8')); ids=d.map(i=>i.id).sort(); console.log(ids.join(','))"
test-001,test-002
? 0
```

* * *

## Status After Migration

# Test: Status shows initialized

```console
$ tbd status 2>&1 | grep -E "(tbd status|Initialized)"
...
? 0
```
