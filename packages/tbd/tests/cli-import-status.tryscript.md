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
  # Set up a test git repository
  git init --initial-branch=main
  git config user.email "test@example.com"
  git config user.name "Test User"
  echo "# Test repo" > README.md
  git add README.md
  git commit -m "Initial commit"

  # Create beads data with ALL status values
  mkdir -p .beads
  echo '{"id":"stat-open","title":"Issue with open status","status":"open","issue_type":"task","priority":2,"created_at":"2025-01-01T00:00:00Z","updated_at":"2025-01-01T00:00:00Z"}' > .beads/issues.jsonl
  echo '{"id":"stat-in_progress","title":"Issue with in_progress status","status":"in_progress","issue_type":"task","priority":2,"created_at":"2025-01-01T00:00:01Z","updated_at":"2025-01-01T00:00:01Z"}' >> .beads/issues.jsonl
  echo '{"id":"stat-done","title":"Issue with done status should map to closed","status":"done","issue_type":"task","priority":2,"created_at":"2025-01-01T00:00:02Z","updated_at":"2025-01-01T00:00:02Z"}' >> .beads/issues.jsonl
  echo '{"id":"stat-closed","title":"Issue with closed status","status":"closed","issue_type":"task","priority":2,"created_at":"2025-01-01T00:00:03Z","updated_at":"2025-01-01T00:00:03Z"}' >> .beads/issues.jsonl
  echo '{"id":"stat-blocked","title":"Issue with blocked status","status":"blocked","issue_type":"task","priority":2,"created_at":"2025-01-01T00:00:04Z","updated_at":"2025-01-01T00:00:04Z"}' >> .beads/issues.jsonl
  echo '{"id":"stat-deferred","title":"Issue with deferred status","status":"deferred","issue_type":"task","priority":3,"created_at":"2025-01-01T00:00:05Z","updated_at":"2025-01-01T00:00:05Z"}' >> .beads/issues.jsonl

  # Initialize tbd
  tbd init --prefix=test
---
# tbd CLI: Import Status Mapping Tests

Tests for beads status → tbd status mapping during import.
Bug: tbd-1813 (done → closed mapping was missing).

* * *

## Import All Status Types

# Test: Import from beads with all status values

```console
$ tbd import --from-beads
...
? 0
```

* * *

## Verify Status Mappings

# Test: Open status preserved

```console
$ tbd list --status=open --json | node -e "d=JSON.parse(require('fs').readFileSync(0,'utf8')); console.log(d.filter(i => i.title.includes('open status')).length > 0 ? 'found' : 'not found')"
found
? 0
```

# Test: In_progress status preserved

```console
$ tbd list --status=in_progress --json | node -e "d=JSON.parse(require('fs').readFileSync(0,'utf8')); console.log(d.filter(i => i.title.includes('in_progress')).length > 0 ? 'found' : 'not found')"
found
? 0
```

# Test: Done status mapped to closed (tbd-1813 fix)

```console
$ tbd list --all --status=closed --json | node -e "d=JSON.parse(require('fs').readFileSync(0,'utf8')); console.log(d.filter(i => i.title.includes('done status')).length > 0 ? 'found' : 'not found')"
found
? 0
```

# Test: Closed status preserved

```console
$ tbd list --all --status=closed --json | node -e "d=JSON.parse(require('fs').readFileSync(0,'utf8')); console.log(d.filter(i => i.title.includes('closed status')).length > 0 ? 'found' : 'not found')"
found
? 0
```

# Test: Blocked status preserved

```console
$ tbd list --status=blocked --json | node -e "d=JSON.parse(require('fs').readFileSync(0,'utf8')); console.log(d.filter(i => i.title.includes('blocked status')).length > 0 ? 'found' : 'not found')"
found
? 0
```

# Test: Deferred status preserved

```console
$ tbd list --status=deferred --json | node -e "d=JSON.parse(require('fs').readFileSync(0,'utf8')); console.log(d.filter(i => i.title.includes('deferred status')).length > 0 ? 'found' : 'not found')"
found
? 0
```

* * *

## Validate Import

# Test: Validate shows no errors

```console
$ tbd import --validate
...
Errors:                0
...
? 0
```
