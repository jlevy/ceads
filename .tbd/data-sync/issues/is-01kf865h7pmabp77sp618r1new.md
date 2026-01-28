---
close_reason: "Fixed: ISSUE_COLUMNS.ID=12 in issue-format.ts ensures consistent padding with padEnd"
closed_at: 2026-01-28T04:07:27.531Z
created_at: 2026-01-18T09:14:52.533Z
dependencies: []
id: is-01kf865h7pmabp77sp618r1new
kind: bug
labels: []
priority: 2
status: closed
title: Fix column alignment for short bead IDs in pretty output
type: is
updated_at: 2026-01-28T04:07:27.532Z
version: 3
---
When bead IDs have short suffixes (3 or fewer characters after the prefix, e.g., ar-0m1, ar-4ob, ar-80u), the columns in `tbd list --pretty` output don't align properly.

The ID column width should be fixed/padded so all columns align regardless of ID length.

Example of misalignment:
```
ar-6n5z  P0  ○ open  [bug] ...
ar-0m1  P2  ○ open  [feature] ...   <- misaligned
ar-80u  P2  ○ open  [feature] ...   <- misaligned
```

Fix: Left-pad or right-pad the ID field to a consistent width in the table formatting code.
