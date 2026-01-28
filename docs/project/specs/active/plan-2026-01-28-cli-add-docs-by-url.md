# Plan Spec: CLI --add for Guidelines, Shortcuts, and Templates

## Purpose

Add `--add <url>` and `--name <name>` options to the `tbd guidelines`, `tbd shortcut`,
and `tbd template` commands so users can register external documentation from URLs
(including GitHub blob URLs) via a single CLI invocation.

## Background

The configurable doc cache system (see plan-2026-01-26-configurable-doc-cache-sync.md)
allows docs to be sourced from both internal bundled files and external URLs.
However, adding an external doc currently requires manually editing `config.yml` and
placing the file in the right directory.
This spec adds a streamlined CLI workflow.

### Related Work

- [plan-2026-01-26-configurable-doc-cache-sync.md](done/plan-2026-01-26-configurable-doc-cache-sync.md)
  \- Designed the configurable doc cache and auto-sync system
- [plan-2026-01-22-doc-cache-abstraction.md](done/plan-2026-01-22-doc-cache-abstraction.md)
  \- Implemented DocCache with path-ordered lookups

## Summary of Task

Allow users to add external docs by URL with a single command:

```bash
tbd guidelines --add <url> --name <name>
tbd shortcut --add <url> --name <name>
tbd template --add <url> --name <name>
```

The command:

1. Converts GitHub blob URLs to raw URLs automatically
2. Fetches the content (with `gh` CLI fallback on HTTP 403)
3. Validates the content (not empty, not HTML, not binary)
4. Writes the file to the appropriate `.tbd/docs/` subdirectory
5. Atomically updates `config.yml` with the source URL and lookup path

## Design Decisions

### User-added shortcuts go to `shortcuts/custom/`

User-added shortcuts are stored in `.tbd/docs/shortcuts/custom/` rather than
`shortcuts/standard/` to keep them separate from bundled docs.
This avoids confusion during `tbd docs --refresh` and makes it clear which docs are
user-provided vs. bundled.

### GitHub URL handling

GitHub blob URLs (`github.com/.../blob/...`) are automatically converted to raw URLs
(`raw.githubusercontent.com/...`). If direct HTTP fetch returns 403 (common in CI
environments and corporate proxies), the system falls back to `gh api` which
authenticates via the user’s GitHub CLI token.

### Shared `github-fetch.ts` utility

All GitHub URL conversion and fetching logic is consolidated in
`src/file/github-fetch.ts`, reused by both `doc-add.ts` (the `--add` flow) and
`doc-sync.ts` (the periodic sync flow).
This gives `doc-sync` the gh CLI fallback for free.

### Content validation

Fetched content is sanity-checked before writing:
- Not empty or whitespace-only
- Not too short (< 10 chars)
- Not an HTML error page
- Not binary content

## Implementation

### New files

- `src/file/github-fetch.ts` — Shared GitHub URL utilities and fetch with fallback
  - `githubBlobToRawUrl()` — Convert blob URLs to raw URLs
  - `isGitHubUrl()` — Check if URL is GitHub-hosted
  - `parseRawGitHubUrl()` — Parse raw URL into {owner, repo, ref, path}
  - `directFetch()` — HTTP fetch with timeout and headers
  - `ghCliFetch()` — Fetch via `gh api` with base64 decoding
  - `fetchWithGhFallback()` — Combined: direct first, gh CLI on 403

- `src/file/doc-add.ts` — Doc-specific add logic
  - `validateDocContent()` — Content sanity checks
  - `getDocTypeSubdir()` — Map doc type to filesystem path
  - `addDoc()` — Orchestrates fetch, validate, write, config update

### Modified files

- `src/cli/commands/guidelines.ts` — Added `--add`/`--name` options and handler
- `src/cli/commands/shortcut.ts` — Added `--add`/`--name` options and handler
- `src/cli/commands/template.ts` — Added `--add`/`--name` options and handler
- `src/cli/lib/doc-command-handler.ts` — Added `handleAdd()` to base class
- `src/file/doc-sync.ts` — Refactored to use shared `github-fetch.ts`

### Tests

- `tests/github-fetch.test.ts` — Mocked unit tests for all fetch functions (directFetch
  HTTP status codes, ghCliFetch base64 decode and API URL construction,
  fetchWithGhFallback 403 fallback path)
- `tests/doc-add.test.ts` — Mocked unit tests for addDoc (file write, config update,
  lookup_path dedup, error propagation)
- `tests/doc-add-e2e.test.ts` — End-to-end CLI tests

## Validation

- [x] All 728 tests pass
- [x] No test uses try/catch to silently skip — all fetch logic is mocked
- [x] Lint, typecheck, and format pass
- [x] Build succeeds
- [x] Merged with upstream main cleanly
