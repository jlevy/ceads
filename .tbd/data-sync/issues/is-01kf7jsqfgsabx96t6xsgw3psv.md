---
close_reason: "Fixed: list --parent now resolves display IDs to internal IDs before filtering"
closed_at: 2026-01-18T04:05:22.719Z
created_at: 2026-01-18T03:36:22.760Z
dependencies: []
id: is-01kf7jsqfgsabx96t6xsgw3psv
kind: bug
labels: []
priority: 1
status: closed
title: "Bug: --parent filter does not resolve display IDs"
type: is
updated_at: 2026-01-18T04:05:22.720Z
version: 3
---
The 'tbd list --parent tbd-xyz' command does not resolve the display ID to internal ID before filtering. It should work like other commands that accept issue IDs and resolve them first.
