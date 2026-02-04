---
title: Change tbd No-Args Default to Help
description: Change `tbd` with no arguments to show help instead of prime, with prominent agent guidance
author: Joshua Levy (github.com/jlevy) with LLM assistance
---
# Feature: Change tbd No-Args Default Behavior

**Date:** 2026-02-03

**Author:** Joshua Levy

**Status:** Implemented

## Overview

Change the default behavior of `tbd` (no arguments) from running `tbd prime` to showing
`tbd --help`. This makes the CLI feel more familiar to users and agents while reducing
accidental context usage.
A prominent epilogue guides agents to run `tbd prime` for full context.

## Goals

- Make `tbd` (no args) behave like a standard CLI by showing help
- Reduce context waste when agents accidentally run `tbd` without arguments
- Provide prominent guidance for agents to run `tbd prime` for full orientation
- Ensure all documentation is consistent with this change
- Clarify that `tbd setup --auto` is idempotent and safe to run any time

## Non-Goals

- Changing the actual `tbd prime` command or its content
- Changing the hook behavior (hooks call `tbd prime` explicitly)

## Background

Currently, `tbd` with no arguments runs `tbd prime`, which outputs extensive workflow
context (~250 lines).
This was intended to be helpful for agents, but:

1. **Uncomfortable for humans**: Standard CLI behavior is to show help, not dump large
   output
2. **Context waste**: If an agent runs `tbd` by accident or to check syntax, it consumes
   significant context window
3. **Inconsistent UX**: Doesn’t match expectations from other CLIs

The proposed change makes `tbd` feel familiar while still guiding agents to the right
command for orientation.

## Design

### Approach

1. **Remove default-to-prime logic**: In `cli.ts`, remove the code that inserts `prime`
   when no command is given
2. **Update help epilog**: Add a prominent “IMPORTANT” message for agents directing them
   to `tbd prime`
3. **Update documentation**: Ensure all docs consistently describe the new behavior

### Current Implementation (cli.ts:247-261)

```typescript
// If no command specified (and not help/version), run prime by default
const isHelpOrVersion =
  process.argv.includes('--help') ||
  process.argv.includes('-h') ||
  process.argv.includes('--version') ||
  process.argv.includes('-V');

if (hasNoCommand() && !isHelpOrVersion) {
  // Insert 'prime' as the command
  process.argv.splice(2, 0, 'prime');
}
```

### New Implementation

Simply remove the default-to-prime logic.
Commander.js will show help by default when no command is given.

### New Help Epilog

Update `createHelpEpilog()` in `output.ts` to add:

```
IMPORTANT: Agents unfamiliar with tbd should run `tbd prime` now for full workflow
context.

To set up or refresh tbd (idempotent, safe to run anytime):
  tbd setup --auto
```

## Implementation Plan

### Phase 1: CLI and Doc Changes

- [x] Remove default-to-prime code in `cli.ts`
- [x] Update `createHelpEpilog()` in `output.ts` with prominent agent guidance
- [x] Update `tbd-prime.md` to clarify `tbd setup --auto` is idempotent
- [x] Update `SKILL.md` (both locations) to reference `tbd --help` and `tbd prime`
  correctly
- [x] Update `README.md` (both root and packages/tbd) if they reference no-args behavior
- [x] Update `tbd-docs.md` and `tbd-design.md` if they reference no-args behavior
- [x] Review and update any other docs that mention running `tbd` without arguments
- [x] Update relevant test files (`cli-prime.tryscript.md`, etc.)

## Testing Strategy

1. Manual testing:
   - `tbd` → shows help with prominent agent epilog
   - `tbd --help` → shows same help output
   - `tbd prime` → shows full workflow context (unchanged)
   - `tbd setup --auto` → idempotent setup works

2. Verify no tests rely on `tbd` defaulting to prime behavior

## Rollout Plan

Single commit with all changes.
Non-breaking for existing workflows since:
- Hooks already call `tbd prime` explicitly
- All documentation directs agents to specific commands

## Open Questions

None - design is straightforward.

## References

- [cli.ts](packages/tbd/src/cli/cli.ts) - Main CLI entry point
- [output.ts](packages/tbd/src/cli/lib/output.ts) - Help epilog function
- [SKILL.md](.claude/skills/tbd/SKILL.md) - Agent skill file
- [tbd-prime.md](packages/tbd/docs/tbd-prime.md) - Prime command documentation
