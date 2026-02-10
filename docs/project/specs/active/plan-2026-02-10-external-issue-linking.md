# Feature: External Issue Linking

**Date:** 2026-02-10 (last updated 2026-02-10)

**Author:** Joshua Levy / Claude

**Status:** Draft

## Overview

Add support for optionally linking tbd beads to external issue tracker issues,
starting with GitHub Issues as the v1 provider. This enables bidirectional status
sync, label sync, and provides easy clickable URLs to the external issue from
any bead rendering.

The feature follows the same architectural pattern as `spec_path` linking: an optional
field on the bead, with inheritance from parent epics to child beads, and propagation
on updates.

## Goals

- Add an optional `external_issue_url` field to the bead schema for linking to
  external issue tracker URLs (GitHub Issues for v1)
- Parse and validate GitHub issue URLs to extract owner, repo, and issue number
- Verify at link time that the issue exists and is accessible via `gh` CLI
- Inherit external issue links from parent beads to children (same pattern as
  `spec_path`)
- Propagate external issue link changes from parent to children
- Sync bead status changes to linked GitHub issues (closing a bead closes the
  GitHub issue)
- Sync label changes bidirectionally between beads and GitHub issues
- Ensure `gh` CLI availability is checked in health/doctor commands
- Update the design doc to reflect the new field, status mapping, and sync behaviors

## Non-Goals

- Full bidirectional comment sync (future GitHub Bridge feature)
- Webhook-driven real-time sync (future enhancement; this is CLI-triggered sync)
- Support for non-GitHub providers in v1 (Jira, Linear, etc. are future work)
- Required linking (it remains optional, like `spec_path`)
- Multiple external issue links per bead (single URL is sufficient for v1)
- Automatic issue creation on GitHub when a bead is created (manual linking only)

## Background

### Current State

Beads have rich metadata including `spec_path` for linking to spec documents, but
no way to link to external issue trackers. The design doc (§8.7) describes external
issue tracker linking as a planned future feature, recommending a `linked` metadata
structure with provider-specific fields.

**Existing patterns we build on:**

1. **`spec_path` field and inheritance** (`schemas.ts:149-150`, `create.ts:113-119`,
   `update.ts:151-164`): Optional string field with parent-to-child inheritance on
   create and propagation on update. This is the direct template for
   `external_issue_url`.

2. **GitHub URL parsing** (`github-fetch.ts`): Existing regex patterns for parsing
   GitHub blob/raw URLs. No issue URL parsing exists yet, but the pattern is
   established.

3. **`gh` CLI availability** (`setup.ts`, `ensure-gh-cli.sh`): The `use_gh_cli`
   config setting and SessionStart hook ensure `gh` CLI is installed. But the `doctor`
   command does not currently check for `gh` availability.

4. **Merge strategy** (`git.ts:277-308`): `spec_path` uses `lww` (last-write-wins).
   The same strategy applies to `external_issue_url`.

5. **Design doc §8.7** (`tbd-design.md:5717-5779`): Describes the metadata model
   for external issue linking with `linked` array and provider-specific fields.

### GitHub Issues: States and Labels

GitHub Issues have a simple state model:

| `state` | `state_reason` | Meaning |
| --- | --- | --- |
| `open` | `null` | Issue is open |
| `open` | `reopened` | Issue was reopened |
| `closed` | `completed` | Closed as done/resolved (default) |
| `closed` | `not_planned` | Closed as won't fix / not planned |
| `closed` | `duplicate` | Closed as duplicate (undocumented) |

GitHub labels are free-form strings attached to issues, similar to tbd labels.

### tbd Bead Status States

| Status | Meaning |
| --- | --- |
| `open` | Not started |
| `in_progress` | Actively being worked on |
| `blocked` | Waiting on a dependency |
| `deferred` | Postponed |
| `closed` | Complete |

### Status Mapping: tbd → GitHub

The following mapping defines how bead status changes propagate to linked GitHub
issues. This mapping is defined in one place and could be extended for other
providers in the future.

| tbd Status | GitHub Action | GitHub State | GitHub `state_reason` |
| --- | --- | --- | --- |
| `open` | Reopen issue (if closed) | `open` | — |
| `in_progress` | Reopen issue (if closed) | `open` | — |
| `blocked` | No change | — | — |
| `deferred` | Close as not planned | `closed` | `not_planned` |
| `closed` | Close as completed | `closed` | `completed` |

### Status Mapping: GitHub → tbd

When pulling from GitHub during `tbd sync --external`, the reverse mapping:

| GitHub State | GitHub `state_reason` | tbd Status |
| --- | --- | --- |
| `open` | `null` or `reopened` | `open` (only if bead is `closed` or `deferred`) |
| `closed` | `completed` | `closed` |
| `closed` | `not_planned` | `deferred` |
| `closed` | `duplicate` | `closed` |

Note: `blocked` and `in_progress` have no GitHub equivalent. If GitHub reopens an
issue that was `in_progress`, the bead stays `in_progress`. If GitHub closes an issue
that was `blocked`, the bead moves to `closed`.

### Label Mapping

Labels sync bidirectionally:

- **tbd → GitHub**: At sync time, labels added/removed on a bead since last sync
  are pushed to the linked GitHub issue.
- **GitHub → tbd**: At sync time, labels added/removed on the GitHub issue since
  last sync are pulled into the bead.
- Labels are matched by exact string equality.
- Label sync is additive for union merges: if both sides add different labels, both
  end up with the union.

**Label auto-creation on GitHub**: The GitHub API does NOT auto-create labels
when adding them to an issue. If a tbd bead has a label that doesn't exist as a
GitHub repo label, we must create it first. The implementation should:

1. Attempt `POST /repos/{owner}/{repo}/labels` with the label name (use a default
   color). If the label already exists, GitHub returns 422 — ignore that error.
2. Then `POST /repos/{owner}/{repo}/issues/{number}/labels` to add it to the issue.

This two-step approach is idempotent and handles both new and existing labels.

## Design

### Approach

1. **New schema field**: Add `external_issue_url` as an optional nullable string
   field on `IssueSchema`, following the `spec_path` pattern.

2. **GitHub URL parser**: Create a `github-issues.ts` module with functions to
   parse GitHub issue URLs, extract `{owner, repo, number}`, validate via `gh` CLI,
   and perform status/label operations.

3. **Generic inheritable field system**: Extract the existing `spec_path`
   parent-to-child inheritance logic into a reusable module that any field can opt
   into. Both `spec_path` and `external_issue_url` use this shared logic — no
   copy-pasting of inheritance code.

4. **Sync-at-sync-time**: External issue sync happens only when `tbd sync` is
   called, not on individual bead operations. This makes local operations a
   staging area — you can create, update, close, and label beads freely, then
   sync everything in one batch. This mirrors how `--issues` syncs to the git
   sync branch and `--docs` syncs doc caches: `--external` syncs to linked
   external issues.

5. **Bidirectional status and label sync**: At sync time, push local status/label
   changes to GitHub and pull GitHub status/label changes to local beads, using
   the mapping tables.

6. **Doctor check**: Add a `gh` CLI availability check to the `doctor` command.

### Components

| Component | File(s) | Purpose |
| --- | --- | --- |
| Schema | `schemas.ts` | Add `external_issue_url` field |
| Inheritable fields | `inheritable-fields.ts` (new) | Generic parent→child field inheritance/propagation |
| URL Parser | `github-issues.ts` (new) | Parse, validate, and operate on GitHub issues |
| Create | `create.ts` | `--external-issue` flag, uses inheritable fields |
| Update | `update.ts` | `--external-issue` flag, uses inheritable fields |
| Show | `show.ts` | Display external issue URL with highlighting |
| List | `list.ts` | `--external-issue` filter option |
| Sync | `sync.ts` | Add `--external` scope for external issue sync |
| Doctor | `doctor.ts` | Add `gh` CLI health check |
| Merge rules | `git.ts` | Add `external_issue_url: 'lww'` |
| Status mapping | `github-issues.ts` | Hardcoded mapping table |

### Schema Changes

Add to `IssueSchema` in `packages/tbd/src/lib/schemas.ts`:

```typescript
// External issue linking - URL to linked external issue (e.g., GitHub Issues)
external_issue_url: z.string().url().nullable().optional(),
```

### GitHub Issue URL Parsing

New module `packages/tbd/src/file/github-issues.ts`:

```typescript
// Matches: https://github.com/{owner}/{repo}/issues/{number}
const GITHUB_ISSUE_RE = /^https?:\/\/github\.com\/([^/]+)\/([^/]+)\/issues\/(\d+)$/;

interface GitHubIssueRef {
  owner: string;
  repo: string;
  number: number;
  url: string;
}

function parseGitHubIssueUrl(url: string): GitHubIssueRef | null;
function isGitHubIssueUrl(url: string): boolean;
async function validateGitHubIssue(ref: GitHubIssueRef): Promise<boolean>;
async function closeGitHubIssue(ref: GitHubIssueRef, reason: 'completed' | 'not_planned'): Promise<void>;
async function reopenGitHubIssue(ref: GitHubIssueRef): Promise<void>;
async function addGitHubLabel(ref: GitHubIssueRef, label: string): Promise<void>;
async function removeGitHubLabel(ref: GitHubIssueRef, label: string): Promise<void>;
async function getGitHubIssueState(ref: GitHubIssueRef): Promise<{state: string, state_reason: string | null, labels: string[]}>;
```

All GitHub API operations use `gh api` via child process, leveraging the existing
`gh` CLI that `ensure-gh-cli.sh` installs.

### Generic Inheritable Field System

Currently, `spec_path` inheritance is implemented with inline logic in `create.ts`
(lines 113-119) and `update.ts` (lines 94-104, 151-164). Rather than copy-pasting
this logic for `external_issue_url`, we extract it into a generic system.

New module `packages/tbd/src/lib/inheritable-fields.ts`:

```typescript
import type { Issue } from './types.js';

/**
 * Configuration for a field that inherits from parent to child beads.
 * All inheritable fields follow the same three rules:
 *
 * 1. On create with --parent: if the field is not explicitly set, inherit
 *    from parent.
 * 2. On re-parenting: if the field is not explicitly set and the child has
 *    no value, inherit from new parent.
 * 3. On parent update: if the field changes on the parent, propagate to
 *    children whose field is null or matches the old value.
 */
interface InheritableFieldConfig {
  /** The field name on the Issue type */
  field: keyof Issue;
}

/** Registry of all inheritable fields */
const INHERITABLE_FIELDS: InheritableFieldConfig[] = [
  { field: 'spec_path' },
  { field: 'external_issue_url' },
];

/**
 * Inherit fields from a parent issue to a child issue being created.
 * For each inheritable field: if the child has no explicit value,
 * copy from parent.
 */
function inheritFromParent(
  child: Partial<Issue>,
  parent: Issue,
  explicitlySet: Set<keyof Issue>,
): void;

/**
 * Propagate field changes from a parent to its children.
 * For each inheritable field that changed on the parent:
 * update children whose value is null or matches the old value.
 */
async function propagateToChildren(
  parent: Issue,
  oldValues: Partial<Issue>,
  children: Issue[],
  writeIssueFn: (issue: Issue) => Promise<void>,
): Promise<void>;
```

**Key design points:**

- `INHERITABLE_FIELDS` is the single registry. Adding a new inheritable field
  means adding one entry here — no other code changes needed for inheritance.
- The `create` and `update` commands call these shared functions instead of
  inline field-specific logic.
- The existing `spec_path` inline logic is refactored to use this system as
  part of this feature (not just `external_issue_url`).
- `explicitlySet` tracks which fields the user provided via CLI flags, so we
  only inherit fields the user didn't explicitly set.

**Three inheritance rules (same for all fields):**

1. **On create with `--parent`**: If the field was not explicitly provided via
   a CLI flag but the parent has a value, the child inherits it.
2. **On re-parenting** (via `update --parent`): If the field was not explicitly
   provided and the child's current value is null, inherit from the new parent.
3. **On parent field update**: When a parent's inheritable field changes,
   propagate to all children whose field is null or still matches the old
   (inherited) value. Children with explicitly different values are untouched.

### API Changes

#### CLI Flags

| Command | New Flag | Purpose |
| --- | --- | --- |
| `tbd create` | `--external-issue <url>` | Link to external issue |
| `tbd update` | `--external-issue <url>` | Set/change external issue link |
| `tbd list` | `--external-issue [url]` | Filter by external issue link |
| `tbd show` | (no flag; auto-displayed) | Shows URL in output |

#### Merge Rules Addition

In `git.ts` `FIELD_STRATEGIES`:
```typescript
external_issue_url: 'lww',
```

### Sync Architecture: Scoped Sync with Staging

**Key principle**: Individual bead operations (`create`, `update`, `close`,
`label add`, etc.) only modify the local data. No external side effects.
External sync happens only when `tbd sync` is called.

This means the local worktree acts as a **staging area**. You can make a
batch of changes — close several beads, add labels, update statuses — and
none of it touches GitHub until you explicitly sync. This also means you
can abort changes (e.g., via workspace operations) before they're pushed
externally.

**Existing sync scopes** (`sync.ts`):

| Flag | Scope | What it syncs |
| --- | --- | --- |
| `--issues` | Git sync branch | Push/pull bead data via `tbd-sync` branch |
| `--docs` | Doc cache | Sync docs from configured sources |

**New sync scope**:

| Flag | Scope | What it syncs |
| --- | --- | --- |
| `--external` | External issues | Push/pull status and labels to/from linked GitHub issues |

**Default behavior**: `tbd sync` (no flags) syncs all scopes: issues, docs,
and external. Selective flags (`--issues`, `--docs`, `--external`) let you
choose which scopes to sync.

**Full sync ordering** (when `tbd sync` runs all scopes):

The sync phases are ordered so that on failure at any step, the data is in
a sane, consistent state. The key insight: pull from external sources
*before* committing issues to git, and push to external sources *after*
committing to git.

```
Phase 1: Pull from external → local beads    (external-pull)
Phase 2: Sync docs                            (docs)
Phase 3: Sync issues to git (push/pull)       (issues)
Phase 4: Push from local beads → external     (external-push)
```

**Why this order:**

- **External-pull first** (Phase 1): Captures any changes made on GitHub
  (status changes, label changes by collaborators) into local beads before
  those beads are committed to the git sync branch. This means the git
  commit reflects the latest merged state from all sources.

- **Issues sync in the middle** (Phase 3): After pulling external changes,
  commit the local bead data (which now includes merged external state)
  to the git sync branch. If this fails (e.g., merge conflict, push
  rejection), the external state has already been captured locally but
  nothing has been pushed externally yet — a safe state.

- **External-push last** (Phase 4): Only after the local bead state has
  been successfully committed to git do we push changes to external
  trackers. This means the git sync branch is the source of truth. If
  the external push fails partway through, the git state is already
  consistent and the next sync will retry the external push.

**If any phase fails**, subsequent phases still attempt to run (best-effort),
but the overall sync returns a non-zero exit code.

**External sync flow** (detail of Phases 1 and 4):

*Phase 1 — External-pull:*
1. Find all beads with a non-null `external_issue_url`
2. For each linked bead, fetch current GitHub issue state via `gh api`
3. If GitHub state differs from bead, apply the reverse mapping:
   - Update bead status per the GitHub → tbd mapping table
   - Pull label changes from GitHub into the bead
4. Conflict resolution: If both sides changed since last sync, local wins
   (consistent with LWW merge strategy). The losing value is logged.

*Phase 4 — External-push:*
1. For each bead with a non-null `external_issue_url`
2. If bead status or labels differ from what GitHub has (based on the
   state fetched in Phase 1), push local changes to GitHub:
   - Map bead status to GitHub state and update via `gh api`
   - Sync label diff to GitHub (with auto-creation as needed)
3. Report a summary of synced issues (e.g., "Synced 3 external issues:
   2 pushed, 1 pulled, 1 unchanged")

### `use_gh_cli` Configuration Gate

All external issue features require the GitHub CLI (`gh`). The existing
`use_gh_cli` config setting (in `.tbd/config.yml` under `settings:`,
default `true`) serves as the master gate for all external issue functionality.

**When `use_gh_cli` is `false`:**

- `--external-issue` flag on `create`/`update` is **rejected** with a clear
  error: "External issue linking requires GitHub CLI. Set `use_gh_cli: true`
  in config or run `tbd setup --auto`."
- `tbd sync --external` is a **no-op** with a warning: "External sync skipped:
  GitHub CLI is disabled (use_gh_cli: false)."
- `tbd sync` (no flags) silently skips the external sync phases (phases 1 and
  4) — issues and docs sync still run normally.
- The `external_issue_url` field on the schema is unaffected — beads may still
  have the field populated (e.g., from a collaborator who has `gh` enabled),
  but no sync or validation occurs locally.
- The `doctor` command's `gh` CLI check reports "skipped" rather than a warning
  when `use_gh_cli` is `false`.

**When `use_gh_cli` is `true` (default):**

- All external issue features are available.
- The `--external-issue` flag validates the URL and verifies the issue exists
  via `gh api`.
- `tbd sync` includes the external sync phases.
- The `doctor` command checks `gh` availability and auth status.

This gating behavior must be clearly documented in:
- CLI `--help` text for `--external-issue` flags
- Error messages (always suggest how to enable)
- The design doc §8.7
- The README (GitHub authentication section)
- The `setup-github-cli` shortcut

### Error Handling

- At link time (`--external-issue` on `create`/`update`):
  - If `use_gh_cli` is `false`, reject immediately with a clear error.
  - If `use_gh_cli` is `true`, validate the URL format first (must be a full
    GitHub issue URL like `https://github.com/owner/repo/issues/123`), then
    verify the issue exists via `gh api`. Clear error messages for each
    failure mode:
    - Not a URL → "Invalid URL. Expected a full GitHub issue URL like
      https://github.com/owner/repo/issues/123"
    - GitHub PR URL → "This is a pull request URL, not an issue URL.
      Expected: https://github.com/owner/repo/issues/123"
    - Non-GitHub URL → "Only GitHub issue URLs are supported. Expected:
      https://github.com/owner/repo/issues/123"
    - Valid URL but 404 → "Issue not found or not accessible. Check the URL
      and your GitHub authentication (`gh auth status`)."
- During `tbd sync --external`:
  - If `use_gh_cli` is `false`, skip with warning (see above).
  - If `gh` CLI is not installed or not authenticated, log a warning and skip
    external sync. Return non-zero exit code.
  - If a GitHub API call fails for a specific issue (network error, auth error,
    permission error), log the error for that issue, continue syncing other
    issues, and return non-zero exit code at the end.
  - Individual issue sync failures do not block other issues from syncing.
- All errors are surfaced to the user, never silently swallowed.

## Implementation Plan

Each phase lists the exact source files, line numbers, and nature of changes.
Line numbers are approximate (based on current state) and may shift as earlier
phases are implemented.

---

### Phase 1: Schema, URL Parsing, Inheritable Fields, and Core Linking

Add the field, extract inheritable field logic, parse GitHub URLs, validate
issues, and wire up the basic create/update/show/list functionality. No status
or label sync yet.

#### 1a. Schema and Merge Rules

**`packages/tbd/src/lib/schemas.ts`** (line 149, after `spec_path`):
- [ ] Add field to `IssueSchema`:
  ```typescript
  external_issue_url: z.string().url().nullable().optional(),
  ```
- [ ] This auto-propagates to the `Issue` type via `types.ts:28`
  (`type Issue = z.infer<typeof IssueSchema>`)

**`packages/tbd/src/file/git.ts`** (line 300, after `spec_path: 'lww'`):
- [ ] Add merge rule:
  ```typescript
  external_issue_url: 'lww',
  ```

**`packages/tbd/src/lib/types.ts`** (lines 81-91, 96-109):
- [ ] Add `external_issue_url?: string | null` to `CreateIssueOptions`
- [ ] Add `external_issue_url?: string | null` to `UpdateIssueOptions`

**Tests:**
- [ ] Add `external_issue_url` validation cases to `schemas.test.ts`
- [ ] Add LWW merge test for `external_issue_url` in `git.test.ts`

#### 1b. GitHub Issue URL Parser

**`packages/tbd/src/file/github-issues.ts`** (NEW FILE):

Place alongside `github-fetch.ts` (existing GitHub URL utilities).

```typescript
// Regex: https://github.com/{owner}/{repo}/issues/{number}
const GITHUB_ISSUE_RE = /^https?:\/\/github\.com\/([^/]+)\/([^/]+)\/issues\/(\d+)$/;

// Also need a PR detection regex for better error messages
const GITHUB_PR_RE = /^https?:\/\/github\.com\/([^/]+)\/([^/]+)\/pull\/(\d+)$/;

interface GitHubIssueRef { owner: string; repo: string; number: number; url: string; }

export function parseGitHubIssueUrl(url: string): GitHubIssueRef | null;
export function isGitHubIssueUrl(url: string): boolean;
export function isGitHubPrUrl(url: string): boolean;
export function formatGitHubIssueRef(ref: GitHubIssueRef): string; // → "owner/repo#123"

// gh api operations (all use execFile('gh', [...]) like github-fetch.ts:16)
export async function validateGitHubIssue(ref: GitHubIssueRef): Promise<boolean>;
export async function getGitHubIssueState(ref: GitHubIssueRef): Promise<{
  state: string; state_reason: string | null; labels: string[];
}>;
export async function closeGitHubIssue(
  ref: GitHubIssueRef, reason: 'completed' | 'not_planned'
): Promise<void>;
export async function reopenGitHubIssue(ref: GitHubIssueRef): Promise<void>;
export async function addGitHubLabel(ref: GitHubIssueRef, label: string): Promise<void>;
export async function removeGitHubLabel(ref: GitHubIssueRef, label: string): Promise<void>;
```

**Pattern reference:** `github-fetch.ts:12-16` uses `execFile` + `promisify`
for `gh api` calls. Follow same pattern.

**`packages/tbd/src/file/github-issues.test.ts`** (NEW FILE):
- [ ] URL parsing: valid URLs, trailing slash, query params, PR URLs, blob
  URLs, non-GitHub, malformed, no issue number, non-numeric
- [ ] Format: `parseGitHubIssueUrl` → correct owner/repo/number
- [ ] Detection: `isGitHubIssueUrl()`, `isGitHubPrUrl()`

#### 1c. Generic Inheritable Field System

**`packages/tbd/src/lib/inheritable-fields.ts`** (NEW FILE):

```typescript
import type { Issue } from './types.js';

interface InheritableFieldConfig {
  field: keyof Issue;
}

export const INHERITABLE_FIELDS: InheritableFieldConfig[] = [
  { field: 'spec_path' },
  { field: 'external_issue_url' },
];

export function inheritFromParent(
  child: Partial<Issue>,
  parent: Issue,
  explicitlySet: Set<keyof Issue>,
): void;

export async function propagateToChildren(
  parent: Issue,
  oldValues: Partial<Record<keyof Issue, unknown>>,
  children: Issue[],
  writeIssueFn: (issue: Issue) => Promise<void>,
): Promise<number>; // returns count of updated children
```

**`packages/tbd/src/lib/inheritable-fields.test.ts`** (NEW FILE):
- [ ] `inheritFromParent()` copies registered fields from parent when not
  explicitly set
- [ ] `inheritFromParent()` does NOT overwrite explicitly set fields
- [ ] `propagateToChildren()` updates children with null or old-matching values
- [ ] `propagateToChildren()` skips children with different values
- [ ] Both `spec_path` and `external_issue_url` are exercised

#### 1d. Refactor `create.ts` to Use Inheritable Fields

**`packages/tbd/src/cli/commands/create.ts`**:

Current inline `spec_path` inheritance (lines 113-119):
```typescript
// Inherit spec_path from parent if not explicitly provided
if (!specPath && parentId) {
  const parentIssue = await readIssue(dataSyncDir, parentId);
  if (parentIssue.spec_path) {
    specPath = parentIssue.spec_path;
  }
}
```

Changes needed:
- [ ] **Line 29-41** (`CreateOptions` interface): Add `externalIssue?: string`
- [ ] **Lines 67-76** (spec validation block): Add parallel validation block
  for `--external-issue`:
  - Read config to check `use_gh_cli` (`readConfig` already imported, line 26)
  - If `use_gh_cli` is false, throw `ValidationError` with clear message
  - Parse URL via `parseGitHubIssueUrl()`
  - Validate issue exists via `validateGitHubIssue()`
- [ ] **Lines 113-119** (spec_path inheritance): Replace with call to
  `inheritFromParent()` from `inheritable-fields.ts`. Pass a
  `Set<keyof Issue>` tracking which fields the user explicitly provided
  (`spec_path` if `--spec` was given, `external_issue_url` if
  `--external-issue` was given).
- [ ] **Line 138** (`spec_path: specPath`): Add `external_issue_url` to the
  issue data object
- [ ] **Line 201** (Commander `.option('--spec ...')`): Add:
  ```typescript
  .option('--external-issue <url>',
    'Link to GitHub issue (e.g., https://github.com/owner/repo/issues/123). Requires use_gh_cli: true')
  ```

#### 1e. Refactor `update.ts` to Use Inheritable Fields

**`packages/tbd/src/cli/commands/update.ts`**:

Current inline logic:
- `spec_path` re-parenting inheritance (lines 94-104)
- `spec_path` propagation to children (lines 151-164)

Changes needed:
- [ ] **Line 30-41** (`UpdateOptions` interface): Add `externalIssue?: string`
- [ ] **Lines 76-77** (`oldSpecPath` capture): Generalize to capture old
  values for all inheritable fields:
  ```typescript
  const oldInheritableValues: Partial<Record<keyof Issue, unknown>> = {};
  for (const config of INHERITABLE_FIELDS) {
    oldInheritableValues[config.field] = issue[config.field];
  }
  ```
- [ ] **Line 90** (`spec_path` update): Add `external_issue_url` update
  alongside:
  ```typescript
  if (updates.external_issue_url !== undefined)
    issue.external_issue_url = updates.external_issue_url;
  ```
- [ ] **Lines 94-104** (re-parenting inheritance): Replace inline
  `spec_path`-specific logic with `inheritFromParent()` call. Track
  `explicitlySet` from CLI flags.
- [ ] **Lines 151-164** (propagation to children): Replace inline
  `spec_path`-specific logic with `propagateToChildren()` call. Pass
  `oldInheritableValues` and write function.
- [ ] **Lines 371-383** (spec CLI option handling in `buildUpdates`):
  Add parallel block for `--external-issue`:
  - If non-empty: validate URL format, check `use_gh_cli`, validate via
    `gh api`, set `updates.external_issue_url`
  - If empty string: set `updates.external_issue_url = null` (clear)
- [ ] **Line 437** (Commander `.option('--spec ...')`): Add:
  ```typescript
  .option('--external-issue <url>',
    'Set or clear external issue (empty clears). Requires use_gh_cli: true')
  ```

#### 1f. Update `show.ts` Display

**`packages/tbd/src/cli/commands/show.ts`** (lines 69-70):

Current `spec_path` highlighting:
```typescript
} else if (line.startsWith('spec_path:')) {
  console.log(`${colors.dim('spec_path:')} ${colors.id(line.slice(11))}`);
```

- [ ] Add after line 70:
  ```typescript
  } else if (line.startsWith('external_issue_url:')) {
    console.log(`${colors.dim('external_issue_url:')} ${colors.id(line.slice(20))}`);
  ```

#### 1g. Add `--external-issue` Filter to `list.ts`

**`packages/tbd/src/cli/commands/list.ts`**:

- [ ] **Line 33-50** (`ListOptions` interface): Add `externalIssue?: string`
- [ ] **Lines 192-260** (`filterIssues` method): Add filter block after
  the `spec` filter (lines 247-251):
  ```typescript
  // External issue filter
  if (options.externalIssue) {
    if (!issue.external_issue_url) return false;
    // If a specific URL is given, match it; otherwise just filter for
    // any linked issue
    if (options.externalIssue !== 'true' &&
        issue.external_issue_url !== options.externalIssue) {
      return false;
    }
  }
  ```
- [ ] **Line 96** (`displayIssues` mapping): Add
  `external_issue_url: i.external_issue_url ?? undefined` after `spec_path`
- [ ] **Lines 289-316** (Commander options): Add after `--spec`:
  ```typescript
  .option('--external-issue [url]',
    'Filter by external issue (URL optional, shows all linked if no URL given)')
  ```

#### 1h. Golden Tests

**`packages/tbd/tests/cli-external-issue-linking.tryscript.md`** (NEW FILE):
- [ ] Basic CRUD with `--external-issue`
- [ ] URL validation error scenarios (PR URL, non-GitHub, malformed, etc.)
- [ ] Show displays URL, list filters by URL

**`packages/tbd/tests/cli-inheritable-fields.tryscript.md`** (NEW FILE):
- [ ] 5 scenarios from Testing Strategy section (parent-to-child, propagation,
  re-parenting, clearing, mixed inheritance)
- [ ] Both `spec_path` and `external_issue_url` exercised in each scenario

#### 1i. Verification

- [ ] All existing `spec_path` tryscript tests pass (the refactor to
  `inheritable-fields.ts` must be behavior-preserving)
- [ ] `pnpm test` passes
- [ ] `pnpm build` passes

---

### Phase 2: `gh` CLI Health Check and Setup Validation

Ensure `gh` CLI availability is verified in `doctor` and that the setup flow
properly validates GitHub access.

**`packages/tbd/src/cli/commands/doctor.ts`**:

- [ ] **Lines 136-142** (integration checks): Add a third integration check:
  ```typescript
  // Integration 3: GitHub CLI (gh)
  integrationChecks.push(await this.checkGhCli());
  ```
- [ ] Add new method `checkGhCli()` (after `checkCodexAgents()`, line ~602):
  ```typescript
  private async checkGhCli(): Promise<DiagnosticResult> {
    // If use_gh_cli is false, report as skipped
    if (this.config?.settings?.use_gh_cli === false) {
      return {
        name: 'GitHub CLI (gh)',
        status: 'ok',
        message: 'disabled (use_gh_cli: false)',
      };
    }
    // Check if gh is available
    try {
      await execFileAsync('gh', ['--version']);
    } catch {
      return {
        name: 'GitHub CLI (gh)',
        status: 'warn',
        message: 'not found in PATH',
        suggestion: 'Run: tbd setup --auto, or set use_gh_cli: false',
      };
    }
    // Check auth
    try {
      await execFileAsync('gh', ['auth', 'status']);
      return { name: 'GitHub CLI (gh)', status: 'ok' };
    } catch {
      return {
        name: 'GitHub CLI (gh)',
        status: 'warn',
        message: 'not authenticated',
        suggestion: 'Run: gh auth login, or set GH_TOKEN env var',
      };
    }
  }
  ```
- [ ] **Line 10** (imports): Add `execFile` from `node:child_process` and
  `promisify` from `node:util` (or reuse from git.ts)

**Tests:**
- [ ] Add `checkGhCli` test cases to doctor tests: gh missing, gh
  unauthenticated, gh available, use_gh_cli=false
- [ ] Verify existing doctor tests still pass

---

### Phase 3: External Sync Scope and Status Sync

Add `--external` scope to `tbd sync` and implement bidirectional status sync
with the correct two-phase ordering (pull before git commit, push after).

#### 3a. Sync Scope Changes

**`packages/tbd/src/cli/commands/sync.ts`**:

- [ ] **Lines 58-65** (`SyncOptions` interface): Add `external?: boolean`:
  ```typescript
  interface SyncOptions {
    push?: boolean;
    pull?: boolean;
    local?: boolean;
    issues?: boolean;
    docs?: boolean;
    external?: boolean;  // NEW
  }
  ```
- [ ] **Lines 89-103** (scope selection logic): Extend to handle `--external`:
  ```typescript
  const hasSelectiveFlag = Boolean(options.issues) || Boolean(options.docs)
    || Boolean(options.external);
  // ...
  const syncExternal = Boolean(options.external)
    || (!hasSelectiveFlag && !hasExclusiveIssueFlag);
  ```
  Also: `--push`/`--pull` should be rejected with `--external` (like `--docs`).
- [ ] **Lines 105-116** (sync steps): Reorder to 4 phases:
  ```
  // Phase 1: External-pull (if syncExternal && use_gh_cli)
  // Phase 2: Docs sync (if syncDocs)
  // Phase 3: Issues git sync (if syncIssues)
  // Phase 4: External-push (if syncExternal && use_gh_cli)
  ```
  The `use_gh_cli` gate check: read config, check
  `config.settings.use_gh_cli`. If false:
  - `--external` explicitly → warn "External sync skipped: use_gh_cli is false"
  - default (no flags) → silently skip phases 1/4
- [ ] **Lines 1100-1113** (Commander definition): Add option:
  ```typescript
  .option('--external', 'Sync only external issues (not issues or docs)')
  ```

#### 3b. External Sync Implementation

**`packages/tbd/src/cli/commands/sync.ts`** (new methods):

- [ ] Add `syncExternalPull()` method:
  - Load all beads via `listIssues(dataSyncDir)`
  - Filter to beads with non-null `external_issue_url`
  - For each: parse URL, call `getGitHubIssueState()`, apply reverse mapping
  - Write updated beads via `writeIssue()`
  - Return count of updated beads
- [ ] Add `syncExternalPush()` method:
  - For each linked bead: compare local state to fetched state (from pull)
  - Push status via `closeGitHubIssue()` / `reopenGitHubIssue()`
  - Return count of pushed changes
- [ ] Add summary output: "Synced N external issues: X pulled, Y pushed,
  Z unchanged"

**`packages/tbd/src/file/github-issues.ts`** (status mapping tables):

- [ ] Add status mapping constants:
  ```typescript
  // tbd → GitHub mapping
  const TBD_TO_GITHUB_STATUS: Record<string, { state: string; state_reason?: string } | null> = {
    open: { state: 'open' },
    in_progress: { state: 'open' },
    blocked: null, // no change
    deferred: { state: 'closed', state_reason: 'not_planned' },
    closed: { state: 'closed', state_reason: 'completed' },
  };

  // GitHub → tbd mapping
  function githubToTbdStatus(
    state: string, stateReason: string | null, currentTbdStatus: string
  ): string | null;
  ```

**Tests:**
- [ ] Status mapping unit tests in `github-issues.test.ts`
- [ ] Sync scope selection unit tests in `sync.test.ts`
- [ ] Mock `gh api` calls to test sync flow end-to-end
- [ ] Golden tryscript tests for sync behavior

---

### Phase 4: Label Sync (bidirectional, optional)

Add bidirectional label sync as part of the external sync scope. This phase
is optional and can be deferred.

**`packages/tbd/src/file/github-issues.ts`**:

- [ ] Add `addGitHubLabel()`:
  - Step 1: `POST /repos/{owner}/{repo}/labels` (create if needed, ignore 422)
  - Step 2: `POST /repos/{owner}/{repo}/issues/{number}/labels`
- [ ] Add `removeGitHubLabel()`:
  - `DELETE /repos/{owner}/{repo}/issues/{number}/labels/{label}`
- [ ] Add `computeLabelDiff()` helper:
  ```typescript
  function computeLabelDiff(
    localLabels: string[], remoteLabels: string[]
  ): { toAdd: string[]; toRemove: string[] };
  ```

**`packages/tbd/src/cli/commands/sync.ts`**:

- [ ] Extend `syncExternalPull()` to also pull label changes
- [ ] Extend `syncExternalPush()` to also push label diffs
- [ ] Union semantics: if both sides added different labels, both get union

**Tests:**
- [ ] Label diff computation tests in `github-issues.test.ts`
- [ ] Label sync mock tests
- [ ] Golden tryscript tests for bidirectional label sync

### Documentation Updates

All documentation must be updated to reflect the new `--external-issue` flag,
`--external` sync scope, and `use_gh_cli` gating. This section lists every
document that needs changes.

#### Design Doc (`packages/tbd/docs/tbd-design.md`)

- [x] §2.6.3 IssueSchema: add `external_issue_url` field
- [x] §5.5 merge rules: add `external_issue_url: 'lww'`
- [x] §8.7: rewrite with implemented design (status/label mapping, sync arch)
- [x] §8.7: document `use_gh_cli` prerequisite
- [x] §2.7.4 ConfigSchema: add `use_gh_cli` to documented settings
- [ ] §4.4 Create command: add `--external-issue <url>` to options list and
  examples. Note: `--spec` also needs adding (currently undocumented in §4.4)
- [ ] §4.4 Update command: add `--external-issue <url>` to options list and
  examples
- [ ] §4.4 Show command: mention `external_issue_url` in output description
- [ ] §4.4 List command: add `--external-issue` filter option
- [ ] §4.7 Sync command: add `--external` scope flag, `--issues`, `--docs`
  scope flags, and document the 4-phase sync ordering

#### CLI Reference (`packages/tbd/docs/tbd-docs.md`)

- [ ] `create` section (line ~193): add `--external-issue <url>` option with
  description and example. Include URL format example in help text.
- [ ] `update` section (line ~294): add `--external-issue <url>` option
- [ ] `list` section (line ~236): add `--external-issue [url]` filter option
  with example
- [ ] `show` section (line ~282): mention `external_issue_url` in output fields
- [ ] `sync` section (line ~449): add `--external`, `--issues`, `--docs` scope
  flags. Document that default (no flags) syncs all scopes.

#### Workflow Context (`packages/tbd/docs/tbd-prime.md`)

- [ ] "Creating & Updating" section: add `--external-issue` to create example
- [ ] "Sync & Collaboration" section: mention `--external` scope flag
- [ ] Consider adding a brief external issue linking note to "Common Workflows"

#### Top-Level README (`README.md`)

- [x] GitHub authentication section: note that `use_gh_cli: false` disables
  external issue features
- [ ] Commands section: add `--external-issue` to create/update examples
- [ ] Commands section: add `--external` to sync examples

#### Shortcuts

These shortcuts reference beads workflows and should mention that beads may
have linked external issues:

- [ ] `plan-implementation-with-beads.md`: In the "Create a top-level epic"
  step, show `--external-issue` as an optional flag alongside `--spec`
  (epics are the natural place to link to GitHub issues)
- [ ] `implement-beads.md`: Note that beads may be linked to external GitHub
  issues — agents should check `tbd show` output for `external_issue_url`
  and be aware that `tbd sync` pushes status changes externally
- [ ] `agent-handoff.md`: Add "External issues" to the "What to Include"
  checklist (whether beads have linked GitHub issues, sync status)
- [ ] `setup-github-cli.md`: Mention external issue linking as a feature that
  requires `gh` CLI. List it alongside PR creation and code review.
- [ ] `code-review-and-commit.md`: No changes needed (doesn't deal with beads)
- [ ] `create-or-update-pr-simple.md`: No changes needed (doesn't deal with beads)

#### CLI `--help` Text (in source code)

- [ ] `create` command: `--external-issue` help must include format example:
  `--external-issue <url>  Link to GitHub issue (e.g., https://github.com/owner/repo/issues/123)`
- [ ] `update` command: same format
- [ ] `list` command: `--external-issue [url]` filter help
- [ ] `sync` command: `--external` scope help text
- [ ] All `--external-issue` help should note: "Requires use_gh_cli: true"

#### Error Messages (in source code)

Every error path must include the expected URL format example so agents
are never confused:

- [ ] Invalid URL format → include `https://github.com/owner/repo/issues/123`
- [ ] PR URL → "This is a pull request URL, not an issue URL"
- [ ] Non-GitHub URL → "Only GitHub issue URLs are supported"
- [ ] 404 → "Issue not found or not accessible"
- [ ] `use_gh_cli: false` → "Set use_gh_cli: true or run tbd setup --auto"

## Testing Strategy

### Unit Tests

1. **GitHub Issue URL Parsing and Validation** (`github-issues.test.ts`)
   - Valid GitHub issue URLs: `https://github.com/owner/repo/issues/123` → parses
   - Valid with http: `http://github.com/owner/repo/issues/456` → parses
   - Trailing slash rejected: `https://github.com/owner/repo/issues/123/` → null
   - Query params rejected: `https://github.com/owner/repo/issues/123?foo=bar` → null
   - PR URL rejected: `https://github.com/owner/repo/pull/123` → null
   - Repo URL rejected: `https://github.com/owner/repo` → null
   - Blob URL rejected: `https://github.com/owner/repo/blob/main/file.ts` → null
   - Non-GitHub URL rejected: `https://jira.example.com/PROJ-123` → null
   - Malformed: `not-a-url` → null
   - No issue number: `https://github.com/owner/repo/issues/` → null
   - Non-numeric issue number: `https://github.com/owner/repo/issues/abc` → null
   - Extracts correct owner, repo, number from valid URLs

2. **Schema Validation** (add to `schemas.test.ts`)
   - `external_issue_url` accepts valid URLs
   - `external_issue_url` accepts null/undefined
   - `external_issue_url` rejects non-URL strings

3. **Status Mapping** (`github-issues.test.ts`)
   - Each tbd status maps to correct GitHub action
   - Each GitHub state+reason maps to correct tbd status
   - Edge cases: `blocked` bead + GitHub close, `in_progress` bead + GitHub reopen

4. **Label Sync** (`github-issues.test.ts`)
   - Diff calculation (added, removed, unchanged)
   - Union behavior
   - Empty label lists

5. **Inheritable Fields** (`inheritable-fields.test.ts`)
   - `inheritFromParent()` copies all registered fields from parent when not
     explicitly set on child
   - `inheritFromParent()` does NOT overwrite fields the user explicitly set
   - `propagateToChildren()` updates children with null or old-matching values
   - `propagateToChildren()` skips children with explicitly different values
   - Adding a new field to `INHERITABLE_FIELDS` automatically includes it in
     inherit and propagate operations (no other code changes)

6. **Merge Rules** (add to `git.test.ts`)
   - `external_issue_url` uses LWW correctly
   - Concurrent edits to `external_issue_url` resolved by timestamp

### Golden Tryscript Tests

New tryscript files covering the full range of inheritance and linking scenarios.

#### `tests/cli-external-issue-linking.tryscript.md`

Basic external issue linking operations:
- Create with and without `--external-issue` (backward compatibility)
- Show displays external issue URL
- List filtering by external issue
- Update to set/change/clear external issue URL
- Close bead locally → verify no GitHub API call happens (staging only)
- `tbd sync --external` → verify GitHub API calls happen for linked beads
- `tbd sync --issues` → verify no external sync happens (scope isolation)
- `tbd sync` (no flags) → verify all three scopes run (issues + docs + external)

**URL parsing and validation error scenarios** (must be golden-tested):
- Valid GitHub issue URL → succeeds
  (`https://github.com/owner/repo/issues/123`)
- GitHub PR URL → error: "not a GitHub issue URL" (must reject PRs)
  (`https://github.com/owner/repo/pull/123`)
- GitHub repo URL (no issue number) → error
  (`https://github.com/owner/repo`)
- GitHub blob URL → error
  (`https://github.com/owner/repo/blob/main/file.ts`)
- Non-GitHub URL → error: "only GitHub issue URLs are supported"
  (`https://jira.example.com/browse/PROJ-123`)
- Malformed URL → error
  (`not-a-url`, `github.com/owner/repo/issues/123` without scheme)
- Inaccessible issue (valid URL format but 404) → error: "issue not found
  or not accessible"

#### `tests/cli-inheritable-fields.tryscript.md`

Comprehensive tests for the generic inheritable field system. These tests
must exercise both `spec_path` and `external_issue_url` to prove the
shared logic works for any registered field.

**Scenario 1: Parent-to-child inheritance on create**
1. Create parent epic with `--spec` and `--external-issue`
2. Create child under parent (no explicit `--spec` or `--external-issue`)
3. Verify child inherited both `spec_path` and `external_issue_url` from parent
4. Create another child with explicit `--spec` (different from parent)
5. Verify that child has the explicit `spec_path` but inherited `external_issue_url`

**Scenario 2: Propagation from parent to children on update**
1. Create parent epic with `--spec` and `--external-issue`
2. Create 3 children under parent (all inherit both fields)
3. Manually set child-3's `external_issue_url` to a different value
4. Update parent's `--external-issue` to a new URL
5. Verify child-1 and child-2 got the new `external_issue_url` (they had
   the inherited value)
6. Verify child-3 was NOT updated (it had an explicitly different value)
7. Update parent's `--spec` to a new path
8. Verify same propagation logic applies to `spec_path`

**Scenario 3: Re-parenting inherits from new parent**
1. Create parent-A with `--external-issue URL-A`
2. Create parent-B with `--external-issue URL-B`
3. Create orphan child (no parent, no external issue)
4. Re-parent child under parent-A
5. Verify child inherited `external_issue_url` from parent-A
6. Re-parent child under parent-B (child still has URL-A from first parent)
7. Verify child kept URL-A (not overwritten — only inherits if null)

**Scenario 4: Clearing and re-inheriting**
1. Create parent with `--external-issue`
2. Create child (inherits from parent)
3. Clear child's `external_issue_url` with `--external-issue ""`
4. Verify child's `external_issue_url` is now null
5. Update parent's `--external-issue` to a new URL
6. Verify child gets the new URL (its value was null, so it's eligible
   for propagation)

**Scenario 5: Mixed inheritance — some fields set, some inherited**
1. Create parent with `--spec` only (no `--external-issue`)
2. Create child — inherits `spec_path`, no `external_issue_url`
3. Update parent to add `--external-issue`
4. Verify child now has `external_issue_url` propagated (was null)
5. Verify child still has original `spec_path` (unchanged)

### Integration Tests

- End-to-end with real GitHub repo (can use a test repo)
- Verify `gh api` calls are correct
- Verify status and label sync round-trips

## Rollout Plan

1. Phase 1 shipped first — safe, backward-compatible schema addition
2. Phase 2 adds health checks — no behavioral change
3. Phase 3 adds one-way status sync — low risk, always succeeds locally
4. Phase 4 adds bidirectional sync — optional, can be feature-flagged if needed

All phases are backward compatible. The field is optional, so older tbd versions
simply ignore it (it may be stripped by older schemas, but merge rules preserve it
via LWW).

## Open Questions

1. **Should we use `external_issue_url` (string URL) or a structured `linked` field
   (as described in design doc §8.7)?**
   Recommendation: Start with `external_issue_url` as a simple string for v1. It's
   simpler, matches the `spec_path` pattern, and the URL contains all necessary
   information. The structured `linked` field can be added later (possibly in
   `extensions`) if we need multi-provider support.

2. **Should status sync be opt-in via a config setting?**
   Recommendation: Default to enabled when `use_gh_cli` is true. No additional
   config needed for v1.

3. ~~**Should we sync on every bead operation or only on explicit `tbd sync`?**~~
   **RESOLVED**: Sync only at `tbd sync` time, never on individual operations.
   Local operations are a staging area. This is consistent with how issue sync
   (git) and doc sync already work, and allows batching changes before pushing
   them externally. The `--external` scope flag selects this sync, and it's
   included by default when no scope flags are given.

4. ~~**How should we handle GitHub rate limits?**~~
   **RESOLVED**: We don't handle rate limits. If rate-limited, the `gh` CLI
   surfaces the error. The user or agent decides whether to back off and retry.
   No special retry logic, batching, or queuing in tbd.

5. ~~**Should the `--external-issue` flag accept shorthand like `#123` for the current
   repo?**~~
   **RESOLVED**: No. Only full GitHub issue URLs are accepted
   (`https://github.com/owner/repo/issues/123`). However, `--help` text, error
   messages, and documentation must be very clear about the expected format so
   that agents have no confusion. Every error message should include an example
   of the correct URL format.

## References

### Source Files (with key line numbers)

| File | Key Lines | What's There |
| --- | --- | --- |
| `packages/tbd/src/lib/schemas.ts` | 118-151 | `IssueSchema` definition |
| | 149-150 | `spec_path` field (template for `external_issue_url`) |
| | ~280 | `use_gh_cli: z.boolean().default(true)` in ConfigSchema |
| `packages/tbd/src/lib/types.ts` | 28 | `Issue` type (inferred from schema) |
| | 81-91 | `CreateIssueOptions` (needs `external_issue_url`) |
| | 96-109 | `UpdateIssueOptions` (needs `external_issue_url`) |
| `packages/tbd/src/cli/commands/create.ts` | 29-41 | `CreateOptions` interface |
| | 67-76 | `--spec` validation block (template for `--external-issue`) |
| | 95 | `readConfig(tbdRoot)` — config already loaded here |
| | 113-119 | `spec_path` inheritance from parent (to refactor) |
| | 138 | `spec_path: specPath` in issue data (add `external_issue_url`) |
| | 201 | `.option('--spec ...')` Commander flag |
| `packages/tbd/src/cli/commands/update.ts` | 30-41 | `UpdateOptions` interface |
| | 76-77 | `oldSpecPath` capture (generalize to all inheritable) |
| | 90 | `spec_path` update (add `external_issue_url`) |
| | 94-104 | Re-parent inheritance (to refactor) |
| | 151-164 | Propagation to children (to refactor) |
| | 371-383 | `--spec` CLI option handling in `buildUpdates` |
| | 437 | `.option('--spec ...')` Commander flag |
| `packages/tbd/src/cli/commands/show.ts` | 69-70 | `spec_path` color highlighting (add `external_issue_url`) |
| `packages/tbd/src/cli/commands/list.ts` | 33-50 | `ListOptions` interface |
| | 96 | `spec_path` in displayIssues (add `external_issue_url`) |
| | 247-251 | `--spec` filter block (template for `--external-issue`) |
| | 301-304 | `.option('--spec ...')` Commander flag |
| `packages/tbd/src/cli/commands/sync.ts` | 58-65 | `SyncOptions` interface (add `external`) |
| | 89-103 | Scope selection logic (extend for `--external`) |
| | 105 | Step 1: docs sync |
| | 116 | Step 2: issues sync |
| | 1100-1113 | Commander definition + options |
| `packages/tbd/src/cli/commands/close.ts` | 56-61 | Idempotent close (no external side effects — by design) |
| `packages/tbd/src/cli/commands/doctor.ts` | 88-133 | 15 health checks |
| | 136-142 | 2 integration checks (add `gh` CLI check) |
| | 562-601 | Integration check methods (add `checkGhCli()`) |
| `packages/tbd/src/file/git.ts` | 277-308 | `FIELD_STRATEGIES` merge rules |
| | 300 | `spec_path: 'lww'` (add `external_issue_url`) |
| `packages/tbd/src/file/github-fetch.ts` | 12-16 | `execFile` + `promisify` pattern for `gh` CLI |
| | 28, 36 | GitHub URL regex patterns (reference for issue regex) |
| | 63 | `isGitHubUrl()` helper |

### New Files to Create

| File | Purpose |
| --- | --- |
| `packages/tbd/src/file/github-issues.ts` | GitHub issue URL parsing, validation, and API operations |
| `packages/tbd/src/lib/inheritable-fields.ts` | Generic parent→child field inheritance/propagation |
| `packages/tbd/src/file/github-issues.test.ts` | URL parsing and status mapping tests |
| `packages/tbd/src/lib/inheritable-fields.test.ts` | Inheritance logic tests |
| `packages/tbd/tests/cli-external-issue-linking.tryscript.md` | Golden tests for external issue linking |
| `packages/tbd/tests/cli-inheritable-fields.tryscript.md` | Golden tests for inheritance system |

### Documentation Files to Update

| File | Sections |
| --- | --- |
| `packages/tbd/docs/tbd-design.md` | §2.6.3, §2.7.4, §4.4, §4.7, §5.5, §7.2, §8.7 |
| `packages/tbd/docs/tbd-docs.md` | create, update, list, show, sync sections |
| `packages/tbd/docs/tbd-prime.md` | Creating, Sync, Common Workflows |
| `README.md` | GitHub auth, Commands sections |
| `packages/tbd/docs/shortcuts/standard/plan-implementation-with-beads.md` | Epic creation |
| `packages/tbd/docs/shortcuts/standard/implement-beads.md` | Bead awareness |
| `packages/tbd/docs/shortcuts/standard/agent-handoff.md` | Handoff checklist |
| `packages/tbd/docs/shortcuts/standard/setup-github-cli.md` | Feature list |

### External References

- `docs/project/specs/done/plan-2026-01-26-spec-linking.md` — Reference spec for similar `spec_path` feature
- [GitHub Issues API: state and state_reason](https://docs.github.com/en/rest/issues)
- [GitHub REST API: Labels](https://docs.github.com/en/rest/issues/labels)
