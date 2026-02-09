# Feature: Fix Tryscript Node JSON-Parsing Antipattern

**Date:** 2026-02-09

**Author:** Agent (jlevy/tbd)

**Status:** Draft

## Overview

Systematically remove the `node -e "JSON.parse(require('fs').readFileSync(0,'utf8'))"`
antipattern from all tryscript golden tests and replace with patterns that show actual
CLI output — real data, real field values, real structure — so that tests are more
checkable and better validate outputs.

## Guiding Principle

**Expose all the context that is reasonable but still maintainable.** Tryscript golden
tests should include actual outputs and related data as long as the output isn't
excessively large. Showing real JSON output makes tests far more checkable: you can see
exactly what the CLI produces, catch unexpected field changes, and validate the full
shape of responses — not just one cherry-picked field.

The `node -e` antipattern does the opposite: it hides all output behind a JavaScript
program that extracts a single value, reducing a rich golden test to a narrow unit-test-
style assertion. This loses the core value of golden testing.

## Goals

- Remove all 130 instances of the `node -e` JSON-parsing antipattern across 18 test
  files
- Show actual CLI output in the golden files — real JSON responses with elision
  patterns (`[SHORTID]`, `[ULID]`, `[TIMESTAMP]`) only for genuinely unstable fields
  like IDs and timestamps
- Use `jq` + `tee` for ID capture where an ID must be saved for subsequent commands
- Make every test more checkable by exposing the real data the CLI produces

## Non-Goals

- Rewriting tests that don't use `--json` output (e.g., tests that use `grep -c` on
  human-readable output)
- Adding new test scenarios beyond what currently exists
- Changing the CLI's `--json` output format

## Background

### The Antipattern

Many tryscript tests pipe `--json` CLI output through Node.js to parse JSON and extract
specific fields:

```bash
tbd show $(cat id.txt) --json | node -e "const d=JSON.parse(require('fs').readFileSync(0,'utf8')); console.log('spec:', d.spec_path)"
```

This defeats the core purpose of golden testing. The golden testing guidelines
(`tbd guidelines golden-testing-guidelines`, section "Anti-Patterns for Session Tests")
call this out explicitly as **Anti-pattern 2: Surgical extraction instead of showing
full state**:

> Don't narrow output to check specific values when you could show the full state.
> Tools like `grep`, `jq`, `awk`, `head`, `tail`, or inline parsing scripts are all
> ways to extract narrow slices—converting your session test back into unit test
> mentality and losing the ability to catch unanticipated changes.

The guidelines also cite the `node -e` pattern specifically as a wrong example:

> ```
> $ my-app status --json | node -e "console.log(JSON.parse(require('fs').readFileSync(0)).count)"
> 4
> ```

And the testing architecture doc (`docs/project/architecture/current/arch-testing.md`)
describes the philosophy as **transparent box testing**: "capturing every meaningful
detail of execution so behavioral changes show up immediately in diffs."

The antipattern manifests in three sub-patterns:

**Sub-pattern A: ID capture with output suppression** (~40 instances)

```bash
# ANTIPATTERN: Hides entire JSON output, only prints "Created"
$ tbd create "Issue" --json | node -e "const d=JSON.parse(require('fs').readFileSync(0,'utf8')); require('fs').writeFileSync('id.txt', d.id); console.log('Created')"
Created
```

**Sub-pattern B: Single-field extraction** (~50 instances)

```bash
# ANTIPATTERN: Hides all fields except one
$ tbd show $(cat id.txt) --json | node -e "const d=JSON.parse(require('fs').readFileSync(0,'utf8')); console.log('spec:', d.spec_path)"
spec: docs/specs/my-feature.md
```

**Sub-pattern C: Computed assertions** (~40 instances)

```bash
# ANTIPATTERN: Reimplements assertion logic in JavaScript, hides actual data
$ tbd list --status closed --json | node -e "const d=JSON.parse(require('fs').readFileSync(0,'utf8')); console.log(d.filter(i => i.status === 'closed').length)"
2
```

### The Correct Patterns

The project already has examples of the correct approach. The key idea: **show real data
in the golden output**. Use elision patterns only for genuinely unstable fields (IDs,
timestamps) — everything else should be actual values so the golden diff catches
unexpected changes.

**For ID capture** (from `cli-child-order.tryscript.md`):

```bash
# CORRECT: Shows the ID in golden output AND saves to file
$ tbd create "Parent Epic" --type=epic --json | jq -r '.id' | tee parent_id.txt
test-[SHORTID]
```

**For full JSON validation** (from `cli-crud.tryscript.md` line 140):

```bash
# CORRECT: Full JSON output — real values for stable fields, patterns only for IDs
$ tbd create "JSON test" --type=task --json
{
  "id": "test-[SHORTID]",
  "internalId": "is-[ULID]",
  "title": "JSON test"
}
```

**For showing detailed state**: Show the full JSON response. Every field value that the
CLI returns is visible in the golden output, so if a field is added, removed, renamed,
or changes value, the diff will surface it immediately:

```bash
# CORRECT: Full state exposed — catches unexpected changes in any field
$ tbd show $(cat id.txt) --json
{
  "id": "test-[SHORTID]",
  "internalId": "is-[ULID]",
  "title": "Issue to show",
  "kind": "bug",
  "status": "open",
  "priority": 1,
  "labels": ["backend", "critical"],
  "created_at": "[TIMESTAMP]",
  "updated_at": "[TIMESTAMP]",
  ...
}
```

The golden file should include the actual output as captured by
`npx tryscript run --update`. The output may be moderately long for complex objects but
that's fine — the point is to expose all the context that is reasonable but still
maintainable, making tests more checkable and better at validating outputs.

### Fix Strategy Per Sub-Pattern

**Sub-pattern A (ID capture)** — Replace `node -e ... writeFileSync` with
`jq -r '.id' | tee id.txt` so the ID is both visible in golden output and saved.
Alternatively, show full JSON via `tee output.json` and extract the ID in a follow-up
step. Either way, the golden output should show real data, not just "Created".

**Sub-pattern B (single-field extraction)** — Remove the `| node -e ...` pipe entirely.
Show the full `--json` output with `[SHORTID]` / `[ULID]` / `[TIMESTAMP]` patterns
only for genuinely unstable fields. All stable field values (title, kind, status,
priority, labels, spec_path, etc.) should be shown as real values. The golden diff
validates everything — one line per field — making it trivial to spot unexpected changes.

**Sub-pattern C (computed assertions)** — Remove the `| node -e ...` pipe. Show the
full `--json` output. The golden file shows the actual data, which implicitly validates
counts, field values, and filtering by making everything visible. For list commands
returning a small number of items, the full JSON array is preferred. For large lists
(20+ items), `jq length` or `jq '.[].id'` is acceptable, but err on the side of
showing more rather than less.

## Implementation Plan

Each item below is one test file. All tests within each file must be updated, then the
golden output re-captured via `npx tryscript run --update <file>`. After updating each
file, run `npx tryscript run <file>` to verify the golden output passes.

The files are ordered by instance count (most antipattern occurrences first) to
prioritize the highest-impact files.

### Phase 1: Highest-Impact Files (10+ instances each)

- [ ] **cli-spec-inherit.tryscript.md** (23 instances) — Heavy use of sub-patterns A
  and B for parent/child spec inheritance. Replace all `node -e` with `jq` + `tee` for
  ID capture and full `--json` output for show commands.

- [ ] **cli-workflow.tryscript.md** (18 instances) — Uses sub-patterns A, B, and C for
  ready/blocked/label/dep workflows. Many instances write to `/tmp/` files. Replace with
  `jq` + `tee` for ID capture and full JSON output for assertions.

- [ ] **cli-spec-linking.tryscript.md** (16 instances) — Sub-patterns A and B for spec
  linking CRUD. Replace `node -e` ID capture with `jq` + `tee`, replace show field
  extraction with full JSON output.

- [ ] **cli-crud.tryscript.md** (12 instances) — Sub-patterns A and B for core CRUD
  operations. Note: this file already has some correct patterns (line 140). Bring the
  remaining 12 instances into alignment.

- [ ] **cli-advanced.tryscript.md** (10 instances) — Sub-patterns B and C for search,
  stats, and doctor commands. Replace computed assertions with full JSON output.

### Phase 2: Medium-Impact Files (6-9 instances each)

- [ ] **cli-edge-cases.tryscript.md** (9 instances) — Mix of sub-patterns A, B, and C
  for unicode, self-referential deps, and JSON validity checks. The JSON validity
  checks (sub-pattern C) that just verify `JSON.parse` succeeds can be replaced with
  showing the full output.

- [ ] **cli-list-pretty.tryscript.md** (8 instances) — Sub-patterns A and C for
  hierarchical list display. Replace ID capture and count assertions.

- [ ] **cli-list-status-filter.tryscript.md** (6 instances) — Sub-patterns A and C for
  status filtering. Replace ID capture and count/filter assertions with full output.

- [ ] **cli-list-specs.tryscript.md** (6 instances) — Sub-patterns A and B for spec
  listing. Replace ID capture and field extraction.

- [ ] **cli-import-status.tryscript.md** (6 instances) — Sub-pattern C for verifying
  imported issue statuses. Replace found/not-found assertions with full JSON output.

### Phase 3: Low-Impact Files (1-3 instances each)

- [ ] **cli-id-format.tryscript.md** (3 instances) — Sub-patterns B and C for ID
  format validation. Replace computed format checks with full JSON showing actual IDs.

- [ ] **cli-import.tryscript.md** (3 instances) — Sub-patterns B and C for import
  verification. Replace count/ID assertions with full JSON output.

- [ ] **cli-import-autoinit.tryscript.md** (3 instances) — Sub-patterns B and C for
  auto-init import. Replace count assertions with full JSON.

- [ ] **cli-beads.tryscript.md** (2 instances) — Sub-pattern C for import count and ID
  listing. Replace with full JSON output.

- [ ] **cli-sync.tryscript.md** (2 instances) — Sub-patterns B and C for sync status.
  Replace with full JSON output.

- [ ] **cli-sync-remote.tryscript.md** (1 instance) — Sub-pattern B for sync status
  check. Replace with full JSON output.

- [ ] **cli-import-e2e.tryscript.md** (1 instance) — Sub-pattern B for stats total.
  Replace with full JSON output.

- [ ] **cli-help-all.tryscript.md** (1 instance) — Sub-pattern C for docs list check.
  Replace with full JSON output.

### Phase 4: Verification

- [ ] Run full tryscript test suite: `npx tryscript run packages/tbd/tests/*.tryscript.md`
  to verify all tests pass with updated golden output
- [ ] Review diffs to confirm all `node -e` instances are removed
- [ ] Verify no regressions in test coverage

## Testing Strategy

Each file should be updated and verified individually:

1. Replace all `node -e` patterns in the file
2. Run `npx tryscript run --update <file>` to capture new golden output
3. Review the captured output to ensure it exposes the full state
4. Run `npx tryscript run <file>` to verify the golden output matches
5. Repeat for each file

After all files are updated, run the full test suite to confirm no regressions.

## Open Questions

- Some tests use `$(cat /tmp/file.txt)` for ID capture. Should these also move to
  sandbox-local files (e.g., `id.txt` instead of `/tmp/id.txt`)? Recommendation: yes,
  sandbox-local files are cleaner and avoid /tmp pollution.

## References

### Anti-Pattern Documentation

- **`tbd guidelines golden-testing-guidelines`** — Section "Anti-Patterns for Session
  Tests (tryscript/golden tests)": defines Anti-pattern 1 (patterns for stable fields)
  and **Anti-pattern 2** (surgical extraction instead of showing full state), which is
  the primary issue addressed by this spec. Includes a `node -e` example as wrong usage.
- **`docs/project/architecture/current/arch-testing.md`** — Testing Architecture doc,
  describes the "transparent box testing" philosophy: "capturing every meaningful detail
  of execution so behavioral changes show up immediately in diffs."
- **`docs/general/research/current/research-cli-golden-testing.md`** — Research brief on
  golden testing for CLI applications, includes design rationale for tryscript and the
  full-output capture approach.

### Tryscript Syntax Reference

- **`npx tryscript@latest docs`** — Complete tryscript syntax reference (patterns,
  elisions, config). Key features for this work: `[SHORTID]`/`[ULID]`/`[TIMESTAMP]`
  custom patterns, `[..]` single-line wildcards, `...` multi-line wildcards.
- **`npx tryscript@latest readme`** — tryscript overview and usage.

### Exemplar Test Files (correct patterns)

- **`cli-child-order.tryscript.md`** — Uses `jq -r '.id' | tee id.txt` for ID capture
  with visible output, `jq` for field extraction with data shown.
- **`cli-crud.tryscript.md:140-147`** — Shows full JSON create output with real field
  values and patterns only for IDs.
