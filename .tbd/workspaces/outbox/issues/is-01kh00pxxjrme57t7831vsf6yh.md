---
created_at: 2026-02-09T01:36:59.313Z
dependencies: []
id: is-01kh00pxxjrme57t7831vsf6yh
kind: task
labels: []
parent_id: is-01kh00nprzwe2hx8t0qbatyvqb
priority: 2
spec_path: docs/project/specs/active/plan-2026-02-02-external-docs-repos.md
status: open
title: Add tbd doctor checks for repo cache health
type: is
updated_at: 2026-02-09T01:36:59.313Z
version: 1
---
Add checkRepoCacheHealth() to doctor command. For each type:repo source: check if cache dir exists (.tbd/repo-cache/{slug}/), check if git repo is valid (git status), warn if missing with 'run tbd sync --docs to populate'. Report corrupted cache with 'delete and re-sync' suggestion. Also check for orphaned cache dirs (source removed from config). Tests with mock repo cache dirs.
