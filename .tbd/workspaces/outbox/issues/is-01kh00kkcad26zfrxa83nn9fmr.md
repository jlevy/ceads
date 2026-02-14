---
created_at: 2026-02-09T01:35:10.216Z
dependencies: []
id: is-01kh00kkcad26zfrxa83nn9fmr
kind: task
labels: []
parent_id: is-01kh00hr6eq3p16ebr73y7cxk1
priority: 2
spec_path: docs/project/specs/active/plan-2026-02-02-external-docs-repos.md
status: open
title: "Integration checkpoint: full setup + sync + multi-source test"
type: is
updated_at: 2026-02-09T01:35:10.216Z
version: 1
---
End-to-end test: tbd setup --auto with default sources → tbd sync --docs → verify prefix directories created correctly (.tbd/docs/sys/shortcuts/, .tbd/docs/tbd/shortcuts/, .tbd/docs/spec/guidelines/). Add rust-porting-playbook as secondary source with prefix rpp. Verify both sources sync without collision. Test unqualified and qualified lookups. Verify --list shows prefixes.
