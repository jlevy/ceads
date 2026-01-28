---
created_at: 2026-01-28T23:40:08.807Z
dependencies: []
id: is-01kg3fn2q76psx2kzskda9zhkx
kind: task
labels: []
parent_id: is-01kg3fj7r0jqj8p1hg9wt9h4sz
priority: 1
spec_path: docs/project/specs/active/plan-2026-01-28-sync-worktree-recovery-and-hardening.md
status: open
title: "Doctor: Add 'local has data but remote empty' detection"
type: is
updated_at: 2026-01-28T23:40:08.807Z
version: 1
---
Add check to doctor.ts for ai-trade-arena bug pattern: local worktree or wrong path has issues but remote tbd-sync has none. Count issues on remote using git show. Report error if mismatch found. Location: packages/tbd/src/cli/commands/doctor.ts
