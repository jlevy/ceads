# Plan Spec: CLI Output Design System Review

## Purpose

This is a technical design doc for systematically reviewing and standardizing all CLI
output across tbd. The goal is to establish a universal CLI design system that ensures
consistent output structure, formatting, colors, and conventions across all commands and
output modes.

## Background

**Current State:**

tbd has a functional CLI output system built on:
- `OutputManager` class in [output.ts](packages/tbd-cli/src/cli/lib/output.ts)
- `CommandContext` with modes: `verbose`, `debug`, `quiet`, `json`
- Color support via `picocolors` with `--color=auto|always|never`
- Markdown rendering via `marked-terminal`

**Why This Matters:**

1. **Agent ergonomics**: Agents parse CLI output; consistent formatting improves
   reliability
2. **User experience**: Predictable output patterns reduce cognitive load
3. **Debugging**: Clear verbose/debug output hierarchy aids troubleshooting
4. **Maintainability**: Design system prevents ad-hoc decisions across commands

**Reference Documentation:**

- [output.ts](packages/tbd-cli/src/cli/lib/output.ts) - Current OutputManager
- [context.ts](packages/tbd-cli/src/cli/lib/context.ts) - Command context and modes
- [errors.ts](packages/tbd-cli/src/cli/lib/errors.ts) - Error types
- [tbd-design.md](docs/tbd-design.md) - Overall product design

## Summary of Task

Create a comprehensive CLI UI design system that:

1. **Documents all output categories** and when each should be used
2. **Standardizes color semantics** across all output types
3. **Defines verbose vs debug mode** boundaries clearly
4. **Establishes formatting conventions** for tables, lists, IDs, etc.
5. **Creates guidelines** for error messages, success messages, and progress
6. **Reviews existing commands** for compliance and fixes inconsistencies

## Subtasks for Implementation

Each subtask below is designed to be a separate issue/bead:

**Phase 2: OutputManager Enhancements**
1. ✓ tbd-euve: OutputManager output level methods (notice, warn, info, debug, command)
2. ✓ tbd-a93c: OutputManager helper methods (table, list, count)
3. ✓ tbd-0kg0: Define icon constants (success, error, warning, notice, status icons)
4. ✓ tbd-fahh: Create priority utilities (`lib/priority.ts`)
5. ✓ tbd-rp61: Create status utilities (`lib/status.ts`)
6. ✓ tbd-0mrt: Create truncation utility (`lib/truncate.ts`)
7. ✓ tbd-51bx: Create issue formatting utilities (`cli/lib/issueFormat.ts`)
8. tbd-4pxv: Add `--long` flag to commands (list, ready, blocked)
9. tbd-y0a1: Migrate commands to use formatPriority/formatStatus
10. tbd-lss5: Migrate commands to use issue formatting utilities

**Phase 3: Sync Output Improvements**
11. ✓ tbd-2tuo: Implement sync progress indicator
12. tbd-gr1e: Implement sync summary tallies
13. tbd-4z1q: Debug mode git log output

**Phase 4: Command Audit**
14. tbd-ar25: Audit commands for design system compliance

**Phase 5: Testing**
15. tbd-b7b0: Output mode testing
16. tbd-jgwp: Message format testing

## Backward Compatibility

### CLI Output Compatibility

| Area | Compatibility Level | Notes |
| --- | --- | --- |
| JSON output | Must maintain | Agent scripts may parse JSON output |
| Exit codes | Must maintain | 0=success, 1=error, 2=usage |
| Success message format | Can evolve | May standardize prefix/suffix |
| Color usage | Can evolve | Visual only, no semantic change |

### Breaking Changes

- None expected - this is standardization, not API change

* * *

## Stage 1: Planning Stage

### 1.1 Scope Definition

**In Scope:**

- Audit all existing output patterns across commands
- Document output categories (success, error, warn, info, debug, data)
- Standardize color semantics and usage
- Define verbose vs debug mode behaviors
- Establish formatting conventions (tables, lists, IDs, timestamps)
- Create architecture doc as design system reference
- Fix inconsistencies in existing commands

**Out of Scope:**

- Interactive prompts (separate design system)
- Help text formatting (handled by Commander.js)
- Internationalization/localization
- Accessibility beyond basic color contrast

### 1.2 Success Criteria

- [ ] Architecture doc `arch-cli-interface-design-system.md` created and approved
- [ ] All output categories documented with examples
- [ ] Color semantics standardized and documented
- [ ] Verbose/debug mode behaviors clearly defined
- [ ] Existing commands audited for compliance
- [ ] Inconsistencies identified and fixed

### 1.3 Current State Analysis

#### Output Categories Found

| Category | Method | Destination | When Shown |
| --- | --- | --- | --- |
| Data | `output.data()` | stdout | Always (text or JSON) |
| Success | `output.success()` | stdout | Not in JSON/quiet |
| Info | `output.info()` | stdout | Not in JSON/quiet |
| Warning | `output.warn()` | stderr | Always |
| Error | `output.error()` | stderr | Always |
| Debug | `output.debug()` | stderr | Only in verbose/debug |
| Command | `output.command()` | stderr | Only in verbose mode |
| Dry-run | `output.dryRun()` | stdout | Only in dry-run mode |

#### Color Semantics Found

| Color | Semantic | Current Usage |
| --- | --- | --- |
| Green | Success | `success()`, `in_progress` status |
| Red | Error | `error()`, `blocked` status, P0 priority |
| Yellow | Warning | `warn()`, `dryRun()`, P1 priority |
| Blue | Info | `info()`, paths |
| Cyan | IDs | Issue IDs, references |
| Magenta | Labels | Label names |
| Dim | Secondary | Debug messages, closed status, metadata |
| Bold | Emphasis | Titles, headers |

#### Inconsistencies Identified

1. **Status colors**: `getStatusColor()` duplicated in `list.ts` and `show.ts`
2. **Debug output**: Some commands use `console.error()` directly instead of
   `output.debug()`
3. **Table formatting**: No standard table renderer; ad-hoc padding in each command
4. **ID display**: Mix of internal and display IDs without clear convention
5. **Empty state messages**: Inconsistent wording ("No issues found" vs “No results”)
6. **Count suffixes**: Mix of “issue(s)” and “issues” pluralization
7. **Priority display**: Raw numbers (0, 1, 2) instead of P0, P1, P2 format
8. **Icon usage**: Need to verify consistent use of ✓/✗/⚠ across all commands
9. **Sync feedback**: No immediate progress indicator when sync starts
10. **Sync summaries**: “pulled/pushed” counts unclear (should show new/updated/deleted)

* * *

## Stage 2: Architecture Stage

### 2.1 Output Mode Hierarchy

```
┌─────────────────────────────────────────────────────────────────┐
│  --quiet              Only errors + data (nothing else)         │
├─────────────────────────────────────────────────────────────────┤
│  (default)            + warnings, notices, success messages     │
├─────────────────────────────────────────────────────────────────┤
│  --verbose            + info messages (operations, progress)    │
├─────────────────────────────────────────────────────────────────┤
│  --debug              + debug messages (internal state, IDs)    │
└─────────────────────────────────────────────────────────────────┘

--json mode: Data as JSON, warnings/errors as JSON to stderr
```

### 2.1.1 Output Level Definitions and Formatting

Each output level has a specific icon, color, prefix format, and channel:

| Level | Icon | Color | Prefix | Channel | Purpose |
| --- | --- | --- | --- | --- | --- |
| **error** | `✗` | Red | `✗ {message}` | stderr | Failures that stop operation |
| **warning** | `⚠` | Yellow | `⚠ {message}` | stderr | Issues that didn't stop operation |
| **notice** | `•` | Blue | `• {message}` | stdout | Noteworthy events during normal operation |
| **success** | `✓` | Green | `✓ {message}` | stdout | Confirmation of completed actions |
| **info** | (none) | Dim | `{message}` | stderr | Operational progress (verbose only) |
| **command** | `>` | Dim | `> {command}` | stderr | External commands being run (verbose only) |
| **debug** | (none) | Dim | `[debug] {message}` | stderr | Internal state (debug only) |
| **data** | (none) | (varies) | (none) | stdout | Primary output (tables, details) |

**Exact appearance examples:**

```
✗ Issue not found: bd-xyz                    # error - red
⚠ Remote branch not found                    # warning - yellow
• Issue doesn't exist remotely - kept local  # notice - blue
✓ Created issue bd-a1b2                      # success - green
Syncing with remote...                       # info - dim (verbose only)
> git fetch origin tbd-sync                  # command - dim (verbose only)
[debug] Resolved bd-a1b2 → is-01hx...        # debug - dim (debug only)
```

**Icon rules:**

- `✓` (U+2713) - Success only, always green
- `✗` (U+2717) - Error only, always red
- `⚠` (U+26A0) - Warning only, always yellow
- `•` (U+2022) - Notice only, always blue
- `>` - Command prefix only, always dim
- Never use alternative characters (`✔`, `√`, `×`, `!`, etc.)
- Icon always followed by single space before message

### 2.1.2 Level Visibility Matrix

| Level | Method | Channel | `--quiet` | Default | `--verbose` | `--debug` |
| --- | --- | --- | --- | --- | --- | --- |
| error | `error()` | stderr | ✓ | ✓ | ✓ | ✓ |
| data | `data()` | stdout | ✓ | ✓ | ✓ | ✓ |
| warning | `warn()` | stderr | — | ✓ | ✓ | ✓ |
| notice | `notice()` | stdout | — | ✓ | ✓ | ✓ |
| success | `success()` | stdout | — | ✓ | ✓ | ✓ |
| info | `info()` | stderr | — | — | ✓ | ✓ |
| command | `command()` | stderr | — | — | ✓ | ✓ |
| debug | `debug()` | stderr | — | — | — | ✓ |

**Key design decisions:**

1. **`--quiet` suppresses warnings** - Only errors and data are truly critical
2. **`notice` is a new level** - For noteworthy-but-not-warning events shown at default
3. **`info` requires `--verbose`** - Operational progress is opt-in, not default
4. **`debug` requires `--debug`** - Currently shows with `--verbose` too; should be
   separate

### 2.2 Output Channel Rules

| Output Type | Channel | Format | Example |
| --- | --- | --- | --- |
| Primary data | stdout | Text or JSON | Issue lists, show output |
| Success confirmation | stdout | Prefixed text | `✓ Created issue bd-a1b2` |
| Informational | stdout | Plain text | "Syncing with remote..." |
| Warning | stderr | Prefixed text | `⚠ Remote branch not found` |
| Error | stderr | Prefixed text | `✗ Failed to read issue` |
| Debug | stderr | Prefixed text | `[debug] Loading 42 issues` |
| Command | stderr | Prefixed text | `> git fetch origin tbd-sync` |
| Progress | stderr | Spinner/animation | `⠋ Syncing...` |

### 2.3 Color System

**Semantic Colors (always apply):**

| Semantic | Color | Usage |
| --- | --- | --- |
| `success` | Green | Successful operations, positive states |
| `error` | Red | Errors, blocked states, critical priority |
| `warn` | Yellow | Warnings, high priority, dry-run |
| `info` | Blue | Informational, paths, links |
| `id` | Cyan | All IDs (issue, label, etc.) |
| `label` | Magenta | Labels, tags |
| `dim` | Gray | Secondary info, metadata, closed states |
| `bold` | Bold | Titles, headers, emphasis |

**Status Icons and Colors:**

**Rule**: Always display status with both icon and word together, never icon-only or
word-only.

| Status | Icon | Display | Color | Rationale |
| --- | --- | --- | --- | --- |
| `open` | `○` (U+25CB) | `○ open` | Blue | Neutral, awaiting action |
| `in_progress` | `◐` (U+25D0) | `◐ in_progress` | Green | Active, positive |
| `blocked` | `●` (U+25CF) | `● blocked` | Red | Needs attention |
| `deferred` | `○` (U+25CB) | `○ deferred` | Dim | Low priority, background |
| `closed` | `✓` (U+2713) | `✓ closed` | Dim | Complete, historical |

**Status Icon Rules:**
- `○` - Open/deferred (empty circle = not started)
- `◐` - In progress (half-filled = partially complete)
- `●` - Blocked (filled circle = stopped)
- `✓` - Closed (checkmark = done)
- Never use alternative characters
- Icon always followed by single space before status word

**Priority Colors:**

| Priority | Color | Rationale |
| --- | --- | --- |
| P0 (Critical) | Red | Urgent, demands attention |
| P1 (High) | Yellow | Important, elevated |
| P2-P4 | Default | Normal priority |

**Priority Display Format:**

- Always display with “P” prefix: P0, P1, P2, P3, P4
- Never display raw numbers (0, 1, 2) in output
- Parsing accepts both formats: `P1` or `1` → P1
- Case-insensitive parsing: `p1`, `P1`, `1` all valid

### 2.4 Formatting Conventions

#### IDs

- Always use display ID (e.g., `bd-a1b2`) in user-facing output
- Show internal ID only in `--debug` mode: `bd-a1b2 (is-01hx...)`
- Color all IDs with `id` semantic (cyan)

#### Tables

- Header row: dim color
- Consistent column widths within command
- Right-align numeric columns
- Left-align text columns

#### Lists

- Bullet: `•` or `-` for items
- Numbered: `1.`, `2.` for ordered
- Indent: 2 spaces per level

#### Counts

- Use `${n} item(s)` pattern for pluralization
- Dim color for count summaries
- Place at end of output

#### Empty States

- Standard message: `No {items} found`
- Use `info()` for empty state messages
- Don’t show table headers for empty results

#### Timestamps

- ISO 8601 for JSON: `2026-01-17T14:30:00Z`
- Relative for text: `2 hours ago`, `yesterday`
- Full date for older: `Jan 15, 2026`

#### Issue Line Formats

**Rule**: Use consistent issue line formatting across all commands.

**Standard Line (list/table view):**
```
{ID}  {PRI}  {STATUS}  {KIND} {TITLE}
```

| Column | Width | Format | Color |
| --- | --- | --- | --- |
| ID | 12 chars | Display ID | Cyan |
| PRI | 5 chars | P-prefixed | P0=red, P1=yellow |
| STATUS | 16 chars | Icon + word | Per status |
| KIND+TITLE | Remaining | `[kind]` prefix + title | Kind=dim, title=default |

**Example:**
```
bd-a1b2     P0   ● blocked        [bug] Fix authentication timeout
bd-c3d4     P1   ◐ in_progress    [feature] Add dark mode support
```

**Kind Display:** Always show kind in brackets with dim color: `[bug]`, `[feature]`,
`[task]`, `[epic]`, `[chore]`

**Compact Line (references, dependencies):**
```
{ID} {STATUS_ICON} {TITLE}
```
(Kind NOT shown in compact format)

**Example:**
```
Blocked by:
  bd-a1b2 ● Fix authentication timeout
```

**Extended Line (with Assignee):** For detailed views showing assignee information:
```
{ID}  {PRI}  {STATUS}  {ASSIGNEE}  {KIND} {TITLE}
```

| Column | Width | Format | Color |
| --- | --- | --- | --- |
| ASSIGNEE | 10 chars | @username or - | Default |

**Example:**
```
ID          PRI  STATUS           ASSIGNEE    TITLE
bd-a1b2     P0   ● blocked        @alice      [bug] Fix authentication timeout
bd-c3d4     P1   ◐ in_progress    @bob        [feature] Add dark mode support
```

**Issue Line with Labels:** When labels are relevant (search results, filtered views):
```
{ID}  {PRI}  {STATUS}  {KIND} {TITLE}  [{LABELS}]
```

**Example:**
```
bd-a1b2     P0   ● blocked        [bug] Fix auth timeout  [urgent, security]
bd-c3d4     P1   ◐ in_progress    [feature] Add dark mode  [ui]
```

**Rules:**
- Labels in square brackets, comma-separated
- Labels in magenta (`label`) color
- Only show if issue has labels
- Labels appear AFTER title (kind prefix appears BEFORE title)

**Long Format (`--long`):** Shows description on second line, indented 6 spaces, dim
color, max 2 lines. Truncated with Unicode ellipsis `…` (U+2026):
```
bd-a1b2     P0   ● blocked        [bug] Fix authentication timeout
      Users report 30s delays when logging in. Investigate connection
      pooling and add retry logic with exponential backoff…
```

**Long Format with Labels:**
```
bd-a1b2     P0   ● blocked        [bug] Fix auth timeout  [urgent, security]
      Users report 30s delays when logging in. Investigate connection…
```

**Long Format with Tree View (`--long --pretty`):**
```
bd-f14c  P2  ○ open  [feature] Add OAuth support
      Implement OAuth 2.0 flow with support for Google, GitHub, and
      custom OIDC providers. Should handle token refresh…
├── bd-c3d4  P2  ● blocked  [task] Write OAuth tests
│       Need comprehensive test coverage for token exchange, refresh,
│       and error handling scenarios…
└── bd-e5f6  P2  ○ open  [task] Update OAuth docs
        Document OAuth configuration options and provide examples for
        each supported provider…
```

**Inline Reference (messages):**
```
{ID} ({TITLE})
```
(Kind NOT shown in inline format)

**Example:**
```
✓ Created issue bd-a1b2 (Fix authentication timeout)
```

**Required utilities:**

*Truncation utility* (in `lib/truncate.ts`):
- `ELLIPSIS` - Unicode ellipsis constant (`…` U+2026)
- `truncate()` - Truncate text with ellipsis, word boundary aware
- `truncateMiddle()` - Truncate from middle (for paths/IDs)

*Issue formatting* (in `cli/lib/issueFormat.ts`):
- `ISSUE_COLUMNS` - Column width constants (ID=12, PRI=5, STATUS=16, ASSIGNEE=10)
- `formatKind()` - Format kind in brackets `[bug]`, `[feature]`, etc.
- `formatIssueLine()` - Standard table row (includes kind)
- `formatIssueLineExtended()` - Extended format with assignee
- `formatIssueWithLabels()` - Format with trailing labels
- `formatIssueCompact()` - Compact reference (no kind)
- `formatIssueInline()` - Inline mention (no kind)
- `formatIssueLong()` - Long format with description (uses truncate)
- `formatIssueHeader()` - Table header row
- `wrapDescription()` - Word-wrap description text (6-space indent, max 2 lines)

### 2.5 Verbose vs Debug Mode

**Verbose Mode (`--verbose`):**
- **External commands**: Every shell command with `> ` prefix (e.g.,
  `> git fetch origin`)
- Operation progress: “Loading issues …”
- Performance timing: “Synced in 150ms”
- Network operations: “Fetching from origin …”
- File operations: “Writing to .tbd/...”
- Stack traces on errors

**Debug Mode (`--debug`):**
- Internal IDs alongside display IDs
- Full paths instead of relative
- Command output/results (in addition to the command itself)
- Schema validation details
- Cache hit/miss information
- **Git stat log after sync**: Show `git log --stat` for commits just pushed/pulled

### 2.6 External Command Display Rule

**In verbose mode, always display every external command being executed.**

Format:
```
> {command} {args...}
```

Examples:
```bash
$ tbd sync --verbose
⠋ Syncing with remote...
> git fetch origin tbd-sync
> git rev-list --count origin/tbd-sync..tbd-sync
Loading 42 issues from local cache
> git push origin tbd-sync
✓ Synced: sent 2 new, 2 updated
```

Rules:
- Use `> ` prefix with dim color
- Show full command as it would be typed
- Output to stderr
- Only in verbose mode (not quiet/default)
- Mirrors patterns from make, npm, and other build tools

### 2.7 Error Message Guidelines

**Format:**
```
✗ {What failed}
  {Why it failed, if known}
  {How to fix, if actionable}
```

**Examples:**
```
✗ Issue not found: bd-xyz
  The ID may be incorrect or the issue may have been deleted.

✗ Failed to sync with remote
  Could not connect to origin (timeout after 30s)
  Check your network connection and try again.

✗ Not a tbd repository
  Run 'tbd init' or 'tbd import --from-beads' first.
```

### 2.8 Icon System

**Standard icons (must be used consistently):**

| Icon | Meaning | Color |
| --- | --- | --- |
| `✓` | Success/Complete | Green |
| `✗` | Error/Failure | Red |
| `⚠` | Warning/Caution | Yellow |
| `•` | Bullet/List item | Default |
| `⠋⠙⠹...` | Progress spinner | Blue |

**Rules:**
- Always use these exact Unicode characters (no alternatives like `✔` or `√`)
- Icon + space + message format
- Success icon only for completed operations
- Error icon only for failures

### 2.9 Sync Operations

**Sync visibility rule**: Any network operation must show immediate progress.

**Pattern:**
```bash
$ tbd update bd-a1b2 --status=closed
✓ Updated issue bd-a1b2
⠋ Syncing...
✓ Synced: sent 1 updated
```

**Sync summary format:**

| Direction | Tallies |
| --- | --- |
| Sent (push) | new, updated, deleted |
| Received (pull) | new, updated, deleted |

**Examples:**
```bash
✓ Synced: sent 1 new
✓ Synced: sent 2 updated, received 1 new
✓ Synced: received 3 new, 1 updated
✓ Already in sync
```

**Summary rules:**
- Omit zero counts
- Order: new → updated → deleted
- Use “Already in sync” when nothing changed

**Technical implementation notes:**
- Track issue state before/after sync to compute accurate tallies
- Compare local worktree state vs remote to determine new/updated/deleted
- Store issue hashes or versions to detect modifications vs additions

**Debug mode git log:** In `--debug` mode, show `git log --stat` for synced commits:
```bash
$ tbd sync --debug
⠋ Syncing with remote...
✓ Synced: sent 1 updated

[debug] Commits synced:
commit ee88823... (origin/tbd-sync, tbd-sync)
    tbd sync: 2026-01-17T23-50-56 (1 file)
 .tbd/data-sync/issues/is-01kf5zyg8jgkn9s6c1z1r1n6sn.md | 8 ++++----
 1 file changed, 4 insertions(+), 4 deletions(-)
```

Implementation:
- After push: `git log --stat origin/tbd-sync@{1}..origin/tbd-sync`
- After pull: `git log --stat HEAD@{1}..HEAD`

* * *

## Stage 3: Refine Architecture

### 3.1 Reusable Components Found

| Component | Location | Can Reuse |
| --- | --- | --- |
| `OutputManager` | `cli/lib/output.ts` | Yes - extend |
| `createColors()` | `cli/lib/output.ts` | Yes - use |
| `getStatusColor()` | Duplicated in commands | Extract to shared |
| `getPriorityColor()` | In `show.ts` only | Extract to shared |

### 3.2 Simplifications

1. **Extract color helpers**: Move `getStatusColor()` and `getPriorityColor()` to
   `output.ts`
2. **Standardize table output**: Add `table()` method to OutputManager
3. **Consolidate debug logging**: Ensure all debug uses `output.debug()`
4. **Unify empty state messages**: Use consistent “No {items} found” pattern

* * *

## Stage 4: Implementation Stage

### Phase 1: Architecture Documentation

- [ ] Create `arch-cli-interface-design-system.md` with full design system
- [ ] Document all color semantics with examples
- [ ] Document verbose/debug mode behaviors
- [ ] Document formatting conventions

### Phase 2: OutputManager Enhancements

#### 2.1 New Output Level Methods

The OutputManager API must enforce consistent formatting.
Each method handles its own icon, color, and visibility rules internally - callers just
pass the message.

```typescript
// output.ts - OutputManager class

// Icons (private constants)
private static readonly ICONS = {
  SUCCESS: '✓',  // U+2713
  ERROR: '✗',    // U+2717
  WARNING: '⚠',  // U+26A0
  NOTICE: '•',   // U+2022
} as const;

// error() - Always shown, red, stderr
error(message: string, err?: Error): void {
  // ✗ {message} - red
  // Shows stack trace in verbose mode
}

// warn() - Default+, yellow, stderr (suppressed by --quiet)
warn(message: string): void {
  if (this.ctx.quiet) return;
  // ⚠ {message} - yellow
}

// notice() - NEW - Default+, blue, stdout (suppressed by --quiet)
notice(message: string): void {
  if (this.ctx.quiet || this.ctx.json) return;
  // • {message} - blue
}

// success() - Default+, green, stdout (suppressed by --quiet)
success(message: string): void {
  if (this.ctx.quiet || this.ctx.json) return;
  // ✓ {message} - green
}

// info() - Verbose+, dim, stderr (requires --verbose or --debug)
info(message: string): void {
  if (!this.ctx.verbose && !this.ctx.debug) return;
  if (this.ctx.json) return;
  // {message} - dim (no prefix)
}

// command() - Verbose+, dim, stderr (requires --verbose or --debug)
command(cmd: string, args: string[]): void {
  if (!this.ctx.verbose && !this.ctx.debug) return;
  if (this.ctx.json) return;
  // > {cmd} {args...} - dim
}

// debug() - Debug only, dim, stderr (requires --debug, NOT --verbose)
debug(message: string): void {
  if (!this.ctx.debug) return;  // Changed: verbose no longer triggers debug
  if (this.ctx.json) return;
  // [debug] {message} - dim
}

// data() - Always shown, stdout
data<T>(data: T, textFormatter?: (data: T) => void): void {
  // JSON mode: JSON.stringify
  // Text mode: call formatter
}
```

#### 2.2 Implementation Tasks

Tasks are organized into subtasks that can each become a separate issue/bead.

**Subtask: OutputManager output level methods**
- [ ] Add `notice()` method - blue bullet, shown at default level
- [ ] Update `warn()` to respect `--quiet` flag
- [ ] Update `info()` to require `--verbose` (not default)
- [ ] Update `debug()` to require `--debug` only (not `--verbose`)
- [ ] Add `command()` method for external command display

**Subtask: OutputManager helper methods**
- [ ] Add `table()` method for consistent table output
- [ ] Add `list()` method for consistent list output
- [ ] Add `count()` method for consistent count output

**Subtask: Define icon constants**
- [ ] Define icon constants in OutputManager (SUCCESS_ICON, ERROR_ICON, WARN_ICON,
  NOTICE_ICON)
- [ ] Define status icon constants (OPEN_ICON, IN_PROGRESS_ICON, BLOCKED_ICON,
  CLOSED_ICON)

**Subtask: Create priority utilities (`lib/priority.ts`)**
- [ ] Create `formatPriority()` utility for P0/P1/P2 display format
- [ ] Create `parsePriority()` utility accepting “P1” or “1” input
- [ ] Create `getPriorityColor()` utility
- [ ] Unit tests for priority utilities

**Subtask: Create status utilities (`lib/status.ts`)**
- [ ] Create `formatStatus()` utility for icon + word format (e.g., `● blocked`)
- [ ] Create `getStatusIcon()` utility for status icons
- [ ] Create `getStatusColor()` utility
- [ ] Unit tests for status utilities

**Subtask: Create truncation utility (`lib/truncate.ts`)**
- [ ] `ELLIPSIS` constant (`…` U+2026) - never use `...`
- [ ] `truncate(text, maxLength, options?)` - truncate with word boundary support
- [ ] `truncateMiddle(text, maxLength)` - truncate from middle (for paths/IDs)
- [ ] Unit tests for all edge cases (empty, exact length, unicode, etc.)

**Subtask: Create issue formatting utilities (`cli/lib/issueFormat.ts`)**
- [ ] `ISSUE_COLUMNS` constants (ID=12, PRIORITY=5, STATUS=16, ASSIGNEE=10)
- [ ] `formatKind()` - Format kind in brackets `[bug]`, `[feature]`, etc.
- [ ] `formatIssueLine()` - Standard table row with `[kind]` prefix on title
- [ ] `formatIssueLineExtended()` - Extended format with assignee
- [ ] `formatIssueWithLabels()` - Format with trailing labels in magenta
- [ ] `formatIssueCompact()` - Compact reference format (ID + icon + title, no kind)
- [ ] `formatIssueInline()` - Inline mention format (ID + title in parens, no kind)
- [ ] `formatIssueHeader()` - Table header row
- [ ] `formatIssueLong()` - Long format with wrapped description on 2nd line
- [ ] `wrapDescription()` - Word-wrap description text (6-space indent, max 2 lines)
- [ ] Unit tests for issue formatting utilities

**Subtask: Add `--long` flag to commands**
- [ ] Add `--long` flag to `list` command for showing descriptions
- [ ] Add `--long` flag to `ready` command for showing descriptions
- [ ] Add `--long` flag to `blocked` command for showing descriptions
- [ ] Ensure `--long` works with `--pretty` tree view (proper indentation)

**Subtask: Migrate commands to use formatPriority/formatStatus**
- [ ] Update all commands to use `formatPriority()` for display
- [ ] Update all commands to use `formatStatus()` for display

**Subtask: Migrate commands to use issue formatting utilities**
- [ ] Update `list.ts` to use `formatIssueLine()` and `formatIssueHeader()`
- [ ] Update `show.ts` to use issue formatting utilities for dependencies
- [ ] Update `ready.ts` to use `formatIssueLine()`
- [ ] Update `blocked.ts` to use `formatIssueLine()` and `formatIssueCompact()`
- [ ] Update `search.ts` to use `formatIssueLine()`
- [ ] Update success/notice messages to use `formatIssueInline()` consistently

#### 2.3 API Design Principles

1. **Callers never format icons** - Methods add their own prefix
2. **Callers never check verbosity** - Methods handle visibility internally
3. **Callers never choose colors** - Methods apply semantic colors consistently
4. **One method per level** - No overloading, no optional “level” parameters
5. **Fail-safe defaults** - If uncertain, show more rather than less

### Phase 3: Sync Output Improvements

**Subtask: Implement sync progress indicator**
- [ ] Add immediate spinner when sync starts (no silent waiting)
- [ ] Update all commands with auto-sync to show sync progress

**Subtask: Implement sync summary tallies**
- [ ] Track new/updated/deleted counts during sync
- [ ] Implement `formatSyncSummary()` for consistent sync messages
- [ ] Update `sync.ts` to use new summary format
- [ ] Add sync tallies to JSON output format

**Subtask: Debug mode git log output**
- [ ] Show git log --stat in debug mode after push/pull operations

### Phase 4: Command Audit and Fixes

**Subtask: Audit commands for design system compliance**
- [ ] Audit `list.ts` for compliance
- [ ] Audit `show.ts` for compliance
- [ ] Audit `doctor.ts` for compliance
- [ ] Audit `sync.ts` for compliance
- [ ] Audit `stats.ts` for compliance
- [ ] Audit `search.ts` for compliance
- [ ] Audit `ready.ts` for compliance
- [ ] Audit `blocked.ts` for compliance
- [ ] Verify consistent icon usage across all commands
- [ ] Fix identified inconsistencies

### Phase 5: Testing and Validation

**Subtask: Output mode testing**
- [ ] Verify all output modes work correctly
- [ ] Test color output with `--color=always|never|auto`
- [ ] Verify JSON output is valid JSON
- [ ] Test verbose and debug modes show appropriate info

**Subtask: Message format testing**
- [ ] Verify error messages follow guidelines
- [ ] Test sync progress visibility (spinner appears immediately)
- [ ] Verify sync summaries show accurate tallies

* * *

## Stage 5: Validation Stage

**Validation Criteria:**

1. All commands use `OutputManager` methods (no direct console.log for output)
2. Color usage matches semantic guidelines
3. Verbose/debug output is appropriate and helpful
4. Error messages are actionable
5. Empty states are handled consistently
6. Table formatting is uniform
7. Priorities always display as P0-P4 (never raw numbers)
8. Icons used consistently: ✓ for success, ✗ for error, ⚠ for warning
9. Status always displays with icon + word (○ open, ◐ in_progress, ● blocked, ✓ closed)
10. Kind always displayed in brackets with dim color: `[bug]`, `[feature]`, `[task]`,
    `[epic]`, `[chore]`
11. Kind shown as prefix to title in standard format, omitted in compact/inline formats
12. `--long` mode shows wrapped description on second line (6-space indent, max 2 lines)
13. `--long` works correctly with `--pretty` tree view
14. Sync operations show immediate progress (spinner before any delay)
15. Sync summaries show new/updated/deleted tallies (not vague “pushed/pulled”)

**Testing Approach:**

- Golden tests capture output format
- Manual review of color output
- Agent testing with JSON mode
