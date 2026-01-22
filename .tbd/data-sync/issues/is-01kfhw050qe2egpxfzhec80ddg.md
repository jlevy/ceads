---
created_at: 2026-01-22T03:29:34.742Z
dependencies:
  - target: is-01kfhw0ahez8ke820ykd7ste85
    type: blocks
  - target: is-01kfhw0ffz5dt50b37cffpqrbg
    type: blocks
  - target: is-01kfhw0wgptnbr3vkg9qrcjg0c
    type: blocks
id: is-01kfhw050qe2egpxfzhec80ddg
kind: task
labels: []
priority: 1
status: open
title: Implement DocCache get() and list() methods
type: is
updated_at: 2026-01-22T03:31:18.303Z
version: 4
---
Implement get(name) method for exact filename matching (with/without .md extension, stripping shortcut- prefix). Implement list(includeAll) method to return active documents or all including shadowed. Implement isShadowed() helper.
