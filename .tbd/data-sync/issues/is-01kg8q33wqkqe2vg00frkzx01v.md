---
close_reason: Implemented --updates-only flag for tbd save. Fetches remote tbd-sync, compares with local issues using getUpdatedIssues(), and saves only new/modified issues. Falls back to all issues if fetch fails.
closed_at: 2026-01-31T01:27:32.275Z
created_at: 2026-01-31T00:26:20.951Z
dependencies: []
id: is-01kg8q33wqkqe2vg00frkzx01v
kind: task
labels: []
parent_id: is-01kg8ksme85ymkbyt1cxj9gpe3
priority: 2
spec_path: docs/project/specs/active/plan-2026-01-30-workspace-sync-alt.md
status: closed
title: Implement --updates-only for tbd save command
type: is
updated_at: 2026-01-31T01:27:32.276Z
version: 4
---
Compare local worktree issues with origin/tbd-sync to identify issues that are new, modified, or missing from remote. These are the 'updated' issues that --updates-only should save.

Implementation approach:
1. Fetch remote tbd-sync branch (or use cached if offline)
2. List issues in local worktree
3. List issues on remote branch
4. Compare: new (local only), modified (content differs), deleted (remote only)
5. Save only new + modified issues to workspace

Fallback when remote unavailable: use git diff in worktree to find uncommitted changes.
