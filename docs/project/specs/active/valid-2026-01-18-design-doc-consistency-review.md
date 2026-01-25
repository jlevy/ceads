# Feature Validation: Design Doc Consistency Review

## Purpose

This validation spec documents the comprehensive review of tbd-design.md against the
actual CLI implementation and tbd-docs.md.
All inconsistencies were tracked as tbd beads and resolved through documentation fixes.

**Feature Plan:** N/A (ad-hoc review task)

**Implementation Plan:** N/A (documentation fixes only)

## Stage 4: Validation Stage

## Validation Planning

This was a documentation consistency review, not a feature implementation.
The goal was to ensure tbd-design.md accurately reflects the actual CLI implementation.

## Automated Validation (Testing Performed)

### Unit Testing

No unit tests were added - this was documentation work only.

### Integration and End-to-End Testing

No integration tests were added - this was documentation work only.

## Manual Testing Needed

The user should review the following documentation changes to confirm accuracy:

### 1. Design Doc Section Reviews

The following sections of `docs/tbd-design.md` were updated:

| Section | Changes Made |
| --- | --- |
| §1.1 Introduction | Fixed typos ("may for the base" → "may be the base", "coordiation" → "coordination") |
| §2.1 Issue File Format | Added note clarifying example uses human-friendly order, not canonical |
| §2.6.4 ConfigSchema | Added `index_enabled: z.boolean().default(true)` |
| §2.6.6 LocalStateSchema | Added implementation note about state.json vs state.yml |
| §3.2 Files Tracked | Added mappings/ids.yml to tracked files list |
| §3.2 .gitignore | Fixed to include all 3 entries (cache/, data-sync-worktree/, data-sync/) |
| §4.4 List Command | Added --long, --count, --pretty options |
| §4.7 Sync Command | Added --force option |
| §4.8 Search Command | Updated options to match CLI, marked unimplemented as future |
| §4.10 Global Options | Added --debug, marked --actor as "not yet implemented" |
| §4.11 Attic Commands | Fixed syntax to use `<id> <timestamp>` instead of composite entry-id |
| §6.4.2 setup claude | Marked --project/--global as future, added note |
| §8.1 Actor System | NEW SECTION - Documents implementation status and design questions |
| Appendix tables | Fixed --actor from "✅ Full" to "🔄 Future", dep tree to "🔄 Future" |

### 2. Code Comment Fixes

| File | Change |
| --- | --- |
| `packages/tbd/src/lib/schemas.ts` | Fixed Version comment: "Git push rejection" not "content hash" for conflict detection |
| `packages/tbd/src/file/hash.ts` | Fixed module comment: "merge resolution tiebreaking" not "conflict detection" |

### 3. tbd-docs.md Updates

| Section | Changes Made |
| --- | --- |
| init command | Added --prefix requirement |
| list command | Added --long and --pretty options |
| ready/blocked | Added --long option |
| Documentation Commands | NEW SECTION - readme, docs, design, closing |
| uninstall command | NEW SECTION - with --confirm, --keep-branch, --remove-remote |
| setup section | Added setup auto and setup beads --disable examples |

### 4. Validation Commands

Run these commands to verify the documentation matches the CLI:

```bash
# Verify list command options
tbd list --help
# Should show: --long, --pretty, --count options

# Verify search command options
tbd search --help
# Should show: --field, --status, --limit, --no-refresh, --case-sensitive
# Should NOT show: --type, --label, --context, --files-only, --count (marked future)

# Verify setup claude options
tbd setup claude --help
# Should show: --check, --remove
# Should NOT show: --project, --global (marked future)

# Verify attic command syntax
tbd attic --help
# Should show: show <id> <timestamp>, restore <id> <timestamp>

# Verify global options
tbd --help
# Should show: --debug
# Should NOT show: --actor (not implemented)
```

### 5. Review Open Issues

One issue was deferred for future design work:

```bash
tbd list --status deferred
# Should show: tbd-fbt2 - Actor/assignee system design
```

### 6. Review New Open Questions Section

Review `docs/tbd-design.md` §8.1 “Actor System Design” to confirm:
- Implementation status is accurately documented
- Design questions are relevant and complete
- Recommendation to defer is appropriate

## Open Questions

None - all documentation inconsistencies have been addressed.
The actor system design (tbd-fbt2) is intentionally deferred pending further design work
on multi-agent workflows.

* * *

## Post-Validation Update (2026-01-25)

**Note:** The `.tbd/.gitignore` entries documented in §3.2 have changed:

- **Before:** `cache/`, `data-sync-worktree/`, `data-sync/`
- **After:** `docs/`, `state.yml`, `data-sync-worktree/`, `data-sync/`

The `cache/` directory has been removed entirely.
See the doc-cache abstraction spec for details on this simplification.
