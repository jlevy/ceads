---
created_at: 2026-01-18T08:32:19.615Z
dependencies: []
id: is-01kf83qm50827p60a7cg7jkqpd
kind: feature
labels: []
priority: 2
status: open
title: Improve sync commit messages with ticket IDs and summaries
type: is
updated_at: 2026-01-18T08:32:49.369Z
version: 2
---
Currently the sync commit message at sync.ts:290-296 is generic: 'tbd sync: {timestamp} ({count} file(s))'. This feature improves it to:

1. Subject line: List up to 8 short IDs of modified tickets, truncate if >10 total
2. Body: Long-format summary similar to 'tbd list --long' output with:
   - Short ID
   - Title (truncated)
   - Description (truncated)
   - Close reason if applicable

Example subject: 'tbd sync: tbd-a1b2, tbd-c3d4, tbd-e5f6 (3 issues)'
Example with truncation: 'tbd sync: tbd-a1b2, tbd-c3d4, ... +4 more (12 issues)'
