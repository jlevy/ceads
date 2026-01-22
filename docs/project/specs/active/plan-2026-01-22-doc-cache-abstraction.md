# Plan Spec: DocCache Abstraction and Shortcut System

## Purpose

This is a technical design doc for implementing a DocCache abstraction that provides
path-ordered markdown document lookups, enabling the `tbd shortcut` command to find and
use documentation templates by name.

The DocCache enables:

1. **Path-ordered lookups** - Like shell `$PATH`, directories are searched in order with
   earlier paths taking precedence
2. **Exact and fuzzy matching** - Find documents by filename or by fuzzy matching against
   frontmatter metadata
3. **Template distribution** - Pre-built shortcuts installed with tbd that users can
   customize or extend

## Background

tbd needs a way to provide reusable prompt templates and documentation that agents can
invoke by name. For example, when a user says "I want a new plan spec", the agent should
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

1. Takes an ordered list of directory paths (the "doc path")
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

- **New Feature**: This is entirely new functionality, no backward compatibility concerns
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

4. **Shortcut Command** (with subcommands)
   - `tbd shortcut` - Show help and explanation (from `shortcut-explanation.md`)
   - `tbd shortcut list` - List available shortcuts with titles/descriptions
   - `tbd shortcut get <name>` - Output named shortcut content
   - `tbd shortcut search <query>` - Fuzzy search and show matches
   - All subcommands support `--json` for structured output

5. **Configuration**
   - Default doc path: `['.tbd/docs/shortcuts']`
   - User can add paths in config.yml under `docs.paths`
   - Built-in shortcuts installed from package to `.tbd/docs/shortcuts/`

### Not in Scope

- Full-text search within document content
- Document editing/modification through tbd
- Remote document sources (only local filesystem)
- Document versioning or change detection

### Acceptance Criteria

1. `tbd shortcut` outputs help plus the shortcut-explanation.md content
2. `tbd shortcut get new-plan-spec` outputs the new-plan-spec template
3. `tbd shortcut search "plan"` shows matching shortcuts ranked by relevance
4. `tbd shortcut list` shows all available shortcuts with titles
5. User-added docs in `.tbd/docs/custom/` take precedence when configured first
6. All paths configured in settings.ts, not hardcoded

## Stage 2: Architecture Stage

### Fuzzy Matching Library Evaluation

Options considered:

| Library | Size | Features | Notes |
| --- | --- | --- | --- |
| **Fuse.js** | 29KB | Full-featured, configurable | Most popular, well-documented |
| **microfuzz** | 3KB | Simple, fast | Minimal, good for small datasets |
| **fast-fuzzy** | 12KB | Fast, good scoring | Good balance of features/size |
| **simple-fuzzy** | 2KB | Very minimal | Optimized for <1000 items |

**Recommendation**: Use **microfuzz** for its minimal size and simplicity. With dozens to
hundreds of documents, we don't need Fuse.js's advanced features. If microfuzz proves
insufficient, we can upgrade to fast-fuzzy or implement a simple Levenshtein-based
approach ourselves.

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
├── lib/
│   ├── doc-cache.ts          # DocCache class
│   └── settings.ts           # Path constants (NEW)
├── cli/commands/
│   └── shortcut.ts           # Shortcut command with subcommands
└── docs/
    └── shortcuts/            # Built-in shortcut templates
        ├── shortcut-explanation.md     # Explains shortcuts to agents
        ├── shortcut-new-plan-spec.md
        ├── shortcut-new-research-brief.md
        └── ...
```

### New Module: settings.ts

```typescript
// packages/tbd/src/lib/settings.ts

// Directory names (relative to .tbd/)
export const DOCS_DIR = 'docs';
export const SHORTCUTS_DIR = 'shortcuts';

// Full paths relative to .tbd/
export const TBD_DOCS_DIR = join(DOCS_DIR);                    // .tbd/docs/
export const TBD_SHORTCUTS_DIR = join(DOCS_DIR, SHORTCUTS_DIR); // .tbd/docs/shortcuts/

// Built-in docs source (in package)
export const BUILTIN_SHORTCUTS_DIR = 'shortcuts';  // Relative to src/docs/

// Default doc lookup paths (searched in order)
export const DEFAULT_DOC_PATHS = [
  TBD_SHORTCUTS_DIR,  // .tbd/docs/shortcuts/
];
```

### Config Schema Extension

```yaml
# .tbd/config.yml
display:
  id_prefix: tbd
settings:
  auto_sync: false
docs:
  paths:
    - .tbd/docs/shortcuts     # Default, can be removed
    - .tbd/docs/custom        # User-added custom docs
  # Future: could add remote sources, caching options, etc.
```

```typescript
// In schemas.ts
export const ConfigSchema = z.object({
  // ... existing fields ...
  docs: z.object({
    paths: z.array(z.string()).default(['.tbd/docs/shortcuts']),
  }).default({ paths: ['.tbd/docs/shortcuts'] }),
});
```

### DocCache Class Design

```typescript
// packages/tbd/src/lib/doc-cache.ts
import { readdir, readFile } from 'fs/promises';
import { join, basename } from 'path';
import matter from 'gray-matter';

export interface CachedDoc {
  path: string;
  name: string;
  frontmatter?: Record<string, unknown>;
  content: string;
}

export interface DocMatch {
  doc: CachedDoc;
  score: number;  // 1.0 = exact match, lower = fuzzier
}

export class DocCache {
  private docs: CachedDoc[] = [];
  private loaded = false;

  constructor(private paths: string[]) {}

  async load(): Promise<void> {
    // Load all .md files from paths in order
    // Earlier paths take precedence (for same filename)
  }

  get(name: string): DocMatch | null {
    // Exact match by filename (with/without .md)
    // Returns first match in path order with score 1.0
  }

  search(query: string, limit = 10): DocMatch[] {
    // Fuzzy search across filename, title, description
    // Returns matches sorted by score descending
  }

  list(): CachedDoc[] {
    // Return all cached documents
  }
}
```

### Shortcut Command Design

The shortcut command uses subcommands rather than positional arguments, following the
pattern of other tbd commands like `tbd config`.

```typescript
// packages/tbd/src/cli/commands/shortcut.ts
export function registerShortcutCommand(program: Command): void {
  const shortcut = program
    .command('shortcut')
    .description('Find and use documentation shortcuts')
    .action(async () => {
      // Default action: show help + explanation
      const cache = await loadDocCache();
      const explanation = cache.get('shortcut-explanation');
      if (explanation) {
        console.log(explanation.doc.content);
      }
      shortcut.help();
    });

  shortcut
    .command('list')
    .description('List all available shortcuts')
    .option('--json', 'Output as JSON')
    .action(async (options) => {
      const cache = await loadDocCache();
      const docs = cache.list();
      // Output formatted list with title, description
    });

  shortcut
    .command('get <name>')
    .description('Output a shortcut by name (exact match)')
    .option('--json', 'Output as JSON with metadata')
    .action(async (name, options) => {
      const cache = await loadDocCache();
      const match = cache.get(name);
      if (!match) {
        throw new CLIError(`Shortcut not found: ${name}`);
      }
      // Output document content (the instructions for the agent)
    });

  shortcut
    .command('search <query>')
    .description('Fuzzy search for shortcuts')
    .option('--limit <n>', 'Maximum results', '10')
    .option('--json', 'Output as JSON')
    .action(async (query, options) => {
      const cache = await loadDocCache();
      const matches = cache.search(query, parseInt(options.limit));
      // Output matches with scores
    });
}
```

### Shortcut Explanation File

A special file `shortcut-explanation.md` is displayed when running `tbd shortcut` with
no subcommand. This explains the shortcut system to agents:

```markdown
---
title: Shortcut System Explanation
description: How tbd shortcuts work for agents
---

# tbd Shortcuts

Shortcuts are reusable instructions for common tasks. When you need to perform a
standard workflow, use `tbd shortcut get <name>` to retrieve the instructions.

## How to Use

1. **Find a shortcut**: `tbd shortcut search "plan spec"` or `tbd shortcut list`
2. **Get instructions**: `tbd shortcut get new-plan-spec`
3. **Follow the instructions**: The shortcut content tells you what to do

## What Shortcuts Contain

Each shortcut is a markdown document with step-by-step instructions. These may include:
- Creating beads with `tbd create`
- Running other shortcuts
- File operations and git workflows
- Prompts for gathering information from the user

## Example Workflow

User: "I want to create a new research brief"
Agent:
1. Run `tbd shortcut get new-research-brief`
2. Follow the instructions in the output
3. The instructions may say to create a bead, copy a template, etc.
```

### Installation Flow

During `tbd init` or `tbd setup`:

1. Create `.tbd/docs/shortcuts/` directory
2. Copy built-in shortcuts from package to that directory
3. Add `docs.paths` to config.yml with default value

This allows users to:
- Modify shipped shortcuts (they're in their repo)
- Add new shortcuts alongside shipped ones
- Override shipped shortcuts by adding same-named file earlier in path

### Path Resolution

```
doc path: ['.tbd/docs/custom', '.tbd/docs/shortcuts']

Lookup: "new-plan-spec"

1. Check .tbd/docs/custom/new-plan-spec.md → not found
2. Check .tbd/docs/custom/shortcut-new-plan-spec.md → not found
3. Check .tbd/docs/shortcuts/new-plan-spec.md → not found
4. Check .tbd/docs/shortcuts/shortcut-new-plan-spec.md → FOUND!

Result: .tbd/docs/shortcuts/shortcut-new-plan-spec.md (score: 1.0)
```

For fuzzy matching, if no exact match:

```
Query: "plan spec"

Score all documents:
- shortcut-new-plan-spec.md: 0.85 (contains "plan" and "spec")
- shortcut-implement-spec.md: 0.6 (contains "spec")
- shortcut-coding-spike.md: 0.2 (low match)

Return sorted by score, apply path order for tie-breaking.
```

## Stage 3: Refine Architecture

### Reusable Components

**Existing utilities to leverage:**

1. `packages/tbd/src/file/parser.ts` - Has `parseFrontmatter()` for YAML parsing
2. `packages/tbd/src/utils/file-utils.ts` - File reading utilities
3. `packages/tbd/src/lib/paths.ts` - Path constant patterns

**Pattern to follow:**

The existing `loadDataContext()` pattern in `data-context.ts` shows how to load and cache
file-based data. DocCache should follow similar patterns.

### Simplification Decisions

1. **No external fuzzy library initially** - Implement simple scoring first:
   - Exact match = 1.0
   - Prefix match = 0.9
   - Contains all query words = 0.8
   - Contains some query words = 0.7 × (matched/total)

   This covers 90% of use cases. Add microfuzz later if needed.

2. **Eager loading** - With dozens of files, load all upfront. No need for lazy loading
   complexity.

3. **Filename normalization** - Strip `shortcut-` prefix automatically for lookups:
   - `shortcut-new-plan-spec.md` matches "new-plan-spec"
   - This allows clean command syntax: `tbd shortcut new-plan-spec`

4. **Copy on init, not on every run** - Shortcuts are copied once during init/setup.
   Users can update with `tbd setup --auto` which refreshes built-in docs.

## Stage 4: Implementation

### Phase 1: DocCache Core + Exact Matching

- [ ] Create `packages/tbd/src/lib/settings.ts` with path constants
- [ ] Create `packages/tbd/src/lib/doc-cache.ts` with DocCache class
- [ ] Implement `load()` method to scan directories and parse markdown
- [ ] Implement `get()` method for exact filename matching
- [ ] Implement `list()` method to return all documents
- [ ] Add unit tests for DocCache

### Phase 2: Fuzzy Matching (Optional)

- [ ] Implement simple scoring algorithm in DocCache
- [ ] Implement `search()` method for fuzzy lookups
- [ ] Add tests for fuzzy matching edge cases
- [ ] Evaluate if external library needed, add microfuzz if so

### Phase 3: Shortcut Command

- [ ] Create `packages/tbd/src/cli/commands/shortcut.ts`
- [ ] Implement default action (show explanation + help)
- [ ] Implement `list` subcommand with title/description output
- [ ] Implement `get <name>` subcommand for exact lookup
- [ ] Implement `search <query>` subcommand for fuzzy matching
- [ ] Add --json flag support to all subcommands
- [ ] Register command in cli.ts
- [ ] Create `shortcut-explanation.md` explaining how shortcuts work for agents

### Phase 4: Configuration Integration

- [ ] Extend ConfigSchema with `docs.paths` field
- [ ] Update settings.ts with doc path constants
- [ ] Resolve doc paths relative to tbd root directory
- [ ] Support absolute and relative paths in config

### Phase 5: Built-in Shortcuts Installation

- [ ] Move/copy existing shortcuts to `packages/tbd/src/docs/shortcuts/`
- [ ] Add frontmatter (title, description) to all shortcut files
- [ ] Update `tbd init` to create `.tbd/docs/shortcuts/` directory
- [ ] Update `tbd setup` to copy built-in shortcuts to `.tbd/docs/shortcuts/`
- [ ] Add version comment for upgrade detection

### Phase 6: Documentation & Testing

- [ ] Add shortcut command to CLI help
- [ ] Update SKILL.md with shortcut usage
- [ ] Add integration tests for shortcut command
- [ ] Add golden tests for shortcut output formats
- [ ] Document configuration options in tbd-design.md

## Open Questions

1. **Shortcut file naming convention**: Should we keep the `shortcut-` prefix in
   filenames, or use plain names like `new-plan-spec.md`?

   **Recommendation**: Keep `shortcut-` prefix in source, but strip it for lookups.
   This keeps the source directory organized while allowing clean command syntax.

2. **Should shortcuts be editable by users?**

   **Recommendation**: Yes, copy to user's repo so they can customize. Provide
   `tbd setup --auto` to refresh/update if needed.

3. **How to handle shortcut updates when tbd is upgraded?**

   **Recommendation**: On `tbd setup --auto`, detect version mismatch and prompt/auto-
   update. Add version comment to each file:
   ```markdown
   <!-- tbd-shortcut-version: 0.1.5 -->
   ```

4. **Should we support subdirectories in doc paths?**

   **Recommendation**: Phase 1: No, flat directories only. Phase 2: Add recursive
   option if needed.

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

The `title` and `description` are used for fuzzy matching. Tags are optional metadata
for future categorization/filtering.

### Error Handling

- Missing directory: Log warning, skip (don't fail)
- Invalid markdown: Log warning, skip file
- No frontmatter: Document still works, just no metadata for fuzzy search
- Empty doc path: Use default paths from settings.ts

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
| `DocCache` | Path-ordered markdown document cache with lookup |
| `settings.ts` | Centralized path constants |
| `config.yml` docs.paths | User-configurable doc directories |
| `tbd shortcut` | CLI command with `list`, `get`, `search` subcommands |
| `shortcut-explanation.md` | Explains shortcuts to agents (shown by default) |
| `.tbd/docs/shortcuts/` | User-editable copy of built-in shortcuts |

**Key principle**: Configuration in `config.yml`, constants in `settings.ts`, no
hardcoded paths in command implementations.

**Usage flow**:
1. User runs `tbd setup --auto` → shortcuts installed to `.tbd/docs/shortcuts/`
2. User asks agent "I want a new plan spec"
3. Agent runs `tbd shortcut` to understand the system (first time)
4. Agent runs `tbd shortcut get new-plan-spec`
5. DocCache finds `shortcut-new-plan-spec.md` → outputs content
6. Agent follows the instructions, which may include:
   - Creating beads with `tbd create`
   - Running other shortcuts
   - Copying template files
   - Asking the user for clarification
