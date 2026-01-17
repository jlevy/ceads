---
created_at: 2026-01-17T23:39:35.999Z
dependencies: []
id: is-01kf7585p0257rymywxcnrhk6j
kind: task
labels: []
priority: 2
status: open
title: "Update design doc: conflict detection uses Git, not content hashing"
type: is
updated_at: 2026-01-17T23:39:35.999Z
version: 1
---
The v3 spec (tbd-full-design-v3.md) describes content hash comparison for conflict detection, but the actual implementation uses standard Git mechanics (push rejection triggers fetch+merge). Update design doc to reflect the simpler actual implementation.
