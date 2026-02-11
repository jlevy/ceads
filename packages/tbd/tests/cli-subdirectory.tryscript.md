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

* * *

## Spurious .tbd/ Directory in Subdirectory

# Test: Commands work when subdirectory has spurious .tbd/ (no config.yml)

If a subdirectory has a `.tbd/` directory without `config.yml` (e.g., only `state.yml`
from a bug), tbd should skip it and find the real root.

```console
$ mkdir -p web/.tbd && echo "welcome_seen: true" > web/.tbd/state.yml && cd web && tbd list
...
? 0
```

# Test: Config show works from subdirectory with spurious .tbd/

The config command should read from the real root, not from the spurious subdirectory.

```console
$ cd web && tbd config show
...
  id_prefix: test
...
? 0
```

# Test: Config set works from subdirectory with spurious .tbd/

Config writes should go to the real root config.yml.

```console
$ cd web && tbd config set settings.auto_sync true && tbd config get settings.auto_sync
...
true
? 0
```

# Test: Create issue from subdirectory with spurious .tbd/

```console
$ cd web && tbd create "Issue from web subdir"
✓ Created test-[SHORTID]: Issue from web subdir
? 0
```

# Test: Empty .tbd/ directory in subdirectory is skipped

```console
$ mkdir -p packages/app/.tbd && cd packages/app && tbd list
...
? 0
```
