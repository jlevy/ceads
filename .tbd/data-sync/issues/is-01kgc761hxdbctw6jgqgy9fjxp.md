---
close_reason: Added unit tests for mergeIdMappings and parseIdMappingFromYaml functions
closed_at: 2026-02-01T09:14:25.543Z
created_at: 2026-02-01T09:05:17.371Z
dependencies: []
id: is-01kgc761hxdbctw6jgqgy9fjxp
kind: task
labels: []
parent_id: is-01kgc6hsmxfbrsts7q2mmjrznp
priority: 1
status: closed
title: Add test for merge conflict detection in sync
type: is
updated_at: 2026-02-01T09:14:25.544Z
version: 3
---
Test the safety check that prevents committing files with merge conflict markers.

Test scenario:
1. Set up two repos (local and remote) with tbd initialized
2. Create issue on local, sync
3. Create different issue on remote directly in worktree, commit
4. Create another issue on local (so ids.yml diverges)
5. Run sync - should detect the conflict in ids.yml
6. Verify SyncError is thrown with the conflicted file names

This tests the safety check. A separate test should verify proper resolution once tbd-1orc is fixed.
