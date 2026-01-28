---
close_reason: "Implemented: tbd-format.ts with f01/f02/f03 migrations"
closed_at: 2026-01-28T04:06:34.381Z
created_at: 2026-01-26T17:28:06.696Z
dependencies:
  - target: is-01kfxpfxhfjvjmd3t1agxnpwd1
    type: blocks
id: is-01kfxnjds9j2c3qz4vsf09rm4s
kind: feature
labels: []
parent_id: is-01kfxpf476jcxq5m1d3g4d3nc7
priority: 2
spec_path: docs/project/specs/done/plan-2026-01-26-configurable-doc-cache-sync.md
status: closed
title: Add tbd_format versioning with tbd-format.ts migration infrastructure
type: is
updated_at: 2026-01-28T04:06:34.382Z
version: 7
---
Add explicit tbd_format field to config.yml for safe .tbd/ directory migrations. Create tbd-format.ts as single source of truth for format history, migration rules, and version constants. Only bump format for breaking changes requiring migration. See plan-2026-01-26-configurable-doc-cache-sync.md Phase 9.
