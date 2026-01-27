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
---
# tbd CLI: Setup Command

Tests for `tbd setup` command options.

* * *

## Setup Help

# Test: Setup --help shows options

```console
$ tbd setup --help
Usage: tbd setup [options]

Configure tbd integration with editors and tools

Options:
  --auto             Non-interactive mode with smart defaults (for
                     agents/scripts)
  --interactive      Interactive mode with prompts (for humans)
  --from-beads       Migrate from Beads to tbd
  --prefix <name>    Project prefix for issue IDs (required for fresh setup)
  --no-gh-cli        Disable automatic GitHub CLI installation hook
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
  npm install -g tbd-git@latest && tbd setup --auto --prefix=<name>

  This initializes tbd and configures your coding agents automatically.
  For interactive setup: tbd setup --interactive
  For manual control: tbd init --help

Orientation:
  For workflow guidance, run: tbd prime

For more on tbd, see: https://github.com/jlevy/tbd
? 0
```

* * *

## Skill File Tests via Doctor

The skill file is project-local, so we can test its detection in the sandbox.

# Test: Skill file not present initially

```console
$ test -f .claude/skills/tbd/SKILL.md || echo "skill file not found"
skill file not found
? 0
```

# Test: Initialize tbd for doctor test

```console
$ tbd init --prefix=test --quiet
? 0
```

# Test: Doctor warns about missing skill

```console
$ tbd doctor 2>&1 | grep -c "Claude Code skill - not installed"
1
? 0
```

# Test: Create skill file manually

Note: We create the skill directory and file manually to test doctor detection.

```console
$ mkdir -p .claude/skills/tbd && echo "---" > .claude/skills/tbd/SKILL.md
? 0
```

# Test: Doctor shows skill file OK after creation

```console
$ tbd doctor 2>/dev/null | grep "Claude Code skill"
✓ Claude Code skill (.claude/skills/tbd/SKILL.md)
? 0
```

# Test: Skill file can be removed

```console
$ rm -rf .claude/skills/tbd
? 0
```

# Test: Doctor warns again after removal

```console
$ tbd doctor 2>&1 | grep -c "Claude Code skill - not installed"
1
? 0
```
