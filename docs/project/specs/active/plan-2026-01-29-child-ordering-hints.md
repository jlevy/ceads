# Plan Spec: Child Ordering Hints

## Purpose

Add an optional `child_order_hints` field to issues that tracks the intended display
order of child issues.
This provides a soft, manually-controllable ordering mechanism for parent-child
relationships without requiring strict transactional consistency.

## Background

Currently, when children are displayed under a parent (e.g., in `tbd list --pretty`),
they appear in the order returned by the file system or the order they were fetched.
There’s no way to specify a preferred display order for children.

Users need a simple way to control child ordering, especially for epics where task order
matters. However, maintaining perfect consistency (e.g., automatically removing deleted
children from hints) would require complex transactional logic.

The solution is a “hints” approach: the parent stores a list of child IDs representing
the preferred order.
This list may be stale (contain IDs that no longer exist or aren’t children) and may be
incomplete (not all children listed).
The display logic treats it as a soft preference overlay on top of existing sorting.

### Related Work

- `packages/tbd/src/lib/comparison-chain.ts` — Existing `ordering.manual()` for manual
  sort overlays
- `packages/tbd/src/cli/lib/tree-view.ts` — Tree rendering that needs ordering support
- `packages/tbd/src/cli/commands/update.ts` — Command to modify issue fields

## Summary of Task

1. **Schema change**: Add optional `child_order_hints` field to `IssueSchema` as an
   array of `IssueId`
2. **Automatic population**: When a child is added to a parent (via `--parent` flag),
   append the child’s internal ID to the parent’s `child_order_hints`
3. **Display ordering**: In all places where children are listed, use the hints to sort
   children (using `ordering.manual()`)
4. **Manual update**: Add `--child-order <ids>` flag to `tbd update` to reset the
   ordering hints list
5. **Visibility**: Add `--show-order` flag to `tbd show` to display the ordering hints

## Backward Compatibility

**Fully backward compatible.** The `child_order_hints` field is optional and nullable.
Existing issues without this field work unchanged—children display in default order.
No migration required.

## Stage 1: Planning Stage

### Feature Requirements

1. **Soft hints, not strict relationships**
   - The hints list is advisory only
   - May contain IDs that no longer exist (deleted issues)
   - May contain IDs that are no longer children of this parent (re-parented)
   - May be incomplete (not all children listed)
   - No automatic cleanup when children change

2. **Append on child add**
   - When `tbd update <child> --parent <parent>` is run, append the child’s internal ID
     to the parent’s `child_order_hints`
   - Only append if not already present in the list
   - Do not append if removing parent (`--parent ""`)

3. **Display ordering**
   - Apply hints as first-priority sort
   - Children in hints list appear first, in hints order
   - Children not in hints list appear after, sorted by default order
   - Use `ordering.manual()` from comparison-chain

4. **Manual reset**
   - `tbd update <id> --child-order <id1>,<id2>,...` replaces the entire list
   - Accepts short IDs (e.g., `bd-a1b2,bd-c3d4`) which are resolved to internal IDs
   - `tbd update <id> --child-order ""` clears the list

5. **Visibility**
   - `tbd show <id> --show-order` displays the child_order_hints
   - Shows short IDs for readability
   - Output format: `child_order_hints: [bd-a1b2, bd-c3d4, ...]`

### Not in Scope

- Automatic removal of stale IDs from hints
- Insertion at specific positions (only full replacement)
- Drag-and-drop or move-up/move-down semantics
- Validation that IDs in hints are actually children
- Circular reference detection (not possible since hints are one-directional)

### Acceptance Criteria

- [ ] `child_order_hints` field added to schema, optional array of IssueId
- [ ] Setting `--parent` on a child appends to parent’s hints list
- [ ] `tbd list --pretty` respects ordering hints for children
- [ ] `tbd update --child-order` sets the hints list
- [ ] `tbd show --show-order` displays the hints list
- [ ] All existing tests pass (backward compatibility)
- [ ] New tests cover hint population, sorting, and update

## Stage 2: Architecture Stage

### Schema Change

In `packages/tbd/src/lib/schemas.ts`:

```typescript
export const IssueSchema = BaseEntity.extend({
  // ... existing fields ...

  // Hierarchical issues
  parent_id: IssueId.nullable().optional(),

  // Child ordering hints - soft ordering for children under this parent
  // Array of internal IssueIds in preferred display order
  // May contain stale IDs; display logic filters for actual children
  child_order_hints: z.array(IssueId).nullable().optional(),

  // ... rest of fields ...
});
```

### Internal ID Usage

Like all other cross-references in the schema (e.g., `parent_id`,
`dependencies.target`), `child_order_hints` stores internal IDs (`is-{ulid}`), not short
IDs. This ensures:

- Stability across short ID remapping
- Consistency with existing patterns
- No additional mapping layer needed

### Key Code Changes

#### 1. Schema (`packages/tbd/src/lib/schemas.ts`)

- Add `child_order_hints: z.array(IssueId).nullable().optional()` to IssueSchema

#### 2. Update Command (`packages/tbd/src/cli/commands/update.ts`)

- When `--parent` is set and resolved to a parent issue:
  - Load parent issue
  - Append child’s internal ID to parent’s `child_order_hints` (if not present)
  - Save parent issue
- Add `--child-order` option:
  - Parse comma-separated short IDs
  - Resolve each to internal ID
  - Set as the new `child_order_hints` array

#### 3. Tree View (`packages/tbd/src/cli/lib/tree-view.ts`)

- Modify `buildIssueTree()` to accept parent order hints
- In the parent-child relationship pass, sort children using `ordering.manual()`
- Children in hints appear first in hints order; others follow in default order

#### 4. List Command (`packages/tbd/src/cli/commands/list.ts`)

- When building tree view, pass each parent’s `child_order_hints` to the tree builder

#### 5. Show Command (`packages/tbd/src/cli/commands/show.ts`)

- Add `--show-order` flag
- When flag is set, display `child_order_hints` as short IDs after the main issue output

### Sorting Algorithm

Using the existing `ordering.manual()` from `comparison-chain.ts`:

```typescript
// In tree-view.ts, when sorting children
const sortChildren = (children: TreeNode[], hints: string[] | undefined): TreeNode[] => {
  if (!hints || hints.length === 0) {
    // No hints - use default order (ID for determinism)
    return children.sort(
      comparisonChain<TreeNode>()
        .compare((n) => n.issue.id)
        .result()
    );
  }

  return children.sort(
    comparisonChain<TreeNode>()
      .compare((n) => n.issue.id, ordering.manual(hints))
      .compare((n) => n.issue.id) // Secondary for items not in hints
      .result()
  );
};
```

The `ordering.manual(hints)` comparator:
- Items in `hints` array sort by their position in the array
- Items not in `hints` sort after all hinted items
- Among non-hinted items, secondary sort (by ID) ensures determinism

## Stage 3: Refine Architecture

### Reusable Components Found

1. **`ordering.manual()`** in `comparison-chain.ts` — Already implements manual sort
   overlay, no new sorting code needed

2. **`resolveToInternalId()`** in `update.ts` — Existing helper for short ID → internal
   ID resolution, reuse for `--child-order` parsing

3. **`loadFullContext()`** in `data-context.ts` — Provides ID resolution helpers and
   data access patterns

4. **`serializeIssue()`** in `parser.ts` — Will automatically include the new field in
   YAML output

### Performance Considerations

- `child_order_hints` is a small array (typically <20 items)
- `ordering.manual()` creates a Map for O(1) lookups
- No additional file reads required; hints stored on parent issue
- No database queries or indexes affected (file-based storage)

### Simplifications

- No need for complex insertion/reordering logic—only full replacement
- No validation of hint IDs—stale IDs are harmless (filtered out during display)
- No automatic cleanup—avoids transactional complexity

## Stage 4: Implementation

### Phase 1: Schema and Basic Storage

- [ ] Add `child_order_hints` field to `IssueSchema` in `schemas.ts`
- [ ] Add corresponding type to `types.ts` if needed
- [ ] Verify serialization/parsing handles the new field correctly
- [ ] Write unit test: issue with `child_order_hints` serializes and deserializes
  correctly

### Phase 2: Automatic Population on Parent Set

- [ ] In `update.ts`, when `--parent` is set to a valid parent:
  - Load the parent issue
  - Append child ID to `child_order_hints` (dedup check)
  - Save parent issue with incremented version
- [ ] Write unit test: setting parent appends to hints
- [ ] Write unit test: setting parent when already in hints doesn’t duplicate
- [ ] Write unit test: removing parent (empty string) doesn’t affect hints

### Phase 3: Display Ordering

- [ ] Modify `buildIssueTree()` signature to accept order hints per parent
- [ ] Create helper function `sortChildren()` using `ordering.manual()`
- [ ] Apply sorting in tree-view when building children arrays
- [ ] In `list.ts`, pass order hints when calling tree view functions
- [ ] Write unit test: children sorted by hints order
- [ ] Write unit test: children not in hints appear after hinted ones
- [ ] Write unit test: empty/missing hints uses default order

### Phase 4: Manual Update Command

- [ ] Add `--child-order` option to update command
- [ ] Parse comma-separated short IDs
- [ ] Resolve each to internal ID (error if any not found)
- [ ] Set `child_order_hints` field on issue
- [ ] Write unit test: `--child-order a,b,c` sets correct internal IDs
- [ ] Write unit test: `--child-order ""` clears the list
- [ ] Write e2e test: full round-trip (set order, list, verify order)

### Phase 5: Show Command Enhancement

- [ ] Add `--show-order` flag to show command
- [ ] When flag is set, output `child_order_hints` (as short IDs)
- [ ] Format: after main issue output, add line like `Children order: bd-a1b2, bd-c3d4`
- [ ] If no hints, show “Children order: (none)”
- [ ] Write unit test: `--show-order` displays hints correctly

### Phase 6: Validation and Cleanup

- [ ] Run full test suite
- [ ] Run lint and typecheck
- [ ] Test manually with various scenarios:
  - Create parent, add children in order
  - Verify `tbd list --pretty` shows correct order
  - Reset order with `--child-order`
  - Verify new order in list
  - Check `--show-order` displays correctly
- [ ] Update any relevant documentation

## Validation

- [ ] All tests pass (existing + new)
- [ ] Lint, typecheck, format pass
- [ ] Build succeeds
- [ ] Manual testing confirms expected behavior
- [ ] Backward compatibility: existing issues work unchanged

## Detailed Testing Plan

### Testing Principles

Following the project’s TDD and golden testing guidelines:

- **Red → Green → Refactor**: Start with failing tests that demonstrate the current
  behavior doesn’t preserve order, then implement to make them pass
- **Golden session tests**: Capture full CLI execution traces to detect behavioral
  regressions
- **Minimal, maximal coverage**: Write few tests that cover the desired functionality
  exhaustively

### Test 1: Golden Session Test - Child Order Preservation

**Purpose**: End-to-end test demonstrating that child ordering is preserved through
create, list, and delete operations.

**File**: `packages/tbd/tests/child-order.test.ts`

**Scenario**:

```
1. Create parent issue (epic)
2. Create children A, B, C, D under parent (in that order)
3. Verify `tbd list --pretty` shows children in order: A, B, C, D
4. Delete child B
5. Verify `tbd list --pretty` shows remaining children in order: A, C, D
6. Manually reorder to: D, A, C using `--child-order`
7. Verify `tbd list --pretty` shows children in order: D, A, C
8. Verify `tbd show <parent> --show-order` displays correct hints
```

**Implementation approach**:

```typescript
describe('child ordering', () => {
  it('preserves child order through create, list, and delete operations', async () => {
    // Setup: init git repo and tbd
    initGitAndTbd();

    // Step 1: Create parent epic
    const parentResult = runTbd(['create', 'Parent Epic', '--type=epic']);
    const parentId = extractId(parentResult.stdout);

    // Step 2: Create children in specific order
    const childAResult = runTbd(['create', 'Child A', '--parent', parentId]);
    const childA = extractId(childAResult.stdout);
    const childBResult = runTbd(['create', 'Child B', '--parent', parentId]);
    const childB = extractId(childBResult.stdout);
    const childCResult = runTbd(['create', 'Child C', '--parent', parentId]);
    const childC = extractId(childCResult.stdout);
    const childDResult = runTbd(['create', 'Child D', '--parent', parentId]);
    const childD = extractId(childDResult.stdout);

    // Step 3: Verify initial order in list
    const list1 = runTbd(['list', '--pretty']);
    const children1 = extractChildOrder(list1.stdout, parentId);
    expect(children1).toEqual([childA, childB, childC, childD]);

    // Step 4: Delete child B
    runTbd(['close', childB]);

    // Step 5: Verify order preserved after deletion
    const list2 = runTbd(['list', '--pretty', '--status', 'open']);
    const children2 = extractChildOrder(list2.stdout, parentId);
    expect(children2).toEqual([childA, childC, childD]);

    // Step 6: Manually reorder to D, A, C
    runTbd(['update', parentId, '--child-order', `${childD},${childA},${childC}`]);

    // Step 7: Verify new manual order
    const list3 = runTbd(['list', '--pretty', '--status', 'open']);
    const children3 = extractChildOrder(list3.stdout, parentId);
    expect(children3).toEqual([childD, childA, childC]);

    // Step 8: Verify show --show-order
    const showResult = runTbd(['show', parentId, '--show-order']);
    expect(showResult.stdout).toContain('child_order_hints:');
    expect(showResult.stdout).toContain(childD);
  });
});
```

### Test 2: TDD Baseline - Demonstrate Current Behavior Doesn’t Preserve Order

**Purpose**: Before implementation, write a test that shows children currently appear in
arbitrary order (by ID or filesystem order), not insertion order.

**Expected**: This test should FAIL before implementation and PASS after.

```typescript
it('BASELINE: children without order hints appear in ID order (not insertion order)', async () => {
  // Create parent and children where ID order differs from insertion order
  // This test documents current behavior and will change after implementation
});
```

### Test 3: Unit Tests - Schema and Serialization

**File**: `packages/tbd/tests/schemas.test.ts` (add to existing)

```typescript
describe('child_order_hints field', () => {
  it('serializes and deserializes correctly with child_order_hints', () => {
    const issue = {
      ...baseIssue,
      child_order_hints: ['is-abc123', 'is-def456', 'is-ghi789'],
    };
    const serialized = serializeIssue(issue);
    const parsed = parseIssue(serialized);
    expect(parsed.child_order_hints).toEqual(['is-abc123', 'is-def456', 'is-ghi789']);
  });

  it('handles null child_order_hints', () => {
    const issue = { ...baseIssue, child_order_hints: null };
    const serialized = serializeIssue(issue);
    const parsed = parseIssue(serialized);
    expect(parsed.child_order_hints).toBeNull();
  });

  it('handles missing child_order_hints (backward compatibility)', () => {
    const oldIssue = { ...baseIssue }; // no child_order_hints field
    const serialized = serializeIssue(oldIssue);
    const parsed = parseIssue(serialized);
    expect(parsed.child_order_hints).toBeUndefined();
  });
});
```

### Test 4: Unit Tests - Automatic Population

**File**: `packages/tbd/tests/child-order.test.ts`

```typescript
describe('automatic child_order_hints population', () => {
  it('appends child ID to parent hints when setting --parent', async () => {
    // Create parent, then child with --parent
    // Verify parent's child_order_hints contains child ID
  });

  it('does not duplicate if child already in hints', async () => {
    // Create parent with existing hints
    // Set --parent to same parent again
    // Verify no duplicate entries
  });

  it('does not modify hints when removing parent (--parent "")', async () => {
    // Create parent with child
    // Remove parent from child
    // Verify parent's hints unchanged (stale ID is OK per design)
  });
});
```

### Test 5: Unit Tests - Tree View Sorting

**File**: `packages/tbd/tests/tree-view.test.ts` (add to existing)

```typescript
describe('child ordering with hints', () => {
  it('sorts children by hints order', () => {
    const issues = [
      { id: 'parent', kind: 'epic', child_order_hints: ['child-c', 'child-a', 'child-b'] },
      { id: 'child-a', parentId: 'parent', ... },
      { id: 'child-b', parentId: 'parent', ... },
      { id: 'child-c', parentId: 'parent', ... },
    ];
    const roots = buildIssueTree(issues);
    const childIds = roots[0].children.map(c => c.issue.id);
    expect(childIds).toEqual(['child-c', 'child-a', 'child-b']);
  });

  it('places children not in hints after hinted children', () => {
    const issues = [
      { id: 'parent', kind: 'epic', child_order_hints: ['child-b'] },
      { id: 'child-a', parentId: 'parent', ... },
      { id: 'child-b', parentId: 'parent', ... },
      { id: 'child-c', parentId: 'parent', ... },
    ];
    const roots = buildIssueTree(issues);
    const childIds = roots[0].children.map(c => c.issue.id);
    // child-b first (in hints), then a and c in ID order
    expect(childIds[0]).toBe('child-b');
  });

  it('handles empty hints (default order)', () => {
    // Verify deterministic default order when no hints
  });

  it('handles stale IDs in hints (non-existent children)', () => {
    // Verify stale IDs are silently ignored
  });
});
```

### Test 6: Integration Tests - Update Command

**File**: `packages/tbd/tests/child-order.test.ts`

```typescript
describe('--child-order flag', () => {
  it('sets child_order_hints from comma-separated short IDs', async () => {
    // Create parent with children
    runTbd(['update', parentId, '--child-order', 'bd-abc,bd-def,bd-ghi']);
    // Verify hints contain resolved internal IDs
  });

  it('clears hints with empty string', async () => {
    // Create parent with hints
    runTbd(['update', parentId, '--child-order', '""']);
    // Verify hints are cleared
  });

  it('errors on invalid ID in order list', async () => {
    const result = runTbd(['update', parentId, '--child-order', 'bd-invalid']);
    expect(result.status).not.toBe(0);
    expect(result.stderr).toContain('not found');
  });
});
```

### Test 7: Show Command Enhancement

**File**: `packages/tbd/tests/child-order.test.ts`

```typescript
describe('--show-order flag', () => {
  it('displays child_order_hints as short IDs', async () => {
    const result = runTbd(['show', parentId, '--show-order']);
    expect(result.stdout).toContain('child_order_hints:');
    // Verify short IDs are displayed, not internal IDs
  });

  it('shows (none) when no hints', async () => {
    const result = runTbd(['show', issueWithNoHints, '--show-order']);
    expect(result.stdout).toContain('child_order_hints: (none)');
  });
});
```

### Stable vs Unstable Fields for Golden Tests

Per golden testing guidelines, identify stable and unstable fields:

**Stable fields** (compare exactly):
- child_order_hints array contents and order
- Child display order in `tbd list` output
- Command exit codes
- Error messages (for invalid operations)

**Unstable fields** (filter/normalize):
- Timestamps (created_at, updated_at)
- Full internal IDs (use short IDs in assertions)
- Exact line formatting (test semantic order, not spacing)

### Test Execution Order

Following TDD methodology:

1. **First**: Write Test 2 (baseline) to demonstrate current behavior
2. **Second**: Write Test 3 (schema) - should pass immediately after schema change
3. **Third**: Write Test 5 (tree-view sorting) - drives sorting implementation
4. **Fourth**: Write Test 4 (automatic population) - drives update command changes
5. **Fifth**: Write Test 6 (--child-order flag) - drives CLI enhancement
6. **Sixth**: Write Test 7 (--show-order flag) - drives show command enhancement
7. **Finally**: Write Test 1 (golden session) - comprehensive integration test

### CI Integration

All tests should:
- Run in under 100ms each (mocked mode, no network)
- Be included in the standard `pnpm test` run
- Use temp directories that are cleaned up after tests
- Not depend on external state or ordering between tests

## Stage 5: Documentation Updates

The following documentation must be updated to reflect the new `child_order_hints`
feature:

### 1. tbd-design.md Updates

#### Schema Section (§2.6.3 IssueSchema)

Add `child_order_hints` field to the schema documentation after `parent_id`:

```typescript
// Hierarchical issues
parent_id: IssueId.optional(),

// Child ordering hints - soft ordering for children under this parent.
// Array of internal IssueIds in preferred display order.
// May contain stale IDs; display logic filters for actual children.
child_order_hints: z.array(IssueId).nullable().optional(),
```

Add design notes explaining:
- Purpose: Soft hints for child display order
- Auto-population: Appended when setting `--parent`
- Stale ID handling: Silently ignored during display
- Manual control via `--child-order` flag

#### Parent-Child Relationships Section (§2.7.2)

Update to describe child ordering:

- Default behavior: Children sorted by priority (via list command)
- With hints: Children sorted according to `child_order_hints`
- Auto-population: When child is assigned to parent, ID appended to hints
- Manual reordering: Use `tbd update <parent> --child-order <id1>,<id2>,...`
- Visibility: Use `tbd show <id> --show-order` to see current hints

#### Update Command Section (§4.2.6)

Add `--child-order` flag to options table:

```
--child-order=<ids>    Set child ordering hints (comma-separated IDs)
```

With example:
```bash
tbd update proj-a1b2 --child-order bd-c3d4,bd-e5f6,bd-g7h8
```

#### Show Command Section (§4.2.4)

Add `--show-order` flag to options table:

```
--show-order              Display children ordering hints
```

With example:
```bash
tbd show proj-a1b2 --show-order
# Output includes: child_order_hints: [bd-c3d4, bd-e5f6, bd-g7h8]
```

#### Merge Strategies Section (§3.4.3)

Document that `child_order_hints` uses LWW (last-writer-wins) strategy:

```typescript
child_order_hints: 'lww',
```

### 2. CLI Help Consistency

Verify that `--help` output for affected commands matches documentation:

- `tbd update --help` should list `--child-order`
- `tbd show --help` should list `--show-order`

### 3. tbd-docs.md Updates (if applicable)

If tbd-docs.md contains command reference sections, ensure they include:
- `--child-order` for update command
- `--show-order` for show command

### 4. Type Safety Documentation

Document the branded types added for ID handling:

- `InternalIssueId`: Branded type for storage IDs (`is-{ulid}`)
- `DisplayIssueId`: Branded type for display IDs (`{prefix}-{short}`)
- Helper functions: `asInternalId()`, `asDisplayId()`

This ensures compile-time safety when handling IDs in different contexts.

### Documentation Acceptance Criteria

- [ ] tbd-design.md schema section includes `child_order_hints` field
- [ ] tbd-design.md §2.7.2 describes child ordering behavior
- [ ] tbd-design.md update command section includes `--child-order`
- [ ] tbd-design.md show command section includes `--show-order`
- [ ] tbd-design.md merge strategies includes `child_order_hints: 'lww'`
- [ ] CLI `--help` output matches documentation
- [ ] Branded types (InternalIssueId, DisplayIssueId) are documented
