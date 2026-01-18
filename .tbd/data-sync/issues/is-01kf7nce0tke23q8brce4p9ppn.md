---
created_at: 2026-01-18T04:21:32.825Z
dependencies:
  - target: is-01kf7nbezdmr4qwytemnz1mf20
    type: blocks
id: is-01kf7nce0tke23q8brce4p9ppn
kind: task
labels: []
priority: 2
status: open
title: "Setup codex --check: Show full AGENTS.md path"
type: is
updated_at: 2026-01-18T04:26:03.841Z
version: 2
---
The `tbd setup codex --check` command should show the full file path being checked.

**Current behavior:**
```
⚠ AGENTS.md exists but no tbd section found
  Run: tbd setup codex (to add tbd section)
```

or:
```
AGENTS.md not found
  Run: tbd setup codex
```

**Expected behavior:**
```
⚠ AGENTS.md exists but no tbd section found (./AGENTS.md)
  Run: tbd setup codex
```

or:
```
✗ AGENTS.md not found
    Expected: ./AGENTS.md
    Run: tbd setup codex
```

**Implementation:**
- Update checkCodexSetup() to include path in all output messages
- Use consistent format with other diagnostic commands
