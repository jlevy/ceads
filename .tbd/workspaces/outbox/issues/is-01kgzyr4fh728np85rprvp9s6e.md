---
created_at: 2026-02-09T01:02:41.648Z
dependencies:
  - target: is-01kgzyrbcf260b1791a043ccpv
    type: blocks
id: is-01kgzyr4fh728np85rprvp9s6e
kind: task
labels: []
parent_id: is-01kgzypm020x8n0jgadn5g3v7x
priority: 2
spec_path: docs/project/specs/active/plan-2026-02-02-external-docs-repos.md
status: open
title: "RED+GREEN: Implement RepoCache class for sparse git checkouts"
type: is
updated_at: 2026-02-09T01:33:14.213Z
version: 3
---
Create src/file/repo-cache.ts with RepoCache class. Constructor takes tbdRoot, derives cacheDir as .tbd/repo-cache/. ensureRepo(url, ref, paths) does shallow sparse clone on first run (git clone --depth 1 --sparse --branch ref), updates on subsequent (git fetch --depth 1 + checkout FETCH_HEAD). scanDocs(repoDir, paths) finds all .md files in path patterns. Use child_process.execFile for security (no shell injection). Fallback to gh repo clone if git fails. Tests use git init --bare local repos. TDD: tests first.
