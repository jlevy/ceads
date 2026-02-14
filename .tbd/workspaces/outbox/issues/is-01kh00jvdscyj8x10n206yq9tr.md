---
created_at: 2026-02-09T01:34:45.688Z
dependencies:
  - target: is-01kh00kkcad26zfrxa83nn9fmr
    type: blocks
id: is-01kh00jvdscyj8x10n206yq9tr
kind: task
labels: []
parent_id: is-01kh00hr6eq3p16ebr73y7cxk1
priority: 2
spec_path: docs/project/specs/active/plan-2026-02-02-external-docs-repos.md
status: open
title: Update --list output to show prefix when relevant
type: is
updated_at: 2026-02-09T01:35:47.261Z
version: 2
---
Update DocCommandHandler handleList to show prefix in parentheses after name when: name exists in multiple sources OR doc comes from non-default source. Format: 'typescript-rules (spec) 12.3 KB / ~3.5K tokens'. Hidden sources excluded from --list. JSON output includes prefix field. Update guidelines, template commands to use new format.
