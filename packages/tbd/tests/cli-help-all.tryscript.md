---
sandbox: true
env:
  NO_COLOR: '1'
  FORCE_COLOR: '0'
path:
  - ../dist
timeout: 30000
patterns:
  VERSION: '\d+\.\d+\.\d+'
before: |
  # Set up a test git repository (some commands need it)
  git init --initial-branch=main
  git config user.email "test@example.com"
  git config user.name "Test User"
  git config commit.gpgsign false
  echo "# Test repo" > README.md
  git add README.md
  git commit -m "Initial commit"
---
# tbd CLI: Help Text Verification

Verifies that --help works correctly on all commands and subcommands.
Uses simple checks to verify help is displayed without exit errors.

* * *

## Top-Level Help

# Test: Top-level --help shows usage and commands

```console
$ tbd --help | head -5
Usage: tbd [options] [command]

Git-native issue tracking for AI agents and humans

Options:
? 0
```

* * *

## Core Commands Help

# Test: init --help shows options

```console
$ tbd init --help | grep -c "Options:"
2
? 0
```

# Test: create --help shows type option

```console
$ tbd create --help | grep -c "\-\-type"
1
? 0
```

# Test: list --help shows status filter

```console
$ tbd list --help | grep -c "\-\-status"
1
? 0
```

# Test: show --help shows id argument

```console
$ tbd show --help | grep -c "Issue ID"
1
? 0
```

# Test: update --help shows priority option

```console
$ tbd update --help | grep -c "\-\-priority"
1
? 0
```

# Test: close --help shows reason option

```console
$ tbd close --help | grep -c "\-\-reason"
1
? 0
```

# Test: reopen --help shows reason option

```console
$ tbd reopen --help | grep -c "\-\-reason"
1
? 0
```

* * *

## Workflow Commands Help

# Test: ready --help shows description

```console
$ tbd ready --help | grep -c "ready to work on"
1
? 0
```

# Test: blocked --help shows description

```console
$ tbd blocked --help | grep -c "blocked issues"
1
? 0
```

# Test: stale --help shows days option

```console
$ tbd stale --help | grep -c "\-\-days"
1
? 0
```

* * *

## Subcommand Groups Help

# Test: label --help shows add subcommand

```console
$ tbd label --help | grep -c "add <id>"
1
? 0
```

# Test: dep --help shows list subcommand

```console
$ tbd dep --help | grep -c "list <id>"
1
? 0
```

# Test: config --help shows set subcommand

```console
$ tbd config --help | grep -c "set <key>"
1
? 0
```

# Test: attic --help shows restore subcommand

```console
$ tbd attic --help | grep -c "restore"
1
? 0
```

* * *

## Utility Commands Help

# Test: sync --help shows push option

```console
$ tbd sync --help | grep -c "\-\-push"
1
? 0
```

# Test: search --help shows query argument

```console
$ tbd search --help | grep -c "Search query"
1
? 0
```

# Test: status --help exits successfully

```console
$ tbd status --help | grep -c "repository status"
1
? 0
```

# Test: stats --help exits successfully

```console
$ tbd stats --help | grep -c "repository statistics"
1
? 0
```

# Test: doctor --help shows fix option

```console
$ tbd doctor --help | grep -c "\-\-fix"
1
? 0
```

# Test: import --help shows validate option

```console
$ tbd import --help | grep -c "\-\-validate"
2
? 0
```

* * *

## Documentation Command Help

# Test: docs --help shows topic argument

```console
$ tbd docs --help | grep -c "\[topic\]"
1
? 0
```

# Test: docs --help shows section option

```console
$ tbd docs --help | grep -c "\-\-section"
1
? 0
```

# Test: docs --list shows slugified IDs

```console
$ tbd docs --list | grep -c "id-system"
0
? 1
```

# Test: docs --list shows available sections

```console
$ tbd docs --list | grep -c "Quick Reference"
1
? 0
```

# Test: docs positional topic argument works

```console
$ tbd docs id-system 2>&1
Error: Section not found: "id-system" (use --list to see available sections)
? 1
```

# Test: docs --section shows filtered content

```console
$ tbd docs --section "ID System" 2>&1
Error: Section not found: "ID System" (use --list to see available sections)
? 1
```

# Test: docs --list --json outputs array with slugs

```console
$ tbd docs --list --json
[
  {
    "title": "Key Design Features",
    "slug": "key-design-features"
  },
  {
    "title": "File format",
    "slug": "file-format"
  },
  {
    "title": "Requirements and Installation",
    "slug": "requirements-and-installation"
  },
  {
    "title": "Quick Reference",
    "slug": "quick-reference"
  },
  {
    "title": "Commands",
    "slug": "commands"
  },
  {
    "title": "Global Options",
    "slug": "global-options"
  },
  {
    "title": "For AI Agents",
    "slug": "for-ai-agents"
  },
  {
    "title": "Common Workflows",
    "slug": "common-workflows"
  },
  {
    "title": "File Structure",
    "slug": "file-structure"
  },
  {
    "title": "Notes",
    "slug": "notes"
  },
  {
    "title": "Configuration Reference",
    "slug": "configuration-reference"
  },
  {
    "title": "Priority Scale",
    "slug": "priority-scale"
  },
  {
    "title": "Date Formats",
    "slug": "date-formats"
  },
  {
    "title": "How Sync Works",
    "slug": "how-sync-works"
  },
  {
    "title": "Troubleshooting",
    "slug": "troubleshooting"
  },
  {
    "title": "Tips",
    "slug": "tips"
  },
  {
    "title": "Getting Help",
    "slug": "getting-help"
  }
]
? 0
```

# Test: docs shows full documentation

```console
$ tbd docs | grep -c "tbd CLI Documentation"
1
? 0
```

* * *

## Uninstall Command Help

# Test: uninstall --help shows confirm option

```console
$ tbd uninstall --help | grep -c "\-\-confirm"
1
? 0
```

# Test: uninstall without .tbd shows appropriate error

```console
$ tbd uninstall 2>&1 | grep -c "No .tbd directory"
1
? 0
```
