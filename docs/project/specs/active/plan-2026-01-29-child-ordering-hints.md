# Feature: Child Ordering Hints

**Date:** 2026-01-29

**Author:** Claude (with user guidance)

**Status:** Draft

## Overview

Add an optional `child_order_hints` field to issues that allows a parent bead to
maintain hints about the intended display order of its children.
This is a “soft” ordering system that provides hints rather than enforced constraints.

## Goals

- Allow parent issues to store ordering hints for their children
- Display children in the hinted order when showing parent issues
- Automatically append child IDs to the parent’s hints when creating parent-child
  relationships
- Provide CLI command to reset/clear ordering hints
- Maintain full backward compatibility (optional field, no breaking changes)

## Non-Goals

- Enforced strict ordering (this is a hint system)
- Keeping hints perfectly in sync with actual children (too much transactionality)
- Error handling for stale/invalid hint IDs (hints are best-effort)
- Reordering children via CLI (future enhancement)

## Background

Currently, when a parent issue has children, they are displayed without any guaranteed
order. Users want to be able to control the display order of children, particularly when
the order represents workflow sequence or logical grouping.

The `parent_id` field already enables hierarchical relationships.
This feature adds an optional companion field `child_order_hints` to the parent that
records the intended display order.

**Key design principle:** This is a “soft” hint system:

- The hints list does not need to be exhaustive
- The hints list may contain stale IDs (deleted/moved children)
- Children not in the hints list are shown after hinted children
- No errors are raised for invalid hint IDs

## Design

### Approach

Add an optional `child_order_hints` array field to the issue schema.
When displaying children (e.g., in `tbd show` or `tbd list --parent`), sort children by
their position in the parent’s hints list, with unhinted children appearing at the end.

### Schema Change

Add to `IssueSchema` in `packages/tbd/src/lib/schemas.ts`:

```typescript
// Hierarchical issues
parent_id: IssueId.nullable().optional(),

// Child ordering hints (stored as internal IDs, displayed as short IDs)
child_order_hints: z.array(IssueId).default([]),
```

**Storage format example (in YAML):**

```yaml
id: is-01hx5zzkbkactav9wevgemmvrz
title: Auth Epic
child_order_hints:
  - is-01hx5zzkbkbctav9wevgemmvrz
  - is-01hx5zzkbkcctav9wevgemmvrz
  - is-01hx5zzkbkdctav9wevgemmvrz
```

### Behavior

#### When Creating a Parent-Child Relationship

When `tbd create --parent <id>` or `tbd update <id> --parent <new-parent>` is used:

1. Read the parent issue
2. Append the child’s internal ID to the parent’s `child_order_hints` array (if not
   already present)
3. Save the parent with incremented version

#### When Removing a Parent-Child Relationship

When a child’s parent is cleared (`tbd update <id> --parent ""`):

- **Do NOT** remove the child from the old parent’s `child_order_hints`
- The stale hint ID is harmless and will be ignored during display
- This avoids complex transactional updates

#### When Displaying Children

When showing children (e.g., `tbd show <parent>` or `tbd list --parent <id>`):

1. Get actual children (issues where `parent_id` matches)
2. Sort children by their position in `child_order_hints`:
   - Children in hints appear first, in hint order
   - Children not in hints appear after, in their default order (e.g., by created_at)
3. Invalid hint IDs (deleted/moved children) are silently ignored

#### Display Format

When displaying `child_order_hints` in `tbd show`:

- Convert internal IDs to short display IDs (e.g., `bd-a1b2`)
- Show after children list or as part of issue details

Example `tbd show` output:

```
---
id: bd-x1y2
title: Auth Epic
status: open
kind: epic
child_order_hints:
  - bd-a1b2
  - bd-c3d4
  - bd-e5f6
...
---
```

### CLI Commands

#### Viewing Ordering Hints

The hints are shown when viewing an issue with `tbd show`:

```bash
tbd show bd-x1y2
# Shows child_order_hints in the YAML output
```

#### Resetting Ordering Hints

Add an option to clear the hints:

```bash
tbd update <id> --reset-child-order
```

This sets `child_order_hints` to an empty array.

#### Future: Manual Reordering

(Out of scope for initial implementation)

```bash
# Future: reorder children
tbd update <id> --child-order "bd-c3d4,bd-a1b2,bd-e5f6"
```

### Merge Strategy

For the `child_order_hints` field, use the `union` merge strategy (like `labels`):

```typescript
child_order_hints: { strategy: 'union' },
```

This ensures that ordering hints from both local and remote are preserved during sync,
avoiding lost orderings.

## Implementation Plan

### Phase 1: Schema and Storage

- [ ] Add `child_order_hints` field to `IssueSchema`
- [ ] Add merge strategy for `child_order_hints` (union)
- [ ] Update `serializeIssue` to include `child_order_hints` in output
- [ ] Update any schema documentation

### Phase 2: Auto-Population

- [ ] Update `create` command: when `--parent` is used, append child ID to parent’s
  hints
- [ ] Update `update` command: when `--parent` changes to a new parent, append child ID
  to new parent’s hints

### Phase 3: Display and CLI

- [ ] Update `show` command: display `child_order_hints` using short IDs
- [ ] Update child listing logic to sort by hint order
- [ ] Add `--reset-child-order` option to `update` command

### Phase 4: Testing

- [ ] Unit tests for schema changes
- [ ] Integration tests for auto-population
- [ ] Tests for display ordering
- [ ] Tests for `--reset-child-order`

## Testing Strategy

1. **Schema tests**: Verify `child_order_hints` field accepts array of IssueIds
2. **Create tests**: Verify creating with `--parent` appends to parent’s hints
3. **Update tests**: Verify changing parent appends to new parent’s hints
4. **Display tests**: Verify hints display as short IDs
5. **Ordering tests**: Verify children sort correctly by hint position
6. **Reset tests**: Verify `--reset-child-order` clears the array
7. **Stale ID tests**: Verify invalid hint IDs are ignored gracefully

## Rollout Plan

1. Ship as part of a patch release (fully backward compatible)
2. No migration needed - existing issues will have `child_order_hints` default to `[]`
3. Document in CLI help and tbd-design.md

## Open Questions

1. **Should re-parenting remove from old parent’s hints?**
   - Current decision: No, to avoid complex transactional updates
   - Stale hints are harmless

2. **Should there be a command to manually set order?**
   - Current decision: Out of scope for initial implementation
   - `--reset-child-order` is sufficient for MVP

3. **What merge strategy for conflicts?**
   - Proposed: `union` (like labels) to preserve all orderings
   - Alternative: `lww` (last-write-wins) if union causes issues

## References

- [tbd-design.md §2.7.2 Parent-Child Relationships](packages/tbd/docs/tbd-design.md#272-parent-child-relationships)
- [schemas.ts](packages/tbd/src/lib/schemas.ts) - Current schema definitions
- [update.ts](packages/tbd/src/cli/commands/update.ts) - Update command implementation
