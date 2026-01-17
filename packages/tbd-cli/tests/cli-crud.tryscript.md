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
  echo "# Test repo" > README.md
  git add README.md
  git commit -m "Initial commit"
  # Initialize tbd
  tbd init
---
# tbd CLI: CRUD Operations

Comprehensive tests for create, show, update, list, close, and reopen commands.

* * *

## Create Command

# Test: Create minimal task

```console
$ tbd create "Minimal task"
✓ Created bd-[SHORTID]: Minimal task
? 0
```

# Test: Create with explicit type

```console
$ tbd create "A bug report" --type=bug
✓ Created bd-[SHORTID]: A bug report
? 0
```

# Test: Create feature with priority

```console
$ tbd create "High priority feature" --type=feature --priority=0
✓ Created bd-[SHORTID]: High priority feature
? 0
```

# Test: Create with description

```console
$ tbd create "Task with desc" --description="This is a detailed description"
✓ Created bd-[SHORTID]: Task with desc
? 0
```

# Test: Create with assignee

```console
$ tbd create "Assigned task" --assignee=alice
✓ Created bd-[SHORTID]: Assigned task
? 0
```

# Test: Create with multiple labels

```console
$ tbd create "Labeled task" --label=frontend --label=urgent --label=needs-review
✓ Created bd-[SHORTID]: Labeled task
? 0
```

# Test: Create epic

```console
$ tbd create "Epic project" --type=epic --priority=1
✓ Created bd-[SHORTID]: Epic project
? 0
```

# Test: Create chore

```console
$ tbd create "Cleanup task" --type=chore
✓ Created bd-[SHORTID]: Cleanup task
? 0
```

# Test: Create with due date

```console
$ tbd create "Due task" --due=2025-12-31T23:59:59Z
✓ Created bd-[SHORTID]: Due task
? 0
```

# Test: Create with defer date

```console
$ tbd create "Deferred work" --defer=2025-06-01T00:00:00Z
✓ Created bd-[SHORTID]: Deferred work
? 0
```

# Test: Create with dry-run

```console
$ tbd create "Dry run only" --type=bug --dry-run
[DRY-RUN] Would create issue
? 0
```

# Test: Create with JSON output

```console
$ tbd create "JSON test" --type=task --json
{
  "id": "bd-[SHORTID]",
  "internalId": "is-[ULID]",
  "title": "JSON test"
}
? 0
```

* * *

## Show Command

First, create an issue to show and save its internal ID:

```console
$ tbd create "Issue to show" --type=bug --priority=1 --description="Detailed description here" --label=backend --label=critical --json | node -e "const d=JSON.parse(require('fs').readFileSync(0,'utf8')); require('fs').writeFileSync('show_id.txt', d.internalId); console.log('Created')"
Created
? 0
```

# Test: Show issue by internal ID

Use the internal ID to show the issue:

```console
$ tbd show $(cat show_id.txt) | grep -c "title: Issue to show"
1
? 0
```

# Test: Show issue as JSON

```console
$ tbd show $(cat show_id.txt) --json | node -e "const d=JSON.parse(require('fs').readFileSync(0,'utf8')); console.log(d.title)"
Issue to show
? 0
```

# Test: Show non-existent issue

```console
$ tbd show is-00000000000000000000000000 2>&1
✗ Issue not found: is-00000000000000000000000000
? 0
```

* * *

## List Command

# Test: List all issues (default)

```console
$ tbd list
...
? 0
```

# Test: List with --all to include closed

```console
$ tbd list --all
...
? 0
```

# Test: List as JSON

```console
$ tbd list --json
[
...
]
? 0
```

# Test: List filter by status

```console
$ tbd list --status=open
...
? 0
```

# Test: List filter by type

```console
$ tbd list --type=bug
...
? 0
```

# Test: List filter by priority

```console
$ tbd list --priority=1
...
? 0
```

# Test: List filter by assignee

```console
$ tbd list --assignee=alice
...
? 0
```

# Test: List filter by label

```console
$ tbd list --label=frontend
...
? 0
```

# Test: List filter by multiple labels

```console
$ tbd list --label=urgent --label=frontend
...
? 0
```

# Test: List with limit

```console
$ tbd list --limit=3
...
? 0
```

# Test: List sorted by created

```console
$ tbd list --sort=created
...
? 0
```

# Test: List sorted by updated

```console
$ tbd list --sort=updated
...
? 0
```

* * *

## Update Command

First, create an issue to update and save its ID in the sandbox:

```console
$ tbd create "Update me" --type=task --priority=3 --json | node -e "const d=JSON.parse(require('fs').readFileSync(0,'utf8')); require('fs').writeFileSync('update_id.txt', d.id); console.log('Created')"
Created
? 0
```

# Test: Update status

```console
$ tbd update $(cat update_id.txt) --status=in_progress
✓ Updated [..]
? 0
```

# Test: Update priority

```console
$ tbd update $(cat update_id.txt) --priority=0
✓ Updated [..]
? 0
```

# Test: Update type

```console
$ tbd update $(cat update_id.txt) --type=bug
✓ Updated [..]
? 0
```

# Test: Update assignee

```console
$ tbd update $(cat update_id.txt) --assignee=bob
✓ Updated [..]
? 0
```

# Test: Update description

```console
$ tbd update $(cat update_id.txt) --description="New description text"
✓ Updated [..]
? 0
```

# Test: Update notes

```console
$ tbd update $(cat update_id.txt) --notes="Working on this task"
✓ Updated [..]
? 0
```

# Test: Update add label

```console
$ tbd update $(cat update_id.txt) --add-label=wip
✓ Updated [..]
? 0
```

# Test: Update remove label

```console
$ tbd update $(cat update_id.txt) --remove-label=wip
✓ Updated [..]
? 0
```

# Test: Update due date

```console
$ tbd update $(cat update_id.txt) --due=2025-12-31T00:00:00Z
✓ Updated [..]
? 0
```

# Test: Update defer date

```console
$ tbd update $(cat update_id.txt) --defer=2025-06-15T00:00:00Z
✓ Updated [..]
? 0
```

# Test: Verify updates applied

```console
$ tbd show $(cat update_id.txt) --json | node -e "const d=JSON.parse(require('fs').readFileSync(0,'utf8')); console.log('status:', d.status, 'type:', d.kind, 'assignee:', d.assignee)"
status: in_progress type: bug assignee: bob
? 0
```

# Test: Update with dry-run

```console
$ tbd update $(cat update_id.txt) --priority=4 --dry-run
[DRY-RUN] Would update [..]
? 0
```

# Test: Update non-existent issue

```console
$ tbd update is-00000000000000000000000000 --status=closed 2>&1
✗ Issue not found: is-00000000000000000000000000
? 0
```

* * *

## Close Command

Create an issue to close:

```console
$ tbd create "Close me" --type=task --json | node -e "const d=JSON.parse(require('fs').readFileSync(0,'utf8')); require('fs').writeFileSync('close_id.txt', d.id); console.log('Created')"
Created
? 0
```

# Test: Close issue

```console
$ tbd close $(cat close_id.txt)
✓ Closed [..]
? 0
```

# Test: Verify closed status

```console
$ tbd show $(cat close_id.txt) --json | node -e "const d=JSON.parse(require('fs').readFileSync(0,'utf8')); console.log('status:', d.status)"
status: closed
? 0
```

# Test: Close with reason

Create another issue:

```console
$ tbd create "Close with reason" --type=bug --json | node -e "const d=JSON.parse(require('fs').readFileSync(0,'utf8')); require('fs').writeFileSync('close2_id.txt', d.id); console.log('Created')"
Created
? 0
```

```console
$ tbd close $(cat close2_id.txt) --reason="Fixed in commit abc123"
✓ Closed [..]
? 0
```

# Test: Close with dry-run

```console
$ tbd create "Dry close" --json | node -e "const d=JSON.parse(require('fs').readFileSync(0,'utf8')); require('fs').writeFileSync('dryclose_id.txt', d.id)"
? 0
```

```console
$ tbd close $(cat dryclose_id.txt) --dry-run
[DRY-RUN] Would close [..]
? 0
```

# Test: Close already closed issue

```console
$ tbd close $(cat close_id.txt) 2>&1
✗ Issue[..]already closed
? 0
```

* * *

## Reopen Command

# Test: Reopen closed issue

```console
$ tbd reopen $(cat close_id.txt)
✓ Reopened [..]
? 0
```

# Test: Verify reopened status

```console
$ tbd show $(cat close_id.txt) --json | node -e "const d=JSON.parse(require('fs').readFileSync(0,'utf8')); console.log('status:', d.status)"
status: open
? 0
```

# Test: Reopen with reason

Close and reopen with reason:

```console
$ tbd close $(cat close_id.txt)
✓ Closed [..]
? 0
```

```console
$ tbd reopen $(cat close_id.txt) --reason="Fix was incomplete"
✓ Reopened [..]
? 0
```

# Test: Reopen with dry-run

```console
$ tbd close $(cat close_id.txt) && tbd reopen $(cat close_id.txt) --dry-run
✓ Closed [..]
[DRY-RUN] Would reopen [..]
? 0
```

# Test: Reopen already open issue

First reopen it for real:

```console
$ tbd reopen $(cat close_id.txt) 2>/dev/null; tbd reopen $(cat close_id.txt) 2>&1
...
✗ Issue[..]not closed[..]
? 0
```

* * *

## Edge Cases

# Test: Create with empty title fails

```console
$ tbd create "" 2>&1
✗ Title is required[..]
? 0
```

# Test: Update with invalid priority

```console
$ tbd update $(cat update_id.txt) --priority=10 2>&1
✗ Invalid priority[..]
? 0
```

# Test: Create with invalid type

```console
$ tbd create "Bad type" --type=invalid 2>&1
✗ Invalid type[..]
? 0
```

# Test: Update with invalid option --title

The update command does not support --title option.

```console
$ tbd update $(cat update_id.txt) --title "New title" 2>&1
error: unknown option '--title'
? 1
```
