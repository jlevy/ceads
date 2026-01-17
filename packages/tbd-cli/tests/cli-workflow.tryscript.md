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

# TBD CLI: Workflow Commands

Tests for ready, blocked, stale, label, and depends commands.

---

## Ready Command

Set up issues for workflow testing:

```console
$ tbd create "Ready task 1" -t task --json | node -e "d=JSON.parse(require('fs').readFileSync(0,'utf8')); console.log(d.id)" > /tmp/ready1.txt
? 0
```

```console
$ tbd create "Ready task 2" -t bug -p 0 --json | node -e "d=JSON.parse(require('fs').readFileSync(0,'utf8')); console.log(d.id)" > /tmp/ready2.txt
? 0
```

```console
$ tbd create "Assigned task" -t task --assignee alice --json | node -e "d=JSON.parse(require('fs').readFileSync(0,'utf8')); console.log(d.id)" > /tmp/assigned.txt
? 0
```

```console
$ tbd create "In progress task" -t task --json | node -e "d=JSON.parse(require('fs').readFileSync(0,'utf8')); console.log(d.id)" > /tmp/inprogress.txt
? 0
```

```console
$ tbd update $(cat /tmp/inprogress.txt) --status in_progress
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
$ tbd ready --type bug
...
? 0
```

# Test: Ready with limit

```console
$ tbd ready --limit 1
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

---

## Blocked Command

Set up blocking relationship:

```console
$ tbd create "Blocker issue" -t task --json | node -e "d=JSON.parse(require('fs').readFileSync(0,'utf8')); console.log(d.id)" > /tmp/blocker.txt
? 0
```

```console
$ tbd create "Blocked by other" -t task --json | node -e "d=JSON.parse(require('fs').readFileSync(0,'utf8')); console.log(d.id)" > /tmp/blocked_by.txt
? 0
```

```console
$ tbd depends add $(cat /tmp/blocker.txt) $(cat /tmp/blocked_by.txt)
✓ bd-[SHORTID] now blocks bd-[SHORTID]
? 0
```

```console
$ tbd create "Explicitly blocked" -t task --json | node -e "d=JSON.parse(require('fs').readFileSync(0,'utf8')); console.log(d.id)" > /tmp/explicit_blocked.txt
? 0
```

```console
$ tbd update $(cat /tmp/explicit_blocked.txt) --status blocked
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
$ tbd blocked --limit 1
...
? 0
```

# Test: Blocked includes issues with unresolved blockers

The blocked command should show issues that have blocking relationships where the blocker is not closed.

```console
$ tbd blocked --json | node -e "d=JSON.parse(require('fs').readFileSync(0,'utf8')); console.log('blocked count:', d.length)"
blocked count: [..]
? 0
```

---

## Stale Command

Create some old issues (we can't actually backdate, so stale may show recent):

# Test: Stale shows not recently updated

```console
$ tbd stale
...
? 0
```

# Test: Stale with custom days

```console
$ tbd stale --days 0
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
$ tbd stale --status in_progress
...
? 0
```

# Test: Stale with limit

```console
$ tbd stale --limit 2
...
? 0
```

---

## Label Commands

Create an issue for label testing:

```console
$ tbd create "Label test issue" -t task --json | node -e "d=JSON.parse(require('fs').readFileSync(0,'utf8')); console.log(d.id)" > /tmp/label_issue.txt
? 0
```

# Test: Label add single

```console
$ tbd label add $(cat /tmp/label_issue.txt) frontend
✓ Added labels to bd-[SHORTID]: frontend
? 0
```

# Test: Label add multiple

```console
$ tbd label add $(cat /tmp/label_issue.txt) backend urgent
✓ Added labels to bd-[SHORTID]: backend, urgent
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
All labels already present
? 0
```

# Test: Label remove single

```console
$ tbd label remove $(cat /tmp/label_issue.txt) urgent
✓ Removed labels from bd-[SHORTID]: urgent
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
✓ Removed labels from bd-[SHORTID]: frontend, backend
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
✗ Issue not found[..]
? 0
```

---

## Depends Commands

Create issues for dependency testing:

```console
$ tbd create "Parent feature" -t feature --json | node -e "d=JSON.parse(require('fs').readFileSync(0,'utf8')); console.log(d.id)" > /tmp/dep_parent.txt
? 0
```

```console
$ tbd create "Child task" -t task --json | node -e "d=JSON.parse(require('fs').readFileSync(0,'utf8')); console.log(d.id)" > /tmp/dep_child.txt
? 0
```

# Test: Depends add (X blocks Y)

```console
$ tbd depends add $(cat /tmp/dep_parent.txt) $(cat /tmp/dep_child.txt)
✓ bd-[SHORTID] now blocks bd-[SHORTID]
? 0
```

# Test: Depends list forward (what does X block)

```console
$ tbd depends list $(cat /tmp/dep_parent.txt)
Blocks: bd-[SHORTID]
? 0
```

# Test: Depends list reverse (what blocks Y)

```console
$ tbd depends list $(cat /tmp/dep_child.txt)
Blocked by: bd-[SHORTID]
? 0
```

# Test: Depends list as JSON

```console
$ tbd depends list $(cat /tmp/dep_parent.txt) --json
{
...
}
? 0
```

# Test: Depends remove

```console
$ tbd depends remove $(cat /tmp/dep_parent.txt) $(cat /tmp/dep_child.txt)
✓ Removed dependency[..]
? 0
```

# Test: Verify dependency removed

```console
$ tbd depends list $(cat /tmp/dep_parent.txt) --json | node -e "d=JSON.parse(require('fs').readFileSync(0,'utf8')); console.log('blocks:', d.blocks.length)"
blocks: 0
? 0
```

# Test: Depends add with dry-run

```console
$ tbd depends add $(cat /tmp/dep_parent.txt) $(cat /tmp/dep_child.txt) --dry-run
[DRY-RUN] Would add dependency
? 0
```

# Test: Depends add self-reference fails

```console
$ tbd depends add $(cat /tmp/dep_parent.txt) $(cat /tmp/dep_parent.txt) 2>&1
✗ Issue cannot block itself
? 0
```

# Test: Depends add non-existent source

```console
$ tbd depends add is-00000000000000000000000000 $(cat /tmp/dep_child.txt) 2>&1
✗ [..]not found[..]
? 0
```

---

## Integration: Ready excludes blocked issues

Add a dependency to make an issue blocked:

```console
$ tbd depends add $(cat /tmp/blocker.txt) $(cat /tmp/ready1.txt)
✓ bd-[SHORTID] now blocks bd-[SHORTID]
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
