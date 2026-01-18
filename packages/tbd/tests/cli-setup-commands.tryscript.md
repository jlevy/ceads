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
  echo "# Test repo" > README.md
  git add README.md
  git commit -m "Initial commit"
---
# tbd CLI: Setup Commands

Tests for `tbd setup` subcommands that configure editor integrations.

* * *

## Setup Help

# Test: Setup --help shows subcommands

```console
$ tbd setup --help
Usage: tbd setup [options] [command]

Configure tbd integration with editors and tools

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

Commands:
  auto               Auto-detect and configure integrations (Claude, Cursor,
                     Codex)
  claude [options]   Configure Claude Code (skill and hooks)
  cursor [options]   Configure Cursor IDE (rules file)
  codex [options]    Configure Codex and compatible tools (AGENTS.md)
  beads [options]    Disable Beads so you only use tbd
  help [command]     display help for command

For more on tbd, see: https://github.com/jlevy/tbd
? 0
```

# Test: Setup claude --help shows options

```console
$ tbd setup claude --help
Usage: tbd setup claude [options]

Configure Claude Code (skill and hooks)

Options:
  --check            Verify installation status
  --remove           Remove tbd hooks
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

# Test: Setup cursor --help shows options

```console
$ tbd setup cursor --help
Usage: tbd setup cursor [options]

Configure Cursor IDE (rules file)

Options:
  --check            Verify installation status
  --remove           Remove tbd rules file
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

# Test: Setup codex --help shows options

```console
$ tbd setup codex --help
Usage: tbd setup codex [options]

Configure Codex and compatible tools (AGENTS.md)

Options:
  --check            Verify installation status
  --remove           Remove tbd section from AGENTS.md
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

* * *

## Setup Cursor

# Test: Cursor --check when not installed

```console
$ tbd setup cursor --check --verbose
⚠ Cursor rules file - not found (.cursor/rules/tbd.mdc)
    Run: tbd setup cursor
? 0
```

# Test: Cursor setup creates rules file

```console
$ tbd setup cursor
✓ Created Cursor rules file[..]
? 0
```

# Test: Verify cursor rules file exists

```console
$ test -f .cursor/rules/tbd.mdc && echo "rules file exists"
rules file exists
? 0
```

# Test: Cursor rules file contains workflow instructions

```console
$ grep -c "SESSION CLOSING PROTOCOL" .cursor/rules/tbd.mdc
1
? 0
```

# Test: Cursor rules file contains tbd commands

```console
$ grep -c "tbd ready" .cursor/rules/tbd.mdc
3
? 0
```

# Test: Cursor --check after installation

```console
$ tbd setup cursor --check
✓ Cursor rules file (.cursor/rules/tbd.mdc)
? 0
```

# Test: Cursor --check JSON output

```console
$ tbd setup cursor --check --json
{
  "installed": true,
  "path": "[..].cursor/rules/tbd.mdc"
}
? 0
```

# Test: Cursor --remove removes rules file

```console
$ tbd setup cursor --remove
✓ Removed Cursor tbd rules file
? 0
```

# Test: Verify cursor rules file removed

```console
$ test -f .cursor/rules/tbd.mdc || echo "rules file removed"
rules file removed
? 0
```

# Test: Cursor --remove when not installed

```console
$ tbd setup cursor --remove --verbose
Cursor rules file not found
? 0
```

* * *

## Setup Codex

# Test: Codex --check when not installed

```console
$ tbd setup codex --check --verbose
⚠ AGENTS.md - not found (./AGENTS.md)
    Run: tbd setup codex
? 0
```

# Test: Codex setup creates AGENTS.md

```console
$ tbd setup codex
✓ Created new AGENTS.md with tbd integration[..]
? 0
```

# Test: Verify AGENTS.md exists

```console
$ test -f AGENTS.md && echo "AGENTS.md exists"
AGENTS.md exists
? 0
```

# Test: AGENTS.md contains tbd markers

```console
$ grep -c "BEGIN TBD INTEGRATION" AGENTS.md
1
? 0
```

# Test: AGENTS.md contains tbd workflow

```console
$ grep -c "tbd ready" AGENTS.md
3
? 0
```

# Test: Codex --check after installation

```console
$ tbd setup codex --check
✓ AGENTS.md - tbd section found (./AGENTS.md)
? 0
```

# Test: Codex --check JSON output

```console
$ tbd setup codex --check --json
{
  "installed": true,
  "path": "[..]AGENTS.md",
  "hastbdSection": true
}
? 0
```

# Test: Codex setup on existing file updates section

```console
$ tbd setup codex
✓ Updated existing tbd section in AGENTS.md[..]
? 0
```

# Test: Codex --remove removes tbd section

```console
$ tbd setup codex --remove
✓ Removed tbd section from AGENTS.md
? 0
```

# Test: Verify tbd section removed but file still exists (has scaffold)

```console
$ test -f AGENTS.md && echo "file exists"
file exists
? 0
```

```console
$ grep "BEGIN TBD INTEGRATION" AGENTS.md || echo "tbd section removed"
tbd section removed
? 0
```

* * *

## Codex with Existing Content

# Test: Create AGENTS.md with existing content

```console
$ echo '# My Project' > AGENTS.md && echo '' >> AGENTS.md && echo 'This is my custom content.' >> AGENTS.md
? 0
```

# Test: Codex --check shows no tbd section

```console
$ tbd setup codex --check --verbose
⚠ AGENTS.md - exists but no tbd section (./AGENTS.md)
    Run: tbd setup codex
? 0
```

# Test: Codex adds section to existing file

```console
$ tbd setup codex
✓ Added tbd section to existing AGENTS.md[..]
? 0
```

# Test: Verify original content preserved

```console
$ head -1 AGENTS.md
# My Project
? 0
```

# Test: Verify tbd section added

```console
$ grep -c "BEGIN TBD INTEGRATION" AGENTS.md
1
? 0
```

# Test: Codex --remove preserves non-tbd content

```console
$ tbd setup codex --remove
✓ Removed tbd section from AGENTS.md
? 0
```

# Test: Verify custom content preserved after remove

```console
$ head -1 AGENTS.md
# My Project
? 0
```

```console
$ grep -c "custom content" AGENTS.md
1
? 0
```

* * *

## Setup Claude (Check, Dry-Run, and Skill File)

**SAFETY NOTE**: Full claude setup tests are intentionally limited because
`tbd setup claude` modifies the global ~/.claude/settings.json file.

We test safe operations:
- `--check` - Read-only verification of installation status
- `--dry-run` - Shows what would happen without making changes

DO NOT add tests that actually install claude hooks without proper sandboxing.
A future improvement would be to add a `--config-dir` option to override the config
location for testing purposes.
See: https://github.com/jlevy/tbd/issues/TBD

# Test: Claude --check exits successfully

The check command should always exit with code 0, regardless of installation status.
Use --verbose to show status messages.

```console
$ tbd setup claude --check --verbose
...
? 0
```

# Test: Claude dry-run shows what would happen

```console
$ tbd setup claude --dry-run
[DRY-RUN] Would install Claude Code hooks and skill file
? 0
```

* * *

## Skill File Installation

The skill file is project-local, so we can safely test installation in the sandbox.

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

# Test: Create skill file manually (simulating setup claude without global hooks)

Note: We can’t run full `tbd setup claude` because it modifies global settings.
Instead, we create the skill directory and file manually to test doctor detection.

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
