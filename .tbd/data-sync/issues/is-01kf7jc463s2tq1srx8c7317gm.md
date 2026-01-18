---
close_reason: Already implemented in setup.ts. Added documentation to tbd-full-design.md and tbd-design.md
closed_at: 2026-01-18T03:51:46.966Z
created_at: 2026-01-18T03:28:57.011Z
dependencies: []
id: is-01kf7jc463s2tq1srx8c7317gm
kind: task
labels: []
priority: 1
status: closed
title: Add .gitattributes handling to tbd setup beads --disable
type: is
updated_at: 2026-01-18T03:51:46.967Z
version: 3
---
The `tbd setup beads --disable` command is missing handling for `.gitattributes` which contains beads merge driver configuration:

```
# Use bd merge for beads JSONL files
.beads/issues.jsonl merge=beads
```

## Current State

The command handles:
- ✅ `.beads/` directory
- ✅ `.beads-hooks/` directory  
- ✅ `.cursor/rules/beads.mdc`
- ✅ `.claude/settings.local.json` (removes bd hooks)
- ✅ `AGENTS.md` (removes beads section)
- ❌ `.gitattributes` (beads merge driver lines)

## Required Changes

1. **setup.ts**: Add `.gitattributes` handling to `SetupBeadsHandler`:
   - Detect lines containing `merge=beads` or `.beads/` references
   - Back up original file to `.beads-disabled/gitattributes.backup`
   - Remove only beads-related lines (preserve other rules)

2. **Documentation**: Update design docs to document this:
   - `docs/project/architecture/current/tbd-full-design.md` - Section 5 (Beads Compatibility)
   - `docs/tbd-design.md` - Migration Path section

## Acceptance Criteria

- [ ] `tbd setup beads --disable` detects and removes beads lines from `.gitattributes`
- [ ] Original `.gitattributes` backed up to `.beads-disabled/`
- [ ] RESTORE.md includes instructions for restoring `.gitattributes`
- [ ] Design docs updated with complete list of files handled
