---
created_at: 2026-01-18T07:48:51.079Z
dependencies: []
id: is-01kf8180r77abr20pjpnzr7t2f
kind: task
labels: []
parent_id: is-01kf817cfba3htpetxgesej8hx
priority: 2
status: open
title: Document all merge strategies completely
type: is
updated_at: 2026-01-18T07:48:51.079Z
version: 1
---
tbd-design.md only shows 3 merge strategies (LWW, Union, Immutable) but the spec defines more: lww_with_attic, merge_by_id, max_plus_one, recalculate, preserve_oldest, deep_merge_by_key. Need to either add these or note they exist with reference to full spec.
