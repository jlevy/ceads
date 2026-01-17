---
sandbox: true
env:
  NO_COLOR: '1'
  FORCE_COLOR: '0'
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

# TBD CLI: Edge Cases and Error Handling

Tests for unusual inputs, error conditions, and edge cases.

---

## Unicode and Special Characters

# Test: Create issue with Unicode title

```console
$ node $TRYSCRIPT_TEST_DIR/../dist/bin.mjs create "Fix bug with émojis 🐛 and ñ"
✓ Created bd-[SHORTID]: Fix bug with émojis 🐛 and ñ
? 0
```

# Test: Create issue with CJK characters

```console
$ node $TRYSCRIPT_TEST_DIR/../dist/bin.mjs create "修复中文 bug" -t bug
✓ Created bd-[SHORTID]: 修复中文 bug
? 0
```

# Test: Create issue with Japanese characters

```console
$ node $TRYSCRIPT_TEST_DIR/../dist/bin.mjs create "日本語テスト" -t task
✓ Created bd-[SHORTID]: 日本語テスト
? 0
```

# Test: Create issue with Arabic characters

```console
$ node $TRYSCRIPT_TEST_DIR/../dist/bin.mjs create "اختبار عربي" -t task
✓ Created bd-[SHORTID]: اختبار عربي
? 0
```

# Test: Unicode titles appear in list

```console
$ node $TRYSCRIPT_TEST_DIR/../dist/bin.mjs list | grep -c "émojis"
1
? 0
```

# Test: Unicode search works

```console
$ node $TRYSCRIPT_TEST_DIR/../dist/bin.mjs search "中文" --json | node -e "d=JSON.parse(require('fs').readFileSync(0,'utf8')); console.log('found:', d.length)"
found: 1
? 0
```

# Test: Create label with Unicode

```console
$ node $TRYSCRIPT_TEST_DIR/../dist/bin.mjs list --json | node -e "d=JSON.parse(require('fs').readFileSync(0,'utf8')); console.log(d[0].id)" > /tmp/unicode_id.txt
? 0
```

```console
$ ID=$(cat /tmp/unicode_id.txt) && node $TRYSCRIPT_TEST_DIR/../dist/bin.mjs label add $ID "优先级高"
✓ Added labels[..]
? 0
```

# Test: Special characters in description

```console
$ node $TRYSCRIPT_TEST_DIR/../dist/bin.mjs create "Special chars" -d "Description with <html>, \"quotes\", 'apostrophes', & ampersands"
✓ Created bd-[SHORTID]: Special chars
? 0
```

# Test: Newlines in description from file

```console
$ echo -e "Line 1\nLine 2\nLine 3" > /tmp/multi.txt && node $TRYSCRIPT_TEST_DIR/../dist/bin.mjs create "Multi-line" -f /tmp/multi.txt
✓ Created bd-[SHORTID]: Multi-line
? 0
```

---

## Error Handling

# Test: Invalid issue ID format

```console
$ node $TRYSCRIPT_TEST_DIR/../dist/bin.mjs show "invalid!!!" 2>&1 | head -1
✗ Issue not found: invalid!!!
? 0
```

# Test: Non-existent short ID

```console
$ node $TRYSCRIPT_TEST_DIR/../dist/bin.mjs show "zzzz" 2>&1 | head -1
✗ Issue not found: zzzz
? 0
```

# Test: Invalid priority value

```console
$ node $TRYSCRIPT_TEST_DIR/../dist/bin.mjs create "Test" -p 10 2>&1 | head -1
✗ Invalid priority: 10. Must be 0-4
? 0
```

# Test: Invalid type value

```console
$ node $TRYSCRIPT_TEST_DIR/../dist/bin.mjs create "Test" -t invalid 2>&1 | head -1
✗ Invalid type: invalid. Must be: bug, feature, task, epic, chore
? 0
```

# Test: Empty title error

```console
$ node $TRYSCRIPT_TEST_DIR/../dist/bin.mjs create "" 2>&1 | head -1
✗ Title is required. Use: tbd create "Issue title"
? 0
```

# Test: Update non-existent issue

```console
$ node $TRYSCRIPT_TEST_DIR/../dist/bin.mjs update bd-0000 --priority 1 2>&1 | head -1
✗ Issue not found: bd-0000
? 0
```

# Test: Close non-existent issue

```console
$ node $TRYSCRIPT_TEST_DIR/../dist/bin.mjs close bd-0000 2>&1 | head -1
✗ Issue not found: bd-0000
? 0
```

# Test: Self-dependency error

```console
$ node $TRYSCRIPT_TEST_DIR/../dist/bin.mjs list --json | node -e "d=JSON.parse(require('fs').readFileSync(0,'utf8')); console.log(d[0].id)" > /tmp/self_id.txt
? 0
```

```console
$ ID=$(cat /tmp/self_id.txt) && node $TRYSCRIPT_TEST_DIR/../dist/bin.mjs depends add $ID $ID 2>&1 | head -1
✗ Issue cannot block itself
? 0
```

---

## Boundary Conditions

# Test: Very long title (200 chars)

```console
$ node $TRYSCRIPT_TEST_DIR/../dist/bin.mjs create "$(printf 'A%.0s' {1..200})"
✓ Created bd-[SHORTID]: [..]
? 0
```

# Test: Many labels

```console
$ node $TRYSCRIPT_TEST_DIR/../dist/bin.mjs create "Many labels" -l one -l two -l three -l four -l five -l six -l seven -l eight
✓ Created bd-[SHORTID]: Many labels
? 0
```

# Test: Zero priority

```console
$ node $TRYSCRIPT_TEST_DIR/../dist/bin.mjs create "Critical" -p 0
✓ Created bd-[SHORTID]: Critical
? 0
```

# Test: Lowest priority

```console
$ node $TRYSCRIPT_TEST_DIR/../dist/bin.mjs create "Backlog" -p 4
✓ Created bd-[SHORTID]: Backlog
? 0
```

---

## List Filtering Edge Cases

# Test: List with multiple filters

```console
$ node $TRYSCRIPT_TEST_DIR/../dist/bin.mjs list --status open --type task --priority 2 | grep -c "^bd-" || echo "0"
[..]
? 0
```

# Test: List count only

```console
$ node $TRYSCRIPT_TEST_DIR/../dist/bin.mjs list --count
[..]
? 0
```

# Test: List with very large limit

```console
$ node $TRYSCRIPT_TEST_DIR/../dist/bin.mjs list --limit 10000 | head -1
[..]
? 0
```

---

## Dry Run Mode

# Test: Create with dry-run doesn't create

```console
$ node $TRYSCRIPT_TEST_DIR/../dist/bin.mjs create "DryRun Test" --dry-run
[DRY-RUN] Would create issue
? 0
```

# Test: Verify dry-run didn't create

```console
$ node $TRYSCRIPT_TEST_DIR/../dist/bin.mjs search "DryRun Test" --json
[]
? 0
```

# Test: Close with dry-run doesn't close

```console
$ ID=$(cat /tmp/self_id.txt) && node $TRYSCRIPT_TEST_DIR/../dist/bin.mjs close $ID --dry-run
[DRY-RUN] Would close issue
? 0
```

# Test: Verify issue still open after dry-run close

```console
$ ID=$(cat /tmp/self_id.txt) && node $TRYSCRIPT_TEST_DIR/../dist/bin.mjs show $ID | grep "status: open"
status: open
? 0
```

---

## JSON Output Consistency

# Test: List JSON is valid array

```console
$ node $TRYSCRIPT_TEST_DIR/../dist/bin.mjs list --json | node -e "JSON.parse(require('fs').readFileSync(0,'utf8')); console.log('valid')"
valid
? 0
```

# Test: Show JSON is valid object

```console
$ ID=$(cat /tmp/self_id.txt) && node $TRYSCRIPT_TEST_DIR/../dist/bin.mjs show $ID --json | node -e "JSON.parse(require('fs').readFileSync(0,'utf8')); console.log('valid')"
valid
? 0
```

# Test: Search JSON is valid array

```console
$ node $TRYSCRIPT_TEST_DIR/../dist/bin.mjs search "test" --json | node -e "JSON.parse(require('fs').readFileSync(0,'utf8')); console.log('valid')"
valid
? 0
```

# Test: Stats JSON is valid object

```console
$ node $TRYSCRIPT_TEST_DIR/../dist/bin.mjs stats --json | node -e "JSON.parse(require('fs').readFileSync(0,'utf8')); console.log('valid')"
valid
? 0
```

---

## Working Notes

# Test: Add working notes

```console
$ ID=$(cat /tmp/self_id.txt) && node $TRYSCRIPT_TEST_DIR/../dist/bin.mjs update $ID --notes "Investigation notes: found the root cause"
✓ Updated bd-[SHORTID]
? 0
```

# Test: Verify notes in show output

```console
$ ID=$(cat /tmp/self_id.txt) && node $TRYSCRIPT_TEST_DIR/../dist/bin.mjs show $ID | grep -c "Investigation notes"
1
? 0
```

# Test: Notes from file

```console
$ echo "Notes from file content" > /tmp/notes.txt && ID=$(cat /tmp/self_id.txt) && node $TRYSCRIPT_TEST_DIR/../dist/bin.mjs update $ID --notes-file /tmp/notes.txt
✓ Updated bd-[SHORTID]
? 0
```

---

## Stale Issues

# Test: Stale with default days

```console
$ node $TRYSCRIPT_TEST_DIR/../dist/bin.mjs stale --json | node -e "JSON.parse(require('fs').readFileSync(0,'utf8')); console.log('valid')"
valid
? 0
```

# Test: Stale with custom days

```console
$ node $TRYSCRIPT_TEST_DIR/../dist/bin.mjs stale --days 0 | head -1
[..]
? 0
```

---

## Deferred Issues

# Test: Create deferred issue with full datetime

```console
$ node $TRYSCRIPT_TEST_DIR/../dist/bin.mjs create "Deferred task" --defer 2099-12-31T00:00:00Z
✓ Created bd-[SHORTID]: Deferred task
? 0
```

# Test: List with deferred filter runs without error

```console
$ node $TRYSCRIPT_TEST_DIR/../dist/bin.mjs list --deferred --json | node -e "JSON.parse(require('fs').readFileSync(0,'utf8')); console.log('valid json')"
valid json
? 0
```
