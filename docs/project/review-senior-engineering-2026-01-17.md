# Senior Engineering Review: tbd CLI Tool

**Reviewer**: Claude (Senior Engineering Review Role)
**Date**: 2026-01-17
**Version Reviewed**: 0.1.0 (development)
**Commit**: 48c6316

---

## Executive Summary

**tbd** is a well-architected, thoughtfully designed CLI tool for git-native issue tracking. The tool successfully achieves its primary goals of being a simpler alternative to Beads with better conflict handling, no daemon requirements, and improved cross-environment support. The codebase is clean, well-documented, and follows modern TypeScript best practices.

**Overall Assessment**: **Ready for beta release with minor issues**

The tool is functional and covers the essential workflows. There are some issues that should be addressed before a production release, but none are blockers for beta usage.

---

## Table of Contents

1. [Architectural Review](#architectural-review)
2. [Bugs Found](#bugs-found)
3. [Design Improvement Ideas](#design-improvement-ideas)
4. [Documentation Issues](#documentation-issues)
5. [Testing and Quality](#testing-and-quality)
6. [Performance](#performance)
7. [Agent-Friendly Features](#agent-friendly-features)
8. [Migration from Beads](#migration-from-beads)
9. [Recommendations for Release](#recommendations-for-release)

---

## Architectural Review

### Strengths

1. **Clean Three-Layer Architecture**
   - File Layer: Zod schemas, Markdown+YAML format, atomic writes
   - Git Layer: Worktree management, conflict resolution, sync operations
   - CLI Layer: Commander.js with BaseCommand pattern

2. **Excellent Design Decisions**
   - File-per-issue eliminates merge conflicts on parallel creation
   - Hidden worktree model keeps sync branch separate from working branches
   - Field-level merge with LWW + attic preservation prevents data loss
   - ULID-based internal IDs with short display IDs for usability
   - No daemon requirement enables cloud/sandboxed environment use

3. **Well-Chosen Dependencies**
   - `atomically` for safe file writes
   - `commander` for CLI framework (mature, widely used)
   - `zod` for schema validation
   - `ulid` for sortable unique IDs

4. **Security Considerations**
   - Uses `execFile` instead of shell commands (prevents injection)
   - Proper quoting in git operations
   - No user input directly interpolated into commands

### Areas for Improvement

1. **Error Return Pattern**
   - Commands use `this.output.error()` + `return` instead of throwing
   - This causes exit code 0 on errors (critical for CI/automation)
   - See [Bug #1](#bug-1-exit-codes) below

2. **Worktree Initialization**
   - Requires Git 2.42+ for `--orphan` worktree support
   - Could provide fallback for older Git versions

3. **No Index/Cache Layer**
   - Each `list` operation reads all issue files from disk
   - Works well for <10K issues per performance tests
   - May need optimization for larger repositories

---

## Bugs Found

### Bug #1: Exit Codes (CRITICAL for Agents)

**Severity**: High
**Location**: `src/cli/commands/*.ts`

All error conditions return exit code 0 instead of non-zero:

```bash
$ pnpm tbd show nonexistent-id
✗ Issue not found: nonexistent-id
$ echo $?
0  # Should be 1
```

**Root Cause**: Commands use `this.output.error()` followed by `return` instead of throwing an error:

```typescript
// Current pattern (src/cli/commands/show.ts:31-33)
if (!issue) {
  this.output.error(`Issue not found: ${id}`);
  return;  // Returns with exit 0
}

// Should be:
if (!issue) {
  throw new NotFoundError('Issue', id);
}
```

**Impact**: Agents and CI scripts cannot detect failures via exit codes.

**Fix**: Throw appropriate `CLIError` subclasses instead of returning after `output.error()`.

---

### Bug #2: Dependency Direction Semantics

**Severity**: Medium
**Location**: `src/cli/commands/dep.ts`

The `dep add` command output is confusing:

```bash
$ tbd dep add bd-afau bd-zadd
✓ bd-afau now blocks bd-zadd
```

But running `tbd blocked` shows:
```
bd-zadd ... BLOCKED BY bd-afau
```

This is actually correct behavior, but the command semantics are inverted from what users might expect. When you run `tbd dep add A B`, you'd expect "A depends on B" not "A blocks B".

**Recommendation**: Either:
1. Change semantics to `tbd dep add <issue> <blocked-by>` (issue depends on blocked-by)
2. Add `--blocks` / `--blocked-by` flags to clarify direction
3. Update documentation to make the semantics crystal clear

---

### Bug #3: Search Worktree Refresh Message

**Severity**: Low
**Location**: `src/cli/commands/search.ts`

The search command outputs "Refreshing worktree..." even with `--quiet` flag, which pollutes machine-readable output.

---

### Bug #4: Doctor Reports Healthy as Warning

**Severity**: Low
**Location**: `src/cli/commands/doctor.ts`

When issues directory doesn't exist (empty repo), doctor reports:
```
⚠ Issues directory - Issues directory not found (may be empty)
```

This is not actually a problem - it's expected for a fresh repo with no issues.

---

### Bug #5: Import Changes ID Prefix (Migration UX Issue)

**Severity**: Medium
**Location**: `src/cli/commands/import.ts`

When importing from Beads, the ID prefix changes based on local config rather than preserving the original:

```bash
# Original Beads ID
tbd-100

# After import with config `display.id_prefix: "bd"`
bd-100
```

The numeric short ID ("100") is preserved, but users who had muscle memory for `tbd-100` now need to use `bd-100`. The original ID is stored in `extensions.beads.original_id` but this doesn't help day-to-day usage.

**Recommendation**: Either:
1. Auto-detect prefix from Beads IDs during import and set config accordingly
2. Add `--preserve-prefix` flag to import command
3. Document this clearly as expected behavior in migration guide

---

## Design Improvement Ideas

### Short-term Improvements

1. **Add `--format` Option**
   - Support `--format=json|yaml|table|csv`
   - More flexible than just `--json` flag

2. **Batch Operations**
   - `tbd update --status=closed bd-a bd-b bd-c` (partially implemented for close)
   - Reduces agent round-trips

3. **Issue Templates**
   - `tbd create --template=bug` reads from `.tbd/templates/bug.yml`
   - Pre-fills common fields

4. **Watch Mode for Agents**
   - `tbd watch --on-change="run-tests.sh"`
   - Useful for reactive agent workflows

### Medium-term Improvements

1. **Query DSL**
   - `tbd list "status:open priority:<2 label:backend"`
   - More powerful than individual flags

2. **Issue Links in Description**
   - Auto-link `#bd-xyz` references in descriptions
   - Track implicit dependencies

3. **Compact History View**
   - `tbd log bd-xyz` shows issue history from version changes
   - `tbd diff bd-xyz@2 bd-xyz@3` shows what changed

4. **Bulk Import/Export Improvements**
   - `tbd export --format=github` for GitHub Issues export
   - `tbd import --from=linear` for Linear migration

### Long-term Ideas

1. **Optional Index Layer**
   - SQLite cache for fast queries (opt-in)
   - Regenerated from files on demand
   - Maintains file-as-truth principle

2. **GitHub Issues Sync**
   - Two-way sync with GitHub Issues
   - Map tbd fields to GitHub fields

3. **Plugin Architecture**
   - Custom commands via `.tbd/plugins/`
   - Hook into lifecycle events

---

## Documentation Issues

### README.md

1. **Installation Section**
   - Shows `npm install -g tbd-cli` but package isn't published yet
   - Should note "coming soon to npm" or provide source install instructions

2. **Quick Start Missing Prerequisites**
   - Doesn't mention Git 2.42+ requirement
   - Add note about `git --version` check

### tbd-docs.md

1. **Dependency Command Semantics**
   - The `dep add` documentation should clarify the blocking direction more clearly
   - Add examples showing both directions

2. **Troubleshooting Section**
   - Could use more common error scenarios
   - Add "Git version too old" troubleshooting

### Design Document (tbd-design-v3.md)

1. **Excellent and Comprehensive**
   - Very thorough architectural documentation
   - Good decision rationale sections
   - Well-organized with clear sections

2. **Could Add**
   - Architecture diagram (ASCII or mermaid)
   - Sequence diagram for sync flow
   - State diagram for issue lifecycle

---

## Testing and Quality

### Test Coverage

- **187 tests passing** across 15 test files
- Good coverage of:
  - Core schemas and ID generation
  - File parsing and serialization
  - Merge algorithms
  - Workflow operations
  - Performance characteristics

### Test Quality

**Strengths:**
- Uses Vitest with good isolation
- Performance tests with real benchmarks
- Tests actual file operations (not mocked)

**Gaps:**
- No integration tests with actual git remotes
- No tests for concurrent operations
- No tests for large repositories (>5000 issues)
- Missing error path tests for CLI exit codes

### Code Quality

**Excellent:**
- Consistent code style (ESLint + Prettier)
- TypeScript strict mode enabled
- Good use of Zod for validation
- Clean separation of concerns

**Minor Issues:**
- Some console.log statements in production code (storage.ts:70)
- A few empty catch blocks without comments

---

## Performance

Performance testing showed excellent results:

| Operation | Measured | Target | Status |
|-----------|----------|--------|--------|
| Write 100 issues | 1.4s (14ms/issue) | <30ms/issue | ✅ Pass |
| List 1000 issues | 1.4s | <2s | ✅ Pass |
| Read 100 random | 117ms (1.2ms/issue) | <5ms/issue | ✅ Pass |
| Filter 1000 issues | 0.4ms | <50ms | ✅ Pass |
| Sort 1000 issues | 0.6ms | <50ms | ✅ Pass |

The tool meets its stated performance goals and should handle repositories with several thousand issues without problems.

---

## Agent-Friendly Features

### What Works Well

1. **JSON Output**: `--json` flag on most commands
2. **Non-Interactive Mode**: `--non-interactive` and `--yes` flags
3. **Dry Run**: `--dry-run` for preview
4. **Prime Command**: Excellent context injection for AI agents
5. **Environment Variables**: `TBD_ACTOR` for identity

### What Needs Improvement

1. **Exit Codes**: Critical issue - see Bug #1
2. **Error JSON**: Errors should also be JSON with `--json` flag
3. **Idempotency**: Some operations could be more idempotent
   - `tbd close` on already-closed issue should succeed silently

### Agent Workflow Verification

Tested the recommended agent workflow:
```bash
tbd ready --json          # ✅ Works
tbd update <id> --status=in_progress  # ✅ Works
tbd close <id> --reason="..."  # ✅ Works
tbd sync                  # ✅ Works
```

The basic agent loop works correctly.

---

## Migration from Beads

### Import Testing

Tested import from existing Beads repository:

```bash
$ tbd import --from-beads --verbose
✓ Import complete from .beads/issues.jsonl
  New issues:   265
  Merged:       0
  Skipped:      0
```

**Import Works Well:**
- Preserves short ID numeric portion (100 from tbd-100 → bd-100)
- Maps status values correctly
- Handles tombstoned issues
- Stores original Beads ID in `extensions.beads.original_id`

**Import Limitations:**
- **ID prefix changes**: `tbd-100` becomes `bd-100` because the prefix comes from local config (`display.id_prefix`), not the source. This could confuse users expecting identical IDs.
- `blocked_by` dependencies not fully handled (only `blocks` direction)
- Beads molecules/wisps not imported (by design)
- No validation against running Beads daemon
- No option to preserve original prefix during import

### Compatibility

| Feature | Beads | tbd | Notes |
|---------|-------|-----|-------|
| Core CRUD | ✅ | ✅ | Full parity |
| Dependencies | ✅ | ⚠️ | Only `blocks` type |
| Labels | ✅ | ✅ | Full parity |
| Search | ✅ | ✅ | Full parity |
| Sync | ✅ | ✅ | Different mechanism |
| Daemon | Required | Not needed | Major improvement |
| SQLite | Yes | No | Better for cloud |
| Molecules | ✅ | ❌ | Not planned |
| Agent Mail | ✅ | ❌ | Not planned |

---

## Recommendations for Release

### Before Beta Release (Priority: Critical)

1. **Fix Exit Codes** - All error conditions must return non-zero
2. **Publish to npm** - Package is ready, just needs publishing
3. **Add Git Version Check** - Fail gracefully on Git < 2.42

### Before 1.0 Release (Priority: High)

1. **Improve Dependency Semantics** - Clarify blocking direction
2. **Add Error JSON Output** - Errors should be JSON with --json
3. **Integration Tests** - Add tests with actual git operations
4. **Document Git Requirements** - README should mention Git 2.42+

### Nice to Have (Priority: Medium)

1. **Issue Templates** - Reduce boilerplate for agents
2. **Query DSL** - More powerful filtering
3. **GitHub Issues Sync** - Useful for OSS projects
4. **Architecture Diagrams** - Visual documentation

---

## Conclusion

**tbd is a well-designed, well-implemented tool** that successfully addresses the pain points of Beads (daemon conflicts, SQLite locking, merge conflicts) while maintaining CLI compatibility.

The codebase quality is high, the architecture is sound, and the tool is ready for beta use. The exit code issue is the only critical bug that needs fixing before agents can reliably use the tool in automation.

**Recommended Action**: Fix exit codes, publish to npm, and release as beta.

---

## Appendix: Files Reviewed

- `README.md` - Project overview
- `docs/tbd-docs.md` - CLI reference
- `docs/development.md` - Development guide
- `docs/project/architecture/current/tbd-design-v3.md` - Architecture (partial)
- `packages/tbd-cli/src/cli/cli.ts` - Main CLI setup
- `packages/tbd-cli/src/cli/lib/errors.ts` - Error types
- `packages/tbd-cli/src/cli/commands/show.ts` - Example command
- `packages/tbd-cli/src/cli/commands/import.ts` - Import logic
- `packages/tbd-cli/src/file/git.ts` - Git/worktree operations
- `packages/tbd-cli/src/file/storage.ts` - File storage
- All test files (15 files, 187 tests)

## Appendix: Commands Tested

```bash
tbd status          ✅
tbd stats           ✅
tbd list            ✅
tbd list --json     ✅
tbd ready           ✅
tbd blocked         ✅
tbd stale           ✅
tbd create          ✅
tbd show            ✅
tbd update          ✅
tbd close           ✅
tbd reopen          ✅
tbd search          ✅
tbd label           ✅
tbd dep             ✅
tbd sync            ✅
tbd sync --status   ✅
tbd attic list      ✅
tbd doctor          ✅
tbd import --from-beads ✅
tbd prime           ✅
tbd setup claude --check ✅
tbd docs            ✅
tbd --help          ✅
```
