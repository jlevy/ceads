---
close_reason: Created cli/lib/issueFormat.ts with ISSUE_COLUMNS, formatKind, formatIssueLine, formatIssueLineExtended, formatIssueWithLabels, formatIssueCompact, formatIssueInline, formatIssueHeader, formatIssueLong, wrapDescription, and 24 unit tests
closed_at: 2026-01-18T04:36:00.680Z
created_at: 2026-01-18T04:08:23.023Z
dependencies:
  - target: is-01kf7mmb636x6ppr9pb3d89d4v
    type: blocks
  - target: is-01kf7mmc2kzbrfcxcmjc052e07
    type: blocks
id: is-01kf7mmaqg5nsqjkh5phewrt5h
kind: task
labels: []
priority: 2
status: closed
title: Create issue formatting utilities
type: is
updated_at: 2026-01-18T04:36:00.681Z
version: 11
---
Create cli/lib/issueFormat.ts with:
- ISSUE_COLUMNS constants (ID=12, PRIORITY=5, STATUS=16, ASSIGNEE=10)
- formatKind() - Format kind in brackets [bug], [feature], etc.
- formatIssueLine() - Standard table row with [kind] prefix on title
- formatIssueLineExtended() - Extended format with assignee
- formatIssueWithLabels() - Format with trailing labels in magenta
- formatIssueCompact() - Compact reference format (ID + icon + title, no kind)
- formatIssueInline() - Inline mention format (ID + title in parens, no kind)
- formatIssueHeader() - Table header row
- formatIssueLong() - Long format with wrapped description on 2nd line
- wrapDescription() - Word-wrap description text (6-space indent, max 2 lines)
- Unit tests for issue formatting utilities

Reference: plan spec section 2.4 (Issue Line Formats)
