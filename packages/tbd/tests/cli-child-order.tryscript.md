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
  # Initialize tbd with test prefix
  tbd init --prefix=test
---
# tbd Child Ordering: Golden Test

Tests for the `child_order_hints` feature which provides soft ordering hints for
displaying children under a parent issue.

* * *

## Setup: Create Parent Issue

Create a parent epic to hold our test children:

```console
$ tbd create "Parent Epic" --type=epic --json | jq -r '.id' | tee parent_id.txt
test-[SHORTID]
? 0
```

* * *

## Test: Auto-Population on Create

When creating issues with `--parent`, they are automatically appended to the parent’s
`child_order_hints`. Children appear in creation order.

Create three child tasks:

```console
$ tbd create "First Child" --type=task --parent=$(cat parent_id.txt) --json | jq -r '.id' | tee child1_id.txt
test-[SHORTID]
? 0
```

```console
$ tbd create "Second Child" --type=task --parent=$(cat parent_id.txt) --json | jq -r '.id' | tee child2_id.txt
test-[SHORTID]
? 0
```

```console
$ tbd create "Third Child" --type=task --parent=$(cat parent_id.txt) --json | jq -r '.id' | tee child3_id.txt
test-[SHORTID]
? 0
```

* * *

## Test: Children Display in Creation Order

Children are displayed in the order they were added (via `child_order_hints`). All
children have same priority P2, so order comes entirely from hints:

```console
$ tbd list --pretty
test-[SHORTID]     P2  ○ open  [epic] Parent Epic
├── test-[SHORTID]     P2  ○ open  [task] First Child
├── test-[SHORTID]     P2  ○ open  [task] Second Child
└── test-[SHORTID]     P2  ○ open  [task] Third Child

4 issue(s)
? 0
```

* * *

## Test: Show Order Hints with --show-order

The `--show-order` flag displays the current `child_order_hints`. The output shows both
internal IDs (in YAML) and display IDs (in summary):

```console
$ tbd show $(cat parent_id.txt) --show-order
---
child_order_hints:
  - is-[ULID]
  - is-[ULID]
  - is-[ULID]
created_at: [TIMESTAMP]
dependencies: []
id: is-[ULID]
kind: epic
labels: []
priority: P2
status: open
title: Parent Epic
type: is
updated_at: [TIMESTAMP]
version: 4
---


child_order_hints:
  - test-[SHORTID]
  - test-[SHORTID]
  - test-[SHORTID]
? 0
```

* * *

## Test: Manual Reordering with --child-order

Use `--child-order` to explicitly set the display order.
Reorder so Third comes first, then First, then Second:

```console
$ tbd update $(cat parent_id.txt) --child-order $(cat child3_id.txt),$(cat child1_id.txt),$(cat child2_id.txt)
✓ Updated test-[SHORTID]
? 0
```

Verify the new order in tree view - Third is now first:

```console
$ tbd list --pretty
test-[SHORTID]     P2  ○ open  [epic] Parent Epic
├── test-[SHORTID]     P2  ○ open  [task] Third Child
├── test-[SHORTID]     P2  ○ open  [task] First Child
└── test-[SHORTID]     P2  ○ open  [task] Second Child

4 issue(s)
? 0
```

* * *

## Test: Show Updated Order Hints

The reordered hints are now stored on the parent:

```console
$ tbd show $(cat parent_id.txt) --show-order
---
child_order_hints:
  - is-[ULID]
  - is-[ULID]
  - is-[ULID]
created_at: [TIMESTAMP]
dependencies: []
id: is-[ULID]
kind: epic
labels: []
priority: P2
status: open
title: Parent Epic
type: is
updated_at: [TIMESTAMP]
version: 5
---


child_order_hints:
  - test-[SHORTID]
  - test-[SHORTID]
  - test-[SHORTID]
? 0
```

* * *

## Test: Clear Order Hints with Empty String

Use empty string to clear all hints:

```console
$ tbd update $(cat parent_id.txt) --child-order ""
✓ Updated test-[SHORTID]
? 0
```

Verify hints are cleared (shows null in YAML, (none) in summary):

```console
$ tbd show $(cat parent_id.txt) --show-order
---
child_order_hints: null
created_at: [TIMESTAMP]
dependencies: []
id: is-[ULID]
kind: epic
labels: []
priority: P2
status: open
title: Parent Epic
type: is
updated_at: [TIMESTAMP]
version: 6
---


child_order_hints:
  (none)
? 0
```

* * *

## Test: Auto-Append on Re-Parent

Create a new standalone issue and re-parent it to the epic.
This should auto-append it to the parent’s child_order_hints:

```console
$ tbd create "Fourth Child" --type=task --json | jq -r '.id' | tee child4_id.txt
test-[SHORTID]
? 0
```

```console
$ tbd update $(cat child4_id.txt) --parent=$(cat parent_id.txt)
✓ Updated test-[SHORTID]
? 0
```

Verify the hint was added (Fourth Child is the only one in hints now):

```console
$ tbd show $(cat parent_id.txt) --show-order
---
child_order_hints:
  - is-[ULID]
created_at: [TIMESTAMP]
dependencies: []
id: is-[ULID]
kind: epic
labels: []
priority: P2
status: open
title: Parent Epic
type: is
updated_at: [TIMESTAMP]
version: 7
---


child_order_hints:
  - test-[SHORTID]
? 0
```

* * *

## Test: Invalid ID Errors

Using invalid IDs in --child-order produces an error:

```console
$ tbd update $(cat parent_id.txt) --child-order invalid-id 2>&1
Error: Invalid ID in --child-order: invalid-id
? 2
```

* * *

## Test: Re-establish Order with All Children

Set order hints for all children to verify complete ordering control:

```console
$ tbd update $(cat parent_id.txt) --child-order $(cat child2_id.txt),$(cat child4_id.txt),$(cat child3_id.txt),$(cat child1_id.txt)
✓ Updated test-[SHORTID]
? 0
```

All children now follow the specified order (Second, Fourth, Third, First):

```console
$ tbd list --pretty
test-[SHORTID]     P2  ○ open  [epic] Parent Epic
├── test-[SHORTID]     P2  ○ open  [task] Second Child
├── test-[SHORTID]     P2  ○ open  [task] Fourth Child
├── test-[SHORTID]     P2  ○ open  [task] Third Child
└── test-[SHORTID]     P2  ○ open  [task] First Child

5 issue(s)
? 0
```

* * *

## Test: Order Preserved Through Close

Close a child and verify ordering is preserved for remaining children:

```console
$ tbd close $(cat child4_id.txt) --reason "Done"
✓ Closed test-[SHORTID]
? 0
```

The closed child (Fourth) is no longer shown, ordering of remaining children preserved
(Second, Third, First):

```console
$ tbd list --pretty
test-[SHORTID]     P2  ○ open  [epic] Parent Epic
├── test-[SHORTID]     P2  ○ open  [task] Second Child
├── test-[SHORTID]     P2  ○ open  [task] Third Child
└── test-[SHORTID]     P2  ○ open  [task] First Child

4 issue(s)
? 0
```

* * *

## Test: JSON Output Includes Order Hints

JSON output includes the child_order_hints field with all 4 original hints:

```console
$ tbd show $(cat parent_id.txt) --json | jq '.child_order_hints | length'
4
? 0
```

* * *

## Test: No Order Hints Shows (none)

A new issue without children shows “(none)” for order hints:

```console
$ tbd create "Standalone Issue" --type=task --json | jq -r '.id' | tee standalone_id.txt
test-[SHORTID]
? 0
```

```console
$ tbd show $(cat standalone_id.txt) --show-order
---
created_at: [TIMESTAMP]
dependencies: []
id: is-[ULID]
kind: task
labels: []
priority: P2
status: open
title: Standalone Issue
type: is
updated_at: [TIMESTAMP]
version: 1
---


child_order_hints:
  (none)
? 0
```
