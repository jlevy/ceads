---
created_at: 2026-01-18T08:32:25.409Z
dependencies:
  - target: is-01kf83qzj2bzffyeqdrryhn64m
    type: blocks
id: is-01kf83qst1yakat6384xpw3bx1
kind: task
labels: []
parent_id: is-01kf83qm50827p60a7cg7jkqpd
priority: 2
status: open
title: Generate commit subject line with up to 8 short IDs (truncate if >10)
type: is
updated_at: 2026-01-18T08:33:00.132Z
version: 4
---
Generate commit subject line:
- Load ID mapping to convert internal IDs to short display IDs (e.g., tbd-a1b2)
- List up to 8 short IDs in comma-separated format
- If >10 total issues, show 8 IDs + '... +N more'
- Include total count: '(N issues)'
- Format: 'tbd sync: tbd-a1b2, tbd-c3d4, ... +N more (M issues)'
