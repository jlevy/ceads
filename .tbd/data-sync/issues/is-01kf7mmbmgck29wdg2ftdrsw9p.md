---
created_at: 2026-01-18T04:08:23.951Z
dependencies:
  - target: is-01kf7mmy2wq0qgmaxj55vtsvsc
    type: blocks
id: is-01kf7mmbmgck29wdg2ftdrsw9p
kind: task
labels: []
priority: 2
status: open
title: Migrate commands to formatPriority/formatStatus
type: is
updated_at: 2026-01-18T04:11:13.576Z
version: 6
---
Update all commands to use new utilities:
- Update all commands to use formatPriority() for display
- Update all commands to use formatStatus() for display
- Remove duplicated getStatusColor() from list.ts and show.ts

Reference: plan spec section 3.1 (Reusable Components)
