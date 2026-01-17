---
sandbox: true
env:
  NO_COLOR: '1'
  FORCE_COLOR: '0'
timeout: 30000
patterns:
  VERSION: '\d+\.\d+\.\d+'
before: |
  # Set up a test git repository (some commands need it)
  git init --initial-branch=main
  git config user.email "test@example.com"
  git config user.name "Test User"
  echo "# Test repo" > README.md
  git add README.md
  git commit -m "Initial commit"
---

# TBD CLI: Help Text Verification

Verifies that --help works correctly on all commands and subcommands.
Uses simple checks to verify help is displayed without exit errors.

---

## Top-Level Help

# Test: Top-level --help shows usage and commands

```console
$ node $TRYSCRIPT_TEST_DIR/../dist/bin.mjs --help | head -5
Usage: tbd [options] [command]

Git-native issue tracking for AI agents and humans

Options:
? 0
```

---

## Core Commands Help

# Test: init --help shows options

```console
$ node $TRYSCRIPT_TEST_DIR/../dist/bin.mjs init --help | grep -c "Options:"
1
? 0
```

# Test: create --help shows type option

```console
$ node $TRYSCRIPT_TEST_DIR/../dist/bin.mjs create --help | grep -c "\-t, --type"
1
? 0
```

# Test: list --help shows status filter

```console
$ node $TRYSCRIPT_TEST_DIR/../dist/bin.mjs list --help | grep -c "\-\-status"
1
? 0
```

# Test: show --help shows id argument

```console
$ node $TRYSCRIPT_TEST_DIR/../dist/bin.mjs show --help | grep -c "Issue ID"
1
? 0
```

# Test: update --help shows priority option

```console
$ node $TRYSCRIPT_TEST_DIR/../dist/bin.mjs update --help | grep -c "\-\-priority"
1
? 0
```

# Test: close --help shows reason option

```console
$ node $TRYSCRIPT_TEST_DIR/../dist/bin.mjs close --help | grep -c "\-\-reason"
1
? 0
```

# Test: reopen --help shows reason option

```console
$ node $TRYSCRIPT_TEST_DIR/../dist/bin.mjs reopen --help | grep -c "\-\-reason"
1
? 0
```

---

## Workflow Commands Help

# Test: ready --help shows description

```console
$ node $TRYSCRIPT_TEST_DIR/../dist/bin.mjs ready --help | grep -c "ready to work on"
1
? 0
```

# Test: blocked --help shows description

```console
$ node $TRYSCRIPT_TEST_DIR/../dist/bin.mjs blocked --help | grep -c "blocked issues"
1
? 0
```

# Test: stale --help shows days option

```console
$ node $TRYSCRIPT_TEST_DIR/../dist/bin.mjs stale --help | grep -c "\-\-days"
1
? 0
```

---

## Subcommand Groups Help

# Test: label --help shows add subcommand

```console
$ node $TRYSCRIPT_TEST_DIR/../dist/bin.mjs label --help | grep -c "add <id>"
1
? 0
```

# Test: depends --help shows list subcommand

```console
$ node $TRYSCRIPT_TEST_DIR/../dist/bin.mjs depends --help | grep -c "list <id>"
1
? 0
```

# Test: config --help shows set subcommand

```console
$ node $TRYSCRIPT_TEST_DIR/../dist/bin.mjs config --help | grep -c "set <key>"
1
? 0
```

# Test: attic --help shows restore subcommand

```console
$ node $TRYSCRIPT_TEST_DIR/../dist/bin.mjs attic --help | grep -c "restore"
1
? 0
```

---

## Utility Commands Help

# Test: sync --help shows push option

```console
$ node $TRYSCRIPT_TEST_DIR/../dist/bin.mjs sync --help | grep -c "\-\-push"
1
? 0
```

# Test: search --help shows query argument

```console
$ node $TRYSCRIPT_TEST_DIR/../dist/bin.mjs search --help | grep -c "Search query"
1
? 0
```

# Test: status --help exits successfully

```console
$ node $TRYSCRIPT_TEST_DIR/../dist/bin.mjs status --help | grep -c "repository status"
1
? 0
```

# Test: stats --help exits successfully

```console
$ node $TRYSCRIPT_TEST_DIR/../dist/bin.mjs stats --help | grep -c "repository statistics"
1
? 0
```

# Test: doctor --help shows fix option

```console
$ node $TRYSCRIPT_TEST_DIR/../dist/bin.mjs doctor --help | grep -c "\-\-fix"
1
? 0
```

# Test: import --help shows from-beads option

```console
$ node $TRYSCRIPT_TEST_DIR/../dist/bin.mjs import --help | grep -c "\-\-from-beads"
1
? 0
```

---

## Documentation Command Help

# Test: docs --help shows topic argument

```console
$ node $TRYSCRIPT_TEST_DIR/../dist/bin.mjs docs --help | grep -c "\[topic\]"
1
? 0
```

# Test: docs --help shows section option

```console
$ node $TRYSCRIPT_TEST_DIR/../dist/bin.mjs docs --help | grep -c "\-\-section"
1
? 0
```

# Test: docs --list shows slugified IDs

```console
$ node $TRYSCRIPT_TEST_DIR/../dist/bin.mjs docs --list | grep -c "id-system"
1
? 0
```

# Test: docs --list shows available sections

```console
$ node $TRYSCRIPT_TEST_DIR/../dist/bin.mjs docs --list | grep -c "Quick Reference"
1
? 0
```

# Test: docs positional topic argument works

```console
$ node $TRYSCRIPT_TEST_DIR/../dist/bin.mjs docs id-system | grep -c "Display ID"
1
? 0
```

# Test: docs --section shows filtered content

```console
$ node $TRYSCRIPT_TEST_DIR/../dist/bin.mjs docs --section "ID System" | grep -c "Display ID"
1
? 0
```

# Test: docs --list --json outputs array with slugs

```console
$ node $TRYSCRIPT_TEST_DIR/../dist/bin.mjs docs --list --json | node -e "const d=JSON.parse(require('fs').readFileSync(0,'utf8')); console.log(d.some(s=>s.slug==='id-system') ? 'ok' : 'fail')"
ok
? 0
```

# Test: docs shows full documentation

```console
$ node $TRYSCRIPT_TEST_DIR/../dist/bin.mjs docs | grep -c "TBD CLI Documentation"
1
? 0
```

---

## Uninstall Command Help

# Test: uninstall --help shows confirm option

```console
$ node $TRYSCRIPT_TEST_DIR/../dist/bin.mjs uninstall --help | grep -c "\-\-confirm"
1
? 0
```

# Test: uninstall without .tbd shows appropriate error

```console
$ node $TRYSCRIPT_TEST_DIR/../dist/bin.mjs uninstall 2>&1 | grep -c "No .tbd directory"
1
? 0
```
