# Feature: Document Size and Token Counts

**Date:** 2026-01-29 **Author:** Joshua Levy **Status:** Draft

## Overview

Add approximate token counts and human-readable byte sizes to all documentation listing
commands (`tbd shortcut --list`, `tbd guidelines --list`, `tbd template --list`). This
helps users and agents understand context window costs when loading shortcuts,
guidelines, or templates.

## Goals

- Display size (bytes/KB) and approximate token count for each document in `--list`
  output
- Provide consistent, human-readable formatting across all doc listing commands
- Include size/token metadata in JSON output for programmatic access
- Enable informed decisions about context window usage

## Non-Goals

- Exact token counting (approximation is sufficient)
- Model-specific token counts (use a reasonable universal estimate)
- Tracking historical size changes
- Setting size limits or warnings (future feature)

## Background

When agents load shortcuts, guidelines, or templates, each consumes context window
tokens. Currently there’s no visibility into how “expensive” each document is.
A large guideline might consume 5,000+ tokens while a small one uses 500. Users and
agents benefit from knowing approximate costs before loading.

### Token Estimation Approach

For simplicity, we’ll use a character-based approximation rather than a tokenizer
library:
- **~3.5 characters per token** for mixed markdown/code content
- Pure English prose averages ~~4-5 chars/token, but code/symbols average ~~3
  chars/token
- Our docs (markdown with code examples) fall in between at ~3.5
- This avoids dependency on tiktoken or similar libraries
- Accuracy within 15-20% is sufficient for this use case

Note: OpenAI’s o200k_base and cl100k_base tokenizers, as well as Claude’s tokenizer,
produce similar ratios for English/code content.

## Design

### Data Model Changes

Extend `CachedDoc` interface in `doc-cache.ts`:

```typescript
interface CachedDoc {
  path: string;
  name: string;
  frontmatter?: DocFrontmatter;
  content: string;
  sourceDir: string;
  // New fields:
  sizeBytes: number;        // File size in bytes
  approxTokens: number;     // Estimated token count
}
```

### Global Settings

Add to `packages/tbd/src/lib/paths.ts` (centralized constants):

```typescript
// =============================================================================
// Token Estimation Settings
// =============================================================================

/**
 * Characters per token ratio for estimating token counts.
 *
 * Based on research of OpenAI (tiktoken) and Claude tokenizers:
 * - Pure English prose: ~4-5 chars/token
 * - Code and symbols: ~3 chars/token
 * - Mixed markdown/code docs: ~3.5 chars/token
 *
 * We use 3.5 as our docs are markdown with code examples.
 * This provides ~15-20% accuracy, sufficient for cost estimation.
 */
export const CHARS_PER_TOKEN = 3.5;
```

### Utility Functions

Add to a new file `packages/tbd/src/lib/format-utils.ts`:

```typescript
import prettyBytes from 'pretty-bytes';
import { CHARS_PER_TOKEN } from './paths.js';

/**
 * Estimate token count from text content.
 * Uses CHARS_PER_TOKEN setting (~3.5 for markdown/code content).
 */
export function estimateTokens(text: string): number {
  return Math.ceil(text.length / CHARS_PER_TOKEN);
}

/**
 * Format token count with "~" prefix (e.g., "~1.2k tok", "~450 tok").
 */
export function formatTokens(tokens: number): string {
  if (tokens >= 1000) {
    return `~${(tokens / 1000).toFixed(1)}k tok`;
  }
  return `~${tokens} tok`;
}

/**
 * Format doc size for display: "(1.8 kB, ~450 tok)"
 * Used by both shortcut and doc-command-handler list output.
 */
export function formatDocSize(sizeBytes: number, approxTokens: number): string {
  return `(${prettyBytes(sizeBytes)}, ${formatTokens(approxTokens)})`;
}
```

Note: Uses `pretty-bytes` library for consistent, well-tested byte formatting.
See “Human-Readable Formatting Standardization” section below for rationale.

### Output Format Changes

#### Text Output (Human-Readable)

Current format:
```
code-review-and-commit (.tbd/docs/shortcuts/standard)
   Commit Code: Run pre-commit checks, review changes, and commit code
```

New format:
```
code-review-and-commit (1.8 KB, ~450 tok)
   Commit Code: Run pre-commit checks, review changes, and commit code
```

Design decisions:
- Replace source directory with size info (source dir adds clutter, rarely needed)
- Keep size info concise: `(X.X KB, ~Nk tok)` or `(N B, ~N tok)`
- Parentheses and dimmed styling for visual separation

#### JSON Output

Add fields to JSON structure:

```json
{
  "name": "code-review-and-commit",
  "title": "Commit Code",
  "description": "Run pre-commit checks...",
  "path": "/full/path/to/code-review-and-commit.md",
  "sourceDir": ".tbd/docs/shortcuts/standard",
  "sizeBytes": 1843,
  "approxTokens": 461,
  "shadowed": false
}
```

### Code Reuse Strategy

**IMPORTANT**: `shortcut.ts` and `doc-command-handler.ts` currently have duplicated code
for list formatting (`extractFallbackText`, `printWrappedDescription`, `wrapAtWord`).
The token/size formatting MUST be centralized to avoid further duplication.

Approach:
1. Add formatting functions to `format-utils.ts` (new shared module)
2. Both `ShortcutHandler` and `DocCommandHandler` import and use these utilities
3. The size/token info is computed in `DocCache` and formatted via shared utilities

This ensures a single source of truth for:
- Token estimation (`estimateTokens`)
- Size formatting (`formatBytes`)
- Token formatting (`formatTokens`)
- Combined doc size display (`formatDocSize` - new helper)

### Files to Modify

| File | Changes |
| --- | --- |
| `package.json` | Add `pretty-bytes` and `pretty-ms` dependencies |
| `src/lib/paths.ts` | Add `CHARS_PER_TOKEN` constant |
| `src/lib/format-utils.ts` | New file: token/size/time formatting utilities |
| `src/file/doc-cache.ts` | Calculate `sizeBytes`/`approxTokens` when loading; add to `CachedDoc` |
| `src/cli/lib/doc-command-handler.ts` | Import from format-utils, update `handleList()` to show size |
| `src/cli/commands/shortcut.ts` | Import from format-utils, update `handleList()` to show size |
| `src/cli/commands/attic.ts` | Use `formatTimeAgo()` for timestamp display |
| `src/cli/commands/search.ts` | Show "last synced Xm ago" in refresh message |
| `src/lib/schemas.ts` | Update CachedDoc type if schema-defined |

## Implementation Plan

### Phase 1: Dependencies and Utilities

- [ ] Add `pretty-bytes` and `pretty-ms` dependencies to `package.json`
- [ ] Add `CHARS_PER_TOKEN` constant to `paths.ts`
- [ ] Create `format-utils.ts` with all formatting utilities:
  - `estimateTokens(text)` - character-based token estimation
  - `formatTokens(count)` - “~1.2k tok” format
  - `formatDocSize(bytes, tokens)` - “(1.8 kB, ~450 tok)” format
  - `formatTimeAgo(date)` - “2d ago” format using pretty-ms
  - `formatTimestamp(date)` - human-friendly absolute timestamp
  - Re-export `prettyBytes` and `prettyMs` for direct use

### Phase 2: Doc Size Display

- [ ] Update `DocCache` to calculate `sizeBytes` and `approxTokens` when loading docs
- [ ] Update `DocCommandHandler.handleList()` to display size/token info
- [ ] Update `shortcut.ts` list output to match (uses shared `formatDocSize`)
- [ ] Update JSON output to include `sizeBytes` and `approxTokens` fields

### Phase 3: Relative Time Display

- [ ] Update `attic.ts` list command to use `formatTimeAgo()` for timestamp column
- [ ] Update `attic.ts` show command to format local/remote update times
- [ ] Update `search.ts` to show “last synced Xm ago” in refresh message

### Phase 4: Testing

- [ ] Add unit tests for format-utils functions (tokens, bytes, time)
- [ ] Verify `tbd shortcut --list` shows size/token info
- [ ] Verify `tbd guidelines --list` shows size/token info
- [ ] Verify `tbd template --list` shows size/token info
- [ ] Verify `tbd attic list` shows relative timestamps
- [ ] Verify `tbd attic show` shows relative timestamps
- [ ] Verify `--json` output includes new fields
- [ ] Visual inspection of formatting at various terminal widths

## Testing Strategy

### Unit Tests (`format-utils.test.ts`)

- `estimateTokens()`: Verify ~3.5 chars/token ratio
- `formatTokens()`: Test "~~450 tok" and "~~1.2k tok" formats
- `formatDocSize()`: Test combined output format
- `formatTimeAgo()`: Test various durations (seconds, minutes, hours, days)
- `formatTimestampAgo()`: Test ISO string parsing and invalid input handling

### Integration Tests

- `tbd shortcut --list`: Verify size/token info in output
- `tbd guidelines --list`: Verify size/token info in output
- `tbd template --list`: Verify size/token info in output
- `tbd attic list`: Verify relative timestamps in output
- JSON output: Verify `sizeBytes` and `approxTokens` fields present

### Manual Verification

- Visual inspection at various terminal widths
- Verify formatting consistency across all commands
- Test edge cases: 0 bytes, very large files, timestamps in the past/future

## Human-Readable Formatting Standardization

### Current State Audit

The codebase has minimal human-readable formatting currently:
- `time-utils.ts`: Only ISO 8601 timestamp handling, no relative time display
- `toFixed(2)`: Used in two places for score display (shortcut.ts,
  doc-command-handler.ts)
- No byte/size formatting
- No duration formatting

### Recommendation: Use sindresorhus Libraries

For consistent, well-tested human-readable formatting, adopt these widely-used
libraries:

| Library | Purpose | Weekly Downloads | Example |
| --- | --- | --- | --- |
| [pretty-bytes](https://github.com/sindresorhus/pretty-bytes) | Bytes → human string | 12M+ | `1337` → `1.34 kB` |
| [pretty-ms](https://github.com/sindresorhus/pretty-ms) | Milliseconds → human string | 12M+ | `1337000000` → `15d 11h 23m 20s` |

Both are:
- Zero dependencies
- ESM-native (matches our `"type": "module"`)
- MIT licensed
- Actively maintained by sindresorhus
- Industry standard (used by thousands of packages)

### Proposed Utility Module

Create `packages/tbd/src/lib/format-utils.ts` as a comprehensive formatting module:

```typescript
/**
 * Human-readable formatting utilities for tbd CLI.
 *
 * Uses sindresorhus libraries for consistent, well-tested formatting:
 * - pretty-bytes: Byte sizes (1337 → "1.34 kB")
 * - pretty-ms: Durations (3600000 → "1h")
 */

import prettyBytes from 'pretty-bytes';
import prettyMs from 'pretty-ms';
import { CHARS_PER_TOKEN } from './paths.js';

// Re-export for direct use when needed
export { prettyBytes, prettyMs };

// =============================================================================
// Token Estimation
// =============================================================================

/**
 * Estimate token count from text content.
 * Uses CHARS_PER_TOKEN (~3.5) for markdown/code content.
 */
export function estimateTokens(text: string): number {
  return Math.ceil(text.length / CHARS_PER_TOKEN);
}

/**
 * Format token count: "~1.2k tok" or "~450 tok"
 */
export function formatTokens(tokens: number): string {
  if (tokens >= 1000) {
    return `~${(tokens / 1000).toFixed(1)}k tok`;
  }
  return `~${tokens} tok`;
}

// =============================================================================
// Size Formatting
// =============================================================================

/**
 * Format doc size for list display: "(1.8 kB, ~450 tok)"
 */
export function formatDocSize(sizeBytes: number, approxTokens: number): string {
  return `(${prettyBytes(sizeBytes)}, ${formatTokens(approxTokens)})`;
}

// =============================================================================
// Time Formatting
// =============================================================================

/**
 * Format relative time from Date: "2d ago", "3h ago", "5m ago"
 * Uses compact format for concise display.
 */
export function formatTimeAgo(date: Date): string {
  const ms = Date.now() - date.getTime();
  if (ms < 0) return 'just now';
  if (ms < 60000) return 'just now'; // Less than 1 minute
  return `${prettyMs(ms, { compact: true })} ago`;
}

/**
 * Format relative time from ISO timestamp string.
 * Returns null if timestamp is invalid.
 */
export function formatTimestampAgo(timestamp: string | undefined | null): string | null {
  if (!timestamp) return null;
  const date = new Date(timestamp);
  if (isNaN(date.getTime())) return null;
  return formatTimeAgo(date);
}

/**
 * Format duration in milliseconds: "2h 15m", "3d 4h"
 * Uses verbose format for clarity.
 */
export function formatDuration(ms: number): string {
  return prettyMs(ms, { verbose: true });
}

/**
 * Format duration compactly: "2h", "3d"
 * Uses compact format for tables and tight spaces.
 */
export function formatDurationCompact(ms: number): string {
  return prettyMs(ms, { compact: true });
}
```

### Benefits

1. **Consistency**: All human-readable output uses the same conventions
2. **Localization-ready**: Libraries handle edge cases (0 bytes, negative, etc.)
3. **Tested**: Battle-tested by millions of users
4. **Maintainable**: No custom formatting code to maintain
5. **Future use**: `prettyMs` enables relative time display for issues, sync status

### Places to Apply pretty-ms (Included in This Spec)

Systematic audit of all timestamp display locations in the codebase:

| Command | File | Current Format | New Format | User Impact |
| --- | --- | --- | --- | --- |
| `tbd attic list` | `attic.ts:137` | ISO 8601 column | "2d ago" | High - conflict history |
| `tbd attic show` | `attic.ts:185-186` | ISO timestamps | "Updated 2h ago" | High - merge context |
| `tbd stale` | `stale.ts:128` | Integer days | "2w ago" or keep days | Medium - staleness |
| `tbd search` | `search.ts:85` | No time shown | "Refreshing (last synced 8m ago)" | Medium - sync status |
| `tbd sync --status` | `sync.ts` | Not implemented | "Last synced 15m ago" | Medium - sync status |
| `tbd list` (future) | `list.ts` | No time shown | Optional "updated 3d ago" column | Low - could add |
| `tbd show` (future) | `show.ts` | ISO timestamps | "Created 5d ago, updated 2h ago" | Low - could add |

#### Priority Order for Implementation

**Phase 1 (This Spec):**
1. `attic list` - Replace ISO timestamp column with relative time
2. `attic show` - Format local/remote update times as relative
3. `search` - Add “last synced Xm ago” to refresh message

**Phase 2 (Future Spec):** 4. `stale` - Consider “2w ago” format (current days format is
already useful) 5. `sync --status` - Add relative time for last sync 6. `list`/`show` -
Optional relative time display

### New Dependencies

Add to `packages/tbd/package.json`:

```json
"dependencies": {
  "pretty-bytes": "^7.0.0",
  "pretty-ms": "^9.0.0"
}
```

| Package | Size (minified) | Weekly Downloads | Purpose |
| --- | --- | --- | --- |
| pretty-bytes | ~2 KB | 12M+ | Byte formatting |
| pretty-ms | ~3 KB | 12M+ | Duration/time formatting |

Combined size: ~5 KB minified (negligible impact on package size).

## Open Questions

1. **Should source directory still be shown?** Current proposal removes it from text
   output to reduce clutter.
   Could add `--verbose` flag to show both if needed.

2. **Token estimate precision?** The 3.5 chars/token approximation should be within
   15-20% for our markdown/code docs.
   Adding tiktoken (~2MB) or Anthropic’s tokenizer would give exact counts but adds
   complexity. Approximation seems acceptable.

3. **Relative time verbosity?** Using `compact: true` gives “2d” vs “2 days”.
   Should we use verbose format ("2 days ago") for some contexts?
   Current proposal uses compact everywhere for consistency.

## References

- [doc-cache.ts](../../packages/tbd/src/file/doc-cache.ts) - Document loading/caching
- [doc-command-handler.ts](../../packages/tbd/src/cli/lib/doc-command-handler.ts) - List
  formatting
- [shortcut.ts](../../packages/tbd/src/cli/commands/shortcut.ts) - Shortcut command
