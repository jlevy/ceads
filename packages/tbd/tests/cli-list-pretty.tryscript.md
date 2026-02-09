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
  STATUS: '[○◐●✓] \\w+'
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
---
# tbd list --pretty: Tree View Display

Tests for the `--pretty` flag which displays issues in a tree format showing
parent-child relationships.

* * *

## Setup: Create Test Issues

First, create a parent epic with child tasks:

```console
$ tbd create "Parent Epic" --type=epic --priority=1 --json | jq -r '.id' | tee parent_id.txt
test-[SHORTID]
? 0
```

```console
$ tbd create "Child Task 1" --type=task --priority=2 --parent=$(cat parent_id.txt) --json | jq -r '.id' | tee child1_id.txt
test-[SHORTID]
? 0
```

```console
$ tbd create "Child Task 2" --type=task --priority=3 --parent=$(cat parent_id.txt) --json | jq -r '.id' | tee child2_id.txt
test-[SHORTID]
? 0
```

Create a standalone issue (no parent):

```console
$ tbd create "Standalone Bug" --type=bug --priority=0 --json | jq -r '.id' | tee standalone_id.txt
test-[SHORTID]
? 0
```

* * *

## Test: Basic --pretty Output

The --pretty flag shows parent-child relationships with tree lines.
Children are sorted by priority (P2 before P3):

```console
$ tbd list --pretty
test-[SHORTID][..]  [bug] Standalone Bug
test-[SHORTID][..]  [epic] Parent Epic
├── test-[SHORTID][..]  [task] Child Task 1
└── test-[SHORTID][..]  [task] Child Task 2

4 issue(s)
? 0
```

* * *

## Test: Single Parent Only (no children in filtered results)

When filtering by type, children of different types are excluded.
The parent appears alone since its children are tasks, not features:

```console
$ tbd create "Feature Parent" --type=feature --priority=2 --json | jq -r '.id' | tee feature_parent_id.txt
test-[SHORTID]
? 0
```

```console
$ tbd list --pretty --type=feature
test-[SHORTID][..]  [feature] Feature Parent

1 issue(s)
? 0
```

* * *

## Test: Nested Grandchildren (3 levels)

Create a grandchild under an existing child:

```console
$ tbd create "Grandchild Task" --type=task --priority=4 --parent=$(cat child1_id.txt) --json | jq -r '.id'
test-[SHORTID]
? 0
```

Note: `--parent` shows direct children only.
The grandchild appears nested under Child Task 1 only when both are in the filtered
results (e.g., filtering by type):

```console
$ tbd list --pretty --parent=$(cat child1_id.txt)
test-[SHORTID][..]  [task] Grandchild Task

1 issue(s)
? 0
```

* * *

## Test: Empty Results

When no issues match filters:

```console
$ tbd list --pretty --status=blocked
No issues found
? 0
```

* * *

## Test: --pretty with --count

Count flag should work with pretty:

```console
$ tbd list --pretty --count
6
? 0
```

* * *

## Test: --pretty with --limit

Limit should still work:

```console
$ tbd list --pretty --limit=2
test-[SHORTID][..]  [bug] Standalone Bug
test-[SHORTID][..]  [epic] Parent Epic

2 issue(s)
? 0
```

* * *

## Test: --pretty with --json

JSON output overrides pretty:

```console
$ tbd list --pretty --json
[
...
]
? 0
```

* * *

## Test: Orphaned Children Display

Children whose parents are filtered out appear as roots.
When filtering by type=task, the epic parent is excluded, so children become roots:

```console
$ tbd list --pretty --type=task
test-[SHORTID][..]  [task] Child Task 1
└── test-[SHORTID][..]  [task] Grandchild Task
test-[SHORTID][..]  [task] Child Task 2

3 issue(s)
? 0
```

* * *

## Test: --pretty with --long (descriptions)

Create an issue with a description to test --long:

```console
$ tbd create "Task With Description" --type=task --priority=1 --description="This is a detailed description that will be wrapped across multiple lines when displayed in long format." --json | jq -r '.id'
test-[SHORTID]
? 0
```

The --long flag shows descriptions under each issue:

```console
$ tbd list --pretty --long --priority=1 --type=task
test-[SHORTID][..]  [task] Task With Description
      This is a detailed description that will be wrapped across multiple lines
      when displayed in long format.

1 issue(s)
? 0
```
