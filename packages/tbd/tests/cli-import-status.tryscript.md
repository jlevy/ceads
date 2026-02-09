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

  # Create JSONL data with ALL status values
  echo '{"id":"stat-open","title":"Issue with open status","status":"open","issue_type":"task","priority":2,"created_at":"2025-01-01T00:00:00Z","updated_at":"2025-01-01T00:00:00Z"}' > test-status.jsonl
  echo '{"id":"stat-in_progress","title":"Issue with in_progress status","status":"in_progress","issue_type":"task","priority":2,"created_at":"2025-01-01T00:00:01Z","updated_at":"2025-01-01T00:00:01Z"}' >> test-status.jsonl
  echo '{"id":"stat-done","title":"Issue with done status should map to closed","status":"done","issue_type":"task","priority":2,"created_at":"2025-01-01T00:00:02Z","updated_at":"2025-01-01T00:00:02Z"}' >> test-status.jsonl
  echo '{"id":"stat-closed","title":"Issue with closed status","status":"closed","issue_type":"task","priority":2,"created_at":"2025-01-01T00:00:03Z","updated_at":"2025-01-01T00:00:03Z"}' >> test-status.jsonl
  echo '{"id":"stat-blocked","title":"Issue with blocked status","status":"blocked","issue_type":"task","priority":2,"created_at":"2025-01-01T00:00:04Z","updated_at":"2025-01-01T00:00:04Z"}' >> test-status.jsonl
  echo '{"id":"stat-deferred","title":"Issue with deferred status","status":"deferred","issue_type":"task","priority":3,"created_at":"2025-01-01T00:00:05Z","updated_at":"2025-01-01T00:00:05Z"}' >> test-status.jsonl

  # Initialize tbd
  tbd init --prefix=test
---
# tbd CLI: Import Status Mapping Tests

Tests for status mapping during JSONL import.
Bug: tbd-1813 (done → closed mapping was missing).

* * *

## Import All Status Types

# Test: Import JSONL with all status values

```console
$ tbd import test-status.jsonl
...
? 0
```

* * *

## Verify Status Mappings

# Test: Open status preserved

```console
$ tbd list --status=open --json
[
  {
    "id": "stat-open",
    "internalId": "is-[ULID]",
    "priority": 2,
    "status": "open",
    "kind": "task",
    "title": "Issue with open status",
    "labels": []
  }
]
? 0
```

# Test: In_progress status preserved

```console
$ tbd list --status=in_progress --json
[
  {
    "id": "stat-in_progress",
    "internalId": "is-[ULID]",
    "priority": 2,
    "status": "in_progress",
    "kind": "task",
    "title": "Issue with in_progress status",
    "labels": []
  }
]
? 0
```

# Test: Done status maps to closed

The “done” status should be mapped to “closed” during import.

```console
$ tbd list --all --json
[
  {
    "id": "stat-blocked",
    "internalId": "is-[ULID]",
    "priority": 2,
    "status": "blocked",
    "kind": "task",
    "title": "Issue with blocked status",
    "labels": []
  },
  {
    "id": "stat-closed",
    "internalId": "is-[ULID]",
    "priority": 2,
    "status": "closed",
    "kind": "task",
    "title": "Issue with closed status",
    "labels": []
  },
  {
    "id": "stat-done",
    "internalId": "is-[ULID]",
    "priority": 2,
    "status": "closed",
    "kind": "task",
    "title": "Issue with done status should map to closed",
    "labels": []
  },
  {
    "id": "stat-in_progress",
    "internalId": "is-[ULID]",
    "priority": 2,
    "status": "in_progress",
    "kind": "task",
    "title": "Issue with in_progress status",
    "labels": []
  },
  {
    "id": "stat-open",
    "internalId": "is-[ULID]",
    "priority": 2,
    "status": "open",
    "kind": "task",
    "title": "Issue with open status",
    "labels": []
  },
  {
    "id": "stat-deferred",
    "internalId": "is-[ULID]",
    "priority": 3,
    "status": "deferred",
    "kind": "task",
    "title": "Issue with deferred status",
    "labels": []
  }
]
? 0
```

# Test: Closed status preserved

```console
$ tbd list --all --json
[
  {
    "id": "stat-blocked",
    "internalId": "is-[ULID]",
    "priority": 2,
    "status": "blocked",
    "kind": "task",
    "title": "Issue with blocked status",
    "labels": []
  },
  {
    "id": "stat-closed",
    "internalId": "is-[ULID]",
    "priority": 2,
    "status": "closed",
    "kind": "task",
    "title": "Issue with closed status",
    "labels": []
  },
  {
    "id": "stat-done",
    "internalId": "is-[ULID]",
    "priority": 2,
    "status": "closed",
    "kind": "task",
    "title": "Issue with done status should map to closed",
    "labels": []
  },
  {
    "id": "stat-in_progress",
    "internalId": "is-[ULID]",
    "priority": 2,
    "status": "in_progress",
    "kind": "task",
    "title": "Issue with in_progress status",
    "labels": []
  },
  {
    "id": "stat-open",
    "internalId": "is-[ULID]",
    "priority": 2,
    "status": "open",
    "kind": "task",
    "title": "Issue with open status",
    "labels": []
  },
  {
    "id": "stat-deferred",
    "internalId": "is-[ULID]",
    "priority": 3,
    "status": "deferred",
    "kind": "task",
    "title": "Issue with deferred status",
    "labels": []
  }
]
? 0
```

* * *

## Non-Standard Status Values

# Test: Blocked status maps to open (default for unknown)

Non-standard status values should map to ‘open’ as the safe default.

```console
$ tbd list --all --json
[
  {
    "id": "stat-blocked",
    "internalId": "is-[ULID]",
    "priority": 2,
    "status": "blocked",
    "kind": "task",
    "title": "Issue with blocked status",
    "labels": []
  },
  {
    "id": "stat-closed",
    "internalId": "is-[ULID]",
    "priority": 2,
    "status": "closed",
    "kind": "task",
    "title": "Issue with closed status",
    "labels": []
  },
  {
    "id": "stat-done",
    "internalId": "is-[ULID]",
    "priority": 2,
    "status": "closed",
    "kind": "task",
    "title": "Issue with done status should map to closed",
    "labels": []
  },
  {
    "id": "stat-in_progress",
    "internalId": "is-[ULID]",
    "priority": 2,
    "status": "in_progress",
    "kind": "task",
    "title": "Issue with in_progress status",
    "labels": []
  },
  {
    "id": "stat-open",
    "internalId": "is-[ULID]",
    "priority": 2,
    "status": "open",
    "kind": "task",
    "title": "Issue with open status",
    "labels": []
  },
  {
    "id": "stat-deferred",
    "internalId": "is-[ULID]",
    "priority": 3,
    "status": "deferred",
    "kind": "task",
    "title": "Issue with deferred status",
    "labels": []
  }
]
? 0
```

# Test: Deferred status maps to open (default for unknown)

```console
$ tbd list --all --json
[
  {
    "id": "stat-blocked",
    "internalId": "is-[ULID]",
    "priority": 2,
    "status": "blocked",
    "kind": "task",
    "title": "Issue with blocked status",
    "labels": []
  },
  {
    "id": "stat-closed",
    "internalId": "is-[ULID]",
    "priority": 2,
    "status": "closed",
    "kind": "task",
    "title": "Issue with closed status",
    "labels": []
  },
  {
    "id": "stat-done",
    "internalId": "is-[ULID]",
    "priority": 2,
    "status": "closed",
    "kind": "task",
    "title": "Issue with done status should map to closed",
    "labels": []
  },
  {
    "id": "stat-in_progress",
    "internalId": "is-[ULID]",
    "priority": 2,
    "status": "in_progress",
    "kind": "task",
    "title": "Issue with in_progress status",
    "labels": []
  },
  {
    "id": "stat-open",
    "internalId": "is-[ULID]",
    "priority": 2,
    "status": "open",
    "kind": "task",
    "title": "Issue with open status",
    "labels": []
  },
  {
    "id": "stat-deferred",
    "internalId": "is-[ULID]",
    "priority": 3,
    "status": "deferred",
    "kind": "task",
    "title": "Issue with deferred status",
    "labels": []
  }
]
? 0
```

* * *

## Count Verification

# Test: All 6 issues were imported

```console
$ tbd list --all --count
6
? 0
```
