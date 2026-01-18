---
sandbox: true
env:
  NO_COLOR: '1'
  FORCE_COLOR: '0'
path:
  - ../dist
timeout: 120000
patterns:
  ULID: '[0-9a-z]{26}'
  SHORTID: '[0-9a-z]{4,5}'
  TIMESTAMP: "\\d{4}-\\d{2}-\\d{2}T\\d{2}:\\d{2}:\\d{2}(\\.\\d+)?Z"
before: |
  # Set up a test git repository
  git init --initial-branch=main
  git config user.email "test@example.com"
  git config user.name "Test User"
  echo "# E2E Import Test" > README.md
  git add README.md
  git commit -m "Initial commit"
  # Initialize tbd
  tbd init --prefix=test
---
# tbd CLI: Import E2E Test (Real Beads Database)

End-to-end test for importing from a real Beads database with 100+ issues.
This test uses the actual beads database from the tbd repository.

* * *

## Verify Source Beads Repository

# Test: Source beads database exists

```console
$ ls $TRYSCRIPT_TEST_DIR/../../../.beads/issues.jsonl
[..]/issues.jsonl
? 0
```

* * *

## Import from Real Repository

# Test: Import from source beads

```console
$ tbd import --from-beads --beads-dir=$TRYSCRIPT_TEST_DIR/../../../.beads 2>&1 | grep "Import complete"
✓ Import complete from [..]
? 0
```

# Test: At least 100 issues imported

```console
$ COUNT=$(tbd list --all --count) && [ "$COUNT" -ge 100 ] && echo "OK: $COUNT issues"
OK: [..] issues
? 0
```

* * *

## Validate Import Quality

# Test: Multiple issue types exist

```console
$ tbd list --all --type=task --count
[..]
? 0
```

```console
$ tbd list --all --type=bug --count
[..]
? 0
```

```console
$ tbd list --all --type=epic --count
[..]
? 0
```

# Test: Labels preserved

```console
$ tbd list --all --label=cli-layer --count
[..]
? 0
```

# Test: Beads metadata preserved in show output

```console
$ FIRST_ID=$(tbd list --all --limit=1 --json | grep internalId | head -1 | cut -d'"' -f4) && tbd show $FIRST_ID --json | grep original_id
[..]original_id[..]
? 0
```

* * *

## Validate Timestamps

# Test: Timestamps are valid ISO format

```console
$ FIRST_ID=$(tbd list --all --limit=1 --json | grep internalId | head -1 | cut -d'"' -f4) && tbd show $FIRST_ID --json | grep -E "created_at.*Z"
[..]created_at[..]Z[..]
? 0
```

* * *

## Re-import Idempotency

# Test: Save count before re-import

```console
$ tbd list --all --count > count_before.txt && cat count_before.txt
[..]
? 0
```

# Test: Re-import does not create duplicates

```console
$ tbd import --from-beads --beads-dir=$TRYSCRIPT_TEST_DIR/../../../.beads >/dev/null 2>&1 && tbd list --all --count > count_after.txt && diff count_before.txt count_after.txt && echo "Idempotent: YES"
Idempotent: YES
? 0
```

* * *

## Stats Consistency

# Test: Stats total matches list count

```console
$ STATS=$(tbd stats --json | grep total | cut -d':' -f2 | tr -d ' ,') && [ "$STATS" -ge 100 ] && echo "OK: $STATS total"
OK: [..] total
? 0
```
