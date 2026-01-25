---
close_reason: null
closed_at: 2026-01-25T17:26:47.985Z
created_at: 2026-01-25T17:17:17.648Z
dependencies:
  - target: is-01kfv2jp1rd4b9sgfpgvqt9pw1
    type: blocks
  - target: is-01kfv2jy2gj2nnbct7vt46rqjt
    type: blocks
  - target: is-01kfv2m19gxrg8vbjps5m7t1cj
    type: blocks
id: is-01kfv2hwyh8g0namvvastjprj9
kind: task
labels: []
parent_id: is-01kfv2he1c3hct3c07gv0edh90
priority: 2
status: closed
title: Create ensureGitignorePatterns() edit function
type: is
updated_at: 2026-01-25T17:26:47.985Z
version: 5
---
Implement the idempotent edit function that ensures patterns exist in a .gitignore file.

Behavior:
- Creates file if missing
- Appends only missing patterns (uses hasGitignorePattern for detection)
- Always uses atomic write via atomically.writeFile()
- Preserves existing user patterns
- Optional header comment for new patterns section

Returns: { added: string[], skipped: string[], created: boolean }

File: packages/tbd/src/utils/gitignore-utils.ts
