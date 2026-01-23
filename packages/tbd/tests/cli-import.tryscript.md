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
  git config commit.gpgsign false
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
  echo '{"id":"test-003","title":"Feature request","status":"closed","issue_type":"feature","priority":3,"created_at":"2025-01-03T00:00:00Z","updated_at":"2025-01-03T00:00:00Z"}' >> .beads/issues.jsonl
  # Initialize tbd and import from beads
  tbd setup --from-beads --auto
---
# tbd CLI: Import Command

Tests for importing issues from Beads and JSONL files.

Note: This test uses actual beads data from the repository to validate import
functionality.

* * *

## Help

# Test: Import help

```console
$ tbd import --help
Usage: tbd import [options] [file]

Import issues from JSONL file.
For Beads migration, use: tbd setup --from-beads

Arguments:
  file                JSONL file to import

Options:
  --beads-dir <path>  Beads data directory (for --validate)
  --merge             Merge with existing issues instead of skipping duplicates
  --verbose           Show detailed import progress
  --validate          Validate existing import against Beads source
  -h, --help          display help for command

Global Options:
  --version           Show version number
  --dry-run           Show what would be done without making changes
  --verbose           Enable verbose output
  --quiet             Suppress non-essential output
  --json              Output as JSON
  --color <when>      Colorize output: auto, always, never (default: "auto")
  --non-interactive   Disable all prompts, fail if input required
  --yes               Assume yes to confirmation prompts
  --no-sync           Skip automatic sync after write operations
  --debug             Show internal IDs alongside public IDs for debugging
...
? 0
```

* * *

## ID Preservation

Import preserves the original short IDs from beads.
When importing “test-001”, the display ID should be “bd-001” (preserving “001”) not a
random ID like “bd-xxxx”.

# Test: Imported IDs preserve original short IDs

The beads issues have IDs “test-001”, “test-002”, “test-003”. After import, display IDs
should be “test-001”, “test-002”, “test-003” (preserving the original prefix and short
IDs).

```console
$ tbd list --all --json | node -e "d=JSON.parse(require('fs').readFileSync(0,'utf8')); ids=d.map(i=>i.id).sort(); console.log(ids.join(','))"
test-001,test-002,test-003
? 0
```

# Test: Show command displays preserved ID

```console
$ tbd show test-001 | grep "^title:"
title: Test issue one
? 0
```

# Test: ID mapping file exists after import

```console
$ test -f .tbd/data-sync-worktree/.tbd/data-sync/mappings/ids.yml && echo "mapping file exists" || echo "no mapping file"
mapping file exists
? 0
```

* * *

## Import Validation

# Test: Validate import

```console
$ tbd import --validate --beads-dir .beads-disabled
Validating import...

Validation Results
...
? 0
```

# Test: Validate import as JSON

```console
$ tbd import --validate --beads-dir .beads-disabled --json 2>&1 | tail -10
...
? 0
```

# Test: Validate with verbose shows warnings

```console
$ tbd import --validate --beads-dir .beads-disabled --verbose
...
? 0
```

* * *

## Import from JSONL File

# Test: Import from file

Create a test JSONL file:

```console
$ echo '{"id":"file-001","title":"File import test","status":"open","issue_type":"bug","priority":1,"labels":["test"],"created_at":"2025-01-04T00:00:00Z","updated_at":"2025-01-04T00:00:00Z"}' > test-import.jsonl
? 0
```

```console
$ tbd import test-import.jsonl
...
? 0
```

# Test: Import with merge option

Create another test file:

```console
$ echo '{"id":"merge-001","title":"Merge test","status":"open","issue_type":"task","priority":2,"created_at":"2025-01-05T00:00:00Z","updated_at":"2025-01-05T00:00:00Z"}' > merge-import.jsonl
? 0
```

```console
$ tbd import merge-import.jsonl --merge
...
? 0
```

* * *

## Error Cases

# Test: Import missing file

```console
$ tbd import nonexistent.jsonl 2>&1
Error: File not found: nonexistent.jsonl
? 1
```

# Test: Validate without import first

Create fresh repo to test validation without import:

```console
$ mkdir fresh-repo && cd fresh-repo && git init --initial-branch=main && git config user.email "test@example.com" && git config user.name "Test"
Initialized empty Git repository in [..]
? 0
```

```console
$ cd fresh-repo && tbd init --prefix=test --quiet && tbd import --validate 2>&1
Error: Beads database not found[..]
...
? 1
```

* * *

## Import Statistics

# Test: Stats after import

```console
$ tbd list --all --json 2>/dev/null | node -e "d=JSON.parse(require('fs').readFileSync(0,'utf8')); console.log('issues after import:', d.length >= 3 ? 'OK' : 'FAIL')"
issues after import: OK
? 0
```

# Test: Stats command works

```console
$ tbd stats --json 2>/dev/null | node -e "d=JSON.parse(require('fs').readFileSync(0,'utf8')); console.log('stats total:', d.total >= 3 ? 'OK' : 'FAIL')"
stats total: OK
? 0
```
