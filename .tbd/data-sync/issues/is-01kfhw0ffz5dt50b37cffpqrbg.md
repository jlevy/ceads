---
created_at: 2026-01-22T03:29:45.470Z
dependencies:
  - target: is-01kfhw0kk478en1ytceyj3z1mh
    type: blocks
id: is-01kfhw0ffz5dt50b37cffpqrbg
kind: task
labels: []
priority: 2
status: open
title: Implement simple scoring algorithm for fuzzy matching
type: is
updated_at: 2026-01-22T03:31:17.896Z
version: 2
---
Implement scoring in DocCache: exact filename match = 1.0, prefix match = 0.9, contains all query words = 0.8, contains some query words = 0.7 × (matched/total). No external library needed initially. Score against filename, title, and description from frontmatter.
