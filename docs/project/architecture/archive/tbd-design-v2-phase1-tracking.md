# Tbd V2 Phase 1 Design Review Tracking

**Review Source:** tbd-design-v2-review1-gpt-5-pro.md

**Tracking Started:** January 2025

**Legend:**

- [x] Completed - fix applied

- [ ] Pending - clear fix needed, not yet applied

- [?] Open Question - needs discussion or decision

- [~] Declined - suggestion reviewed and intentionally not applied

* * *

## 1. Editorial/Consistency Fixes (Quick Wins)

These are straightforward corrections that don’t change design intent.

### Terminology and Naming

- [x] **V2-040**: `--auto-sync` wording doesn’t match config key

  - **Location:** §5.5 Migration gotchas (#3)

  - **Fix:** Replace "with `--auto-sync` config" with "with `settings.auto_sync: true`"

- [x] **V2-041**: “version-based conflict resolution” but detection is hash-based

  - **Location:** §1.1 Key characteristics, §3.4

  - **Fix:** Rephrase to “hash-based conflict detection with version/timestamp-based
    merge ordering”

- [x] **V2-042**: `type` vs `kind` vs CLI `--type` confusion

  - **Location:** §2.5.3 + CLI

  - **Fix:** Add explicit note: "CLI `--type` maps to schema field `kind`"

### Missing Values in Lists

- [x] **V2-024**: `IssueKind` includes `chore` but CLI docs omit it

  - **Location:** §4.4 Create/List filters

  - **Fix:** Add `chore` to CLI examples where types are listed

* * *

## 2. Specification Clarifications

These add missing details but don’t fundamentally change the design.

### Canonical JSON and Normalization

- [x] **V2-017**: Stored JSON normalization (defaults present or omitted) is not defined

  - **Location:** §2.5 Schemas + canonical JSON

  - **Fix:** Add rule: “All writers MUST serialize fully-normalized entities with
    defaults applied”

- [x] **V2-018**: Canonical JSON doesn’t address newline normalization on Windows

  - **Location:** §2.1 Canonical JSON

  - **Fix:** Specify LF line endings, recommend `.gitattributes` rule

- [x] **V2-010**: Array ordering not defined → nondeterministic hashes

  - **Location:** §2.1 Canonical JSON + §3.5

  - **Fix:** Add ordering rules for labels (lexicographic) and dependencies (by target)

### Merge Rules Completeness

- [x] **V2-007**: Merge rules omit BaseEntity fields

  - **Location:** §3.5 Issue Merge Rules

  - **Fix:** Add explicit merge rules for `created_at`, `updated_at`, `created_by`,
    `closed_at`, `version`

- [x] **V2-008**: Tie-breaker for equal timestamps is missing

  - **Location:** §3.5 LWW strategy

  - **Fix:** Define deterministic tie-breaker when timestamps are equal

- [x] **V2-023**: `closed_at` merge behavior is undefined

  - **Location:** IssueSchema vs merge rules

  - **Fix:** Add explicit rules for status/closed_at interaction

- [x] **V2-011**: “Every merge produces attic entries” is too broad

  - **Location:** §3.4 Resolution Flow note

  - **Fix:** Clarify attic entries only for discarded data, not union merges

### Atomic Writes

- [x] **V2-019**: Atomic write algorithm not fully cross-platform safe

  - **Location:** §2.1 Atomic File Writes

  - **Fix:** Reword for Windows/NFS reality

- [x] **V2-020**: Temp file cleanup could race between processes

  - **Location:** §2.1 Cleanup note

  - **Fix:** Only cleanup temp files older than threshold

### Performance and Indexing

- [x] **V2-037**: Index schema uses Map/Set but stored as JSON

  - **Location:** §6.1 Query Index interface

  - **Fix:** Define explicit JSON encoding

- [x] **V2-038**: Index “checksum of issues directory” needs defined algorithm

  - **Location:** §6.1 Index

  - **Fix:** Define checksum as git tree hash or baseline commit

* * *

## 3. ID Generation and Mapping Fixes

### ID Entropy

- [x] **V2-013**: ID entropy comment + collision math are wrong/inconsistent

  - **Location:** §2.4 ID Generation

  - **Problem:** Code uses `randomBytes(4)` (32 bits) but slices to 6 hex chars (24
    bits)

  - **Fix:** Align code, comment, and probability statement

- [x] **V2-014**: 4-hex IDs are too short

  - **Location:** §2.4 regex

  - **Fix:** Update minimum to 6 hex chars for stored IDs

### Mapping Consistency

- [x] **V2-015**: Display-prefix compatibility vs import mapping is inconsistent

  - **Location:** §5.5 “IDs change” + §5.1.4

  - **Fix:** Clarify that imported IDs get new Tbd IDs, display prefix only affects
    output

* * *

## 4. CLI and UX Improvements

### Missing CLI Features

- [x] **V2-025**: Notes field exists but CLI lacks explicit support

  - **Location:** IssueSchema includes `notes`; CLI commands don’t expose it

  - **Fix:** Add `--notes` and `--notes-file` to update command, show notes in
    `tbd show`

- [x] **V2-031**: Examples show IDs with `bd-` prefix but internal IDs are `is-`

  - **Location:** CLI examples across §4

  - **Fix:** Add early explanation of display prefix vs internal ID

### Import Command Consistency

- [x] **V2-033**: Design goal says `tbd import beads` but CLI spec says
  `tbd import <file>`

  - **Location:** §1.3 Design Goals vs §5.1 Import Command

  - **Fix:** Update design goal to match actual command syntax

* * *

## 5. Design Decisions Requiring Discussion

These are substantive changes that may affect architecture.

### Git Layer Safety (BLOCKERS)

- [x] **V2-001**: Git write flow can clobber user index / staged changes

  - **Location:** §3.3.2 “Writing to Sync Branch”

  - **Problem:** Plumbing operations use current repo index, risks destroying staged
    changes

  - **Decision needed:** Use isolated index (`GIT_INDEX_FILE`) or hidden worktree

  - **Resolution:** Added explicit requirement for isolated index, invariant statement

- [x] **V2-002**: Local working copy location for `.tbd-sync/` is undefined

  - **Location:** §2.2 Directory Structure + §3.3 Sync Operations

  - **Problem:** Unclear where issue files live locally on working branch

  - **Decision needed:** Add “Local storage model” subsection

  - **Resolution:** Added section 2.6 Local Storage Model clarifying cache-based
    approach

- [x] **V2-003**: Missing rule for not leaving untracked `.tbd-sync/` noise on main

  - **Location:** §2.2 + §3.2

  - **Problem:** If `.tbd-sync/` used locally, it will show as untracked

  - **Resolution:** Addressed in Local Storage Model - files live in cache, not working
    tree

- [?] **V2-004**: `git show tbd-sync:` vs remote tracking branch ambiguity

  - **Location:** §3.3.1 Reading from Sync Branch

  - **Problem:** After fetch, should read from `origin/tbd-sync` not local `tbd-sync`

  - **Status:** Needs review - may require restructuring sync section

- [x] **V2-005**: Push retry strategy is underspecified

  - **Location:** §3.3.2

  - **Fix:** Specify exact retry loop with merge algorithm

  - **Resolution:** Added detailed retry algorithm

- [x] **V2-006**: `tbd sync --status` baseline is undefined

  - **Location:** §4.7 Sync Commands

  - **Fix:** Define baseline as last successful sync commit

  - **Resolution:** Added baseline definition

### Extensions Merge Strategy

- [x] **V2-009**: `extensions` merge strategy as `lww` loses data across namespaces

  - **Location:** §3.5 Issue Merge Rules

  - **Problem:** LWW on whole extensions object drops namespaces from other side

  - **Decision needed:** Change to merge-by-namespace strategy

  - **Resolution:** Updated to deep_merge_by_namespace strategy

### Mapping File Conflicts

- [?] **V2-016**: Single mapping file on sync branch can become a conflict hotspot

  - **Location:** §5.1.4 `.tbd-sync/mappings/beads.json`

  - **Options:**

    1. File-per-beads-id mappings

    2. Define merge semantics for mapping file

  - **Status:** Low priority - concurrent imports are rare

### Attic CLI

- [x] **V2-029**: Lack of attic CLI undermines “no data loss” claim

  - **Location:** Attic sections vs CLI commands

  - **Decision needed:** Add `tbd attic list/show/restore` commands

  - **Resolution:** Added section 4.11 Attic Commands

* * *

## 6. Data Model Refinements

- [x] **V2-021**: `version` field description is misleading

  - **Location:** §2.5.1

  - **Problem:** Called “optimistic concurrency” but conflicts are hash-based

  - **Fix:** Rename/clarify as “merge version counter”

- [x] **V2-022**: Missing semantics for `created_by` / actor identity

  - **Location:** IssueSchema + CLI global `--actor`

  - **Fix:** Define actor resolution order

- [x] **V2-026**: `due_date` and `deferred_until` types might be too strict

  - **Location:** Timestamp usage

  - **Fix:** Document accepted formats and normalization behavior

* * *

## 7. Import/Migration Specifics

- [x] **V2-034**: Multi-source import merge should write attic on conflicts

  - **Location:** §5.1.3 Multi-Source Merge Algorithm

  - **Fix:** Preserve losing versions to attic during import

  - **Resolution:** Added note about attic preservation during import conflicts

- [x] **V2-035**: Import mapping authority is ambiguous

  - **Location:** §5.1.4

  - **Fix:** Define recovery path from extensions field

  - **Resolution:** Added mapping recovery note

- [x] **V2-036**: Tombstone handling described in multiple places

  - **Location:** §2.5.3, §5.1.7, §5.4, §5.5

  - **Fix:** Consolidate in one place

  - **Resolution:** Added cross-reference to consolidate

* * *

## 8. Performance Considerations

- [x] **V2-039**: Performance goals likely require incremental sync

  - **Location:** §1.3 + §3.3

  - **Fix:** Add expectation that common operations use index and diff-based updates

  - **Resolution:** Added performance note about incremental operations

- [x] **V2-032**: `ready` algorithm depends on dependency target status

  - **Location:** §4.4 Ready command

  - **Fix:** Add note about index usage for ready computation

  - **Resolution:** Added caching note

* * *

## 9. Compatibility Contract

- [x] **V2-027**: “Drop-in replacement” needs a compatibility contract

  - **Location:** §1.1 + §5

  - **Fix:** Add Compatibility Contract section

  - **Resolution:** Added section 5.6 Compatibility Contract

- [x] **V2-028**: `--db <path>` option naming is confusing

  - **Location:** §4.9 Global Options

  - **Fix:** Add note that `--db` is for Beads compatibility

  - **Resolution:** Added clarification and preferred `--dir` alias

- [x] **V2-030**: `tbd list --sort` values mismatch field names

  - **Location:** §4.4 List options

  - **Fix:** Document that created/updated are shorthand for field names

  - **Resolution:** Added clarification

* * *

## 10. Clock and Timestamp Concerns

- [?] **V2-012**: Clock skew assumptions are unaddressed

  - **Location:** §3.5 LWW

  - **Problem:** LWW relies on timestamps; clock skew can cause wrong winners

  - **Status:** Add note acknowledging issue, defer HLC to Phase 2

* * *

## 11. Creative Ideas from Review

These are suggestions for alternate approaches, not bugs.

- [?] **Idea 1**: Use internal worktree for sync writes (even if hidden from users)
  - **Status:** Consider for implementation, spec says “isolated index” which is similar

- [?] **Idea 2**: Longer internal IDs + short display prefixes (Git-style)
  - **Status:** Current 6-hex is reasonable, could extend later

- [?] **Idea 3**: File-per-entity for mapping files too
  - **Status:** Low priority, mapping conflicts are rare

- [x] **Idea 4**: Attic recovery as first-class CLI in Phase 1
  - **Status:** Added to spec as V2-029 fix

- [x] **Idea 5**: Extensions merge-by-namespace instead of LWW
  - **Status:** Addressed as V2-009

- [x] **Idea 6**: Explicit sync baseline commit in local state
  - **Status:** Fully addressed - added `last_synced_commit` to LocalStateSchema

- [?] **Idea 7**: Define outbox/inbox conventions for future bridges
  - **Status:** Defer to Phase 2

* * *

## Summary

| Category | Total | Completed | Pending | Open Questions |
| --- | --- | --- | --- | --- |
| Editorial | 4 | 4 | 0 | 0 |
| Spec Clarifications | 12 | 12 | 0 | 0 |
| ID/Mapping | 3 | 3 | 0 | 0 |
| CLI/UX | 3 | 3 | 0 | 0 |
| Design Decisions | 8 | 7 | 0 | 1 |
| Data Model | 3 | 3 | 0 | 0 |
| Import | 3 | 3 | 0 | 0 |
| Performance | 2 | 2 | 0 | 0 |
| Compatibility | 3 | 3 | 0 | 0 |
| Clock/Timestamp | 1 | 0 | 0 | 1 |
| Creative Ideas | 7 | 3 | 0 | 4 |
| **Total** | **49** | **43** | **0** | **6** |

* * *

## Open Questions for Discussion

1. **V2-004**: Should we explicitly define when to read from `origin/tbd-sync` vs local
   `tbd-sync`?

2. **V2-012**: Should we add a note about clock skew or defer HLC to Phase 2?

3. **V2-016**: Is file-per-mapping worth the complexity, or is single mapping file
   acceptable?

4. **Idea 2**: Should we extend internal IDs beyond 6 hex chars for long-term scaling?

5. **Idea 3**: Should mapping files follow file-per-entity pattern?

6. **Idea 7**: Should we reserve outbox/inbox directory structure for Phase 2 bridges?

* * *

*Last updated: January 10, 2025*
