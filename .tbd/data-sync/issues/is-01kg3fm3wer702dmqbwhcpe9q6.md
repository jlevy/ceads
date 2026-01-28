---
close_reason: Added checkRemoteBranchHealth() function to git.ts
closed_at: 2026-01-28T23:55:44.527Z
created_at: 2026-01-28T23:39:37.229Z
dependencies:
  - target: is-01kg3fm8whz13k1ty2st7461m0
    type: blocks
  - target: is-01kg3fmneqw80andsyp2wpbnb8
    type: blocks
id: is-01kg3fm3wer702dmqbwhcpe9q6
kind: task
labels: []
parent_id: is-01kg3fj7r0jqj8p1hg9wt9h4sz
priority: 1
spec_path: docs/project/specs/active/plan-2026-01-28-sync-worktree-recovery-and-hardening.md
status: closed
title: Add checkRemoteBranchHealth() function
type: is
updated_at: 2026-01-28T23:55:44.528Z
version: 5
---
Add checkRemoteBranchHealth() to git.ts per spec. Returns { exists, diverged, head? }. Uses git fetch and merge-base to detect if remote tbd-sync exists and whether local/remote have diverged. Location: packages/tbd/src/file/git.ts
