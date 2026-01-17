---
created_at: 2026-01-17T23:39:35.527Z
dependencies: []
id: is-01kf758578sxfk68eg8yb8c0ys
kind: chore
labels: []
priority: 3
status: open
title: "Remove dead code: hash.ts content hashing functions are unused"
type: is
updated_at: 2026-01-17T23:39:35.527Z
version: 1
---
The file packages/tbd-cli/src/file/hash.ts defines computeContentHash() and canonicalizeForHash() but these are never called anywhere in the codebase. Either remove the dead code or document why it's being kept for future use.
