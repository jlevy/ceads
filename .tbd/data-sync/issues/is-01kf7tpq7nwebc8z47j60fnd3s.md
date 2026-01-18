---
created_at: 2026-01-18T05:54:32.820Z
dependencies:
  - target: is-01kf7tpcphaa1m10fbxhd86jxr
    type: blocks
id: is-01kf7tpq7nwebc8z47j60fnd3s
kind: task
labels: []
priority: 2
status: open
title: Remove redundant STATUS header from doctor
type: is
updated_at: 2026-01-18T05:54:52.259Z
version: 2
---
Doctor duplicates the status output under a STATUS header. Remove the header since the version line is sufficient.
