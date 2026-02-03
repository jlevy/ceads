# Feature: SKILL.md Comprehensive Update

**Date:** 2026-02-02

**Author:** Claude with Joshua Levy

**Status:** In Progress

## Progress Summary

| Phase | Description | Status |
| --- | --- | --- |
| Phase 1 | Update Source Files | ✅ Complete |
| Phase 2 | Regenerate and Verify | ✅ Complete |
| Phase 3 | YAML Technical Debt Cleanup | 🔲 Pending |

* * *

## Overview

Update the tbd SKILL.md to fully represent the scope of tbd and all its capabilities.
As tbd grows in scope, the skill file must accurately cover all behavior so agents can
rapidly determine whether tbd can help with a given task.
The skill is triggered by keywords in the description, so comprehensive trigger coverage
is critical.

## Goals

- Ensure agents recognize tbd should be invoked for all relevant user requests
- Prominently feature key trigger words: **beads**, **shortcuts**, **issues**,
  **specs**, **code review**
- Cover all tbd capabilities including recent additions (cleanup, handoffs, checkout)
- Expand the User Request → Agent Action table for better agent guidance
- Add missing commands to the reference section

## Non-Goals

- Changing tbd CLI functionality
- Restructuring the skill file format
- Adding new shortcuts or guidelines

* * *

# Phase 1: Update Source Files ✅ COMPLETE

## Background

Users often say things like “use beads” or “use the shortcut” and agents need to
immediately recognize this skill applies.
The current SKILL.md is good but has gaps compared to the README and doesn’t cover all
capabilities.

The generated `.claude/skills/tbd/SKILL.md` comes from two source files:

- `packages/tbd/docs/install/claude-header.md` - frontmatter (name, description,
  allowed-tools)
- `packages/tbd/docs/shortcuts/system/skill.md` - main content

Plus the shortcut/guideline directory is auto-appended during `tbd setup`.

## Gap Analysis

### Current Description (claude-header.md)

```
Git-native issue tracking (beads), coding guidelines, and spec-driven planning for AI agents.
Use for tracking issues with dependencies, creating and closing bugs, features, and tasks,
planning specs for new features, implementing features from specs, code reviews, committing code,
creating PRs, research briefs, and architecture docs. Invoke when user mentions: tbd, shortcuts, beads,
issues, bugs, tasks, todo, tracking, specs, planning, implementation, validation, guidelines,
shortcuts, templates, commit, PR workflows, code review, testing best practices, or monorepo patterns.
```

### Missing Capabilities

| Capability | README Emphasis |
| --- | --- |
| **Knowledge injection** | One of the 4 pillars - "self-injected context for agents to get smarter" |
| **bd/Beads replacement** | Drop-in replacement, simpler architecture, no daemon/SQLite issues |
| **Code cleanup workflows** | `code-cleanup-all`, `code-cleanup-tests`, `code-cleanup-docstrings` |
| **Agent handoffs** | `agent-handoff` shortcut for session continuity |
| **Third-party source checkout** | `checkout-third-party-repo` - unique capability for library review |
| **Labels and search** | `tbd label`, `tbd search` commands |
| **Custom docs from URLs** | `--add` for external guidelines/shortcuts/templates |

### Missing Trigger Keywords

Current triggers are missing these important terms:

- `bd` (the original Beads CLI name)
- `features`, `epics` (issue types)
- `TDD`, `test-driven`
- `golden testing`, `snapshot testing`
- `TypeScript`, `Python`, `Convex` (specific guideline topics)
- `cleanup`, `dead code`, `refactor`
- `handoff`
- `research`, `architecture`
- `labels`, `search`
- `checkout library`, `source code review`
- `pull request` (in addition to PR)

### Missing Commands in Skill Reference

| Command | Purpose |
| --- | --- |
| `tbd search <query>` | Search issues by text |
| `tbd label add/remove <id> <label>` | Manage labels |
| `tbd label list` | List all labels in use |
| `tbd stale` | List issues not updated recently |
| `tbd doctor --fix` | Auto-fix repository problems |

### Missing User Request → Agent Action Mappings

| User Says | Should Run |
| --- | --- |
| "Clean up this code" / "Remove dead code" | `tbd shortcut code-cleanup-all` |
| "Hand off to another agent" | `tbd shortcut agent-handoff` |
| "Check out / review this library's source" | `tbd shortcut checkout-third-party-repo` |
| "Merge main into my branch" | `tbd shortcut merge-upstream` |
| "Search issues for X" | `tbd search "X"` |
| "Add label X to issue Y" | `tbd label add <id> <label>` |
| "What issues are stale?" | `tbd stale` |
| "Fix repository problems" | `tbd doctor --fix` |

## Implementation (Complete)

### Task 1: Update claude-header.md description ✅

**New description:**

```yaml
---
name: tbd
description: >-
  Git-native issue tracking (beads), coding guidelines, knowledge injection, and spec-driven
  planning for AI agents. Drop-in replacement for bd/Beads with simpler architecture.

  Use for: tracking issues/beads with dependencies, creating bugs/features/tasks, planning specs,
  implementing features from specs, code reviews, committing code, creating PRs, loading coding
  guidelines (TypeScript, Python, TDD, golden testing, Convex, monorepo patterns), code cleanup,
  research briefs, architecture docs, agent handoffs, and checking out third-party library source code.

  Invoke when user mentions: tbd, beads, bd, shortcuts, issues, bugs, tasks, features, epics, todo,
  tracking, specs, planning, implementation, validation, guidelines, templates, commit, PR, pull request,
  code review, testing, TDD, test-driven, golden testing, snapshot testing, TypeScript, Python, Convex,
  monorepo, cleanup, dead code, refactor, handoff, research, architecture, labels, search, checkout library,
  source code review, or any workflow shortcut.
allowed-tools: Bash(tbd:*), Read, Write
---
```

### Task 2: Update skill.md intro (4 pillars) ✅

**New intro:**

```markdown
**`tbd` helps humans and agents ship code with greater speed, quality, and discipline.**

1. **Beads**: Git-native issue tracking (tasks, bugs, features).
   Never lose work across sessions. Drop-in replacement for `bd`.
2. **Spec-Driven Workflows**: Plan features → break into beads → implement
   systematically.
3. **Knowledge Injection**: 17+ engineering guidelines (TypeScript, Python, TDD,
   testing, Convex, monorepos) available on demand.
4. **Shortcuts**: Reusable instruction templates for common workflows (code review,
   commits, PRs, cleanup, handoffs).
```

### Task 3: Expand User Request → Agent Action table ✅

Replaced with categorized, expanded version covering Issues/Beads, Planning & Specs,
Code Review & Commits, Guidelines & Knowledge, Documentation, Cleanup & Maintenance, and
Sessions & Handoffs.

### Task 4: Add Labels & Search commands section ✅

Added new section with `tbd search`, `tbd label`, and `tbd stale` commands.

### Task 5: Update Dependencies & Sync section ✅

Added `tbd doctor --fix` to existing table.

* * *

# Phase 2: Regenerate and Verify ✅ COMPLETE

- [x] Run `tbd setup --auto` to regenerate SKILL.md
- [x] Verify all changes appear in generated file
- [x] Verify budget constraints met:
  - Description: ~1,019 chars (within 1,024 limit)
  - Total skill footprint: ~1,128 chars (well within 15K cumulative budget)
  - SKILL.md lines: 247 (within 500 guideline)
- [x] Documented skill description budget constraints in guidelines

## Detailed Comparison: Old vs New Description

| Aspect | OLD | NEW | Status |
| --- | --- | --- | --- |
| **Core capabilities** |  |  |  |
| Git-native issue tracking (beads) | Yes | Yes | Kept |
| Coding guidelines | Yes | Yes | Kept |
| Spec-driven planning | Yes | Yes | Kept |
| Knowledge injection | No | Yes | **Added** |
| bd/Beads replacement | No | Yes | **Added** |
| **Use cases** |  |  |  |
| Tracking issues with dependencies | Yes | Yes | Kept |
| Creating/closing bugs, features, tasks | Yes | Yes | Kept |
| Planning specs | Yes | Yes | Kept |
| Implementing from specs | Yes | Yes | Kept |
| Code reviews | Yes | Yes | Kept |
| Committing code | Yes | Yes | Kept |
| Creating PRs | Yes | Yes | Kept |
| Research briefs | Yes | Yes | Kept |
| Architecture docs | Yes | Yes | Kept |
| Loading coding guidelines (with specifics) | No | Yes | **Added** |
| Code cleanup | No | Yes | **Added** |
| Agent handoffs | No | Yes | **Added** |
| Checkout third-party source | No | Yes | **Added** |
| **Trigger keywords** |  |  |  |
| tbd | Yes | Yes | Kept |
| beads | Yes | Yes | Kept |
| bd | No | Yes | **Added** |
| shortcuts | Yes (2x) | Yes | Kept (fixed dup) |
| issues | Yes | Yes | Kept |
| bugs | Yes | Yes | Kept |
| tasks | Yes | Yes | Kept |
| features | No | Yes | **Added** |
| epics | No | Yes | **Added** |
| todo | Yes | Yes | Kept |
| tracking | Yes | Yes | Kept |
| specs | Yes | Yes | Kept |
| planning | Yes | Yes | Kept |
| implementation | Yes | Yes | Kept |
| validation | Yes | Yes | Kept |
| guidelines | Yes | Yes | Kept |
| templates | Yes | Yes | Kept |
| commit | Yes | Yes | Kept |
| PR workflows | Yes | Yes (PR, pull request) | Kept/improved |
| code review | Yes | Yes | Kept |
| testing best practices | Yes | Yes (testing) | Kept |
| monorepo patterns | Yes | Yes (monorepo) | Kept |
| TDD, test-driven | No | Yes | **Added** |
| golden testing, snapshot testing | No | Yes | **Added** |
| TypeScript | No | Yes | **Added** |
| Python | No | Yes | **Added** |
| Convex | No | Yes | **Added** |
| cleanup, dead code, refactor | No | Yes | **Added** |
| handoff | No | Yes | **Added** |
| research | No | Yes | **Added** |
| architecture | No | Yes | **Added** |
| labels | No | Yes | **Added** |
| search | No | Yes | **Added** |
| checkout library, source code review | No | Yes | **Added** |
| any workflow shortcut | No | Yes | **Added** |

* * *

# Phase 3: YAML Technical Debt Cleanup 🔲 PENDING

**Tracking:** tbd-hl7d (epic)

During Phase 2 verification, discovered that YAML handling across the codebase is
inconsistent and has accumulated technical debt.
The generated SKILL.md has YAML frontmatter issues where multiline descriptions are not
properly quoted, causing them to be parsed as multiple YAML keys instead of a single
description value.

## Problem Statement

The codebase has multiple approaches to YAML parsing and writing:

1. **Inconsistent libraries**: Both `gray-matter` and `yaml` packages are used,
   sometimes in the same file
2. **Manual string reconstruction**: `markdown-utils.ts` manually reconstructs YAML
   instead of using library stringify functions
3. **Missing Zod validation**: Many files parse YAML without schema validation, despite
   schemas existing
4. **Inconsistent error handling**: Some files use `parseYamlWithConflictDetection`,
   others use raw `parseYaml`

## Technical Debt Audit

**Files with YAML parsing:**

| File | Library | Zod Validation | Issues |
| --- | --- | --- | --- |
| `parser.ts` | gray-matter + yaml | ✓ IssueSchema | Good - uses custom engine |
| `config.ts` | yaml | ✓ ConfigSchema | Good |
| `id-mapping.ts` | yaml (via yaml-utils) | ✗ Raw cast | Missing schema |
| `attic.ts` | yaml | ✗ Raw cast | AtticEntrySchema exists but unused |
| `search.ts` | yaml | ✗ Raw cast | LocalStateSchema exists but unused |
| `prefix-detection.ts` | yaml | ✗ Raw cast | Missing schema |
| `doc-cache.ts` | gray-matter | ✗ Raw cast | Missing frontmatter schema |
| `markdown-utils.ts` | gray-matter | N/A | **Manual reconstruction - main bug** |

**The core issue in `markdown-utils.ts`:**

```typescript
// Current approach (lines 44-66) - BROKEN
const lines: string[] = [];
for (const [key, value] of Object.entries(data)) {
  lines.push(`${key}: ${String(value)}`);  // Doesn't quote special chars!
}
frontmatter = lines.join('\n');
```

This fails when values contain `: ` patterns (like “Use for: tracking”) because they
appear as separate YAML keys when parsed.

## Design: Unified YAML Handling

**Principle 1: Use `yaml` package for all stringify operations**

The `yaml` package (v2.x) properly handles:

- Quoting strings with special characters
- Block scalars for multiline strings
- Consistent formatting options

**Principle 2: Use gray-matter with custom yaml engine for frontmatter**

`parser.ts` already does this correctly:

```typescript
const matterOptions: GrayMatterOption<string, typeof matterOptions> = {
  engines: {
    yaml: {
      parse: (str: string): object => parseYaml(str) as object,
      stringify: (obj: object): string => stringifyYaml(obj),
    },
  },
};
```

**Principle 3: Always validate with Zod schemas after parsing**

Every YAML parse should be followed by schema validation:

```typescript
const raw = parseYaml(content);
const validated = SomeSchema.parse(raw);  // Throws on invalid data
```

**Principle 4: Use `parseYamlWithConflictDetection` for user-editable files**

Files that could have merge conflicts should use the wrapper that provides helpful
errors.

## Implementation Tasks

### Task 3.1: Fix markdown-utils.ts to use yaml package stringify

**Current (broken):**

```typescript
export function parseMarkdown(content: string): ParsedMarkdown {
  const parsed = matter(normalized);
  // Manual reconstruction - breaks on special characters
  const lines: string[] = [];
  for (const [key, value] of Object.entries(data)) {
    lines.push(`${key}: ${String(value)}`);
  }
  frontmatter = lines.join('\n');
}
```

**Fixed:**

```typescript
import { stringify as stringifyYaml } from 'yaml';

export function parseMarkdown(content: string): ParsedMarkdown {
  const parsed = matter(normalized);
  const data = parsed.data;

  if (data && Object.keys(data).length > 0) {
    // Use yaml package for proper stringification
    frontmatter = stringifyYaml(data, {
      lineWidth: 0,  // Don't wrap lines
      defaultStringType: 'QUOTE_DOUBLE',  // Quote strings with special chars
    }).trim();
  }
}
```

### Task 3.2: Add Zod schemas for missing file types

Create schemas in `schemas.ts`:

```typescript
// ID mapping file schema
export const IdMappingSchema = z.record(z.string(), z.string());

// Beads config schema (for prefix detection)
export const BeadsConfigSchema = z.object({
  prefix: z.string().optional(),
}).passthrough();  // Allow unknown fields

// Doc frontmatter schema
export const DocFrontmatterSchema = z.object({
  name: z.string().optional(),
  description: z.string().optional(),
  categories: z.array(z.string()).optional(),
}).passthrough();
```

### Task 3.3: Update files to use Zod validation

| File | Change |
| --- | --- |
| `id-mapping.ts` | Add `IdMappingSchema.parse()` after yaml parse |
| `attic.ts` | Add `AtticEntrySchema.parse()` after yaml parse |
| `search.ts` | Use existing `LocalStateSchema.parse()` |
| `prefix-detection.ts` | Add `BeadsConfigSchema.parse()` |
| `doc-cache.ts` | Add `DocFrontmatterSchema.parse()` |

### Task 3.4: Standardize error handling

Update all YAML parse sites to use `parseYamlWithConflictDetection` for user files:

```typescript
// User-editable files (issues, config, etc.)
const data = parseYamlWithConflictDetection(content, filePath);

// Internal files (id mappings, state, etc.)
const data = parseYaml(content);
```

### Task 3.5: Add comprehensive tests

```typescript
describe('YAML handling', () => {
  it('properly quotes strings with colon patterns', () => {
    const input = { description: 'Use for: tracking. Invoke when: mentioned.' };
    const yaml = stringifyYaml(input);
    const reparsed = parseYaml(yaml);
    expect(reparsed.description).toBe(input.description);
  });

  it('handles multiline strings correctly', () => {
    const input = { description: 'Line one.\nLine two.' };
    const yaml = stringifyYaml(input);
    const reparsed = parseYaml(yaml);
    expect(reparsed.description).toBe(input.description);
  });
});
```

## Acceptance Criteria

- [ ] All YAML stringify operations use `yaml` package, not manual string concatenation
- [ ] All YAML parse operations are followed by Zod schema validation
- [ ] `parseYamlWithConflictDetection` used for user-editable files
- [ ] Generated SKILL.md parses correctly with only 3 top-level keys (name, description,
  allowed-tools)
- [ ] Test coverage for YAML edge cases (colons, newlines, quotes)
- [ ] No TypeScript `as` casts for YAML parse results (use Zod instead)

## Files to Modify

1. `packages/tbd/src/utils/markdown-utils.ts` - Use yaml stringify
2. `packages/tbd/src/lib/schemas.ts` - Add missing schemas
3. `packages/tbd/src/file/id-mapping.ts` - Add Zod validation
4. `packages/tbd/src/cli/commands/attic.ts` - Use existing AtticEntrySchema
5. `packages/tbd/src/cli/commands/search.ts` - Use existing LocalStateSchema
6. `packages/tbd/src/cli/lib/prefix-detection.ts` - Add Zod validation
7. `packages/tbd/src/file/doc-cache.ts` - Add frontmatter schema
8. `packages/tbd/tests/markdown-utils.test.ts` - Add YAML edge case tests
9. `packages/tbd/tests/yaml-handling.test.ts` - New comprehensive YAML tests

* * *

## Testing Strategy

1. After changes, run `tbd setup --auto` to regenerate SKILL.md
2. Verify the generated file contains all updates
3. Manually test agent recognition with phrases like:
   - “use beads”
   - “use the shortcut to commit”
   - “clean up this code”
   - “hand off to another agent”
   - “check out the source for library X”

## Open Questions

- Should we add even more specific guideline names as triggers (e.g., “error handling”,
  “backward compatibility”)?
- Should we include a brief “When to Use tbd” summary section?

## References

- [README.md](../../../../README.md) - Main project documentation
- [claude-header.md](../../../../packages/tbd/docs/install/claude-header.md) - Source
  for skill frontmatter
- [skill.md](../../../../packages/tbd/docs/shortcuts/system/skill.md) - Source for skill
  content

### YAML Library References

- [yaml package (npm)](https://www.npmjs.com/package/yaml) - Modern YAML
  parser/stringifier
- [yaml stringify options](https://eemeli.org/yaml/#tostring-options) - Options for
  controlling output format
- [gray-matter (GitHub)](https://github.com/jonschlinkert/gray-matter) - Frontmatter
  parser with stringify support
- [YAML multiline strings](https://yaml-multiline.info/) - Reference for block scalar
  syntax (`>-`, `|`, etc.)
