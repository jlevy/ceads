# Plan Spec: Beads Migration and Integration Setup

**Status:** Done

## Purpose

This is a technical design doc for improving the migration path from Beads to tbd and
streamlining the Claude Code integration setup process.

## Background

**Current State:**

tbd has working migration and integration features:
- `tbd import --from-beads` - Import issues from Beads
- `tbd setup claude` - Install Claude Code hooks (global ~/.claude/settings.json)
- `tbd setup cursor` - Create Cursor IDE rules
- `tbd setup codex` - Create/update AGENTS.md

**Problems Identified:**

1. **No safe Beads disable**: Users migrating from Beads want to preserve data while
   preventing accidental Beads usage.
   Currently they must manually rename/delete files.

2. **Partial migration**: After import, Beads files remain active and can conflict with
   tbd. Claude Code hooks may still call `bd prime` instead of `tbd prime`.

3. **Documentation gap**: The `--global` flag was documented but not implemented in
   `tbd setup claude` (fixed in this work).

**Reference Documentation:**

- [beads.ts](packages/tbd/src/cli/commands/beads.ts) - New beads command
- [setup.ts](packages/tbd/src/cli/commands/setup.ts) - Setup commands
- [import.ts](packages/tbd/src/cli/commands/import.ts) - Import command
- [tbd-design.md](docs/tbd-design.md) - Overall product design
- [Beads uninstall gist](https://gist.github.com/banteg/1a539b88b3c8945cd71e4b958f319d8d)
  \- Reference for Beads file locations

## Summary of Task

Implement safe Beads migration workflow:

1. **`tbd setup beads --disable`** - Move Beads files to `.beads-disabled/` for safe
   deactivation
2. **Documentation updates** - Fix incorrect `--global` flag reference
3. **Integration verification** - Ensure `tbd setup claude` properly replaces old hooks

## Backward Compatibility

### CLI Compatibility

| Area | Compatibility Level | Notes |
| --- | --- | --- |
| `tbd import --from-beads` | Maintain | Existing import continues to work |
| `tbd setup claude` | Maintain | Existing behavior preserved |
| New `tbd setup beads` command | Additive | New command, no breaking changes |

### Breaking Changes

- None - this is a new additive feature

* * *

## Stage 1: Planning Stage

### 1.1 Scope Definition

**In Scope:**

- [x] `tbd setup beads --disable` command to safely deactivate Beads
- [x] Move Beads files to `.beads-disabled/` directory (preserves for rollback)
- [x] Handle: `.beads/`, `.beads-hooks/`, `.cursor/rules/beads.mdc`
- [x] Handle: Claude Code project hooks with `bd` commands
- [x] Handle: AGENTS.md Beads section
- [x] Fix documentation bug (`--global` flag reference)
- [ ] Test the command with actual Beads data

**Out of Scope:**

- Gemini integration (future work)
- Aider integration (future work)
- Automatic import during disable (user runs import separately)
- Remote/global Beads cleanup (only handles current repository)

### 1.2 Success Criteria

- [x] `tbd setup beads --disable` shows preview of what will be moved
- [x] `tbd setup beads --disable --confirm` moves files to `.beads-disabled/`
- [x] Preserves all Beads data for potential rollback
- [x] Removes bd hooks from `.claude/settings.local.json`
- [x] Removes Beads section from AGENTS.md (with backup)
- [ ] Tests pass
- [ ] Documentation updated

### 1.3 Files Handled by `tbd setup beads --disable`

| Source | Destination | Description |
| --- | --- | --- |
| `.beads/` | `.beads-disabled/beads/` | Beads data directory |
| `.beads-hooks/` | `.beads-disabled/beads-hooks/` | Beads git hooks |
| `.cursor/rules/beads.mdc` | `.beads-disabled/cursor-rules-beads.mdc` | Cursor IDE rules |
| `.claude/settings.local.json` | `.beads-disabled/claude-settings.local.json` | Backup before removing bd hooks |
| `AGENTS.md` | `.beads-disabled/AGENTS.md.backup` | Backup before removing Beads section |

* * *

## Stage 2: Architecture Stage

### 2.1 Command Design

```
tbd setup beads --disable [--confirm]
```

**Behavior:**
1. Scan for Beads files in current repository
2. Show what will be moved to `.beads-disabled/`
3. Without `--confirm`: show preview and instructions
4. With `--confirm`: perform the move operations

**Pattern:** Mirrors `tbd uninstall --confirm` approach - safe by default.

### 2.2 Implementation Location

New file: `packages/tbd/src/cli/commands/beads.ts`

Registered in: `packages/tbd/src/cli/cli.ts` under Maintenance group

### 2.3 Migration Workflow

Complete migration from Beads to tbd:

```bash
# 1. Import issues (optional, if you want to keep history)
tbd import --from-beads

# 2. Disable Beads (moves files to .beads-disabled/)
tbd setup beads --disable --confirm

# 3. Install tbd integrations
tbd setup claude   # Global Claude Code hooks
tbd setup cursor   # Cursor IDE rules (optional)
tbd setup codex    # AGENTS.md section (optional)
```

* * *

## Stage 3: Implementation Stage

### Phase 1: Core Implementation

- [x] Create `beads.ts` command file
- [x] Implement `BeadsDisableHandler` class
- [x] Add directory/file detection logic
- [x] Add Claude hooks detection (`.claude/settings.local.json`)
- [x] Add AGENTS.md Beads section detection
- [x] Implement move operations with backup
- [x] Register command in `cli.ts`
- [x] Build and basic test

### Phase 2: Documentation and Testing

- [x] Fix `--global` flag documentation bug in `tbd-docs.md`
- [ ] Create tryscript test `cli-beads.tryscript.md`
- [ ] Update tbd-docs.md with `tbd setup beads` command
- [ ] Update tbd-design.md migration section

### Phase 3: Validation

- [ ] Test with actual Beads repository
- [ ] Verify rollback works (move files back from `.beads-disabled/`)
- [ ] Verify Claude hooks properly updated
- [ ] Verify AGENTS.md properly cleaned

* * *

## Stage 4: Validation Stage

### Test Plan

1. **Unit test**: Command shows correct preview
2. **Integration test**: Files actually moved to correct locations
3. **Rollback test**: Moving files back restores Beads functionality
4. **Hook removal test**: Claude settings properly updated
5. **AGENTS.md test**: Section properly removed with backup

### Acceptance Criteria

- [ ] `tbd setup beads` shows usage help
- [ ] `tbd setup beads --disable` shows preview without modifying files
- [ ] `tbd setup beads --disable --confirm` moves all Beads files
- [ ] `.beads-disabled/` contains all backup files
- [ ] bd hooks removed from `.claude/settings.local.json`
- [ ] Beads section removed from AGENTS.md
- [ ] Documentation is accurate

* * *

## Open Questions

1. **Should `tbd import --from-beads` automatically suggest running
   `tbd setup beads --disable`?**
   - Current: No, commands are independent
   - Could add a hint in import output

2. **Should we add `tbd beads --enable` to restore from backup?**
   - Current: Manual restoration documented
   - Could be added as future enhancement

## References

- [Beads uninstall script](https://gist.github.com/banteg/1a539b88b3c8945cd71e4b958f319d8d)
  \- Comprehensive list of Beads file locations
- [tbd-design.md](docs/tbd-design.md) - Migration section
