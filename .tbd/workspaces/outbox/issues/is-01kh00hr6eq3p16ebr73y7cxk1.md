---
child_order_hints:
  - is-01kh00j5n25sdsppd2qnv6ver4
  - is-01kh00jd80wve8jdkxn4r16vcx
  - is-01kh00jm2mreweej0h9v929ae2
  - is-01kh00jvdscyj8x10n206yq9tr
  - is-01kh00k2cdef3ednq6q01yn6zr
  - is-01kh00ka8f786r7zxdgpg8sav1
  - is-01kh00kkcad26zfrxa83nn9fmr
created_at: 2026-02-09T01:34:09.613Z
dependencies:
  - target: is-01kh00nprzwe2hx8t0qbatyvqb
    type: blocks
id: is-01kh00hr6eq3p16ebr73y7cxk1
kind: task
labels: []
parent_id: is-01kgzyh3ph1pfngcvyab02nhe9
priority: 2
spec_path: docs/project/specs/active/plan-2026-02-02-external-docs-repos.md
status: open
title: "Phase 2: Prefix System and Lookup"
type: is
updated_at: 2026-02-09T01:43:28.323Z
version: 9
---
Implement prefix-based lookup in DocCache, update tbd setup for default sources with prefixes, add hidden source support, update --list output to show prefix when relevant, add progress indicators for repo checkout, implement error handling and recovery. Integration checkpoint: full setup + sync cycle against Speculate tbd branch. Multi-source test with rust-porting-playbook.
