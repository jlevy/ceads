---
sandbox: true
env:
  NO_COLOR: '1'
  FORCE_COLOR: '0'
path:
  - ../dist
timeout: 30000
patterns:
  ULID: '[0-9a-z]{26}'
  SHORTID: '[0-9a-z]{4,5}'
  TIMESTAMP: "\\d{4}-\\d{2}-\\d{2}T\\d{2}:\\d{2}:\\d{2}(\\.\\d+)?Z"
before: |
  # Set up a test git repository
  git init --initial-branch=main
  git config user.email "test@example.com"
  git config user.name "Test User"
  git config commit.gpgsign false
  echo "# Test repo" > README.md
  git add README.md
  git commit -m "Initial commit"
  # Initialize tbd with test prefix
  tbd init --prefix=test
  # Create spec files for testing
  mkdir -p docs/project/specs/active
  echo "# My Feature Spec" > docs/project/specs/active/plan-2026-01-26-my-feature.md
  echo "# Workflow Spec" > docs/project/specs/active/workflow-spec.md
  echo "# Feature v2 Spec" > docs/my-feature_v2.0.md
---
# tbd CLI: Spec Linking Feature

Tests for the spec_path field that links beads to specification documents.
With Phase 3, spec paths are validated (file must exist) and normalized.

* * *

## Backward Compatibility (Non-Spec Workflows)

# Test: Create without --spec (existing workflow unchanged)

```console
$ tbd create "Task without spec"
✓ Created test-[SHORTID]: Task without spec
? 0
```

# Test: Create another issue without spec

```console
$ tbd create "Second task no spec" --json | jq -r '.id' | tee nospec_id.txt
test-[SHORTID]
? 0
```

# Test: Show issue without spec_path (no spec_path in output)

```console
$ tbd show $(cat nospec_id.txt) --json
{
  "type": "is",
  "id": "is-[ULID]",
  "version": 1,
  "created_at": "[TIMESTAMP]",
  "updated_at": "[TIMESTAMP]",
  "title": "Second task no spec",
  "kind": "task",
  "status": "open",
  "priority": 2,
  "labels": [],
  "dependencies": [],
  "displayId": "test-[SHORTID]"
}
? 0
```

* * *

## Create with --spec Option (with validation)

# Test: Create with --spec (full path to existing file)

```console
$ tbd create "Schema changes" --spec docs/project/specs/active/plan-2026-01-26-my-feature.md --json | jq -r '.id' | tee spec1_id.txt
test-[SHORTID]
? 0
```

# Test: Verify spec_path was stored (normalized full path)

```console
$ tbd show $(cat spec1_id.txt) --json
{
  "type": "is",
  "id": "is-[ULID]",
  "version": 1,
  "created_at": "[TIMESTAMP]",
  "updated_at": "[TIMESTAMP]",
  "title": "Schema changes",
  "kind": "task",
  "status": "open",
  "priority": 2,
  "labels": [],
  "dependencies": [],
  "spec_path": "docs/project/specs/active/plan-2026-01-26-my-feature.md",
  "displayId": "test-[SHORTID]"
}
? 0
```

# Test: Create with --spec using ./ prefix (normalized)

```console
$ tbd create "CLI updates" --spec ./docs/project/specs/active/plan-2026-01-26-my-feature.md --json | jq -r '.id' | tee spec2_id.txt
test-[SHORTID]
? 0
```

# Test: Verify ./ was normalized away

```console
$ tbd show $(cat spec2_id.txt) --json
{
  "type": "is",
  "id": "is-[ULID]",
  "version": 1,
  "created_at": "[TIMESTAMP]",
  "updated_at": "[TIMESTAMP]",
  "title": "CLI updates",
  "kind": "task",
  "status": "open",
  "priority": 2,
  "labels": [],
  "dependencies": [],
  "spec_path": "docs/project/specs/active/plan-2026-01-26-my-feature.md",
  "displayId": "test-[SHORTID]"
}
? 0
```

* * *

## Path Validation Errors

# Test: Create with non-existent spec file

```console
$ tbd create "Bad spec" --spec nonexistent-file.md
Error: File not found: nonexistent-file.md
? 2
```

# Test: Create with path outside project

```console
$ tbd create "Outside project" --spec /etc/passwd
Error: Path is outside project root: /etc/passwd
? 2
```

# Test: Create with relative path escaping project

```console
$ tbd create "Escape project" --spec ../../outside/file.md
Error: Path is outside project root: ../../outside/file.md
? 2
```

* * *

## List with --spec Filter (Gradual Matching)

Note: Both spec1 and spec2 point to the same normalized path.

# Test: List --spec with exact path match

```console
$ tbd list --spec docs/project/specs/active/plan-2026-01-26-my-feature.md --count
2
? 0
```

# Test: List --spec with filename-only match

```console
$ tbd list --spec plan-2026-01-26-my-feature.md --count
2
? 0
```

# Test: List --spec with partial path match

```console
$ tbd list --spec active/plan-2026-01-26-my-feature.md --count
2
? 0
```

# Test: List --spec combined with other filters

```console
$ tbd list --spec plan-2026-01-26-my-feature.md --status open --count
2
? 0
```

# Test: List --spec with no matches returns 0

```console
$ tbd list --spec nonexistent-spec.md --count
0
? 0
```

# Test: List without --spec returns all issues

At this point we have 4 issues: 2 without spec, 2 with spec

```console
$ tbd list --count
4
? 0
```

* * *

## Show Command with spec_path

# Test: Show displays spec_path in output

```console
$ tbd show $(cat spec1_id.txt) | grep -c "spec_path:"
1
? 0
```

# Test: Show JSON includes spec_path

```console
$ tbd show $(cat spec1_id.txt) --json
{
  "type": "is",
  "id": "is-[ULID]",
  "version": 1,
  "created_at": "[TIMESTAMP]",
  "updated_at": "[TIMESTAMP]",
  "title": "Schema changes",
  "kind": "task",
  "status": "open",
  "priority": 2,
  "labels": [],
  "dependencies": [],
  "spec_path": "docs/project/specs/active/plan-2026-01-26-my-feature.md",
  "displayId": "test-[SHORTID]"
}
? 0
```

* * *

## Update Command with --spec

First create a new spec file for update tests:

```console
$ echo "# New Spec" > new-spec.md && echo "# Different Spec" > different-spec.md
? 0
```

# Test: Update to set spec_path

```console
$ tbd update $(cat nospec_id.txt) --spec new-spec.md
✓ Updated [..]
? 0
```

# Test: Verify spec_path was set

```console
$ tbd show $(cat nospec_id.txt) --json
{
  "type": "is",
  "id": "is-[ULID]",
  "version": 2,
  "created_at": "[TIMESTAMP]",
  "updated_at": "[TIMESTAMP]",
  "title": "Second task no spec",
  "kind": "task",
  "status": "open",
  "priority": 2,
  "labels": [],
  "dependencies": [],
  "spec_path": "new-spec.md",
  "displayId": "test-[SHORTID]"
}
? 0
```

# Test: Update to change spec_path

```console
$ tbd update $(cat nospec_id.txt) --spec different-spec.md
✓ Updated [..]
? 0
```

# Test: Verify spec_path was changed

```console
$ tbd show $(cat nospec_id.txt) --json
{
  "type": "is",
  "id": "is-[ULID]",
  "version": 3,
  "created_at": "[TIMESTAMP]",
  "updated_at": "[TIMESTAMP]",
  "title": "Second task no spec",
  "kind": "task",
  "status": "open",
  "priority": 2,
  "labels": [],
  "dependencies": [],
  "spec_path": "different-spec.md",
  "displayId": "test-[SHORTID]"
}
? 0
```

# Test: Update to clear spec_path with empty string (no validation needed)

```console
$ tbd update $(cat nospec_id.txt) --spec ""
✓ Updated [..]
? 0
```

# Test: Verify spec_path was cleared

```console
$ tbd show $(cat nospec_id.txt) --json
{
  "type": "is",
  "id": "is-[ULID]",
  "version": 4,
  "created_at": "[TIMESTAMP]",
  "updated_at": "[TIMESTAMP]",
  "title": "Second task no spec",
  "kind": "task",
  "status": "open",
  "priority": 2,
  "labels": [],
  "dependencies": [],
  "spec_path": null,
  "displayId": "test-[SHORTID]"
}
? 0
```

# Test: Update with non-existent spec file fails

```console
$ tbd update $(cat nospec_id.txt) --spec nonexistent.md
Error: File not found: nonexistent.md
? 2
```

* * *

## Mixed Workflows

# Test: List returns both spec-linked and unlinked issues by default

```console
$ tbd list --json
[
...
]
? 0
```

# Test: JSON output includes spec_path when present

```console
$ tbd list --json
[
...
]
? 0
```

# Test: Create issue, link to spec, then close (full workflow)

```console
$ tbd create "Full workflow task" --spec docs/project/specs/active/workflow-spec.md --json | jq -r '.id' | tee workflow_id.txt
test-[SHORTID]
? 0
```

```console
$ tbd close $(cat workflow_id.txt)
✓ Closed [..]
? 0
```

# Test: Closed spec-linked issue not shown by default

```console
$ tbd list --spec workflow-spec.md --count
0
? 0
```

# Test: Closed spec-linked issue shown with --all

```console
$ tbd list --spec workflow-spec.md --all --count
1
? 0
```

* * *

## Path Normalization

# Test: Create with --spec containing special characters in filename

```console
$ tbd create "Special chars" --spec "docs/my-feature_v2.0.md" --json | jq -r '.id'
test-[SHORTID]
? 0
```

# Test: List with --spec containing special characters

```console
$ tbd list --spec "my-feature_v2.0.md" --count
1
? 0
```

# Test: Dry run with --spec still validates (shows what would happen)

```console
$ tbd create "Dry run spec" --spec docs/project/specs/active/plan-2026-01-26-my-feature.md --dry-run
[DRY-RUN] Would create issue
? 0
```

# Test: Dry run with non-existent spec shows error

```console
$ tbd create "Dry run bad spec" --spec nonexistent-for-dry-run.md --dry-run
Error: File not found: nonexistent-for-dry-run.md
? 2
```

* * *

## Path Resolution from Subdirectories

# Test: Create issue from subdirectory (path resolved relative to project root)

```console
$ mkdir -p src && cd src && tbd create "From subdir" --spec ../docs/project/specs/active/plan-2026-01-26-my-feature.md --json | jq -r '.id' | tee ../subdir_id.txt
test-[SHORTID]
? 0
```

# Test: Verify subdirectory spec path was normalized

```console
$ tbd show $(cat subdir_id.txt) --json
{
  "type": "is",
  "id": "is-[ULID]",
  "version": 1,
  "created_at": "[TIMESTAMP]",
  "updated_at": "[TIMESTAMP]",
  "title": "From subdir",
  "kind": "task",
  "status": "open",
  "priority": 2,
  "labels": [],
  "dependencies": [],
  "spec_path": "docs/project/specs/active/plan-2026-01-26-my-feature.md",
  "displayId": "test-[SHORTID]"
}
? 0
```
