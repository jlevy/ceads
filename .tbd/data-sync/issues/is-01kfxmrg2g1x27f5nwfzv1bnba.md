---
close_reason: "Fixed: setup.ts:1407-1411 now distinguishes created vs updated vs no-op"
closed_at: 2026-01-28T04:06:53.905Z
created_at: 2026-01-26T17:13:57.071Z
dependencies:
  - target: is-01kfxms7r482jq06yy7hdrpfcn
    type: blocks
id: is-01kfxmrg2g1x27f5nwfzv1bnba
kind: bug
labels: []
priority: 3
status: closed
title: Fix .tbd/.gitignore messaging to distinguish created vs updated vs no-op
type: is
updated_at: 2026-01-28T04:06:53.906Z
version: 4
---
In setup.ts:1159, we always print 'Created .tbd/.gitignore' but ensureGitignorePatterns returns { added, skipped, created } which tells us exactly what happened. Should show: Created (new file), Updated (patterns added), or nothing (already up to date). Location: packages/tbd/src/cli/commands/setup.ts#L1142-1159
