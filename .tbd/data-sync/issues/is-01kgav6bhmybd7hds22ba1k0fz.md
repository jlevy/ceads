---
close_reason: Implemented workspace list with issue counts by status. Added listWorkspacesWithCounts() function and updated workspace list command to display table format with open/in_progress/closed/total columns. Golden session test added to cli-workspace-save.tryscript.md
closed_at: 2026-01-31T20:22:55.936Z
created_at: 2026-01-31T20:16:30.259Z
dependencies: []
id: is-01kgav6bhmybd7hds22ba1k0fz
kind: task
labels: []
priority: 2
spec_path: docs/project/specs/active/plan-2026-01-30-workspace-sync-alt.md
status: closed
title: "Enhancement: workspace list should show issue counts by status"
type: is
updated_at: 2026-01-31T20:22:55.937Z
version: 6
---
Enhance `tbd workspace list` to show issue counts by status (open, in_progress, closed, total) for each workspace. Output format should be consistent with `tbd stats` styling (aligned columns). Currently only lists workspace names without any counts.
