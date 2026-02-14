---
created_at: 2026-02-09T01:02:55.639Z
dependencies: []
id: is-01kgzyrj4rhv2kjncymrzf01br
kind: task
labels: []
parent_id: is-01kgzypm020x8n0jgadn5g3v7x
priority: 2
spec_path: docs/project/specs/active/plan-2026-02-02-external-docs-repos.md
status: open
title: "Integration checkpoint: test sync against Speculate tbd branch"
type: is
updated_at: 2026-02-09T01:32:48.366Z
version: 2
---
Integration checkpoint: test full sync cycle against Speculate tbd branch. Run sync-repos.sh to clone jlevy/speculate (tbd branch) to repos/speculate/. Configure local tbd with spec source pointing to local repo (file:// URL or direct path). Run tbd sync --docs. Verify: files land in .tbd/docs/spec/{type}/{name}.md, all expected doc types present, content matches source. Test with jlevy/rust-porting-playbook as secondary source. Document any issues found.
