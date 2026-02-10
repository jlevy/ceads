# External Issue Linking: QA Validation Script

> **Feature**: External GitHub Issue Linking (PR #83) **Branch**:
> `claude/external-issue-linking-1rGfb` **Date**: 2026-02-10

## Overview

This document provides a prescriptive, step-by-step QA script for manually validating
the external issue linking feature end-to-end.
It complements the 89 automated tests (unit + e2e) by exercising real GitHub API calls,
real `gh` CLI authentication, and real sync behavior that cannot be tested in CI without
credentials.

## Goals

1. Verify `--external-issue` flag works on `create` and `update` with real GitHub Issues
2. Verify `tbd show` and `tbd list --external-issue` display linked issues correctly
3. Verify bidirectional sync: `tbd sync --external` pulls GitHub state changes and
   pushes local status changes
4. Verify inheritance: child beads inherit `external_issue_url` from parent
5. Verify propagation: updating parent’s `external_issue_url` propagates to children
6. Verify `tbd doctor` checks `gh` CLI health
7. Verify `use_gh_cli: false` gates all external issue features
8. Verify error handling for bad URLs, PR URLs, non-existent issues

* * *

## Prerequisites

### Tools Required

```bash
# Verify gh CLI is installed and authenticated
gh --version
gh auth status

# Verify tbd is built from the feature branch
git checkout claude/external-issue-linking-1rGfb
pnpm install && pnpm build
tbd --version
```

### Create a Test Repository on GitHub

You need a throwaway GitHub repo with a few test issues.
You can use an existing test repo or create a new one:

```bash
# Create a test repo (or use an existing one)
gh repo create my-tbd-qa-test --public --description "Throwaway repo for tbd QA" --clone
cd my-tbd-qa-test

# Create test issues on GitHub that we'll link to
gh issue create --title "QA Test Issue 1 - Basic linking" --body "For QA testing tbd external linking"
gh issue create --title "QA Test Issue 2 - Sync testing" --body "For QA testing bidirectional sync"
gh issue create --title "QA Test Issue 3 - Inheritance" --body "For QA testing inheritance"
gh issue create --title "QA Test Issue 4 - Propagation" --body "For QA testing propagation"

# Note the issue URLs (or query them)
gh issue list --json number,url
```

Record the URLs:
- `ISSUE_1_URL=https://github.com/<you>/my-tbd-qa-test/issues/1`
- `ISSUE_2_URL=https://github.com/<you>/my-tbd-qa-test/issues/2`
- `ISSUE_3_URL=https://github.com/<you>/my-tbd-qa-test/issues/3`
- `ISSUE_4_URL=https://github.com/<you>/my-tbd-qa-test/issues/4`

### Set Up the Test Workspace

Clone the test repo into the attic (or a temp directory) and initialize tbd:

```bash
# From the tbd repo root
mkdir -p attic
cd attic
git clone https://github.com/<you>/my-tbd-qa-test.git tbd-qa-workspace
cd tbd-qa-workspace

# Initialize tbd
tbd init --prefix=qa
tbd doctor
```

* * *

## Test Script

### Phase 1: Doctor Command and Configuration

**Test 1.1: Doctor reports gh CLI status**

```bash
tbd doctor
```

- [ ] Output includes an “Integration” or “gh CLI” check
- [ ] Reports gh as installed and authenticated
- [ ] Overall status is healthy

**Test 1.2: Doctor with use_gh_cli disabled**

```bash
# Temporarily disable gh CLI in config
echo "use_gh_cli: false" >> .tbd/config.yml
tbd doctor
```

- [ ] gh CLI check reports “disabled” (not an error/warning)
- [ ] No authentication check is run

```bash
# Re-enable (remove the line we added)
# Edit .tbd/config.yml to remove "use_gh_cli: false"
```

* * *

### Phase 2: Creating Beads with External Issue Links

**Test 2.1: Create bead with --external-issue flag**

```bash
tbd create "Basic linked task" --external-issue "$ISSUE_1_URL" --json
```

- [ ] Command succeeds (exit 0)
- [ ] JSON output includes the bead ID
- [ ] No error about GitHub API

**Test 2.2: Verify the link via show**

```bash
tbd show <bead-id-from-2.1>
```

- [ ] Output includes `external_issue_url:` line
- [ ] URL is displayed with colored formatting
- [ ] URL matches the issue URL provided

```bash
tbd show <bead-id-from-2.1> --json
```

- [ ] JSON output includes `"external_issue_url": "<ISSUE_1_URL>"`

**Test 2.3: Reject PR URLs**

```bash
tbd create "Bad link" --external-issue "https://github.com/<you>/my-tbd-qa-test/pull/1"
```

- [ ] Command fails with an error about PR URLs not being supported
- [ ] No bead is created

**Test 2.4: Reject non-existent issues**

```bash
tbd create "Bad link" --external-issue "https://github.com/<you>/my-tbd-qa-test/issues/99999"
```

- [ ] Command fails with an error about issue not found / not accessible
- [ ] No bead is created

**Test 2.5: Reject when use_gh_cli is false**

```bash
# Temporarily disable
echo "use_gh_cli: false" >> .tbd/config.yml
tbd create "Should fail" --external-issue "$ISSUE_1_URL"
```

- [ ] Command fails with error about use_gh_cli being disabled
- [ ] No bead is created

```bash
# Re-enable
# Edit .tbd/config.yml to remove "use_gh_cli: false"
```

* * *

### Phase 3: Updating Beads with External Issue Links

**Test 3.1: Add external issue to existing bead**

```bash
tbd create "Unlinked task" --json
# Note the ID
tbd update <id> --external-issue "$ISSUE_2_URL"
tbd show <id> --json
```

- [ ] Update succeeds
- [ ] `external_issue_url` is now set in show output

**Test 3.2: Clear external issue via --from-file**

```bash
cat > /tmp/clear-external.yml << 'EOF'
---
external_issue_url:
---
EOF
tbd update <id-from-3.1> --from-file /tmp/clear-external.yml
tbd show <id-from-3.1> --json
```

- [ ] Update succeeds
- [ ] `external_issue_url` is now null/absent in show output

**Test 3.3: Set external issue via --from-file**

```bash
cat > /tmp/set-external.yml << EOF
---
external_issue_url: "$ISSUE_2_URL"
---
EOF
tbd update <id-from-3.1> --from-file /tmp/set-external.yml
tbd show <id-from-3.1> --json
```

- [ ] `external_issue_url` is set again

* * *

### Phase 4: List Filtering

**Test 4.1: List with --external-issue flag (show all linked)**

```bash
tbd list --external-issue
```

- [ ] Shows only beads with an external_issue_url
- [ ] Does NOT show unlinked beads

**Test 4.2: List with --external-issue <url> (match specific URL)**

```bash
tbd list --external-issue "$ISSUE_1_URL" --json
```

- [ ] Shows only the bead linked to ISSUE_1_URL
- [ ] Does NOT show bead linked to ISSUE_2_URL

**Test 4.3: List --json includes external_issue_url field**

```bash
tbd list --json
```

- [ ] Linked beads have `external_issue_url` in their JSON
- [ ] Unlinked beads do NOT have the field (or it’s undefined)

* * *

### Phase 5: Inheritance

**Test 5.1: Child inherits external_issue_url from parent**

```bash
tbd create "Parent epic" --type epic --external-issue "$ISSUE_3_URL" --json
# Note parent ID
tbd create "Child task" --parent <parent-id> --json
# Note child ID
tbd show <child-id> --json
```

- [ ] Child has `external_issue_url` matching the parent’s URL
- [ ] Child did NOT require `--external-issue` flag

**Test 5.2: Child does NOT inherit when parent has no URL**

```bash
tbd create "Plain parent" --type epic --json
tbd create "Plain child" --parent <plain-parent-id> --json
tbd show <plain-child-id> --json
```

- [ ] Child does NOT have `external_issue_url`

* * *

### Phase 6: Propagation

**Test 6.1: Updating parent’s URL propagates to children**

```bash
tbd create "Prop parent" --type epic --json
# Note parent ID
tbd create "Prop child 1" --parent <parent-id> --json
tbd create "Prop child 2" --parent <parent-id> --json

# Now set URL on parent
tbd update <parent-id> --external-issue "$ISSUE_4_URL"

# Check children
tbd show <child-1-id> --json
tbd show <child-2-id> --json
```

- [ ] Both children now have `external_issue_url` matching ISSUE_4_URL
- [ ] Parent also has the URL

* * *

### Phase 7: Bidirectional Sync (The Main Event)

This is the most important manual test — it validates real GitHub API round-trips.

**Test 7.1: External pull — close issue on GitHub, sync locally**

```bash
# Start with an open bead linked to ISSUE_2_URL
tbd show <bead-linked-to-issue-2> --json
# Confirm status is "open"

# Close the issue on GitHub
gh issue close <ISSUE_2_NUMBER> --repo <you>/my-tbd-qa-test --comment "Closing for QA"

# Sync
tbd sync --external

# Check local bead
tbd show <bead-linked-to-issue-2> --json
```

- [ ] Sync reports pulling status change
- [ ] Local bead status is now “closed”

**Test 7.2: External pull — reopen issue on GitHub, sync locally**

```bash
# Reopen the issue on GitHub
gh issue reopen <ISSUE_2_NUMBER> --repo <you>/my-tbd-qa-test

# Sync
tbd sync --external

# Check local bead
tbd show <bead-linked-to-issue-2> --json
```

- [ ] Sync reports pulling status change
- [ ] Local bead status is now “open” (reopened)

**Test 7.3: External push — close bead locally, push to GitHub**

```bash
# Close the local bead
tbd close <bead-linked-to-issue-2>

# Sync
tbd sync --external

# Check GitHub
gh issue view <ISSUE_2_NUMBER> --repo <you>/my-tbd-qa-test --json state,stateReason
```

- [ ] Sync reports pushing status change
- [ ] GitHub issue is now closed with reason “completed”

**Test 7.4: External push — reopen bead locally, push to GitHub**

```bash
# Reopen the local bead
tbd update <bead-linked-to-issue-2> --status open

# Sync
tbd sync --external

# Check GitHub
gh issue view <ISSUE_2_NUMBER> --repo <you>/my-tbd-qa-test --json state
```

- [ ] GitHub issue is now open again

**Test 7.5: Sync with --external flag (scope isolation)**

```bash
tbd sync --external
```

- [ ] Only external sync runs (no git push/pull, no doc sync)
- [ ] Output shows external pull/push phases only

**Test 7.6: Full sync includes external phases**

```bash
tbd sync
```

- [ ] Output shows all phases: external pull, docs, issues, external push
- [ ] External phases run alongside regular sync

* * *

### Phase 8: Error Handling

**Test 8.1: Sync with invalid external_issue_url**

```bash
# Manually set a bad URL via --from-file
cat > /tmp/bad-url.yml << 'EOF'
---
external_issue_url: "https://github.com/nonexistent-org-12345/nonexistent-repo/issues/1"
---
EOF
tbd create "Bad URL bead" --json
tbd update <id> --from-file /tmp/bad-url.yml

tbd sync --external
```

- [ ] Sync does NOT crash
- [ ] Reports error for the specific bead with bad URL
- [ ] Other linked beads (if any) still sync successfully

**Test 8.2: Sync without gh CLI**

```bash
# Temporarily rename gh or set PATH to exclude it
PATH_BAK="$PATH"
export PATH=$(echo "$PATH" | tr ':' '\n' | grep -v gh | tr '\n' ':')

tbd sync --external

export PATH="$PATH_BAK"
```

- [ ] Sync reports error about gh CLI not available
- [ ] Does NOT crash

* * *

### Phase 9: Deferred Status Mapping

**Test 9.1: Defer bead locally, verify GitHub shows not_planned**

```bash
tbd create "Deferred task" --external-issue "$ISSUE_1_URL" --json
tbd update <id> --status deferred
tbd sync --external

gh issue view <ISSUE_1_NUMBER> --repo <you>/my-tbd-qa-test --json state,stateReason
```

- [ ] GitHub issue is closed with `stateReason: "NOT_PLANNED"`

**Test 9.2: Close as not_planned on GitHub, verify local shows deferred**

```bash
# First reopen
gh issue reopen <ISSUE_1_NUMBER> --repo <you>/my-tbd-qa-test
tbd sync --external
# Bead should be open again

# Now close as not_planned
gh issue close <ISSUE_1_NUMBER> --repo <you>/my-tbd-qa-test --reason "not planned"
tbd sync --external

tbd show <bead-id> --json
```

- [ ] Local bead status is “deferred” (not “closed”)

* * *

## Cleanup

After testing, clean up the test environment:

```bash
# Delete the test repo
gh repo delete <you>/my-tbd-qa-test --yes

# Remove the test workspace
cd /path/to/tbd
rm -rf attic/tbd-qa-workspace
```

* * *

## Automated Test Summary

The following are covered by the 89 automated tests in CI and do NOT need manual
re-verification:

| Area | Tests | Coverage |
| --- | --- | --- |
| URL parsing | 44 | Valid/invalid URLs, PR rejection, format variants |
| Status mapping | 12 | All tbd-to-GitHub and GitHub-to-tbd transitions |
| Label diff | 3 | Add/remove/no-op label changes |
| Inheritance | 20 | Parent-child field copying, explicit override, propagation |
| External sync | 15 | Pull/push logic with mocked GitHub API |
| E2e golden tests | 10 | Round-trip, update, clear, inherit, propagate, list filter, show |
| **Total** | **89** | Schema, CLI, logic, inheritance — all without network |

### What manual testing adds

The manual tests above exercise the real `gh api` integration that is mocked in CI.
Specifically:

1. **Real HTTP calls** to GitHub’s API via `gh`
2. **Real authentication** flow (tokens, SSH keys)
3. **Real state transitions** (open/close/reopen on GitHub)
4. **Real `state_reason`** mapping (completed vs not_planned)
5. **Real error responses** (404, permission denied)
6. **Visual verification** of CLI output formatting
7. **Scope isolation** of `--external` flag in sync

* * *

## Semi-Automated QA Script

For faster re-runs, you can save the following as a shell script.
It requires `GITHUB_USER` and optionally `QA_REPO` environment variables.

```bash
#!/usr/bin/env bash
# external-issues-qa.sh - Semi-automated QA for external issue linking
#
# Usage:
#   GITHUB_USER=yourname ./external-issues-qa.sh
#   GITHUB_USER=yourname QA_REPO=existing-repo ./external-issues-qa.sh
#
set -euo pipefail

GITHUB_USER="${GITHUB_USER:?Set GITHUB_USER to your GitHub username}"
QA_REPO="${QA_REPO:-tbd-qa-$(date +%s)}"
QA_DIR="$(mktemp -d)"
REPO_URL="https://github.com/$GITHUB_USER/$QA_REPO"

cleanup() {
  echo ""
  echo "=== Cleanup ==="
  echo "Test workspace: $QA_DIR"
  echo "GitHub repo: $REPO_URL"
  read -p "Delete test repo and workspace? [y/N] " -n 1 -r
  echo
  if [[ $REPLY =~ ^[Yy]$ ]]; then
    gh repo delete "$GITHUB_USER/$QA_REPO" --yes 2>/dev/null || true
    rm -rf "$QA_DIR"
    echo "Cleaned up."
  else
    echo "Skipped cleanup. Remove manually when done."
  fi
}
trap cleanup EXIT

echo "=== Setup ==="
echo "Creating test repo: $GITHUB_USER/$QA_REPO"
gh repo create "$QA_REPO" --public --description "tbd QA test repo" --clone -- "$QA_DIR/$QA_REPO"
cd "$QA_DIR/$QA_REPO"

echo "Creating test issues..."
ISSUE_1_URL=$(gh issue create --title "QA: Basic linking" --body "test" | tail -1)
ISSUE_2_URL=$(gh issue create --title "QA: Sync testing" --body "test" | tail -1)
ISSUE_3_URL=$(gh issue create --title "QA: Inheritance" --body "test" | tail -1)
ISSUE_4_URL=$(gh issue create --title "QA: Propagation" --body "test" | tail -1)

echo "Issue 1: $ISSUE_1_URL"
echo "Issue 2: $ISSUE_2_URL"
echo "Issue 3: $ISSUE_3_URL"
echo "Issue 4: $ISSUE_4_URL"

echo ""
echo "Initializing tbd..."
tbd init --prefix=qa
echo ""

pass() { echo "  PASS: $1"; }
fail() { echo "  FAIL: $1"; FAILURES=$((FAILURES + 1)); }
FAILURES=0

# ---- Test: Doctor ----
echo "=== Test: Doctor ==="
tbd doctor 2>&1 | grep -qi "gh\|github\|cli" && pass "Doctor mentions gh CLI" || fail "Doctor should mention gh CLI"

# ---- Test: Create with --external-issue ----
echo ""
echo "=== Test: Create with --external-issue ==="
BEAD_1=$(tbd create "Linked task 1" --external-issue "$ISSUE_1_URL" --json | jq -r '.id')
[[ -n "$BEAD_1" ]] && pass "Created bead $BEAD_1" || fail "Failed to create linked bead"

URL_OUT=$(tbd show "$BEAD_1" --json | jq -r '.external_issue_url // empty')
[[ "$URL_OUT" == "$ISSUE_1_URL" ]] && pass "Show displays correct URL" || fail "Show URL mismatch: $URL_OUT"

# ---- Test: Reject PR URL ----
echo ""
echo "=== Test: Reject PR URL ==="
if tbd create "Bad" --external-issue "${REPO_URL}/pull/1" 2>&1; then
  fail "Should reject PR URL"
else
  pass "Rejected PR URL"
fi

# ---- Test: Create linked bead for sync ----
echo ""
echo "=== Test: Sync Setup ==="
BEAD_2=$(tbd create "Sync task" --external-issue "$ISSUE_2_URL" --json | jq -r '.id')
echo "Created sync bead: $BEAD_2"

# ---- Test: External pull (close on GitHub, pull locally) ----
echo ""
echo "=== Test: External Pull ==="
gh issue close 2 --repo "$GITHUB_USER/$QA_REPO" --comment "QA close"
sleep 2
tbd sync --external
STATUS=$(tbd show "$BEAD_2" --json | jq -r '.status')
[[ "$STATUS" == "closed" ]] && pass "Pull: bead closed after GH close" || fail "Pull: expected closed, got $STATUS"

# ---- Test: External pull (reopen on GitHub, pull locally) ----
echo ""
echo "=== Test: External Pull (reopen) ==="
gh issue reopen 2 --repo "$GITHUB_USER/$QA_REPO"
sleep 2
tbd sync --external
STATUS=$(tbd show "$BEAD_2" --json | jq -r '.status')
[[ "$STATUS" == "open" ]] && pass "Pull: bead reopened after GH reopen" || fail "Pull: expected open, got $STATUS"

# ---- Test: External push (close locally, push to GitHub) ----
echo ""
echo "=== Test: External Push ==="
tbd close "$BEAD_2"
tbd sync --external
sleep 2
GH_STATE=$(gh issue view 2 --repo "$GITHUB_USER/$QA_REPO" --json state --jq '.state')
[[ "$GH_STATE" == "CLOSED" ]] && pass "Push: GH issue closed" || fail "Push: expected CLOSED, got $GH_STATE"

# ---- Test: Inheritance ----
echo ""
echo "=== Test: Inheritance ==="
PARENT=$(tbd create "Parent epic" --type epic --external-issue "$ISSUE_3_URL" --json | jq -r '.id')
CHILD=$(tbd create "Child task" --parent "$PARENT" --json | jq -r '.id')
CHILD_URL=$(tbd show "$CHILD" --json | jq -r '.external_issue_url // empty')
[[ "$CHILD_URL" == "$ISSUE_3_URL" ]] && pass "Child inherited URL from parent" || fail "Inheritance failed: $CHILD_URL"

# ---- Test: Propagation ----
echo ""
echo "=== Test: Propagation ==="
PROP_PARENT=$(tbd create "Prop parent" --type epic --json | jq -r '.id')
PROP_CHILD=$(tbd create "Prop child" --parent "$PROP_PARENT" --json | jq -r '.id')
tbd update "$PROP_PARENT" --external-issue "$ISSUE_4_URL"
PROP_URL=$(tbd show "$PROP_CHILD" --json | jq -r '.external_issue_url // empty')
[[ "$PROP_URL" == "$ISSUE_4_URL" ]] && pass "Propagation: child got parent URL" || fail "Propagation failed: $PROP_URL"

# ---- Test: List filter ----
echo ""
echo "=== Test: List Filter ==="
LINKED_COUNT=$(tbd list --external-issue --json | jq 'length')
TOTAL_COUNT=$(tbd list --json | jq 'length')
[[ "$LINKED_COUNT" -gt 0 && "$LINKED_COUNT" -lt "$TOTAL_COUNT" ]] && \
  pass "List filter: $LINKED_COUNT linked out of $TOTAL_COUNT total" || \
  fail "List filter: linked=$LINKED_COUNT total=$TOTAL_COUNT"

# ---- Summary ----
echo ""
echo "==============================="
if [[ $FAILURES -eq 0 ]]; then
  echo "ALL TESTS PASSED"
else
  echo "$FAILURES TEST(S) FAILED"
fi
echo "==============================="
exit $FAILURES
```

Save this script and run it with `GITHUB_USER=yourname ./external-issues-qa.sh`. It
creates a disposable GitHub repo, runs the tests, and offers to clean up afterward.
