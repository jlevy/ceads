# tbd YAML/Markdown Format Exploration

**Status:** Exploration / RFC

**Date:** January 2025

**Related:** tbd-design-v2-phase1.md

* * *

## Executive Summary

This document explores replacing JSON storage with **Markdown + YAML front matter** for
tbd issue files. This is the format used by static site generators (Jekyll, Hugo, Astro)
and is increasingly common for content management.

**Key benefits:**

- Human-readable and directly editable in any text editor

- Description and notes naturally render as Markdown

- Enables new workflows: issues in main repo, batch editing, file-based review

- Familiar format for developers

- Comments can be inline in the document

**This document covers:**

1. **Part 0**: Prior Art Survey (ticket, TrackDown, git-issue, etc.)

2. **Part 1**: Concrete spec changes if we adopt this format (drop-in replacement)

3. **Part 2**: New workflows this format enables (exploratory)

4. **Part 3**: Trade-offs and implementation considerations

* * *

## Table of Contents

- [Part 0: Prior Art Survey](#part-0-prior-art-survey)

  - [0.1 ticket (wedow/ticket)](#01-ticket-wedowticket)

  - [0.2 TrackDown](#02-trackdown)

  - [0.3 git-issue](#03-git-issue)

  - [0.4 git-bug](#04-git-bug)

  - [0.5 Static Site Generators](#05-static-site-generators)

  - [0.6 Key Learnings](#06-key-learnings)

- [Part 1: Core Format Changes](#part-1-core-format-changes)

  - [1.1 File Format Specification](#11-file-format-specification)

  - [1.2 Schema Changes](#12-schema-changes)

  - [1.3 Canonical Serialization](#13-canonical-serialization)

  - [1.4 Conflict Detection and Merging](#14-conflict-detection-and-merging)

  - [1.5 Directory Structure Changes](#15-directory-structure-changes)

  - [1.6 CLI Changes](#16-cli-changes)

  - [1.7 Config File Format](#17-config-file-format)

  - [1.8 Migration from JSON](#18-migration-from-json)

- [Part 2: New Workflows](#part-2-new-workflows)

  - [2.1 Main Repo Issue Storage](#21-main-repo-issue-storage)

  - [2.2 Edit Directory Workflow](#22-edit-directory-workflow)

  - [2.3 Batch File Operations](#23-batch-file-operations)

  - [2.4 Inline Comments](#24-inline-comments)

  - [2.5 Issue Templates](#25-issue-templates)

- [Part 3: Trade-offs and Considerations](#part-3-trade-offs-and-considerations)

  - [3.1 Advantages](#31-advantages)

  - [3.2 Disadvantages](#32-disadvantages)

  - [3.3 Implementation Complexity](#33-implementation-complexity)

  - [3.4 Performance Implications](#34-performance-implications)

- [Appendix: Complete Example Files](#appendix-complete-example-files)

* * *

## Part 0: Prior Art Survey

Before designing our format, let’s examine existing tools that use plaintext/Markdown
for issue tracking.

### 0.1 ticket (wedow/ticket)

**Source:** [github.com/wedow/ticket](https://github.com/wedow/ticket)

A fast, simple Beads replacement implemented as ~900 lines of bash.

**Storage format:**

- Markdown files with YAML front matter

- File per ticket in `.tickets/` directory

- ID as filename

**Key design choices:**

- Prioritizes AI agent searchability - avoids dense JSON that consumes context windows

- IDE-friendly: direct file linking via ticket IDs

- Zero infrastructure: no SQLite, no daemons, just bash + coreutils

- Quote: “You don’t need to index everything with SQLite when you have awk”

**Workflow:**

- Standard CRUD: `create`, `show`, `list`, `close`, `reopen`

- Dependency tracking with `dep`, `undep`, tree visualization

- `ready` and `blocked` commands (same semantics as Beads/tbd)

- `query` outputs JSON for jq integration

**Conflict handling:**

- Relies on Git’s native merge for Markdown files

- No explicit conflict resolution strategy documented

- Assumes coordinated team workflows

**Learnings for tbd:**

- Markdown+YAML works well in production (~1,900 tickets)

- Simplicity wins for single-user/small team

- AI agents benefit from readable formats

### 0.2 TrackDown

**Source:** [github.com/mgoellnitz/trackdown](https://github.com/mgoellnitz/trackdown)

Issue tracking with plain Markdown, designed for distributed/disconnected teams.

**Storage format:**

- **Single Markdown file** containing all issues

- Issue format: `## ID Title (status)` headers

- Sections for version, severity, priority, description, comments

**Key design choices:**

- One file = simpler distribution but more conflict-prone

- Post-commit hooks parse commit messages (`fixes #ID`, `refs #ID`)

- Auto-generates roadmap grouped by version labels

- Can live on dedicated branch or in wiki

**Workflow:**

- Git hooks do the heavy lifting

- `roadmap` generates version summaries

- `ls`, `mine` for queries

- Commits automatically append to issue comments

**Conflict handling:**

- Leverages Git’s native text merge

- Single file means more manual conflict resolution

**Learnings for tbd:**

- Git hooks for commit integration is powerful

- Single file doesn’t scale; file-per-entity is better

- Roadmap auto-generation is nice feature

### 0.3 git-issue

**Source:** [github.com/dspinellis/git-issue](https://github.com/dspinellis/git-issue)

Decentralized issue management stored in Git.

**Storage format:**

- Issues in `.issues/` directory

- Each issue in `issues/xx/xxxxxxx...` (SHA-based path)

- Separate files for: `description`, `tags`, `milestone`, `assignee`, etc.

- Comments as subdirectories with own SHAs

- Attachments supported

**Key design choices:**

- Git objects as native storage (not just Git-tracked files)

- SHA-based IDs (like Git commits)

- Bidirectional sync with GitHub/GitLab APIs

- Import/export preserves external issue numbers

**Workflow:**

- Full CRUD: `new`, `show`, `comment`, `edit`, `close`

- Metadata commands: `tag`, `assign`, `milestone`, `duedate`

- Sync: `push`, `pull`, `import`, `export`

- Batch: `filter-apply` for scripted changes

**Conflict handling:**

- Offline-first: work locally, sync when online

- Push/pull through standard Git

- Import tracking for incremental GitHub sync

**Learnings for tbd:**

- Multiple files per issue (metadata + content) is interesting but complex

- GitHub/GitLab sync is valuable (Phase 2 for us)

- SHA-based IDs are robust but not human-friendly

### 0.4 git-bug

**Source:** [github.com/git-bug/git-bug](https://github.com/git-bug/git-bug)

Distributed, offline-first bug tracker embedded in Git.

**Storage format:**

- Issues stored as Git objects (not files in working tree)

- Custom refs namespace (`refs/bugs/`)

- Operation-based (like a CRDT)

**Key design choices:**

- Git objects mean issues don’t clutter working directory

- Operation log rather than snapshot (mergeable by design)

- Web UI included

- GitHub bridge for sync

**Workflow:**

- `add`, `select`, `comment`, `label`, `status`

- TUI and Web interfaces

- `bridge` for GitHub integration

**Learnings for tbd:**

- Git object storage is clever but non-inspectable

- Operation-based model is interesting for conflict resolution

- We prefer file-based for debuggability

### 0.5 Static Site Generators

The Markdown + YAML front matter pattern is well-established:

**Jekyll/Hugo/Astro pattern:**

```markdown
---
title: My Post
date: 2025-01-10
tags: [tech, tutorial]
draft: false
---

Content goes here...
```

**Key conventions:**

- `---` delimiters for YAML front matter

- Metadata in YAML, content in Markdown

- File-per-content-item

- Directory structure = taxonomy

**Tools ecosystem:**

- [gray-matter](https://github.com/jonschlinkert/gray-matter) - Node.js parser

- [Front Matter CMS](https://frontmatter.codes/) - VS Code extension

- [Nuxt Content](https://content.nuxt.com/) - Git-based CMS

- Numerous YAML front matter parsers in every language

**Learnings for tbd:**

- Format is battle-tested at scale

- Excellent tooling exists

- Developers already know this pattern

### 0.6 Key Learnings

| Tool | Storage | Pros | Cons |
| --- | --- | --- | --- |
| ticket | MD+YAML, file-per-issue | Simple, AI-friendly, production-proven | No conflict strategy |
| TrackDown | Single MD file | Simple distribution | Merge conflicts at scale |
| git-issue | SHA dirs + metadata files | GitHub sync, robust | Complex structure, ugly IDs |
| git-bug | Git objects | No file clutter, CRDT-like | Not inspectable |
| SSGs | MD+YAML, file-per-content | Universal, great tooling | No sync built-in |

**Synthesis for tbd:**

1. **File-per-entity with Markdown+YAML is the right choice**

   - Proven by ticket’s production use

   - Matches developer mental model from static sites

   - Better than single file (TrackDown) or git objects (git-bug)

2. **Keep human-readable IDs**

   - SHA-based (git-issue) is robust but unfriendly

   - Short hex IDs (ticket, Beads) are better UX

3. **Need explicit conflict strategy**

   - ticket relies on Git merge (works for small teams)

   - We should keep our LWW + attic approach for robustness

4. **Git hooks are useful but optional**

   - TrackDown’s commit parsing is nice

   - Keep as optional enhancement, not requirement

5. **Leverage existing tooling**

   - gray-matter for parsing

   - VS Code Markdown preview works out of box

   - Standard tools (grep, sed) work on files

* * *

## Part 1: Core Format Changes

This section describes the minimal changes needed to replace JSON with Markdown+YAML
while keeping all existing workflows intact.

### 1.1 File Format Specification

#### Current JSON Format

```json
{
  "type": "is",
  "id": "is-a1b2c3",
  "version": 3,
  "kind": "bug",
  "title": "Fix authentication timeout",
  "description": "Users are getting logged out after 5 minutes.\n\nSteps to reproduce:\n1. Log in\n2. Wait 5 minutes\n3. Try to navigate",
  "notes": "Found the issue in session.ts line 42. Working on fix.",
  "status": "in_progress",
  "priority": 1,
  "assignee": "claude",
  "labels": ["backend", "security"],
  "dependencies": [{ "target": "is-f14c3d", "type": "blocks" }],
  "parent_id": null,
  "created_at": "2025-01-07T10:00:00Z",
  "updated_at": "2025-01-08T14:30:00Z",
  "created_by": "alice",
  "closed_at": null,
  "close_reason": null,
  "due_date": "2025-01-15T00:00:00Z",
  "deferred_until": null,
  "extensions": {}
}
```

#### Proposed Markdown + YAML Format

```markdown
---
type: is
id: is-a1b2c3
version: 3
kind: bug
title: Fix authentication timeout
status: in_progress
priority: 1
assignee: claude
labels:
  - backend
  - security
dependencies:
  - target: is-f14c3d
    type: blocks
parent_id: null
created_at: 2025-01-07T10:00:00Z
updated_at: 2025-01-08T14:30:00Z
created_by: alice
closed_at: null
close_reason: null
due_date: 2025-01-15T00:00:00Z
deferred_until: null
extensions: {}
---

Users are getting logged out after 5 minutes.

Steps to reproduce:

1. Log in
2. Wait 5 minutes
3. Try to navigate

---

## Notes

Found the issue in session.ts line 42. Working on fix.
```

#### File Extension

- **Option A**: `.md` (standard Markdown, most editor support)

- **Option B**: `.issue.md` (explicit, filters in glob patterns)

- **Option C**: `.tbd` (custom extension, clear ownership)

**Recommendation**: `.md` for maximum compatibility.
The YAML front matter and directory location already identify these as tbd issues.

#### File Naming

```
# Current (JSON)
.tbd/data-sync/issues/is-a1b2c3.json

# Proposed (Markdown)
.tbd/data-sync/issues/is-a1b2c3.md
```

### 1.2 Schema Changes

The schema remains largely the same, but the storage format changes.

#### Field Mapping

| Field | Location | Notes |
| --- | --- | --- |
| `type` | YAML front matter | Entity discriminator |
| `id` | YAML front matter | Issue ID |
| `version` | YAML front matter | Edit counter |
| `kind` | YAML front matter | bug/feature/task/epic/chore |
| `title` | YAML front matter | Single line |
| `status` | YAML front matter | Status enum |
| `priority` | YAML front matter | 0-4 |
| `assignee` | YAML front matter | String |
| `labels` | YAML front matter | Array |
| `dependencies` | YAML front matter | Array of objects |
| `parent_id` | YAML front matter | String or null |
| `created_at` | YAML front matter | ISO8601 |
| `updated_at` | YAML front matter | ISO8601 |
| `created_by` | YAML front matter | String |
| `closed_at` | YAML front matter | ISO8601 or null |
| `close_reason` | YAML front matter | String or null |
| `due_date` | YAML front matter | ISO8601 or null |
| `deferred_until` | YAML front matter | ISO8601 or null |
| `extensions` | YAML front matter | Object |
| `description` | Markdown body (first section) | Multi-line text |
| `notes` | Markdown body (after `## Notes`) | Multi-line text |

#### Body Structure

The Markdown body has a defined structure:

```markdown
---
(front matter)
---

(description - everything before first ## Notes heading)

## Notes

(notes - everything after ## Notes heading)
```

If there’s no `## Notes` section, the entire body is the description.
If there’s no body, both description and notes are empty strings.

#### TypeScript Parsing

```typescript
interface ParsedIssue {
  frontMatter: Omit<Issue, 'description' | 'notes'>;
  description: string;
  notes: string;
}

function parseIssueFile(content: string): ParsedIssue {
  const { data, content: body } = matter(content); // gray-matter library

  // Split body at ## Notes
  const notesMatch = body.match(/^## Notes\s*$/m);
  let description: string;
  let notes: string;

  if (notesMatch && notesMatch.index !== undefined) {
    description = body.slice(0, notesMatch.index).trim();
    notes = body.slice(notesMatch.index + notesMatch[0].length).trim();
  } else {
    description = body.trim();
    notes = '';
  }

  return {
    frontMatter: data as Omit<Issue, 'description' | 'notes'>,
    description,
    notes,
  };
}

function serializeIssue(issue: Issue): string {
  const { description, notes, ...frontMatter } = issue;

  let body = description || '';
  if (notes) {
    body += '\n\n## Notes\n\n' + notes;
  }

  return matter.stringify(body, frontMatter);
}
```

### 1.3 Canonical Serialization

For content hashing and conflict detection, we need deterministic serialization.

#### YAML Canonical Form

```yaml
# Rules for canonical YAML serialization:

# 1. Keys sorted alphabetically at each level
assignee: claude
closed_at: null
close_reason: null
created_at: 2025-01-07T10:00:00Z
created_by: alice

# 2. No flow style for arrays/objects (always block style)
labels:
  - backend
  - security

# 3. Arrays sorted by defined rules
#    - labels: lexicographic
#    - dependencies: by target field

# 4. Timestamps in ISO8601 with Z suffix (UTC)
due_date: 2025-01-15T00:00:00Z

# 5. Null values explicit (not omitted)
parent_id: null

# 6. Empty objects/arrays explicit
extensions: {}
labels: []

# 7. No trailing whitespace

# 8. Single newline at end of file

# 9. LF line endings (not CRLF)
```

#### Markdown Body Canonical Form

```markdown
# Rules for canonical body:

# 1. Trim leading/trailing whitespace from description and notes

# 2. Normalize internal whitespace (collapse multiple blank lines to single)

# 3. No trailing whitespace on lines

# 4. Single newline at end

# 5. LF line endings
```

#### Content Hash Calculation

```typescript
function calculateContentHash(issue: Issue): string {
  const canonical = serializeIssueCanonical(issue);
  return crypto.createHash('sha256').update(canonical).digest('hex').slice(0, 16);
}
```

### 1.4 Conflict Detection and Merging

The merge algorithm remains the same, but operates on the parsed structure.

#### Detection

```typescript
function hasConflict(local: Issue, remote: Issue): boolean {
  // Same as JSON: compare content hashes
  return calculateContentHash(local) !== calculateContentHash(remote);
}
```

#### Merge Rules

Merge rules from the main spec apply unchanged:

| Field | Strategy |
| --- | --- |
| `type`, `id` | immutable |
| `version` | max_plus_one |
| `title`, `status`, `priority`, `assignee`, `kind` | lww |
| `description`, `notes` | lww_with_attic |
| `labels` | union (sorted) |
| `dependencies` | merge_by_id (sorted by target) |
| `created_at`, `created_by` | preserve_oldest |
| `updated_at` | recalculate |
| `extensions` | deep_merge_by_key |

#### Body Merge

For `description` and `notes` (lww_with_attic):

1. Compare timestamps (`updated_at`)

2. Winner’s text replaces loser’s

3. Loser’s text goes to attic

No line-level merge - treat as atomic text blocks.

### 1.5 Directory Structure Changes

Minimal changes - just file extensions:

```
# On tbd-sync branch
.tbd/data-sync/
├── issues/
│   ├── is-a1b2c3.md          # Was .json
│   ├── is-f14c3d.md
│   └── is-g7h8i9.md
├── attic/
│   └── conflicts/
│       └── is-a1b2c3/
│           └── 2025-01-08T10-30-00Z_description.md  # Attic entries also Markdown
├── mappings/
│   └── beads.yaml            # Was beads.json
└── meta.yaml                 # Was meta.json
```

#### Config Files Also YAML

For consistency, all tbd files use YAML:

```
.tbd/
├── config.yaml               # Was config.yml (same format, clearer extension)
└── cache/
    ├── state.yaml            # Was state.json
    └── index.yaml            # Was index.json (or keep JSON for performance)
```

**Note**: Cache files (state, index) could remain JSON for faster parsing since they’re
not user-edited. This is an implementation choice.

### 1.6 CLI Changes

#### Create Command

```bash
# No change to interface
tbd create "Fix bug" -t bug -p 1 -d "Description here"

# Creates .tbd/data-sync/issues/is-a1b2c3.md
```

#### Show Command

```bash
tbd show bd-a1b2

# Output renders the Markdown naturally:
bd-a1b2: Fix authentication timeout

Status: in_progress | Priority: 1 | Type: bug
Assignee: claude
Labels: backend, security
Created: 2025-01-07 10:00:00 by alice
Updated: 2025-01-08 14:30:00

Description:
  Users are getting logged out after 5 minutes.

  Steps to reproduce:
  1. Log in
  2. Wait 5 minutes
  3. Try to navigate

Notes:
  Found the issue in session.ts line 42. Working on fix.
```

#### New: Raw Command

```bash
# View raw file content
tbd raw bd-a1b2

# Outputs the actual .md file content
---
type: is
id: is-a1b2c3
...
---

Users are getting logged out...
```

#### New: Edit Command

```bash
# Open in $EDITOR
tbd edit bd-a1b2

# Opens the .md file directly
# On save, validates and updates updated_at
```

### 1.7 Config File Format

Config is already YAML. Clarify the extension:

```yaml
# .tbd/config.yaml (was config.yml)

version: '1.0'

settings:
  auto_sync: false
  sync_on_create: true
  sync_on_update: false

sync:
  remote: origin
  branch: tbd-sync

display:
  id_prefix: bd
  date_format: relative
  color: auto
```

### 1.8 Migration from JSON

#### Beads Import (unchanged interface)

```bash
tbd import beads-export.jsonl
# Converts to Markdown files
```

#### JSON to Markdown Conversion

```bash
# If migrating existing tbd JSON to Markdown
tbd migrate --format markdown

# Converts all .json files to .md
# Updates references
# Single commit on sync branch
```

#### Conversion Algorithm

```typescript
function convertJsonToMarkdown(jsonPath: string): void {
  const json = JSON.parse(fs.readFileSync(jsonPath, 'utf8'));
  const markdown = serializeIssue(json);
  const mdPath = jsonPath.replace(/\.json$/, '.md');
  fs.writeFileSync(mdPath, markdown);
  fs.unlinkSync(jsonPath);
}
```

* * *

## Part 2: New Workflows

The Markdown format enables workflows that weren’t practical with JSON.

### 2.1 Main Repo Issue Storage

**Concept**: Allow issues to live in the main repo (working branches) instead of only on
the sync branch.

#### Use Cases

1. **Active work tracking**: Keep current sprint issues visible in repo

2. **Code-adjacent docs**: Issues live near the code they describe

3. **PR-linked issues**: Issue changes can be part of PRs

4. **Offline-first**: Work on issues without sync branch access

#### Directory Structure Option A: Dedicated Directory

```
repo/
├── .tbd/
│   └── config.yaml
├── issues/                    # New: issues on main branch
│   ├── active/
│   │   ├── is-a1b2c3.md      # Currently being worked on
│   │   └── is-f14c3d.md
│   └── .gitignore            # Optional: ignore if not wanted in git
├── src/
└── ...
```

#### Directory Structure Option B: Inline with Code

```
repo/
├── .tbd/
├── src/
│   ├── auth/
│   │   ├── session.ts
│   │   └── issues/           # Issues related to this module
│   │       └── is-a1b2c3.md
│   └── ...
└── ...
```

#### Sync Behavior

```bash
# Pull issues from sync branch to local directory
tbd checkout [--all | --mine | --id <id>]

# Modifies issues/ directory on current branch
# Tracked in git, part of normal commits

# Push local changes back to sync branch
tbd sync

# Merges local issues/ with sync branch
# Removes from local issues/ after sync (configurable)
```

#### Config Extension

```yaml
# .tbd/config.yaml

local_issues:
  enabled: true
  directory: issues/active # Where to checkout issues
  auto_cleanup: true # Remove after sync
  checkout_filter: assignee:me # Default filter for checkout
```

#### Workflow Example

```bash
# Start work
tbd checkout bd-a1b2
# Creates issues/active/is-a1b2c3.md

# Edit directly or via CLI
vim issues/active/is-a1b2c3.md
# or
tbd update bd-a1b2 --status in_progress

# Commit with code changes
git add -A
git commit -m "Fix auth timeout (bd-a1b2)"

# Sync back to shared branch
tbd sync
# Merges to tbd-sync, optionally removes local copy
```

### 2.2 Edit Directory Workflow

**Concept**: A staging area for batch issue editing.

#### Use Case

- Review and update multiple issues at once

- Make bulk changes via text editor or scripts

- Preview changes before sync

#### Workflow

```bash
# Export issues to edit directory
tbd export --filter "status:open assignee:me" --to ./issue-review/

# Creates:
# ./issue-review/
# ├── is-a1b2c3.md
# ├── is-f14c3d.md
# └── is-g7h8i9.md

# Edit files with any tool
vim ./issue-review/*.md
# or
sed -i 's/priority: 2/priority: 1/' ./issue-review/*.md

# Validate changes
tbd validate ./issue-review/

# Import changes back
tbd import ./issue-review/
# Validates, merges, syncs

# Or dry-run first
tbd import ./issue-review/ --dry-run
```

#### Validation

```bash
tbd validate ./issue-review/

# Output:
✓ is-a1b2c3.md: valid
✗ is-f14c3d.md: invalid priority value "high" (must be 0-4)
✓ is-g7h8i9.md: valid

1 error, 2 valid
```

### 2.3 Batch File Operations

**Concept**: Use standard Unix tools on issue files.

#### Examples

```bash
# Find all high-priority bugs
grep -l "priority: [01]" .tbd/data-sync/issues/*.md | \
  xargs grep -l "kind: bug"

# List issues by assignee
for f in .tbd/data-sync/issues/*.md; do
  assignee=$(grep "^assignee:" "$f" | cut -d: -f2 | tr -d ' ')
  echo "$assignee: $(basename $f)"
done | sort

# Bulk status change via sed (then sync)
sed -i 's/status: open/status: deferred/' .tbd/data-sync/issues/is-old*.md

# Count issues by status
grep -h "^status:" .tbd/data-sync/issues/*.md | sort | uniq -c
```

#### Integration with ripgrep/fzf

```bash
# Interactive issue search
rg --type md "authentication" .tbd/data-sync/issues/ | fzf

# Find issues mentioning a file
rg "session.ts" .tbd/data-sync/issues/
```

### 2.4 Inline Comments

**Concept**: Comments as part of the issue document.

#### Format Option A: Dedicated Section

```markdown
---
(front matter)
---

(description)

## Notes

(working notes)

## Comments

### 2025-01-08 10:30 - alice

Discussed with team, we should use refresh tokens.

### 2025-01-08 14:15 - claude

Implemented refresh token approach. PR #123.

### 2025-01-09 09:00 - bob

LGTM, merging.
```

#### Format Option B: Separate Files (Phase 2)

Keep comments as separate entities but render inline:

```bash
tbd show bd-a1b2 --with-comments
```

#### Merge Strategy for Comments

Comments section uses **append-only** merge:

- Parse comments by timestamp header

- Union all comments from both sides

- Sort by timestamp

- No data loss

### 2.5 Issue Templates

**Concept**: Predefined issue structures as Markdown templates.

#### Template Directory

```
.tbd/templates/
├── bug.md
├── feature.md
├── task.md
└── epic.md
```

#### Bug Template

```markdown
---
kind: bug
priority: 2
labels:
  - needs-triage
---

## Environment

- OS:
- Version:
- Browser (if applicable):

## Steps to Reproduce

1.
2.
3.

## Expected Behavior

## Actual Behavior

## Screenshots/Logs
```

#### Usage

```bash
tbd create --template bug "Button doesn't work"
# Opens editor with template pre-filled

tbd create --template bug "Button doesn't work" --no-edit
# Creates with template defaults
```

* * *

## Part 3: Trade-offs and Considerations

### 3.1 Advantages

#### Human Readability

- Issues are readable in any text editor, GitHub web UI, IDE

- No need for `tbd show` to understand an issue

- Markdown renders nicely in many contexts

#### Direct Editing

- Edit issues with vim, VS Code, any text editor

- No CLI required for simple changes

- Enables “edit and commit” workflow

#### Tool Integration

- Standard Unix tools work (grep, sed, awk)

- IDE Markdown preview and editing

- GitHub/GitLab render Markdown files

#### Familiar Format

- Developers know YAML and Markdown

- Same format as Jekyll, Hugo, Astro content

- Low learning curve

#### Future Flexibility

- Easy to add new sections (Comments, History, etc.)

- Can embed code blocks, images, links naturally

- Supports rich formatting for descriptions

### 3.2 Disadvantages

#### Parsing Complexity

- Need YAML parser + Markdown structure parser

- More edge cases than JSON

- Gray-matter library or equivalent required

#### Canonical Serialization

- YAML has multiple ways to represent same data

- Must enforce strict serialization rules

- More normalization code than JSON

#### Multi-line String Handling

- YAML multi-line strings have tricky semantics

- Body content can interfere with YAML parsing if not careful

- Need robust front matter delimiter handling

#### Schema Validation

- YAML doesn’t have as strong tooling as JSON Schema

- Zod works but less common for YAML validation

- Editor support (autocomplete) is weaker

#### Performance

- YAML parsing slightly slower than JSON

- Probably negligible for typical issue counts

- Index cache can mitigate

### 3.3 Implementation Complexity

#### Dependencies

```json
{
  "dependencies": {
    "gray-matter": "^4.0.3", // Front matter parsing
    "js-yaml": "^4.1.0", // YAML parsing/serialization
    "zod": "^3.22.0" // Schema validation (unchanged)
  }
}
```

#### Parsing Robustness

Need to handle edge cases:

```typescript
// Edge case 1: No front matter
const noFrontMatter = `Just a description`;

// Edge case 2: Empty front matter
const emptyFrontMatter = `---
---
Description`;

// Edge case 3: Front matter only
const frontMatterOnly = `---
title: Test
---`;

// Edge case 4: Triple-dash in body (ambiguous)
const ambiguousBody = `---
title: Test
---
Some text with --- in it`;

// Edge case 5: YAML parsing errors
const invalidYaml = `---
title: Test
labels: [unclosed
---`;
```

#### Serialization Consistency

```typescript
// Must produce identical output for identical input
const issue1 = parseIssue(serializeIssue(parseIssue(content)));
const issue2 = parseIssue(content);
assert.deepEqual(issue1, issue2);
```

### 3.4 Performance Implications

#### Parsing Benchmarks (Estimated)

| Operation | JSON | YAML+MD | Difference |
| --- | --- | --- | --- |
| Parse 1 issue | 0.1ms | 0.3ms | 3x slower |
| Parse 1000 issues | 100ms | 300ms | 3x slower |
| Serialize 1 issue | 0.05ms | 0.2ms | 4x slower |
| Index rebuild (5k issues) | 500ms | 1.5s | 3x slower |

#### Mitigation

- Index caching (already planned) makes cold parse rare

- Most operations hit index, not raw files

- 300ms for 1000 issues is still acceptable

#### Memory

- Slightly higher per-issue (YAML AST vs JSON AST)

- Not significant for typical scale (<10k issues)

* * *

## Summary: Recommended Approach

### Minimal Change (Conservative)

If adopting Markdown format with minimal spec changes:

1. Replace `.json` with `.md` for issue files

2. Use YAML front matter for structured fields

3. Description in body, notes after `## Notes`

4. Keep everything else the same (sync branch, merge rules, CLI)

5. Add `tbd edit <id>` command

6. Add `tbd raw <id>` command

### With New Workflows (Progressive)

Phase 1.5 or Phase 2 additions:

1. Local issue checkout (`tbd checkout`)

2. Edit directory workflow (`tbd export/import`)

3. Issue templates

4. Inline comments (append-only section)

### Migration Path

1. Ship JSON format in Phase 1 (as specified)

2. Add Markdown format support as alternative

3. Provide conversion tool

4. Eventually default to Markdown for new repos

Or:

1. Ship Markdown format from start in Phase 1

2. Accept slightly more implementation complexity

3. Benefit from human readability immediately

* * *

## Appendix: Complete Example Files

### Issue File: Bug

````markdown
---
type: is
id: is-a1b2c3
version: 5
kind: bug
title: Authentication timeout after 5 minutes
status: in_progress
priority: 1
assignee: claude
labels:
  - backend
  - security
  - p1
dependencies:
  - target: is-f14c3d
    type: blocks
parent_id: is-epic01
created_at: 2025-01-07T10:00:00Z
updated_at: 2025-01-09T11:30:00Z
created_by: alice
closed_at: null
close_reason: null
due_date: 2025-01-15T00:00:00Z
deferred_until: null
extensions:
  github:
    issue: 456
    pr: 789
---

Users are being logged out after exactly 5 minutes of inactivity, regardless of the
session timeout configuration.

## Environment

- Production and staging
- All browsers
- Version 2.3.1+

## Steps to Reproduce

1. Log in to the application
2. Leave the tab idle for 5 minutes
3. Try to navigate to another page
4. Observe: redirected to login

## Expected Behavior

Session should remain active for the configured timeout (30 minutes).

## Investigation

Found hardcoded `300000` (5 minutes) in `src/auth/session.ts:42`.

```typescript
// BUG: This overrides the config value
const TIMEOUT = 300000; // Should be config.sessionTimeout
```
````

## Notes

2025-01-08: Confirmed the root cause.
The hardcoded value was added in commit abc123 as a “temporary” fix during the security
audit.

2025-01-09: PR #789 ready for review.
Uses config value and adds tests.

````

### Issue File: Feature

```markdown
---
type: is
id: is-d4e5f6
version: 2
kind: feature
title: Add dark mode support
status: open
priority: 2
assignee: null
labels:
  - frontend
  - ux
  - enhancement
dependencies: []
parent_id: null
created_at: 2025-01-06T15:00:00Z
updated_at: 2025-01-06T15:00:00Z
created_by: bob
closed_at: null
close_reason: null
due_date: null
deferred_until: null
extensions: {}
---

Add a dark mode toggle to the application settings.

## Requirements

- [ ] Toggle in settings page
- [ ] Persist preference in localStorage
- [ ] Respect system preference by default
- [ ] Smooth transition animation
- [ ] Update all components

## Design

See Figma: [Dark Mode Designs](https://figma.com/...)

## Notes

Low priority but frequently requested by users.
````

### Issue File: Epic

```markdown
---
type: is
id: is-epic01
version: 1
kind: epic
title: Q1 Security Hardening
status: in_progress
priority: 1
assignee: alice
labels:
  - security
  - q1-2025
dependencies: []
parent_id: null
created_at: 2025-01-01T00:00:00Z
updated_at: 2025-01-07T10:00:00Z
created_by: alice
closed_at: null
close_reason: null
due_date: 2025-03-31T00:00:00Z
deferred_until: null
extensions: {}
---

Umbrella epic for Q1 security improvements.

## Scope

1. Fix authentication timeout bug (is-a1b2c3)
2. Implement refresh tokens
3. Add rate limiting
4. Security audit remediation

## Success Criteria

- All P1 security issues resolved
- Penetration test passed
- SOC2 audit preparation complete

## Notes

Weekly sync with security team on Tuesdays.
```

### Config File

```yaml
# .tbd/config.yaml

version: '1.0'

settings:
  auto_sync: false
  sync_on_create: true
  sync_on_update: false

sync:
  remote: origin
  branch: tbd-sync

display:
  id_prefix: bd
  date_format: relative
  color: auto

# New: local issues config
local_issues:
  enabled: false
  directory: issues/
  auto_cleanup: true

# New: templates
templates:
  directory: .tbd/templates/
  default: task
```

### Attic Entry

```markdown
---
type: attic
id: attic-2025-01-09T11-30-00Z-description
issue_id: is-a1b2c3
field: description
timestamp: 2025-01-09T11:30:00Z
winner: remote
loser: local
local_version: 4
remote_version: 5
local_updated_at: 2025-01-09T11:25:00Z
remote_updated_at: 2025-01-09T11:28:00Z
---

This is the description that was overwritten (the "loser" in LWW merge).

Users are being logged out after exactly 5 minutes...
(original local description preserved here)
```

* * *

## Open Questions

### Format Decisions

1. **File extension**: `.md` vs `.issue.md` vs `.tbd`?

   - `.md` has best editor support

   - `.issue.md` is explicit and filterable

   - Recommendation: `.md` (simplicity)

2. **Cache format**: Keep index.json for performance or convert to YAML for consistency?

   - Cache files are not user-edited

   - JSON parsing is faster

   - Recommendation: Keep cache as JSON

3. **Config format**: `config.yaml` or `config.yml`?

   - `.yaml` is more explicit (YAML spec prefers it)

   - `.yml` is common (Rails, Docker)

   - Recommendation: `.yaml` for new, accept both

### Content Decisions

4. **Comments**: Inline in document or separate entity type?

   - Inline: simpler, visible in file

   - Separate: better conflict handling, cleaner diffs

   - Recommendation: Phase 1 inline (optional section), Phase 2 separate entities

5. **Notes section marker**: `## Notes` vs `---` separator vs other?

   - `## Notes` is explicit and Markdown-native

   - `---` could conflict with front matter delimiter

   - Recommendation: `## Notes` heading

### Workflow Decisions

6. **Main repo issues**: Enable in Phase 1 or defer to Phase 2?

   - Adds complexity but high value

   - ticket proves single-location works fine

   - Recommendation: Defer to Phase 1.5, design for it now

7. **Template location**: `.tbd/templates/` or user-configurable?

   - Fixed location is simpler

   - Configurable allows shared templates

   - Recommendation: Fixed `.tbd/templates/`, consider shared later

### Migration Decisions

8. **Backward compatibility**: Support both JSON and Markdown, or Markdown only?

   - Both: more code, testing surface

   - Markdown only: cleaner, format is clearly better

   - Recommendation: Markdown only, provide one-time migration tool

9. **When to adopt**: Phase 1 launch or Phase 1.5 enhancement?

   - ticket proves format works in production

   - JSON spec is already written

   - Recommendation: Consider shipping with Markdown from start

* * *

## Recommendation Summary

Based on prior art analysis and trade-off evaluation:

**Recommended approach: Adopt Markdown + YAML front matter as the primary format.**

**Rationale:**

1. **Proven in production** - ticket manages ~1,900 issues successfully

2. **Developer-friendly** - familiar from static site generators

3. **AI-friendly** - readable context, not dense JSON

4. **Tool-rich ecosystem** - gray-matter, VS Code, standard Unix tools

5. **Enables future workflows** - main repo storage, batch editing, templates

**Implementation path:**

1. Update Phase 1 spec to use Markdown format (Part 1 of this doc)

2. Keep conflict resolution strategy (LWW + attic) unchanged

3. Add `tbd edit <id>` and `tbd raw <id>` commands

4. Defer advanced workflows (Part 2) to Phase 1.5 or Phase 2

5. Provide `tbd migrate --format markdown` for any existing JSON repos

**Key spec changes summary:**

| Section | Change |
| --- | --- |
| 2.1 File Format | JSON → Markdown + YAML front matter |
| 2.2 Directory Structure | `.json` → `.md` extensions |
| 2.5 Schemas | Parse from YAML, body for description/notes |
| 3.5 Merge Rules | Unchanged (operate on parsed structure) |
| 4.x CLI | Add `edit`, `raw` commands |
| 6.1 Performance | gray-matter parsing, may keep JSON cache |

* * *

## References

- [ticket (wedow/ticket)](https://github.com/wedow/ticket) - Production Markdown issue
  tracker

- [TrackDown](https://github.com/mgoellnitz/trackdown) - Single-file Markdown tracking

- [git-issue](https://github.com/dspinellis/git-issue) - Decentralized Git-based issues

- [git-bug](https://github.com/git-bug/git-bug) - Distributed bug tracker in Git objects

- [gray-matter](https://github.com/jonschlinkert/gray-matter) - YAML front matter parser

- [Front Matter CMS](https://frontmatter.codes/) - VS Code CMS extension

- [Hugo Front Matter](https://gohugo.io/content-management/front-matter/) - SSG
  documentation

* * *

*End of Exploration Document*
