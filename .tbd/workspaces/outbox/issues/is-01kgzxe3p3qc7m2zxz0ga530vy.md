---
child_order_hints:
  - is-01kgzxetnqnvtf41cx6a988sy8
  - is-01kgzxfmfss9zfpj5abhgm2whz
  - is-01kgzxfqrfxmt6pcdnw1t8vem6
  - is-01kgzxftzt59ardkfx9k3wj145
  - is-01kgzxfy6t76xrk1mybbg5jger
created_at: 2026-02-09T00:39:44.578Z
dependencies: []
id: is-01kgzxe3p3qc7m2zxz0ga530vy
kind: task
labels: []
parent_id: is-01kgzxcx31b6kjdd9v8r3gt5e3
priority: 2
spec_path: docs/project/specs/active/plan-2026-02-02-external-docs-repos.md
status: open
title: "0a.1: Refactor shortcut.ts to use DocCommandHandler"
type: is
updated_at: 2026-02-09T01:51:03.423Z
version: 8
---
shortcut.ts has its own ShortcutHandler extending BaseCommand with ~280 lines of duplicated logic (listing, querying, text wrapping) that already exists in DocCommandHandler. guidelines.ts and template.ts properly use DocCommandHandler. This refactor is a prerequisite for the prefix-based doc system since prefix-aware loading logic needs to live in DocCommandHandler. Use TDD: write characterization tests first, then refactor.
