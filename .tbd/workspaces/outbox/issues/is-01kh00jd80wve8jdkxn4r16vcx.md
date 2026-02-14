---
created_at: 2026-02-09T01:34:31.167Z
dependencies:
  - target: is-01kh00jm2mreweej0h9v929ae2
    type: blocks
  - target: is-01kh00jvdscyj8x10n206yq9tr
    type: blocks
  - target: is-01kh00k2cdef3ednq6q01yn6zr
    type: blocks
id: is-01kh00jd80wve8jdkxn4r16vcx
kind: task
labels: []
parent_id: is-01kh00hr6eq3p16ebr73y7cxk1
priority: 2
spec_path: docs/project/specs/active/plan-2026-02-02-external-docs-repos.md
status: open
title: "RED+GREEN: Update DocCache for prefix-based loading and lookup"
type: is
updated_at: 2026-02-09T01:35:40.394Z
version: 4
---
Rewrite DocCache constructor to accept (docsDir, sources: DocsSource[], docType: DocTypeName). Load scans .tbd/docs/{prefix}/{type}/ for each source in order. Add prefix field to CachedDoc. get() uses parseQualifiedName: qualified → direct prefix lookup, unqualified → search all prefixes in config order, throw AmbiguousLookupError if multiple matches. list() respects hidden flag. fuzzySearch updated for prefix awareness. TDD.
