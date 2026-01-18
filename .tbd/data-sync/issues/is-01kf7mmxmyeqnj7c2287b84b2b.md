---
created_at: 2026-01-18T04:08:42.397Z
dependencies:
  - target: is-01kf7mmy2wq0qgmaxj55vtsvsc
    type: blocks
id: is-01kf7mmxmyeqnj7c2287b84b2b
kind: task
labels: []
priority: 2
status: open
title: Debug mode git log output
type: is
updated_at: 2026-01-18T04:11:05.790Z
version: 4
---
Show git log --stat in debug mode after sync:
- After push: git log --stat origin/tbd-sync@{1}..origin/tbd-sync
- After pull: git log --stat HEAD@{1}..HEAD

Format:
[debug] Commits synced:
commit ee88823... (origin/tbd-sync, tbd-sync)
    tbd sync: 2026-01-17T23-50-56 (1 file)
 .tbd/data-sync/issues/is-01kf5...md | 8 ++++----
 1 file changed, 4 insertions(+), 4 deletions(-)

Reference: plan spec section 2.9 (Debug mode git log)
