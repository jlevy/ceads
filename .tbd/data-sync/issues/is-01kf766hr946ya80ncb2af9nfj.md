---
created_at: 2026-01-17T23:56:11.400Z
dependencies: []
id: is-01kf766hr946ya80ncb2af9nfj
kind: bug
labels: []
priority: 2
status: open
title: "Bug: Import changes ID prefix"
type: is
updated_at: 2026-01-17T23:56:11.400Z
version: 1
---
When importing from Beads, ID prefix changes based on local config.
Original tbd-100 becomes bd-100. Fix: auto-detect prefix or add --preserve-prefix flag.
