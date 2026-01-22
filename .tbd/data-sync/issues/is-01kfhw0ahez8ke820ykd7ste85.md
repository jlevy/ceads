---
created_at: 2026-01-22T03:29:40.397Z
dependencies: []
id: is-01kfhw0ahez8ke820ykd7ste85
kind: task
labels: []
priority: 1
status: open
title: Add unit tests for DocCache
type: is
updated_at: 2026-01-22T03:29:40.397Z
version: 1
---
Create tests/lib/doc-cache.test.ts with tests for: loading markdown files from multiple paths, path priority (earlier paths take precedence), exact matching by filename with/without .md, shortcut- prefix stripping, list() with and without shadowed docs, isShadowed() detection.
