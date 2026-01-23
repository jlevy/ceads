---
sandbox: true
env:
  NO_COLOR: '1'
  FORCE_COLOR: '0'
path:
  - ../dist
timeout: 30000
---
# tbd CLI: Close Protocol Command

Tests for the `tbd closing` command which displays the session close checklist.

* * *

## Close Protocol Output

# Test: Close protocol outputs checklist header

```console
$ tbd closing | head -1
# Session Closing Protocol
? 0
```

# Test: Close protocol contains CRITICAL warning

```console
$ tbd closing | grep -c "CRITICAL"
1
? 0
```

# Test: Close protocol contains all 7 checklist steps

```console
$ tbd closing | grep -c "^\[ \]"
7
? 0
```

# Test: Close protocol contains git commit step

```console
$ tbd closing | grep -c "git add"
1
? 0
```

# Test: Close protocol contains git push step

```console
$ tbd closing | grep -c "git push"
1
? 0
```

# Test: Close protocol contains CI check step

```console
$ tbd closing | grep -c "gh pr checks"
1
? 0
```

# Test: Close protocol contains tbd update step

```console
$ tbd closing | grep -c "tbd close/update"
1
? 0
```

# Test: Close protocol contains tbd sync step

```console
$ tbd closing | grep -c "tbd sync"
2
? 0
```

# Test: Close protocol contains tip about command

```console
$ tbd closing | grep -c "tbd closing"
1
? 0
```

* * *

## Close Protocol Help

# Test: Close protocol --help shows description

```console
$ tbd closing --help
Usage: tbd closing [options]

Display the session closing protocol reminder

Options:
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

Getting Started:
  npm install -g tbd-git@latest && tbd setup --auto

  This initializes tbd and configures your coding agents automatically.
  For interactive setup: tbd setup --interactive
  For manual control: tbd init --help

For more on tbd, see: https://github.com/jlevy/tbd
? 0
```
