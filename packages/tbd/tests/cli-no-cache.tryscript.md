---
sandbox: true
env:
  NO_COLOR: '1'
  FORCE_COLOR: '0'
path:
  - ../dist
timeout: 30000
before: |
  # Set up a test git repository
  git init --initial-branch=main
  git config user.email "test@example.com"
  git config user.name "Test User"
  git config commit.gpgsign false
  echo "# Test repo" > README.md
  git add README.md
  git commit -m "Initial commit"
---
# tbd CLI: No Cache Directory (cache removal verification)

This tryscript validates that the cache directory has been removed and docs are
gitignored.

* * *

## Directory Structure After Init

# Test: Initialize tbd

```console
$ tbd init --prefix=bd --quiet
? 0
```

# Test: No cache directory exists

```console
$ test ! -d .tbd/cache && echo "No cache directory"
No cache directory
? 0
```

# Test: docs directory is gitignored

```console
$ grep "docs/" .tbd/.gitignore
docs/
? 0
```

# Test: state.yml is gitignored (not in cache/)

```console
$ grep "state.yml" .tbd/.gitignore
state.yml
? 0
```

# Test: cache/ is NOT in gitignore (should have 0 matches)

```console
$ grep "^cache/" .tbd/.gitignore || echo "cache not in gitignore"
cache not in gitignore
? 0
```

* * *

## Shortcuts Work Without Cache

# Test: tbd setup runs successfully

```console
$ tbd setup --auto 2>&1 | grep -E "All set"
All set!
? 0
```

# Test: Docs directory has shortcuts

```console
$ ls .tbd/docs/tbd/shortcuts/ | wc -l | tr -d ' '
[..]
? 0
```

# Test: tbd skill outputs content (generated on-the-fly)

```console
$ tbd skill | grep -c "name: tbd"
1
? 0
```

# Test: tbd skill includes shortcut directory

```console
$ tbd skill | grep -c "Available Shortcuts"
1
? 0
```

# Test: tbd shortcut list works

```console
$ tbd shortcut --list | grep -c "new-plan-spec"
1
? 0
```

# Test: tbd shortcut lookup works (no cache read)

```console
$ tbd shortcut new-plan-spec | head -3
Agent instructions: You have activated a shortcut with task instructions. If a user has asked you to do a task that requires this work, follow the instructions below carefully.

---
? 0
```

# Test: tbd shortcut --refresh just reports count (no cache write)

```console
$ tbd shortcut --refresh
[..] shortcut(s) available (generated on-the-fly)
? 0
```

* * *

## State File Location

# Test: No cache directory after all commands

After running tbd commands, verify cache/ directory was never created.

```console
$ test ! -d .tbd/cache && echo "No cache directory"
No cache directory
? 0
```
