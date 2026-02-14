---
created_at: 2026-02-09T01:40:33.950Z
dependencies:
  - target: is-01kh00xjycx5tpddt6nd9z6kdw
    type: blocks
id: is-01kh00xfgz06jh7nz2s8nvzcrh
kind: task
labels: []
parent_id: is-01kh00wq09fmchfvm0c8c2s2gg
priority: 2
spec_path: docs/project/specs/active/plan-2026-02-02-external-docs-repos.md
status: open
title: "Fresh install: setup --auto with default sources"
type: is
updated_at: 2026-02-09T01:40:53.919Z
version: 2
---
Create fresh test directory outside tbd repo. git init. Run local dev build: tbd setup --auto --prefix=test. Verify: config.yml has sources array with sys/tbd/spec, .tbd/.gitignore includes repo-cache/ and docs/, prefix directories created (.tbd/docs/sys/shortcuts/, .tbd/docs/tbd/shortcuts/, .tbd/docs/spec/guidelines/ etc). Verify content matches expected docs.
