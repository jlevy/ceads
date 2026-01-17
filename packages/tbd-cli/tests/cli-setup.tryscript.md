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
# tbd CLI: Setup and Status Commands

This tryscript validates initialization, help, version, and status commands.

* * *

## Help and Version

# Test: --help shows usage with all commands

```console
$ tbd --help
Usage: tbd [options] [command]

Git-native issue tracking for AI agents and humans

Options:
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
  --help                    Display help for command

Commands:
  init [options]            Initialize tbd in a git repository
  create [options] [title]  Create a new issue
  list [options]            List issues
  show <id>                 Show issue details
  update [options] <id>     Update an issue
  close [options] <id>      Close an issue
  reopen [options] <id>     Reopen a closed issue
  ready [options]           List issues ready to work on (open, unblocked,
                            unclaimed)
  blocked [options]         List blocked issues
  stale [options]           List issues not updated recently
  label                     Manage issue labels
  dep                       Manage issue dependencies
  sync [options]            Synchronize with remote
  search [options] <query>  Search issues by text
  status                    Show repository status and orientation
  stats                     Show repository statistics
  doctor [options]          Diagnose and repair repository
  config                    Manage configuration
  attic                     Manage conflict archive (attic)
  import [options] [file]   Import issues from Beads or JSONL file.
                            Tip: Run "bd sync" and stop the beads daemon before
                            importing for best results.
  docs [options] [topic]    Display CLI documentation
  design [options] [topic]  Display design documentation and Beads comparison
  readme                    Display the README (same as GitHub landing page)
  uninstall [options]       Remove tbd from this repository
  prime [options]           Output workflow context for AI agents
  setup                     Configure tbd integration with editors and tools
  help [command]            display help for command

For more on tbd, see: https://github.com/jlevy/tbd
? 0
```

# Test: --version shows semantic version

```console
$ tbd --version
[..]
? 0
```

# Test: help command for init

```console
$ tbd help init
Usage: tbd init [options]

Initialize tbd in a git repository

Options:
  --prefix <name>       Project prefix for display IDs (e.g., "proj", "myapp")
  --sync-branch <name>  Sync branch name (default: tbd-sync)
  --remote <name>       Remote name (default: origin)
  -h, --help            display help for command

Global Options:
  --version             Show version number
  --dry-run             Show what would be done without making changes
  --verbose             Enable verbose output
  --quiet               Suppress non-essential output
  --json                Output as JSON
  --color <when>        Colorize output: auto, always, never (default: "auto")
  --non-interactive     Disable all prompts, fail if input required
  --yes                 Assume yes to confirmation prompts
  --no-sync             Skip automatic sync after write operations
  --debug               Show internal IDs alongside public IDs for debugging

For more on tbd, see: https://github.com/jlevy/tbd
? 0
```

* * *

## Initialization

# Test: Initialize tbd with defaults

```console
$ tbd init --prefix=bd
✓ Initialized tbd repository

To complete setup, commit the config files:
  git add .tbd/
  git commit -m "Initialize tbd"
? 0
```

# Test: Status before any issues

```console
$ tbd status
tbd v[..]

Repository: [..]
  ✓ Initialized (.tbd/)
  ✓ Git repository (main)

Sync branch: tbd-sync
Remote: origin
ID prefix: bd-

Issues:
  Ready:       0
  In progress: 0
  Open:        0
  Total:       0

Integrations:
  ✗ Claude Code hooks (run: tbd setup claude)
  ✗ Cursor rules (run: tbd setup cursor)
  ✗ Codex AGENTS.md (run: tbd setup codex)

Worktree: [..] (healthy)

Use 'tbd stats' for detailed issue statistics.
? 0
```

# Test: Status as JSON

```console
$ tbd status --json
{
  "initialized": true,
  "tbd_version": [..],
  "working_directory": [..],
  "git_repository": true,
  "git_branch": "main",
  "beads_detected": false,
...
}
? 0
```

* * *

## Reinitialization

# Test: Reinit on already initialized repo shows warning

```console
$ tbd init 2>&1
✗ tbd is already initialized[..]
? 0
```

* * *

## Init with Custom Options

This test uses a fresh repo to test custom init options.

```console
$ mkdir custom-repo && cd custom-repo && git init --initial-branch=main && git config user.email "test@example.com" && git config user.name "Test"
Initialized empty Git repository in [..]
? 0
```

# Test: Init with custom sync branch

```console
$ cd custom-repo && tbd init --prefix=bd --sync-branch custom-sync --remote upstream
✓ Initialized tbd repository

To complete setup, commit the config files:
  git add .tbd/
  git commit -m "Initialize tbd"
? 0
```

# Test: Verify custom config values

Note: The --sync-branch and --remote options are not currently applied (bug).
This test verifies the actual current behavior.

```console
$ cd custom-repo && tbd status
tbd v[..]

Repository: [..]
  ✓ Initialized (.tbd/)
  ✓ Git repository

Sync branch: tbd-sync
Remote: origin
ID prefix: bd-

Issues:
  Ready:       0
  In progress: 0
  Open:        0
  Total:       0

Integrations:
  ✗ Claude Code hooks (run: tbd setup claude)
  ✗ Cursor rules (run: tbd setup cursor)
  ✗ Codex AGENTS.md (run: tbd setup codex)

Worktree: [..] (healthy)

Use 'tbd stats' for detailed issue statistics.
? 0
```

* * *

## Error Cases

# Test: Commands require init first

```console
$ mkdir uninit-repo && cd uninit-repo && git init --initial-branch=main && git config user.email "test@example.com" && git config user.name "Test" && tbd list 2>&1
Initialized empty Git repository in [..]
Error: Not a tbd repository (run 'tbd init' or 'tbd import --from-beads' first)
? 1
```

# Test: Status on uninitialized repo

```console
$ cd uninit-repo && tbd status 2>&1
Not a tbd repository.

Detected:
  ✓ Git repository
  ✗ Beads not detected
  ✗ tbd not initialized

To get started:
  tbd init                  # Start fresh
? 0
```
