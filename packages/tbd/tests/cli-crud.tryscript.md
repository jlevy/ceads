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
# tbd CLI: CRUD Operations

Comprehensive tests for create, show, update, list, close, and reopen commands.

* * *

## Create Command

# Test: Create minimal task

```console
$ tbd create "Minimal task"
✓ Created test-[SHORTID]: Minimal task
? 0
```

# Test: Create with explicit type

```console
$ tbd create "A bug report" --type=bug
✓ Created test-[SHORTID]: A bug report
? 0
```

# Test: Create feature with priority (numeric format)

```console
$ tbd create "High priority feature" --type=feature --priority=0
✓ Created test-[SHORTID]: High priority feature
? 0
```

# Test: Create feature with priority (P-prefix format)

```console
$ tbd create "P1 priority feature" --type=feature --priority=P1
✓ Created test-[SHORTID]: P1 priority feature
? 0
```

# Test: Create with lowercase p-prefix format

```console
$ tbd create "Lowercase p2 task" --type=task --priority=p2
✓ Created test-[SHORTID]: Lowercase p2 task
? 0
```

# Test: Create with description

```console
$ tbd create "Task with desc" --description="This is a detailed description"
✓ Created test-[SHORTID]: Task with desc
? 0
```

# Test: Create with assignee

```console
$ tbd create "Assigned task" --assignee=alice
✓ Created test-[SHORTID]: Assigned task
? 0
```

# Test: Create with multiple labels

```console
$ tbd create "Labeled task" --label=frontend --label=urgent --label=needs-review
✓ Created test-[SHORTID]: Labeled task
? 0
```

# Test: Create epic

```console
$ tbd create "Epic project" --type=epic --priority=1
✓ Created test-[SHORTID]: Epic project
? 0
```

# Test: Create chore

```console
$ tbd create "Cleanup task" --type=chore
✓ Created test-[SHORTID]: Cleanup task
? 0
```

# Test: Create with due date

```console
$ tbd create "Due task" --due=2025-12-31T23:59:59Z
✓ Created test-[SHORTID]: Due task
? 0
```

# Test: Create with defer date

```console
$ tbd create "Deferred work" --defer=2025-06-01T00:00:00Z
✓ Created test-[SHORTID]: Deferred work
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
  "id": "test-[SHORTID]",
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
Error: Issue not found: is-00000000000000000000000000
? 1
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

# Test: List filter by priority (numeric format)

At this point we have 3 P1 issues: P1 priority feature, Epic project, Issue to show

```console
$ tbd list --priority=1 --count
3
? 0
```

# Test: List filter by priority (P-prefix format)

P-prefix format should work the same as numeric format:

```console
$ tbd list --priority=P1 --count
3
? 0
```

# Test: List filter by priority P0 (should return only P0 issues)

At this point we have 1 P0 issue (High priority feature).
Create another one:

```console
$ tbd create "Critical P0 issue" --priority=0 --json | node -e "const d=JSON.parse(require('fs').readFileSync(0,'utf8')); require('fs').writeFileSync('p0_id.txt', d.id); console.log('Created')"
Created
? 0
```

Now we have 2 P0 issues:

```console
$ tbd list --priority=P0 --count
2
? 0
```

Numeric format should return the same count:

```console
$ tbd list --priority=0 --count
2
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

# Test: Update priority (numeric format)

```console
$ tbd update $(cat update_id.txt) --priority=0
✓ Updated [..]
? 0
```

# Test: Update priority (P-prefix format)

```console
$ tbd update $(cat update_id.txt) --priority=P2
✓ Updated [..]
? 0
```

# Test: Update priority (lowercase p-prefix format)

```console
$ tbd update $(cat update_id.txt) --priority=p1
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
Error: Issue not found: is-00000000000000000000000000
? 1
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

# Test: Close already closed issue (idempotent - succeeds silently)

```console
$ tbd close $(cat close_id.txt)
✓ Closed [..]
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
Error: Issue[..]not closed[..]
? 1
```

* * *

## Edge Cases

# Test: Create with empty title fails

```console
$ tbd create "" 2>&1
Error: Title is required[..]
? 2
```

# Test: Update with invalid priority (out of range)

```console
$ tbd update $(cat update_id.txt) --priority=10 2>&1
Error: Invalid priority[..]
? 2
```

# Test: Update with invalid priority (P-prefix out of range)

```console
$ tbd update $(cat update_id.txt) --priority=P9 2>&1
Error: Invalid priority[..]
? 2
```

# Test: Update with invalid priority (non-numeric)

```console
$ tbd update $(cat update_id.txt) --priority=high 2>&1
Error: Invalid priority[..]
? 2
```

# Test: Create with invalid type

```console
$ tbd create "Bad type" --type=invalid 2>&1
Error: Invalid type[..]
? 2
```

# Test: Update title

```console
$ tbd update $(cat update_id.txt) --title "Updated title"
✓ Updated test-[SHORTID]
? 0
```

# Test: Verify title was updated

```console
$ tbd show $(cat update_id.txt) --json | node -e "const d=JSON.parse(require('fs').readFileSync(0,'utf8')); console.log('title:', d.title)"
title: Updated title
? 0
```

# Test: Update from file (round-trip editing)

Export an issue, modify it, and re-import:

```console
$ tbd show $(cat update_id.txt) > /tmp/issue_export.md && head -1 /tmp/issue_export.md
---
? 0
```

Modify the exported file (change title via sed):

```console
$ sed -i.bak 's/title: Updated title/title: Title from file/' /tmp/issue_export.md && grep "^title:" /tmp/issue_export.md
title: Title from file
? 0
```

Update from file:

```console
$ tbd update $(cat update_id.txt) --from-file /tmp/issue_export.md
✓ Updated [..]
? 0
```

Verify title was updated from file:

```console
$ tbd show $(cat update_id.txt) --json | node -e "const d=JSON.parse(require('fs').readFileSync(0,'utf8')); console.log('title:', d.title)"
title: Title from file
? 0
```

# Test: Update from file with invalid path

```console
$ tbd update $(cat update_id.txt) --from-file /nonexistent/file.md 2>&1
Error: Failed to read file: /nonexistent/file.md
? 1
```
