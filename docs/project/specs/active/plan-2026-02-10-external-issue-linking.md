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

When syncing from GitHub (on next bead update or explicit sync), the reverse mapping:

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

- **tbd → GitHub**: When a label is added/removed on a bead, the same label is
  added/removed on the linked GitHub issue.
- **GitHub → tbd**: When a label is added/removed on the GitHub issue, the same
  label is added/removed on the bead during the next sync.
- Labels are matched by exact string equality.
- Label sync is additive for union merges: if both sides add different labels, both
  end up with the union.

## Design

### Approach

1. **New schema field**: Add `external_issue_url` as an optional nullable string
   field on `IssueSchema`, following the `spec_path` pattern.

2. **GitHub URL parser**: Create a `github-issues.ts` module with functions to
   parse GitHub issue URLs, extract `{owner, repo, number}`, validate via `gh` CLI,
   and perform status/label operations.

3. **Inheritance and propagation**: Reuse the exact same parent-to-child inheritance
   pattern as `spec_path` in `create.ts` and `update.ts`.

4. **Status sync on close/update**: When a bead's status changes, if it has a linked
   external issue, sync the status to GitHub using the mapping table.

5. **Label sync**: On label add/remove operations, sync to the linked GitHub issue.
   On explicit sync or bead update, pull label changes from GitHub.

6. **Doctor check**: Add a `gh` CLI availability check to the `doctor` command.

### Components

| Component | File(s) | Purpose |
| --- | --- | --- |
| Schema | `schemas.ts` | Add `external_issue_url` field |
| URL Parser | `github-issues.ts` (new) | Parse, validate, and operate on GitHub issues |
| Create | `create.ts` | `--external-issue` flag, parent inheritance |
| Update | `update.ts` | `--external-issue` flag, propagation to children |
| Close | `close.ts` | Sync status to GitHub on close |
| Reopen | `reopen.ts` | Sync status to GitHub on reopen |
| Show | `show.ts` | Display external issue URL with highlighting |
| List | `list.ts` | `--external-issue` filter option |
| Label | `label.ts` | Sync label changes to GitHub |
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

### Inheritance Logic (Reuse from `spec_path`)

**On create with `--parent`** (in `create.ts`):
- If `--external-issue` is not provided but parent has `external_issue_url`,
  inherit from parent.

**On update** (in `update.ts`):
- If `external_issue_url` changes on a parent, propagate to children whose
  `external_issue_url` is null or matches the old value.
- On re-parenting without explicit `--external-issue`, inherit from new parent
  if the bead has no `external_issue_url`.

This is the exact same logic as `spec_path` inheritance and propagation.

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

### Error Handling

- If `gh` CLI is not available when attempting to sync, log a warning and return
  a non-zero exit code. The bead update itself still succeeds.
- If the GitHub API call fails (network error, auth error, permission error),
  log the error, return non-zero exit code, but the bead update still succeeds.
- At link time (`--external-issue`), validate the issue exists and is readable.
  If not accessible, fail the command with a clear error message.
- All errors are surfaced to the user, never silently swallowed.

## Implementation Plan

### Phase 1: Schema, URL Parsing, and Core Linking

Add the field, parse GitHub URLs, validate issues, and wire up the basic
create/update/show/list functionality. No status or label sync yet.

- [ ] Add `external_issue_url` field to `IssueSchema` in `schemas.ts`
- [ ] Add `external_issue_url: 'lww'` to merge rules in `git.ts`
- [ ] Create `github-issues.ts` module with:
  - [ ] `parseGitHubIssueUrl()` - regex-based URL parsing
  - [ ] `isGitHubIssueUrl()` - URL type detection
  - [ ] `validateGitHubIssue()` - verify issue exists via `gh api`
  - [ ] `formatGitHubIssueRef()` - format as `owner/repo#number` for display
- [ ] Add `--external-issue <url>` flag to `create` command with:
  - [ ] URL validation (must be a valid GitHub issue URL)
  - [ ] Issue accessibility check via `gh api`
  - [ ] Parent inheritance (same pattern as `spec_path`)
- [ ] Add `--external-issue <url>` flag to `update` command with:
  - [ ] URL validation and accessibility check
  - [ ] Propagation to children (same pattern as `spec_path`)
  - [ ] Clear with `--external-issue ""`
- [ ] Update `show` command to display `external_issue_url` with color highlighting
- [ ] Add `--external-issue` filter to `list` command
- [ ] Write unit tests for `github-issues.ts` (URL parsing, format detection)
- [ ] Write unit tests for schema changes
- [ ] Create golden tryscript tests for:
  - [ ] Create with `--external-issue`
  - [ ] Show displaying external issue URL
  - [ ] List filtering by external issue
  - [ ] Update to set/clear external issue
  - [ ] Parent-to-child inheritance
  - [ ] Propagation on parent update

### Phase 2: `gh` CLI Health Check and Setup Validation

Ensure `gh` CLI availability is verified in `doctor` and that the setup flow
properly validates GitHub access.

- [ ] Add `gh` CLI availability check to `doctor` command:
  - [ ] Check if `gh` is in PATH
  - [ ] Check if `gh auth status` succeeds
  - [ ] Report as integration check (not blocking, but informational)
- [ ] Add `--fix` support: if `gh` missing and `use_gh_cli` is true, suggest
  running `tbd setup --auto`
- [ ] Write tests for the new doctor check

### Phase 3: Status Sync (tbd → GitHub)

When bead status changes, propagate to the linked GitHub issue.

- [ ] Add status mapping table to `github-issues.ts`:
  - [ ] `tbd closed` → GitHub `closed` (`completed`)
  - [ ] `tbd deferred` → GitHub `closed` (`not_planned`)
  - [ ] `tbd open` / `in_progress` → GitHub `open` (reopen if closed)
  - [ ] `tbd blocked` → no change
- [ ] Add `closeGitHubIssue()` function using `gh api`
- [ ] Add `reopenGitHubIssue()` function using `gh api`
- [ ] Hook into `close` command: after closing bead, sync to GitHub
- [ ] Hook into `reopen` command: after reopening bead, sync to GitHub
- [ ] Hook into `update` command: when status changes, sync to GitHub
- [ ] Error handling: log warning on failure, non-zero exit code, but bead
  update still succeeds
- [ ] Write tests for status sync (mock `gh` CLI calls)
- [ ] Create golden tryscript tests for close/reopen sync behavior

### Phase 4: Status Sync (GitHub → tbd) and Label Sync

Pull status and label changes from GitHub into tbd beads. This phase is optional
and can be deferred.

- [ ] Add `getGitHubIssueState()` function to fetch current state and labels
- [ ] Add GitHub → tbd status mapping logic
- [ ] Add label sync functions:
  - [ ] `addGitHubLabel()` - add label on GitHub
  - [ ] `removeGitHubLabel()` - remove label on GitHub
  - [ ] `syncLabelsToGitHub()` - push local label diff to GitHub
  - [ ] `syncLabelsFromGitHub()` - pull GitHub label diff to local
- [ ] Hook into `label add` / `label remove`: sync to GitHub
- [ ] Add pull-from-GitHub logic that runs on bead update or explicit sync:
  - [ ] Fetch GitHub issue state
  - [ ] Apply reverse status mapping if state changed
  - [ ] Apply label diff (union/remove)
- [ ] Error handling: log warning on failure, non-zero exit code
- [ ] Write tests for label sync (mock `gh` CLI calls)
- [ ] Write tests for reverse status mapping
- [ ] Create golden tryscript tests for bidirectional sync

### Design Doc Updates

- [ ] Update `tbd-design.md` §2.6.3 (IssueSchema) to add `external_issue_url`
- [ ] Update `tbd-design.md` merge rules (§5.5) to add `external_issue_url: 'lww'`
- [ ] Update `tbd-design.md` §8.7 to reflect the implemented design
- [ ] Add status mapping table to design doc
- [ ] Add label sync design to design doc
- [ ] Document the inheritance and propagation rules alongside `spec_path`

## Testing Strategy

### Unit Tests

1. **GitHub Issue URL Parsing** (`github-issues.test.ts`)
   - Valid GitHub issue URLs (http and https)
   - URLs with trailing slashes or query params (reject)
   - Non-issue GitHub URLs (PRs, repos, blob URLs)
   - Non-GitHub URLs (Jira, Linear, arbitrary)
   - Edge cases: no issue number, non-numeric issue number

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

5. **Merge Rules** (add to `git.test.ts`)
   - `external_issue_url` uses LWW correctly
   - Concurrent edits to `external_issue_url` resolved by timestamp

### Golden Tryscript Tests

New tryscript file: `tests/cli-external-issue-linking.tryscript.md`

Covers:
- Create with and without `--external-issue` (backward compatibility)
- Show displays external issue URL
- List filtering by external issue
- Update to set/change/clear external issue URL
- Parent-to-child inheritance
- Propagation on parent update
- Close bead → status message about GitHub sync
- Error cases: invalid URL, inaccessible issue

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

3. **Should we sync on every bead operation or only on explicit `tbd sync`?**
   Recommendation: Sync to GitHub on status-changing operations (close, reopen,
   update status) and label operations. Pull from GitHub on explicit `tbd sync`
   or when showing/updating a bead with a linked issue. This avoids excessive
   API calls.

4. **How should we handle GitHub rate limits?**
   Recommendation: Rely on `gh` CLI's built-in rate limit handling for v1. If
   rate-limited, the error is surfaced to the user. Future enhancement could add
   batching or queuing.

5. **Should the `--external-issue` flag accept shorthand like `#123` for the current
   repo?**
   Recommendation: For v1, require full URLs for clarity and unambiguity. Shorthand
   can be added as a convenience enhancement later.

## References

- `packages/tbd/src/lib/schemas.ts` — Current bead schema (line 118-151)
- `packages/tbd/src/cli/commands/create.ts` — `spec_path` inheritance pattern (lines 113-119)
- `packages/tbd/src/cli/commands/update.ts` — `spec_path` propagation pattern (lines 151-164)
- `packages/tbd/src/file/git.ts` — Merge strategy rules (lines 277-308)
- `packages/tbd/src/file/github-fetch.ts` — Existing GitHub URL parsing patterns
- `packages/tbd/src/cli/commands/doctor.ts` — Health check infrastructure
- `packages/tbd/docs/tbd-design.md` §8.7 — External Issue Tracker Linking design (lines 5717-5779)
- `packages/tbd/docs/tbd-design.md` §7.2 — Future GitHub Bridge architecture (lines 4958-4976)
- `docs/project/specs/done/plan-2026-01-26-spec-linking.md` — Reference spec (similar feature)
- [GitHub Issues API: state and state_reason](https://docs.github.com/en/rest/issues)
- [GitHub REST API: Labels](https://docs.github.com/en/rest/issues/labels)
