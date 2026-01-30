# CLI Interface Design System Architecture

Last updated: 2026-01-30

Maintenance: When revising this doc you must follow instructions in
@shortcut-revise-architecture-doc.md.

## Overview

This document defines the universal design system for all CLI output in tbd.
It ensures consistent output structure, formatting, colors, and conventions across all
commands and output modes.

**Scope**: All CLI output including success messages, errors, warnings, data display,
verbose/debug logging, and progress indicators.

**Related Documents:**

- [plan-2026-01-17-cli-output-design-system.md](../../specs/active/plan-2026-01-17-cli-output-design-system.md)
  \- Implementation plan
- [output.ts](packages/tbd/src/cli/lib/output.ts) - OutputManager implementation
- [context.ts](packages/tbd/src/cli/lib/context.ts) - Command context and modes

## Terminology

| Term | Definition |
| --- | --- |
| **Output Mode** | The combination of flags that control output format and verbosity |
| **Semantic Color** | A color with consistent meaning across all commands |
| **Display ID** | Human-friendly short ID (e.g., `bd-a1b2`) |
| **Internal ID** | Full ULID-based ID (e.g., `is-01hx5zzkbk...`) |

## Output Modes

**File(s)**: `packages/tbd/src/cli/lib/context.ts`

tbd supports multiple output modes that can be combined:

### Mode Hierarchy

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
```

### Output Levels

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

### Mode Flags

| Flag | Effect |
| --- | --- |
| `--quiet` | Only errors and data output |
| `--verbose` | Show info messages (operations, progress) |
| `--debug` | Show debug messages (internal state, IDs) |
| `--json` | Output data as JSON, messages as JSON to stderr |
| `--color=auto\|always\|never` | Control colorization |
| `--dry-run` | Show what would happen without doing it |

### Level Visibility Matrix

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
2. **`notice` is for noteworthy events** - Not warnings, but user should see them
3. **`info` requires `--verbose`** - Operational progress is opt-in, not default
4. **`debug` requires `--debug`** - Does NOT show with just `--verbose`

## Output Channels

**File(s)**: `packages/tbd/src/cli/lib/output.ts`

### Channel Rules

| Channel | Purpose | Format |
| --- | --- | --- |
| **stdout** | Primary data, success messages, info | Text or JSON |
| **stderr** | Warnings, errors, debug, progress | Always text (or JSON in `--json` mode) |

### Why stderr for Progress/Debug?

Progress indicators and debug output go to stderr because:
1. They don’t corrupt stdout when piping to other tools
2. They can be suppressed independently
3. They’re ephemeral (spinners, progress bars)

### OutputManager Methods

The OutputManager API enforces consistent formatting.
Each method handles its own icon, color, and visibility rules internally - callers just
pass the message.

```typescript
// Primary data output - stdout, always shown
output.data(data, textFormatter)

// Error - stderr, always shown (red, ✗ prefix)
output.error("Failed to read issue", error)

// Warning - stderr, default+ (yellow, ⚠ prefix, suppressed by --quiet)
output.warn("Remote branch not found")

// Notice - stdout, default+ (blue, • prefix, suppressed by --quiet)
output.notice("Issue doesn't exist remotely - kept local")

// Success - stdout, default+ (green, ✓ prefix, suppressed by --quiet)
output.success("Created issue bd-a1b2")

// Info - stderr, verbose+ (dim, no prefix, requires --verbose)
output.info("Syncing with remote...")

// Command - stderr, verbose+ (dim, > prefix, requires --verbose)
output.command("git", ["fetch", "origin", "tbd-sync"])

// Debug - stderr, debug only (dim, [debug] prefix, requires --debug)
output.debug("Loading 42 issues from cache")

// Dry-run indicator - stdout, only in dry-run mode
output.dryRun("Would create issue", { title: "..." })

// Progress spinner - stderr, only in TTY mode
output.spinner("Syncing...")
```

**API Design Principles:**

1. **Callers never format icons** - Methods add their own prefix
2. **Callers never check verbosity** - Methods handle visibility internally
3. **Callers never choose colors** - Methods apply semantic colors consistently
4. **One method per level** - No overloading, no optional “level” parameters

## Color System

**File(s)**: `packages/tbd/src/cli/lib/output.ts`

### Semantic Colors

Colors have consistent meanings across all commands:

| Semantic | Color | ANSI | Usage |
| --- | --- | --- | --- |
| `success` | Green | 32 | Successful operations, positive states |
| `error` | Red | 31 | Errors, blocked states, critical items |
| `warn` | Yellow | 33 | Warnings, high priority, caution |
| `info` | Blue | 34 | Informational, paths, links |
| `id` | Cyan | 36 | All IDs (issue, label, reference) |
| `label` | Magenta | 35 | Labels, tags, categories |
| `dim` | Gray | 90 | Secondary info, metadata, disabled |
| `bold` | Bold | 1 | Titles, headers, emphasis |

### Usage Example

```typescript
const colors = output.getColors();

console.log(colors.success(`Created issue ${colors.id('bd-a1b2')}`));
console.log(colors.error('Failed to sync'));
console.log(colors.dim(`Updated 2 hours ago`));
```

### Status Icons and Colors

**Rule**: Always display status with both icon and word together, never icon-only or
word-only.

| Status | Icon | Display | Color | Rationale |
| --- | --- | --- | --- | --- |
| `open` | `○` (U+25CB) | `○ open` | Blue (info) | Neutral, awaiting action |
| `in_progress` | `◐` (U+25D0) | `◐ in_progress` | Green (success) | Active, positive progress |
| `blocked` | `●` (U+25CF) | `● blocked` | Red (error) | Needs attention, problem |
| `deferred` | `○` (U+25CB) | `○ deferred` | Gray (dim) | Low priority, background |
| `closed` | `✓` (U+2713) | `✓ closed` | Gray (dim) | Complete, historical |

**Display Examples:**
```
ID          PRI  STATUS           TITLE
bd-a1b2     P0   ● blocked        Fix authentication timeout
bd-c3d4     P1   ◐ in_progress    Add dark mode support
bd-e5f6     P2   ○ open           Update documentation
bd-g7h8     P3   ✓ closed         Initial setup
```

**Icon Rules:**
- `○` (U+25CB) - Open/deferred (empty circle = not started)
- `◐` (U+25D0) - In progress (half-filled = partially complete)
- `●` (U+25CF) - Blocked (filled circle = stopped)
- `✓` (U+2713) - Closed (checkmark = done)
- Never use alternative characters
- Icon always followed by single space before status word

### Priority Colors

| Priority | Color | Rationale |
| --- | --- | --- |
| P0 (Critical) | Red (error) | Urgent, demands attention |
| P1 (High) | Yellow (warn) | Important, elevated |
| P2-P4 | Default | Normal priority |

### Priority Display Format

**Rule**: Always display priorities with the “P” prefix: P0, P1, P2, P3, P4.

**Display Examples:**
```
ID          PRI  STATUS           TITLE
bd-a1b2     P0   ● blocked        Fix authentication timeout
bd-c3d4     P1   ◐ in_progress    Add dark mode support
bd-e5f6     P2   ○ open           Update documentation
```

**Parsing Rules:**
- Accept both formats on input: `P1` or `1` → P1
- Case-insensitive: `p1`, `P1`, `1` all parse to P1
- Invalid values should error with clear message

**Implementation:**
```typescript
// In a shared utility (e.g., lib/priority.ts)

/** Format priority for display - always includes P prefix */
export function formatPriority(priority: number): string {
  return `P${priority}`;
}

/** Parse priority from user input - accepts "P1" or "1" */
export function parsePriority(input: string): number {
  const normalized = input.toUpperCase().replace(/^P/, '');
  const num = parseInt(normalized, 10);
  if (isNaN(num) || num < 0 || num > 4) {
    throw new Error(`Invalid priority: ${input}. Use P0-P4 or 0-4.`);
  }
  return num;
}
```

**Rationale:**
- Consistent display reduces cognitive load
- “P” prefix makes priorities visually distinct from other numbers
- Flexible parsing improves UX (users don’t need to remember exact format)
- Matches common conventions (P0/P1/P2 terminology)

### Color Control

```bash
# Auto-detect based on TTY (default)
tbd list

# Force colors (useful for piping to less -R)
tbd list --color=always

# Disable colors
tbd list --color=never

# Environment variable override
NO_COLOR=1 tbd list
```

## Message Formatting

### Section Headings

**Rule**: All section headings in CLI output must follow a consistent grammar.

**Format**: ALL CAPS, bold, followed by blank line before content.

| Element | Format | Color | Example |
| --- | --- | --- | --- |
| Section heading | ALL CAPS + newline | Bold | `REPOSITORY` |
| Inline label | Title Case + colon | Default | `Sync branch:` |

**Structure:**
```
HEADING

  content line 1
  content line 2

NEXT HEADING

  more content
```

**Examples:**
```
REPOSITORY

  ✓ Initialized (.tbd/)
  ✓ Git repository (main)

CONFIGURATION

  Sync branch: tbd-sync
  Remote:      origin
  ID prefix:   tbd-

INTEGRATIONS

  ✓ Claude Code skill
  ⚠ Cursor rules - not installed
      Run: tbd setup cursor

HEALTH CHECKS

  ✓ Git version (2.50.1)
  ✓ Config file
  ✓ Worktree healthy
```

**Rules:**
- ALL CAPS for section headings (never Title Case or lowercase)
- Blank line after heading before content
- Blank line between sections
- Content indented 2 spaces under heading
- Sub-items (like fix hints) indented 6 spaces
- No colon after section headings
- Use colons for inline key-value pairs within content

**Commands using section headings:**
- `tbd status` - REPOSITORY, CONFIGURATION, INTEGRATIONS
- `tbd doctor` - Same as status + STATISTICS, HEALTH CHECKS
- `tbd show` - Issue details sections
- `tbd stats` - Statistics breakdown

**Implementation:**
```typescript
/** Format a section heading - ALL CAPS, bold */
export function formatHeading(text: string): string {
  return colors.bold(text.toUpperCase());
}

// Usage:
console.log(formatHeading('Repository'));
console.log('');  // Blank line after heading
console.log('  ✓ Initialized (.tbd/)');
```

### Icons and Prefixes

**Standard Icons (one per level, never mix):**

| Icon | Unicode | Color | Level | When to Use |
| --- | --- | --- | --- | --- |
| `✓` | U+2713 | Green | success | Operation completed successfully |
| `✗` | U+2717 | Red | error | Operation failed |
| `⚠` | U+26A0 | Yellow | warning | Non-fatal issue, needs attention |
| `•` | U+2022 | Blue | notice | Noteworthy event during normal operation |
| `⠋⠙⠹...` | Braille | Blue | spinner | Progress animation for in-progress operations |

**Text Prefixes:**

| Prefix | Color | Level | When to Use |
| --- | --- | --- | --- |
| `[debug]` | Dim | debug | Internal state (debug mode only) |
| `[DRY-RUN]` | Yellow | dryRun | Simulated action, no changes made |
| `>` | Dim | command | External shell command being executed |

**Complete Level Format Reference:**

| Level | Format | Color | Example |
| --- | --- | --- | --- |
| error | `✗ {message}` | Red | `✗ Issue not found: bd-xyz` |
| warning | `⚠ {message}` | Yellow | `⚠ Remote branch not found` |
| notice | `• {message}` | Blue | `• Issue doesn't exist remotely - kept local` |
| success | `✓ {message}` | Green | `✓ Created issue bd-a1b2` |
| info | `{message}` | Dim | `Syncing with remote...` |
| command | `> {command}` | Dim | `> git fetch origin tbd-sync` |
| debug | `[debug] {message}` | Dim | `[debug] Cache hit for bd-a1b2` |
| dryRun | `[DRY-RUN] {message}` | Yellow | `[DRY-RUN] Would create issue` |

**Icon Rules:**
- Each icon belongs to exactly one level - never reuse
- Always use exact Unicode characters (no alternatives like `✔`, `√`, `×`)
- Icon/prefix always followed by single space before message
- Colors are fixed per level - never override

### Success Messages

```
✓ {Action performed} {target}

Examples:
✓ Created issue bd-a1b2
✓ Updated 3 issue(s)
✓ Synced: pulled 2, pushed 1
✓ Already up to date
```

### Error Messages

```
✗ {What failed}
  {Why it failed, if known}
  {How to fix, if actionable}

Examples:
✗ Issue not found: bd-xyz
  The ID may be incorrect or the issue may have been deleted.

✗ Failed to sync with remote
  Could not connect to origin (timeout after 30s)
  Check your network connection and try again.

✗ Not a tbd repository
  Run 'tbd init' or 'tbd import --from-beads' first.
```

### Warning Messages

```
⚠ {Potential issue}
  {Context or suggestion}

Examples:
⚠ Remote branch not found (will be created on push)
⚠ 3 orphaned dependency reference(s) found
  Run 'tbd doctor --fix' to clean up.
```

### Notice Messages

Notices are for noteworthy events that aren’t warnings - things the user should know
about but that don’t indicate a problem.

```
• {Noteworthy event}

Examples:
• Issue doesn't exist remotely - kept local version
• Using cached data (last sync 2 hours ago)
• Skipped 3 issue(s) already up to date
```

**When to use notice vs warning:**
- **Notice**: Normal operation, just informing the user
- **Warning**: Something unexpected that may need attention

### Debug Messages

```
[debug] {Internal operation details}

Examples:
[debug] Loading 42 issues from .tbd/data-sync-worktree
[debug] Cache miss for bd-a1b2, reading from disk
[debug] Git command: git fetch origin tbd-sync
[debug] Resolved bd-a1b2 -> is-01hx5zzkbkactav9wevgemmvrz
```

## Data Formatting

### Issue Line Format

**Rule**: Use consistent issue line formatting across all commands and contexts.

#### Standard Issue Line (List/Table View)

The canonical format for displaying issues in lists and tables:

```
{ID}  {PRI}  {STATUS}  {KIND} {TITLE}
```

**Column specifications:**

| Column | Width | Alignment | Format | Color |
| --- | --- | --- | --- | --- |
| ID | 12 chars | Left | Display ID | Cyan (`id`) |
| PRI | 5 chars | Left | P-prefixed | P0=red, P1=yellow, P2+=default |
| STATUS | 16 chars | Left | Icon + word | Per status color |
| KIND+TITLE | Remaining | Left | `[type]` prefix + title | Kind=dim, title=default |

**Example:**
```
ID          PRI  STATUS           TITLE
bd-a1b2     P0   ● blocked        [bug] Fix authentication timeout
bd-c3d4     P1   ◐ in_progress    [feature] Add dark mode support
bd-e5f6     P2   ○ open           [task] Update documentation
bd-g7h8     P3   ✓ closed         [epic] Initial setup
```

**Note:** KIND is displayed as a bracketed prefix to the title in the same column, not a
separate column.
This is more space-efficient while still clearly showing the issue type.

#### Kind Display Format

**Rule**: Always display kind/type in square brackets with dim color.

| Kind | Display | Color |
| --- | --- | --- |
| `bug` | `[bug]` | Dim |
| `feature` | `[feature]` | Dim |
| `task` | `[task]` | Dim |
| `epic` | `[epic]` | Dim |
| `chore` | `[chore]` | Dim |

**Rationale:**
- Brackets visually distinguish kind from other fields
- Dim color keeps focus on title while still showing type
- Consistent with label display style `[label1, label2]`
- Matches familiar patterns from other issue trackers

**Implementation:**
```typescript
/** Format kind for display - always in brackets, dim color */
export function formatKind(kind: string): string {
  return `[${kind}]`;
}
```

#### Compact Issue Line (References)

For inline references, dependency lists, blocked-by lists, and search results where
space is limited:

```
{ID} {STATUS_ICON} {TITLE}
```

**Examples:**
```
Blocked by:
  bd-a1b2 ● Fix authentication timeout
  bd-c3d4 ◐ Add dark mode support

Blocks:
  bd-e5f6 ○ Update documentation
```

**Rules:**
- ID in cyan
- Status icon only (no word) - colored per status
- Single space between elements
- Kind NOT shown in compact format (space-limited context)
- Used for secondary/nested issue references

#### Extended Issue Line (with Assignee)

For detailed views showing assignee information:

```
{ID}  {PRI}  {STATUS}  {ASSIGNEE}  {KIND} {TITLE}
```

**Additional column:**

| Column | Width | Alignment | Format | Color |
| --- | --- | --- | --- | --- |
| ASSIGNEE | 10 chars | Left | @username or - | Default |

**Example:**
```
ID          PRI  STATUS           ASSIGNEE    TITLE
bd-a1b2     P0   ● blocked        @alice      [bug] Fix authentication timeout
bd-c3d4     P1   ◐ in_progress    @bob        [feature] Add dark mode support
bd-e5f6     P2   ○ open           -           [task] Update documentation
```

#### Issue Line with Labels

When labels are relevant (search results, filtered views):

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

#### Long Format (`--long`)

The `--long` flag shows the first part of the issue description on a second line,
providing more context without requiring `tbd show`.

```
{ID}  {PRI}  {STATUS}  {KIND} {TITLE}
      {DESCRIPTION_EXCERPT}…
```

**Example:**
```
bd-a1b2     P0   ● blocked        [bug] Fix authentication timeout
      Users report 30s delays when logging in. Investigate connection
      pooling and add retry logic with exponential backoff…

bd-c3d4     P1   ◐ in_progress    [feature] Add dark mode support
      Implement system-preference-aware dark mode toggle. Should persist
      user choice in localStorage and sync across devices…

bd-e5f6     P2   ○ open           [task] Update documentation
      Add examples for new CLI commands and update screenshots for v2…
```

**Rules:**
- Description starts on second line, indented 6 spaces (aligns under title start)
- Description in dim color
- Text wraps at terminal width with consistent indentation
- Maximum 2 lines for description (truncate with `…` U+2026 if longer)
- If no description, show only the single issue line (no blank line)
- Word-wrap on word boundaries, never mid-word
- Works with both table format and `--pretty` tree format

**Word Wrapping Algorithm:**
```typescript
/** Wrap text to fit within width, with indentation for continuation lines */
export function wrapDescription(
  description: string,
  maxWidth: number,
  indent: number = 6,
): string[] {
  const firstLineWidth = maxWidth;
  const continuationWidth = maxWidth - indent;
  const indentStr = ' '.repeat(indent);

  // Clean and truncate description
  const cleaned = description
    .replace(/\n+/g, ' ')  // Replace newlines with spaces
    .replace(/\s+/g, ' ')  // Collapse whitespace
    .trim();

  const words = cleaned.split(' ');
  const lines: string[] = [];
  let currentLine = '';
  let isFirstLine = true;

  for (const word of words) {
    const lineWidth = isFirstLine ? firstLineWidth : continuationWidth;
    const testLine = currentLine ? `${currentLine} ${word}` : word;

    if (testLine.length <= lineWidth) {
      currentLine = testLine;
    } else {
      if (currentLine) {
        lines.push(isFirstLine ? indentStr + currentLine : indentStr + currentLine);
        isFirstLine = false;
      }
      currentLine = word;
    }

    // Stop at 2 lines
    if (lines.length >= 2) break;
  }

  // Add final line (use truncate() utility for ellipsis)
  if (currentLine && lines.length < 2) {
    const needsTruncation = words.length > lines.length;
    lines.push(indentStr + (needsTruncation ? truncate(currentLine, lineWidth) : currentLine));
  }

  return lines;
}
```

**Long Format with Labels:**
```
bd-a1b2     P0   ● blocked        [bug] Fix auth timeout  [urgent, security]
      Users report 30s delays when logging in. Investigate connection…
```

**Long Format with `--pretty` (Tree View):**
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

#### Single Issue Reference (Inline)

For mentioning an issue inline in messages or logs:

```
{ID} ({TITLE})
```

**Examples:**
```
✓ Created issue bd-a1b2 (Fix authentication timeout)
✓ Closed bd-c3d4 (Add dark mode support)
• Skipped bd-e5f6 (Update documentation) - already up to date
```

**Rules:**
- Kind NOT shown in inline references (keep concise)
- Used in success/notice/error messages

#### Formatting Utility Functions

**File(s)**: `packages/tbd/src/cli/lib/issue-format.ts`

All commands MUST use these shared utilities for consistent formatting:

```typescript
/** Column widths for consistent table alignment */
export const ISSUE_COLUMNS = {
  ID: 12,
  PRIORITY: 5,
  STATUS: 16,
  ASSIGNEE: 10,  // Only used in extended format
} as const;
// Note: KIND is not a separate column - it's a prefix to TITLE

/** Format kind for display - always in brackets */
export function formatKind(kind: string): string;

/** Format a standard issue line for list/table view (includes kind) */
export function formatIssueLine(
  issue: { id: string; priority: number; status: string; kind: string; title: string },
  colors: ColorFunctions,
): string;

/** Format a compact issue reference (for dependency lists, etc.) */
export function formatIssueCompact(
  issue: { id: string; status: string; title: string },
  colors: ColorFunctions,
): string;

/** Format an inline issue reference */
export function formatIssueInline(
  issue: { id: string; title: string },
  colors: ColorFunctions,
): string;

/** Format table header row */
export function formatIssueHeader(colors: ColorFunctions): string;

/** Format extended issue line with assignee */
export function formatIssueLineExtended(
  issue: { id: string; priority: number; status: string; kind: string; assignee?: string; title: string },
  colors: ColorFunctions,
): string;

/** Format issue line with description for --long mode */
export function formatIssueLong(
  issue: { id: string; priority: number; status: string; kind: string; title: string; description?: string },
  colors: ColorFunctions,
  terminalWidth: number,
): string[];

/** Wrap description text for --long mode */
export function wrapDescription(
  description: string,
  maxWidth: number,
  indent?: number,
): string[];
```

**Usage example:**
```typescript
import {
  formatIssueLine,
  formatIssueHeader,
  formatIssueCompact,
  formatIssueInline,
  formatIssueLong,
} from '../lib/issue-format.js';

// List view (standard)
console.log(formatIssueHeader(colors));
for (const issue of issues) {
  console.log(formatIssueLine(issue, colors));
}

// List view (--long mode)
console.log(formatIssueHeader(colors));
for (const issue of issues) {
  const lines = formatIssueLong(issue, colors, process.stdout.columns ?? 80);
  lines.forEach(line => console.log(line));
}

// Dependency list (compact)
console.log('Blocked by:');
for (const dep of blockedBy) {
  console.log(`  ${formatIssueCompact(dep, colors)}`);
}

// Success message (inline)
output.success(`Created issue ${formatIssueInline(issue, colors)}`);
```

### Tables

The standard issue table format (see Issue Line Format above):

```
ID          PRI  STATUS           TITLE
bd-a1b2     P0   ● blocked        [bug] Fix authentication timeout
bd-c3d4     P1   ◐ in_progress    [feature] Add dark mode support
bd-e5f6     P2   ○ open           [task] Update documentation

3 issue(s)
```

**Rules:**
- Header row in dim color
- Column widths consistent within table
- Priorities always as P0-P4 (never raw numbers)
- Status always with icon + word (e.g., `● blocked`, never just `blocked`)
- Left-align text columns (ID, PRI, TITLE, STATUS)
- Count summary at bottom in dim color

### Tree View (--pretty)

The `--pretty` flag displays issues in a tree format showing parent-child relationships:

```
bd-1875  P1  ✓ closed  [epic] Phase 24 Epic: Installation and Agent Integration
├── bd-1876  P1  ✓ closed  [task] Implement tbd prime command
└── bd-1877  P1  ✓ closed  [task] Implement tbd setup claude command
bd-a1b2  P1  ◐ in_progress  [bug] Fix authentication bug
bd-f14c  P2  ○ open  [feature] Add OAuth support
├── bd-c3d4  P2  ● blocked  [task] Write OAuth tests
└── bd-e5f6  P2  ○ open  [task] Update OAuth docs

7 issue(s)
```

**Column layout (left to right):**

| Column | Color | Notes |
| --- | --- | --- |
| Tree prefix | dim | `├── ` or `└── ` for children |
| ID | cyan | Display ID |
| Priority | P0=red, P1=yellow, P2+=default | Always with P prefix |
| Status | per status | Icon + word together |
| Kind+Title | kind=dim, title=default | `[kind]` prefix + title |

**Tree characters:**

| Character | Unicode | Usage |
| --- | --- | --- |
| `├── ` | U+251C, U+2500 | Middle child |
| `└── ` | U+2514, U+2500 | Last child |
| `│   ` | U+2502 | Continuation line for deeper nesting |
| `    ` | (spaces) | Spacing after last child at a level |

**Rules:**
- Root issues (no parent) appear at left margin
- Children grouped under their parent with tree lines
- Children sorted by priority within each parent group
- Multi-level nesting supported with proper indentation
- Tree prefix in dim color
- No header row (unlike table format)
- Count summary at bottom in dim color

### Lists

```
• Item one
• Item two
  - Sub-item A
  - Sub-item B
• Item three

3 item(s)
```

**Rules:**
- Use `•` for top-level items
- Use `-` for sub-items
- 2-space indent per level

### IDs

```
# Default mode
bd-a1b2

# Debug mode (--debug)
bd-a1b2 (is-01hx5zzkbkactav9wevgemmvrz)
```

**Rules:**
- Always show display ID in normal output
- Show internal ID only in debug mode
- Color all IDs with cyan (`id` semantic)

### Priorities

```
# Display format (always use this)
P0, P1, P2, P3, P4

# Never display as raw numbers
0, 1, 2, 3, 4  ← WRONG
```

**Rules:**
- Always display with “P” prefix: P0, P1, P2, P3, P4
- Never output raw numbers in any context (tables, details, JSON text fields)
- Use `formatPriority()` utility for all display
- Color P0 red (error), P1 yellow (warn), P2-P4 default

**Parsing (user input):**
- Accept both formats: `P1` or `1` → P1
- Case-insensitive: `p1`, `P1`, `1` all valid
- Use `parsePriority()` utility for all input

### Counts

```
3 issue(s)
1 file(s) changed
0 conflict(s)
```

**Rules:**
- Use `(s)` suffix for proper pluralization
- Show in dim color
- Place at end of output section

### Empty States

```
No issues found
No results matching "search term"
```

**Rules:**
- Use standard “No {items} found” pattern
- Use `info()` method (blue color)
- Don’t show table headers for empty results

### Timestamps

| Context | Format | Example |
| --- | --- | --- |
| JSON output | ISO 8601 | `2026-01-17T14:30:00Z` |
| Recent (< 24h) | Relative | `2 hours ago` |
| Recent (< 7d) | Day + time | `Monday at 2:30 PM` |
| Older | Full date | `Jan 15, 2026` |

## Verbose vs Debug Mode

### Verbose Mode (`--verbose`)

Shows **operational progress** that helps users understand what’s happening:

```bash
$ tbd sync --verbose
⠋ Syncing with remote...
> git fetch origin tbd-sync
> git rev-list --count origin/tbd-sync..tbd-sync
Loading 42 issues from local cache
Comparing with remote (3 new, 1 modified)
> git push origin tbd-sync
✓ Synced: sent 2 new, 2 updated
```

**What to include:**
- **External commands**: Every shell command (git, etc.)
  with `> ` prefix
- Network operations (fetch, push, pull)
- File operations (reading, writing)
- Performance timing
- Operation progress
- Stack traces on errors

### External Command Display

**Rule**: In verbose mode, always display every external command being executed.

**Format:**
```
> {command} {args...}
```

**Examples:**
```bash
> git fetch origin tbd-sync
> git rev-list --count origin/tbd-sync..tbd-sync
> git push origin tbd-sync
> git status --porcelain
```

**Rules:**
- Use `> ` prefix (dim color) to indicate shell command
- Show the full command as it would be typed
- Output to stderr (like other verbose output)
- Only show in verbose mode, not in quiet/default mode
- In debug mode, also show command output/results

**Implementation:**
```typescript
// In OutputManager
command(cmd: string, args: string[]): void {
  if (this.ctx.verbose && !this.ctx.json) {
    const fullCmd = [cmd, ...args].join(' ');
    console.error(this.colors.dim(`> ${fullCmd}`));
  }
}
```

**Rationale:**
- Users can see exactly what tbd is doing under the hood
- Helpful for debugging sync issues or unexpected behavior
- Commands can be copy-pasted for manual execution
- Mirrors familiar patterns from make, npm, and other build tools

### Debug Mode (`--debug`)

Shows **internal state** for troubleshooting:

```bash
$ tbd show bd-a1b2 --debug
[debug] Resolved bd-a1b2 -> is-01hx5zzkbkactav9wevgemmvrz
[debug] Reading /path/to/.tbd/data-sync-worktree/.tbd/data-sync/issues/is-01hx5zzkbkactav9wevgemmvrz.md
[debug] Cache hit, using memoized issue
---
id: bd-a1b2 (is-01hx5zzkbkactav9wevgemmvrz)
...
```

### Git Stat Log in Debug Mode

**Rule**: In `--debug` mode, after any git push/pull operation, show the git log with
stat for the commits that were just synced.

```bash
$ tbd sync --debug
⠋ Syncing with remote...
> git fetch origin tbd-sync
> git push origin tbd-sync
✓ Synced: sent 1 updated

[debug] Commits synced:
commit ee88823f61a0d224371fadaff177a8b0b54b04b1 (origin/tbd-sync, tbd-sync)
Author: Joshua Levy <joshua@cal.berkeley.edu>
Date:   Sat Jan 17 15:50:56 2026 -0800

    tbd sync: 2026-01-17T23-50-56 (1 file)

 .tbd/data-sync/issues/is-01kf5zyg8jgkn9s6c1z1r1n6sn.md | 8 ++++----
 1 file changed, 4 insertions(+), 4 deletions(-)
```

**Implementation:**
```bash
# After push, show commits that were pushed
git log --stat origin/tbd-sync@{1}..origin/tbd-sync

# After pull, show commits that were pulled
git log --stat HEAD@{1}..HEAD
```

**Rationale:**
- Provides full visibility into exactly what changed
- Shows file-level diff stats (insertions/deletions)
- Helpful for debugging sync issues
- Can verify correct issues were synced

**What to include:**
- Internal ID mappings
- Full file paths
- Git commands being executed
- Cache hit/miss status
- Schema validation details
- Raw API responses

## JSON Mode

**File(s)**: `packages/tbd/src/cli/lib/output.ts`

### Data Output

```bash
$ tbd list --json
[
  {
    "id": "bd-a1b2",
    "internalId": "is-01hx5zzkbkactav9wevgemmvrz",
    "priority": 0,
    "status": "open",
    "kind": "bug",
    "title": "Fix authentication timeout"
  }
]
```

### Error Output

```bash
$ tbd show bd-invalid --json
{
  "error": "Issue not found: bd-invalid",
  "details": "No issue with ID bd-invalid exists"
}
```

### Warning Output

```bash
$ tbd sync --json 2>&1
{
  "warning": "Remote branch not found, will be created on push"
}
{"pulled": 0, "pushed": 3, "conflicts": 0}
```

**Rules:**
- Data goes to stdout as JSON array or object
- Errors go to stderr as JSON object with `error` key
- Warnings go to stderr as JSON object with `warning` key
- No color codes in JSON mode
- All fields use camelCase

## Progress Indicators

### Spinners

```
⠋ Syncing with remote...
⠙ Syncing with remote...
⠹ Syncing with remote...
```

**Rules:**
- Only show in TTY mode
- Output to stderr (don’t corrupt stdout)
- Clear line on completion
- No spinners in quiet/json modes

### Progress Updates

```
⠋ Processing 1 of 100 issues...
⠙ Processing 42 of 100 issues...
✓ Processed 100 issues
```

**Rules:**
- Update message in-place (same line)
- Show final count on completion
- Replace spinner with success/error prefix

## Sync Operations

### Sync vs Local Operations

Commands must clearly distinguish between local-only changes and sync operations:

| Operation Type | Indicator | Example |
| --- | --- | --- |
| Local only | Immediate success | `✓ Updated issue bd-a1b2` |
| With sync | Progress → Success | `⠋ Syncing...` → `✓ Synced: ...` |

**Rule**: Any command that touches the network must:
1. Show immediate progress indicator when sync starts
2. Show completion message when sync finishes

**Example flow:**
```bash
$ tbd update bd-a1b2 --status=closed
✓ Updated issue bd-a1b2
⠋ Syncing...
✓ Synced: sent 1 updated

$ tbd create --title="New feature" --type=feature
✓ Created issue bd-c3d4
⠋ Syncing...
✓ Synced: sent 1 new
```

### Sync Summary Format

**Rule**: Sync summaries must show meaningful tallies of what changed.

**Format:**
```
✓ Synced: sent {summary}, received {summary}
```

**Tallies to track:**

| Direction | Metric | Meaning |
| --- | --- | --- |
| Sent (push) | `new` | Issues created locally, pushed to remote |
| Sent (push) | `updated` | Issues modified locally, pushed to remote |
| Sent (push) | `deleted` | Issues deleted locally, pushed to remote |
| Received (pull) | `new` | Issues created remotely, pulled to local |
| Received (pull) | `updated` | Issues modified remotely, pulled to local |
| Received (pull) | `deleted` | Issues deleted remotely, pulled to local |

**Examples:**
```bash
# Simple case - one issue updated locally
✓ Synced: sent 1 updated

# Created new issue
✓ Synced: sent 1 new

# Pull from remote with changes
✓ Synced: received 2 new, 1 updated

# Bidirectional sync
✓ Synced: sent 1 updated, received 3 new

# Nothing to sync
✓ Already in sync

# Multiple changes
✓ Synced: sent 2 new, 1 updated, received 1 deleted
```

**JSON format:**
```json
{
  "synced": true,
  "sent": { "new": 2, "updated": 1, "deleted": 0 },
  "received": { "new": 0, "updated": 0, "deleted": 0 }
}
```

**Summary formatting rules:**
- Omit zero counts (don’t say “sent 0 new”)
- Use singular/plural correctly: “1 new” vs “2 new”
- Order: new → updated → deleted
- Separate sent/received with comma if both present
- Use “Already in sync” when nothing changed

### Sync Progress Visibility

**Rule**: Never leave the user waiting without feedback.

**Problem:**
```bash
$ tbd sync
# ... 3 seconds of silence ...
✓ Synced: sent 1 updated
```

**Solution:**
```bash
$ tbd sync
⠋ Syncing with remote...
✓ Synced: sent 1 updated
```

**Implementation:**
- Start spinner immediately when sync begins
- Update spinner message for different phases if sync is long
- Replace spinner with final status on completion

## Implementation

### Key Components

#### 1. OutputManager

**File(s)**: `packages/tbd/src/cli/lib/output.ts`

Central class for all output operations:

```typescript
export class OutputManager {
  // Icon constants (private)
  private static readonly ICONS = {
    SUCCESS: '✓',  // U+2713
    ERROR: '✗',    // U+2717
    WARNING: '⚠',  // U+26A0
    NOTICE: '•',   // U+2022
  } as const;

  // Always shown
  data<T>(data: T, textFormatter?: (data: T) => void): void
  error(message: string, err?: Error): void  // ✗ red, stderr

  // Default+ (suppressed by --quiet)
  warn(message: string): void    // ⚠ yellow, stderr
  notice(message: string): void  // • blue, stdout (NEW)
  success(message: string): void // ✓ green, stdout

  // Verbose+ (requires --verbose or --debug)
  info(message: string): void    // dim, stderr
  command(cmd: string, args: string[]): void  // > dim, stderr

  // Debug only (requires --debug)
  debug(message: string): void   // [debug] dim, stderr

  // Other
  dryRun(message: string, details?: object): void
  spinner(message: string): Spinner
  getColors(): ColorFunctions
}
```

#### 2. Priority Utilities

**File(s)**: `packages/tbd/src/lib/priority.ts`

Format and parse priorities consistently:

```typescript
/** Format priority for display - always includes P prefix */
export function formatPriority(priority: number): string {
  return `P${priority}`;
}

/** Parse priority from user input - accepts "P1" or "1" */
export function parsePriority(input: string): number {
  const normalized = input.toUpperCase().replace(/^P/, '');
  const num = parseInt(normalized, 10);
  if (isNaN(num) || num < 0 || num > 4) {
    throw new Error(`Invalid priority: ${input}. Use P0-P4 or 0-4.`);
  }
  return num;
}
```

#### 2b. Status Formatting Utilities

**File(s)**: `packages/tbd/src/lib/status.ts`

Format status with icon consistently:

```typescript
/** Status icons - always use with status word */
const STATUS_ICONS: Record<string, string> = {
  open: '○',        // U+25CB - empty circle
  in_progress: '◐', // U+25D0 - half-filled circle
  blocked: '●',     // U+25CF - filled circle
  deferred: '○',    // U+25CB - empty circle (same as open)
  closed: '✓',      // U+2713 - checkmark
} as const;

/** Format status for display - always includes icon */
export function formatStatus(status: string): string {
  const icon = STATUS_ICONS[status] ?? '○';
  return `${icon} ${status}`;
}

/** Get status icon only (for special cases) */
export function getStatusIcon(status: string): string {
  return STATUS_ICONS[status] ?? '○';
}
```

**Usage:**
```typescript
// Always use formatStatus() for display
console.log(formatStatus('blocked'));     // "● blocked"
console.log(formatStatus('in_progress')); // "◐ in_progress"
console.log(formatStatus('open'));        // "○ open"
console.log(formatStatus('closed'));      // "✓ closed"
```

#### 2c. Text Truncation Utility

**File(s)**: `packages/tbd/src/lib/truncate.ts`

A standalone, reusable utility for truncating text with Unicode ellipsis.
This utility MUST be used everywhere text needs truncation for consistent behavior.

```typescript
/** Unicode ellipsis character */
export const ELLIPSIS = '…';  // U+2026

/**
 * Truncate text to fit within maxLength, adding ellipsis if needed.
 * Truncates on word boundaries when possible.
 *
 * @param text - The text to truncate
 * @param maxLength - Maximum length including ellipsis
 * @param options - Truncation options
 * @returns Truncated text with ellipsis if truncated
 */
export function truncate(
  text: string,
  maxLength: number,
  options?: {
    /** Truncate at word boundaries (default: true) */
    wordBoundary?: boolean;
    /** Custom ellipsis character (default: '…') */
    ellipsis?: string;
  },
): string {
  const { wordBoundary = true, ellipsis = ELLIPSIS } = options ?? {};

  if (text.length <= maxLength) {
    return text;
  }

  const truncateAt = maxLength - ellipsis.length;
  if (truncateAt <= 0) {
    return ellipsis.slice(0, maxLength);
  }

  let truncated = text.slice(0, truncateAt);

  // Truncate at word boundary if requested
  if (wordBoundary) {
    const lastSpace = truncated.lastIndexOf(' ');
    if (lastSpace > truncateAt * 0.5) {  // Only if we don't lose too much
      truncated = truncated.slice(0, lastSpace);
    }
  }

  return truncated.trimEnd() + ellipsis;
}

/**
 * Truncate text from the middle, keeping start and end visible.
 * Useful for paths and IDs.
 *
 * @param text - The text to truncate
 * @param maxLength - Maximum length including ellipsis
 * @returns Truncated text with ellipsis in middle
 */
export function truncateMiddle(
  text: string,
  maxLength: number,
): string {
  if (text.length <= maxLength) {
    return text;
  }

  const ellipsis = ELLIPSIS;
  const charsToShow = maxLength - ellipsis.length;
  if (charsToShow <= 0) {
    return ellipsis.slice(0, maxLength);
  }

  const frontChars = Math.ceil(charsToShow / 2);
  const backChars = Math.floor(charsToShow / 2);

  return text.slice(0, frontChars) + ellipsis + text.slice(-backChars);
}
```

**Usage:**
```typescript
import { truncate, truncateMiddle, ELLIPSIS } from '../lib/truncate.js';

// Basic truncation (word boundary by default)
truncate('Fix authentication timeout issues', 20);
// → "Fix authentication…"

// Truncation without word boundary
truncate('Fix authentication timeout', 20, { wordBoundary: false });
// → "Fix authenticatio…"

// Middle truncation (for paths/IDs)
truncateMiddle('is-01hx5zzkbkactav9wevgemmvrz', 15);
// → "is-01h…emmvrz"

// Check if truncation happened
const result = truncate(text, 50);
const wasTruncated = result.endsWith(ELLIPSIS);
```

**Rules:**
- Always use `…` (U+2026) - never use `...` (three dots)
- Prefer word boundary truncation for natural text
- Use middle truncation for paths, IDs, and technical strings
- All truncation in the CLI MUST use this utility (no ad-hoc truncation)

**Test Coverage Required:**
- Empty string handling
- String shorter than max (no truncation)
- String exactly at max (no truncation)
- String longer than max (truncation)
- Word boundary truncation preserves whole words
- Very short maxLength edge cases
- Unicode character handling
- Middle truncation with even/odd lengths

#### 3. CommandContext

**File(s)**: `packages/tbd/src/cli/lib/context.ts`

Tracks output mode settings:

```typescript
export interface CommandContext {
  dryRun: boolean;
  verbose: boolean;
  quiet: boolean;
  json: boolean;
  color: ColorOption;
  nonInteractive: boolean;
  debug: boolean;
}
```

#### 4. Color Functions

**File(s)**: `packages/tbd/src/cli/lib/output.ts`

Semantic color helpers:

```typescript
export function createColors(colorOption: ColorOption) {
  return {
    // Status colors
    success: colors.green,
    error: colors.red,
    warn: colors.yellow,
    info: colors.blue,

    // Semantic colors
    id: colors.cyan,
    label: colors.magenta,
    path: colors.blue,

    // Formatting
    bold: colors.bold,
    dim: colors.dim,
  };
}
```

## Usage Guidelines

### DO: Use OutputManager Methods

```typescript
// ✅ CORRECT: Use output methods - they handle icons, colors, visibility
output.error('Failed to sync', error);           // ✗ red, always shown
output.warn('Remote branch not found');          // ⚠ yellow, default+
output.notice('Kept local version');             // • blue, default+
output.success(`Created issue ${displayId}`);    // ✓ green, default+
output.info('Syncing with remote...');           // dim, verbose+
output.command('git', ['fetch', 'origin']);      // > dim, verbose+
output.debug(`Resolved ${displayId}`);           // [debug] dim, debug only
```

### DON’T: Use console Directly

```typescript
// ❌ WRONG: Direct console usage
console.log('Created issue ' + id);
console.error('[DEBUG] ' + message);
```

### DO: Let Methods Handle Visibility

```typescript
// ✅ CORRECT: Just call the method - it handles visibility internally
output.notice('Kept local version');  // Suppressed by --quiet automatically
output.info('Syncing...');            // Only shows with --verbose
output.debug(`Cache hit for ${id}`);  // Only shows with --debug

// DON'T check modes manually - the methods do this
// ❌ WRONG:
if (!this.ctx.quiet) {
  output.notice('...');  // Redundant - notice() already checks
}
```

### DON’T: Mix Output Channels

```typescript
// ❌ WRONG: Data to stderr
console.error(JSON.stringify(issues));

// ❌ WRONG: Debug to stdout
console.log('[debug] Loading issues');
```

### DO: Use Semantic Colors

```typescript
// ✅ CORRECT: Semantic color usage
console.log(`${colors.id(id)} ${colors.dim(status)}`);
console.log(colors.success('✓') + ' Operation complete');
```

### DON’T: Use Arbitrary Colors

```typescript
// ❌ WRONG: Arbitrary color choices
console.log(colors.magenta(id)); // IDs should be cyan
console.log(colors.blue('✓'));   // Success should be green
```

## References

- [picocolors](https://github.com/alexeyraspopov/picocolors) - Tiny color library
- [marked-terminal](https://github.com/mikaelbr/marked-terminal) - Markdown rendering
- [Commander.js](https://github.com/tj/commander.js) - CLI framework
- [12 Factor CLI Apps](https://medium.com/@jdxcode/12-factor-cli-apps-dd3c227a0e46) -
  CLI best practices
- [NO_COLOR](https://no-color.org/) - Color disable standard
