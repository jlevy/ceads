---
created_at: 2026-01-28T23:40:14.125Z
dependencies: []
id: is-01kg3fn7xdx2m29fkpwywhzegv
kind: task
labels: []
parent_id: is-01kg3fj7r0jqj8p1hg9wt9h4sz
priority: 1
spec_path: docs/project/specs/active/plan-2026-01-28-sync-worktree-recovery-and-hardening.md
status: open
title: "Doctor: Add multi-user/clone scenario detection"
type: is
updated_at: 2026-01-28T23:40:14.125Z
version: 1
---
Add checks to doctor.ts for User B clone scenarios: (1) .beads-disabled exists but tbd has no issues, (2) config has id_prefix but no issues, (3) .beads/ exists (migration available). Provide clear guidance for each case. Location: packages/tbd/src/cli/commands/doctor.ts
