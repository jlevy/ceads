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
# tbd CLI: Workflow Commands

Tests for ready, blocked, stale, label, and dep commands.

* * *

## Ready Command

Set up issues for workflow testing:

```console
$ tbd create "Ready task 1" --type=task --json | node -e "d=JSON.parse(require('fs').readFileSync(0,'utf8')); console.log(d.id)" > /tmp/ready1.txt
? 0
```

```console
$ tbd create "Ready task 2" --type=bug --priority=0 --json | node -e "d=JSON.parse(require('fs').readFileSync(0,'utf8')); console.log(d.id)" > /tmp/ready2.txt
? 0
```

```console
$ tbd create "Assigned task" --type=task --assignee=alice --json | node -e "d=JSON.parse(require('fs').readFileSync(0,'utf8')); console.log(d.id)" > /tmp/assigned.txt
? 0
```

```console
$ tbd create "In progress task" --type=task --json | node -e "d=JSON.parse(require('fs').readFileSync(0,'utf8')); console.log(d.id)" > /tmp/inprogress.txt
? 0
```

```console
$ tbd update $(cat /tmp/inprogress.txt) --status=in_progress
✓ Updated [..]
? 0
```

# Test: Ready shows unassigned open issues

```console
$ tbd ready
...
? 0
```

# Test: Ready as JSON

```console
$ tbd ready --json
[
...
]
? 0
```

# Test: Ready filter by type

```console
$ tbd ready --type=bug
...
? 0
```

# Test: Ready with limit

```console
$ tbd ready --limit=1
...
? 0
```

# Test: Ready excludes assigned issues

```console
$ tbd ready --json | node -e "d=JSON.parse(require('fs').readFileSync(0,'utf8')); found=d.some(i=>i.assignee==='alice'); console.log(found?'FAIL: found assigned':'OK: no assigned')"
OK: no assigned
? 0
```

# Test: Ready excludes in_progress issues

```console
$ tbd ready --json | node -e "d=JSON.parse(require('fs').readFileSync(0,'utf8')); found=d.some(i=>i.status==='in_progress'); console.log(found?'FAIL: found in_progress':'OK: no in_progress')"
OK: no in_progress
? 0
```

* * *

## Blocked Command

Set up blocking relationship:

```console
$ tbd create "Blocker issue" --type=task --json | node -e "d=JSON.parse(require('fs').readFileSync(0,'utf8')); console.log(d.id)" > /tmp/blocker.txt
? 0
```

```console
$ tbd create "Blocked by other" --type=task --json | node -e "d=JSON.parse(require('fs').readFileSync(0,'utf8')); console.log(d.id)" > /tmp/blocked_by.txt
? 0
```

```console
$ tbd dep add $(cat /tmp/blocked_by.txt) $(cat /tmp/blocker.txt)
✓ test-[SHORTID] now depends on test-[SHORTID]
? 0
```

```console
$ tbd create "Explicitly blocked" --type=task --json | node -e "d=JSON.parse(require('fs').readFileSync(0,'utf8')); console.log(d.id)" > /tmp/explicit_blocked.txt
? 0
```

```console
$ tbd update $(cat /tmp/explicit_blocked.txt) --status=blocked
✓ Updated [..]
? 0
```

# Test: Blocked shows blocked status issues

```console
$ tbd blocked
...
? 0
```

# Test: Blocked as JSON

```console
$ tbd blocked --json
[
...
]
? 0
```

# Test: Blocked with limit

```console
$ tbd blocked --limit=1
...
? 0
```

# Test: Blocked includes issues with unresolved blockers

The blocked command should show issues that have blocking relationships where the
blocker is not closed.

```console
$ tbd blocked --json | node -e "d=JSON.parse(require('fs').readFileSync(0,'utf8')); console.log('blocked count:', d.length)"
blocked count: [..]
? 0
```

* * *

## Stale Command

Create some old issues (we can’t actually backdate, so stale may show recent):

# Test: Stale shows not recently updated

```console
$ tbd stale
...
? 0
```

# Test: Stale with custom days

```console
$ tbd stale --days=0
...
? 0
```

# Test: Stale as JSON

```console
$ tbd stale --json
...
? 0
```

# Test: Stale filter by status

```console
$ tbd stale --status=in_progress
...
? 0
```

# Test: Stale with limit

```console
$ tbd stale --limit=2
...
? 0
```

* * *

## Label Commands

Create an issue for label testing:

```console
$ tbd create "Label test issue" --type=task --json | node -e "d=JSON.parse(require('fs').readFileSync(0,'utf8')); console.log(d.id)" > /tmp/label_issue.txt
? 0
```

# Test: Label add single

```console
$ tbd label add $(cat /tmp/label_issue.txt) frontend
✓ Added labels to test-[SHORTID]: frontend
? 0
```

# Test: Label add multiple

```console
$ tbd label add $(cat /tmp/label_issue.txt) backend urgent
✓ Added labels to test-[SHORTID]: backend, urgent
? 0
```

# Test: Verify labels added

```console
$ tbd show $(cat /tmp/label_issue.txt) --json | node -e "d=JSON.parse(require('fs').readFileSync(0,'utf8')); console.log('labels:', d.labels.sort().join(','))"
labels: backend,frontend,urgent
? 0
```

# Test: Label add duplicate (idempotent)

```console
$ tbd label add $(cat /tmp/label_issue.txt) frontend
? 0
```

# Test: Label remove single

```console
$ tbd label remove $(cat /tmp/label_issue.txt) urgent
✓ Removed labels from test-[SHORTID]: urgent
? 0
```

# Test: Verify label removed

```console
$ tbd show $(cat /tmp/label_issue.txt) --json | node -e "d=JSON.parse(require('fs').readFileSync(0,'utf8')); has=d.labels.includes('urgent'); console.log(has?'FAIL: still has urgent':'OK: urgent removed')"
OK: urgent removed
? 0
```

# Test: Label remove multiple

```console
$ tbd label remove $(cat /tmp/label_issue.txt) frontend backend
✓ Removed labels from test-[SHORTID]: frontend, backend
? 0
```

# Test: Label list all

```console
$ tbd label list
...
? 0
```

# Test: Label list as JSON

```console
$ tbd label list --json
...
? 0
```

# Test: Label add with dry-run

```console
$ tbd label add $(cat /tmp/label_issue.txt) test-label --dry-run
[DRY-RUN] Would add labels
? 0
```

# Test: Label add to non-existent issue

```console
$ tbd label add is-00000000000000000000000000 test-label 2>&1
Error: Issue not found: is-00000000000000000000000000
? 1
```

* * *

## Dep Commands

Create issues for dependency testing:

```console
$ tbd create "Parent feature" --type=feature --json | node -e "d=JSON.parse(require('fs').readFileSync(0,'utf8')); console.log(d.id)" > /tmp/dep_parent.txt
? 0
```

```console
$ tbd create "Child task" --type=task --json | node -e "d=JSON.parse(require('fs').readFileSync(0,'utf8')); console.log(d.id)" > /tmp/dep_child.txt
? 0
```

# Test: Dep add (child depends on parent)

```console
$ tbd dep add $(cat /tmp/dep_child.txt) $(cat /tmp/dep_parent.txt)
✓ test-[SHORTID] now depends on test-[SHORTID]
? 0
```

# Test: Dep list shows what child depends on

```console
$ tbd dep list $(cat /tmp/dep_child.txt)
Blocked by: test-[SHORTID]
? 0
```

# Test: Dep list shows what parent blocks

```console
$ tbd dep list $(cat /tmp/dep_parent.txt)
Blocks: test-[SHORTID]
? 0
```

# Test: Dep list as JSON

```console
$ tbd dep list $(cat /tmp/dep_parent.txt) --json
{
...
}
? 0
```

# Test: Dep remove

```console
$ tbd dep remove $(cat /tmp/dep_child.txt) $(cat /tmp/dep_parent.txt)
✓ test-[SHORTID] no longer depends on test-[SHORTID]
? 0
```

# Test: Verify dependency removed

```console
$ tbd dep list $(cat /tmp/dep_parent.txt) --json | node -e "d=JSON.parse(require('fs').readFileSync(0,'utf8')); console.log('blocks:', d.blocks.length)"
blocks: 0
? 0
```

# Test: Dep add with dry-run

```console
$ tbd dep add $(cat /tmp/dep_child.txt) $(cat /tmp/dep_parent.txt) --dry-run
[DRY-RUN] Would add dependency
? 0
```

# Test: Dep add self-reference fails

```console
$ tbd dep add $(cat /tmp/dep_parent.txt) $(cat /tmp/dep_parent.txt) 2>&1
Error: Issue cannot depend on itself
? 2
```

# Test: Dep add non-existent source

```console
$ tbd dep add is-00000000000000000000000000 $(cat /tmp/dep_child.txt) 2>&1
Error: Issue not found: is-00000000000000000000000000
? 1
```

* * *

## Integration: Ready excludes blocked issues

Add a dependency to make an issue blocked (ready1 depends on blocker):

```console
$ tbd dep add $(cat /tmp/ready1.txt) $(cat /tmp/blocker.txt)
✓ test-[SHORTID] now depends on test-[SHORTID]
? 0
```

# Test: Ready excludes issues blocked by open blockers

```console
$ tbd ready --json | node -e "d=JSON.parse(require('fs').readFileSync(0,'utf8')); id='$(cat /tmp/ready1.txt)'; found=d.some(i=>i.id===id); console.log(found?'FAIL: blocked issue in ready':'OK: blocked excluded')"
OK: blocked excluded
? 0
```

# Test: Closing blocker makes blocked issue ready

```console
$ tbd close $(cat /tmp/blocker.txt)
✓ Closed [..]
? 0
```

```console
$ tbd ready --json | node -e "d=JSON.parse(require('fs').readFileSync(0,'utf8')); id='$(cat /tmp/ready1.txt)'; found=d.some(i=>i.id===id); console.log(found?'OK: now ready':'FAIL: should be ready now')"
OK: now ready
? 0
```
