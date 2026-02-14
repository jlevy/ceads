---
created_at: 2026-02-09T01:41:58.719Z
dependencies:
  - target: is-01kh0105ym45bcdm1c4dms2stc
    type: blocks
id: is-01kh0102a0va61xzn1h38vxe5a
kind: task
labels: []
parent_id: is-01kh00ywn96hz5rfvwm7bey6nw
priority: 2
spec_path: docs/project/specs/active/plan-2026-02-02-external-docs-repos.md
status: open
title: "Update tbd default config to use Speculate main (ref: main)"
type: is
updated_at: 2026-02-09T01:42:32.433Z
version: 2
---
Update getDefaultSources() to set spec source ref: main (was ref: tbd during development). Update any hardcoded refs in setup.ts, doc-sync.ts, migration code. Run tbd setup --auto to verify config writes ref: main for spec source. Test fresh sync pulls from main branch.
