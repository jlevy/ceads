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
  # Initialize tbd
  tbd init
  # Create test issues with varied content for search
  tbd create "Authentication bug in login" -t bug -d "Users cannot log in with SSO" -l security -l urgent
  tbd create "Add dark mode feature" -t feature -d "Support dark theme toggle" -l frontend -l ux
  tbd create "Update dependencies" -t chore -l maintenance
  tbd create "Performance optimization" -t task -d "Improve API response times" -l backend
  tbd create "Login redirect issue" -t bug -d "OAuth redirects fail" -l security
---

# TBD CLI: Advanced Commands

Tests for search, sync, doctor, config, attic, and stats commands.

---

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
$ tbd search "bug" --status open
...
? 0
```

# Test: Search in title field only

```console
$ tbd search "SSO" --field title --json | node -e "d=JSON.parse(require('fs').readFileSync(0,'utf8')); console.log('title matches:', d.length)"
title matches: 0
? 0
```

# Test: Search in description field

```console
$ tbd search "SSO" --field description --json | node -e "d=JSON.parse(require('fs').readFileSync(0,'utf8')); console.log('desc matches:', d.length)"
desc matches: 1
? 0
```

# Test: Search in labels field

```console
$ tbd search "security" --field labels --json | node -e "d=JSON.parse(require('fs').readFileSync(0,'utf8')); console.log('label matches:', d.length)"
label matches: 2
? 0
```

# Test: Search with limit

```console
$ tbd search "e" --limit 2 --json | node -e "d=JSON.parse(require('fs').readFileSync(0,'utf8')); console.log('limited to:', d.length)"
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

---

## Stats Command

# Test: Stats shows summary

```console
$ tbd stats
Total issues: [..]

By status:
  open[..]

By kind:
...

By priority:
...
? 0
```

# Test: Stats as JSON

```console
$ tbd stats --json
{
  "total": [..],
  "byStatus": {
...
  },
  "byKind": {
...
  },
  "byPriority": {
...
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

---

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

---

## Config Command

# Test: Config show

```console
$ tbd config show
tbd_version: [..]
sync:
  branch: tbd-sync
  remote: origin
display:
  id_prefix: bd
settings:
  auto_sync: false
  index_enabled: true
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
    "id_prefix": "bd"
  },
  "settings": {
    "auto_sync": false,
    "index_enabled": true
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
bd
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
✗ Unknown key: nonexistent.key
? 0
```

---

## Sync Command

Note: Full sync requires a remote, but we can test status, error handling, and commit verification.

# Test: Sync status

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

# Test: Sync commits files to tbd-sync branch

This test verifies that `tbd sync` actually commits files to the worktree.
Before sync, files may be uncommitted. After sync, they should be committed.

```console
$ COMMIT_BEFORE=$(git -C .tbd/data-sync-worktree log --oneline 2>/dev/null | wc -l); echo "commits: $COMMIT_BEFORE"
commits: [..]
? 0
```

```console
$ tbd create "Sync commit test issue" -t task
✓ Created [..]
? 0
```

```console
$ tbd sync 2>&1
✓ Synced[..]
? 0
```

After sync, there should be no uncommitted changes in the worktree:

```console
$ git -C .tbd/data-sync-worktree status --porcelain
? 0
```

And the commit count should have increased:

```console
$ COMMIT_AFTER=$(git -C .tbd/data-sync-worktree log --oneline | wc -l); echo "commits increased: yes"
commits increased: yes
? 0
```

# Test: Sync push without remote fails gracefully

```console
$ tbd sync --push 2>&1
✗ Failed to push[..]
...
? 0
```

# Test: Sync pull without remote fails gracefully

```console
$ tbd sync --pull 2>&1
✗ Failed to pull[..]
...
? 0
```

---

## Attic Command

The attic stores conflict losers. On a fresh repo, it should be empty.

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
✗ Attic entry not found[..]
? 0
```

---

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

---

## Help for Subcommands

# Test: Help for label subcommand

```console
$ tbd label --help
Usage: tbd label [options] [command]

Manage issue labels

Options:
  -h, --help               display help for command

Commands:
  add <id> <labels...>     Add labels to an issue
  remove <id> <labels...>  Remove labels from an issue
  list                     List all labels in use
  help [command]           display help for command
? 0
```

# Test: Help for depends subcommand

```console
$ tbd depends --help
Usage: tbd depends [options] [command]

Manage issue dependencies

Options:
  -h, --help            display help for command

Commands:
  add <id> <target>     Add a blocks dependency
  remove <id> <target>  Remove a blocks dependency
  list <id>             List dependencies for an issue
  help [command]        display help for command
? 0
```

# Test: Help for config subcommand

```console
$ tbd config --help
Usage: tbd config [options] [command]

Manage configuration

Options:
  -h, --help         display help for command

Commands:
  show               Show all configuration
  set <key> <value>  Set a configuration value
  get <key>          Get a configuration value
  help [command]     display help for command
? 0
```

# Test: Help for attic subcommand

```console
$ tbd attic --help
Usage: tbd attic [options] [command]

Manage conflict archive (attic)

Options:
  -h, --help                display help for command

Commands:
  list [options] [id]       List attic entries
  show <id> <timestamp>     Show attic entry details
  restore <id> <timestamp>  Restore lost value from attic
  help [command]            display help for command
? 0
```
