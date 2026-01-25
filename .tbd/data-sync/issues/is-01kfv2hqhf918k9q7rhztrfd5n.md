---
close_reason: null
closed_at: 2026-01-25T17:26:42.919Z
created_at: 2026-01-25T17:17:12.110Z
dependencies:
  - target: is-01kfv2hwyh8g0namvvastjprj9
    type: blocks
  - target: is-01kfv2kq1tptewzzk901njccnj
    type: blocks
id: is-01kfv2hqhf918k9q7rhztrfd5n
kind: task
labels: []
parent_id: is-01kfv2he1c3hct3c07gv0edh90
priority: 2
status: closed
title: Create hasGitignorePattern() detection function
type: is
updated_at: 2026-01-25T17:26:42.920Z
version: 5
---
Implement the detection function that checks if a pattern exists in gitignore content.

Pattern matching rules:
- Normalize trailing slashes: foo/ matches foo/
- Exact line match (not substring)
- Skip comment lines (#) and blank lines when checking
- Case-sensitive (gitignore is case-sensitive on Linux)

File: packages/tbd/src/utils/gitignore-utils.ts
