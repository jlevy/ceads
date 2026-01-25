---
close_reason: null
closed_at: 2026-01-25T17:26:43.151Z
created_at: 2026-01-25T17:18:17.145Z
dependencies:
  - target: is-01kfv2mbbm3rgr07rx3bcanajv
    type: blocks
id: is-01kfv2kq1tptewzzk901njccnj
kind: task
labels: []
parent_id: is-01kfv2he1c3hct3c07gv0edh90
priority: 2
status: closed
title: Unit tests for hasGitignorePattern()
type: is
updated_at: 2026-01-25T17:26:43.152Z
version: 3
---
Create comprehensive unit tests for the hasGitignorePattern() detection function.

Test cases:
- Exact match: 'foo/' found in content with 'foo/'
- Normalized match: 'foo' found in content with 'foo/'
- No match: 'bar' not found in content with 'foo/'
- Skip comments: pattern not matched against '#foo/' comment lines
- Skip blank lines: empty lines don't affect matching
- Case sensitivity: 'FOO' does not match 'foo'
- Multiple patterns: correct detection among many lines

File: packages/tbd/tests/gitignore-utils.test.ts
