# Postmortem: Worktree Architecture Not Implemented

**Date:** 2026-01-16

**Author:** Claude (with Joshua Levy)

**Status:** Analysis complete, fix pending

**Related Beads:** tbd-1810, tbd-208, tbd-1837, tbd-1838

* * *

## Summary

The tbd implementation deviated significantly from the design specification.
The spec called for a hidden git worktree architecture where issue files live on a
separate `tbd-sync` branch, accessed locally via `.tbd/data-sync-worktree/`. Instead,
the implementation writes files directly to `.tbd/data-sync/` on the main branch,
completely bypassing the worktree model.

This was discovered on 2026-01-16 when issue files appeared as untracked on main branch.

* * *

## Impact

| Area | Intended Behavior | Actual Behavior |
| --- | --- | --- |
| Issue storage | Only on `tbd-sync` branch | Directly on main branch |
| `git status` | Clean (issues in gitignored worktree) | Shows `.tbd/data-sync/` changes |
| Branch isolation | Issues separate from code | Issues mixed with code |
| Sync model | Push/pull to dedicated branch | No branch separation |

* * *

## Timeline

| Phase | What Should Have Happened | What Actually Happened |
| --- | --- | --- |
| Design | Spec written (tbd-design-v3.md §2.3) | Spec was clear and detailed |
| Planning | Created tbd-208: "Implement worktree management" | Bead correctly captured requirement |
| Phase 2 | Implement `initWorktree`, `updateWorktree`, `checkWorktreeHealth` | **Functions never written; bead marked DONE** |
| Phase 3 | `tbd init` creates worktree via `git worktree add` | **init.ts creates `.tbd/data-sync/` directly in cwd** |
| Phase 4-11 | Commands use `.tbd/data-sync-worktree/.tbd/data-sync/` | **All commands hardcode `.tbd/data-sync/`** |
| Testing | Tests verify file locations | **No location verification tests** |
| Discovery | — | Bug found 2026-01-16, logged as tbd-1810 |

* * *

## Root Cause Analysis

### 1. Bead Marked Done Without Implementation

**tbd-208** specified: “Implement worktree management (initWorktree, updateWorktree,
checkWorktreeHealth)”

The `git.ts` file that was implemented contains:

- `git()` - execute git commands
- `withIsolatedIndex()` - isolated index for commits
- `mergeIssues()` - three-way merge algorithm
- `pushWithRetry()` - push with retry logic

But **none** of the specified functions:

- `initWorktree()` — not implemented
- `updateWorktree()` — not implemented
- `checkWorktreeHealth()` — not implemented

The bead was marked complete after implementing git utilities, without verifying the
specific deliverables were present.

### 2. Init Command Implemented Incorrectly

The spec (plan lines 729-740) shows a decision tree:

```
Does .tbd/data-sync-worktree/ exist and valid?
├── YES → Worktree ready
└── NO → Does tbd-sync branch exist?
    ├── YES (local) → git worktree add .tbd/data-sync-worktree tbd-sync --detach
    └── NO → git worktree add .tbd/data-sync-worktree --orphan tbd-sync
```

The actual `init.ts` implementation (lines 59-68):

```typescript
// Creates .tbd/data-sync/issues/ DIRECTLY - no worktree!
await mkdir(join(cwd, '.tbd/data-sync', 'issues'), { recursive: true });
// ...
this.output.info('  git add .tbd/ .tbd/data-sync/');  // Tells user to commit to main!
```

This is the **opposite** of the design intent.
The init command should never suggest committing `.tbd/data-sync/` to main.

### 3. Wrong Base Path Hardcoded Everywhere

Every command file contains:

```typescript
const ISSUES_BASE_DIR = '.tbd/data-sync';  // WRONG
```

Should be:

```typescript
const ISSUES_BASE_DIR = '.tbd/data-sync-worktree/.tbd/data-sync';  // CORRECT per spec
```

Files affected:

- `src/cli/commands/create.ts`
- `src/cli/commands/list.ts`
- `src/cli/commands/show.ts`
- `src/cli/commands/update.ts`
- `src/cli/commands/close.ts`
- `src/cli/commands/reopen.ts`
- `src/cli/commands/ready.ts`
- `src/cli/commands/blocked.ts`
- `src/cli/commands/stale.ts`
- `src/cli/commands/label.ts`
- `src/cli/commands/depends.ts`
- `src/cli/commands/search.ts`
- `src/cli/commands/sync.ts`
- `src/cli/commands/stats.ts`
- `src/cli/commands/info.ts`
- `src/cli/commands/doctor.ts`
- `src/cli/commands/attic.ts`
- `src/cli/commands/import.ts`

### 4. No Behavioral Verification in Tests

The original test suite verified:

- Command output format
- JSON structure
- Error messages

But did **not** verify:

- Where files are actually written
- That the worktree exists
- That files are on the correct branch

Test helpers `isCorrectWorktreePath()` and `isWrongMainBranchPath()` were added
**after** bug discovery (tbd-1837), not during original implementation.

* * *

## Why This Wasn’t Caught

1. **No code review against spec**: The implementation was accepted without verifying it
   matched the design document.

2. **Bead description too vague**: “Implement worktree management” didn’t have
   acceptance criteria or verification steps.

3. **Tests tested output, not behavior**: Golden tests verified CLI output but not
   filesystem state.

4. **Simpler approach worked**: Writing directly to `.tbd/data-sync/` produces correct
   CLI output, so functional tests passed.

5. **No integration test for architecture**: There was no test that verified the
   fundamental architectural decision (worktree vs direct).

* * *

## Lessons Learned

| Gap | Mitigation |
| --- | --- |
| Bead marked done without deliverable verification | Add acceptance criteria to implementation beads; require explicit verification |
| Spec not enforced during implementation | Create tryscript tests that verify architectural constraints |
| Simplification not documented | If deviating from spec, update spec AND create tracking bead explaining why |
| Init command diverged from spec | Review initialization logic against design docs before merge |
| Missing behavioral tests | Every architectural decision needs a test that catches violations |

* * *

## Action Items

### Immediate (tbd-1810 fix)

1. Implement actual worktree functions: `initWorktree()`, `updateWorktree()`,
   `checkWorktreeHealth()`
2. Update `tbd init` to create worktree properly
3. Change `ISSUES_BASE_DIR` in all commands to use worktree path
4. Add `sync-worktree/` to `.tbd/.gitignore`

### Process Improvements

1. **Add architectural verification tests** (tbd-1842): Create tryscript tests that
   verify files are written to `.tbd/data-sync-worktree/.tbd/data-sync/`, not
   `.tbd/data-sync/`

2. **Require bead acceptance criteria**: Implementation beads should list specific
   functions/files that must exist

3. **Spec compliance review**: Before marking phase complete, verify implementation
   matches design doc section by section

* * *

## Proposed Solution: Multi-Layer Verification

### The Core Problem

The bead description was too vague to verify:

| Vague (what we had) | Specific (what we needed) |
| --- | --- |
| "Implement worktree management" | `[ ] Function initWorktree() exists in git.ts` |
|  | `[ ] Function updateWorktree() exists in git.ts` |
|  | `[ ] Function checkWorktreeHealth() exists in git.ts` |
|  | `[ ] tbd init calls initWorktree()` |
|  | `[ ] Test verifies files written to .tbd/data-sync-worktree/` |

With specific acceptance criteria, any validation phase would have caught that 0/5 items
were done.

### Recommended Process Changes (Ranked by Effectiveness)

#### 1. Automated Architectural Tests (Most Effective)

Write tests FIRST that verify architectural constraints:

```typescript
// This test would have failed immediately
it('writes issues to worktree, not main branch', async () => {
  await run('tbd init');
  await run('tbd create "Test"');

  // This assertion would FAIL with current implementation
  expect(await exists('.tbd/data-sync-worktree/.tbd/data-sync/issues/')).toBe(true);
  expect(await exists('.tbd/data-sync/issues/')).toBe(false);
});
```

**Why this is best:** Can’t be bypassed.
If the test fails, CI fails.
No subjective judgment required.

#### 2. Acceptance Criteria on Implementation Beads

Require beads to list specific deliverables:

```markdown
tbd-208: Implement worktree management

Acceptance Criteria:
- [ ] initWorktree() function in src/file/git.ts
- [ ] updateWorktree() function in src/file/git.ts
- [ ] checkWorktreeHealth() function in src/file/git.ts
- [ ] Unit tests for each function
- [ ] init.ts calls initWorktree()
```

**Why this helps:** Makes it obvious when work is incomplete.
The implementer would have seen “0/5 done” instead of thinking they were finished.

#### 3. Spec Section Mapping

Link each bead to the specific spec section it implements:

```markdown
tbd-208: Implement worktree management
Spec: tbd-design-v3.md §2.3 "Hidden Worktree Model"
```

Then validation explicitly checks: “Does the implementation match §2.3?”

#### 4. Validation Phase with Reopen Capability

A separate validation step performed by a **different agent** than the implementer:

- Reviews completed beads against spec/criteria
- Can reopen beads with notes explaining what’s missing
- Creates child beads for missing work

**Key benefit:** The validator has **controlled, concise context** from the bead itself,
rather than inheriting all the accumulated assumptions and context drift from the
implementation session.
The bead description and acceptance criteria define what gets checked, not whatever the
implementer happened to be thinking.

**Caveat:** This is manual and can be skipped under time pressure.
Still subjective without clear acceptance criteria.
Best used as a third layer after automated tests and acceptance criteria.

### Proposed Bead Template

```markdown
## Task: [Title]

### Description
[What needs to be done]

### Spec Reference
[Link to design doc section, e.g., "tbd-design-v3.md §2.3"]

### Acceptance Criteria
- [ ] [Specific deliverable 1]
- [ ] [Specific deliverable 2]
- [ ] [Test that verifies behavior]

### Validation (filled after implementation)
- [ ] All acceptance criteria verified
- [ ] Implementation matches spec section
- Validator: [name/agent]
- Notes: [any issues found, or "LGTM"]
```

### Summary

The most effective fix combines:

1. **Acceptance criteria on beads** — specific, checkable items that can’t be
   misinterpreted
2. **Architectural constraint tests** — automated tests that verify WHERE things happen,
   not just WHAT happens
3. **Validation phase** — human/agent review as a third layer, with ability to reopen
   beads

A validation phase alone would help but is insufficient without acceptance criteria to
validate against. Automated tests are the strongest guarantee because they can’t be
bypassed or rubber-stamped.

* * *

## References

- Design spec: `docs/project/architecture/current/tbd-design-v3.md` §2.3 Hidden Worktree
  Model
- Implementation plan:
  `docs/project/specs/active/plan-2026-01-15-tbd-v1-implementation.md` Phase 2
- Bug bead: tbd-1810
- Original (incomplete) implementation bead: tbd-208
- Retroactive test helpers: tbd-1837, tbd-1838
