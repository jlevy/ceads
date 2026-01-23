---
close_reason: "Implemented: DocCache has get() for exact matching and list() for listing all docs, including shadow support"
closed_at: 2026-01-23T02:43:26.624Z
created_at: 2026-01-22T03:29:34.742Z
dependencies:
  - target: is-01kfhw0ahez8ke820ykd7ste85
    type: blocks
  - target: is-01kfhw0ffz5dt50b37cffpqrbg
    type: blocks
  - target: is-01kfhw0wgptnbr3vkg9qrcjg0c
    type: blocks
  - target: is-01kfhvzn1vbsam9xckr0njfbqg
    type: blocks
id: is-01kfhw050qe2egpxfzhec80ddg
kind: task
labels: []
priority: 1
status: closed
title: Implement DocCache get() and list() methods
type: is
updated_at: 2026-01-23T02:43:26.625Z
version: 7
---
Implement DocCache methods: load() using existing parseFrontmatter() from parser.ts, get(name) for exact filename matching (with/without .md), list(includeAll) returning active or all docs including shadowed, and isShadowed() helper. Track seenNames for shadowing detection.
