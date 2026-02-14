---
created_at: 2026-02-09T01:42:02.451Z
dependencies:
  - target: is-01kh010d36t135fhyg9vj2yczj
    type: blocks
id: is-01kh0105ym45bcdm1c4dms2stc
kind: task
labels: []
parent_id: is-01kh00ywn96hz5rfvwm7bey6nw
priority: 2
spec_path: docs/project/specs/active/plan-2026-02-02-external-docs-repos.md
status: open
title: Remove general docs from tbd bundled set (now in Speculate)
type: is
updated_at: 2026-02-09T01:42:39.570Z
version: 2
---
Remove general-purpose docs from packages/tbd/docs/ that now come from Speculate via spec source. Remove: ~5 general shortcuts, all 26 guidelines (typescript-rules, python-rules, etc.), all templates. Keep: sys/ shortcuts, tbd/ shortcuts (24 tbd-specific ones), tbd-sync-troubleshooting.md. Verify tbd sync still provides all docs via spec source.
