---
created_at: 2026-01-18T04:08:08.948Z
dependencies:
  - target: is-01kf7mmaqg5nsqjkh5phewrt5h
    type: blocks
  - target: is-01kf7mmbmgck29wdg2ftdrsw9p
    type: blocks
id: is-01kf7mkwzmemprqp952cwyryk1
kind: task
labels: []
priority: 2
status: in_progress
title: Create priority utilities
type: is
updated_at: 2026-01-18T04:30:15.346Z
version: 6
---
Create lib/priority.ts with:
- formatPriority() utility for P0/P1/P2 display format
- parsePriority() utility accepting 'P1' or '1' input
- getPriorityColor() utility (P0=red, P1=yellow, P2-P4=default)
- Unit tests for priority utilities

Reference: plan spec section 2.3 (Priority Colors)
