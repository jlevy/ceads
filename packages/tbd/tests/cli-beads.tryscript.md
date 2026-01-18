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

  # Create mock Beads installation (.beads/)
  mkdir -p .beads
  cat > .beads/config.yaml << 'EOF'
  # Beads Configuration File
  no-db: true
  sync-branch: 'beads-sync'
  EOF
  echo '{"id":"bd-1","title":"Test issue","status":"open"}' > .beads/issues.jsonl
  touch .beads/beads.db
  touch .beads/daemon.log

  # Create mock .beads-hooks/
  mkdir -p .beads-hooks
  cat > .beads-hooks/pre-commit << 'EOF'
  #!/bin/bash
  # Beads pre-commit hook
  bd flush
  EOF
  chmod +x .beads-hooks/pre-commit

  # Create mock .cursor/rules/beads.mdc
  mkdir -p .cursor/rules
  cat > .cursor/rules/beads.mdc << 'EOF'
  # Beads Issue Tracker Integration
  Use bd commands for issue tracking.
  EOF

  # Create mock .claude/settings.local.json with bd hooks
  mkdir -p .claude
  cat > .claude/settings.local.json << 'EOF'
  {
    "hooks": {
      "SessionStart": [
        {
          "matcher": "",
          "hooks": [
            { "type": "command", "command": "bd prime" }
          ]
        }
      ],
      "PreCompact": [
        {
          "matcher": "",
          "hooks": [
            { "type": "command", "command": "bd prime" }
          ]
        }
      ]
    }
  }
  EOF

  # Create mock AGENTS.md with Beads section
  cat > AGENTS.md << 'EOF'
  # Project Instructions

  Some custom content here.

  <!-- BEGIN BEADS INTEGRATION -->
  ## Beads Issue Tracking

  Use bd commands.
  <!-- END BEADS INTEGRATION -->

  More content below.
  EOF

  # Create mock .gitattributes with beads merge driver
  printf '%s\n' '*.md text eol=lf' '*.ts text eol=lf' '.beads/issues.jsonl merge=beads' '*.png binary' > .gitattributes
---
# tbd CLI: Beads Migration Command

Tests for `tbd setup beads --disable` which helps migrate from Beads to tbd.

* * *

## Setup Beads Help

# Test: Setup beads without --disable shows usage

```console
$ tbd setup beads
Usage: tbd setup beads --disable [--confirm]

Options:
  --disable   Disable Beads and move files to .beads-disabled/
  --confirm   Confirm the operation (required to proceed)

This command helps migrate from Beads to tbd by safely
moving Beads configuration files to a backup directory.
? 0
```

# Test: Setup beads --help shows options

```console
$ tbd setup beads --help
Usage: tbd setup beads [options]

Disable Beads so you only use tbd

Options:
  --disable          Disable Beads and move files to .beads-disabled/
  --confirm          Confirm the operation (required to proceed)
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

## Verify Fixtures Setup

# Test: .beads directory exists

```console
$ test -d .beads && echo ".beads exists"
.beads exists
? 0
```

# Test: .beads-hooks directory exists

```console
$ test -d .beads-hooks && echo ".beads-hooks exists"
.beads-hooks exists
? 0
```

# Test: .cursor/rules/beads.mdc exists

```console
$ test -f .cursor/rules/beads.mdc && echo "beads.mdc exists"
beads.mdc exists
? 0
```

# Test: .claude/settings.local.json has bd hooks

```console
$ grep -c "bd prime" .claude/settings.local.json
2
? 0
```

# Test: AGENTS.md has Beads section

```console
$ grep -c "BEGIN BEADS INTEGRATION" AGENTS.md
1
? 0
```

# Test: .gitattributes has beads merge driver

```console
$ grep -c "merge=beads" .gitattributes
1
? 0
```

* * *

## Setup Beads --disable Preview Mode

# Test: Setup beads --disable shows preview without changes

```console
$ tbd setup beads --disable
The following Beads files will be moved to .beads-disabled/:

  .beads/ → .beads-disabled/.beads/ [..]
    Beads data directory
  .beads-hooks/ → .beads-disabled/.beads-hooks/ [..]
    Beads git hooks
  .cursor/rules/beads.mdc → .beads-disabled/.cursor/rules/beads.mdc
    Cursor IDE Beads rules
  .claude/settings.local.json → .beads-disabled/.claude/settings.local.json [..]
    Claude Code project hooks with bd commands
  AGENTS.md → .beads-disabled/AGENTS.md [..]
    AGENTS.md with Beads section
  .gitattributes → .beads-disabled/.gitattributes [..]
    .gitattributes with Beads merge driver

This preserves all Beads data for potential rollback.

To confirm, run: tbd setup beads --disable --confirm

After disabling Beads, run:
  tbd setup claude   # Install tbd hooks
  tbd setup cursor   # Install tbd Cursor rules (optional)
  tbd setup codex    # Update AGENTS.md for tbd (optional)
? 0
```

# Test: Files still exist after preview

```console
$ test -d .beads && echo ".beads still exists"
.beads still exists
? 0
```

```console
$ test -d .beads-hooks && echo ".beads-hooks still exists"
.beads-hooks still exists
? 0
```

```console
$ test -f .cursor/rules/beads.mdc && echo "beads.mdc still exists"
beads.mdc still exists
? 0
```

# Test: .beads-disabled not created in preview mode

```console
$ test -d .beads-disabled || echo "no .beads-disabled yet"
no .beads-disabled yet
? 0
```

* * *

## Setup Beads --disable --confirm Execution

# Test: Setup beads --disable --confirm moves files

```console
$ tbd setup beads --disable --confirm
The following Beads files will be moved to .beads-disabled/:

  .beads/ → .beads-disabled/.beads/ [..]
    Beads data directory
  .beads-hooks/ → .beads-disabled/.beads-hooks/ [..]
    Beads git hooks
  .cursor/rules/beads.mdc → .beads-disabled/.cursor/rules/beads.mdc
    Cursor IDE Beads rules
  .claude/settings.local.json → .beads-disabled/.claude/settings.local.json [..]
    Claude Code project hooks with bd commands
  AGENTS.md → .beads-disabled/AGENTS.md [..]
    AGENTS.md with Beads section
  .gitattributes → .beads-disabled/.gitattributes [..]
    .gitattributes with Beads merge driver

  [..]daemon[..]
  ✓ Moved .beads/
  ✓ Moved .beads-hooks/
  ✓ Moved .cursor/rules/beads.mdc
  ✓ Backed up and removed bd hooks from .claude/settings.local.json
  ✓ Backed up and removed Beads section from AGENTS.md
  ✓ Backed up and removed beads lines from .gitattributes
  ✓ Created RESTORE.md with rollback instructions

✓ Beads has been disabled.

All Beads files have been moved to .beads-disabled/
See .beads-disabled/RESTORE.md for rollback instructions.

Next steps:
  tbd setup claude   # Install tbd hooks
  tbd setup cursor   # Install tbd Cursor rules (optional)
  tbd setup codex    # Update AGENTS.md for tbd (optional)
? 0
```

* * *

## Verify Files Moved

# Test: .beads directory removed

```console
$ test -d .beads || echo ".beads removed"
.beads removed
? 0
```

# Test: .beads-hooks directory removed

```console
$ test -d .beads-hooks || echo ".beads-hooks removed"
.beads-hooks removed
? 0
```

# Test: .cursor/rules/beads.mdc removed

```console
$ test -f .cursor/rules/beads.mdc || echo "beads.mdc removed"
beads.mdc removed
? 0
```

# Test: .beads-disabled directory created

```console
$ test -d .beads-disabled && echo ".beads-disabled created"
.beads-disabled created
? 0
```

# Test: .beads moved to .beads-disabled/.beads

```console
$ test -d .beads-disabled/.beads && echo "beads dir moved"
beads dir moved
? 0
```

# Test: .beads-disabled/.beads contains config

```console
$ test -f .beads-disabled/.beads/config.yaml && echo "config preserved"
config preserved
? 0
```

# Test: .beads-hooks moved to .beads-disabled/.beads-hooks

```console
$ test -d .beads-disabled/.beads-hooks && echo "beads-hooks moved"
beads-hooks moved
? 0
```

# Test: Cursor rules backed up

```console
$ test -f .beads-disabled/.cursor/rules/beads.mdc && echo "cursor rules backed up"
cursor rules backed up
? 0
```

# Test: Claude settings backed up

```console
$ test -f .beads-disabled/.claude/settings.local.json && echo "claude settings backed up"
claude settings backed up
? 0
```

# Test: AGENTS.md backed up

```console
$ test -f .beads-disabled/AGENTS.md && echo "AGENTS.md backed up"
AGENTS.md backed up
? 0
```

# Test: RESTORE.md created

```console
$ test -f .beads-disabled/RESTORE.md && echo "RESTORE.md created"
RESTORE.md created
? 0
```

# Test: RESTORE.md contains restore instructions

```console
$ grep -c "To Restore Beads" .beads-disabled/RESTORE.md
1
? 0
```

# Test: RESTORE.md contains restore commands

```console
$ grep -c "mv .beads-disabled/.beads/ .beads/" .beads-disabled/RESTORE.md
1
? 0
```

# Test: .gitattributes backed up

```console
$ test -f .beads-disabled/.gitattributes && echo "gitattributes backed up"
gitattributes backed up
? 0
```

# Test: Backup contains original beads line

```console
$ grep -c "merge=beads" .beads-disabled/.gitattributes
1
? 0
```

* * *

## Verify Settings Modified Correctly

# Test: .claude/settings.local.json no longer has bd hooks

```console
$ grep "bd prime" .claude/settings.local.json || echo "bd hooks removed"
bd hooks removed
? 0
```

# Test: .claude/settings.local.json still exists (may be empty or have other content)

```console
$ test -f .claude/settings.local.json && echo "claude settings still exists"
claude settings still exists
? 0
```

# Test: AGENTS.md no longer has Beads section

```console
$ grep "BEGIN BEADS INTEGRATION" AGENTS.md || echo "beads section removed"
beads section removed
? 0
```

# Test: AGENTS.md preserves other content

```console
$ grep -c "custom content" AGENTS.md
1
? 0
```

# Test: AGENTS.md preserves content below section

```console
$ grep -c "More content below" AGENTS.md
1
? 0
```

# Test: .gitattributes no longer has beads merge driver

```console
$ grep "merge=beads" .gitattributes || echo "beads merge driver removed"
beads merge driver removed
? 0
```

# Test: .gitattributes still exists

```console
$ test -f .gitattributes && echo "gitattributes still exists"
gitattributes still exists
? 0
```

# Test: .gitattributes preserves other rules

```console
$ grep -c "*.md text eol=lf" .gitattributes
1
? 0
```

# Test: .gitattributes preserves binary rule

```console
$ grep -c "*.png binary" .gitattributes
1
? 0
```

* * *

## Setup Beads When Already Disabled

# Test: Running setup beads --disable again shows nothing to do

```console
$ tbd setup beads --disable --verbose
No Beads files found to disable.
? 0
```

* * *

## Partial Beads Installation

Test with only some Beads files present.

# Test: Clean up from previous test

```console
$ rm -rf .beads-disabled
? 0
```

# Test: Create only .beads directory

```console
$ mkdir -p .beads && echo "test" > .beads/config.yaml
? 0
```

# Test: Setup beads --disable with only .beads/

```console
$ tbd setup beads --disable
The following Beads files will be moved to .beads-disabled/:

  .beads/ → .beads-disabled/.beads/ [..]
    Beads data directory

This preserves all Beads data for potential rollback.

To confirm, run: tbd setup beads --disable --confirm

After disabling Beads, run:
  tbd setup claude   # Install tbd hooks
  tbd setup cursor   # Install tbd Cursor rules (optional)
  tbd setup codex    # Update AGENTS.md for tbd (optional)
? 0
```

# Test: Confirm partial disable

```console
$ tbd setup beads --disable --confirm | grep "has been disabled"
✓ Beads has been disabled.
? 0
```

# Test: .beads was moved

```console
$ test -d .beads || echo ".beads removed"
.beads removed
? 0
```

# Test: .beads-disabled/.beads was created

```console
$ test -d .beads-disabled/.beads && echo ".beads-disabled/.beads created"
.beads-disabled/.beads created
? 0
```

* * *

## tbd prime Beads Warning

Test that `tbd prime` warns when .beads/ exists alongside .tbd/

# Test: Clean up for prime test

```console
$ rm -rf .beads .beads-disabled
? 0
```

# Test: Initialize tbd

```console
$ tbd init --prefix=test --quiet
? 0
```

# Test: tbd prime without .beads shows no warning

```console
$ tbd prime | grep "A .beads/ directory was detected" || echo "no warning"
no warning
? 0
```

# Test: Create .beads directory

```console
$ mkdir -p .beads && echo "test" > .beads/config.yaml
? 0
```

# Test: tbd prime with .beads shows warning

```console
$ tbd prime | head -5
⚠️  WARNING: A .beads/ directory was detected alongside .tbd/
   When asked to use beads, use `tbd` commands, NOT `bd` commands.
   To complete migration: tbd setup beads --disable --confirm

# tbd Workflow Context
? 0
```

# Test: After disabling beads, warning disappears

```console
$ tbd setup beads --disable --confirm | grep "has been disabled"
✓ Beads has been disabled.
? 0
```

```console
$ tbd prime | grep "A .beads/ directory was detected" || echo "no warning"
no warning
? 0
```
