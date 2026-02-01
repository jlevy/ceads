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
# tbd CLI: List Status Filter

Tests for the `--status` filter in `tbd list`, specifically verifying that
`--status closed` works correctly.

Regression test for: https://github.com/jlevy/tbd/issues/26

* * *

## Setup: Create Issues with Different Statuses

# Test: Create open issues

```console
$ tbd create "Open issue 1" --type=task
✓ Created test-[SHORTID]: Open issue 1
? 0
```

```console
$ tbd create "Open issue 2" --type=bug
✓ Created test-[SHORTID]: Open issue 2
? 0
```

# Test: Create and close some issues

Create issue to close:

```console
$ tbd create "Issue to close 1" --type=task --json | node -e "const d=JSON.parse(require('fs').readFileSync(0,'utf8')); require('fs').writeFileSync('close1_id.txt', d.id); console.log('Created')"
Created
? 0
```

```console
$ tbd close $(cat close1_id.txt)
✓ Closed [..]
? 0
```

Create another issue to close:

```console
$ tbd create "Issue to close 2" --type=bug --json | node -e "const d=JSON.parse(require('fs').readFileSync(0,'utf8')); require('fs').writeFileSync('close2_id.txt', d.id); console.log('Created')"
Created
? 0
```

```console
$ tbd close $(cat close2_id.txt)
✓ Closed [..]
? 0
```

* * *

## Status Filter Tests

# Test: List defaults to excluding closed issues

By default, closed issues should not appear:

```console
$ tbd list --count
2
? 0
```

# Test: List --status open returns only open issues

```console
$ tbd list --status open --count
2
? 0
```

# Test: List --status closed returns closed issues (Bug #26)

This is the main regression test.
Before the fix, this would return 0 because closed issues were filtered out before the
status filter was applied.

```console
$ tbd list --status closed --count
2
? 0
```

# Test: List --all includes closed issues

```console
$ tbd list --all --count
4
? 0
```

# Test: Verify --status closed returns correct issues

Verify the closed issues are actually returned with correct details:

```console
$ tbd list --status closed --json | node -e "const d=JSON.parse(require('fs').readFileSync(0,'utf8')); console.log(d.filter(i => i.status === 'closed').length)"
2
? 0
```

# Test: Verify --status open returns only open issues (not closed)

```console
$ tbd list --status open --json | node -e "const d=JSON.parse(require('fs').readFileSync(0,'utf8')); console.log(d.filter(i => i.status === 'open').length)"
2
? 0
```

# Test: Verify --status closed with --json returns correct structure

```console
$ tbd list --status closed --json | node -e "const d=JSON.parse(require('fs').readFileSync(0,'utf8')); const allClosed = d.every(i => i.status === 'closed'); console.log(allClosed ? 'all-closed' : 'has-non-closed')"
all-closed
? 0
```

* * *

## Edge Cases

# Test: List --status in_progress when none exist

```console
$ tbd list --status in_progress --count
0
? 0
```

# Test: Create in_progress issue and filter

```console
$ tbd create "In progress issue" --type=task --json | node -e "const d=JSON.parse(require('fs').readFileSync(0,'utf8')); require('fs').writeFileSync('inprog_id.txt', d.id); console.log('Created')"
Created
? 0
```

```console
$ tbd update $(cat inprog_id.txt) --status in_progress
✓ Updated [..]
? 0
```

```console
$ tbd list --status in_progress --count
1
? 0
```

# Test: Total count with --all should now be 5

```console
$ tbd list --all --count
5
? 0
```
