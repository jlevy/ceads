---
close_reason: "Fixed: dep add now uses 'issue depends on depends-on' semantics. Message updated to 'X now depends on Y'"
closed_at: 2026-01-18T04:06:48.978Z
created_at: 2026-01-17T23:55:59.510Z
dependencies: []
id: is-01kf76664st5tb1eahc5ewct9j
kind: bug
labels: []
priority: 2
status: closed
title: "Bug: Dependency direction semantics confusing"
type: is
updated_at: 2026-01-18T04:06:48.979Z
version: 3
---
The dep add command semantics are inverted. Users expect 'dep add A B' to mean A depends on B, but current behavior means A blocks B. Fix options: change semantics, add flags, or improve docs.
