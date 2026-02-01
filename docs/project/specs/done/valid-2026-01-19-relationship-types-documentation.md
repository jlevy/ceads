# Feature Validation: Relationship Types Documentation (§2.7)

## Purpose

This validation spec documents the comprehensive new section added to tbd-design.md that
clarifies the relationship type model, comparing tbd’s approach to Beads and documenting
the rationale for design differences.

**Feature Plan:** N/A (ad-hoc documentation clarification based on user question)

**Implementation Plan:** N/A (documentation only)

## Stage 4: Validation Stage

## Validation Planning

This was a documentation clarification task.
The goal was to clearly document:
1. Why tbd uses `parent_id` field instead of Beads’ `parent-child` dependency type
2. The semantic difference (non-blocking vs blocking)
3. Visualization commands for each relationship type
4. Real-world usage data from Beads’ own issue tracker

## Automated Validation (Testing Performed)

### Unit Testing

No unit tests were added - this was documentation work only.

### Integration and End-to-End Testing

No integration tests were added - this was documentation work only.

## Manual Testing Needed

The user should review the following documentation changes to confirm accuracy:

### 1. New Section §2.7 Relationship Types

Review `docs/tbd-design.md` section 2.7 which includes:

| Subsection | Content |
| --- | --- |
| §2.7.1 Relationship Model Overview | ASCII diagram showing parent-child vs dependencies |
| §2.7.2 Parent-Child Relationships | Documents `parent_id` field semantics |
| §2.7.3 Dependency Relationships | Documents `dependencies[]` array and supported types |
| §2.7.4 Visualization Commands | Table mapping commands to data sources |
| §2.7.5 Comparison with Beads | Key differences with rationale |
| §2.7.6 Future Dependency Types | Roadmap based on real-world Beads usage |

### 2. Key Design Claims to Verify

The documentation makes these claims about the codebase:

| Claim | How to Verify |
| --- | --- |
| `parent_id` is non-blocking | Check `ready.ts` - should NOT exclude issues with parent_id set |
| `blocks` affects ready queue | Check `ready.ts` - should exclude issues with unresolved blockers |
| `--pretty` uses `parent_id` | Check `treeView.ts` line 67 - builds tree from `parentId` |
| `blocked` uses `dependencies` | Check `blocked.ts` - builds `blockedByMap` from `dependencies` |

### 3. Validation Commands

Run these commands to verify the documentation matches the CLI:

```bash
# Verify list --pretty shows parent-child tree (uses parent_id)
tbd list --pretty --help
# Should show: Tree format showing parent-child hierarchy

# Verify blocked command shows blockers (uses dependencies)
tbd blocked --help
# Should show: List blocked issues

# Verify ready command (should NOT be affected by parent_id)
tbd ready --help
# Should show: List issues ready to work on (open, unblocked, unclaimed)

# Verify dep commands
tbd dep --help
# Should show: add, remove, list subcommands
```

### 4. Cross-References Updated

Verify these sections now reference §2.7:

- Appendix A.3.4 Dependency Types - should have “See also” link to §2.7
- Appendix B.7 Additional Dependency Types - should have “See also” link to §2.7

### 5. Table of Contents

Verify the table of contents includes the new subsections:

```bash
grep -A 10 "2.7 Relationship" docs/tbd-design.md | head -15
```

Should show all 6 subsections listed.

### 6. Beads Comparison Accuracy

The documentation cites these statistics from Beads’ own issue tracker:
- `blocks`: 47% (156 uses)
- `parent-child`: 42% (140 uses)
- `discovered-from`: 11% (37 uses)
- `related`: <1% (2 uses)

These were obtained by analyzing `attic/beads/.beads/issues.jsonl.new`.

## Open Questions

None - all documentation has been added.
The key insight is documented: tbd intentionally uses a different model where
`parent_id` is organizational only (non-blocking), while Beads’ `parent-child` enables
transitive blocking (if a parent is blocked, children inherit that blockage—but children
are NOT blocked just because their parent is open).
