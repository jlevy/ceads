# Feature: Terminal Design System

**Date:** 2026-01-29

**Author:** Claude with human direction

**Status:** Draft

## Overview

This plan spec establishes a comprehensive terminal design system for tbd CLI output.
The goal is to ensure all commands produce consistent, predictable output by using
reusable components that are formatted and displayed identically across different
commands.

This builds on the existing work in `plan-2026-01-17-cli-output-design-system.md` and
extends it with:
- Complete component inventory with systematic tables
- Command-by-command conformance audit
- Beads created for each command to track conformance

## Goals

- Define all reusable output components in one reference document
- Create systematic tables showing component usage across all commands
- Audit every command for design system conformance
- Create tracking beads for each command’s conformance review

## Non-Goals

- Adding new features or commands
- Changing command functionality
- Interactive prompt design (separate system)

## Background

Looking at `tbd status` and `tbd doctor` output, there are subtle inconsistencies:

**`tbd status` output:**
```
tbd v0.1.9

Repository: /Users/levy/wrk/aisw/markform
✓ Initialized (.tbd/)
✓ Git repository (claude/review-markform-spec-PqCip)
✓ Git 2.50.1

⚠ Beads directory detected alongside tbd
This may cause confusion for AI agents.
Run tbd setup beads --disable for migration options

Sync branch: tbd-sync
Remote: origin
ID prefix: mf-

INTEGRATIONS
✓ Claude Code hooks (~/.claude/settings.json)
✓ Codex AGENTS.md (./AGENTS.md)

Worktree: /Users/levy/wrk/aisw/markform/.tbd/data-sync-worktree (healthy)

Use 'tbd stats' for issue statistics, 'tbd doctor' for health checks.
```

**`tbd doctor` output:**
```
REPOSITORY
tbd v0.1.9
Repository: /Users/levy/wrk/aisw/markform
✓ Initialized (.tbd/)
✓ Git repository (claude/review-markform-spec-PqCip)

Sync branch: tbd-sync
Remote: origin
ID prefix: mf-

STATISTICS
Ready: 12
In progress: 4
Blocked: 0
Open: 12
Total: 690

INTEGRATIONS
✓ Claude Code skill (.claude/skills/tbd/SKILL.md)
✓ Codex AGENTS.md (AGENTS.md)

HEALTH CHECKS
✓ Git version - 2.50.1
...

✓ Repository is healthy
```

**Observed inconsistencies:**
1. `status` uses `bold("tbd")` with version; `doctor` has `REPOSITORY` heading first
2. `status` shows Git version inline with checkmark; `doctor` shows in health checks
3. Heading formatting differs (`INTEGRATIONS` vs no heading for similar sections)
4. Key-value formatting differs (labels dim vs.
   not)
5. Different integration checks shown (Claude Code hooks vs skill)

## Design: Reusable Output Components

### Component 1: Command Header

**When used:** At the very start of command output for orientation commands (`status`,
`doctor`, `stats`)

**Format:**
```
{COMMAND_NAME} v{VERSION}
```
Bold command name, followed by version.
Single line, no icon.

**Example:**
```
tbd v0.1.9
```

### Component 2: Section Heading

**When used:** To separate logical sections in output

**Format:**
```
{blank line}
{HEADING_TEXT}  ← ALL CAPS, bold
```

Section headings must be:
- ALL CAPS
- Bold
- Preceded by blank line (except at very start)
- Followed by content on next line (no blank line after)

**Standard Section Names:** | Section | Used In | |---------|---------| | `REPOSITORY` |
doctor | | `STATISTICS` | doctor, stats | | `INTEGRATIONS` | status, doctor | |
`HEALTH CHECKS` | doctor |

### Component 3: Diagnostic Line

**When used:** To show health checks, integration status, configuration items

**Format:**
```
{icon} {name}[ - {message}][ ({path})][ [fixable]]
```

| Part | Format | Example |
| --- | --- | --- |
| icon | `✓` green, `✗` red, `⚠` yellow, `✗` dim | `✓` |
| name | Plain text | `Git version` |
| message | After `-` | ` - 2.50.1` |
| path | Dim, in parens | `(.tbd/config.yml)` |
| fixable | Dim, suffix | `[fixable]` |

**Examples:**
```
✓ Git version - 2.50.1
✓ Config file (.tbd/config.yml)
⚠ Dependencies - 2 orphaned reference(s) [fixable]
✗ Issue validity - 2 invalid issue(s)
```

### Component 4: Key-Value Line

**When used:** For configuration and metadata display

**Format:**
```
{key}: {value}
```

- Key is dim
- Value is default color
- No extra padding or alignment

**Example:**
```
Sync branch: tbd-sync
Remote: origin
ID prefix: mf-
```

### Component 5: Statistic Block

**When used:** To show counts and statistics

**Format:**
```
{label}:{padding}{value}
```

- Labels left-aligned
- Values right-aligned to column
- 2-space minimum between label and value

**Example:**
```
Ready:       12
In progress: 4
Blocked:     0
Open:        12
Total:       690
```

### Component 6: Issue Table

**When used:** In `list`, `ready`, `blocked`, `search` commands

**Format:**
```
{HEADER ROW - dim}
{issue line 1}
{issue line 2}
...
{blank line}
{count} issue(s)
```

**Column Widths:** | Column | Width | Content | |--------|-------|---------| | ID | 12 |
Display ID, cyan | | PRI | 5 | P0-P4, colored | | STATUS | 16 | Icon + status word | |
TITLE | remaining | [kind] + title |

### Component 7: Warning Block

**When used:** For multi-line warnings that need attention

**Format:**
```
{blank line}
⚠ {headline}  ← yellow
{detail line 1}
{detail line 2}
Run {command} for ...  ← command is bold
```

**Example:**
```

⚠ Beads directory detected alongside tbd
This may cause confusion for AI agents.
Run tbd setup beads --disable for migration options
```

### Component 8: Success/Info Footer

**When used:** At end of command to suggest next steps

**Format:**
```
{blank line}
Use '{command}' for {description}, '{command}' for {description}.
```

Commands in the footer should be bold and quoted.

**Example:**
```

Use 'tbd stats' for issue statistics, 'tbd doctor' for health checks.
```

### Component 9: Summary Message

**When used:** Final status after an operation

**Format:**
```
✓ {message}  ← green success
⚠ {message}  ← yellow warning
✗ {message}  ← red error
```

**Example:**
```
✓ Repository is healthy
```

## Component Usage Matrix

| Component | status | doctor | stats | list | ready | blocked | sync | show |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Command Header | ✓* | - | - | - | - | - | - | - |
| Section Heading | ✓ | ✓ | ✓ | - | - | - | - | - |
| Diagnostic Line | ✓ | ✓ | - | - | - | - | - | - |
| Key-Value Line | ✓ | ✓ | - | - | - | - | - | - |
| Statistic Block | - | ✓ | ✓ | - | - | - | - | - |
| Issue Table | - | - | - | ✓ | ✓ | ✓ | - | - |
| Warning Block | ✓ | ✓ | - | - | - | - | - | - |
| Success/Info Footer | ✓ | ✓ | ✓ | - | - | - | - | - |
| Summary Message | - | ✓ | - | - | - | ✓ | ✓ | - |

*Note: `status` currently shows `tbd v0.1.9` but should use consistent Command Header.

## Current Conformance Issues

### status.ts Issues

1. **Missing section heading for repository info** - Shows checkmarks without section
2. **Git version shown separately** - Should be in same section as other git info
3. **Integration check differs from doctor** - Shows hooks vs skill
4. **Key-value section has no heading** - Sync branch/remote/prefix just appear
5. **Worktree shown with different format** - Uses colon format not diagnostic line

### doctor.ts Issues

1. **Mostly conformant** - Uses formatHeading(), renderDiagnostics()
2. **Repository section** - Could be more consistent with status

### stats.ts Issues

1. **Missing command header** - Doesn’t show tbd version
2. **Uses “Summary:” instead of standard heading** - Should be ALL CAPS
3. **Good statistic block format** - Properly aligned

### sync.ts Issues

1. **Good spinner usage** - Shows progress
2. **Good summary message** - Uses formatSyncSummary()

## Implementation Plan

### Phase 1: Architecture Documentation

Create `arch-cli-terminal-design-system.md` with:
- [ ] All component specifications from this plan
- [ ] Code examples for each component
- [ ] Usage guidelines (DO/DON’T)

### Phase 2: Shared Component Functions

Ensure all components have shared implementation in `cli/lib/`:

- [ ] `formatCommandHeader()` - Command name with version
- [ ] `formatSectionHeading()` - Already exists as `formatHeading()`
- [x] `renderDiagnostic()` - Already exists in `diagnostics.ts`
- [ ] `formatKeyValue()` - Key-value pair formatting
- [ ] `formatStatBlock()` - Statistics with alignment
- [ ] `formatWarningBlock()` - Multi-line warning
- [ ] `formatFooter()` - Command suggestions

### Phase 3: Command Conformance Audit

Create a bead for each command to audit and fix conformance:

| Command | Bead | Status |
| --- | --- | --- |
| status | tbd-4wr7 | open |
| doctor | tbd-sxng | open |
| stats | tbd-abvr | open |
| list | tbd-f70s | open |
| ready | tbd-0jco | open |
| blocked | tbd-2y77 | open |
| sync | tbd-qejw | open |
| show | tbd-rd08 | open |
| create | tbd-lhlh | open |
| update | tbd-inaw | open |
| close | tbd-08bf | open |
| search | To create | pending |
| setup | To create | pending |
| init | To create | pending |
| import | To create | pending |
| config | To create | pending |
| label | To create | pending |
| dep | To create | pending |
| attic | To create | pending |
| prime | To create | pending |
| shortcut | To create | pending |
| guidelines | To create | pending |
| template | To create | pending |
| skill | To create | pending |

## Testing Strategy

1. **Golden tests** - Capture expected output format for each command
2. **Visual review** - Manual check of colored output in terminal
3. **JSON mode verification** - Ensure JSON output is unaffected

## Relationship to Existing Plans

This plan extends:
- `plan-2026-01-17-cli-output-design-system.md` - Original output design system
- `plan-2026-01-26-cli-output-formatting-consistency.md` - Formatting consistency

It supersedes the command audit portions of those plans with this more systematic
approach using component-based design and per-command beads.

## Open Questions

1. Should `status` and `doctor` output be more unified since they share info?
2. Should there be a `--verbose` version of status that shows everything doctor shows?
3. Should headings use underlines or just caps+bold?

## References

- `packages/tbd/src/cli/lib/output.ts` - OutputManager and colors
- `packages/tbd/src/cli/lib/diagnostics.ts` - Diagnostic rendering
- `packages/tbd/src/cli/lib/issue-format.ts` - Issue formatting
- `packages/tbd/src/cli/commands/status.ts` - Status command
- `packages/tbd/src/cli/commands/doctor.ts` - Doctor command
