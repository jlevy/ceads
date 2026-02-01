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
before: |
  # Set up a test git repository with tbd initialized
  git init --initial-branch=main
  git config user.email "test@example.com"
  git config user.name "Test User"
  git config commit.gpgsign false
  echo "# Test repo" > README.md
  git add README.md
  git commit -m "Initial commit"
  tbd init --prefix=test --quiet
  tbd create "Test issue" --quiet
  # Create subdirectories for testing
  mkdir -p src/components/ui
  mkdir -p docs/api
---
# tbd CLI: Subdirectory Support

Tests for running tbd commands from subdirectories within a tbd repository.
The CLI finds the tbd root by walking up the directory tree, similar to how git finds
.git/ directories.

* * *

## List Command from Root Works

# Test: List from root directory works

Verify baseline - list works from the repository root.

```console
$ tbd list
...
? 0
```

* * *

## List Command from Subdirectory

# Test: List from first-level subdirectory works

Running `tbd list` from a subdirectory finds the tbd root and shows issues.

```console
$ cd src && tbd list
...
? 0
```

# Test: List from nested subdirectory works

Running `tbd list` from a deeply nested subdirectory also finds the tbd root.

```console
$ cd src/components/ui && tbd list
...
? 0
```

* * *

## Other Commands from Subdirectory

# Test: Create from subdirectory works

Creating an issue from a subdirectory works correctly.

```console
$ cd docs/api && tbd create "New issue from subdir"
✓ Created test-[SHORTID]: New issue from subdir
? 0
```

# Test: List shows issues created from subdirectory

Issues created from subdirectories appear in list.

```console
$ tbd list
...
? 0
```

# Test: Status from subdirectory shows initialized

Status command correctly detects tbd from subdirectories.

```console
$ cd src && tbd status 2>&1
...
Repository: [..]
  ✓ Initialized (.tbd/)
  ✓ Git repository[..]
...
? 0
```
