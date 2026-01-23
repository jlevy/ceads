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
  # Initialize tbd with test prefix
  tbd init --prefix=test
  # Create test issues with varied content for search
  tbd create "Authentication bug in login" --type=bug --description="Users cannot log in with SSO" --label=security --label=urgent
  tbd create "Add dark mode feature" --type=feature --description="Support dark theme toggle" --label=frontend --label=ux
  tbd create "Update dependencies" --type=chore --label=maintenance
  tbd create "Performance optimization" --type=task --description="Improve API response times" --label=backend
  tbd create "Login redirect issue" --type=bug --description="OAuth redirects fail" --label=security
---
# tbd CLI: Advanced Commands

Tests for search, sync, doctor, config, attic, and stats commands.

* * *

## Search Command

# Test: Search by keyword in title

```console
$ tbd search "login"
...
? 0
```

# Test: Search as JSON

```console
$ tbd search "login" --json
[
...
]
? 0
```

# Test: Search finds multiple matches

```console
$ tbd search "login" --json | node -e "d=JSON.parse(require('fs').readFileSync(0,'utf8')); console.log('matches:', d.length)"
matches: 2
? 0
```

# Test: Search with status filter

```console
$ tbd search "bug" --status=open
...
? 0
```

# Test: Search in title field only

```console
$ tbd search "SSO" --field=title --json | node -e "d=JSON.parse(require('fs').readFileSync(0,'utf8')); console.log('title matches:', d.length)"
title matches: 0
? 0
```

# Test: Search in description field

```console
$ tbd search "SSO" --field=description --json | node -e "d=JSON.parse(require('fs').readFileSync(0,'utf8')); console.log('desc matches:', d.length)"
desc matches: 1
? 0
```

# Test: Search in labels field

```console
$ tbd search "security" --field=labels --json | node -e "d=JSON.parse(require('fs').readFileSync(0,'utf8')); console.log('label matches:', d.length)"
label matches: 2
? 0
```

# Test: Search with limit

```console
$ tbd search "e" --limit=2 --json | node -e "d=JSON.parse(require('fs').readFileSync(0,'utf8')); console.log('limited to:', d.length)"
limited to: 2
? 0
```

# Test: Search case insensitive (default)

```console
$ tbd search "LOGIN" --json | node -e "d=JSON.parse(require('fs').readFileSync(0,'utf8')); console.log('case insensitive matches:', d.length)"
case insensitive matches: 2
? 0
```

# Test: Search case sensitive

```console
$ tbd search "LOGIN" --case-sensitive --json | node -e "d=JSON.parse(require('fs').readFileSync(0,'utf8')); console.log('case sensitive matches:', d.length)"
case sensitive matches: 0
? 0
```

# Test: Search no results

```console
$ tbd search "nonexistentxyz123" --json
[]
? 0
```

* * *

## Stats Command

# Test: Stats shows summary

```console
$ tbd stats
Summary:
  Ready:       5
  In progress: 0
  Blocked:     0
  Open:        5
  Total:       5

By status:
  open           5

By kind:
  bug            2
  feature        1
  task           1
  chore          1

By priority:
  P2 (Medium  ) 5

Use 'tbd status' for setup info, 'tbd doctor' for health checks.
? 0
```

# Test: Stats as JSON

```console
$ tbd stats --json
{
  "total": 5,
  "ready": 5,
  "blocked": 0,
  "byStatus": {
    "open": 5,
    "in_progress": 0,
    "blocked": 0,
    "deferred": 0,
    "closed": 0
  },
  "byKind": {
    "bug": 2,
    "feature": 1,
    "task": 1,
    "epic": 0,
    "chore": 1
  },
  "byPriority": {
    "0": 0,
    "1": 0,
    "2": 5,
    "3": 0,
    "4": 0
  }
}
? 0
```

# Test: Stats counts are accurate

```console
$ tbd stats --json | node -e "d=JSON.parse(require('fs').readFileSync(0,'utf8')); console.log('total:', d.total)"
total: 5
? 0
```

# Test: Stats by kind

```console
$ tbd stats --json | node -e "d=JSON.parse(require('fs').readFileSync(0,'utf8')); console.log('bugs:', d.byKind.bug)"
bugs: 2
? 0
```

* * *

## Doctor Command

# Test: Doctor runs health checks

```console
$ tbd doctor
...
? 0
```

# Test: Doctor as JSON

```console
$ tbd doctor --json
{
...
}
? 0
```

# Test: Doctor reports no issues on healthy repo

```console
$ tbd doctor --json | node -e "d=JSON.parse(require('fs').readFileSync(0,'utf8')); console.log('issues:', d.issues?.length ?? 0)"
issues: 0
? 0
```

# Test: Doctor with fix flag (no-op on healthy)

```console
$ tbd doctor --fix
...
? 0
```

* * *

## Config Command

# Test: Config show

```console
$ tbd config show
tbd_version: [..]
sync:
  branch: tbd-sync
  remote: origin
display:
  id_prefix: test
settings:
  auto_sync: false
? 0
```

# Test: Config show as JSON

```console
$ tbd config show --json
{
  "tbd_version": [..],
  "sync": {
    "branch": "tbd-sync",
    "remote": "origin"
  },
  "display": {
    "id_prefix": "test"
  },
  "settings": {
    "auto_sync": false
  }
}
? 0
```

# Test: Config get specific value

```console
$ tbd config get sync.branch
tbd-sync
? 0
```

# Test: Config get nested value

```console
$ tbd config get display.id_prefix
test
? 0
```

# Test: Config get as JSON

```console
$ tbd config get sync.branch --json
{
  "key": "sync.branch",
  "value": "tbd-sync"
}
? 0
```

# Test: Config set value

```console
$ tbd config set display.id_prefix td
✓ Set display.id_prefix = td
? 0
```

# Test: Verify config set

```console
$ tbd config get display.id_prefix
td
? 0
```

# Test: Config set boolean

```console
$ tbd config set settings.auto_sync true
✓ Set settings.auto_sync = true
? 0
```

# Test: Verify boolean set

```console
$ tbd config get settings.auto_sync --json
{
  "key": "settings.auto_sync",
  "value": true
}
? 0
```

# Test: Config get non-existent key

```console
$ tbd config get nonexistent.key 2>&1
Error: Unknown key: nonexistent.key
? 2
```

* * *

## Sync Command

**Note:** Comprehensive sync tests are in `cli-sync.tryscript.md`. This section only
covers basic smoke tests.

# Test: Sync status works

```console
$ tbd sync --status
...
? 0
```

# Test: Sync status as JSON

```console
$ tbd sync --status --json
{
...
}
? 0
```

* * *

## Attic Command

The attic stores conflict losers.
On a fresh repo, it should be empty.

# Test: Attic list (empty)

```console
$ tbd attic list
...
? 0
```

# Test: Attic list as JSON

```console
$ tbd attic list --json
...
? 0
```

# Test: Attic list for specific issue

```console
$ tbd attic list is-01hx5zzkbkactav9wevgemmvrz --json
...
? 0
```

# Test: Attic show non-existent

```console
$ tbd attic show is-00000000000000000000000000 2025-01-01T00:00:00Z 2>&1
Error: Attic entry not found[..]
? 1
```

* * *

## Global Flags

# Test: --quiet suppresses output

```console
$ tbd create "Quiet test" --quiet
? 0
```

# Test: --verbose shows extra info

```console
$ tbd list --verbose
...
? 0
```

# Test: --non-interactive mode

```console
$ tbd create "Non-interactive" --non-interactive
✓ Created [..]
? 0
```

* * *

## Help for Subcommands

# Test: Help for label subcommand

```console
$ tbd label --help
Usage: tbd label [options] [command]

Manage issue labels

Options:
  -h, --help               display help for command

Global Options:
  --version                Show version number
  --dry-run                Show what would be done without making changes
  --verbose                Enable verbose output
  --quiet                  Suppress non-essential output
  --json                   Output as JSON
  --color <when>           Colorize output: auto, always, never (default:
                           "auto")
  --non-interactive        Disable all prompts, fail if input required
  --yes                    Assume yes to confirmation prompts
  --no-sync                Skip automatic sync after write operations
  --debug                  Show internal IDs alongside public IDs for debugging

Commands:
  add <id> <labels...>     Add labels to an issue
  remove <id> <labels...>  Remove labels from an issue
  list                     List all labels in use
  help [command]           display help for command

Getting Started:
  npm install -g tbd-git@latest && tbd setup --auto

  This initializes tbd and configures your coding agents automatically.
  For interactive setup: tbd setup --interactive
  For manual control: tbd init --help

For more on tbd, see: https://github.com/jlevy/tbd
? 0
```

# Test: Help for dep subcommand

```console
$ tbd dep --help
Usage: tbd dep [options] [command]

Manage issue dependencies

Options:
  -h, --help                   display help for command

Global Options:
  --version                    Show version number
  --dry-run                    Show what would be done without making changes
  --verbose                    Enable verbose output
  --quiet                      Suppress non-essential output
  --json                       Output as JSON
  --color <when>               Colorize output: auto, always, never (default:
                               "auto")
  --non-interactive            Disable all prompts, fail if input required
  --yes                        Assume yes to confirmation prompts
  --no-sync                    Skip automatic sync after write operations
  --debug                      Show internal IDs alongside public IDs for
                               debugging

Commands:
  add <issue> <depends-on>     Add dependency (issue depends on depends-on)
  remove <issue> <depends-on>  Remove dependency (issue no longer depends on
                               depends-on)
  list <id>                    List dependencies for an issue
  help [command]               display help for command

Getting Started:
  npm install -g tbd-git@latest && tbd setup --auto

  This initializes tbd and configures your coding agents automatically.
  For interactive setup: tbd setup --interactive
  For manual control: tbd init --help

For more on tbd, see: https://github.com/jlevy/tbd
? 0
```

# Test: Help for config subcommand

```console
$ tbd config --help
Usage: tbd config [options] [command]

Manage configuration

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
  show               Show all configuration
  set <key> <value>  Set a configuration value
  get <key>          Get a configuration value
  help [command]     display help for command

Getting Started:
  npm install -g tbd-git@latest && tbd setup --auto

  This initializes tbd and configures your coding agents automatically.
  For interactive setup: tbd setup --interactive
  For manual control: tbd init --help

For more on tbd, see: https://github.com/jlevy/tbd
? 0
```

# Test: Help for attic subcommand

```console
$ tbd attic --help
Usage: tbd attic [options] [command]

Manage conflict archive (attic)

Options:
  -h, --help                display help for command

Global Options:
  --version                 Show version number
  --dry-run                 Show what would be done without making changes
  --verbose                 Enable verbose output
  --quiet                   Suppress non-essential output
  --json                    Output as JSON
  --color <when>            Colorize output: auto, always, never (default:
                            "auto")
  --non-interactive         Disable all prompts, fail if input required
  --yes                     Assume yes to confirmation prompts
  --no-sync                 Skip automatic sync after write operations
  --debug                   Show internal IDs alongside public IDs for debugging

Commands:
  list [options] [id]       List attic entries
  show <id> <timestamp>     Show attic entry details
  restore <id> <timestamp>  Restore lost value from attic
  help [command]            display help for command

Getting Started:
  npm install -g tbd-git@latest && tbd setup --auto

  This initializes tbd and configures your coding agents automatically.
  For interactive setup: tbd setup --interactive
  For manual control: tbd init --help

For more on tbd, see: https://github.com/jlevy/tbd
? 0
```
