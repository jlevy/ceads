---
created_at: 2026-01-18T04:08:09.429Z
dependencies:
  - target: is-01kf7mmaqg5nsqjkh5phewrt5h
    type: blocks
  - target: is-01kf7mmbmgck29wdg2ftdrsw9p
    type: blocks
id: is-01kf7mkxep66gtk77xmg0dxvza
kind: task
labels: []
priority: 2
status: open
title: Create status utilities
type: is
updated_at: 2026-01-18T04:10:50.477Z
version: 5
---
Create lib/status.ts with:
- formatStatus() utility for icon + word format (e.g., '● blocked')
- getStatusIcon() utility for status icons
- getStatusColor() utility (open=blue, in_progress=green, blocked=red, deferred=dim, closed=dim)
- Unit tests for status utilities

Reference: plan spec section 2.3 (Status Icons and Colors)
