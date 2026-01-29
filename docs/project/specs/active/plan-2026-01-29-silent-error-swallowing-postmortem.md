# Post-Mortem: Silent Error Swallowing in tbd sync

**Date:** 2026-01-29

**Author:** Claude (with Joshua Levy)

**Status:** Draft

## Overview

A P0 bug was discovered where `tbd sync` silently swallowed push failures and reported
“Already in sync” to users, leading them to believe their data was synced when it
wasn’t. This post-mortem analyzes the root cause, documents the fix, and proposes
systematic engineering guidelines and process improvements to prevent this class of bug.

## Incident Summary

| Attribute | Value |
| --- | --- |
| **Severity** | P0 - Data loss risk |
| **Duration** | Unknown (possibly since feature was implemented) |
| **Detection** | Manual debugging during Claude Code sync issues |
| **Impact** | Users believed data was synced when it wasn't |
| **Issue ID** | tbd-ca3g |
| **Epic** | tbd-i10x |

## Goals

- **G1**: Document the bug and fix for future reference
- **G2**: Identify the anti-pattern that caused this bug
- **G3**: Create actionable engineering guidelines to prevent recurrence
- **G4**: Propose tooling (lint rules, types) to catch this at compile time
- **G5**: Update development processes and code review checklists

## Non-Goals

- Changing the fundamental sync architecture
- Comprehensive audit of all error handling (that’s a separate task)

## Timeline

1. **Unknown**: Bug introduced when push retry logic was added to sync
2. **2026-01-29 ~20:00**: During debugging of Claude Code sync issues, noticed
   `tbd sync` said “Already in sync” but `--status` showed commits ahead
3. **2026-01-29 ~20:30**: Root cause identified in sync.ts lines 660-685
4. **2026-01-29 ~20:45**: Fix implemented - sync now reports push failures explicitly
5. **2026-01-29 ~21:00**: Fix committed and tested

## Root Cause Analysis

### The Bug

In `sync.ts`, the `fullSync()` method:

```typescript
// Lines 660-667: Push attempt
if (aheadCommits > 0) {
  const result = await this.doPushWithRetry(syncBranch, remote);
  if (!result.success) {
    this.output.debug(`Push failed: ${result.error}`);  // ← ONLY debug log!
  }
}

// Lines 679-685: Report status
if (!summaryText) {
  this.output.data({ summary: 'Already in sync' }, () => {
    console.log('Already in sync.');  // ← Reported even if push failed!
  });
}
```

### The Anti-Pattern

**Silent Error Swallowing**: An operation fails, but the failure is only logged to debug
(invisible to users) while the code continues and reports success.

```typescript
// THE ANTI-PATTERN
const result = await riskyOperation();
if (!result.success) {
  logger.debug(`Failed: ${result.error}`);  // Hidden from user
}
// ... code continues, reports success ...
```

### Why This Happened

1. **Debug-only logging**: The error was logged, but to debug level which users never
   see
2. **No failure state tracking**: The function didn’t track whether critical operations
   succeeded
3. **Optimistic success reporting**: “Already in sync” was based on absence of summary
   text, not actual operation success
4. **Missing tests**: No test verified that push failures were reported to users

### Contributing Factors

| Factor | How it Contributed |
| --- | --- |
| Complex control flow | Multiple code paths made it easy to miss the failure case |
| Result type ignored | `{ success: boolean }` was checked but failure wasn't surfaced |
| Debug vs user output | Easy to log to debug thinking it's "handled" |
| No explicit success/fail state | Function tracked summaryText, not operation outcomes |

## The Fix

The fix added explicit push failure handling:

```typescript
// Track push state
let pushFailed = false;
let pushError = '';

if (aheadCommits > 0) {
  const result = await this.doPushWithRetry(syncBranch, remote);
  if (!result.success) {
    pushFailed = true;
    pushError = result.error ?? 'Unknown push error';
    this.output.debug(`Push failed: ${pushError}`);
  }
}

// Report push failure explicitly - don't silently swallow
if (pushFailed) {
  this.output.error(`Push failed: ${displayError}`);
  console.log(`  ${aheadCommits} commit(s) not pushed to remote.`);
  console.log(`  Run 'tbd sync' to retry.`);
  return;  // Don't report "Already in sync"
}
```

## Engineering Guidelines

### Category 1: Error Visibility

#### Guideline 1.1: No Debug-Only Error Handling

**Rule**: If an operation can fail in a way that affects the user’s data or
expectations, the failure MUST be communicated to the user, not just logged to debug.

```typescript
// ❌ BAD: Error hidden from user
if (!result.success) {
  this.output.debug(`Operation failed: ${result.error}`);
}

// ✅ GOOD: Error visible to user
if (!result.success) {
  this.output.error(`Operation failed: ${result.error}`);
  // OR throw, OR return error state
}
```

#### Guideline 1.2: Errors Must Be Actionable

**Rule**: Error messages must tell users what happened AND what they can do about it.

```typescript
// ❌ BAD: Unhelpful error
console.error('Push failed');

// ✅ GOOD: Actionable error
console.error('Push failed: HTTP 403 - Permission denied');
console.error('  Check your authentication or try: git push origin branch-name');
```

#### Guideline 1.3: Exit Codes Must Reflect Reality

**Rule**: CLI commands must return non-zero exit codes when operations fail.

```typescript
// ❌ BAD: Always exits 0
process.exit(0);

// ✅ GOOD: Exit code reflects success
process.exit(allSucceeded ? 0 : 1);
```

### Category 2: State Management

#### Guideline 2.1: Explicit Operation State Tracking

**Rule**: Track success/failure state for all critical operations.
Never infer success from absence of failure indicators.

```typescript
// ❌ BAD: Inferring success from empty summary
if (!summaryText) {
  console.log('All done!');
}

// ✅ GOOD: Explicit success tracking
let allOperationsSucceeded = true;

if (!pushResult.success) {
  allOperationsSucceeded = false;
}

if (allOperationsSucceeded) {
  console.log('All done!');
} else {
  console.log('Some operations failed.');
}
```

#### Guideline 2.2: No Implicit State Assumptions

**Rule**: Don’t assume state based on what “should” happen.
Always verify.

```typescript
// ❌ BAD: Assumes worktree exists because init should have created it
const path = getWorktreePath();
await writeFile(join(path, 'data.yml'), content);

// ✅ GOOD: Verify before use
const path = getWorktreePath();
if (!await pathExists(path)) {
  throw new WorktreeMissingError('Worktree not found. Run tbd doctor --fix');
}
await writeFile(join(path, 'data.yml'), content);
```

### Category 3: Result Handling

#### Guideline 3.1: Result Types Must Be Handled

**Rule**: When a function returns `{ success: boolean, error?: string }`, the failure
case MUST result in user-visible feedback or a thrown exception.

```typescript
// ❌ BAD: Result checked but failure swallowed
const result = await operation();
if (!result.success) {
  logger.warn(result.error);  // Only logging
}
doNextThing();  // Continues regardless

// ✅ GOOD: Result checked and failure handled
const result = await operation();
if (!result.success) {
  throw new OperationError(result.error);
}
doNextThing();  // Only reached on success
```

#### Guideline 3.2: Prefer Exceptions Over Result Types for Critical Operations

**Rule**: For operations where failure means “stop everything”, use exceptions rather
than Result types. Result types are for “handle gracefully and continue” scenarios.

```typescript
// Use exceptions for critical operations
async function pushToRemote(): Promise<void> {
  const output = await git('push', 'origin', branch);
  if (output.exitCode !== 0) {
    throw new PushError(output.stderr);
  }
}

// Use Result for graceful degradation scenarios
async function fetchMetadata(): Promise<Result<Metadata>> {
  // Failure here is okay - we can proceed without metadata
}
```

### Category 4: User Communication

#### Guideline 4.1: User-Facing Messages Must Reflect Reality

**Rule**: Success messages must only be shown when all relevant operations succeeded.

```typescript
// ❌ BAD: Success without verification
await pull();
await push();  // Might have failed!
console.log('Sync complete!');

// ✅ GOOD: Success only after verification
const pullOk = await pull();
const pushOk = await push();

if (pullOk && pushOk) {
  console.log('Sync complete!');
} else {
  console.log('Sync incomplete - see errors above.');
}
```

#### Guideline 4.2: Be Honest About Partial Success

**Rule**: If some operations succeeded and some failed, say so clearly.

```typescript
// ❌ BAD: Hiding partial failure
console.log('Operation complete');  // But half of it failed

// ✅ GOOD: Clear about what happened
console.log('Pulled 5 changes from remote');
console.log('Push failed: 2 commits not uploaded');
console.log('Run `tbd sync` to retry push.');
```

### Category 5: Defensive Coding

#### Guideline 5.1: Fail Fast, Fail Loud

**Rule**: When something unexpected happens, fail immediately with a clear error rather
than continuing in an uncertain state.

```typescript
// ❌ BAD: Silently continue with fallback
const config = await readConfig().catch(() => defaultConfig);

// ✅ GOOD: Fail if config is expected to exist
const config = await readConfig().catch((e) => {
  throw new ConfigError(`Cannot read config: ${e.message}. Run tbd setup.`);
});
```

#### Guideline 5.2: No Empty Catch Blocks

**Rule**: Catch blocks must either handle the error meaningfully or re-throw.

```typescript
// ❌ BAD: Swallowing errors
try {
  await riskyOperation();
} catch (e) {
  // Ignored
}

// ✅ GOOD: Handle or re-throw
try {
  await riskyOperation();
} catch (e) {
  if (isExpectedError(e)) {
    // Handle the expected case
    return fallbackValue;
  }
  throw e;  // Re-throw unexpected errors
}
```

#### Guideline 5.3: Validate at Boundaries

**Rule**: Validate inputs and state at function boundaries, not deep inside the code.

```typescript
// ❌ BAD: Validation scattered throughout
async function sync(options) {
  // ... 50 lines later ...
  if (!options.branch) { /* handle missing */ }
  // ... 30 more lines ...
}

// ✅ GOOD: Validation at entry
async function sync(options) {
  // Validate immediately
  if (!options.branch) {
    throw new ValidationError('Branch is required');
  }
  // Now we can trust options.branch exists
}
```

## Automated Detection Processes

### Process 1: Golden Testing for Error Scenarios

**How Golden Testing Could Have Caught This Bug:**

The bug would have been detected if we had golden tests that captured the full output of
`tbd sync` when push fails.
The golden file would have shown:

```yaml
# Expected (what golden test should have captured)
scenario: sync-with-push-failure
commands:
  - tbd sync
expected_output: |
  Push failed: HTTP 403 - Permission denied
  2 commit(s) not pushed to remote.
  Run 'tbd sync' to retry.
exit_code: 1
```

Instead, without this test, the actual output was:
```
Already in sync.
```
… with exit code 0.

**Golden Test Requirements for CLI Commands:**

1. **Capture all output streams**: stdout, stderr, and exit code
2. **Test failure scenarios explicitly**: Don’t just test happy paths
3. **Include git operation state**: Mock git responses and verify correct handling
4. **Expose internal behavior**: Log key decisions to a debug stream captured in golden

**Proposed Golden Test Structure:**

```typescript
describe('sync golden tests', () => {
  it('handles push failure correctly', async () => {
    // Setup: mock git push to fail
    mockGit.push.mockRejectedValue(new Error('HTTP 403'));

    // Run command and capture all output
    const result = await runCommand('tbd sync');

    // Golden comparison includes:
    // - stdout
    // - stderr
    // - exit code
    // - internal decision log (e.g., "push failed, reporting error")
    await expectGolden(result, 'sync-push-failure.golden');
  });
});
```

**Golden Test File (sync-push-failure.golden):**

```yaml
stdout: |
  Syncing with remote...
stderr: |
  Push failed: HTTP 403 - Permission denied
  2 commit(s) not pushed to remote.
  Run 'tbd sync' to retry.
exit_code: 1
internal_log:
  - "Starting sync"
  - "Pull: 0 changes"
  - "Push: FAILED - HTTP 403"
  - "Reporting error to user"
```

### Transparent Box Testing with Git Operation Logging

**Concept**: During tryscript golden tests, capture ALL git operations with their
commands, arguments, exit codes, and relevant output.
This creates a “transparent box” where we can see exactly what git operations occurred
under the hood.

**How It Would Have Caught This Bug:**

If the golden test captured git operations, the test output would have shown:

```yaml
# sync-push-failure.golden

user_output:
  stdout: "Already in sync."  # ← Bug: wrong message
  exit_code: 0                 # ← Bug: should be non-zero

git_operations:                # ← This would have revealed the bug!
  - command: "git fetch origin tbd-sync"
    exit_code: 0
    stdout: ""

  - command: "git rev-list --count origin/tbd-sync..tbd-sync"
    exit_code: 0
    stdout: "2"                # ← 2 commits ahead!

  - command: "git push origin tbd-sync"
    exit_code: 1               # ← PUSH FAILED!
    stderr: "HTTP 403"

# The golden test would FAIL because:
# - git push exit_code=1 but user exit_code=0
# - "2 commits ahead" but user sees "Already in sync"
```

**Implementation: Debug Mode for Git Operations**

```typescript
// lib/git.ts

interface GitOperationLog {
  command: string;
  args: string[];
  exitCode: number;
  stdout: string;
  stderr: string;
  duration: number;
}

// Global log when TBD_GOLDEN_TEST=1
const gitOperationLog: GitOperationLog[] = [];

export async function git(...args: string[]): Promise<string> {
  const start = Date.now();
  const result = await execGit(args);

  // In golden test mode, log all operations
  if (process.env.TBD_GOLDEN_TEST === '1') {
    gitOperationLog.push({
      command: 'git',
      args,
      exitCode: result.exitCode,
      stdout: result.stdout.trim(),
      stderr: result.stderr.trim(),
      duration: Date.now() - start,
    });
  }

  return result.stdout;
}

export function getGitOperationLog(): GitOperationLog[] {
  return gitOperationLog;
}

export function clearGitOperationLog(): void {
  gitOperationLog.length = 0;
}
```

**Tryscript Integration:**

```bash
#!/bin/bash
# tryscripts/sync-push-failure.sh

# Enable transparent git logging
export TBD_GOLDEN_TEST=1

# Setup: Create repo with commits ahead of remote
setup_repo_with_commits_ahead

# Mock push to fail
mock_git_push_failure 403

# Run the command
tbd sync

# Dump git operation log for golden comparison
tbd --dump-git-log  # Outputs JSON of all git operations
```

**Golden File with Git Operations:**

```yaml
# golden/sync-push-failure.golden.yml

command: tbd sync
user_output:
  stdout: |
    Push failed: HTTP 403 - Permission denied
    2 commit(s) not pushed to remote.
    Run 'tbd sync' to retry.
  stderr: ""
  exit_code: 1

# Transparent box: all git operations that occurred
git_operations:
  - cmd: ["git", "rev-parse", "--show-toplevel"]
    exit: 0

  - cmd: ["git", "fetch", "origin", "tbd-sync"]
    exit: 0

  - cmd: ["git", "rev-list", "--count", "origin/tbd-sync..tbd-sync"]
    exit: 0
    stdout: "2"

  - cmd: ["git", "push", "origin", "tbd-sync"]
    exit: 1
    stderr: "error: failed to push some refs"

# Assertions that can be auto-generated:
assertions:
  - git_push_failed: true
  - user_informed_of_failure: true
  - exit_code_matches_git_failure: true
```

**Benefits of Transparent Box Testing:**

| Benefit | How It Helps |
| --- | --- |
| **Visibility** | See exactly what git operations occurred |
| **Correlation** | Match git failures to user-visible output |
| **Regression** | Any change in git behavior shows up in diff |
| **Debugging** | When tests fail, see the full operation trace |
| **Documentation** | Golden files document expected git behavior |

**Auto-Generated Assertions:**

The golden test framework could auto-generate assertions based on git operations:

```typescript
// If git push failed, assert user was informed
if (gitOps.some(op => op.cmd[1] === 'push' && op.exit !== 0)) {
  assert(userOutput.includes('failed') || userOutput.includes('error'),
    'Git push failed but user not informed');
  assert(exitCode !== 0,
    'Git push failed but exit code is 0');
}

// If commits are ahead, assert they're mentioned
const aheadOp = gitOps.find(op => op.cmd.includes('rev-list'));
if (aheadOp && parseInt(aheadOp.stdout) > 0) {
  assert(!userOutput.includes('Already in sync'),
    'Commits ahead but reported "in sync"');
}
```

**Tryscript Test Suite Structure:**

```
tryscripts/
├── sync/
│   ├── sync-happy-path.sh           # Normal sync works
│   ├── sync-push-failure-403.sh     # Push fails with 403
│   ├── sync-push-failure-network.sh # Push fails with network error
│   ├── sync-pull-conflict.sh        # Pull has conflicts
│   └── sync-worktree-missing.sh     # Worktree doesn't exist
└── golden/
    ├── sync-happy-path.golden.yml
    ├── sync-push-failure-403.golden.yml
    ├── sync-push-failure-network.golden.yml
    ├── sync-pull-conflict.golden.yml
    └── sync-worktree-missing.golden.yml
```

Each golden file captures:
1. User-visible output (what they see)
2. Exit code (what scripts/CI see)
3. Git operations (transparent box - what actually happened)
4. Auto-generated assertions (invariants that should hold)

### Process 2: CI Checks for Error Handling Patterns

**Static Analysis in CI:**

```yaml
# .github/workflows/ci.yml
- name: Check error handling patterns
  run: |
    # Find debug-only error handling
    grep -rn "output.debug.*error\|output.debug.*fail" src/ && exit 1 || true

    # Find empty catch blocks
    grep -rn "catch.*{[^}]*}" src/ | grep -v "throw\|return\|output.error" && exit 1 || true

    # Find success messages that might be premature
    grep -rn "Already in sync\|Sync complete\|Done" src/ > success_messages.txt
    # Review these manually for proper guarding
```

**ESLint Plugin for Error Handling:**

```javascript
// eslint-plugin-tbd/rules/no-swallowed-errors.js
module.exports = {
  meta: {
    type: 'problem',
    docs: {
      description: 'Disallow swallowing errors in debug-only logs'
    }
  },
  create(context) {
    return {
      CallExpression(node) {
        // Flag: output.debug() calls containing error-related strings
        // without a nearby throw, return, or output.error()
        if (isDebugCall(node) && containsErrorString(node)) {
          const hasVisibleHandling = hasNearbyErrorHandling(node);
          if (!hasVisibleHandling) {
            context.report({
              node,
              message: 'Error logged to debug without user-visible handling'
            });
          }
        }
      }
    };
  }
};
```

### Process 3: Mutation Testing for Error Paths

**Concept**: Automatically mutate code to verify error handling is tested.

```javascript
// Mutation: Remove error handling
// Before:
if (!result.success) {
  this.output.error(`Push failed: ${result.error}`);
  return;
}

// After (mutation):
if (!result.success) {
  // REMOVED: this.output.error(`Push failed: ${result.error}`);
  // REMOVED: return;
}

// If no test fails, error handling is untested!
```

**Stryker Mutation Testing Config:**

```javascript
// stryker.conf.js
module.exports = {
  mutate: ['src/**/*.ts'],
  testRunner: 'vitest',
  reporters: ['html', 'clear-text'],
  // Focus on error handling mutations
  mutator: {
    plugins: ['@stryker-mutator/typescript-checker'],
    excludedMutations: [
      // Only mutate error handling code
    ]
  }
};
```

### Process 4: Contract Tests for Git Operations

**Define contracts for git operations that must hold:**

```typescript
// contracts/git-operations.contract.ts

describe('Git operation contracts', () => {
  contract('push failure must be surfaced', async () => {
    // Given: push will fail
    mockGitPush.mockRejectedValue(new Error('Network error'));

    // When: sync is called
    const result = await sync();

    // Then: user must be informed
    expect(result.userVisibleErrors).toContain('push');
    expect(result.exitCode).not.toBe(0);
  });

  contract('success message requires all operations succeeded', async () => {
    // Given: one operation will fail
    mockGitPush.mockRejectedValue(new Error('Failed'));

    // When: sync is called
    const result = await sync();

    // Then: no success message
    expect(result.stdout).not.toMatch(/complete|success|in sync/i);
  });
});
```

## Process Changes

### Process Change 1: Error Handling Review Gate

**Requirement**: Every PR that touches error handling or adds new operations must have
explicit review of error scenarios.

**PR Template Addition:**

```markdown
## Error Handling Checklist

If this PR adds or modifies operations that can fail:

- [ ] All failure cases are handled with user-visible feedback
- [ ] No debug-only error logging for user-impacting failures
- [ ] Success messages are guarded by actual success checks
- [ ] Exit codes reflect actual success/failure
- [ ] Golden tests cover failure scenarios
- [ ] Error messages are actionable (tell user what to do)
```

### Process Change 2: Failure Scenario Testing Requirement

**Requirement**: For every new feature, tests must include:

1. Happy path tests
2. **At least one failure scenario test per operation**
3. Golden tests capturing error output

**Test Coverage Rule:**

```typescript
// vitest.config.ts
export default {
  coverage: {
    // Require error handling branches to be covered
    branches: 80,
    // Custom reporter to flag untested catch blocks
    reporters: ['text', 'custom-error-path-reporter']
  }
};
```

### Process Change 3: Pre-Commit Error Audit

**Git hook that checks for suspicious patterns:**

```bash
#!/bin/bash
# .husky/pre-commit

# Check for debug-only error handling
if grep -rn "output\.debug.*error\|output\.debug.*fail" --include="*.ts" src/; then
  echo "⚠️  Warning: Found debug-only error handling. Ensure errors are also surfaced to users."
  # Don't block, just warn
fi

# Check for empty catch blocks
if grep -rn "catch.*{\s*}" --include="*.ts" src/; then
  echo "❌ Error: Found empty catch block. Either handle the error or re-throw."
  exit 1
fi
```

### Process Change 4: Blameless Post-Mortem Culture

**When bugs like this are found:**

1. **No blame** - Focus on systemic fixes, not individual mistakes
2. **Document thoroughly** - Create post-mortem spec (like this one)
3. **Identify patterns** - What class of bug is this?
4. **Systematic prevention** - Add guidelines, tools, tests to prevent recurrence
5. **Share learnings** - Update team docs and onboarding

### Process Change 5: Regular Error Handling Audits

**Quarterly audit of error handling:**

1. Grep for `catch`, `debug`, `warn` and review each instance
2. Run mutation testing on error paths
3. Review golden tests for coverage of failure scenarios
4. Update guidelines based on findings

## Implementation Plan

### Phase 1: Immediate Guidelines and Documentation

- [ ] Add “Silent Error Swallowing” section to development guidelines
- [ ] Add error handling checklist to PR template
- [ ] Document the anti-pattern with examples
- [ ] Update code review guidelines with error handling focus

### Phase 2: Transparent Box Golden Testing

- [ ] Add `TBD_GOLDEN_TEST` environment variable support to git.ts
- [ ] Implement `GitOperationLog` capture during golden tests
- [ ] Add `--dump-git-log` flag to tbd CLI for golden test output
- [ ] Create golden test for sync push failure scenario
- [ ] Create golden tests for other error scenarios (network, conflict, missing
  worktree)
- [ ] Add auto-generated assertions for git operation / user output correlation

### Phase 3: Codebase Audit

- [ ] Audit all `output.debug()` calls for potential error swallowing
- [ ] Audit all functions returning `{ success: boolean }` for proper handling
- [ ] Audit all “success” messages for false-positive potential
- [ ] Audit all catch blocks for proper error handling
- [ ] Create issues for any discovered instances

### Phase 4: Automated Prevention (Static Analysis)

- [ ] Create ESLint rule: `no-debug-only-errors`
- [ ] Create ESLint rule: `require-result-handling`
- [ ] Add pre-commit hook for suspicious patterns
- [ ] Add CI check for error handling patterns
- [ ] Consider TypeScript Result type for new code

### Phase 5: Process Integration

- [ ] Add error handling review gate to PR process
- [ ] Establish failure scenario testing requirement
- [ ] Schedule quarterly error handling audits
- [ ] Document blameless post-mortem process

## Proposed ESLint Rules

### Rule: no-debug-only-errors

Flags patterns where errors are logged to debug without user-visible handling.

```javascript
// eslint.config.js
{
  rules: {
    'tbd/no-debug-only-errors': ['error', {
      debugMethods: ['output.debug', 'logger.debug', 'console.debug'],
      errorPatterns: ['error', 'fail', 'Error', 'Fail'],
      requireUserFeedback: true
    }]
  }
}
```

### Rule: require-result-handling

Flags Result-type returns that aren’t properly unwrapped.

```javascript
// Flags this:
const result = await operation();
if (!result.success) {
  this.output.debug(result.error);  // No throw/return/user-error
}
doNextThing();  // Continues regardless

// Requires one of:
// - throw
// - return (early exit)
// - this.output.error() or similar
```

## Testing Strategy

### Unit Tests

```typescript
describe('sync error handling', () => {
  it('reports push failure to user', async () => {
    mockPushToFail();
    const result = await runSync();
    expect(result.stderr).toContain('Push failed');
    expect(result.stderr).not.toContain('Already in sync');
  });

  it('does not say "in sync" when push fails', async () => {
    mockPushToFail();
    const result = await runSync();
    expect(result.stdout).not.toContain('in sync');
  });

  it('returns non-zero exit code on push failure', async () => {
    mockPushToFail();
    const result = await runSync();
    expect(result.exitCode).not.toBe(0);
  });
});
```

### Integration Tests

- Simulate network failure during push → verify error shown
- Simulate 403 permission error → verify error shown with HTTP code
- Simulate partial sync (pull succeeds, push fails) → verify accurate message

## Code Review Checklist Addition

Add to existing code review process:

```markdown
## Error Handling

- [ ] All operation failures are surfaced to users (not just logged to debug)
- [ ] Success messages only shown when all operations actually succeeded
- [ ] Functions returning `{ success: boolean }` have failures properly handled
- [ ] No `logger.debug()` or `output.debug()` as the only error handling
```

## Metrics (Future)

If we had telemetry, we would track:

- Sync operations where push failed but “in sync” was reported (should be 0)
- Sync operations where error was shown vs operations where error occurred (should
  match)

## Open Questions

1. **Should we adopt a strict Result type?**
   - Pro: Compile-time enforcement of error handling
   - Con: More verbose code, migration effort
   - Recommendation: Start with lint rules, consider Result type for new code

2. **How strict should the lint rule be?**
   - Option A: Error (must fix) - may cause friction
   - Option B: Warning - may be ignored
   - Recommendation: Start as warning, promote to error after cleanup

3. **Should debug logs of errors be removed entirely?**
   - They’re useful for debugging
   - But they can mask missing user feedback
   - Recommendation: Keep debug logs, but require user feedback as well

## References

- Bug issue: tbd-ca3g
- Epic: tbd-i10x
- Post-mortem task: tbd-qeuw
- Sync worktree spec: plan-2026-01-28-sync-worktree-recovery-and-hardening.md

## Appendix A: The Exact Bug

```typescript
// sync.ts before fix (lines 659-685)

// Push if we have commits ahead of remote
if (aheadCommits > 0) {
  this.output.debug(`Pushing ${aheadCommits} commit(s) to remote`);
  const result = await this.doPushWithRetry(syncBranch, remote);
  if (result.conflicts) {
    conflicts.push(...result.conflicts);
  }
  if (!result.success) {
    // BUG: Only logged to debug, not surfaced to user
    this.output.debug(`Push failed: ${result.error}`);
  } else {
    await this.showGitLogDebug(`-${aheadCommits}`, 'Commits sent');
  }
}

// ... later ...

// BUG: Reported "in sync" without checking if push succeeded
if (!summaryText) {
  this.output.data({ summary: 'Already in sync' }, () => {
    console.log('Already in sync.');
  });
}
```

## Appendix B: Related Anti-Patterns to Watch For

| Anti-Pattern | Description | Detection |
| --- | --- | --- |
| Silent swallow | Error caught/checked but only logged to debug | Audit debug() calls |
| Optimistic success | Success assumed unless explicit failure | Check for "else" branches |
| Lost Result | Result type returned but not checked | TypeScript strict mode |
| Catch-and-continue | Error caught, logged, execution continues | Audit catch blocks |
| Default success | Function returns success by default | Check return paths |

## Appendix C: Similar Bugs Fixed

This post-mortem builds on related fixes:

1. **Worktree silent fallback**
   (plan-2026-01-28-sync-worktree-recovery-and-hardening.md): `resolveDataSyncDir()`
   silently fell back to wrong path when worktree was missing

2. **getSyncStatus checking gitignored path**: Status check ran on main branch where the
   path was gitignored, always returning “clean”

3. **commitWorktreeChanges catching errors**: Caught “nothing to commit” but may have
   swallowed other errors

All share the same anti-pattern: failures handled in ways that don’t surface to users.
