# Plan Spec: Inherit spec_path from Parent Bead

**Date:** 2026-01-27 **Author:** Claude **Status:** Implemented

## Overview

When a bead is linked to a spec via `spec_path` and has children, child beads should
automatically inherit the parent’s `spec_path` unless they have an explicitly set value.
This prevents inconsistencies where an epic is linked to a spec but its subtasks are
not.

Inheritance also propagates: when a parent bead’s `spec_path` is set or changed, all
descendant beads that don’t have an explicitly-set `spec_path` should be updated to
match.

## Goals

- Child beads automatically inherit `spec_path` from their parent when created via
  `--parent` (unless `--spec` is also provided)
- When a parent bead’s `spec_path` is set or changed via `tbd update --spec`, propagate
  to all children that don’t have an explicitly-set spec_path
- When a child bead is re-parented (via `tbd update --parent`), inherit the new parent’s
  spec_path (unless the child has an explicit spec_path)
- Track which beads have explicitly-set vs inherited spec_path values
- Update design docs and CLI reference docs

## Non-Goals

- Recursive multi-level propagation beyond direct children on create (parent sets child;
  if that child later gets children, they inherit at their own create time)
- Preventing a child from having a different spec_path (explicit always wins)
- Propagating spec_path removal (clearing a parent’s spec_path does NOT clear
  children’s)

## Background

With the recent addition of `spec_path` (see `plan-2026-01-26-spec-linking.md`), beads
can link to specification documents.
However, in practice, a typical workflow is:

1. Create an epic bead linked to a spec
2. Break the epic into child task/feature beads

Currently, each child must manually specify `--spec` to link to the same spec.
This is error-prone and tedious.
Since the parent already establishes the spec context, children should inherit it by
default.

### Current Implementation Points

**Where spec_path is set today:**

| Location | File | How |
| --- | --- | --- |
| Create with `--spec` | `src/cli/commands/create.ts:67-75` | `resolveAndValidatePath()` then stored in issue |
| Update with `--spec` | `src/cli/commands/update.ts:318-331` | Same validation, or null to clear |
| Update from file | `src/cli/commands/update.ts:213-229` | Parsed from YAML frontmatter |
| Schema definition | `src/lib/schemas.ts:136` | `z.string().nullable().optional()` |
| Merge strategy | `src/file/git.ts` | Last-write-wins (lww) |

**Where parent_id is set today:**

| Location | File | How |
| --- | --- | --- |
| Create with `--parent` | `src/cli/commands/create.ts:104-109` | Resolves display ID to internal ID |
| Update with `--parent` | `src/cli/commands/update.ts:306-315` | Same resolution, or null to clear |

## Design

### Approach

1. **Track explicit vs inherited:** Add an `spec_path_explicit` boolean field (or use a
   sentinel convention) to distinguish explicitly-set spec_path values from inherited
   ones. **Simpler alternative:** Don’t track this in schema.
   Instead, use a behavioral rule: inheritance only happens at the moment of
   create/update. Once set, the value is just a value.
   To override, the user sets `--spec` explicitly.
   To re-inherit, the user clears with `--spec ""` and re-parents.

   **Decision: Use simpler approach** — no schema change for tracking.
   We only need to know at the moment of the operation whether the user explicitly
   provided `--spec`.

2. **On create with `--parent`:** If `--spec` is NOT provided but the parent has a
   `spec_path`, copy the parent’s `spec_path` to the new child.

3. **On update with `--parent`:** If `--spec` is NOT also provided in the same update
   command, and the child’s current `spec_path` is empty/null, copy the new parent’s
   `spec_path`.

4. **On update with `--spec` on a parent:** After updating the parent’s `spec_path`,
   find all children (beads with `parent_id` matching this bead’s internal ID) and
   update any child whose `spec_path` is null/empty OR matches the parent’s OLD
   `spec_path` (i.e., was likely inherited).

### Components Modified

| File | Changes |
| --- | --- |
| `src/cli/commands/create.ts` | After resolving parent, read parent issue and inherit spec_path |
| `src/cli/commands/update.ts` | On `--spec` change, propagate to children; on `--parent` change, inherit from new parent |
| `src/file/storage.ts` | May need `listIssues()` or `findChildIssues()` helper (or use existing) |
| `src/cli/commands/list.ts` | No changes (already filters by spec_path) |
| `packages/tbd/docs/tbd-design.md` | Document inheritance behavior in spec_path section |
| `packages/tbd/docs/tbd-docs.md` | Document inheritance in CLI reference |

### Detailed Logic

#### `create.ts` changes

After resolving `parentId` (line ~~104-109) and `specPath` (line ~~67-75):

```typescript
// Inherit spec_path from parent if not explicitly provided
if (!options.spec && parentId) {
  const parentIssue = await readIssue(dataSyncDir, parentId);
  if (parentIssue.spec_path) {
    specPath = parentIssue.spec_path;
  }
}
```

#### `update.ts` changes — propagate to children

After applying `spec_path` update (line ~86):

```typescript
// If spec_path changed, propagate to children without explicit spec_path
if (updates.spec_path !== undefined) {
  const oldSpecPath = existingIssue.spec_path;
  const newSpecPath = updates.spec_path;
  if (newSpecPath && newSpecPath !== oldSpecPath) {
    const allIssues = await listAllIssues(dataSyncDir);
    const children = allIssues.filter(i => i.parent_id === issue.id);
    for (const child of children) {
      // Update children that had no spec_path or had the old inherited value
      if (!child.spec_path || child.spec_path === oldSpecPath) {
        child.spec_path = newSpecPath;
        child.version += 1;
        child.updated_at = now();
        await writeIssue(dataSyncDir, child);
      }
    }
  }
}
```

#### `update.ts` changes — inherit on re-parent

When `--parent` is set without `--spec`:

```typescript
// Inherit spec_path from new parent if not explicitly setting spec
if (updates.parent_id && options.spec === undefined) {
  if (!issue.spec_path) {
    const parentIssue = await readIssue(dataSyncDir, updates.parent_id);
    if (parentIssue.spec_path) {
      issue.spec_path = parentIssue.spec_path;
    }
  }
}
```

## Implementation Plan

### Phase 1: Core Inheritance Logic

- [x] Add spec_path inheritance in `create.ts` when `--parent` is provided without
  `--spec`
- [x] Add spec_path propagation in `update.ts` when `--spec` is changed on a parent bead
- [x] Add spec_path inheritance in `update.ts` when `--parent` is changed without
  `--spec`
- [x] Add/use helper to list child issues (uses existing `listIssues` from storage.ts)

### Phase 2: Golden Tests

- [x] Create tryscript test `tests/cli-spec-inherit.tryscript.md` covering:
  - Create parent with `--spec`, then create child with `--parent` → child inherits
    spec_path
  - Create child with `--parent` AND `--spec` → child keeps its explicit spec_path
  - Update parent’s `--spec` → children without explicit spec_path are updated
  - Update parent’s `--spec` → children with explicit different spec_path are NOT
    updated
  - Re-parent a child (change `--parent`) → inherits new parent’s spec_path if child has
    none
  - Create parent without `--spec`, create child with `--parent` → child has no
    spec_path
- [x] Create unit test `tests/spec-inherit.test.ts` with 8 test cases (all passing)

### Phase 3: Documentation Updates

- [x] Update `packages/tbd/docs/tbd-design.md` spec_path section to document inheritance
  behavior
- [x] Update `packages/tbd/docs/tbd-docs.md` CLI reference to document inheritance in
  `--parent` and `--spec` options

## Testing Strategy

### Golden Tryscript Test: `tests/cli-spec-inherit.tryscript.md`

Two main scenarios:

#### Scenario A: Adding a child to a parent with spec link

```bash
# Setup: create a spec file
mkdir -p docs/project/specs/active
echo "# Test Spec" > docs/project/specs/active/plan-test-inherit.md

# Create parent epic linked to spec
tbd create "Epic: Feature X" --type epic --spec docs/project/specs/active/plan-test-inherit.md
# → Created test-XXXX: Epic: Feature X

# Create child task with --parent (NO --spec)
tbd create "Task: Implement X" --parent test-XXXX
# → Created test-YYYY: Task: Implement X

# Verify child inherited spec_path
tbd show test-YYYY --json
# → spec_path: "docs/project/specs/active/plan-test-inherit.md"

# Create child with explicit different spec
tbd create "Task: Related Y" --parent test-XXXX --spec docs/project/specs/active/other-spec.md
# → Created test-ZZZZ: Task: Related Y
# → spec_path: "docs/project/specs/active/other-spec.md" (NOT inherited)
```

#### Scenario B: Updating spec link on parent propagates to children

```bash
# Setup: parent with no spec, two children
tbd create "Epic: Feature Z" --type epic
tbd create "Task 1" --parent test-AAAA
tbd create "Task 2" --parent test-AAAA

# Now link the parent to a spec
tbd update test-AAAA --spec docs/project/specs/active/plan-test-inherit.md
# → Updated test-AAAA

# Verify children got the spec_path
tbd show test-BBBB --json  # → spec_path set
tbd show test-CCCC --json  # → spec_path set

# Now change the parent's spec
echo "# New Spec" > docs/project/specs/active/plan-test-new.md
tbd update test-AAAA --spec docs/project/specs/active/plan-test-new.md

# Children with old inherited value should update
tbd show test-BBBB --json  # → new spec_path
tbd show test-CCCC --json  # → new spec_path
```

## Open Questions

1. **Should clearing a parent’s spec_path also clear children’s?**
   - Current proposal: No.
     Clearing is destructive; children keep their values.
   - Alternative: Clear children that had the same (inherited) value.

2. **Should propagation be recursive (grandchildren)?**
   - Current proposal: Yes, on update propagation, find all descendants (not just direct
     children). This keeps the entire subtree consistent.
   - Implementation: Recursive traversal or iterative BFS over parent_id chain.

3. **Performance concern with large issue sets?**
   - Propagation requires loading all issues to find children.
     For typical project sizes (< 1000 issues), this is acceptable.
     Could optimize with an index later.

## References

- `docs/project/specs/active/plan-2026-01-26-spec-linking.md` - Original spec_path
  feature
- `packages/tbd/src/cli/commands/create.ts` - Create command implementation
- `packages/tbd/src/cli/commands/update.ts` - Update command implementation
- `packages/tbd/src/lib/schemas.ts` - Issue schema definition
- `packages/tbd/docs/tbd-design.md` - Design document (needs update)
- `packages/tbd/docs/tbd-docs.md` - CLI reference (needs update)
