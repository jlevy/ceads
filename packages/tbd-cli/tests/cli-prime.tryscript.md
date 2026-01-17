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
---
# tbd CLI: Prime Command

Tests for the `tbd prime` command which outputs workflow context for AI agents.

* * *

## Prime in Uninitialized Directory

# Test: Prime outside tbd project exits silently

When not in a tbd project, prime should exit with code 0 and produce no output.

```console
$ git init --initial-branch=main
Initialized empty Git repository in [..]
? 0
```

```console
$ tbd prime
? 0
```

The command produces no output when not in a tbd project.

```console
$ tbd prime | wc -c | tr -d ' '
0
? 0
```

* * *

## Prime in Initialized Project

# Test: Initialize tbd for remaining tests

```console
$ git config user.email "test@example.com"
? 0
```

```console
$ git config user.name "Test User"
? 0
```

```console
$ echo "# Test repo" > README.md && git add README.md && git commit -m "Initial commit"
[main (root-commit) [..]] Initial commit
 1 file changed, 1 insertion(+)
 create mode 100644 README.md
? 0
```

```console
$ tbd init
✓ Initialized tbd repository

To complete setup, commit the config files:
  git add .tbd/
  git commit -m "Initialize tbd"
? 0
```

# Test: Prime outputs workflow context in initialized project

```console
$ tbd prime | head -5
# tbd Workflow Context

> **Context Recovery**: Run `tbd prime` after compaction, clear, or new session
> Hooks auto-call this in Claude Code when .tbd/ detected

? 0
```

# Test: Prime output contains session close protocol

```console
$ tbd prime | grep -c "SESSION CLOSE PROTOCOL"
1
? 0
```

# Test: Prime output contains core rules

```console
$ tbd prime | grep -c "Core Rules"
1
? 0
```

# Test: Prime output contains essential commands

```console
$ tbd prime | grep -c "Essential Commands"
1
? 0
```

# Test: Prime output contains command reference

```console
$ tbd prime | grep -c "Finding Work"
1
? 0
```

* * *

## Prime with --export Flag

# Test: Prime --export outputs default content

The --export flag outputs the default content, ignoring any custom PRIME.md.

```console
$ tbd prime --export | head -3
# tbd Workflow Context

> **Context Recovery**: Run `tbd prime` after compaction, clear, or new session
? 0
```

* * *

## Prime with Custom PRIME.md Override

# Test: Create custom PRIME.md override

```console
$ echo '# Custom Prime Content' > .tbd/PRIME.md && echo '' >> .tbd/PRIME.md && echo 'This is a custom prime message for this project.' >> .tbd/PRIME.md
? 0
```

# Test: Prime uses custom PRIME.md when present

```console
$ tbd prime | head -1
# Custom Prime Content
? 0
```

# Test: Prime --export ignores custom PRIME.md

```console
$ tbd prime --export | head -3
# tbd Workflow Context

> **Context Recovery**: Run `tbd prime` after compaction, clear, or new session
? 0
```

* * *

## Prime Help

# Test: Prime --help shows options

```console
$ tbd prime --help
Usage: tbd prime [options]

Output workflow context for AI agents

Options:
  --export           Output default content (ignores PRIME.md override)
  -h, --help         display help for command

Global Options:
  --version          Show version number
  --dry-run          Show what would be done without making changes
  --verbose          Enable verbose output
  --quiet            Suppress non-essential output
  --json             Output as JSON
  --color <when>     Colorize output: auto, always, never (default: "auto")
  --non-interactive  Disable all prompts, fail if input required
  --yes              Assume yes to confirmation prompts
  --no-sync          Skip automatic sync after write operations
  --debug            Show internal IDs alongside public IDs for debugging

For more on tbd, see: https://github.com/jlevy/tbd
? 0
```
