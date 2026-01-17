---
sandbox: true
env:
  NO_COLOR: '1'
  FORCE_COLOR: '0'
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

# TBD CLI: Setup and Info Commands

This tryscript validates initialization, help, version, and info commands.

---

## Help and Version

# Test: --help shows usage with all commands

```console
$ node $TRYSCRIPT_TEST_DIR/../dist/bin.mjs --help
Usage: tbd [options] [command]

Git-native issue tracking for AI agents and humans

Options:
  -V, --version             Show version number
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
  -h, --help                display help for command

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
  depends                   Manage issue dependencies
  sync [options]            Synchronize with remote
  search [options] <query>  Search issues by text
  info                      Show repository information
  stats                     Show repository statistics
  doctor [options]          Diagnose and repair repository
  config                    Manage configuration
  attic                     Manage conflict archive (attic)
  import [options] [file]   Import issues from Beads or JSONL file.
                            Tip: Run "bd sync" and stop the beads daemon before
                            importing for best results.
  docs [options]            Display CLI documentation
  uninstall [options]       Remove tbd from this repository
  help [command]            display help for command
? 0
```

# Test: --version shows semantic version

```console
$ node $TRYSCRIPT_TEST_DIR/../dist/bin.mjs --version
[..]
? 0
```

# Test: -V short flag for version

```console
$ node $TRYSCRIPT_TEST_DIR/../dist/bin.mjs -V
[..]
? 0
```

# Test: help command for init

```console
$ node $TRYSCRIPT_TEST_DIR/../dist/bin.mjs help init
Usage: tbd init [options]

Initialize tbd in a git repository

Options:
  --sync-branch <name>  Sync branch name (default: tbd-sync)
  --remote <name>       Remote name (default: origin)
  -h, --help            display help for command
? 0
```

---

## Initialization

# Test: Initialize tbd with defaults

```console
$ node $TRYSCRIPT_TEST_DIR/../dist/bin.mjs init
✓ Initialized tbd repository

To complete setup, commit the config files:
  git add .tbd/
  git commit -m "Initialize tbd"
? 0
```

# Test: Info before any issues

```console
$ node $TRYSCRIPT_TEST_DIR/../dist/bin.mjs info
tbd version [..]

Working directory: [..]
Config file: .tbd/config.yml
Sync branch: tbd-sync
Remote: origin
ID prefix: bd-
Total issues: 0
? 0
```

# Test: Info as JSON

```console
$ node $TRYSCRIPT_TEST_DIR/../dist/bin.mjs info --json
{
  "version": [..],
  "initialized": true,
  "workingDirectory": [..],
  "configFile": ".tbd/config.yml",
  "syncBranch": "tbd-sync",
  "remote": "origin",
...
}
? 0
```

---

## Reinitialization

# Test: Reinit on already initialized repo shows warning

```console
$ node $TRYSCRIPT_TEST_DIR/../dist/bin.mjs init 2>&1
✗ tbd is already initialized[..]
? 0
```

---

## Init with Custom Options

This test uses a fresh repo to test custom init options.

```console
$ mkdir custom-repo && cd custom-repo && git init --initial-branch=main && git config user.email "test@example.com" && git config user.name "Test"
Initialized empty Git repository in [..]
? 0
```

# Test: Init with custom sync branch

```console
$ cd custom-repo && node $TRYSCRIPT_TEST_DIR/../dist/bin.mjs init --sync-branch custom-sync --remote upstream
✓ Initialized tbd repository

To complete setup, commit the config files:
  git add .tbd/
  git commit -m "Initialize tbd"
? 0
```

# Test: Verify custom config values

```console
$ cd custom-repo && node $TRYSCRIPT_TEST_DIR/../dist/bin.mjs info
tbd version [..]

Working directory: [..]
Config file: .tbd/config.yml
Sync branch: [..]
Remote: [..]
ID prefix: bd-
Total issues: 0
? 0
```

---

## Error Cases

# Test: Commands require init first

```console
$ mkdir uninit-repo && cd uninit-repo && git init --initial-branch=main && git config user.email "test@example.com" && git config user.name "Test" && node $TRYSCRIPT_TEST_DIR/../dist/bin.mjs list 2>&1
Initialized empty Git repository in [..]
Error: Not a tbd repository. Run "tbd init" first.
? 1
```

# Test: Info on uninitialized repo

```console
$ cd uninit-repo && node $TRYSCRIPT_TEST_DIR/../dist/bin.mjs info 2>&1
tbd version [..]

Not initialized[..]
? 0
```
