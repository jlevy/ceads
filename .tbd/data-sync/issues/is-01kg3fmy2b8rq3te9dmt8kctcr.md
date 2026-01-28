---
close_reason: Added checkDataLocation() to doctor.ts - detects issues in wrong .tbd/data-sync/ path
closed_at: 2026-01-28T23:57:58.378Z
created_at: 2026-01-28T23:40:04.042Z
dependencies:
  - target: is-01kg3fn2q76psx2kzskda9zhkx
    type: blocks
  - target: is-01kg3fn7xdx2m29fkpwywhzegv
    type: blocks
id: is-01kg3fmy2b8rq3te9dmt8kctcr
kind: task
labels: []
parent_id: is-01kg3fj7r0jqj8p1hg9wt9h4sz
priority: 1
spec_path: docs/project/specs/active/plan-2026-01-28-sync-worktree-recovery-and-hardening.md
status: closed
title: "Doctor: Add data location check (issues in wrong path)"
type: is
updated_at: 2026-01-28T23:57:58.379Z
version: 5
---
Add checkDataLocation() to doctor.ts. Detect issues in wrong .tbd/data-sync/ path on main branch (should be in worktree). Report error with count if found. This is Bug 5 detection. Location: packages/tbd/src/cli/commands/doctor.ts
