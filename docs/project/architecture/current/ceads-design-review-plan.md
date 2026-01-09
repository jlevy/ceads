# Ceads Design Review: Concrete Suggestions Plan

**Source:** Distributed systems review - concrete replacement suggestions

**Status:** Complete - All "Implement Now" items done

---

## Summary of Suggestions

This document tracks the concrete design suggestions from the distributed systems review,
categorizing them as "implement now" (clean, clear improvements) or "defer" (require more
discussion or significant architectural changes).

---

## Implement Now (Clean/Clear Improvements)

### 1. Upgrade Attic Schema to Capture base/ours/theirs
**Status:** DONE
**Rationale:** Better debugging and recovery, works with current or future merge approach.

The current attic only stores the "lost value." Storing base + ours + theirs + chosen
provides better context for understanding and recovering from conflicts.

### 2. Make Messages Immutable
**Status:** DONE
**Rationale:** Eliminates merge complexity for messages entirely. Good design principle.

Messages (comments) rarely need editing. Making them immutable means:
- No merge logic needed for message content
- "Edits" become new messages with `edit_of` reference
- Dramatically simplifies the system

### 3. Clarify EntityType Extensibility
**Status:** DONE
**Rationale:** Current design has contradictory statements about extensibility.

The design says "extensible by convention" but uses a closed enum for EntityType.
Should use a regex pattern instead of enum for true extensibility.

### 4. Add Canonical JSON Specification Details
**Status:** DONE (previous commit)
**Rationale:** Already added in previous commit, but can add more detail.

Need exact spec for key ordering and unknown field handling.

### 5. Document Hidden Worktree as Recommended Implementation
**Status:** DONE
**Rationale:** This is cleaner than bare git plumbing and aligns with Open Question 1.

The hidden worktree approach:
- Uses normal git porcelain (pull, commit, push)
- Enables Git's native 3-way merge if we want it later
- Avoids complex read-tree/write-tree/update-ref plumbing

### 6. Add nanoid as Recommended ID Generation Library
**Status:** DONE
**Rationale:** Cleaner than manual implementation, well-tested.

Current implementation is correct but manual. nanoid is simpler and battle-tested.

### 7. Windows-Safe Attic Filename Format
**Status:** DONE
**Rationale:** Current format may use colons which don't work on Windows.

Change from `2025-01-07T10:30:00Z_field.json` to `20250107T103000Z_field.json`

### 8. 3-Way Set Merge for Labels (Supports Removals)
**Status:** DONE
**Rationale:** The 3-way set merge algorithm works with current design and fixes removals.

The provided `mergeSet3Way` algorithm can replace union and correctly handle removals
when base is available (which it is from git history even without full merge driver).

---

## Defer for Further Discussion

### D1. Full Git 3-Way Merge Driver Architecture
**Status:** DEFER
**Rationale:** Significant architectural change requiring careful consideration.

This would replace the current sync algorithm with a Git merge driver. Benefits:
- Correct handling of concurrent edits
- Git provides base/ours/theirs automatically
- No custom version comparison logic

Concerns:
- More complex to implement and debug
- Requires understanding Git internals
- Merge driver failures can be confusing for users

**Decision needed:** Is the added correctness worth the implementation complexity?
The current approach (content hash + field-level merge) may be "good enough" for v1.

### D2. Claims as First-Class Entities
**Status:** DEFER
**Rationale:** Data model change that affects multiple parts of the system.

Benefits:
- Claiming doesn't modify issue file (fewer conflicts)
- Cleaner separation of concerns
- Better lease tracking

Concerns:
- Adds a new entity type
- Queries become more complex (join claims with issues)
- Migration path needed

**Decision needed:** Is the conflict reduction worth the added complexity?

### D3. Declarative Merge Rules File (.ceads/merge_rules.yml)
**Status:** DEFER
**Rationale:** Nice for extensibility but adds complexity.

Benefits:
- New entity types configurable without code changes
- Self-documenting merge behavior

Concerns:
- Yet another config file to maintain
- Merge rules are already documented in code
- Adds indirection

**Decision needed:** Wait until we have concrete need for custom entity types.

### D4. Hidden Worktree Implementation Details
**Status:** DEFER (document concept now, implementation details later)
**Rationale:** Implementation specifics depend on other decisions.

The concept is sound and should be documented as the recommended approach.
Exact implementation (worktree location, creation flow) can be finalized during
implementation.

---

## Already Done (Previous Commit)

- [x] Fix ID generation algorithm (base36 encoding, entropy)
- [x] Fix sync algorithm data loss risk (content hash detection)
- [x] Move last_sync to local state
- [x] Add canonical JSON serialization requirement
- [x] Add deterministic tie-breaker for LWW
- [x] Clarify union strategy limitations
- [x] Document deletion semantics
- [x] Clarify schema-agnostic vs field-aware merge
- [x] Add jitter/backoff to sync retries
- [x] Document atomic write mechanics
- [x] Add extensions namespace
- [x] Document heartbeat churn concerns
- [x] Clarify parent_id vs sequence authority

---

## Implementation Order

1. Upgrade attic schema (base/ours/theirs)
2. Windows-safe attic filenames
3. Make messages immutable
4. Clarify EntityType extensibility (regex vs enum)
5. Add 3-way set merge algorithm
6. Document hidden worktree approach
7. Add nanoid recommendation

---

## Notes

The suggestions for a full Git 3-way merge driver are technically superior but add
significant complexity. The current approach (content hash detection + field-level
merge rules + attic for losers) is simpler and may be sufficient for v1.

If we find that the simpler approach causes real problems (silent data loss, wrong
winners), we can upgrade to the merge driver approach. The attic improvements we're
making now will work with either approach.
