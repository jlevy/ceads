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
  STATUS: '[○◐●✓] \w+'
before: |
  # Set up a test git repository
  git init --initial-branch=main
  git config user.email "test@example.com"
  git config user.name "Test User"
  git config commit.gpgsign false
  echo "# Test repo" > README.md
  git add README.md
  git commit -m "Initial commit"
  # Initialize tbd with test prefix
  tbd init --prefix=test
  # Create spec files
  mkdir -p docs/specs
  echo "# Auth Feature" > docs/specs/plan-auth.md
  echo "# Search Feature" > docs/specs/plan-search.md
---
# tbd list --specs: Group by Spec Display

Tests for the `--specs` flag which groups listed beads by their linked spec, showing a
section header per spec and a “(No spec)” section for unlinked beads.

All issues use unique priorities to ensure fully deterministic sort order.

* * *

## Setup: Create Test Issues (4 issues, each with unique priority)

Create issues linked to the auth spec:

```console
$ tbd create "Implement login flow" --priority=0 --spec docs/specs/plan-auth.md --json | jq -r '.id' | tee auth1_id.txt
test-[SHORTID]
? 0
```

```console
$ tbd create "Add password reset" --priority=2 --spec docs/specs/plan-auth.md --json | jq -r '.id' | tee auth2_id.txt
test-[SHORTID]
? 0
```

Create an issue linked to the search spec:

```console
$ tbd create "Build search index" --priority=3 --spec docs/specs/plan-search.md --json | jq -r '.id' | tee search1_id.txt
test-[SHORTID]
? 0
```

Create an issue with no spec:

```console
$ tbd create "Fix typo in README" --priority=4 --json | jq -r '.id' | tee nospec1_id.txt
test-[SHORTID]
? 0
```

* * *

## Test: Basic --specs Groups by Spec

The `--specs` flag groups beads under spec headers with counts.
Spec groups appear in the order their first issue is encountered (by priority sort).
Unlinked beads appear in a “(No spec)” section at the end:

```console
$ tbd list --specs
Spec: docs/specs/plan-auth.md (2)

ID          PRI  STATUS          TITLE
test-[SHORTID]   P0   ○ open          [task] Implement login flow
test-[SHORTID]   P2   ○ open          [task] Add password reset

Spec: docs/specs/plan-search.md (1)

ID          PRI  STATUS          TITLE
test-[SHORTID]   P3   ○ open          [task] Build search index

(No spec) (1)

ID          PRI  STATUS          TITLE
test-[SHORTID]   P4   ○ open          [task] Fix typo in README

4 issue(s)
? 0
```

* * *

## Test: --specs with --all Includes Closed Issues

Close one issue and verify it appears with --all:

```console
$ tbd update $(cat auth2_id.txt) --status=closed
✓ Updated test-[SHORTID]
? 0
```

Without --all, the closed issue is excluded:

```console
$ tbd list --specs --spec docs/specs/plan-auth.md
Spec: docs/specs/plan-auth.md (1)

ID          PRI  STATUS          TITLE
test-[SHORTID]   P0   ○ open          [task] Implement login flow

1 issue(s)
? 0
```

With --all, the closed issue is included:

```console
$ tbd list --specs --all --spec docs/specs/plan-auth.md
Spec: docs/specs/plan-auth.md (2)

ID          PRI  STATUS          TITLE
test-[SHORTID]   P0   ○ open          [task] Implement login flow
test-[SHORTID]   P2   ✓ closed        [task] Add password reset

2 issue(s)
? 0
```

* * *

## Test: --specs with --status Filter

```console
$ tbd list --specs --status=closed
Spec: docs/specs/plan-auth.md (1)

ID          PRI  STATUS          TITLE
test-[SHORTID]   P2   ✓ closed        [task] Add password reset

1 issue(s)
? 0
```

* * *

## Test: Default list (no --specs) Is Unchanged

Without the `--specs` flag, output has no spec group headers:

```console
$ tbd list --spec docs/specs/plan-auth.md
ID          PRI  STATUS          TITLE
test-[SHORTID]   P0   ○ open          [task] Implement login flow

1 issue(s)
? 0
```

* * *

## Test: --specs with No Spec-linked Issues

Create a fresh filtered view where no issues have specs:

```console
$ tbd list --specs --type=chore
No issues found
? 0
```

* * *

## Test: --specs Shows Only No Spec Group When All Beads Are Unlinked

```console
$ tbd list --specs --priority=4
(No spec) (1)

ID          PRI  STATUS          TITLE
test-[SHORTID]   P4   ○ open          [task] Fix typo in README

1 issue(s)
? 0
```

* * *

## Setup: Add Epic with Child for Pretty Tests

Reopen the closed issue first so we have all 4 original issues:

```console
$ tbd update $(cat auth2_id.txt) --status=open
✓ Updated test-[SHORTID]
? 0
```

Create a parent epic with a child under the auth spec (P1 for epic, child inherits):

```console
$ tbd create "Auth epic" --type=epic --priority=1 --spec docs/specs/plan-auth.md --json | jq -r '.id' | tee epic_id.txt
test-[SHORTID]
? 0
```

```console
$ tbd create "Login page" --priority=1 --parent=$(cat epic_id.txt) --json | jq -r '.id'
test-[SHORTID]
? 0
```

* * *

## Test: --specs with --pretty Tree View

The `--specs --pretty` combination shows tree view within each spec group.
In pretty mode, children are nested under parents with full columns (ID, priority,
status). Items are sorted by priority.
Only actual parent-child relationships form trees; other beads in the same spec group
appear as standalone roots:

```console
$ tbd list --specs --pretty --spec docs/specs/plan-auth.md
Spec: docs/specs/plan-auth.md (4)

test-[SHORTID][..]  [task] Implement login flow
test-[SHORTID][..]  [epic] Auth epic
└── test-[SHORTID][..]  [task] Login page
test-[SHORTID][..]  [task] Add password reset

4 issue(s)
? 0
```

* * *

## Test: --specs without --spec Filter Shows All Groups with Pretty

```console
$ tbd list --specs --pretty
Spec: docs/specs/plan-auth.md (4)

test-[SHORTID][..]  [task] Implement login flow
test-[SHORTID][..]  [epic] Auth epic
└── test-[SHORTID][..]  [task] Login page
test-[SHORTID][..]  [task] Add password reset

Spec: docs/specs/plan-search.md (1)

test-[SHORTID][..]  [task] Build search index

(No spec) (1)

test-[SHORTID][..]  [task] Fix typo in README

6 issue(s)
? 0
```
