---
close_reason: Added mergeIdMappings function and integrated into sync conflict resolution
closed_at: 2026-02-01T09:13:01.901Z
created_at: 2026-02-01T08:54:21.998Z
dependencies: []
id: is-01kgc6j1hf1z3wkb6yv6kfhk6k
kind: bug
labels: []
parent_id: is-01kgc6hsmxfbrsts7q2mmjrznp
priority: 1
status: closed
title: Fix sync that committed unresolved merge conflicts
type: is
updated_at: 2026-02-01T09:13:01.901Z
version: 4
---
The sync code resolves conflicts for issue files but ignores ids.yml. When ids.yml has conflicts, it gets staged and committed with conflict markers.

Fix needed:
1. Add merge resolution for ids.yml (combine all key-value pairs from both sides)
2. Add merge resolution for any other YAML files in data-sync

Safety check added (temporary): Sync now detects conflict markers before committing and fails loudly. This prevents silent corruption but doesn't resolve the root cause.
