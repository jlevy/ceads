---
close_reason: Replaced with clearer task - we track issues at commit time, not parse git status
closed_at: 2026-01-18T08:33:38.545Z
created_at: 2026-01-18T08:32:25.029Z
dependencies:
  - target: is-01kf83qst1yakat6384xpw3bx1
    type: blocks
  - target: is-01kf83qt6gtdzx5gx98cc0y6jj
    type: blocks
id: is-01kf83qse6vx4ecdtp0e786v56
kind: task
labels: []
parent_id: is-01kf83qm50827p60a7cg7jkqpd
priority: 2
status: closed
title: Parse git status to identify modified issue files and extract issue IDs
type: is
updated_at: 2026-01-18T08:33:38.546Z
version: 6
---
In commitWorktreeChanges(), after getting git status output, parse it to:
1. Filter for issue files (.tbd/data-sync/issues/*.md)
2. Extract the internal issue ID from each file path
3. Determine the action (new/modified/deleted) from status code
4. Return structured data with issue IDs and their actions

Use parseGitStatus from syncSummary.ts as reference.
