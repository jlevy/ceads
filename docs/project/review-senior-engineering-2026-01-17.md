# Senior Engineering Review: tbd CLI Tool

**Reviewer**: Claude (Senior Engineering Review Role)
**Date**: 2026-01-17
**Version Reviewed**: 0.1.0 (development)
**Commit**: 48c6316

---

## Executive Summary

**tbd** is a well-architected CLI tool for git-native issue tracking. It successfully achieves its primary goals of being a simpler alternative to Beads with better conflict handling, no daemon requirements, and improved cross-environment support.

**Overall Assessment**: **Ready for beta release with minor issues**

**Key Finding from Beads Comparison**: tbd's simpler approach is better. Beads has 5 different session close protocols based on context; tbd has one clear protocol that always works. **Do not add Beads' complexity.**

---

## Table of Contents

1. [Bugs Summary](#bugs-summary)
2. [Enhancements Summary](#enhancements-summary)
3. [Bugs (Detailed)](#bugs-detailed)
4. [Enhancements (Detailed)](#enhancements-detailed)
5. [Beads vs tbd Comparison](#beads-vs-tbd-comparison)
6. [Testing and Quality](#testing-and-quality)
7. [Release Checklist](#release-checklist)

---

## Bugs Summary

| # | Issue | Bug | Severity | Location | Status |
|---|-------|-----|----------|----------|--------|
| 1 | `tbd-6ijk` | Exit codes return 0 on errors | **Critical** | `src/cli/commands/*.ts` | Open |
| 2 | `tbd-ipm3` | Dependency direction semantics confusing | Medium | `src/cli/commands/dep.ts` | Open |
| 3 | `tbd-21kp` | Search outputs message with --quiet | Low | `src/cli/commands/search.ts` | Open |
| 4 | `tbd-sr6h` | Doctor warns on empty issues dir | Low | `src/cli/commands/doctor.ts` | Open |
| 5 | `tbd-eczs` | Import changes ID prefix | Medium | `src/cli/commands/import.ts` | Open |
| 6 | `tbd-zosy` | Errors not JSON with --json flag | Medium | `src/cli/lib/output.ts` | Open |

---

## Enhancements Summary

### Priority: Critical (Before Beta)

| # | Issue | Enhancement | Category |
|---|-------|-------------|----------|
| E1 | `tbd-6ijk` | Fix exit codes (Bug #1) | Bug Fix |
| E2 | `tbd-cp7s` | Publish to npm | Release |
| E3 | `tbd-l3rp` | Add Git 2.42+ version check | Robustness |

### Priority: High (Before 1.0)

| # | Issue | Enhancement | Category |
|---|-------|-------------|----------|
| E4 | `tbd-ipm3` | Clarify dependency semantics (Bug #2) | UX |
| E5 | `tbd-zosy` | Error JSON output with --json (Bug #6) | Agent Support |
| E6 | `tbd-hnob` | Integration tests with git remotes | Testing |
| E7 | `tbd-i3e3` | Document Git version requirement | Docs |
| E8 | `tbd-ikuj` | Auto-detect ID prefix on import | Migration |

### Priority: Medium (Nice to Have)

| # | Issue | Enhancement | Category |
|---|-------|-------------|----------|
| E9 | `tbd-eflj` | Add `--brief` flag to prime | Agent Support |
| E10 | `tbd-pcyh` | Issue templates | UX |
| E11 | `tbd-5x6s` | Query DSL for list | UX |
| E12 | `tbd-8ob8` | Batch operations | Agent Support |
| E13 | `tbd-emug` | `--format` option (json/yaml/table/csv) | UX |
| E14 | `tbd-jvvy` | Architecture diagrams in docs | Docs |
| E15 | `tbd-8exe` | Make close idempotent | Agent Support |

### Priority: Low (Future)

| # | Issue | Enhancement | Category |
|---|-------|-------------|----------|
| E16 | `tbd-jq95` | Issue history/log command | Feature |
| E17 | `tbd-s00m` | GitHub Issues sync | Feature |
| E18 | `tbd-5e7y` | Plugin architecture | Extensibility |
| E19 | `tbd-j2lv` | Optional SQLite index layer | Performance |
| E20 | `tbd-x469` | Auto-link issue references | UX |

---

## Bugs (Detailed)

### Bug #1: Exit Codes Return 0 on Errors ⚠️ CRITICAL

**Severity**: Critical
**Location**: `src/cli/commands/*.ts`
**Impact**: Agents and CI scripts cannot detect failures

All error conditions return exit code 0 instead of non-zero:

```bash
$ pnpm tbd show nonexistent-id
✗ Issue not found: nonexistent-id
$ echo $?
0  # Should be 1
```

**Root Cause**: Commands use `this.output.error()` + `return` instead of throwing:

```typescript
// Current pattern
if (!issue) {
  this.output.error(`Issue not found: ${id}`);
  return;  // Returns with exit 0
}

// Should be:
if (!issue) {
  throw new NotFoundError('Issue', id);
}
```

**Fix**: Throw `CLIError` subclasses instead of returning after `output.error()`.

---

### Bug #2: Dependency Direction Semantics Confusing

**Severity**: Medium
**Location**: `src/cli/commands/dep.ts`

The `dep add` command semantics are inverted from user expectation:

```bash
$ tbd dep add bd-afau bd-zadd
✓ bd-afau now blocks bd-zadd
```

Users expect `dep add A B` to mean "A depends on B" (B blocks A), but current behavior means "A blocks B".

**Fix Options**:
1. Change semantics to `dep add <issue> <blocked-by>`
2. Add `--blocks` / `--blocked-by` flags
3. Add clearer documentation with examples

---

### Bug #3: Search Outputs Message with --quiet

**Severity**: Low
**Location**: `src/cli/commands/search.ts`

The search command outputs "Refreshing worktree..." even with `--quiet` flag, polluting machine-readable output.

**Fix**: Check quiet mode before outputting status messages.

---

### Bug #4: Doctor Warns on Empty Issues Directory

**Severity**: Low
**Location**: `src/cli/commands/doctor.ts`

When issues directory doesn't exist (empty repo), doctor reports:
```
⚠ Issues directory - Issues directory not found (may be empty)
```

This is expected for a fresh repo with no issues and shouldn't be a warning.

**Fix**: Only warn if directory is expected but missing.

---

### Bug #5: Import Changes ID Prefix

**Severity**: Medium
**Location**: `src/cli/commands/import.ts`

When importing from Beads, the ID prefix changes based on local config:

```bash
# Original Beads ID
tbd-100

# After import with config `display.id_prefix: "bd"`
bd-100
```

The numeric portion is preserved, but users with muscle memory for `tbd-100` must now use `bd-100`.

**Fix Options**:
1. Auto-detect prefix from Beads IDs during import
2. Add `--preserve-prefix` flag
3. Document as expected behavior

---

### Bug #6: Errors Not JSON with --json Flag

**Severity**: Medium
**Location**: `src/cli/lib/output.ts`

When `--json` flag is used, errors still output as plain text instead of JSON, making parsing unreliable for agents.

**Fix**: Wrap errors in JSON structure when `--json` is enabled.

---

## Enhancements (Detailed)

### E1-E3: Critical for Beta

**E1: Fix Exit Codes** - See Bug #1

**E2: Publish to npm**
- Package is ready, needs publishing
- Update README with install instructions

**E3: Add Git Version Check**
- Requires Git 2.42+ for `--orphan` worktree
- Fail gracefully with upgrade instructions

---

### E4-E8: High Priority for 1.0

**E4: Clarify Dependency Semantics** - See Bug #2

**E5: Error JSON Output**
```json
{
  "error": true,
  "code": "NOT_FOUND",
  "message": "Issue not found: bd-xyz"
}
```

**E6: Integration Tests**
- Test with actual git remotes
- Test concurrent operations
- Test large repositories (>5000 issues)

**E7: Document Git Requirements**
- Add to README
- Add to troubleshooting section

**E8: Auto-detect ID Prefix on Import**
- Parse first Beads ID to extract prefix
- Set config `display.id_prefix` accordingly

---

### E9-E15: Medium Priority

**E9: Add `--brief` Flag to Prime**
- ~200 tokens output for minimal context
- Useful for constrained contexts

**E10: Issue Templates**
```bash
tbd create --template=bug  # reads .tbd/templates/bug.yml
```

**E11: Query DSL**
```bash
tbd list "status:open priority:<2 label:backend"
```

**E12: Batch Operations**
```bash
tbd update --status=closed bd-a bd-b bd-c
```

**E13: Format Option**
```bash
tbd list --format=csv
tbd list --format=yaml
```

**E14: Architecture Diagrams**
- Add mermaid diagrams to design doc
- Sequence diagram for sync flow

**E15: Idempotent Close**
- `tbd close` on already-closed issue should succeed silently
- Important for agent retry logic

---

### E16-E20: Future Enhancements

**E16: Issue History**
```bash
tbd log bd-xyz           # Show version history
tbd diff bd-xyz@2 bd-xyz@3  # Show changes
```

**E17: GitHub Issues Sync**
- Two-way sync with GitHub Issues
- Map tbd fields to GitHub fields

**E18: Plugin Architecture**
- Custom commands via `.tbd/plugins/`
- Hook into lifecycle events

**E19: Optional Index Layer**
- SQLite cache for fast queries (opt-in)
- Regenerated from files on demand

**E20: Auto-link Issue References**
- Detect `#bd-xyz` in descriptions
- Track as implicit dependencies

---

## Beads vs tbd Comparison

### Session Close Protocol

**Beads has 5 different protocols:**
1. Stealth/Local-only: `bd sync --flush-only`
2. Daemon auto-syncing: no bd sync needed
3. Ephemeral branch: `bd sync --from-main`, no push
4. No-push mode: manual push
5. Standard mode: full sync

**tbd has 1 protocol:**
```
[ ] 1. git status
[ ] 2. git add <files>
[ ] 3. tbd sync
[ ] 4. git commit -m "..."
[ ] 5. tbd sync
[ ] 6. git push
```

### Code Complexity

| Metric | Beads | tbd |
|--------|-------|-----|
| Prime command lines | 432 | 132 |
| Conditional paths | 5 | 1 |
| Testing complexity | High | Low |

### Recommendation

**Keep tbd simple.** The single protocol is:
- Clearer for agents
- Easier to test
- Simpler to document
- Always correct

**Do NOT add:**
- MCP auto-detection (use `--brief` flag instead)
- Ephemeral branch detection
- Stealth mode (use PRIME.md override)
- Daemon detection (no daemon)

---

## Testing and Quality

### Test Coverage

- **187 tests passing** across 15 test files
- Good coverage of core functionality
- Performance tests included

### Test Gaps

- No integration tests with actual git remotes
- No tests for concurrent operations
- No tests for >5000 issues
- Missing error path tests for CLI exit codes

### Code Quality

**Excellent:**
- Consistent style (ESLint + Prettier)
- TypeScript strict mode
- Zod for validation
- Clean separation of concerns

---

## Release Checklist

### Beta Release

- [ ] **Bug #1**: Fix exit codes (Critical)
- [ ] **E2**: Publish to npm
- [ ] **E3**: Add Git version check
- [ ] Update README with install instructions

### 1.0 Release

- [ ] **Bug #2**: Clarify dependency semantics
- [ ] **Bug #5**: Fix or document ID prefix change
- [ ] **Bug #6**: Error JSON output
- [ ] **E6**: Integration tests
- [ ] **E7**: Document Git requirements
- [ ] **E15**: Idempotent close

### Nice to Have

- [ ] **E9**: `--brief` flag for prime
- [ ] **E10**: Issue templates
- [ ] **E12**: Batch operations
- [ ] **E14**: Architecture diagrams

---

## Appendix: Files Reviewed

- `README.md` - Project overview
- `docs/tbd-docs.md` - CLI reference
- `docs/development.md` - Development guide
- `packages/tbd-cli/src/cli/commands/*.ts` - All commands
- `packages/tbd-cli/src/file/git.ts` - Git operations
- `attic/beads/cmd/bd/prime.go` - Beads prime (432 lines)
- `attic/beads/cmd/bd/setup/claude.go` - Beads Claude setup
- All test files (15 files, 187 tests)

## Appendix: Commands Tested

```
tbd status          ✅    tbd update          ✅
tbd stats           ✅    tbd close           ✅
tbd list            ✅    tbd reopen          ✅
tbd list --json     ✅    tbd search          ✅
tbd ready           ✅    tbd label           ✅
tbd blocked         ✅    tbd dep             ✅
tbd stale           ✅    tbd sync            ✅
tbd create          ✅    tbd attic list      ✅
tbd show            ✅    tbd doctor          ✅
tbd import          ✅    tbd prime           ✅
tbd setup           ✅    tbd docs            ✅
```
