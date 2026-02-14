---
created_at: 2026-02-09T00:40:37.902Z
dependencies:
  - target: is-01kgzxftzt59ardkfx9k3wj145
    type: blocks
id: is-01kgzxfqrfxmt6pcdnw1t8vem6
kind: task
labels: []
parent_id: is-01kgzxe3p3qc7m2zxz0ga530vy
priority: 2
spec_path: docs/project/specs/active/plan-2026-02-02-external-docs-repos.md
status: open
title: "GREEN: Move shortcut-specific behavior to DocCommandHandler overrides"
type: is
updated_at: 2026-02-09T01:51:03.445Z
version: 4
---
TDD Step 2b (Green): Move shortcut-specific behavior into DocCommandHandler overrides. ShortcutHandler overrides: (1) getAgentHeader() returns SHORTCUT_AGENT_HEADER, (2) handleListWithCategory() for --category filtering with ShortcutCategory type, (3) handleRefresh() for backward compat no-op. The base DocCommandHandler already handles --list, --add, query, no-query. Tests must still pass.
