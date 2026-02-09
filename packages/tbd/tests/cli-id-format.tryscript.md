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
  # Initialize tbd
  tbd init --prefix=test
---
# tbd CLI: ID Format Tests

Validates ID format behavior across commands.

## ID Format Reference

- **Internal ID**: `is-{26-char-ulid}` - stored in files, used for lookups
- **Display ID**: `{prefix}-{4-char-short-id}` - short ID for readability (prefix is
  ‘test’ in these tests)

* * *

## Create Command ID Format

# Test: Create shows short display ID in success message

```console
$ tbd create "Test issue" --priority=3
✓ Created test-[SHORTID]: Test issue
? 0
```

# Test: Create JSON output has both id and internalId

```console
$ tbd create "Test JSON" --json
{
  "id": "test-[SHORTID]",
  "internalId": "is-[ULID]",
  "title": "Test JSON"
}
? 0
```

* * *

## List Command ID Format

# Test: Setup - create several issues with different priorities

```console
$ tbd create "High priority" --priority=0
✓ Created test-[SHORTID]: High priority
? 0
```

```console
$ tbd create "Medium priority" --priority=1
✓ Created test-[SHORTID]: Medium priority
? 0
```

# Test: List shows short display IDs

The list command shows shortened display IDs for readability.

```console
$ tbd list | grep -c "^test-"
4
? 0
```

# Test: List JSON has short id and full internalId

```console
$ tbd list --json
[
  {
    "id": "test-[SHORTID]",
    "internalId": "is-[ULID]",
    "priority": 0,
    "status": "open",
    "kind": "task",
    "title": "High priority",
    "labels": []
  },
  {
    "id": "test-[SHORTID]",
    "internalId": "is-[ULID]",
    "priority": 1,
    "status": "open",
    "kind": "task",
    "title": "Medium priority",
    "labels": []
  },
  {
    "id": "test-[SHORTID]",
    "internalId": "is-[ULID]",
    "priority": 2,
    "status": "open",
    "kind": "task",
    "title": "Test JSON",
    "labels": []
  },
  {
    "id": "test-[SHORTID]",
    "internalId": "is-[ULID]",
    "priority": 3,
    "status": "open",
    "kind": "task",
    "title": "Test issue",
    "labels": []
  }
]
? 0
```

* * *

## Show Command ID Format

# Test: Capture internal ID for show tests

```console
$ tbd list --json | jq -r '.[0].internalId' | tee test_id.txt
is-[ULID]
? 0
```

# Test: Show command accepts internal ID

```console
$ ID=$(cat test_id.txt) && tbd show $ID | grep "^title:"
title: High priority
? 0
```

# Test: Show YAML output contains internal ID

```console
$ ID=$(cat test_id.txt) && tbd show $ID | grep "^id:"
id: is-[ULID]
? 0
```

* * *

## Update Command ID Format

# Test: Update accepts internal ID and shows display ID

```console
$ ID=$(cat test_id.txt) && tbd update $ID --priority=3
✓ Updated test-[SHORTID]
? 0
```

* * *

## Close/Reopen Command ID Format

# Test: Close accepts internal ID and shows short display ID

```console
$ ID=$(cat test_id.txt) && tbd close $ID
✓ Closed test-[SHORTID]
? 0
```

# Test: Reopen accepts internal ID and shows short display ID

```console
$ ID=$(cat test_id.txt) && tbd reopen $ID
✓ Reopened test-[SHORTID]
? 0
```

* * *

## Display ID Length Validation

# Test: List display IDs are 4 characters (short ID)

```console
$ tbd list | awk '{print $1}' | grep "^test-" | head -1 | sed 's/test-//' | wc -c | tr -d ' '
5
? 0
```

Note: wc -c includes newline, so 5 means 4 chars + newline.

* * *

## Workflow Commands ID Format

# Test: Ready command shows short display IDs

```console
$ tbd ready | grep -c "^test-"
4
? 0
```

# Test: Blocked command shows nothing when no blocked issues

```console
$ tbd blocked
? 0
```
