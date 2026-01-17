---
sandbox: true
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
  node $TRYSCRIPT_TEST_DIR/../dist/bin.mjs init
---

# TBD CLI: Color Mode Tests

Tests for --color flag and NO_COLOR environment variable handling.

---

## Default Behavior (auto mode)

# Test: Default color mode is auto

The default should be auto, which respects TTY detection.

```console
$ node $TRYSCRIPT_TEST_DIR/../dist/bin.mjs create "Test issue"
✓ Created bd-[SHORTID]: Test issue
? 0
```

---

## Explicit Color Modes

# Test: --color=never disables colors

With NO_COLOR or --color=never, output should be plain text.

```console
$ NO_COLOR=1 node $TRYSCRIPT_TEST_DIR/../dist/bin.mjs list | head -2
ID          PRI  STATUS        TITLE
bd-[SHORTID]     2    open          Test issue
? 0
```

# Test: --color=never with explicit flag

```console
$ node $TRYSCRIPT_TEST_DIR/../dist/bin.mjs list --color=never | head -2
ID          PRI  STATUS        TITLE
bd-[SHORTID]     2    open          Test issue
? 0
```

# Test: --color=auto respects NO_COLOR

```console
$ NO_COLOR=1 node $TRYSCRIPT_TEST_DIR/../dist/bin.mjs list --color=auto | head -2
ID          PRI  STATUS        TITLE
bd-[SHORTID]     2    open          Test issue
? 0
```

---

## Output Consistency Across Commands

# Test: Info command respects color flag

```console
$ node $TRYSCRIPT_TEST_DIR/../dist/bin.mjs info --color=never
tbd version [..]

Working directory: [..]
Config file: .tbd/config.yml
Sync branch: tbd-sync
Remote: origin
ID prefix: bd-
Total issues: 1
? 0
```

# Test: Stats command respects color flag

```console
$ node $TRYSCRIPT_TEST_DIR/../dist/bin.mjs stats --color=never
Total issues: 1

By status:
  open           1

By kind:
  task           1

By priority:
  2 (Medium  ) 1
? 0
```

# Test: Doctor command respects color flag

```console
$ node $TRYSCRIPT_TEST_DIR/../dist/bin.mjs doctor --color=never
✓ Config file
✓ Issues directory
✓ Dependencies
✓ Unique IDs
✓ Temp files
✓ Issue validity

✓ Repository is healthy
? 0
```

# Test: Show command respects color flag

Verify show output contains expected fields (text output is YAML frontmatter).

```console
$ SHOW_ID=$(node $TRYSCRIPT_TEST_DIR/../dist/bin.mjs list --json | node -e "d=JSON.parse(require('fs').readFileSync(0,'utf8')); console.log(d[0].id)") && node $TRYSCRIPT_TEST_DIR/../dist/bin.mjs show $SHOW_ID --color=never | grep -c "title: Test issue"
1
? 0
```

---

## Help Text Consistency

# Test: Help respects NO_COLOR

```console
$ NO_COLOR=1 node $TRYSCRIPT_TEST_DIR/../dist/bin.mjs --help | head -3
Usage: tbd [options] [command]

Git-native issue tracking for AI agents and humans
? 0
```

# Test: Subcommand help respects NO_COLOR

```console
$ NO_COLOR=1 node $TRYSCRIPT_TEST_DIR/../dist/bin.mjs create --help | head -3
Usage: tbd create [options] [title]

Create a new issue
? 0
```

---

## Error Messages

# Test: Error output respects color flag

```console
$ node $TRYSCRIPT_TEST_DIR/../dist/bin.mjs show nonexistent --color=never 2>&1
✗ Issue not found: nonexistent
? 0
```

# Test: Invalid priority error respects color flag

```console
$ node $TRYSCRIPT_TEST_DIR/../dist/bin.mjs create "Test" -p 99 --color=never 2>&1
✗ Invalid priority: 99. Must be 0-4
? 0
```

---

## Success Messages

# Test: Create success message without color

```console
$ node $TRYSCRIPT_TEST_DIR/../dist/bin.mjs create "No color test" --color=never
✓ Created bd-[SHORTID]: No color test
? 0
```

# Test: Close success message without color

```console
$ ID=$(node $TRYSCRIPT_TEST_DIR/../dist/bin.mjs list --json | node -e "d=JSON.parse(require('fs').readFileSync(0,'utf8')); console.log(d[0].id)") && node $TRYSCRIPT_TEST_DIR/../dist/bin.mjs close $ID --color=never
✓ Closed bd-[SHORTID]
? 0
```

---

## FORCE_COLOR Interaction

# Test: FORCE_COLOR=0 disables colors

```console
$ FORCE_COLOR=0 node $TRYSCRIPT_TEST_DIR/../dist/bin.mjs list | head -2
ID          PRI  STATUS        TITLE
bd-[SHORTID]     [..]
? 0
```

---

## JSON Output Ignores Color

# Test: JSON output is not affected by color setting

```console
$ node $TRYSCRIPT_TEST_DIR/../dist/bin.mjs list --json --color=always | head -1
[
? 0
```

# Test: JSON output has no color codes

```console
$ node $TRYSCRIPT_TEST_DIR/../dist/bin.mjs stats --json --color=always | node -e "d=require('fs').readFileSync(0,'utf8'); console.log(d.includes('\\u001b') ? 'has-colors' : 'no-colors')"
no-colors
? 0
```
