---
created_at: 2026-01-18T01:05:47.281Z
dependencies: []
id: is-01kf7a5zrhay313wqfvvej2tta
kind: feature
labels: []
priority: 2
status: open
title: Show Git version in tbd status command
type: is
updated_at: 2026-01-18T01:05:52.780Z
version: 2
---
Add Git version detection to tbd status command.

Requirements:
- Show detected Git version in status output
- Indicate whether the version is supported (2.42+)
- This should share code with tbd doctor's Git version check
- tbd doctor should remain the superset (more comprehensive checks)
