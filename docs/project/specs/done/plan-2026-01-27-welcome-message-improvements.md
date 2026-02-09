# Plan Spec: Welcome Message Improvements

**Date:** 2026-01-27 **Author:** Claude **Status:** Done

## Overview

Improve the welcome/onboarding experience so that new users always see the welcome
message when tbd is newly installed for them, even if they’re joining a project where
someone else already set it up.
The welcome message should be the primary orientation when users ask for help or
orientation, not CLI usage instructions.

## Goals

- **Always welcome new users**: Show the welcome message to any user who hasn’t seen it
  yet, regardless of whether tbd was already set up in the project by someone else
- **Per-user tracking**: Track “has seen welcome” as per-user state, not project-wide
  state
- **Orientation-first experience**: When users ask for help or orientation, show the
  welcome message, not CLI commands
- **Show what’s possible**: Include a Quick Reference table in the welcome message
  covering issues, shortcuts, and guidelines so users immediately understand the variety
  of things they can ask
- **Proper gitignore handling**: Ensure user-specific state files are gitignored so
  per-user preferences don’t conflict across team members
- **Clarify config vs state**: Establish clear conventions for what goes in config
  (shared) vs state (per-user)

## Non-Goals

- Redesigning the welcome message content itself (though we may refine it)
- Changing how project-level tbd initialization works
- Adding user authentication or identity management

## Background

### Current State

The current welcome/onboarding has several related files:

1. **`.tbd/config.yml`** - Project configuration (committed to git)
   - Contains: display prefix, sync settings, docs_cache, settings
   - Currently has no per-user tracking

2. **`.tbd/state.yml`** - Per-node local state (gitignored)
   - Currently tracks: `last_sync_at`, `last_doc_sync_at`
   - Defined in `LocalStateSchema` in schemas.ts

3. **`welcome-user.md` shortcut** - Instructions for welcoming users after setup
   - Distinguishes between new vs existing installation
   - But only triggered post-setup, not for users joining existing projects

4. **`SKILL.md`** - Agent instructions
   - Tells agents how to use tbd
   - Risk: Agents may just tell users about commands instead of showing welcome

### Problem Analysis

**Scenario**: Person A sets up tbd in a repository.
Person B clones the repo later.

Current behavior:
- Person B clones the repo (`.tbd/` already exists)
- Person B runs `tbd setup --auto` (no prefix needed, detects existing setup)
- Setup says “tbd is already initialized” but doesn’t show welcome message
- Person B has no idea what tbd does or how it helps them

**The user’s message was cut off at**: “We should also consider how we’ll know that”

This likely refers to: **How we’ll know that a user is new and needs the welcome
message.**

**Per-user clarification from user**:
- Config files should possibly be gitignored (or some parts ignored)
- Welcome-seen should be a per-user setting
- If welcome hasn’t been seen, always show it
- When user asks for orientation/help, show welcome message, not CLI instructions

### Gitignore Analysis

Current `.gitignore` handling for `.tbd/`:
```
# .tbd/state.yml is gitignored (per-user timing info)
# .tbd/config.yml is committed (project settings)
# .tbd/data-sync/* is committed (issue data)
# .tbd/docs/* is committed (cached documentation)
```

**Question**: Should more of `.tbd/` be gitignored?

**Analysis**:
- `config.yml`: Should stay committed (project-wide settings like prefix, sync branch)
- `state.yml`: Already gitignored, good place for per-user state like `welcome_seen`
- `docs/`: Committed cache, could be regenerated from config but helpful to have in repo

**Recommendation**: Keep current structure.
Add `welcome_seen` to `state.yml`.

## Design

### Core Concept: Per-User Welcome Tracking

Add a `welcome_seen: boolean` field to `.tbd/state.yml` (LocalState).

This is the right location because:
1. It’s already gitignored (won’t conflict across users)
2. It’s per-machine/per-user state
3. Other timing/tracking info already lives here

**LocalState schema change**:
```typescript
export const LocalStateSchema = z.object({
  last_sync_at: Timestamp.optional(),
  last_doc_sync_at: Timestamp.optional(),
  welcome_seen: z.boolean().optional(),  // NEW
});
```

### When to Show Welcome

**Always show welcome when**:
1. `welcome_seen` is not set or false in state.yml
2. User explicitly asks for orientation/help/welcome
3. User runs a “what is this?”
   type query

**Mark as seen when**:
1. After successfully displaying the welcome message
2. User can reset by deleting state.yml or explicitly requesting welcome again

### Welcome Message Triggering

**Proactive triggers** (check and show automatically):
- `tbd setup --auto` completion (for new users joining existing projects)
- `tbd prime` when welcome_seen is false (first orientation)
- Session start hooks (if welcome not yet seen)

**On-demand triggers** (user/agent explicitly requests):
- “Show me the welcome message”
- “Help me get oriented”
- “What is tbd?”
- `tbd welcome` or `tbd shortcut welcome-user`

### Skill File Updates

Update SKILL.md to instruct agents properly:

**Current problem**: Agents may respond to “help” or “what is this?”
by explaining CLI commands.

**Desired behavior**: Agents should show the welcome message content when users ask for
orientation.

Add to SKILL.md:
```markdown
## Orientation and Help

When users ask for orientation, help getting started, or want to understand tbd:
- Run `tbd shortcut welcome-user` and follow its instructions
- Show them the welcome message content, not a list of CLI commands
- The welcome message explains tbd's value and how it helps them

DO NOT respond to "what is tbd?" or "help me get started" with just CLI commands.
Instead, give them the welcoming orientation that explains WHY tbd helps them.
```

### Welcome Message Content: Quick Reference Table

The welcome message should include a **Quick Reference Table** showing examples of what
users can say and how tbd helps.
This table is the primary way users understand tbd’s value.

**Current problem**: The existing welcome-user.md gives tips like “say 'Use beads
to...'” or “say 'Is there a shortcut for...'” — these are good but abstract.
Users don’t know what’s possible.

**Solution**: Include a curated quick reference table directly in the welcome message,
covering the three main capability areas:

| What You Can Say | What Happens |
| --- | --- |
| **Issues** |  |
| "There's a bug where..." | Creates and tracks a bug issue |
| "Let's work on current issues" | Shows ready issues to tackle |
| "Track this as a task" | Creates a task issue |
| **Shortcuts & Workflows** |  |
| "Let's plan a new feature" | Walks you through creating a planning spec |
| "Commit this code" | Reviews changes and commits properly |
| "Create a PR" | Creates PR with summary |
| "Review this for best practices" | Performs code review |
| **Guidelines** |  |
| "I'm building a TypeScript CLI" | Applies TypeScript CLI guidelines |
| "Help me set up better testing" | Applies testing guidelines |
| "What are the Python best practices?" | Applies Python guidelines |

This table is deliberately shorter than the full Quick Reference in SKILL.md/README.md.
The welcome table shows *variety* — one or two examples per category — so users
immediately grasp the range of possibilities.

**Secondary tips** (keep these after the table):
- “Say ‘Use beads to …’ and I will track everything with beads”
- “Say ‘Is there a shortcut for...?’ and I’ll look for the shortcut”

**Consistency requirement**: The welcome message table should use the same phrasing
style as the Quick Reference tables in SKILL.md and README.md.
Consider extracting a shared source or ensuring manual sync.

### Streamlined Experience for New Team Members

When someone joins a project where tbd is already set up:

1. They clone the repo (`.tbd/config.yml` exists, `.tbd/state.yml` does not)
2. They install tbd globally (`npm install -g get-tbd@latest`)
3. They run `tbd setup --auto`:
   - Detects existing config (no prefix needed)
   - Creates/updates hooks and skill files
   - Checks for `state.yml` and `welcome_seen`
   - If `welcome_seen` is missing/false → **show welcome message**
   - Sets `welcome_seen: true` in state.yml

This ensures every new team member gets the full welcome experience.

### Examples and Streamlines

**User says**: “Help me get oriented” / “What is this?”
/ “How do I use this project?”

**Agent should**:
1. Run `tbd shortcut welcome-user`
2. Follow the shortcut instructions (run `tbd status`, give welcome message)
3. NOT just list CLI commands

**User says**: “Show me how to use tbd” / “What commands does tbd have?”

**Agent should**:
1. Still lead with the welcome message value proposition
2. Then show relevant commands based on what they’re trying to do

## Implementation Plan

### Phase 0: Fix tbd Install Hook (TDD - Red then Green)

**Problem discovered**: The global tbd install hook is NOT being installed properly.

**Expected state** after `tbd setup --auto`:
```json
// ~/.claude/settings.json
{
  "hooks": {
    "SessionStart": [{ "command": "$HOME/.claude/scripts/tbd-session.sh" }],
    "PreCompact": [{ "command": "$HOME/.claude/scripts/tbd-session.sh --brief" }]
  }
}
```

**Actual state**:
- `~/.claude/scripts/` directory doesn’t exist
- `~/.claude/settings.json` has no SessionStart hook for tbd

* * *

#### Phase 0a: RED - Write Failing Tests First

Write tests that verify the expected behavior.
These tests MUST fail initially (proving the bug exists).

**Test file**: `packages/tbd/tests/setup-hooks.test.ts`

**Tests to write**:
- [ ] Test: `tbd setup --auto` creates `~/.claude/scripts/tbd-session.sh`
  - Mock HOME to temp directory
  - Run setup in a fresh git repo
  - Assert script file exists and is executable
- [ ] Test: `tbd setup --auto` adds SessionStart hook to global settings
  - Mock HOME to temp directory
  - Run setup
  - Assert `~/.claude/settings.json` contains tbd-session.sh in SessionStart
- [ ] Test: `tbd setup --auto` adds PreCompact hook to global settings
  - Assert `~/.claude/settings.json` contains tbd-session.sh in PreCompact
- [ ] Test: `tbd setup --auto` merges with existing hooks (doesn’t overwrite)
  - Pre-populate `~/.claude/settings.json` with other hooks
  - Run setup
  - Assert both existing and new hooks are present
- [ ] Test: `tbd setup claude --check` correctly reports missing hooks
  - Run check without hooks installed
  - Assert output indicates hooks not configured

**Golden file tests**:
- [ ] Golden snapshot of `tbd-session.sh` script content
- [ ] Golden snapshot of expected `~/.claude/settings.json` structure after setup

**Run tests → Confirm they FAIL** (this proves the bug)

* * *

#### Phase 0b: GREEN - Fix the Code

Once tests are failing (proving the bug), fix the implementation.

**Investigation tasks**:
- [ ] Verify `installClaudeSetup()` is being called during `tbd setup --auto`
- [ ] Check if Claude Code detection (`hasClaudeDir || hasClaudeEnv`) is failing
- [ ] Verify the hook merging logic doesn’t overwrite existing hooks incorrectly

**Fix tasks**:
- [ ] Ensure `~/.claude/scripts/tbd-session.sh` is always created
- [ ] Ensure global hooks are properly merged (not overwritten)
- [ ] Add diagnostic output to show what hooks are being installed

**Run tests → Confirm they PASS**

* * *

#### Phase 0c: REFACTOR (if needed)

- [ ] Consider making the install hook more robust (retry, better error handling)
- [ ] Consider renaming script for clarity (keep `tbd-session.sh` since it does install
  \+ prime)

**Script name clarification**:
- Current: `tbd-session.sh` (ensures tbd CLI + runs `tbd prime`)
- Keep this name since it does more than just install

### Phase 1: LocalState Schema Update

- [ ] Add `welcome_seen: z.boolean().optional()` to LocalStateSchema
- [ ] Update type exports if needed
- [ ] Add tests for the new field

### Phase 2: Welcome Tracking Logic

- [ ] Create utility functions in config.ts:
  - `hasSeenWelcome(baseDir): Promise<boolean>`
  - `markWelcomeSeen(baseDir): Promise<void>`
- [ ] Add tests for welcome tracking

### Phase 3: Setup Command Integration

- [ ] Modify `tbd setup --auto` to check welcome_seen at end
- [ ] If welcome not seen, display welcome message and mark as seen
- [ ] Works for both fresh installs and joining existing projects

### Phase 4: Prime Command Integration

- [ ] Modify `tbd prime` to check welcome_seen
- [ ] If not seen, include welcome message in output
- [ ] Mark as seen after display

### Phase 5: SKILL.md Updates

- [ ] Add “Orientation and Help” section to SKILL.md
- [ ] Instruct agents to show welcome message for orientation requests
- [ ] Clarify that CLI command lists are NOT the right response to “help”
- [ ] Update both source SKILL.md and installed copies

### Phase 6: Welcome Shortcut Content Updates

- [ ] Add Quick Reference table to welcome-user.md showing:
  - Issues: “There’s a bug...”, “Let’s work on issues”, “Track this as a task”
  - Shortcuts: “Plan a feature”, “Commit this”, “Create a PR”, “Review this”
  - Guidelines: “Building a TypeScript CLI”, “Better testing”, “Python best practices”
- [ ] Keep existing tips as secondary ("Use beads to...", “Is there a shortcut for...”)
- [ ] Ensure the table matches the phrasing style from SKILL.md/README.md Quick
  Reference
- [ ] Update for users joining existing projects (not just fresh installs)
- [ ] Consider adding a `tbd welcome` alias command

## Testing Strategy

### Unit Tests

- LocalState with welcome_seen field serialization/deserialization
- hasSeenWelcome/markWelcomeSeen utility functions

### Integration Tests

- Fresh setup shows welcome, marks seen
- Joining existing project shows welcome on first run
- Subsequent runs don’t re-show welcome
- Explicit welcome request always works

### Manual Testing Scenarios

1. **Fresh project setup**: Run `tbd setup --auto --prefix=test`, verify welcome shown
2. **Join existing project**: Clone repo with .tbd/, run `tbd setup --auto`, verify
   welcome shown
3. **Repeat run**: Run `tbd prime` again, verify welcome NOT re-shown
4. **Explicit request**: Ask “what is tbd?”, verify agent shows welcome content

## Open Questions

1. **Reset mechanism**: Should there be a way to reset welcome_seen?
   - Proposed: Delete state.yml or run `tbd welcome --force`

2. **Welcome command**: Should we add `tbd welcome` as a dedicated command?
   - Proposed: Yes, alias to `tbd shortcut welcome-user`

3. **Hook integration**: Should hooks check welcome_seen and trigger welcome?
   - Proposed: Maybe for session-start hooks, but not aggressively

4. **Welcome message refinement**: Does the current welcome-user.md content need
   updates?
   - Proposed: Review after implementation, may need to generalize for “joining” vs
     “fresh”

5. **Agent identity**: How does the system know which user is running tbd?
   - For now: Per-machine state (state.yml).
     If same machine, same user assumed.
   - Future: Could integrate with git user.email if needed

6. **Quick Reference table synchronization**: We now have similar tables in:
   - SKILL.md (full reference for agents)
   - README.md (full reference for humans)
   - welcome-user.md (curated subset for onboarding)
   - Should these be generated from a single source?
     Or manually kept in sync?
   - Proposed: Start with manual sync; the welcome table is intentionally
     smaller/different

## References

- [plan-2026-01-25-agent-orientation-experience.md](plan-2026-01-25-agent-orientation-experience.md)
  \- Related orientation improvements
- [.tbd/config.yml](../../../.tbd/config.yml) - Current config structure
- [packages/tbd/src/file/config.ts](../../../packages/tbd/src/file/config.ts) - Config
  and LocalState implementation
- [packages/tbd/src/lib/schemas.ts](../../../packages/tbd/src/lib/schemas.ts) -
  LocalStateSchema definition
