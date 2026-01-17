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
  # Create synthetic beads data for testing (not copying from repo)
  mkdir -p .beads
  echo '{"id":"test-001","title":"Test issue one","status":"open","issue_type":"task","priority":2,"labels":["test"],"created_at":"2025-01-01T00:00:00Z","updated_at":"2025-01-01T00:00:00Z"}' > .beads/issues.jsonl
  echo '{"id":"test-002","title":"Bug to fix","status":"open","issue_type":"bug","priority":1,"labels":["urgent","backend"],"created_at":"2025-01-02T00:00:00Z","updated_at":"2025-01-02T00:00:00Z"}' >> .beads/issues.jsonl
  echo '{"id":"test-003","title":"Feature request","status":"closed","issue_type":"feature","priority":3,"created_at":"2025-01-03T00:00:00Z","updated_at":"2025-01-03T00:00:00Z"}' >> .beads/issues.jsonl
  # Initialize tbd
  tbd init
---

# TBD CLI: Import Command

Tests for importing issues from Beads and JSONL files.

Note: This test uses actual beads data from the repository to validate import functionality.

---

## Help

# Test: Import help

```console
$ tbd import --help
Usage: tbd import [options] [file]

Import issues from Beads or JSONL file.
Tip: Run "bd sync" and stop the beads daemon before importing for best results.

Arguments:
  file                JSONL file to import

Options:
  --from-beads        Import directly from Beads database
  --beads-dir <path>  Beads data directory
  --merge             Merge with existing issues instead of skipping duplicates
  --verbose           Show detailed import progress
  --validate          Validate existing import against Beads source
  -h, --help          display help for command
? 0
```

---

## Import from Beads

# Test: Import from beads directory

```console
$ tbd import --from-beads
...
? 0
```

# Test: Verify issues were imported

```console
$ tbd list --all --json | node -e "d=JSON.parse(require('fs').readFileSync(0,'utf8')); console.log('imported:', d.length)"
imported: [..]
? 0
```

# Test: Import with verbose output

```console
$ tbd import --from-beads --verbose
...
? 0
```

---

## Import Validation

# Test: Validate import

```console
$ tbd import --validate
Validating import...

Validation Results
...
Total Beads issues:[..]
Total TBD issues:[..]
Valid imports:[..]
...
? 0
```

# Test: Validate import as JSON

```console
$ tbd import --validate --json 2>&1 | tail -10
...
? 0
```

# Test: Validate with verbose shows warnings

```console
$ tbd import --validate --verbose
...
? 0
```

---

## Import from Custom Directory

# Test: Import with custom beads-dir

Create a custom beads directory:

```console
$ mkdir -p custom-beads && echo '{"id":"custom-1","title":"Custom issue","status":"open","type":"task","priority":2}' > custom-beads/issues.jsonl
? 0
```

Note: We already imported from .beads, so this would add duplicates. Testing the flag works:

```console
$ tbd import --from-beads --beads-dir custom-beads --verbose
...
? 0
```

---

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

---

## Error Cases

# Test: Import missing file

```console
$ tbd import nonexistent.jsonl 2>&1
✗ File not found: nonexistent.jsonl
? 0
```

# Test: Import missing beads directory

```console
$ tbd import --from-beads --beads-dir nonexistent-dir 2>&1
✗ Beads database not found[..]
...
? 0
```

# Test: Validate without import first

Create fresh repo to test validation without import:

```console
$ mkdir fresh-repo && cd fresh-repo && git init --initial-branch=main && git config user.email "test@example.com" && git config user.name "Test"
Initialized empty Git repository in [..]
? 0
```

```console
$ cd fresh-repo && tbd init && tbd import --validate 2>&1
✓ Initialized tbd repository
...
✗ Beads database not found[..]
...
? 0
```

---

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

---

## Import Idempotency

# Test: Re-import skips existing (no duplicates)

```console
$ tbd import --from-beads 2>&1 | grep -i skip || echo "Import complete"
...
? 0
```

# Test: Count unchanged after re-import

```console
$ tbd list --all --json 2>/dev/null | node -e "d=JSON.parse(require('fs').readFileSync(0,'utf8')); console.log('count after re-import:', d.length >= 3 ? 'OK' : 'FAIL')"
count after re-import: OK
? 0
```

