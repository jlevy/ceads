---
close_reason: Updated attic.ts to use parseYamlWithConflictDetection for synced attic entry files. search.ts and config.ts read local-only gitignored files that don't need merge conflict detection.
closed_at: 2026-02-02T19:54:05.696Z
created_at: 2026-02-02T19:43:12.059Z
dependencies: []
id: is-01kgfy2t5wcmspjyfz7sc3ng1r
kind: task
labels: []
parent_id: is-01kgfy2a5tz9hx3b7twjg2est7
priority: 2
spec_path: docs/project/specs/active/plan-2026-02-02-skill-md-comprehensive-update.md
status: closed
title: Standardize YAML error handling with parseYamlWithConflictDetection
type: is
updated_at: 2026-02-02T19:54:05.697Z
version: 3
---
Replace direct parseYaml calls with parseYamlWithConflictDetection for user-editable files to provide helpful error messages for merge conflicts.
