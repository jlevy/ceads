# Plan Spec: tbd plan Subcommand

## Purpose

This is a technical design doc for implementing the `tbd plan` subcommand, which bridges
human-readable plan documents (Markdown) with tbd's issue tracking system. The goal is
to automate the workflow of creating issues from plan documents and keeping them
synchronized.

## Background

**Current State:**

tbd provides git-native issue tracking with:
- Issues stored as Markdown + YAML frontmatter files
- Status values: `open`, `in_progress`, `blocked`, `deferred`, `closed`
- Hierarchical organization via `parent_id`
- Dependencies via `dependencies[].type: blocks`
- Extensibility via `extensions` namespace
- CLI commands: `create`, `update`, `list`, `ready`, `blocked`, etc.

**The Problem:**

Currently, translating a plan document (e.g., `docs/plans/oauth.plan.md`) into tbd
issues is manual:
1. Human writes plan with headings and checkboxes
2. Human manually creates tbd issues for each item
3. Human manually updates checkboxes when issue status changes
4. No automated way to keep plan doc and issues in sync

**The Solution:**

`tbd plan` automates this by:
- Parsing plan documents for headings and checkboxes
- Creating tbd issues from plan items
- Inserting issue ID annotations back into the plan doc
- Syncing checkbox markers based on issue status

**Reference Documentation:**

- [tbd-design.md](../../../packages/tbd/docs/tbd-design.md) - Overall product design
- [schemas.ts](../../../packages/tbd/src/lib/schemas.ts) - Issue schema with extensions
- Markform MF/0.1 spec - run `npx --yes markform@latest spec` to view
- [Markform implicit checkboxes spec](../../attic/markform/docs/project/specs/active/plan-2026-01-23-implicit-checkboxes.md)

## Markform Implicit Checkboxes (Revised Approach)

### Key Update: No Field Wrappers Needed

Markform now supports **implicit checkboxes** - a major simplification for plan documents.
When a form has:
- A `{% form %}` or `<!-- form -->` wrapper
- No explicit `{% field %}` tags
- Standard markdown checkboxes with ID annotations

The parser automatically creates an implicit checkboxes field with:
- ID: `checkboxes` (reserved)
- Mode: `multi` (always - 5 checkbox states)
- All checkboxes collected in document order

### Simplified Plan Format

```markdown
---
markform:
  spec: MF/0.1
  title: OAuth Implementation Plan
---
<!-- form id="oauth_plan" title="OAuth Implementation Plan" -->

## Phase 1: Research <!-- tbd:proj-a1b2 -->

- [ ] Review OAuth 2.0 spec <!-- #review_oauth tbd:proj-c3d4 -->
- [ ] Analyze competitor auth flows <!-- #competitor_analysis tbd:proj-e5f6 -->

## Phase 2: Implementation <!-- tbd:proj-g7h8 -->

- [x] Set up OAuth provider config <!-- #setup_oauth tbd:proj-i9j0 -->
- [*] Implement token refresh <!-- #token_refresh tbd:proj-k1l2 -->
- [/] Add rate limiting <!-- #rate_limiting tbd:proj-m3n4 -->

<!-- /form -->
```

**Key features:**
- No `{% field %}` wrappers needed
- Each checkbox has a Markform ID (`#review_oauth`) for Markform API
- Each checkbox can have a tbd reference (`tbd:proj-c3d4`) as metadata
- Headings can also have tbd references for hierarchy
- HTML comment syntax renders cleanly on GitHub

### Status Mapping (tbd ↔ Markform)

| tbd status | Markform checkbox state | Marker |
| --- | --- | --- |
| `open` | `todo` | `[ ]` |
| `in_progress` | `active` | `[*]` |
| `blocked` | `incomplete` | `[/]` |
| `deferred` | `na` | `[-]` |
| `closed` | `done` | `[x]` |

This mapping is bidirectional and lossless.

### Markform APIs for tbd plan

With implicit checkboxes, tbd plan can use these Markform APIs:

1. **`parseForm()`** - Parse plan doc, get implicit `checkboxes` field with all options
2. **`findAllCheckboxes()`** - Discover checkboxes with enclosing heading info
3. **`findEnclosingHeadings()`** - Get heading hierarchy for any line
4. **`injectCheckboxIds()`** - Add IDs to checkboxes programmatically
5. **`injectHeaderIds()`** - Add IDs to headings programmatically
6. **`applyPatches()` with `set_checkboxes`** - Update checkbox states
7. **Option metadata** - Store `tbd:proj-xxxx` references on checkbox options

### Option Metadata for tbd References

Markform now supports option metadata - extra attributes on checkbox annotations:

```markdown
- [ ] Task description <!-- #task_id tbd:proj-a1b2 assignee:alice due:2026-02-01 -->
```

The `tbd:proj-a1b2` attribute links the checkbox to a tbd issue. This is cleaner than
the dual-ID system originally proposed.

### Design Benefits of Implicit Checkboxes

1. **Simple format**: No field wrappers, just form wrapper + checkboxes with IDs
2. **Programmatic API**: `tbd plan sync` can use `markform apply` with `set_checkboxes`
3. **Validation**: Markform validates checkbox IDs and states
4. **Hierarchy via headings**: `findEnclosingHeadings()` provides parent context
5. **Agent compatibility**: Agents can use Markform tools directly on plan files

### Markform Limitations (Mostly Resolved)

1. **Option labels must be plain text**: For plan items with code or links, use plain
   text labels and put rich content in description paragraphs below.

2. **No cross-field dependencies**: tbd handles dependencies via `dependencies[].type: blocks`.

3. **File extension**: `.plan.md` works fine - Markform identifies documents by frontmatter,
   not extension.

## Summary of Task

Implement `tbd plan` subcommand with four core operations:

1. **`tbd plan create <file>`** - Parse plan doc, create issues, insert ID annotations
2. **`tbd plan sync <file>`** - Reconcile plan doc with tbd issues
3. **`tbd plan status <file>`** - Show what sync would change (dry-run report)
4. **`tbd plan validate <file>`** - Check syntax and referential integrity

The planfile remains a readable Markdown document while tbd issues become the
system-of-record for status, assignment, and dependencies.

## Backward Compatibility

### CLI Compatibility

| Area | Compatibility Level | Notes |
| --- | --- | --- |
| Existing commands | Maintain | No changes to existing commands |
| Issue schema | Maintain | Uses existing `extensions` namespace |
| File format | Maintain | Planfiles are valid Markdown |

### Breaking Changes

- None - this is a new additive feature

---

## Stage 1: Planning Stage

### 1.1 Core Design Decisions

**Decision 1: tbd issues as system-of-record**

- Status, assignee, dependencies are managed in tbd
- Plan doc checkbox markers reflect tbd status (read-only sync)
- Avoids dual-source-of-truth conflicts

**Decision 2: Markform implicit checkboxes**

- Planfile uses Markform MF/0.1 with implicit checkboxes (no field wrappers needed)
- Form wrapper required: `<!-- form id="..." -->` or `{% form %}`
- Each checkbox has ID annotation: `<!-- #option_id tbd:proj-xxxx -->`
- tbd issue reference stored as option metadata attribute
- `tbd plan create` adds form wrapper and injects IDs via `injectCheckboxIds()`

**Decision 3: Hierarchy from document structure**

- `# Heading` becomes parent issue (epic)
- `## Subheading` becomes child issue (feature/task)
- `- [ ] Checkbox` becomes leaf issue (task)
- Nested checkboxes inherit parent from enclosing checkbox

**Decision 4: Derived status for headings**

- Heading issues don't have checkbox markers in the doc
- Their status is computed from children during sync
- Prevents drift between heading status and child status

**Decision 5: Status mapping**

| tbd status | Checkbox marker | Rationale |
| --- | --- | --- |
| `open` | `[ ]` | todo |
| `in_progress` | `[*]` | active/current focus |
| `blocked` | `[/]` | incomplete (started but stuck) |
| `deferred` | `[-]` | n/a / out of scope |
| `closed` | `[x]` | done |

### 1.2 Scope Definition

**In Scope (v1):**

- [ ] `tbd plan create <file>` - Create issues from plan doc
- [ ] `tbd plan sync <file>` - Update checkbox markers from issue status
- [ ] `tbd plan sync <file>` - Create issues for new checkboxes
- [ ] `tbd plan status <file>` - Dry-run report
- [ ] `tbd plan validate <file>` - Syntax and reference validation
- [ ] Markform implicit checkboxes (form wrapper, no field wrappers)
- [ ] Markform frontmatter (`markform: spec: MF/0.1`)
- [ ] Option metadata for tbd references (`tbd:proj-xxxx`)
- [ ] Use `injectCheckboxIds()` to add IDs to new checkboxes
- [ ] Hierarchy via `findEnclosingHeadings()` for parent context
- [ ] Multi-state checkbox markers ([ ], [x], [*], [/], [-])
- [ ] Extensions metadata for plan traceability
- [ ] Use `markform apply` with `set_checkboxes` for state updates

**Out of Scope (future):**

- `tbd plan schedule` - Agent assignment and scheduling
- Bidirectional title sync (plan text vs issue title)
- Auto-discovery of child issues from tbd
- Ordering preservation
- Validation state marker ([v])

### 1.3 Success Criteria

- [ ] `tbd plan create` parses Markdown and creates issues
- [ ] `tbd plan create` inserts ID annotations without corrupting doc
- [ ] `tbd plan sync` updates checkbox markers correctly
- [ ] `tbd plan status` shows accurate diff report
- [ ] `tbd plan validate` catches broken ID references
- [ ] Round-trip: create -> manual status change -> sync works
- [ ] Tests cover core scenarios

---

## Stage 2: Architecture Stage

### 2.1 Planfile Format

#### File Extension

tbd plan files use the `.plan.md` extension (e.g., `oauth.plan.md`).

**Note:** The Markform spec currently says `.form.md` is "required", but document
identification is actually based on the frontmatter (`markform: spec: MF/0.1`), not the
extension. This should be clarified in a future Markform spec revision to note that
`.form.md` is *recommended* but other extensions like `.plan.md` are valid when the
frontmatter is present.

#### Full Example (Implicit Checkboxes)

```markdown
---
markform:
  spec: MF/0.1
  title: OAuth Implementation Plan
---
<!-- form id="oauth_plan" title="OAuth Implementation Plan" -->

# OAuth Implementation <!-- tbd:proj-root -->

## Phase 1: Research <!-- tbd:proj-a1b2 -->

- [ ] Review OAuth 2.0 spec <!-- #review_spec tbd:proj-c3d4 -->
- [ ] Analyze competitor auth flows <!-- #competitor tbd:proj-e5f6 -->
- [ ] Document security requirements <!-- #security_reqs tbd:proj-g7h8 -->

## Phase 2: Backend <!-- tbd:proj-i9j0 -->

- [x] Set up OAuth provider config <!-- #provider_config tbd:proj-k1l2 -->
- [*] Implement token refresh <!-- #token_refresh tbd:proj-m3n4 -->
- [ ] Add rate limiting <!-- #rate_limiting tbd:proj-o5p6 -->
  - [ ] Design rate limit algorithm <!-- #rate_algo tbd:proj-q7r8 -->
  - [ ] Implement token bucket <!-- #token_bucket tbd:proj-s9t0 -->

## Phase 3: Frontend <!-- tbd:proj-u1v2 -->

- [ ] Create login button component <!-- #login_button tbd:proj-w3x4 -->
- [/] Handle OAuth callback <!-- #oauth_callback tbd:proj-y5z6 -->

<!-- /form -->
```

**Key features of this format:**

1. **No field wrappers** - Markform's implicit checkboxes mode collects all checkboxes
   into a single implicit field with ID `checkboxes`

2. **Form wrapper required** - `<!-- form -->` tags define the Markform boundary

3. **Single ID annotation per checkbox** - Combines Markform ID (`#review_spec`) and
   tbd reference (`tbd:proj-c3d4`) in one annotation

4. **Nested checkboxes supported** - Indented checkboxes are collected as separate options

5. **Heading references** - `<!-- tbd:proj-xxxx -->` on headings for hierarchy

#### ID Annotation Format

```
<!-- #markform_id tbd:proj-xxxx -->
```

- `#markform_id` - Required Markform option ID (used by `set_checkboxes` API)
- `tbd:proj-xxxx` - Optional tbd issue reference (stored as option metadata)

Both HTML comment (`<!-- -->`) and Markdoc (`{% %}`) syntax work identically.

#### Checkbox Markers

| Marker | Markform State | tbd Status |
| --- | --- | --- |
| `[ ]` | `todo` | `open` |
| `[x]` | `done` | `closed` |
| `[*]` | `active` | `in_progress` |
| `[/]` | `incomplete` | `blocked` |
| `[-]` | `na` | `deferred` |

These are Markform's `checkboxMode="multi"` states.

### 2.2 Issue Extensions Schema

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

### 2.3 Kind Mapping

| Document Element | tbd Kind | Rationale |
| --- | --- | --- |
| `# H1` heading | `epic` | Top-level plan items |
| `## H2+` heading | `task` | Sub-sections (could be `feature`) |
| Checkbox | `task` | Leaf work items |

### 2.4 Derived Status Algorithm

For heading issues (no checkbox marker):

```
function deriveStatus(children: Issue[]): Status {
  if (children.every(c => c.status in ['closed', 'deferred'])) {
    return 'closed';
  }
  if (children.some(c => c.status === 'blocked')) {
    return 'blocked';
  }
  if (children.some(c => c.status === 'in_progress')) {
    return 'in_progress';
  }
  return 'open';
}
```

### 2.5 Command Specifications

#### `tbd plan create <file>`

**Purpose:** Convert plan document to tbd issues.

**Algorithm (using Markform APIs):**

1. Read Markdown file
2. Add Markform scaffolding if missing:
   - Add `markform:` frontmatter
   - Add `<!-- form id="..." -->` wrapper
3. Use `findAllCheckboxes()` to discover checkboxes with enclosing headings
4. Use `injectCheckboxIds()` to add Markform IDs to checkboxes without IDs
5. For each checkbox:
   - Create tbd issue (kind: task)
   - Set `parent_id` based on `enclosingHeadings` (innermost heading's issue)
   - Set status from checkbox marker
   - Set `extensions.plan` metadata
   - Add `tbd:proj-xxxx` to the checkbox's ID annotation
6. For each heading without tbd reference:
   - Create tbd issue (kind based on level)
   - Use `injectHeaderIds()` or add `<!-- tbd:proj-xxxx -->` annotation
7. Write modified Markdown back to file

**Options:**

```bash
tbd plan create <file> [options]

Options:
  --dry-run           Show what would be created without making changes
  --no-sync           Don't sync to remote after creating issues
  --prefix <kind>     Override kind prefix for headings (default: epic for H1)
```

**Output:**

```
Created 12 issues from docs/plans/oauth.plan.md:
  proj-a1b2: OAuth Implementation (epic)
  proj-c3d4: Backend (task)
  proj-e5f6: Set up OAuth provider config (task)
  ...
```

#### `tbd plan sync <file>`

**Purpose:** Reconcile plan document with tbd issue state.

**Algorithm (with Markform implicit checkboxes):**

1. Parse planfile with `parseForm()`:
   - Implicit checkboxes creates field with ID `checkboxes`
   - All checkbox options available as `checkboxes.options`
   - Option metadata contains `tbd:proj-xxxx` references
2. Build tbd reference map from option metadata
3. For each option with `tbd:` metadata:
   - Load issue from tbd
   - Compare option state to issue status
   - If mismatch: queue a `set_checkboxes` patch
4. For options without tbd references:
   - Create new tbd issue
   - Add `tbd:proj-xxxx` to option metadata (requires text edit)
5. Apply state changes via `applyPatches()`:
   - Use `set_checkboxes` with implicit field ID `checkboxes`
   - Markform serializes updated states
6. Write modified planfile via `getMarkdown()`

**Using Markform Apply:**

```typescript
import { parseForm, applyPatches, getMarkdown } from 'markform';

const parsed = parseForm(content);

// Get tbd references from option metadata
const options = parsed.schema.fields.find(f => f.id === 'checkboxes')?.options ?? [];
const tbdRefs = new Map(options
  .filter(opt => opt.metadata?.tbd)
  .map(opt => [opt.metadata.tbd, opt.id])
);

// Build patches from tbd issue status
const patches = [];
for (const [tbdId, optionId] of tbdRefs) {
  const issue = await loadIssue(tbdId);
  const newState = tbdStatusToMarkformState(issue.status);
  patches.push({
    op: 'set_checkboxes',
    fieldId: 'checkboxes',  // implicit field ID
    value: { [optionId]: newState }
  });
}

// Apply via Markform API
const result = applyPatches(parsed, patches);
const updatedMarkdown = getMarkdown(result);
```

**Truth Rules (v1):**

- Status/assignee: tbd → plan (tbd wins)
- Structure/wording: plan → tbd (for new issues only)
- Conflicts: tbd wins for status, warn if title differs

**Options:**

```bash
tbd plan sync <file> [options]

Options:
  --dry-run           Show what would change without making changes
  --no-sync           Don't sync to remote after changes
  --force             Update even if plan file has unsaved changes
```

**Output:**

```
Synced docs/plans/oauth.plan.md:
  Updated: proj-e5f6 [ ] -> [x] (closed)
  Updated: proj-g7h8 [ ] -> [*] (in_progress)
  Created: proj-new1 "New task from plan"
  Warning: proj-q7r8 title differs: "Handle callback" vs "Handle OAuth callback"
```

#### `tbd plan status <file>`

**Purpose:** Show sync status without making changes.

**Output Categories:**

1. **Marker mismatches** - checkbox marker != issue status
2. **Missing IDs** - plan items without ID annotations
3. **Broken references** - IDs that don't resolve to issues
4. **Title mismatches** - plan text differs from issue title (warning)
5. **Hierarchy mismatches** - parent_id doesn't match plan structure

**Options:**

```bash
tbd plan status <file> [options]

Options:
  --json              Output as JSON for scripting
  --quiet             Only show if there are changes needed
```

**Output:**

```
Plan status: docs/plans/oauth.plan.md

Marker mismatches (3):
  Line 5: proj-e5f6 [*] should be [x] (issue is closed)
  Line 7: proj-g7h8 [ ] should be [*] (issue is in_progress)
  Line 12: proj-q7r8 [x] should be [/] (issue is blocked)

Missing IDs (1):
  Line 20: "- [ ] New task" needs ID

Broken references (0):
  (none)

Run `tbd plan sync docs/plans/oauth.plan.md` to apply changes.
```

#### `tbd plan validate <file>`

**Purpose:** Check plan document validity.

**Checks:**

1. **Markdown syntax** - valid Markdown structure
2. **ID annotation format** - valid `<!-- #proj-xxxx -->` syntax
3. **ID uniqueness** - no duplicate IDs in document
4. **Reference resolution** - all IDs resolve to existing issues
5. **Plan ownership** - issues have matching `extensions.plan.file`

**Options:**

```bash
tbd plan validate <file> [options]

Options:
  --json              Output as JSON
  --strict            Treat warnings as errors
```

**Output:**

```
Validating docs/plans/oauth.plan.md...

Errors (1):
  Line 15: ID proj-xxxx does not exist

Warnings (2):
  Line 8: proj-abc1 belongs to different plan (docs/plans/other.md)
  Line 22: Duplicate ID proj-e5f6

Validation failed with 1 error(s).
```

---

## Stage 3: Refine Architecture

### 3.1 Parsing Strategy (Implicit Checkboxes)

With Markform's implicit checkboxes feature, parsing is straightforward:

```typescript
import {
  parseForm,
  findAllCheckboxes,
  findEnclosingHeadings,
  injectCheckboxIds,
  applyPatches,
  getMarkdown
} from 'markform';

// Parse plan document - checkboxes auto-collected into implicit field
const parsed = parseForm(content);

// Access implicit checkboxes field
const checkboxField = parsed.schema.fields.find(f => f.id === 'checkboxes');
const options = checkboxField?.options ?? [];

// Get current checkbox states
const states = parsed.responsesByFieldId['checkboxes']?.values ?? {};
```

### 3.2 Markform APIs Used

**Discovery APIs:**

- `findAllCheckboxes(markdown)` - Get all checkboxes with enclosing heading info
- `findEnclosingHeadings(markdown, line)` - Get heading hierarchy for a line position

**ID Injection APIs:**

- `injectCheckboxIds(markdown, { generator })` - Add IDs to checkboxes programmatically
- `injectHeaderIds(markdown, { generator })` - Add IDs to headings programmatically

**Form APIs:**

- `parseForm(markdown)` - Parse with implicit checkboxes field
- `applyPatches(form, patches)` - Update checkbox states
- `getMarkdown(form)` - Serialize back to markdown

### 3.3 Sync Implementation

```typescript
async function syncPlanFile(path: string): Promise<SyncResult> {
  const content = await fs.readFile(path, 'utf8');
  const parsed = parseForm(content);

  // Get implicit checkboxes field
  const field = parsed.schema.fields.find(f => f.id === 'checkboxes');
  if (!field) return { updated: 0 };

  // Build patches from tbd issue status
  const patches = [];
  for (const option of field.options) {
    const tbdRef = option.metadata?.tbd;
    if (!tbdRef) continue;

    const issue = await loadIssue(tbdRef);
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

  // Apply patches and write back
  const result = applyPatches(parsed, patches);
  if (result.applyStatus === 'applied') {
    const updatedMarkdown = getMarkdown(result);
    await fs.writeFile(path, updatedMarkdown);
  }

  return { updated: patches.length };
}
```

### 3.4 Existing Code Reuse

| Component | Existing | Reuse Strategy |
| --- | --- | --- |
| Issue creation | `packages/tbd/src/cli/commands/create.ts` | Extract core logic to shared function |
| Issue loading | `packages/tbd/src/file/issue-store.ts` | Use directly |
| ID resolution | `packages/tbd/src/lib/ids.ts` | Use directly |
| Extensions | `IssueSchema.extensions` | Use existing field |
| Output | `packages/tbd/src/cli/lib/output.ts` | Use OutputManager |

### 3.4 New Files Required

```
packages/tbd/src/
├── cli/
│   └── commands/
│       └── plan.ts              # CLI command definitions
├── plan/
│   ├── parser.ts                # Markdown parsing
│   ├── edits.ts                 # Edit application
│   ├── sync.ts                  # Sync algorithm
│   └── types.ts                 # Plan-specific types
```

---

## Changes to tbd-design.md

### New Section: 4.X Plan Commands

Add after section 4.9 (Maintenance Commands):

```markdown
### 4.X Plan Commands

The plan commands bridge Markdown plan documents with tbd issue tracking.

#### Overview

A **planfile** is a Markdown document containing headings and checkboxes that
map to tbd issues. The `tbd plan` commands automate:

- Creating issues from plan items
- Syncing checkbox markers based on issue status
- Validating plan document integrity

#### Plan Create

\`\`\`bash
tbd plan create <file> [options]

Options:
  --dry-run           Show what would be created
  --no-sync           Don't sync after creating
\`\`\`

Creates tbd issues for all headings and checkboxes in the plan document.
Inserts ID annotations (e.g., `<!-- #proj-a1b2 -->`) to link plan items
to issues.

#### Plan Sync

\`\`\`bash
tbd plan sync <file> [options]

Options:
  --dry-run           Show what would change
  --no-sync           Don't sync after changes
\`\`\`

Updates checkbox markers in the plan document to reflect issue status.
Creates issues for new plan items without ID annotations.

#### Plan Status

\`\`\`bash
tbd plan status <file> [options]

Options:
  --json              JSON output
  --quiet             Exit code only
\`\`\`

Shows what `sync` would change without making modifications.

#### Plan Validate

\`\`\`bash
tbd plan validate <file> [options]

Options:
  --strict            Treat warnings as errors
\`\`\`

Checks plan document syntax and verifies all ID references resolve to
existing issues.
```

### Update Section 2.6.3: IssueSchema

Add `extensions.plan` documentation:

```markdown
**Plan Extensions:**

Issues created from plan documents include plan metadata:

\`\`\`yaml
extensions:
  plan:
    file: docs/plans/oauth.plan.md
    node_kind: checkbox
    outline_path: ["OAuth Implementation", "Backend"]
    line_number: 15
\`\`\`

Fields:
- `file`: Path to source plan document (relative to repo root)
- `node_kind`: Type of plan node ("heading" or "checkbox")
- `outline_path`: Heading ancestry for context
- `line_number`: Line number in plan document (updated on sync)
```

### Update Section 7.2: Future Enhancements

Add:

```markdown
#### Plan Scheduling

`tbd plan schedule` for agent assignment and work distribution:
- Identify ready tasks from plan
- Assign to agents round-robin or by section
- Generate per-agent work prompts
```

---

## Code Changes Summary

### New Files

| File | Purpose |
| --- | --- |
| `src/cli/commands/plan.ts` | CLI command: plan create/sync/status/validate |
| `src/plan/parser.ts` | Markdown parser for headings and checkboxes |
| `src/plan/edits.ts` | Apply surgical edits to Markdown |
| `src/plan/sync.ts` | Core sync algorithm |
| `src/plan/types.ts` | PlanNode, SyncResult, etc. |

### Modified Files

| File | Change |
| --- | --- |
| `src/cli/cli.ts` | Register `plan` command |
| `src/lib/schemas.ts` | Add `PlanExtensions` type (optional, for validation) |
| `src/file/issue-store.ts` | Possibly extract shared creation logic |

### Tests

| Test File | Coverage |
| --- | --- |
| `tests/plan/parser.test.ts` | Markdown parsing edge cases |
| `tests/plan/sync.test.ts` | Sync algorithm scenarios |
| `tests/plan/e2e.test.ts` | End-to-end create/sync/status |

---

## Open Questions and Design Issues

### 1. Checkbox Label Constraints

**Issue:** Markform specifies plain-text-only option labels. Plan checkboxes often contain:
- Inline code: `` `src/foo.ts` ``
- Links: `[ADR-12](docs/adr-12.md)`
- Emphasis: `**important**`

**Options:**
- A) v1 accepts any Markdown, defer strict validation
- B) Warn but don't error on inline formatting
- C) Strip formatting for issue title, preserve in plan doc

**Recommendation:** Option A - accept any Markdown for v1, note that full Markform
validation is future work.

### 2. Title Sync Direction

**Issue:** Should plan text changes update issue titles?

**Options:**
- A) One-way: plan creates issue title, never updates it
- B) Two-way: sync detects title changes, prompts for resolution
- C) Plan-wins: plan text always overwrites issue title

**Recommendation:** Option A for v1 - simpler, avoids conflicts. Title divergence
shown as warning in `status`.

### 3. Removed Items

**Issue:** What happens if a checkbox is removed from the plan doc?

**Options:**
- A) Issue remains in tbd, orphaned from plan
- B) Issue is closed/archived
- C) Issue is deleted

**Recommendation:** Option A - warn in `status`, don't auto-delete. Future:
`tbd plan prune` command.

### 4. Multiple Plans per Issue

**Issue:** Can an issue belong to multiple plans?

**Recommendation:** No for v1. `extensions.plan.file` is singular. Future could
support `extensions.plan.files[]`.

### 5. Ordering

**Issue:** Should issue order in `tbd list` reflect plan document order?

**Recommendation:** Defer to future. Current `tbd list` sorts by priority. Could
add `extensions.plan.order` field and `--sort=plan` option later.

### 6. Schedule Command

**Issue:** The `tbd plan schedule` command was discussed but is complex.

**Recommendation:** Defer entirely. v1 focuses on create/sync/status/validate.
Schedule can be added once the core workflow is proven.

### 7. Stable Node Keys

**Issue:** Using display IDs (`proj-a7k2`) as linkage means:
- If issue is deleted, plan has orphan reference
- If issue is recreated, gets different ID

**Alternative:** Internal plan node ID separate from issue ID:
```markdown
- [ ] Task <!-- @plan:node-001 tbd:proj-a7k2 -->
```

**Recommendation:** Use display IDs for v1 (simpler). Track this as potential
enhancement if orphan references become problematic.

### 8. Markform Integration Depth

**Issue:** Full Markform would require:
- Frontmatter: `markform: spec: MF/0.1`
- Form wrapper: `<!-- form id="..." -->`
- Field wrapper: `<!-- field kind="checkboxes" ... -->`

**Recommendation:** Optional for v1. Create works without any Markform structure.
Future: `--markform` flag to add full scaffolding.

---

## Implementation Phases

### Phase 1: Core Parsing and Create (Minimum Viable)

- [ ] Markdown parser for headings and checkboxes
- [ ] ID annotation extraction and insertion
- [ ] `tbd plan create` command
- [ ] Basic tests

### Phase 2: Sync and Status

- [ ] Status-to-marker mapping
- [ ] Derived status for headings
- [ ] `tbd plan sync` command
- [ ] `tbd plan status` command
- [ ] Tests for sync scenarios

### Phase 3: Validation

- [ ] `tbd plan validate` command
- [ ] Reference resolution checks
- [ ] Duplicate ID detection
- [ ] Plan ownership verification

### Phase 4: Polish

- [ ] Edge case handling (code blocks, nested lists)
- [ ] Warning messages for divergence
- [ ] Documentation updates
- [ ] Golden tests with real plan documents

---

## Stage 4: Validation Stage

*To be completed after implementation.*

- [ ] All commands work as specified
- [ ] Round-trip test: create -> update issue -> sync works
- [ ] Error handling covers edge cases
- [ ] Documentation is complete
- [ ] Design doc updated with final implementation
