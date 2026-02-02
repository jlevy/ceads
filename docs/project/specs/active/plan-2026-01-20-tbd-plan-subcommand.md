# Plan Spec: tbd plan Subcommand

## Purpose

The `tbd plan` subcommand bridges human-readable Markdown plan documents with tbd's
issue tracking system. It automates creating issues from plan documents and keeping
them synchronized.

## Background

tbd provides git-native issue tracking with:
- Issues stored as Markdown + YAML frontmatter files
- Status values: `open`, `in_progress`, `blocked`, `deferred`, `closed`
- Hierarchical organization via `parent_id`
- Dependencies via `dependencies[].type: blocks`
- Spec linking via `spec_path` field
- Child ordering via `child_order_hints`
- Extensibility via `extensions` namespace

**The Problem:** Translating a plan document into tbd issues is currently manual.
Humans write plans, manually create issues, and manually sync checkbox states.

**The Solution:** `tbd plan` automates this by parsing plan documents, creating issues,
inserting ID annotations, and syncing checkbox markers based on issue status.

**Reference Documentation:**
- [tbd-design.md](../../../packages/tbd/docs/tbd-design.md) - Overall product design
- Markform MF/0.1 spec - run `npx --yes markform@latest spec` to view

---

## Plan Format

### Syntax

Plan files use **HTML comment syntax** for Markform tags, which renders cleanly on
GitHub (comments are hidden). Markdoc tag syntax (`{% form %}`) is also fully
supported and equivalent.

### Example Plan Document

```markdown
---
markform:
  spec: MF/0.1
  title: OAuth Implementation Plan
---
<!-- form id="oauth_plan" title="OAuth Implementation Plan" -->

# OAuth Implementation <!-- #proj-0001 -->

## Phase 1: Research <!-- #proj-a1b2 -->

- [ ] Review OAuth 2.0 spec <!-- #proj-c3d4 -->
- [ ] Analyze competitor auth flows <!-- #proj-e5f6 -->
- [ ] Document security requirements <!-- #proj-g7h8 -->

## Phase 2: Backend <!-- #proj-i9j0 -->

- [x] Set up OAuth provider config <!-- #proj-k1l2 -->
- [*] Implement token refresh <!-- #proj-m3n4 -->
- [ ] Add rate limiting <!-- #proj-o5p6 -->
  - [ ] Design rate limit algorithm <!-- #proj-q7r8 -->
  - [ ] Implement token bucket <!-- #proj-s9t0 -->

## Phase 3: Frontend <!-- #proj-u1v2 -->

- [ ] Create login button component <!-- #proj-w3x4 -->
- [/] Handle OAuth callback <!-- #proj-y5z6 -->

<!-- /form -->
```

### Key Format Elements

**1. Markform frontmatter** (required):
```yaml
markform:
  spec: MF/0.1
```

**2. Form wrapper** (required):
```markdown
<!-- form id="plan_id" title="Plan Title" -->
...content...
<!-- /form -->
```

**3. ID annotations** - tbd short IDs serve as both Markform option IDs and issue references:
```markdown
- [ ] Task description <!-- #proj-a1b2 -->
## Heading <!-- #proj-c3d4 -->
```

**4. Implicit checkboxes** - No `{% field %}` wrappers needed. Markform automatically
collects all checkboxes into an implicit field with ID `checkboxes`.

### ID Format

```
<!-- #proj-xxxx -->
```

The tbd short ID (e.g., `proj-a1b2`) serves as:
- The Markform option ID (used by `set_checkboxes` API)
- The tbd issue reference (for sync and lookup)

This works because tbd short IDs are:
- **Unique** within a project
- **Valid identifiers** (lowercase alphanumeric with hyphens)
- **Self-documenting** - directly reference the tbd issue

### Checkbox Markers (5-State)

| Marker | Markform State | tbd Status | Meaning |
| --- | --- | --- | --- |
| `[ ]` | `todo` | `open` | Not started |
| `[x]` | `done` | `closed` | Complete |
| `[*]` | `active` | `in_progress` | Currently working |
| `[/]` | `incomplete` | `blocked` | Started but stuck |
| `[-]` | `na` | `deferred` | Out of scope |

This mapping is bidirectional and lossless.

### File Extension

Plan files use `.plan.md` extension. Markform identifies documents by frontmatter,
not extension, so this works correctly.

---

## Commands

### `tbd plan create <file>`

Convert a plan document to tbd issues.

```bash
tbd plan create <file> [options]

Options:
  --dry-run           Show what would be created without making changes
  --no-sync           Don't sync to remote after creating issues
```

**Behavior:**
1. Add Markform scaffolding if missing (frontmatter + form wrapper)
2. For each checkbox/heading without an ID:
   - Create tbd issue
   - Set `parent_id` based on enclosing heading
   - Set status from checkbox marker
   - Inject ID annotation with new tbd short ID
3. Write modified Markdown back to file

**Output:**
```
Created 12 issues from docs/plans/oauth.plan.md:
  proj-a1b2: OAuth Implementation (epic)
  proj-c3d4: Backend (task)
  proj-e5f6: Set up OAuth provider config (task)
  ...
```

### `tbd plan sync <file>`

Reconcile plan document with tbd issue state.

```bash
tbd plan sync <file> [options]

Options:
  --dry-run           Show what would change without making changes
  --no-sync           Don't sync to remote after changes
  --force             Update even if plan file has unsaved changes
```

**Behavior:**
1. Parse plan with Markform
2. For each checkbox with a tbd ID:
   - Load issue, compare status to checkbox state
   - Update checkbox marker if they differ
3. For checkboxes without valid tbd IDs:
   - Create new issue, inject ID
4. Write modified plan file

**Truth rules:** tbd is system-of-record for status. Plan is source for new items.

**Output:**
```
Synced docs/plans/oauth.plan.md:
  Updated: proj-e5f6 [ ] -> [x] (closed)
  Updated: proj-g7h8 [ ] -> [*] (in_progress)
  Created: proj-new1 "New task from plan"
```

### `tbd plan status <file>`

Show sync status without making changes (dry-run report).

```bash
tbd plan status <file> [options]

Options:
  --json              Output as JSON for scripting
  --quiet             Only show if there are changes needed
```

**Output categories:**
- Marker mismatches - checkbox state ≠ issue status
- Missing IDs - plan items without ID annotations
- Broken references - IDs that don't resolve to issues
- Title mismatches (warning) - plan text differs from issue title

### `tbd plan validate <file>`

Check plan document validity.

```bash
tbd plan validate <file> [options]

Options:
  --json              Output as JSON
  --strict            Treat warnings as errors
```

**Checks:**
- Markdown syntax validity
- ID annotation format (`<!-- #proj-xxxx -->`)
- ID uniqueness within document
- Reference resolution (all IDs resolve to issues)
- Plan ownership (issues have matching `extensions.plan.file`)

---

## Core Design Decisions

**1. tbd issues as system-of-record**
- Status, assignee, dependencies are managed in tbd
- Plan doc checkbox markers reflect tbd status (read-only sync)
- Avoids dual-source-of-truth conflicts

**2. Implicit checkboxes with tbd short IDs**
- Planfile uses Markform MF/0.1 with implicit checkboxes (no field wrappers)
- Form wrapper required: `<!-- form id="..." -->`
- tbd short ID IS the Markform option ID: `<!-- #proj-a1b2 -->`

**3. Hierarchy from document structure**
- `# H1` heading → epic
- `## H2+` heading → task
- `- [ ] Checkbox` → task
- Nested checkboxes inherit parent from enclosing checkbox/heading

**4. Derived status for headings**
- Headings don't have checkbox markers
- Their status is computed from children during sync

---

## Issue Extensions Schema

Plan-managed issues use the `extensions.plan` namespace:

```yaml
extensions:
  plan:
    file: docs/plans/oauth.plan.md
    node_kind: checkbox  # or "heading"
    outline_path:
      - "OAuth Implementation"
      - "Backend"
    line_number: 15
```

This enables:
- Finding all issues belonging to a plan
- Reconstructing hierarchy if plan structure changes
- Debugging sync issues

---

## Markform Integration

### APIs Used

```typescript
import {
  parseForm,
  applyPatches,
  getMarkdown
} from 'markform';

// Parse plan - checkboxes auto-collected into implicit field
const parsed = parseForm(content);

// Access implicit checkboxes field
const field = parsed.schema.fields.find(f => f.id === 'checkboxes');
const options = field?.options ?? [];

// Get current checkbox states
const states = parsed.responsesByFieldId['checkboxes']?.values ?? {};
```

### Sync Implementation

```typescript
async function syncPlanFile(path: string): Promise<SyncResult> {
  const content = await fs.readFile(path, 'utf8');
  const parsed = parseForm(content);

  const field = parsed.schema.fields.find(f => f.id === 'checkboxes');
  if (!field) return { updated: 0 };

  // Build patches - option.id IS the tbd short ID
  const patches = [];
  for (const option of field.options) {
    const issue = await loadIssue(option.id);
    if (!issue) continue;

    const expectedState = tbdStatusToMarkformState(issue.status);
    const currentState = parsed.responsesByFieldId['checkboxes']?.values?.[option.id];

    if (currentState !== expectedState) {
      patches.push({
        op: 'set_checkboxes',
        fieldId: 'checkboxes',
        value: { [option.id]: expectedState }
      });
    }
  }

  if (patches.length === 0) return { updated: 0 };

  const result = applyPatches(parsed, patches);
  if (result.applyStatus === 'applied') {
    await fs.writeFile(path, getMarkdown(result));
  }

  return { updated: patches.length };
}
```

---

## Open Questions

### 1. Rich Text in Checkbox Labels

**Question:** Should we allow inline Markdown (code, links, emphasis) in checkbox text?

Markform specifies plain-text-only labels, but plan checkboxes often contain:
- Inline code: `` `src/foo.ts` ``
- Links: `[ADR-12](docs/adr-12.md)`

**Current approach:** Accept any Markdown for v1. Strip formatting when creating
issue titles, preserve in plan doc. Revisit if Markform adds rich label support.

### 2. Title Drift

**Question:** What happens when plan text diverges from issue title?

**Current approach:** One-way sync (plan creates title, never updates it).
Show warning in `status`. Future: `--sync-titles` flag or interactive resolution.

### 3. Removed Plan Items

**Question:** What happens if a checkbox is deleted from the plan doc?

**Current approach:** Issue remains in tbd, orphaned. Detect and warn in `validate`.
Future: `tbd plan prune` command for cleanup.

### 4. Orphan References

**Question:** What if an ID annotation references a deleted issue?

**Current approach:** `validate` detects and reports. Manual cleanup is appropriate
since deleting issues is rare.

---

## Possible Enhancements

### Near-term

- **`--watch` mode**: Auto-sync when plan file or issues change
- **Title sync**: `--sync-titles` to update issue titles from plan text
- **Prune command**: `tbd plan prune` to handle orphaned issues
- **Glob support**: `tbd plan sync "docs/plans/*.plan.md"`

### Flexible Workflows

- **Bidirectional sync**: Allow editing issue titles in tbd and syncing back to plan
- **Partial plans**: Support plans that only track some issues (not all plan items
  need IDs)
- **Plan templates**: Generate new plans from tbd issue queries
- **Cross-plan references**: Issues appearing in multiple plans with different contexts

### Agent Workflows

- **Schedule command**: `tbd plan schedule` for agent assignment
  - Identify ready tasks from plan
  - Assign to agents round-robin or by section
  - Generate per-agent work prompts
- **Progress tracking**: Dashboard view of plan completion
- **Dependency visualization**: Show blocking relationships in plan context

### Advanced Features

- **Plan versioning**: Track plan structure changes over time
- **Ordering preservation**: `child_order_hints` based on document order
- **Validation markers**: `[v]` state for "completed and verified"
- **Multi-plan issues**: `extensions.plan.files[]` for shared issues

---

## Implementation Summary

### New Files

| File | Purpose |
| --- | --- |
| `src/cli/commands/plan.ts` | CLI command definitions |
| `src/plan/parser.ts` | Markdown parsing (uses Markform) |
| `src/plan/sync.ts` | Core sync algorithm |
| `src/plan/types.ts` | PlanNode, SyncResult types |

### Modified Files

| File | Change |
| --- | --- |
| `src/cli/cli.ts` | Register `plan` command |
| `src/lib/schemas.ts` | Add `PlanExtensions` type |

### Tests

| Test File | Coverage |
| --- | --- |
| `tests/plan/parser.test.ts` | Markdown parsing edge cases |
| `tests/plan/sync.test.ts` | Sync algorithm scenarios |
| `tests/plan/e2e.test.ts` | End-to-end workflows |

---

## Implementation Phases

### Phase 1: Core (MVP)

- [ ] Markdown parsing with Markform
- [ ] `tbd plan create` command
- [ ] `tbd plan sync` command
- [ ] Basic tests

### Phase 2: Reporting

- [ ] `tbd plan status` command
- [ ] `tbd plan validate` command
- [ ] Warning messages for divergence

### Phase 3: Polish

- [ ] Edge cases (code blocks, nested lists)
- [ ] Documentation
- [ ] Golden tests

---

## Validation Criteria

- [ ] Round-trip: create → manual status change → sync works
- [ ] Checkbox markers update correctly from issue status
- [ ] New plan items create issues with correct hierarchy
- [ ] Broken references detected by validate
- [ ] Plan doc remains valid Markdown throughout
