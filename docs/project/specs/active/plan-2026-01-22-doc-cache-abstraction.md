# Plan Spec: DocCache Abstraction and Shortcut System

## Purpose

This is a technical design doc for implementing a DocCache abstraction that provides
path-ordered markdown document lookups, enabling the `tbd shortcut` command to find and
use documentation templates by name.

The DocCache enables:

1. **Path-ordered lookups** - Like shell `$PATH`, directories are searched in order with
   earlier paths taking precedence
2. **Exact and fuzzy matching** - Find documents by filename or by fuzzy matching
   against frontmatter metadata
3. **Template distribution** - Pre-built shortcuts installed with tbd that users can
   customize or extend

## Background

tbd needs a way to provide reusable prompt templates and documentation that agents can
invoke by name. For example, when a user says “I want a new plan spec”, the agent should
be able to run `tbd shortcut new-plan-spec` which finds and outputs the appropriate
template.

The system should:

- Ship with pre-built shortcuts (from `docs/general/agent-shortcuts/`)
- Allow users to customize or add their own shortcuts
- Support both exact lookups by filename and approximate/fuzzy matching
- Work with YAML frontmatter for metadata-based searching

### Related Work

- The existing `docs/general/agent-shortcuts/` directory contains shortcut templates
- The `tbd skill` command outputs documentation, showing the pattern of docs-as-commands
- The config.yml already supports extensible configuration

## Summary of Task

### Part 1: DocCache Library

Create a `DocCache` class that:

1. Takes an ordered list of directory paths (the “doc path”)
2. Loads all `*.md` files from those directories
3. Parses YAML frontmatter (if present) for metadata
4. Supports exact lookup by filename (with/without `.md` extension)
5. Supports fuzzy lookup against filename + frontmatter title/description

### Part 2: Shortcut Command

Implement `tbd shortcut <name>` that:

1. Uses DocCache to find the named document
2. Outputs the document content (for agents to use as instructions)
3. Lists available shortcuts when called without arguments

### Part 3: Configuration

1. Define path constants in `settings.ts` (not hardcoded)
2. Add `docs.paths` config in `config.yml` for custom doc directories
3. Copy built-in shortcuts to `.tbd/docs/shortcuts/` at init time

## Backward Compatibility

- **New Feature**: This is entirely new functionality, no backward compatibility
  concerns
- **Config Extension**: Adds new `docs` section to config.yml, existing configs remain
  valid

## Stage 1: Planning Stage

### Feature Requirements

1. **DocCache Core**
   - Constructor accepts ordered array of directory paths
   - Loads markdown files lazily or eagerly (evaluate tradeoffs)
   - Parses frontmatter with gray-matter or similar
   - Caches parsed documents in memory

2. **Lookup Methods**
   - `get(name: string)` - Exact match by filename (with/without .md)
   - `search(query: string)` - Fuzzy search across filename, title, description
   - Both return matched document(s) with score (1.0 = exact match)

3. **Document Model**
   ```typescript
   interface CachedDoc {
     path: string;           // Full filesystem path
     name: string;           // Filename without extension
     frontmatter?: {
       title?: string;
       description?: string;
       [key: string]: unknown;
     };
     content: string;        // Full file content (including frontmatter)
   }
   ```

4. **Shortcut Command** (single command with flags)
   - `tbd shortcut` - Show explanation (from `shortcut-explanation.md`) + help
   - `tbd shortcut <name-or-description>` - Find and output shortcut (exact match first,
     then fuzzy)
   - `tbd shortcut --list` - List active shortcuts with source path in muted text
   - `tbd shortcut --list --all` - Include shadowed shortcuts (aliased by earlier path)
   - Supports `--json` for structured output

5. **Configuration**
   - Doc paths are **relative to the tbd root** (parent of `.tbd/`)
   - Also supports absolute paths and `~/` home-relative paths
   - Default doc path: `['.tbd/docs/shortcuts/system', '.tbd/docs/shortcuts/standard']`
   - User can add paths in config.yml under `docs.paths`
   - Built-in docs installed to `.tbd/docs/shortcuts/system/` and
     `.tbd/docs/shortcuts/standard/`

### Not in Scope

- Full-text search within document content
- Document editing/modification through tbd
- Remote document sources (only local filesystem)
- Document versioning or change detection

### Acceptance Criteria

1. `tbd shortcut` outputs shortcut-explanation.md content + command help
2. `tbd shortcut new-plan-spec` outputs the new-plan-spec template (exact match)
3. `tbd shortcut "create a plan"` fuzzy-matches and outputs best match
4. `tbd shortcut --list` shows active shortcuts with source path in muted text
5. `tbd shortcut --list --all` includes shadowed shortcuts from later paths
6. User-added docs in earlier paths take precedence (shadow later paths)
7. All paths configured in settings.ts, not hardcoded

## Stage 2: Architecture Stage

### Fuzzy Matching Library Evaluation

Options considered:

| Library | Size | Features | Notes |
| --- | --- | --- | --- |
| **Fuse.js** | 29KB | Full-featured, configurable | Most popular, well-documented |
| **microfuzz** | 3KB | Simple, fast | Minimal, good for small datasets |
| **fast-fuzzy** | 12KB | Fast, good scoring | Good balance of features/size |
| **simple-fuzzy** | 2KB | Very minimal | Optimized for <1000 items |

**Recommendation**: Use **microfuzz** for its minimal size and simplicity.
With dozens to hundreds of documents, we don’t need Fuse.js’s advanced features.
If microfuzz proves insufficient, we can upgrade to fast-fuzzy or implement a simple
Levenshtein-based approach ourselves.

Alternative approach: Implement our own simple scoring:
1. Exact filename match = 1.0
2. Filename starts with query = 0.9
3. Filename contains query = 0.8
4. Title/description contains query = 0.7
5. Otherwise use simple substring distance

This keeps dependencies minimal and is sufficient for our use case.

### File Structure

```
packages/tbd/src/
├── file/
│   ├── doc-cache.ts          # DocCache class (uses fs/promises)
│   └── ...                   # Existing file modules (parser.ts, storage.ts)
├── lib/
│   └── paths.ts              # Path constants (extend existing file)
├── cli/commands/
│   └── shortcut.ts           # Shortcut command
└── docs/
    └── shortcuts/
        ├── system/           # System docs (skill.md, shortcut-explanation.md)
        │   ├── skill.md                  # Main SKILL.md content
        │   ├── skill-brief.md            # Brief skill summary
        │   └── shortcut-explanation.md   # Explains shortcuts to agents
        └── standard/         # Standard shortcut templates
            ├── new-plan-spec.md
            ├── new-research-brief.md
            ├── commit-code.md
            └── ...
```

**Note**: DocCache is placed in `file/` (not `lib/`) because it uses `fs/promises` for
file operations. Per guidelines, `lib/` should remain node-free for library/CLI hybrids.

### Extend paths.ts (not new file)

Add the following constants to the existing `packages/tbd/src/lib/paths.ts`:

```typescript
// packages/tbd/src/lib/paths.ts (extend existing file)
import { join } from 'path';

// Existing constants...
export const TBD_DIR = '.tbd';
// ...

// === NEW: Documentation/Shortcuts paths ===

/** Subdirectory names for docs structure */
export const DOCS_DIR = 'docs';
export const SHORTCUTS_DIR = 'shortcuts';
export const SYSTEM_DIR = 'system';
export const STANDARD_DIR = 'standard';

/** Full paths relative to tbd root (parent of .tbd/) */
export const TBD_DOCS_DIR = join(TBD_DIR, DOCS_DIR);                     // .tbd/docs/
export const TBD_SHORTCUTS_DIR = join(TBD_DOCS_DIR, SHORTCUTS_DIR);      // .tbd/docs/shortcuts/
export const TBD_SHORTCUTS_SYSTEM = join(TBD_SHORTCUTS_DIR, SYSTEM_DIR); // .tbd/docs/shortcuts/system/
export const TBD_SHORTCUTS_STANDARD = join(TBD_SHORTCUTS_DIR, STANDARD_DIR); // .tbd/docs/shortcuts/standard/

/** Built-in docs source paths (relative to package src/docs/) */
export const BUILTIN_SHORTCUTS_SYSTEM = join('shortcuts', 'system');
export const BUILTIN_SHORTCUTS_STANDARD = join('shortcuts', 'standard');

/** Default doc lookup paths (searched in order, relative to tbd root) */
export const DEFAULT_DOC_PATHS = [
  TBD_SHORTCUTS_SYSTEM,    // .tbd/docs/shortcuts/system/
  TBD_SHORTCUTS_STANDARD,  // .tbd/docs/shortcuts/standard/
];
```

**Note**: Extend the existing `paths.ts` rather than creating a new `settings.ts` file
to follow established patterns and avoid duplication.

### Config Schema Extension

Paths in `docs.paths` support three formats:
- **Relative paths** - resolved relative to the parent of `.tbd/` (e.g.,
  `.tbd/docs/shortcuts/system`)
- **Absolute paths** - used as-is (e.g., `/usr/share/tbd/shortcuts`)
- **Home-relative paths** - expanded from `~` (e.g., `~/my-shortcuts`)

```yaml
# .tbd/config.yml
display:
  id_prefix: tbd
settings:
  auto_sync: false
docs:
  paths:
    - .tbd/docs/shortcuts/system    # Relative to repo root
    - .tbd/docs/shortcuts/standard  # Relative to repo root
    - .tbd/docs/custom              # User-added custom docs
    - ~/my-global-shortcuts         # Home-relative path
    - /opt/team/shared-shortcuts    # Absolute path
  # Future: could add remote sources, caching options, etc.
```

```typescript
// In schemas.ts
export const ConfigSchema = z.object({
  // ... existing fields ...
  docs: z.object({
    // Paths relative to repository root
    paths: z.array(z.string()).default([
      '.tbd/docs/shortcuts/system',
      '.tbd/docs/shortcuts/standard',
    ]),
  }).default({ paths: ['.tbd/docs/shortcuts/system', '.tbd/docs/shortcuts/standard'] }),
});
```

### DocCache Class Design

```typescript
// packages/tbd/src/file/doc-cache.ts
import { readdir, readFile } from 'fs/promises';
import { join, basename } from 'path';
import { parseFrontmatter } from './parser';  // Reuse existing utility

// === Scoring Constants ===
/** Score for exact filename match */
export const SCORE_EXACT_MATCH = 1.0;
/** Score when query is a prefix of filename */
export const SCORE_PREFIX_MATCH = 0.9;
/** Score when filename contains all query words */
export const SCORE_CONTAINS_ALL = 0.8;
/** Base score for partial word matches (multiplied by matched/total ratio) */
export const SCORE_PARTIAL_BASE = 0.7;
/** Minimum score threshold to return a fuzzy match result */
export const SCORE_MIN_THRESHOLD = 0.5;

/** Frontmatter fields used for shortcut documents */
export interface DocFrontmatter {
  /** Display title for the shortcut */
  title?: string;
  /** Brief description for fuzzy matching and listing */
  description?: string;
  /** Optional categorization tags */
  tags?: string[];
}

/** A cached document loaded from the doc path */
export interface CachedDoc {
  /** Full filesystem path to the document */
  path: string;
  /** Filename without extension (used for lookups) */
  name: string;
  /** Parsed YAML frontmatter, if present */
  frontmatter?: DocFrontmatter;
  /** Full file content (including frontmatter for output) */
  content: string;
  /** Which directory in the path this doc came from */
  sourceDir: string;
}

/** A document match with relevance score */
export interface DocMatch {
  doc: CachedDoc;
  /** Match score: 1.0 = exact, lower = fuzzier */
  score: number;
}

export class DocCache {
  private docs: CachedDoc[] = [];
  private allDocs: CachedDoc[] = [];  // Including shadowed
  private seenNames = new Set<string>();  // Track names for shadowing
  private loaded = false;

  constructor(private readonly paths: string[]) {}

  async load(): Promise<void> {
    // Load all .md files from paths in order
    // Track both active docs (first occurrence) and all docs (including shadowed)
    // Use parseFrontmatter() from parser.ts for consistency
  }

  get(name: string): DocMatch | null {
    // Exact match by filename (with/without .md)
    // Returns first match in path order with score SCORE_EXACT_MATCH
  }

  search(query: string, limit = 10): DocMatch[] {
    // Fuzzy search across filename, title, description
    // Use SCORE_* constants for scoring
    // Returns matches sorted by score descending
  }

  list(includeAll = false): CachedDoc[] {
    // Return active documents (default) or all including shadowed
    return includeAll ? this.allDocs : this.docs;
  }

  isShadowed(doc: CachedDoc): boolean {
    // Check if this doc is shadowed by an earlier path
  }
}
```

**Notes**:
- Reuses existing `parseFrontmatter()` from `parser.ts` instead of importing gray-matter
  directly
- Uses named constants for all scoring thresholds (no magic numbers)
- `DocFrontmatter` interface provides type safety instead of `Record<string, unknown>`
````

### Shortcut Command Design

The shortcut command uses a single argument (name or description) with optional flags.

```typescript
// packages/tbd/src/cli/commands/shortcut.ts
import pc from 'picocolors';  // Per guidelines: always use picocolors for terminal colors
import { getCommandContext } from '../lib/context';
import { createOutput } from '../lib/output';  // OutputManager for proper stdout/stderr
import { DocCache, SCORE_MIN_THRESHOLD } from '../../file/doc-cache';

export function registerShortcutCommand(program: Command): void {
  program
    .command('shortcut [query]')
    .description('Find and output documentation shortcuts')
    .option('--list', 'List all available shortcuts')
    .option('--all', 'Include shadowed shortcuts (use with --list)')
    .option('--json', 'Output as JSON')
    .action(async (query, options, command) => {
      const ctx = getCommandContext(command);
      const out = createOutput(ctx);
      const cache = await loadDocCache();
      await cache.load();

      if (options.list) {
        // List mode: show all shortcuts with source paths
        const docs = cache.list(options.all);

        if (ctx.json) {
          out.json(docs.map(d => ({
            name: d.name,
            title: d.frontmatter?.title,
            path: d.path,
            shadowed: cache.isShadowed(d),
          })));
          return;
        }

        for (const doc of docs) {
          const shadowed = cache.isShadowed(doc);
          const title = doc.frontmatter?.title ?? doc.name;
          const source = relativePath(doc.sourceDir);

          if (shadowed) {
            // Muted style for shadowed entries (use picocolors)
            out.log(pc.dim(`  ${title}  (${source}) [shadowed]`));
          } else {
            out.log(title);
            out.log(pc.dim(`  ${source}`));
          }
        }
        return;
      }

      if (!query) {
        // No query: show explanation + help
        const explanation = cache.get('shortcut-explanation');
        if (explanation) {
          out.log(explanation.doc.content);
        }
        command.help();
        return;
      }

      // Query provided: try exact match first, then fuzzy
      const exactMatch = cache.get(query);
      if (exactMatch) {
        if (ctx.json) {
          out.json({ doc: exactMatch.doc, score: exactMatch.score });
        } else {
          out.log(exactMatch.doc.content);
        }
        return;
      }

      // Fuzzy match
      const matches = cache.search(query, 1);
      if (matches.length === 0) {
        throw new CLIError(`No shortcut found matching: ${query}`);
      }

      const best = matches[0];
      if (best.score < SCORE_MIN_THRESHOLD) {
        // Low confidence - show suggestions instead
        out.log(`No exact match for "${query}". Did you mean:`);
        for (const m of cache.search(query, 5)) {
          out.log(`  ${m.doc.frontmatter?.title ?? m.doc.name} ${pc.dim(`(score: ${m.score.toFixed(2)})`)}`);
        }
        return;
      }

      // Good fuzzy match - output it
      if (ctx.json) {
        out.json({ doc: best.doc, score: best.score });
      } else {
        out.log(best.doc.content);
      }
    });
}
````

**Notes**:
- Uses `picocolors` (aliased as `pc`) for terminal styling per guidelines
- Uses `OutputManager` via `createOutput()` for proper stdout/stderr separation
- Supports both text and JSON output modes via context
- Uses `SCORE_MIN_THRESHOLD` constant instead of magic number 0.5

### Example Output

```
$ tbd shortcut --list
skill
  .tbd/docs/shortcuts/system
skill-brief
  .tbd/docs/shortcuts/system
shortcut-explanation
  .tbd/docs/shortcuts/system
new-plan-spec
  .tbd/docs/shortcuts/standard
new-research-brief
  .tbd/docs/shortcuts/standard
commit-code
  .tbd/docs/custom

$ tbd shortcut --list --all
skill
  .tbd/docs/shortcuts/system
skill-brief
  .tbd/docs/shortcuts/system
shortcut-explanation
  .tbd/docs/shortcuts/system
new-plan-spec
  .tbd/docs/shortcuts/standard
new-research-brief
  .tbd/docs/shortcuts/standard
commit-code
  .tbd/docs/custom
  commit-code  (.tbd/docs/shortcuts/standard) [shadowed]
```

### Shortcut Explanation File

A special file `shortcut-explanation.md` is displayed when running `tbd shortcut` with
no argument. This explains the shortcut system to agents:

```markdown
---
title: Shortcut System Explanation
description: How tbd shortcuts work for agents
---

# tbd Shortcuts

Shortcuts are reusable instructions for common tasks. Give a name or description
and tbd will find the matching shortcut and output its instructions.

## How to Use

1. **Find by name**: `tbd shortcut new-plan-spec` (exact match)
2. **Find by description**: `tbd shortcut "create a plan"` (fuzzy match)
3. **List all**: `tbd shortcut --list`
4. **Follow the instructions**: The shortcut content tells you what to do

## What Shortcuts Contain

Each shortcut is a markdown document with step-by-step instructions. These may include:
- Creating beads with `tbd create`
- Running other shortcuts
- File operations and git workflows
- Prompts for gathering information from the user

## Example Workflow

User: "I want to create a new research brief"
Agent:
1. Run `tbd shortcut new-research-brief`
2. Follow the instructions in the output
3. The instructions may say to create a bead, copy a template, etc.
```

### Installation Flow

During `tbd init` or `tbd setup`:

1. Create `.tbd/docs/shortcuts/system/` directory
2. Create `.tbd/docs/shortcuts/standard/` directory
3. Copy built-in system docs (skill.md, skill-brief.md, shortcut-explanation.md) to
   system/
4. Copy built-in shortcut templates to standard/
5. Add `docs.paths` to config.yml with default paths

**File writing**: Use `atomically` library for all file writes to prevent
partial/corrupted files during installation.
This writes to a temp file first, then atomically renames.

This allows users to:
- Modify shipped shortcuts (they’re in their repo)
- Add new shortcuts alongside shipped ones
- Override shipped shortcuts by adding same-named file earlier in path

### Path Resolution

```
doc path: ['.tbd/docs/custom', '.tbd/docs/shortcuts/system', '.tbd/docs/shortcuts/standard']

Lookup: "new-plan-spec"

1. Check .tbd/docs/custom/new-plan-spec.md → not found
2. Check .tbd/docs/shortcuts/system/new-plan-spec.md → not found
3. Check .tbd/docs/shortcuts/standard/new-plan-spec.md → FOUND!

Result: .tbd/docs/shortcuts/standard/new-plan-spec.md (score: SCORE_EXACT_MATCH = 1.0)
```

**Note**: Files in `standard/` use plain names (e.g., `new-plan-spec.md`) without any
prefix.

For fuzzy matching, if no exact match:

```
Query: "plan spec"

Score all documents using SCORE_* constants:
- new-plan-spec.md: SCORE_CONTAINS_ALL (0.8) - contains "plan" and "spec"
- implement-spec.md: SCORE_PARTIAL_BASE * 0.5 (0.35) - contains "spec" only
- coding-spike.md: 0.1 - low match

Return sorted by score descending, path order for tie-breaking.
```

## Stage 3: Refine Architecture

### Reusable Components

**Existing utilities to leverage:**

1. `packages/tbd/src/file/parser.ts` - Has `parseFrontmatter()` for YAML parsing
2. `packages/tbd/src/utils/file-utils.ts` - File reading utilities
3. `packages/tbd/src/lib/paths.ts` - Path constant patterns

**Pattern to follow:**

The existing `loadDataContext()` pattern in `data-context.ts` shows how to load and
cache file-based data.
DocCache should follow similar patterns.

### Simplification Decisions

1. **No external fuzzy library initially** - Implement simple scoring using named
   constants:
   - `SCORE_EXACT_MATCH` = 1.0
   - `SCORE_PREFIX_MATCH` = 0.9
   - `SCORE_CONTAINS_ALL` = 0.8
   - `SCORE_PARTIAL_BASE` = 0.7 (multiplied by matched/total ratio)

   This covers 90% of use cases.
   Add microfuzz later if needed.

2. **Eager loading** - With dozens of files, load all upfront.
   No need for lazy loading complexity.

3. **Plain filenames** - No `shortcut-` prefix in filenames.
   The `system/` and `standard/` directory structure provides sufficient organization.
   Lookup by filename directly:
   - `new-plan-spec.md` matches query “new-plan-spec”
   - `skill.md` matches query “skill”

4. **Copy on init, not on every run** - Shortcuts are copied once during init/setup.
   Users can update with `tbd setup --auto` which refreshes built-in docs.
   Use `atomically` library for all file writes.

## Stage 4: Implementation

**Epic**: tbd-d847 - DocCache Abstraction and Shortcut System

### Phase 1: DocCache Core + Exact Matching (COMPLETED)

- [x] Extend `packages/tbd/src/lib/paths.ts` with doc path constants
- [x] Create `packages/tbd/src/file/doc-cache.ts` with DocCache class
  - Define scoring constants (SCORE_EXACT_MATCH, etc.)
    with docstrings
  - Define DocFrontmatter interface with typed fields
- [x] Implement `load()`, `get()`, and `list()` methods
  - Use gray-matter package to parse frontmatter
- [x] Add unit tests for DocCache (`doc-cache.test.ts`)

### Phase 2: Fuzzy Matching (COMPLETED)

- [x] Implement simple scoring algorithm in DocCache
- [x] Implement `search()` method for fuzzy lookups
- [x] Add tests for fuzzy matching edge cases

### Phase 3: Shortcut Command (COMPLETED)

- [x] Create shortcut command with default action (show explanation + help)
- [x] Implement query matching (exact first, then fuzzy)
- [x] Implement `--list` and `--all` flags with source path display
- [x] Create `shortcut-explanation.md` system doc

### Phase 4: Configuration Integration

- [x] Extend ConfigSchema in `schemas.ts` with `docs.paths` field
- [ ] **tbd-s12p** Implement path resolution utility in `paths.ts`
  - Add `resolveDocPath()` for relative, absolute, ~/ paths

### Phase 5: Built-in Shortcuts Installation

- [x] Create `packages/tbd/src/docs/shortcuts/system/` with skill.md, skill-brief.md,
  shortcut-explanation.md
- [x] Create `packages/tbd/src/docs/shortcuts/standard/` with workflow shortcuts (plain
  names, no prefix)
- [ ] **tbd-ukbi** Update `tbd init` to create `.tbd/docs/shortcuts/{system,standard}/`
- [ ] **tbd-z6ke** Update `tbd setup` to copy built-in docs using `atomically` library
  - Add version comment (<!-- tbd-version: X.Y.Z -->)

### Phase 6: Documentation & Testing

Per testing guidelines, include specific test types:

- [x] Add shortcut command to CLI help
- [ ] **tbd-ls9y** Update SKILL.md with shortcut usage
- [x] Document configuration options in tbd-design.md
- [x] Unit tests (`doc-cache.test.ts`):
  - Test `get()` exact matching with/without .md extension
  - Test `search()` scoring algorithm with various queries
  - Test `list()` with and without shadowed docs
  - Test path ordering (earlier paths take precedence)
  - Test error handling (missing dirs, invalid markdown)
- [ ] **tbd-cgb8** Golden tests (`shortcut.golden.test.ts`):
  - Capture CLI output for `tbd shortcut --list`
  - Capture CLI output for `tbd shortcut <name>`
  - Capture CLI output for `tbd shortcut --list --all` (with shadowed)
  - Capture JSON output mode
- [ ] **tbd-x3zq** Integration tests (`shortcut.integration.test.ts`):
  - Full command flow from CLI to file system
  - Config loading with custom doc paths
  - Installation flow (copying shortcuts during setup)

## Open Questions

1. **Shortcut file naming convention**: Should we keep the `shortcut-` prefix in
   filenames, or use plain names like `new-plan-spec.md`?

   **Decision**: Use plain names without prefix in both `system/` and `standard/`
   directories. The directory structure (`system/` vs `standard/`) provides sufficient
   organization. This simplifies lookups and avoids prefix-stripping complexity.

   Examples:
   - `.tbd/docs/shortcuts/system/skill.md` (not `shortcut-skill.md`)
   - `.tbd/docs/shortcuts/standard/new-plan-spec.md` (not `shortcut-new-plan-spec.md`)

2. **Should shortcuts be editable by users?**

   **Recommendation**: Yes, copy to user’s repo so they can customize.
   Provide `tbd setup --auto` to refresh/update if needed.

3. **How to handle shortcut updates when tbd is upgraded?**

   **Recommendation**: On `tbd setup --auto`, detect version mismatch and prompt/auto-
   update. Add version comment to each file:
   ```markdown
   <!-- tbd-shortcut-version: 0.1.5 -->
   ```

4. **Should we support subdirectories in doc paths?**

   **Recommendation**: Phase 1: No, flat directories only.
   Phase 2: Add recursive option if needed.

## Implementation Notes

### Frontmatter Schema for Shortcuts

```yaml
---
title: New Plan Spec
description: Create a new feature planning specification document
tags:
  - planning
  - specs
  - documentation
---
```

The `title` and `description` are used for fuzzy matching.
Tags are optional metadata for future categorization/filtering.

### Error Handling

Per guidelines, wrap errors with context when catching:

- **Missing directory**: Log warning with path context, skip (don’t fail)
  `console.warn(\`Shortcut directory not found, skipping: ${dirPath}\`)`
- **Invalid markdown**: Log warning with file path and error details, skip file
  `console.warn(\`Failed to parse shortcut ${filePath}: ${error.message}\`)`
- **No frontmatter**: Document still works, just no metadata for fuzzy search
- **Empty doc path**: Use default paths from paths.ts (TBD_SHORTCUTS_SYSTEM,
  TBD_SHORTCUTS_STANDARD)
- **Permission error**: Log warning with context, continue with remaining paths
  `console.warn(\`Cannot read shortcut directory ${dirPath}: ${error.message}\`)`

### Performance Considerations

- Typical scale: 10-100 documents
- Memory: ~1KB per document average = 100KB max
- Load time: <100ms for 100 files on SSD
- Caching: Load once per command invocation (stateless CLI)

Future optimization if needed:
- File modification time-based cache invalidation
- Lazy loading with LRU cache
- Pre-computed search index

## Design Summary

| Component | Purpose |
| --- | --- |
| `file/doc-cache.ts` | Path-ordered markdown document cache with lookup |
| `lib/paths.ts` | Centralized path constants (extended, not new file) |
| `config.yml` docs.paths | User-configurable doc directories |
| `tbd shortcut` | CLI command: `<query>`, `--list`, `--list --all` |
| `.tbd/docs/shortcuts/system/` | System docs (skill.md, shortcut-explanation.md) |
| `.tbd/docs/shortcuts/standard/` | Standard shortcut templates (new-plan-spec.md, etc.) |

**Key principles**:
- Configuration in `config.yml`, constants in `paths.ts`, no hardcoded paths
- DocCache in `file/` directory (not `lib/`) because it uses fs/promises
- Use `picocolors` for terminal styling, `OutputManager` for output
- Use `atomically` for file writes, `parseFrontmatter()` for YAML parsing
- Named constants for all scoring thresholds (no magic numbers)

**Usage flow**:
1. User runs `tbd setup --auto` → shortcuts installed to
   `.tbd/docs/shortcuts/{system,standard}/`
2. User asks agent “I want a new plan spec”
3. Agent runs `tbd shortcut` to understand the system (first time, optional)
4. Agent runs `tbd shortcut new-plan-spec` (or `tbd shortcut "plan spec"`)
5. DocCache searches system/ then standard/ → finds `standard/new-plan-spec.md`
6. Agent follows the instructions, which may include:
   - Creating beads with `tbd create`
   - Running other shortcuts
   - Copying template files
   - Asking the user for clarification

**System vs Standard docs**:
- `system/` - Core docs like skill.md, skill-brief.md, shortcut-explanation.md
- `standard/` - Workflow shortcuts like new-plan-spec.md, commit-code.md
