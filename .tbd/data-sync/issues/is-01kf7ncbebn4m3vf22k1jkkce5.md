---
created_at: 2026-01-18T04:21:30.186Z
dependencies:
  - target: is-01kf7nbezdmr4qwytemnz1mf20
    type: blocks
id: is-01kf7ncbebn4m3vf22k1jkkce5
kind: task
labels: []
priority: 2
status: open
title: "Doctor: Show specific items for orphaned deps, duplicates, and invalid issues"
type: is
updated_at: 2026-01-18T04:26:02.069Z
version: 2
---
When doctor finds orphaned dependencies, duplicate IDs, or invalid issues, it should list the specific items instead of just showing counts.

**Current behavior:**
```
⚠ Dependencies - 2 orphaned reference(s)
✗ Unique IDs - 1 duplicate ID(s)  
✗ Issue validity - 3 invalid issue(s)
```

**Expected behavior:**
```
⚠ Dependencies - 2 orphaned reference(s)
    tbd-abc1 -> tbd-xyz9 (missing)
    tbd-def2 -> tbd-uvw8 (missing)
✗ Unique IDs - 1 duplicate ID(s)
    tbd-1234 appears in: open/issue1.md, closed/issue2.md
✗ Issue validity - 3 invalid issue(s)
    tbd-aaa1: missing required field 'title'
    tbd-bbb2: invalid priority 5 (must be 0-4)
    tbd-ccc3: invalid ID format
```

**Implementation:**
- Add `details?: string[]` field to CheckResult interface
- Update checkOrphanedDependencies, checkDuplicateIds, checkIssueValidity to populate details
- Render details as indented lines below the check result
