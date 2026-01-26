---
close_reason: Major hardcoded content removed. Review complete.
closed_at: 2026-01-26T17:24:23.111Z
created_at: 2026-01-18T08:31:38.365Z
dependencies: []
id: is-01kf83pbvy6sshh30vtm3qbcd0
kind: task
labels: []
priority: 3
status: closed
title: Review and remove remaining hardcoded content in setup commands
type: is
updated_at: 2026-01-26T17:24:23.112Z
version: 3
---
## Notes

After the refactoring to use SKILL.md as single source of truth, review setup.ts for any remaining hardcoded content. The following are now dynamically loaded from SKILL.md: Cursor rules content, Codex AGENTS.md tbd section. Check if there are other hardcoded instructions or patterns that should come from a central source.
