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
  # Set up test git repository
  git init --initial-branch=main
  git config user.email "test@example.com"
  git config user.name "Test User"
  git config commit.gpgsign false
  echo "# Test repo" > README.md
  git add README.md
  git commit -m "Initial commit"
  tbd setup --auto --prefix=test
---
# tbd CLI: Workspace Import with Field-Level Merge

Tests workspace import scenarios to verify field-level merging instead of whole_issue
conflicts.

**Bug Fix**: Previously, workspace imports created `whole_issue` conflicts when
reimporting issues that only had status changes.
This test verifies that field-level LWW merge is now used.

* * *

## Scenario: Close Issue, Save to Outbox, Import Back

This simulates the common workflow:
1. Close an issue
2. Sync fails, issues saved to outbox
3. Fix sync, import from outbox
4. Should merge cleanly with NO whole_issue conflicts

### Setup: Create an open issue

```console
$ tbd create "Implement feature X" --type=feature
✓ Created test-{{SHORTID:id1}}: Implement feature X
? 0
```

### Close the issue

```console
$ tbd close test-{{id1}} --reason "Completed"
✓ Closed test-{{id1}}
? 0
```

### Save to outbox (simulating sync failure recovery)

```console
$ tbd workspace save --outbox
✓ Saved 1 issue(s) to outbox
? 0
```

### Revert the worktree to open state (simulating the issue before close)

```console
$ tbd update test-{{id1}} --status=open
✓ Updated test-{{id1}}
? 0
```

### Import from outbox - should merge with NO whole_issue conflicts

The import should use field-level merge:
- Status field: LWW picks ‘closed’ (newer timestamp from outbox)
- No whole_issue conflict should be created

```console
$ tbd import --outbox
✓ Imported 1 issue(s) from outbox
✓ Workspace "outbox" cleared
ℹ Run `tbd sync` to commit and push imported issues
? 0
```

### Verify no whole_issue conflicts in attic

```console
$ find .tbd/data-sync-worktree/.tbd/data-sync/attic -name "*whole_issue*" 2>/dev/null || echo "No whole_issue conflicts found (expected)"
No whole_issue conflicts found (expected)
? 0
```

### Verify the issue is closed after import

```console
$ tbd show test-{{id1}} --json | node -e "d=JSON.parse(require('fs').readFileSync(0,'utf8')); console.log('Status:', d.status, '| Close reason:', d.close_reason)"
Status: closed | Close reason: Completed
? 0
```

* * *

## Scenario: Multiple Status Changes

Test that multiple status changes merge cleanly.

### Create issues

```console
$ tbd create "Task 1" --type=task
✓ Created test-{{SHORTID:id2}}: Task 1
? 0

$ tbd create "Task 2" --type=task
✓ Created test-{{SHORTID:id3}}: Task 2
? 0

$ tbd create "Task 3" --type=task
✓ Created test-{{SHORTID:id4}}: Task 3
? 0
```

### Update statuses

```console
$ tbd update test-{{id2}} --status=in_progress
✓ Updated test-{{id2}}
? 0

$ tbd update test-{{id3}} --status=blocked
✓ Updated test-{{id3}}
? 0

$ tbd close test-{{id4}}
✓ Closed test-{{id4}}
? 0
```

### Save to workspace

```console
$ tbd workspace save --workspace=backup
✓ Saved 4 issue(s) to backup
? 0
```

### Revert to open states

```console
$ tbd update test-{{id2}} --status=open
✓ Updated test-{{id2}}
? 0

$ tbd update test-{{id3}} --status=open
✓ Updated test-{{id3}}
? 0

$ tbd update test-{{id4}} --status=open
✓ Updated test-{{id4}}
? 0
```

### Import from workspace - should merge all issues

```console
$ tbd import --workspace=backup
✓ Imported 4 issue(s) from backup
ℹ Run `tbd sync` to commit and push imported issues
? 0
```

### Verify no whole_issue conflicts

```console
$ find .tbd/data-sync-worktree/.tbd/data-sync/attic -name "*whole_issue*" 2>/dev/null | wc -l | tr -d ' '
0
? 0
```

### Verify all statuses were merged correctly

```console
$ tbd list --json | node -e "d=JSON.parse(require('fs').readFileSync(0,'utf8')).filter(i=>['{{id2}}','{{id3}}','{{id4}}'].includes(i.id.split('-').pop())).sort((a,b)=>a.id.localeCompare(b.id)); d.forEach(i=>console.log(i.id+':', i.status))"
test-{{id2}}: in_progress
test-{{id3}}: blocked
test-{{id4}}: closed
? 0
```

* * *

## Summary

This test demonstrates that workspace import now uses field-level LWW merge instead of
creating whole_issue conflicts.
This fixes the bug where simple status updates created unnecessary conflicts in the
attic.
