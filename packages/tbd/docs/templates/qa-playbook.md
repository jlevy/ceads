---
title: QA Playbook Template
description: Template for manual testing playbooks and validation workflows
author: Joshua Levy (github.com/jlevy) with LLM assistance
---
# QA Playbook: [QA Playbook Name]

Manual QA playbook for [brief description of what is being tested].

**Purpose**: [State the validation objective - what are we proving works?]

**Estimated Time**: ~[X] minutes ([breakdown if helpful])

> This is a kind of “manual test”: it is not a strict end-to-end integration test,
> because it is too costly or pass/fail is not clear.
> Goals:
> - Document expected behavior that are difficult to capture fully in unit, integration,
>   or end-to-end/golden tests.
> - Make it possible for an agent to follow the instructions and evaluate if things are
>   working.
> - Make it possible for an agent to walk through and share the results with a human for
>   review as it progresses or when done.

* * *

## Current Status (last update YYYY-MM-DD)

| Phase | Status | Notes |
| --- | --- | --- |
| Phase 1: [Setup/Environment] | ⏳ Pending | [Brief status note] |
| Phase 2: [Core Validation] | ⏳ Pending | [Brief status note] |
| Phase 3: [Results Check] | ⏳ Pending | [Brief status note] |
| Phase 4: [Cleanup] | ⏳ Pending | [Brief status note] |

**Status Legend**: ✅ Passed | ❌ Failed | ⏳ Pending | ⏸️ Blocked

**Test Results (last update YYYY-MM-DD):** *(Fill in as you progress through phases)*

- `[command or test description]` → [✅/❌] [result summary]
- `[command or test description]` → [✅/❌] [result summary]

**Next Steps:**

1. [Action item]
2. [Action item]

* * *

**Prerequisites**:

- [Dependency 1] (e.g., Node.js 22 installed)
- [Dependency 2] (e.g., API keys configured)
- [Dependency 3] (e.g., Test data available)

* * *

## Related Documentation — Read for Context

> Include links to relevant documentation that provides context for this test, e.g.
> - [spec-name.md](path/to/spec) - [Brief description]
> - [architecture-doc.md](path/to/arch) - [Brief description]
> - [other-qa-playbook.md](path/to/qa) - [Brief description]

## Phase 1: [Setup/Environment]

### 1.1 [Setup Step Name]

```bash
# Commands to run
[command here]
```

**Expected output**:

```
[What success looks like]
```

**Verify**:

- [ ] [Verification checkpoint 1]
- [ ] [Verification checkpoint 2]

**Troubleshooting**:

- **Issue**: [Common problem] **Fix**: [Solution]

### 1.2 [Next Setup Step]

[Repeat structure above]

* * *

## Phase 2: [Core Validation]

### 2.1 [Test Step Name]

```bash
# Test command
[command here]
```

**Expected behavior**:

- [What should happen]
- [Key indicator of success]

**Verify**:

- [ ] [Check 1]
- [ ] [Check 2]

**Check for ERROR conditions** (any of these = FAIL):

- [ ] No [error type] (describe what to look for)
- [ ] No [failure mode]

### 2.2 [Next Test Step]

[Repeat structure above]

* * *

## Phase 3: [Results Validation]

### 3.1 [Results Check Name]

```bash
# Inspection commands
[command here]
```

**Quality checklist**:

| Item | Check | Status |
| --- | --- | --- |
| [Aspect 1] | [What to verify] | ⏳ |
| [Aspect 2] | [What to verify] | ⏳ |
| [Aspect 3] | [What to verify] | ⏳ |

**Common Issues**:

| Issue | Symptom | Likely Cause |
| --- | --- | --- |
| [Problem] | [How it appears] | [Root cause] |

* * *

## Phase 4: [Cleanup]

### 4.1 [Cleanup Step]

```bash
# Cleanup commands
[command here]
```

* * *

## Troubleshooting

### [Common Issue 1]

```bash
# Diagnostic commands
[command here]
```

**Solution**: [How to fix]

### [Common Issue 2]

**Symptoms**: [What you see]

**Fix**: [Steps to resolve]

* * *

## Success Criteria

Before marking this test as **PASSED**, verify:

- [ ] [Critical success criterion 1]
- [ ] [Critical success criterion 2]
- [ ] [Critical success criterion 3]
- [ ] [No critical errors in logs/output]
- [ ] [Performance/quality threshold met]

* * *
