---
created_at: 2026-02-09T01:02:38.153Z
dependencies:
  - target: is-01kgzyrbcf260b1791a043ccpv
    type: blocks
id: is-01kgzyr12a16cqreyy5ekn0r2k
kind: task
labels: []
parent_id: is-01kgzypm020x8n0jgadn5g3v7x
priority: 2
spec_path: docs/project/specs/active/plan-2026-02-02-external-docs-repos.md
status: open
title: Add DocsSourceSchema and update DocsCacheSchema in schemas.ts
type: is
updated_at: 2026-02-09T01:33:20.804Z
version: 3
---
Add DocsSourceSchema to schemas.ts: z.object with type (enum internal/repo), prefix (1-16 chars, lowercase alphanumeric + dash), optional url/ref/hidden, required paths array. Update DocsCacheSchema to include optional sources array alongside existing files/lookup_path (keep lookup_path in schema for migration parsing). Ensure Zod strip() mode interacts correctly with format version protection. Unit tests: valid/invalid prefixes, required fields by type, schema compatibility.
