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
  TIMESTAMP: "\\d{4}-\\d{2}-\\d{2}T\\d{2}:\\d{2}:\\d{2}(\\.\\d+)?Z"
before: |
  # Set up a test git repository
  git init --initial-branch=main
  git config user.email "test@example.com"
  git config user.name "Test User"
  echo "# Test repo" > README.md
  git add README.md
  git commit -m "Initial commit"
---

# TBD CLI: Color Mode Handling

This tryscript validates that the --color flag is properly recognized and respected.

Note: We test that the option is accepted without error. Actual ANSI code verification
would require a different test approach since tryscript compares text output.

---

## Color Flag Recognition

# Test: --color=never is recognized (no error)

```console
$ tbd --color=never --version
[..]
? 0
```

# Test: --color=always is recognized (no error)

```console
$ tbd --color=always --version
[..]
? 0
```

# Test: --color=auto is recognized (no error)

```console
$ tbd --color=auto --version
[..]
? 0
```

# Test: --color never (space separator) is recognized

```console
$ tbd --color never --version
[..]
? 0
```

---

## Initialize with Color Modes

# Test: Init with --color=never produces clean output

```console
$ tbd --color=never init
[..] Initialized tbd repository

To complete setup, commit the config files:
  git add .tbd/
  git commit -m "Initialize tbd"
? 0
```

---

## Create Issues with Color Modes

# Test: Create with --color=never produces clean output

```console
$ tbd --color=never create "Test issue" -t task
[..] Created bd-[..]: Test issue
? 0
```

# Test: Create with --color=always (output may contain ANSI codes)

```console
$ tbd --color=always create "Another issue" -t bug
[..] Created bd-[..]: Another issue
? 0
```

---

## List Issues with Color Modes

# Test: List with --color=never produces clean output

```console
$ tbd --color=never list
ID[..]PRI[..]STATUS[..]TITLE
bd-[..]2[..]open[..]Test issue
bd-[..]2[..]open[..]Another issue

2 issue(s)
? 0
```

# Test: List JSON ignores color flag (JSON is always colorless)

```console
$ tbd --color=always list --json
[
  {
    "id": "bd-[..]",
    "internalId": "is-[..]",
    "priority": 2,
    "status": "open",
    "kind": "task",
    "title": "Test issue",
    "labels": []
  },
  {
    "id": "bd-[..]",
    "internalId": "is-[..]",
    "priority": 2,
    "status": "open",
    "kind": "bug",
    "title": "Another issue",
    "labels": []
  }
]
? 0
```

---

## Help with Color Modes

# Test: Help with --color=never shows expected content

```console
$ tbd --color=never --help | head -5
Usage: tbd [options] [command]

Git-native issue tracking for AI agents and humans

Options:
? 0
```

# Test: Help with --color=always works without error

```console
$ tbd --color=always --help | head -3
Usage: tbd [options] [command]

Git-native issue tracking for AI agents and humans
? 0
```

---

## NO_COLOR Environment Variable

These tests verify NO_COLOR environment variable is respected.

# Test: NO_COLOR=1 disables colors (baseline for deterministic testing)

```console
$ NO_COLOR=1 tbd list
ID[..]PRI[..]STATUS[..]TITLE
bd-[..]2[..]open[..]Test issue
bd-[..]2[..]open[..]Another issue

2 issue(s)
? 0
```

# Test: --color=always overrides NO_COLOR

This should work - --color=always should force colors even with NO_COLOR set.
(We can't verify ANSI codes in tryscript, but we verify it doesn't error)

```console
$ NO_COLOR=1 tbd --color=always --version
[..]
? 0
```

---

## Error Messages with Color

# Test: Error output with --color=never

```console
$ tbd --color=never show bd-nonexistent 2>&1
[..]Issue not found: bd-nonexistent
? 0
```

# Test: Error output with --color=always (may have ANSI codes)

```console
$ tbd --color=always show bd-nonexistent 2>&1
[..]Issue not found: bd-nonexistent[..]
? 0
```

---

## Invalid Color Option

# Test: Invalid --color value is accepted (Commander passes through)

```console
$ tbd --color=invalid --version 2>&1
[..]
? 0
```
