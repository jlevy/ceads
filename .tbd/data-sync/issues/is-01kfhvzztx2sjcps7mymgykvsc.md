---
created_at: 2026-01-22T03:29:29.436Z
dependencies:
  - target: is-01kfhw050qe2egpxfzhec80ddg
    type: blocks
id: is-01kfhvzztx2sjcps7mymgykvsc
kind: task
labels: []
priority: 1
status: open
title: Create DocCache class with load() method
type: is
updated_at: 2026-01-22T03:31:11.603Z
version: 2
---
Create packages/tbd/src/lib/doc-cache.ts with DocCache class. Implement constructor accepting ordered array of directory paths, and load() method that scans directories and parses markdown files with gray-matter for frontmatter. Use eager loading. Track both active docs (first occurrence by name) and all docs (including shadowed).
