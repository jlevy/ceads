---
close_reason: "Implemented: doctor now shows paths for config file, issues directory, temp files, and Claude skill file checks"
closed_at: 2026-01-18T03:09:34.495Z
created_at: 2026-01-18T03:02:19.295Z
dependencies: []
id: is-01kf7gvbx0kztdh2211fcqzgms
kind: task
labels: []
priority: 1
status: closed
title: tbd doctor should show paths for all checks
type: is
updated_at: 2026-01-18T03:09:34.496Z
version: 3
---
Currently tbd doctor just shows checkmarks without details. It should show the exact paths verified for each check. For example:

Current:
✓ Config file
✓ Claude Code skill

Should be:
✓ Config file (.tbd/config.yml)
✓ Claude Code skill (.claude/skills/tbd/SKILL.md)

When checks fail, show what path was expected but not found.
