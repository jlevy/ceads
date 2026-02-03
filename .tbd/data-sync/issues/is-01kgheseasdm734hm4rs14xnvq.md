---
close_reason: Reproduction complete
closed_at: 2026-02-03T09:54:46.615Z
created_at: 2026-02-03T09:54:25.240Z
dependencies:
  - target: is-01kghet3afs5v8fn3yxf5v3041
    type: blocks
id: is-01kgheseasdm734hm4rs14xnvq
kind: task
labels: []
priority: 1
status: closed
title: "Reproduce: workspace import creates whole_issue conflicts for simple updates"
type: is
updated_at: 2026-02-03T09:55:04.173Z
version: 4
---
## Notes

## Reproduction

Created reproduction script that demonstrates the bug:

**Setup**: Two versions of the same issue:
- Base: status='open', updated_at='2026-02-01T10:00:00.000Z'
- Closed: status='closed', updated_at='2026-02-03T09:30:00.000Z'

**Current behavior** (workspace.ts passes `null` as base):
```
result = mergeIssues(null, closedIssue, baseIssue);
```
- Creates 1 conflict with field='whole_issue'
- Uses created_at to pick winner (independent creation logic)

**Expected behavior** (passing proper base):
```
result = mergeIssues(baseIssue, closedIssue, baseIssue);
```
- Creates 0 conflicts
- Uses field-by-field LWW merge
- Status field wins based on updated_at

## Impact

This affects all workspace imports (especially --outbox) where issues were:
- Closed in the worktree
- Saved to outbox before sync failed
- Re-imported after fixing sync

Users see 26+ "whole_issue" conflicts in attic when they should see 0.

## See Also

- Reproduction script: scratchpad/reproduce-bug.ts
- Parent bug: tbd-ybzq
