---
created_at: 2026-01-28T23:39:55.222Z
dependencies: []
id: is-01kg3fmneqw80andsyp2wpbnb8
kind: task
labels: []
parent_id: is-01kg3fj7r0jqj8p1hg9wt9h4sz
priority: 1
spec_path: docs/project/specs/active/plan-2026-01-28-sync-worktree-recovery-and-hardening.md
status: open
title: "Doctor: Add remote branch health check"
type: is
updated_at: 2026-01-28T23:39:55.222Z
version: 1
---
Add checkRemoteBranch() to doctor.ts. Uses checkRemoteBranchHealth() to verify remote tbd-sync branch exists. Report warning if missing, warning if diverged. Location: packages/tbd/src/cli/commands/doctor.ts
