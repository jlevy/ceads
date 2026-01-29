---
title: Golden Testing Guidelines
description: Guidelines for implementing golden/snapshot testing for complex systems
author: Joshua Levy (github.com/jlevy) with LLM assistance
---
# Golden Testing Guidelines

## TL;DR

- Define a session schema (events) with stable vs unstable fields.
- Capture full execution for scenarios (inputs, outputs, side effects) as YAML.
- Normalize or remove unstable fields at serialization time.
- Provide a mock mode for all nondeterminism and slow dependencies.
- Add a CLI to run scenarios, update goldens, and print diffs.
- Keep scenarios few but end-to-end; tests must run fast in CI (<100ms each).
- Prefer many small artifacts (shard by scenario/phase) over monolithic traces.
- Layer domain-focused assertions alongside raw diffs for critical invariants.
- Review and commit session files with code; treat them as behavioral specs.

## When to Use Golden Tests

Golden session testing excels for complex systems where writing and maintaining hundreds
of unit or integration tests is burdensome.
Traditional unit tests struggle to capture the full behavior of systems with many
interacting components, non-deterministic outputs, and complex state transitions.

## Core Principles

### 1. Model Events Formally

All events should be modeled with type-safe schemas (Zod, Pydantic, TypeScript
interfaces). Events are serialized to YAML for human readability.

### 2. Classify Fields as Stable or Unstable

- **Stable**: Deterministic values that must match exactly (symbols, actions,
  quantities)
- **Unstable**: Non-deterministic values filtered during comparison (timestamps, IDs)

Filter unstable fields before writing session files by replacing with placeholders like
`"[TIMESTAMP]"` or omitting entirely.

### 3. Use Switchable Mock Modes

- **Live mode**: Calls real external services for debugging and updating golden files
- **Mocked mode**: Uses recorded/stubbed responses for fast, deterministic CI

### 4. Design for Fast CI

Golden tests should run in under 100ms per scenario:
- Run in mocked mode (no network, no external services)
- Use in-memory mocks over file-based fixtures
- Parallelize independent scenarios
- Cache expensive setup

## Do / Don’t

- Do capture full payloads and side effects that influence behavior.
- Do normalize/remap unstable values at write time, not in comparisons.
- Do keep scenarios few, representative, and fast.
- Do prefer many small artifacts over monolithic traces.
- Don’t depend on real clocks, random, network, or database in CI.
- Don’t hide differences with overly broad placeholders.
- Don’t fork logic for tests vs production; share code paths.
- Don’t let artifacts grow unbounded.

## Transparent Sub-Command Logging for CLIs

When a CLI tool calls external commands (git, npm, curl, etc.), capturing those
operations in golden tests creates a “transparent box” that reveals internal behavior.
This pattern catches bugs where user output doesn’t match actual operation results.

### The Pattern: Debug Flags for Sub-Command Visibility

Add a flag like `--show-git` or `--show-commands` that logs all sub-command invocations.
In golden tests, enable this flag to capture the full operation trace.

```typescript
// CLI implementation
interface SubCommandLog {
  command: string;
  args: string[];
  exitCode: number;
  stdout: string;
  stderr: string;
}

const subCommandLog: SubCommandLog[] = [];

async function runGit(...args: string[]): Promise<string> {
  const result = await exec('git', args);

  // Log when flag is set
  if (process.env.SHOW_GIT === '1' || options.showGit) {
    subCommandLog.push({
      command: 'git',
      args,
      exitCode: result.exitCode,
      stdout: result.stdout.trim(),
      stderr: result.stderr.trim(),
    });
  }

  return result.stdout;
}

// At end of command, dump log if requested
if (options.showGit) {
  console.log('--- GIT OPERATIONS ---');
  for (const op of subCommandLog) {
    console.log(`git ${op.args.join(' ')} -> exit ${op.exitCode}`);
    if (op.stdout) console.log(`  stdout: ${op.stdout}`);
    if (op.stderr) console.log(`  stderr: ${op.stderr}`);
  }
}
```

### Golden Test with Sub-Command Capture

```yaml
# golden/sync-push-failure.golden.yml

command: mycli sync --show-git
user_output:
  stdout: |
    Push failed: HTTP 403 - Permission denied
    2 commit(s) not pushed.
  exit_code: 1

# Transparent box: all git operations that occurred
git_operations:
  - cmd: ["git", "fetch", "origin", "main"]
    exit: 0
  - cmd: ["git", "rev-list", "--count", "origin/main..main"]
    exit: 0
    stdout: "2"
  - cmd: ["git", "push", "origin", "main"]
    exit: 1
    stderr: "error: failed to push"
```

### Why This Catches Bugs

**Example: Silent Error Swallowing Bug**

Without sub-command logging, a golden test only captures:
```yaml
stdout: "Already in sync."
exit_code: 0
```

This looks correct. But with sub-command logging:
```yaml
stdout: "Already in sync."
exit_code: 0
git_operations:
  - cmd: ["git", "push", "origin", "main"]
    exit: 1                              # ← BUG! Push failed
    stderr: "HTTP 403"
```

The mismatch between `git push exit: 1` and `user exit_code: 0` reveals the bug.

### Auto-Generated Assertions

Use the sub-command log to generate invariant assertions:

```typescript
function validateGoldenInvariants(golden: GoldenFile): void {
  // If any sub-command failed, user should be informed
  const failedOps = golden.git_operations.filter(op => op.exit !== 0);
  if (failedOps.length > 0) {
    const hasErrorOutput = golden.user_output.stdout.match(/fail|error/i) ||
                           golden.user_output.stderr.length > 0;
    assert(hasErrorOutput, 'Sub-command failed but no error shown to user');
    assert(golden.user_output.exit_code !== 0, 'Sub-command failed but exit code is 0');
  }

  // If commits are ahead but output says "in sync", that's a bug
  const revListOp = golden.git_operations.find(op =>
    op.cmd.includes('rev-list') && parseInt(op.stdout) > 0
  );
  if (revListOp) {
    assert(!golden.user_output.stdout.includes('in sync'),
      'Commits ahead but reported "in sync"');
  }
}
```

### Tryscript Example

```bash
#!/bin/bash
# tryscripts/sync-failure.tryscript.sh

# Enable sub-command logging for golden capture
export SHOW_GIT=1

# Setup: repo with commits ahead
git commit --allow-empty -m "local commit"

# Mock: push will fail
export MOCK_GIT_PUSH_EXIT=1
export MOCK_GIT_PUSH_STDERR="HTTP 403"

# Run command - output includes git operations
mycli sync

# Golden file will capture:
# - User-visible output
# - All git operations with exit codes
# - Allows detecting silent error swallowing
```

### Benefits

| Benefit | Description |
| --- | --- |
| Bug detection | Reveals mismatches between sub-command results and user output |
| Regression protection | Any change in sub-command behavior shows in diff |
| Documentation | Golden files document expected sub-command sequences |
| Debugging | When tests fail, see exactly what operations occurred |

## Common Pitfalls

- Missing unstable field classification -> flaky diffs.
- File I/O captured without contents/checksums -> silent regressions.
- Slow or network-bound scenarios -> skipped in practice, regressions leak.
- LLM output not recorded or scrubbed -> non-deterministic sessions.
- Monolithic traces that grow unbounded -> hard to review, slow to diff.
- **Sub-command failures not captured** -> silent error swallowing bugs leak through.
- **Exit codes not captured** -> mismatches between internal state and user feedback.
