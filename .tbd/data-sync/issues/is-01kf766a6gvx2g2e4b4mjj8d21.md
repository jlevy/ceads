---
close_reason: "Not reproducible: output.info() already checks for quiet mode and suppresses messages correctly"
closed_at: 2026-01-18T04:09:56.364Z
created_at: 2026-01-17T23:56:03.663Z
dependencies: []
id: is-01kf766a6gvx2g2e4b4mjj8d21
kind: bug
labels: []
priority: 3
status: closed
title: "Bug: Search outputs message with --quiet"
type: is
updated_at: 2026-01-18T04:09:56.365Z
version: 3
---
Search command outputs 'Refreshing worktree...' even with --quiet flag, polluting machine-readable output.
