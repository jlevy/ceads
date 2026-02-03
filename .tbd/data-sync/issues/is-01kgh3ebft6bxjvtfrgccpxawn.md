---
created_at: 2026-02-03T06:36:07.545Z
dependencies: []
id: is-01kgh3ebft6bxjvtfrgccpxawn
kind: task
labels: []
priority: 1
status: open
title: Add golden test for fresh clone with remote tbd-sync data
type: is
updated_at: 2026-02-03T06:36:24.996Z
version: 2
---
## Overview

Add a golden session test to catch the bug where `tbd doctor` shows 0 issues when remote `tbd-sync` branch has data but the local worktree hasn't been created yet.

## Test Scenario

1. **Setup Phase (first repo)**:
   - Create a new git repo with `tbd init`
   - Create several beads
   - Run `tbd sync` to push to `tbd-sync` branch
   - Push to remote

2. **Clone Phase (second repo)**:
   - Clone the repo (simulating a new user/machine)
   - Run `tbd doctor` WITHOUT running `tbd sync` first
   - **Expected**: Statistics should show `Total: 0 (X on remote - run 'tbd sync')`
   - **Previous bug**: Statistics showed `Total: 0` with no hint about remote data

3. **Verification Phase**:
   - Run `tbd sync`
   - Run `tbd doctor` again
   - **Expected**: Statistics should show actual issue count

## Implementation Notes

- This should be a golden/snapshot test that captures the CLI output
- The test should use a local bare repo as the 'remote' to avoid network dependencies
- Consider adding to the existing golden test suite in `packages/tbd/tests/golden/`

## Related

- Bug: tbd-n6ra (tbd doctor shows 0 issues when remote tbd-sync branch has data)
- Fix: Added `countRemoteIssues()` function and updated statistics rendering
