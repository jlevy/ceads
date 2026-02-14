---
created_at: 2026-02-09T01:40:37.451Z
dependencies:
  - target: is-01kh00xpcnxh2mge03ak5fq30m
    type: blocks
id: is-01kh00xjycx5tpddt6nd9z6kdw
kind: task
labels: []
parent_id: is-01kh00wq09fmchfvm0c8c2s2gg
priority: 2
spec_path: docs/project/specs/active/plan-2026-02-02-external-docs-repos.md
status: open
title: "Fresh install: add secondary source and test multi-source"
type: is
updated_at: 2026-02-09T01:40:57.376Z
version: 2
---
Manually add rust-porting-playbook as secondary source with prefix rpp in config.yml. Run tbd sync --docs. Verify: .tbd/docs/rpp/references/ populated, no collision with spec/ docs. Test: tbd reference --list shows rpp docs, qualified lookup tbd reference rpp:rust-porting-guide works.
