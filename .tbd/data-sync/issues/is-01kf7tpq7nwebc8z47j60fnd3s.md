---
close_reason: Renamed STATUS to REPOSITORY in doctor for consistency - both commands now use same section structure
closed_at: 2026-01-18T06:20:37.549Z
created_at: 2026-01-18T05:54:32.820Z
dependencies:
  - target: is-01kf7tpcphaa1m10fbxhd86jxr
    type: blocks
  - target: is-01kf7trcmgzzv5245824gbcat3
    type: blocks
id: is-01kf7tpq7nwebc8z47j60fnd3s
kind: task
labels: []
priority: 2
status: closed
title: Remove redundant STATUS header from doctor
type: is
updated_at: 2026-01-18T06:20:37.549Z
version: 4
---
Doctor duplicates the status output under a STATUS header. Remove the header since the version line is sufficient.
