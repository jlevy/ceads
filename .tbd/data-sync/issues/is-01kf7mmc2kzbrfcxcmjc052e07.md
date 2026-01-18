---
created_at: 2026-01-18T04:08:24.402Z
dependencies:
  - target: is-01kf7mmy2wq0qgmaxj55vtsvsc
    type: blocks
id: is-01kf7mmc2kzbrfcxcmjc052e07
kind: task
labels: []
priority: 2
status: open
title: Migrate commands to issue formatting utilities
type: is
updated_at: 2026-01-18T04:10:56.595Z
version: 4
---
Update commands to use issueFormat.ts utilities:
- Update list.ts to use formatIssueLine() and formatIssueHeader()
- Update show.ts to use issue formatting utilities for dependencies
- Update ready.ts to use formatIssueLine()
- Update blocked.ts to use formatIssueLine() and formatIssueCompact()
- Update search.ts to use formatIssueLine()
- Update success/notice messages to use formatIssueInline() consistently

Reference: plan spec Phase 2 implementation tasks
