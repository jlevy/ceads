# Feature: Terminal Design System

**Date:** 2026-01-29

**Author:** Claude with human direction

**Status:** Implemented (2026-01-29)

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
✓ Claude Code hooks (./.claude/settings.json)
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

## Command Relationships and Hierarchy

Some commands are designed to subsume others, showing a superset of information.
This hierarchy should be reflected in the output design to ensure consistency.

### Subsumption Relationships

```
doctor ⊃ status ⊃ (basic info)
       ⊃ stats
       + health checks

stats ⊃ (issue statistics only)
```

| Parent Command | Subsumes | Additional Content |
| --- | --- | --- |
| `doctor` | `status` | Health checks, repair suggestions |
| `doctor` | `stats` | (statistics section) |
| `status` | (none) | Basic orientation info |

### Implication for Output

When a command subsumes another:
1. **Same sections should use identical formatting** - If `doctor` shows INTEGRATIONS,
   it must format identically to how `status` shows INTEGRATIONS
2. **Shared components must be extracted** - Both commands should call the same
   rendering function for shared sections
3. **Parent shows superset** - `doctor` should show everything `status` shows, plus more

### Current Violations

| Issue | Description |
| --- | --- |
| `status` vs `doctor` repository info | Different heading presence, different Git version placement |
| `status` vs `doctor` integrations | Different checks shown (hooks vs skill) |
| `stats` vs `doctor` statistics | Same data, but `stats` uses "Summary:" not "STATISTICS" |

### Proposed Shared Rendering Functions

To enforce subsumption consistency, extract these shared renderers:

```typescript
// In cli/lib/sections.ts

// Used by: status, doctor
renderRepositorySection(config, gitInfo, colors)

// Used by: status, doctor
renderIntegrationsSection(checks, colors)

// Used by: stats, doctor
renderStatisticsSection(stats, colors)

// Used by: doctor only
renderHealthChecksSection(checks, colors)
```

When `doctor` runs, it calls the same `renderRepositorySection()` and
`renderIntegrationsSection()` that `status` uses, ensuring identical output for those
portions.

### Command Categories

Commands fall into these output categories:

| Category | Commands | Characteristics |
| --- | --- | --- |
| **Orientation** | `status`, `doctor`, `stats` | Show system state, use section headings |
| **Listing** | `list`, `ready`, `blocked`, `search` | Issue tables with counts |
| **Detail** | `show` | Single item deep-dive |
| **Mutation** | `create`, `update`, `close`, `sync` | Action + confirmation message |
| **Setup** | `init`, `setup`, `import`, `config` | Configuration changes |
| **Documentation** | `shortcut`, `guidelines`, `template`, `skill` | Display docs/templates |

Commands in the same category should have similar output structure.

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

### Phase 1: Shared Section Rendering Functions

Create `cli/lib/sections.ts` with shared section renderers that enforce subsumption
consistency. Each function encapsulates the complete rendering logic for a section,
ensuring identical output whether called from `status`, `doctor`, or `stats`.

**File:** `packages/tbd/src/cli/lib/sections.ts`

```typescript
// Shared section data types
interface RepositorySectionData {
  version: string;
  workingDirectory: string;
  initialized: boolean;
  gitRepository: boolean;
  gitBranch: string | null;
  gitVersion: string | null;
  gitVersionSupported: boolean;
  syncBranch: string | null;
  remote: string | null;
  displayPrefix: string | null;
}

interface IntegrationCheck {
  name: string;
  installed: boolean;
  path: string;
}

interface StatisticsSectionData {
  ready: number;
  inProgress: number;
  blocked: number;
  open: number;
  total: number;
}

// Render REPOSITORY section - used by status, doctor
export function renderRepositorySection(
  data: RepositorySectionData,
  colors: ReturnType<typeof createColors>,
  options?: { showHeading?: boolean }
): void

// Render CONFIG section (sync branch, remote, prefix) - used by status, doctor
export function renderConfigSection(
  data: Pick<RepositorySectionData, 'syncBranch' | 'remote' | 'displayPrefix'>,
  colors: ReturnType<typeof createColors>
): void

// Render INTEGRATIONS section - used by status, doctor
export function renderIntegrationsSection(
  checks: IntegrationCheck[],
  colors: ReturnType<typeof createColors>
): void

// Render STATISTICS section - used by stats, doctor
export function renderStatisticsSection(
  data: StatisticsSectionData,
  colors: ReturnType<typeof createColors>
): void
```

**Implementation details:**
- Each function prints directly to console (not returns string)
- Each function uses consistent `formatHeading()` for section titles
- `renderRepositorySection()` shows: version, path, init status, git info
- `renderConfigSection()` shows: sync branch, remote, ID prefix as key-value pairs
- `renderIntegrationsSection()` shows diagnostic lines for each integration
- `renderStatisticsSection()` shows aligned stat block

### Phase 2: Component Helper Functions

Add to `cli/lib/output.ts`:

```typescript
/**
 * Format command header with version.
 * Used at start of orientation commands (status, doctor, stats).
 */
export function formatCommandHeader(
  name: string,
  version: string,
  colors: ReturnType<typeof createColors>
): string {
  return `${colors.bold(name)} v${version}`;
}

/**
 * Format key-value line with dim key.
 * Used for configuration display.
 */
export function formatKeyValue(
  key: string,
  value: string,
  colors: ReturnType<typeof createColors>
): string {
  return `${colors.dim(key + ':')} ${value}`;
}

/**
 * Format aligned statistic block.
 * @param stats - Array of {label, value} pairs
 * @param colors - Color functions
 */
export function formatStatBlock(
  stats: { label: string; value: number | string }[],
  colors: ReturnType<typeof createColors>
): string[]

/**
 * Format multi-line warning block.
 * @param headline - Warning headline (shown with ⚠ icon)
 * @param details - Detail lines
 * @param suggestion - Optional suggestion with command (bolded)
 */
export function formatWarningBlock(
  headline: string,
  details: string[],
  suggestion?: { text: string; command: string },
  colors: ReturnType<typeof createColors>
): string[]

/**
 * Format footer with command suggestions.
 * @param suggestions - Array of {command, description} pairs
 */
export function formatFooter(
  suggestions: { command: string; description: string }[],
  colors: ReturnType<typeof createColors>
): string
```

### Phase 3: Refactor Orientation Commands

Update `status.ts`, `doctor.ts`, and `stats.ts` to use shared section renderers:

**status.ts changes:**
- Import and use `renderRepositorySection()` instead of inline rendering
- Import and use `renderConfigSection()` for sync branch/remote/prefix
- Import and use `renderIntegrationsSection()` for integration checks
- Use `formatFooter()` for “Use 'tbd stats'…” line

**doctor.ts changes:**
- Import and use `renderRepositorySection()` (same output as status)
- Import and use `renderConfigSection()` (same output as status)
- Import and use `renderStatisticsSection()` for stats
- Import and use `renderIntegrationsSection()` (same checks as status)
- Keep `renderHealthChecksSection()` local (doctor-only)

**stats.ts changes:**
- Use `formatCommandHeader()` for version display
- Import and use `renderStatisticsSection()` (same output as doctor)
- Use `formatFooter()` for suggestions

## Implementation Beads

### Epic

| Issue | Title | Status |
| --- | --- | --- |
| tbd-fezd | Terminal Design System: Consistent CLI output across commands | **closed** |

### Phase 1-3: Core Implementation (Complete)

| Phase | Bead | Title | Status |
| --- | --- | --- | --- |
| 1 | tbd-4qfi | Create cli/lib/sections.ts with shared section rendering functions | **closed** |
| 2 | tbd-jslu | Add component helper functions to output.ts | **closed** |
| 3 | tbd-ua96 | Refactor status.ts to use shared section renderers | **closed** |
| 3 | tbd-mfvk | Refactor doctor.ts to use shared section renderers | **closed** |
| 3 | tbd-oqwb | Refactor stats.ts to use shared section renderers | **closed** |

### Phase 4: Testing (Complete)

| Bead | Title | Status |
| --- | --- | --- |
| tbd-kps8 | Add golden tests for terminal design system consistency | **closed** |

### Phase 5: Command Conformance Audit

Beads for orientation commands (status, doctor, stats) closed as part of core
implementation. Remaining commands can be audited incrementally.

| Command | Bead | Status |
| --- | --- | --- |
| status | tbd-4wr7 | **closed** |
| doctor | tbd-sxng | **closed** |
| stats | tbd-abvr | **closed** |
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

1. **Golden tests** (tbd-kps8) - Capture expected output format for each command
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
