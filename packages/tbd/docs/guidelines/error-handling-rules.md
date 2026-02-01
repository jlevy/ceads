---
title: Error Handling Rules
description: Rules for handling errors, failures, and exceptional conditions
author: Joshua Levy (github.com/jlevy) with LLM assistance
---
# Error Handling Rules

Most code is written for the happy path.
Error handling is added later, often hastily, and rarely tested.
This creates a predictable failure mode: errors are “handled” in ways that satisfy the
type checker but don’t actually inform anyone.

This guideline establishes patterns that make error handling robust and visible.

## Principles

### Principle 1: Error Handling is Part of the Feature

An operation that can fail has TWO behaviors to implement:

1. What happens on success
2. What happens on failure

If you only implement (1), you haven’t finished the feature.
The failure path needs the same care: clear messaging, correct exit codes, actionable
guidance.

**Test for completeness**: Can a user diagnose and recover from every failure mode
without looking at source code or debug logs?

### Principle 2: Success Must Be Proven, Not Assumed

Many failures don’t throw—Result types, status codes, and partial failures silently
continue. The only safe pattern is to verify success before claiming it:

```typescript
// ✅ GOOD: Success only after verification
const result = await operation();
if (!result.success) {
  console.error(`Failed: ${result.error}`);
  return;  // Must stop here
}
console.log('Done!');  // Only reached after verified success
```

**The rule**: Success messages require evidence.
“Done” means “I checked, and it worked.”

### Principle 3: State Should Be Explicit, Not Inferred

Don’t infer success from the absence of failure indicators.
Track operation outcomes explicitly:

```typescript
// ✅ GOOD: Explicit state tracking
let pullSucceeded = false;
let pushSucceeded = false;

pullSucceeded = await pull();
pushSucceeded = await push();

if (pullSucceeded && pushSucceeded) {
  console.log('Sync complete');
} else {
  console.log('Sync incomplete');  // Can't forget this case
}
```

This is more verbose but harder to get wrong.
The compiler forces you to handle both states.

### Principle 4: Choose Exception vs Result Based on Recoverability

Common advice says “use exceptions for exceptional cases.”
Better heuristic—choose based on what the caller can do:

| Failure Type | Pattern | Why |
| --- | --- | --- |
| Caller cannot recover | `throw` | Forces handling, can't be ignored |
| Caller might retry or degrade | `Result<T>` | Makes recovery explicit |
| Should never happen | `throw` / assertion | Fail fast, debug fast |

For CLI tools, most failures should throw or exit.
Result types are better for library code where the caller has recovery options.

### Principle 5: Logging is Not Handling

A common misconception: “I logged it, so it’s handled.”

```typescript
// ❌ Logging alone is not handling
if (error) {
  logger.warn(error);
}
// Execution continues...
```

Logging is diagnostics.
The question is: **what happens next?**

- If execution continues → you’ve swallowed the error
- If you throw/return/exit → the log is supplementary

**Rule**: After any error log, there must be a control flow change (throw, return, exit)
or explicit user notification.
Logging alone is never sufficient.

### Principle 6: Exit Codes Are API Contracts

CLI exit codes are machine-readable signals.
Scripts, CI systems, and orchestrators depend on them.

**The contract**:

- `0`: All requested operations completed successfully
- Non-zero: At least one operation failed

**Partial success**: If some operations succeeded and some failed, exit non-zero.
The caller needs to know something went wrong.
Be explicit about what succeeded and what failed in the output.

### Principle 7: Tests Must Verify Error Behavior

Happy-path tests are necessary but insufficient.
For every operation that can fail:

1. There must be a test that makes it fail
2. That test must verify the user sees an error
3. That test must verify the exit code is non-zero (for CLIs)

Failure tests are harder to write but catch the bugs that matter most—the ones where the
system lies about its state.

### Principle 8: Classify Errors as Transient or Permanent

Not all errors are equal.
Some are retriable, some are not.
Make this distinction explicit in your error types:

| Error Type | Examples | Retry? | User Action |
| --- | --- | --- | --- |
| **Transient** | Network timeout, rate limit, 503 | Yes | Wait and retry |
| **Permanent** | 404, invalid input, auth failure | No | Fix the problem |

```typescript
// ✅ GOOD: Error types encode retriability
class TransientError extends Error {
  readonly retryable = true;
  constructor(message: string, public retryAfterMs?: number) {
    super(message);
  }
}

class PermanentError extends Error {
  readonly retryable = false;
}

// Caller can make informed decisions
if (error.retryable) {
  await sleep(error.retryAfterMs ?? 1000);
  return retry();
} else {
  throw error;  // Don't retry, surface to user
}
```

**Why this matters**: Without this distinction, code either retries everything (wasting
time on permanent failures) or retries nothing (failing on transient hiccups).
Encoding retriability in the error type makes retry logic correct by construction.

## Anti-Patterns

These are specific patterns that lead to silent failures.
Learn to recognize them.

### Anti-Pattern 1: Debug-Only Error Handling

**The pattern**: Error is logged to debug level, invisible to users.

```typescript
// ❌ BAD: Error hidden from user
if (!result.success) {
  this.output.debug(`Operation failed: ${result.error}`);
}
// Execution continues, user sees nothing
```

**Why it happens**: Developers add debug logging thinking “I’ve handled it.”
But debug logs are invisible to users by default.
The type checker is satisfied, but the user is left in the dark.

**The fix**: User-impacting failures must produce user-visible output.

```typescript
// ✅ GOOD: Error visible to user
if (!result.success) {
  this.output.error(`Operation failed: ${result.error}`);
  return;  // Or throw
}
```

### Anti-Pattern 2: Optimistic Success Messages

**The pattern**: Success reported without verifying all operations succeeded.

```typescript
// ❌ BAD: Success assumed
await pull();
await push();  // Might have returned { success: false }!
console.log('Sync complete!');
```

**Why it happens**: The natural flow is “do stuff, then say done.”
But operations that return Result types don’t throw on failure—they silently continue.

**The fix**: Guard success messages with explicit checks.

```typescript
// ✅ GOOD: Success verified
const pullOk = await pull();
const pushOk = await push();
if (pullOk && pushOk) {
  console.log('Sync complete!');
} else {
  console.error('Sync incomplete. See errors above.');
  process.exit(1);
}
```

### Anti-Pattern 3: Empty Catch Blocks

**The pattern**: Exception caught and silently ignored.

```typescript
// ❌ BAD: Error swallowed
try {
  await riskyOperation();
} catch (e) {
  // Ignored
}
```

**Why it happens**: Developer wants to “handle” the error to avoid crashes, but doesn’t
know what to do with it.
Or they’re “temporarily” ignoring it during development.

**The fix**: Either handle meaningfully or re-throw.

```typescript
// ✅ GOOD: Handle or re-throw
try {
  await riskyOperation();
} catch (e) {
  if (isExpectedError(e)) {
    return fallbackValue;  // Intentional recovery
  }
  throw e;  // Unexpected errors propagate
}
```

### Anti-Pattern 4: Catch-and-Continue

**The pattern**: Error caught, logged, but execution continues as if nothing happened.

```typescript
// ❌ BAD: Catch and continue
try {
  await saveToDatabase();
} catch (e) {
  logger.error('Save failed:', e);
}
await notifyUser('Save complete!');  // Lies!
```

**Why it happens**: Developer wants to be “resilient” or “not crash on errors.”
But continuing after failure means the system is now in an inconsistent state.

**The fix**: Errors must change control flow.

```typescript
// ✅ GOOD: Error changes control flow
try {
  await saveToDatabase();
} catch (e) {
  logger.error('Save failed:', e);
  await notifyUser('Save failed. Please retry.');
  return;  // Stop here
}
await notifyUser('Save complete!');
```

### Anti-Pattern 5: Inferring Success from Side Effects

**The pattern**: Success determined by checking if some side effect occurred, rather
than tracking operation outcomes directly.

```typescript
// ❌ BAD: Inferring success
let message = '';
if (pulled) message += 'Pulled. ';
if (pushed) message += 'Pushed. ';

if (!message) {
  console.log('Already in sync');  // Wrong if push failed silently!
}
```

**Why it happens**: It feels DRY—you’re reusing the message-building logic to determine
state. But any code path that forgets to update the side effect will falsely indicate
success.

**The fix**: Track success explicitly with boolean flags.

```typescript
// ✅ GOOD: Explicit tracking
let allSucceeded = true;
if (!pullResult.success) allSucceeded = false;
if (!pushResult.success) allSucceeded = false;

if (allSucceeded) {
  console.log('Sync complete');
} else {
  console.error('Sync failed');
}
```

### Anti-Pattern 6: Lost Result Types

**The pattern**: Function returns `{ success: boolean }` but caller ignores it.

```typescript
// ❌ BAD: Result ignored
await operation();  // Returns { success: false } but we don't check
doNextThing();
```

**Why it happens**: TypeScript doesn’t require you to use return values.
The code compiles, so it must be fine, right?

**The fix**: Always check Result types.
Consider using exceptions for critical operations where ignoring failure would be
catastrophic.

```typescript
// ✅ GOOD: Result checked
const result = await operation();
if (!result.success) {
  throw new Error(`Operation failed: ${result.error}`);
}
doNextThing();
```

### Anti-Pattern 7: Default Success Returns

**The pattern**: Function returns success by default, only setting failure in specific
branches.

```typescript
// ❌ BAD: Default success
function process(): Result {
  if (badCondition) {
    return { success: false, error: 'Bad condition' };
  }
  // ... lots of code that might fail ...
  return { success: true };  // Reached even if intermediate steps failed
}
```

**Why it happens**: It’s the “natural” structure—handle the error cases, then return
success at the end. But any unhandled failure path falls through to success.

**The fix**: Track success explicitly throughout, or throw on any failure.

```typescript
// ✅ GOOD: Throw on failure, success is earned
function process(): void {
  if (badCondition) {
    throw new Error('Bad condition');
  }
  // ... if any step fails, it throws ...
  // Reaching here means success
}
```

### Anti-Pattern 8: Losing Exception Context

**The pattern**: Exception is logged or re-thrown but loses critical details—the API
provider, HTTP status, nested cause, or type-specific properties.

```typescript
// ❌ BAD: Loses context
try {
  await openaiClient.chat(messages);
} catch (e) {
  throw new Error(`API call failed: ${e.message}`);
  // Lost: which provider, HTTP status, rate limit headers, request ID
}

// ❌ BAD: Generic logging loses type information
catch (e) {
  console.error('Error:', e.message);
  // If e is an AxiosError, we lost: status, headers, config, response body
  // If e is an OpenAI APIError, we lost: status, error code, type
}
```

**Why it happens**: Developers treat all errors as simple `Error` objects with just a
`message`. But API clients attach rich metadata—status codes, headers, request IDs,
retry-after values—that’s essential for debugging and proper handling.

**The fix**: Preserve error context through the chain.
Log or wrap with full details.

```typescript
// ✅ GOOD: Preserve context when wrapping
try {
  await openaiClient.chat(messages);
} catch (e) {
  throw new ProviderError('OpenAI chat failed', {
    cause: e,  // Preserve original error
    provider: 'openai',
    status: e.status,
    requestId: e.headers?.['x-request-id'],
  });
}

// ✅ GOOD: Type-aware logging
catch (e) {
  if (e instanceof AxiosError) {
    console.error('HTTP error:', {
      status: e.response?.status,
      url: e.config?.url,
      data: e.response?.data,
    });
  } else if (e instanceof OpenAI.APIError) {
    console.error('OpenAI error:', {
      status: e.status,
      code: e.code,
      type: e.type,
    });
  } else {
    console.error('Unknown error:', e);
  }
}
```

**Tip**: Use `Error.cause` (ES2022) to chain errors without losing the original.

### Anti-Pattern 9: Catch-and-Replace with Generic Error

**The pattern**: Catching an exception and throwing a new generic error that loses the
original message and stack trace.

```typescript
// ❌ BAD: Original error details lost
try {
  dataCtx = await loadDataContext(tbdRoot);
  issues = await listIssues(dataCtx.dataSyncDir);
} catch {
  throw new CLIError('Failed to read issues');
}
// User sees: "Error: Failed to read issues"
// Actual error was: "Implicit keys need to be on a single line at line 1..."
// (YAML parse error due to merge conflict markers in file)
```

**Why it happens**: Developer wants to “clean up” the error message for users, assuming
the original error is too technical.
But this makes debugging impossible—the user can’t report the real problem, and even
`--debug` mode shows nothing useful.

**The fix**: Let errors propagate naturally, or include the original message.

```typescript
// ✅ GOOD: Let errors propagate (preferred for most cases)
const dataCtx = await loadDataContext(tbdRoot);
const issues = await listIssues(dataCtx.dataSyncDir);
// Errors propagate to central handler which shows message + stack in debug mode

// ✅ GOOD: If you must catch, preserve the original message
try {
  dataCtx = await loadDataContext(tbdRoot);
} catch (error) {
  const message = error instanceof Error ? error.message : String(error);
  throw new CLIError(`Failed to load data: ${message}`, { cause: error });
}
```

**Key insight**: The central error handler should add debug info (stack traces,
context).
Individual commands should not catch-and-replace unless adding genuinely useful
context.

## Error Messages

### Make Errors Actionable

Error messages should tell users what happened AND what they can do about it.

```typescript
// ❌ BAD: Unhelpful error
console.error('Operation failed');

// ✅ GOOD: Actionable error
console.error('Push failed: HTTP 403 - Permission denied');
console.error('  Check your authentication or run: git push origin main');
```

### Be Honest About Partial Success

If some operations succeeded and some failed, say so clearly.

```typescript
// ❌ BAD: Hiding partial failure
console.log('Operation complete');  // But half of it failed

// ✅ GOOD: Clear about what happened
console.log('Pulled 5 changes from remote.');
console.error('Push failed: 2 commits not uploaded.');
console.log('Run `sync` to retry.');
```

## Checklist

When implementing any operation that can fail:

- [ ] Failure case produces user-visible output (not just debug log)
- [ ] Success message only shown after verifying success
- [ ] Exit code reflects actual outcome (for CLIs)
- [ ] At least one test exercises the failure path
- [ ] Error message tells user what to do next

## Detection Strategies

| Anti-Pattern | How to Find It |
| --- | --- |
| Debug-only handling | Grep for `debug.*error`, `debug.*fail` |
| Empty catch blocks | Grep for `catch.*\{\s*\}` or catch blocks without throw/return |
| Lost Result types | TypeScript: enable `@typescript-eslint/no-floating-promises` |
| Optimistic success | Search for success messages, trace back to verify guards |
| Catch-and-continue | Audit catch blocks that log but don't throw/return |
| Lost exception context | Grep for `new Error.*\.message` (wrapping without cause) |
| Catch-and-replace | Grep for `} catch {` followed by `throw new` (bare catch discards error) |

### Finding Catch-and-Replace Anti-Pattern

This command finds catch blocks that throw new errors without using the original:

```bash
# Find catch blocks that throw new errors without capturing the original
grep -rn -A2 "} catch {" --include="*.ts" | grep -B1 "throw new"
```

**What to look for**: Any `} catch {` (no error variable) followed by
`throw new SomeError`. This means the original error is discarded.

**Acceptable patterns**:
- `throw new NotFoundError('Entity', id)` - Transforming “not found” to semantic error
- `throw new NotInitializedError(...)` - Expected failure with clear guidance

**Problematic patterns**:
- `throw new CLIError('Failed to do X')` - Loses WHY it failed
- `throw new Error('Operation failed')` - Generic message hides root cause
