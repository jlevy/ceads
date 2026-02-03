---
close_reason: Bug fixed and verified
closed_at: 2026-02-03T10:10:12.904Z
created_at: 2026-02-03T09:40:43.086Z
dependencies:
  - target: is-01kgheseasdm734hm4rs14xnvq
    type: blocks
  - target: is-01kghet3afs5v8fn3yxf5v3041
    type: blocks
id: is-01kghe0befcjhvvwg88ttkmnqf
kind: bug
labels: []
priority: 0
status: closed
title: "Bug: workspace import creates whole_issue conflicts instead of field-level merges"
type: is
updated_at: 2026-02-03T10:10:12.904Z
version: 5
---
## Notes

## Problem

When importing from workspace (especially outbox), issues that exist in both the workspace and the worktree are incorrectly creating whole_issue conflicts instead of field-level merges.

## Root Cause

In workspace.ts:importFromWorkspace() (lines 409-426), when an issue exists in both locations, the code calls:

```typescript
result = mergeIssues(null, sourceIssue, targetIssue);
```

Passing `null` as the base triggers the "independent creation" logic in git.ts:mergeIssues() (lines 407-444), which:
1. Compares created_at timestamps
2. Picks the older one as winner
3. Creates a whole_issue conflict if they differ

This is wrong because these are NOT independently created issues - they're the same issue at different points in time. They should use field-by-field merging with LWW rules.

## Expected Behavior

According to tbd-design.md §3.5, field-level merge should happen with LWW strategy:
- Each field is compared independently
- LWW picks winner based on updated_at
- Only differing fields create conflicts (and only for lww strategy, not union)
- The design says: "Attic entries are created only when a merge strategy discards data"

Simple status updates should not create whole_issue conflicts.

## Fix

In importFromWorkspace() and saveToWorkspace(), when both issues exist, pass the older version (by updated_at) as the base to trigger field-by-field merging:

```typescript
const older = sourceTime >= targetTime ? targetIssue : sourceIssue;
const newer = sourceTime >= targetTime ? sourceIssue : targetIssue;
result = mergeIssues(older, newer, newer);
```

This way the merge logic sees that one version "changed" from the base and applies field-level LWW.

## Files Affected

- packages/tbd/src/file/workspace.ts (importFromWorkspace, saveToWorkspace)
