---
close_reason: Duplicate of tbd-8ien
closed_at: 2026-01-18T04:02:25.451Z
created_at: 2026-01-18T03:35:35.270Z
dependencies: []
id: is-01kf7jr93haj0pa28dftbz2g9a
kind: bug
labels: []
priority: 1
status: closed
title: "Bug: --parent stores display ID instead of internal ID"
type: is
updated_at: 2026-01-18T04:02:25.452Z
version: 3
---
When using 'tbd update --parent tbd-xyz', the parent_id field stores the display ID (tbd-xyz) instead of the internal ID (is-...). This causes schema validation errors since parent_id must match the internal ID regex. The --parent option should resolve the display ID to internal ID before storing.
