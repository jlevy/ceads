---
close_reason: null
closed_at: 2026-01-25T10:00:37.006Z
created_at: 2026-01-25T10:00:07.864Z
dependencies: []
id: is-01kft9hdxsrstpfmyyxcerw3pt
kind: task
labels:
  - chore
priority: 2
status: closed
title: Remove .tbd/docs from git tracking (now gitignored)
type: is
updated_at: 2026-01-25T10:00:37.007Z
version: 2
---
The .tbd/docs directory is now gitignored and regenerated on setup. Need to remove it from git tracking with 'git rm -r --cached .tbd/docs/' and commit the change.
