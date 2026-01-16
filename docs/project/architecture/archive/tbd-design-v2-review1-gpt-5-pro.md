Below is a detailed design review of **Tbd V2 Phase 1 (Beads replacement)**, with (a) a
set of creative alternatives / scope-shaping ideas, and (b) an editor-ready issue list
you can paste into the spec review doc or a GitHub issue.
This review is based on the V2 Phase 1 spec, plus the earlier V1 spec and the V1 design
review you referenced.

* * *

## High-level review

### What’s working really well in V2 Phase 1

- **The scope is much more shippable.** Phase 1 being “just a Beads replacement +
  durable git-backed workflow layer” is the right cut.
  You’ve removed the coordination substrate ambitions that were forcing early
  commitment.

- **Two-branch separation (config on main, entities on sync branch)** is a strong
  product move: it avoids polluting feature branches and keeps coordination data
  isolated.

- **File-per-entity** is the key structural improvement over Beads’ JSONL conflict
  hotspot.

- **Attic/no-data-loss posture** is an excellent trust-building invariant—as long as
  it’s paired with UX for inspection/restoration.

- **Explicit non-goals** keep Phase 1 from turning back into V1.

### The main design risk

The biggest “this could bite you badly” risk is the **Git Layer write path** as written.
The current spec shows plumbing commands (`git read-tree`, `git add`, `git write-tree`,
etc.) without any mention of isolating the index/worktree, which in a real repo would
risk corrupting or clobbering a user’s staged changes.
This is the top thing to tighten, both in spec clarity and implementation strategy.

If Phase 1 is aiming for “boring and reliable,” the Git write approach should be made
**unambiguously safe** and ideally “hard to accidentally break a repo.”

* * *

## Creative ideas: alternate approaches or scope adjustments

These are “different ways to approach the same Phase 1 goal,” not requirements.
Pick what keeps Phase 1 simplest and safest.

### 1) Make sync writes “boring” by using an internal worktree (even if you avoid user-facing worktrees)

V1 had an explicit hidden worktree for sync operations.
V2 removed it (good for user mental model), but the *implementation* still needs a safe
place to stage/commit sync branch changes.
A hidden worktree is often the simplest correct way to ensure you never touch the user’s
current index.

**Reframe it as:**

- “No user-visible worktree complexity” (still true)

- “Internally, tbd uses a private worktree or isolated index to stage commits safely.”

You can keep the design principle (“users don’t manage worktrees”) while using the most
robust implementation technique.

### 2) Use longer internal IDs + short unique display prefixes (Git-style) instead of 4–6 hex IDs

Right now the spec wants 4–6 hex chars as the ID body.
That’s fine for readability, but it’s fragile as the global identifier if you scale
concurrency. A very practical compromise:

- **Internal ID**: 8–12 hex chars (or ULID/base32)

- **Display ID**: shortest unique prefix in the repo (4–8 chars), with optional `bd-`
  prefix display mode

This preserves “Beads-like ergonomics” while making collision-handling basically a
non-event.

### 3) Apply “file-per-entity” to mapping files too

`.tbd-sync/mappings/beads.json` is a potential conflict hotspot if more than one node
imports concurrently (even if rare).
If you’ve embraced file-per-entity, it’s consistent to do:

- `.tbd-sync/mappings/beads/bd-x7y8.json` → `{ "tbd_id": "is-..." }`

Then imports never contend on a single monolithic mapping file.

### 4) Make attic recovery a first-class CLI surface in Phase 1 (even minimal)

Attic is only as valuable as the ability to:

- list what was preserved,

- show diffs/values,

- restore/apply it.

Even a minimal `tbd attic list/show/restore` set will turn “attic exists” into “users
trust it.”

This aligns directly with the earlier design review’s product guidance (“doctor/recover
as core features”).

### 5) Make “extensions” merge-by-namespace instead of LWW (or you’ll lose bridge metadata later)

If you plan any future bridge/automation, `extensions` will eventually carry metadata
from multiple systems.
LWW on the whole object will silently drop namespaces.
Better:

- merge `extensions` as a key-wise union,

- per-extension-key conflicts resolve by LWW (or “prefer remote”) and attic.

### 6) Add an explicit “sync baseline commit” concept (local-only) to avoid full scans

Right now, sync reads like it may compare “everything vs everything.”
A small local-only state can reduce work massively:

- Store last-synced **remote commit hash** (or last merged hash) in
  `.tbd/cache/state.json`

- On sync: `git diff --name-only <baseline>..<remote>` to find changed issues quickly

This keeps Phase 1 fast without introducing a DB. It’s still “boring git.”

### 7) (Optional seam) Define outbox/inbox conventions even if you don’t ship bridges yet

You can keep Phase 1 non-goals intact while reserving a clean seam for Phase 2:

- `.tbd/cache/outbox/` for bridge intents

- `.tbd/cache/inbox/` for bridge results

This was a big theme in the V1 review (“bridge runtime, not every agent integrates”).

* * *

## Editor-ready issue list for V2 Phase 1 spec

Format: **[V2-###] [Severity]** — *Title* **Where:** section **Problem:** what’s
wrong/unclear **Suggested change:** concrete fix

You can copy/paste this as a checklist.

* * *

### Git layer correctness and safety

- **[V2-001] [BLOCKER] Git write flow can clobber user index / staged changes**
  **Where:** §3.3.2 “Writing to Sync Branch” **Problem:** The sequence
  `git read-tree tbd-sync; git add ...; git write-tree` as written operates on the
  *current repo index*, which risks destroying/overwriting a developer’s staged changes
  (and generally assumes the index is “owned” by tbd).
  **Suggested change:** Specify that all plumbing operations MUST run with an isolated
  index/worktree (e.g., `GIT_INDEX_FILE=...` and `GIT_WORK_TREE=...`) or use an internal
  hidden worktree. Add an explicit invariant: “tbd never modifies the user’s
  index/staging area.”

- **[V2-002] [BLOCKER] Local working copy location for `.tbd-sync/` is undefined**
  **Where:** §2.2 Directory Structure + §3.3 Sync Operations **Problem:** The spec says
  `.tbd-sync/` exists on the `tbd-sync` branch, but then uses
  `git add .tbd-sync/issues/` which requires those files to exist in the working tree.
  Meanwhile main branch structure omits `.tbd-sync/` entirely.
  **Suggested change:** Add an explicit subsection: “Local storage model.”
  Choose one:

  1. `.tbd-sync/` exists locally (gitignored on main) and is used as a workspace, OR

  2. issues live under `.tbd/cache/...` locally and are written into git objects
     directly, OR

  3. hidden worktree checkout for `tbd-sync` exists under `.tbd/cache/worktrees/...`.
     Make it normative so implementation + UX are aligned.

- **[V2-003] [BLOCKER] Missing rule for not leaving untracked `.tbd-sync/` noise on
  main** **Where:** §2.2 + §3.2 (tracked files on main) **Problem:** If `.tbd-sync/` is
  used as a local workspace on main, it will show as untracked unless explicitly
  ignored. Current `.tbd/.gitignore` ignores only `cache/`. **Suggested change:** If
  `.tbd-sync/` exists on main working tree, specify how it is ignored:

  - recommend adding `.tbd-sync/` to top-level `.gitignore` OR

  - write to `.git/info/exclude` in `tbd init` OR

  - avoid having `.tbd-sync/` exist on main at all (use hidden worktree or cache).

- **[V2-004] [MAJOR] `git show tbd-sync:...` vs remote tracking branch ambiguity**
  **Where:** §3.3.1 Reading from Sync Branch **Problem:** Examples read from `tbd-sync:`
  but sync begins with `git fetch origin tbd-sync`. After fetching, the authoritative
  remote ref is typically `origin/tbd-sync` (unless you also update local `tbd-sync`).
  This is ambiguous and can lead to reading stale data.
  **Suggested change:** Define: “Remote truth is `refs/remotes/<remote>/<branch>`.” Use
  that consistently for reads after fetch, then merge into local.

- **[V2-005] [MAJOR] Push retry strategy is underspecified** **Where:** §3.3.2 “If push
  rejected…” **Problem:** “Pull, merge, retry (max 3 attempts)” doesn’t define *how* you
  merge (merge base? re-run merge algorithm file-by-file?
  fast-forward only?), and what the failure mode is after 3 attempts.
  **Suggested change:** Specify the exact loop:

  - fetch remote head

  - compute diff between local prepared commit and remote

  - re-run merge on conflicts

  - create new commit

  - push And specify after max attempts: exit non-zero with “manual sync required”
    instructions.

- **[V2-006] [MAJOR] `tbd sync --status` baseline is undefined** **Where:** §4.7 Sync
  Commands (status output example) **Problem:** “Local changes (not yet pushed)” and
  “Remote changes (not yet pulled)” need a baseline definition (last successful sync?
  last pull? remote-tracking vs local cached state?). **Suggested change:** Define
  baseline as `state.json.last_successful_sync_commit` (local-only), and compute pending
  changes via `git diff --name-status <baseline>..origin/tbd-sync` plus local dirty set.

* * *

### Conflict resolution semantics

- **[V2-007] [BLOCKER] Merge rules omit BaseEntity fields or don’t state how they’re
  handled** **Where:** §3.5 Issue Merge Rules **Problem:** The merge rules list doesn’t
  include `created_at`, `updated_at`, `created_by`, `closed_at`, `version`. Yet earlier
  you define strategies for `version` and `updated_at`. It’s unclear if BaseEntity
  fields are merged “implicitly,” and how.
  **Suggested change:** Explicitly list merge strategies for all BaseEntity fields, or
  add a clear statement: “BaseEntity merge is applied first with rules X, then
  entity-specific rules override.”

- **[V2-008] [MAJOR] Tie-breaker for equal timestamps is missing** **Where:** §3.5 (LWW
  strategy) **Problem:** LWW “by timestamp” needs a deterministic tie-breaker when
  timestamps are equal (common with coarse clocks, imports, or identical writes).
  Without one, you can get nondeterministic merges or oscillations.
  **Suggested change:** Define: if `updated_at` equal, prefer:

  1. remote over local (or vice versa), then

  2. if still equal, prefer lexical compare of content hash, then

  3. preserve loser in attic.

- **[V2-009] [MAJOR] `extensions` merge strategy as `lww` loses data across namespaces**
  **Where:** §3.5 Issue Merge Rules (`extensions: lww`) **Problem:** If local has
  `extensions.github` and remote has `extensions.my-tool`, LWW on the whole record will
  drop one side. That contradicts “preserve third-party data.”
  **Suggested change:** Make `extensions` a “merge_record_by_key” strategy:

  - union keys

  - per key, lww (with attic) or prefer remote

  - preserve unknown keys always

- **[V2-010] [MAJOR] Array ordering is not defined → nondeterministic file
  content/hashes** **Where:** §2.1 Canonical JSON + §3.5 union/merge_by_id **Problem:**
  Canonical JSON sorts keys, but arrays are order-sensitive.
  Union/merge operations can produce different orderings across implementations,
  changing hashes and causing spurious conflicts.
  **Suggested change:** Add ordering rules:

  - `labels`: always sorted lexicographically

  - `dependencies`: sorted by `target`

  - optionally `labels`/`deps` de-dupe case-sensitively or insensitively (define)

- **[V2-011] [MAJOR] “Every merge produces attic entries for fields where values
  differed” is too broad** **Where:** §3.4 Resolution Flow note **Problem:** For `union`
  fields (labels) or merge-by-id fields (dependencies), there is often no true “loser”;
  the merged result retains both.
  Writing attic entries anyway could create noisy attic growth.
  **Suggested change:** Refine statement: attic entries are created only when a merge
  strategy discards data (e.g., LWW picks one scalar/text over another), not when union
  retains both.

- **[V2-012] [MAJOR] Clock skew assumptions are unaddressed** **Where:** §3.5 LWW
  **Problem:** LWW relies on timestamps; if agent clocks are skewed, the “winner” can be
  consistently wrong. Attic helps recovery but UX might suffer.
  **Suggested change:** Add a short note: “Clock skew may cause counterintuitive
  winners; attic preserves losers; optionally add a future HLC/monotonic timestamp
  enhancement.”

* * *

### IDs and mapping

- **[V2-013] [BLOCKER] ID entropy comment + collision math are wrong/inconsistent**
  **Where:** §2.4 ID Generation **Problem:** Code uses `randomBytes(4)` (32 bits) but
  slices to 6 hex chars (24 bits).
  Comment says “4 bytes = 32 bits,” but output is 24-bit.
  Collision probability statement “1 in 16 million at 4 hex chars” is incorrect (16
  million corresponds to 6 hex chars).
  **Suggested change:** Decide and state:

  - If you want 24-bit IDs, generate 3 bytes and use 6 hex chars.

  - If you want 32-bit IDs, use 8 hex chars.
    Fix the probability statement.

- **[V2-014] [MAJOR] 4-hex IDs are too short to be “supported” in the regex** **Where:**
  §2.4 regex `^is-[a-f0-9]{4,6}$` **Problem:** Supporting 4-hex IDs implies only 65,536
  possibilities; collisions become plausible even with moderate concurrency and
  long-lived repos. **Suggested change:** Make minimum 6 (or 8) for stored IDs;
  optionally allow user to *type* short prefixes that resolve uniquely.

- **[V2-015] [MAJOR] Display-prefix compatibility vs import mapping is inconsistent**
  **Where:** §5.5 “IDs change” + §5.1.4 mapping file **Problem:** One part implies Beads
  IDs become `is-a1b2` (same suffix), but import mapping explicitly maps Beads IDs to
  newly generated Tbd IDs (not necessarily same suffix).
  **Suggested change:** Make this consistent.
  Options:

  - Preserve suffix when importing (prefer `is-<same>` unless collision), OR

  - Clearly state that imported IDs change (and `display.id_prefix` only changes prefix,
    not suffix). Update examples accordingly.

- **[V2-016] [MAJOR] Single mapping file on sync branch can become a conflict hotspot**
  **Where:** §5.1.4 `.tbd-sync/mappings/beads.json` **Problem:** Concurrent imports or
  partial migrations could cause merges on the same file.
  **Suggested change:** Store per-beads-id mapping files (file-per-entity) or define
  merge semantics for `beads.json` as a “map union with conflict on key mismatch.”

* * *

### File formats and normalization

- **[V2-017] [MAJOR] Stored JSON normalization (defaults present or omitted) is not
  defined** **Where:** §2.5 Schemas + canonical JSON **Problem:** If one implementation
  omits default fields and another writes them explicitly, the logical state is
  identical but the file differs, causing unnecessary merges.
  **Suggested change:** Add a rule: “All writers MUST serialize a fully-normalized
  entity with defaults applied (including empty arrays), and omit only optional
  `undefined` fields.”

- **[V2-018] [MAJOR] Canonical JSON spec doesn’t address newline normalization on
  Windows** **Where:** §2.1 Canonical JSON **Problem:** If a contributor ends up with
  CRLF vs LF, content hashes differ.
  **Suggested change:** Specify LF line endings and recommend `.gitattributes` rule for
  `.tbd-sync/**` (e.g., `text eol=lf`) or ensure writer always emits LF.

- **[V2-019] [MAJOR] Atomic write algorithm is not fully cross-platform safe as stated**
  **Where:** §2.1 Atomic File Writes **Problem:** The snippet claims “POSIX guarantees
  atomicity,” but Phase 1 also targets Windows and network filesystems.
  Rename semantics and durability guarantees vary.
  **Suggested change:** Reword to: “atomic on POSIX local filesystems; best-effort on
  Windows/NFS; use a well-tested atomic-write helper; never leave partially written
  final files; tolerate orphan tmp files.”

- **[V2-020] [MINOR] Temp file cleanup could race between processes** **Where:** §2.1
  Cleanup note **Problem:** “Remove orphaned `.tmp.*` on startup” can delete temp files
  created by another concurrently-running `tbd` process.
  **Suggested change:** Only cleanup temp files older than a threshold (e.g., >1h) or
  include unique prefixes and only remove ones matching current node_id.

* * *

### Data model clarity

- **[V2-021] [MAJOR] `version` field description is misleading** **Where:** §2.5.1
  “Version counter for optimistic concurrency” + §3.4 **Problem:** Spec says `version`
  is for optimistic concurrency, but conflict detection is explicitly hash-based and
  merge always occurs when content differs.
  That’s not really optimistic concurrency in the common sense.
  **Suggested change:** Rename/describe as “merge_version” or “edit counter used for
  debugging/ordering,” and specify exactly when it increments (every write?
  merges only?).

- **[V2-022] [MAJOR] Missing semantics for `created_by` / actor identity** **Where:**
  IssueSchema + CLI global `--actor` **Problem:** The spec doesn’t define default actor
  selection (git config?
  env var? hostname? agent name?), nor whether `created_by`/`updated_by` is recorded.
  **Suggested change:** Define:

  - actor resolution order (e.g., `--actor` > `tbd_ACTOR` > git user.email > hostname)

  - which fields are set on create/update/close/reopen.

- **[V2-023] [MAJOR] `closed_at` merge behavior is undefined** **Where:** IssueSchema vs
  merge rules **Problem:** If one side closes and other edits title, merge needs
  deterministic behavior for `closed_at` and `status`. **Suggested change:** Add
  explicit rules:

  - `status` LWW

  - if status becomes `closed`, ensure `closed_at` is set (and possibly LWW)

  - on reopen, clear `closed_at` (and record reopen reason separately or in notes)

- **[V2-024] [MINOR] `IssueKind` includes `chore` but CLI docs omit it** **Where:**
  §2.5.3 vs §4.4 Create/List filters **Problem:** CLI help lists bug/feature/task/epic,
  but schema supports chore.
  **Suggested change:** Add `chore` everywhere types are listed.

- **[V2-025] [MAJOR] Notes field exists but CLI lacks explicit support** **Where:**
  IssueSchema includes `notes`; CLI commands don’t expose it **Problem:** If notes are
  “Beads parity,” Phase 1 should support reading/updating notes.
  **Suggested change:** Add:

  - `tbd update <id> --notes <text>` and `--notes-file <path>`

  - `tbd show` should display notes separately from description.

- **[V2-026] [MINOR] `due_date` and `deferred_until` types might be too strict**
  **Where:** Timestamp = `.datetime()` and CLI options `--due/--defer` **Problem:**
  ISO8601 datetime requirements may be annoying if users type dates without timezone.
  **Suggested change:** Specify accepted formats and normalization: allow date-only
  input and convert to canonical UTC midnight, or require full RFC3339 but document
  loudly.

* * *

### CLI compatibility and UX

- **[V2-027] [MAJOR] Beads compatibility claim “drop-in replacement” needs a
  compatibility contract** **Where:** §1.1 Key characteristics + §5 mapping **Problem:**
  “Drop-in” is mostly about CLI and scripts.
  Spec lists commands, but doesn’t define: output stability, exit codes, JSON schema
  stability, or error messages.
  **Suggested change:** Add a short “Compatibility Contract” section:

  - stable JSON keys for `--json`

  - stable exit codes

  - backward-compatible flag aliases

- **[V2-028] [MAJOR] `--db <path>` option naming is confusing (no DB)** **Where:** §4.9
  Global Options **Problem:** For new users, `--db` suggests SQLite again.
  It’s only here for Beads compatibility, but that’s not stated.
  **Suggested change:** Keep `--db` as alias for compatibility, but document preferred
  `--tbd-dir` (or similar) and mark `--db` as compatibility alias.

- **[V2-029] [MAJOR] Lack of attic CLI undermines “no data loss” claim** **Where:**
  Attic sections vs CLI commands **Problem:** You can say “no data loss,” but without a
  way to list/restore attic entries, users can’t recover without manual file spelunking.
  **Suggested change:** Add at least:

  - `tbd attic list [<id>]`

  - `tbd attic show <id> [--field ...] [--latest]`

  - `tbd attic restore <attic-entry> [--apply]`

- **[V2-030] [MINOR] `tbd list --sort` values mismatch naming** **Where:** §4.4 List
  options: sort by “priority, created, updated” **Problem:** Fields are `created_at`,
  `updated_at`. Might want to standardize names.
  **Suggested change:** Document exact sort keys and whether “created/updated” is
  shorthand.

- **[V2-031] [MINOR] Examples show IDs with `bd-` prefix but internal IDs are `is-`**
  **Where:** CLI examples across §4, plus migration notes **Problem:** Readers may
  assume IDs are literally `bd-` in storage.
  This is confusing unless you explain display prefix early and show both forms.
  **Suggested change:** In the first CLI examples, show “input accepts bd-_ and is-_;
  storage uses is-\*; display default is configurable.”

- **[V2-032] [MAJOR] `ready` algorithm depends on dependency target status but no
  caching strategy is stated** **Where:** §4.4 Ready command algorithm **Problem:** For
  large issue sets, computing “ready” naïvely requires loading many target issues.
  This is fine if the index is designed for it, but spec doesn’t connect those dots.
  **Suggested change:** Add note: “ready uses index if enabled; otherwise loads
  dependency targets on demand.”

* * *

### Import/migration specifics

- **[V2-033] [MAJOR] Design goal says `tbd import beads` but CLI spec says
  `tbd import <file>`** **Where:** §1.3 Design Goals vs §5.1 Import Command **Problem:**
  Minor inconsistency but confusing.
  **Suggested change:** Make the goal say: “`tbd import <beads-export.jsonl>` and
  `tbd import --from-beads`”.

- **[V2-034] [MAJOR] Multi-source import merge should also write attic on conflicts**
  **Where:** §5.1.3 Multi-Source Merge Algorithm **Problem:** It uses LWW on
  `updated_at` to pick winners, but does not preserve the losing versions in attic (yet
  V2’s core promise is no data loss).
  **Suggested change:** When two sources disagree, preserve loser to attic (at least
  full entity snapshot with source tag).

- **[V2-035] [MAJOR] Import mapping authority is ambiguous** **Where:** §5.1.4 “Mapping
  file is authoritative (extensions is reference)” **Problem:** If the mapping file gets
  corrupted or conflicts, recovery path should be defined (can it be rebuilt by scanning
  issues’ extensions?). **Suggested change:** Define recovery: mapping can be
  reconstructed from issues by reading `extensions.beads.original_id`.

- **[V2-036] [MINOR] Tombstone handling is described in two different ways** **Where:**
  §2.5.3 notes on tombstone + §5.1.7/§5.4/§5.5 **Problem:** Deletion/tombstone semantics
  are described multiple times with slightly different options/labels.
  **Suggested change:** Consolidate tombstone/deletion policy in one place and reference
  it.

* * *

### Performance/indexing details

- **[V2-037] [BLOCKER] Index schema uses Map/Set but stored as JSON** **Where:** §6.1
  Query Index interface **Problem:** JSON can’t represent `Map`/`Set` directly; spec as
  written is not implementable without a defined encoding.
  **Suggested change:** Define JSON encoding explicitly:

  - `issues` as object `{ [id]: IssueSummary }`

  - `by_status` as `{ [status]: string[] }`

  - etc., with arrays sorted.

- **[V2-038] [MAJOR] Index “checksum of issues directory” needs a defined algorithm**
  **Where:** §6.1 Index **Problem:** “Hash of issues directory” can mean many things;
  doing it naïvely is O(n) file reads and defeats the purpose.
  **Suggested change:** Define checksum as either:

  - git tree hash of `.tbd-sync/issues` at the synced commit, OR

  - a rolling hash of (filename, mtime, size) stored in state.json, OR

  - a “last seen commit hash” baseline.

- **[V2-039] [MAJOR] Performance goals likely require incremental sync, not full scans**
  **Where:** §1.3 Performance target + §3.3 sync algorithm **Problem:** <50ms for common
  operations on 5k–10k issues is hard if you frequently scan many files or call
  `git show` repeatedly.
  **Suggested change:** Add a normative expectation that common operations use the local
  index and/or diff-based incremental updates.

* * *

### Editorial/consistency nits (easy wins)

- **[V2-040] [MINOR] `--auto-sync` wording doesn’t match config key** **Where:** §5.5
  Migration gotchas (#3) **Problem:** Says “with `--auto-sync` config” but config key is
  `settings.auto_sync`. **Suggested change:** Replace with “with
  `settings.auto_sync: true`”.

- **[V2-041] [MINOR] Several sections call it “version-based conflict resolution” but
  detection is hash-based** **Where:** §1.1 Key characteristics, plus §3.4 **Problem:**
  Conflict detection uses content hash; version is only used inside merge ordering.
  **Suggested change:** Rephrase: “hash-based conflict detection with
  version/timestamp-based merge ordering + attic.”

- **[V2-042] [MINOR] Terminology: `type` vs `kind` vs CLI `--type`** **Where:** §2.5.3 +
  CLI **Problem:** Internally `type` is entity discriminator, but CLI uses `--type` for
  issue kind. Readers can get confused.
  **Suggested change:** Add an explicit note: “CLI `--type` maps to schema field
  `kind`.”

* * *

## A suggested “tightened Phase 1” spec stance (optional)

If you want to make Phase 1 even more clearly shippable, consider explicitly declaring:

- **Phase 1 local storage model** (where issue JSON lives on disk on a working branch)

- **Phase 1 safe git-write mechanism** (hidden worktree or isolated index; never touch
  user index)

- **Minimal attic UX** (list/show/restore)

- **Deterministic merge rules** (tie-breakers + array ordering)

- **ID policy** (internal length + display prefix/prefix-matching)

Those five changes remove most ambiguity and implementation risk, without expanding
scope beyond “Beads replacement.”
