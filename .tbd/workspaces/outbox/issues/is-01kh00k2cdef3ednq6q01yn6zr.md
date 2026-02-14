---
created_at: 2026-02-09T01:34:52.812Z
dependencies:
  - target: is-01kh00kkcad26zfrxa83nn9fmr
    type: blocks
id: is-01kh00k2cdef3ednq6q01yn6zr
kind: task
labels: []
parent_id: is-01kh00hr6eq3p16ebr73y7cxk1
priority: 2
spec_path: docs/project/specs/active/plan-2026-02-02-external-docs-repos.md
status: open
title: Add progress indicators and error handling for repo checkout
type: is
updated_at: 2026-02-09T01:35:50.722Z
version: 2
---
Add progress output during repo checkout: 'Cloning spec (github.com/jlevy/speculate)...', 'Updating spec...'. Error handling: network errors → warn and skip (use cache if available), invalid URL → error at config parse time with format examples, missing ref → run git ls-remote and suggest alternatives, auth required → suggest gh auth login or SSH keys. Source removed from config → files deleted on next sync (hash change triggers clear).
