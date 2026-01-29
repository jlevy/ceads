---
close_reason: "All phases complete: Phase 1 (detection infrastructure), Phase 2 (path consistency fixes), Phase 3 (auto-repair with sync --fix and doctor --fix), Phase 4 (prevention tests, verification, documentation). 769 tests pass, including 28 worktree-specific tests and 17 e2e tryscript scenarios."
closed_at: 2026-01-29T01:30:54.220Z
created_at: 2026-01-28T23:38:35.647Z
dependencies: []
id: is-01kg3fj7r0jqj8p1hg9wt9h4sz
kind: epic
labels: []
priority: 1
spec_path: docs/project/specs/active/plan-2026-01-28-sync-worktree-recovery-and-hardening.md
status: closed
title: "Epic: Sync Worktree Recovery and Hardening"
type: is
updated_at: 2026-01-29T01:30:54.220Z
version: 2
---
Comprehensive fixes to make tbd sync robust, recoverable, and fail-safe. Goals: (G1) Sync should NEVER report 'in sync' when data hasn't been synced, (G2) Missing/corrupted worktree should be automatically repaired, (G3) Path resolution should be consistent across all sync operations, (G4) Clear error messages when sync cannot proceed, (G5) Recovery path for existing repos with data in wrong location. Related: tbd-1810, tbd-208
