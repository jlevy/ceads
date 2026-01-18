---
close_reason: Created lib/truncate.ts with ELLIPSIS constant, truncate() with word boundary support, and truncateMiddle() for paths/IDs. Added comprehensive unit tests.
closed_at: 2026-01-18T04:20:31.225Z
created_at: 2026-01-18T04:08:09.869Z
dependencies:
  - target: is-01kf7mmaqg5nsqjkh5phewrt5h
    type: blocks
id: is-01kf7mkxwe99jncy8j5zpt3ssf
kind: task
labels: []
priority: 2
status: closed
title: Create truncation utility
type: is
updated_at: 2026-01-18T04:20:31.226Z
version: 4
---
Create lib/truncate.ts with:
- ELLIPSIS constant (… U+2026) - never use '...'
- truncate(text, maxLength, options?) - truncate with word boundary support
- truncateMiddle(text, maxLength) - truncate from middle (for paths/IDs)
- Unit tests for all edge cases (empty, exact length, unicode, etc.)

Reference: plan spec section 2.4 (Truncation utility)
