---
sandbox: true
env:
  NO_COLOR: '1'
  FORCE_COLOR: '0'
path:
  - ../dist
timeout: 30000
patterns:
  VERSION: 'v[0-9]+\.[0-9]+\.[0-9]+(-[a-z0-9.-]+)?'
  GIT_VERSION: '[0-9]+\.[0-9]+\.[0-9]+'
  PATH: '/[^\s]+'
before: |
  # Set up a test git repository
  git init --initial-branch=main
  git config user.email "test@example.com"
  git config user.name "Test User"
  git config commit.gpgsign false
  echo "# Test repo" > README.md
  git add README.md
  git commit -m "Initial commit"
  # Initialize tbd
  tbd init --prefix=go
  # Create test issues
  tbd create "First task" --type=task
  tbd create "Second task" --type=bug
---
# Orientation Commands: Golden Output Tests

These tests capture the FULL output of orientation commands (status, doctor, stats) to
ensure consistency and catch any formatting changes.

Changes to these outputs should be intentional and reviewed.

* * *

## Status Command (Post-Init)

This is the complete output of `tbd status` after initialization.

# Test: Status full output

```console
$ tbd status
tbd [VERSION]
Repository: [PATH]
  ✓ Initialized (.tbd/)
  ✓ Git repository (main)
  ✓ Git [GIT_VERSION]

Sync branch: tbd-sync
Remote: origin
ID prefix: go-

INTEGRATIONS
  ✗ Claude Code hooks (./.claude/settings.json)
  ✗ Codex AGENTS.md (./AGENTS.md)

Run tbd setup auto to configure detected agents

Worktree: [PATH] (healthy)

Use 'tbd stats' for issue statistics, 'tbd doctor' for health checks.
? 0
```

* * *

## Doctor Command

This is the complete output of `tbd doctor`.

# Test: Doctor full output

```console
$ tbd doctor
REPOSITORY
tbd [VERSION]
Repository: [PATH]
  ✓ Initialized (.tbd/)
  ✓ Git repository (main)

Sync branch: tbd-sync
Remote: origin
ID prefix: go-

STATISTICS
  Ready:       2
  In progress: 0
  Blocked:     0
  Open:        2
  Total:       2

INTEGRATIONS
⚠ Claude Code skill - not installed (.claude/skills/tbd/SKILL.md)
    Run: tbd setup --auto
⚠ Codex AGENTS.md - not installed (AGENTS.md)
    Run: tbd setup --auto

HEALTH CHECKS
✓ Git version - [GIT_VERSION]
✓ Config file (.tbd/config.yml)
✓ Issues directory (.tbd/issues)
✓ Dependencies
✓ Unique IDs
✓ ID mapping keys
✓ Temp files (.tbd/issues)
✓ Issue validity
✓ Worktree (.tbd/data-sync-worktree)
✓ Data location
✓ Local sync branch - tbd-sync
⚠ Remote sync branch - origin/tbd-sync not found
    Run: tbd sync to push local branch
⚠ Sync status - 2 local issues, remote branch not found
    Run: tbd sync to push issues to remote
✓ Clone status
✓ Sync consistency
✓ Repo cache - no repo sources configured

⚠ Issues found that may require manual intervention.
? 0
```

* * *

## Stats Command

This is the complete output of `tbd stats` showing the redesigned format with:
- Status icons (○ open, ◐ in_progress, ● blocked, ○ deferred, ✓ closed)
- Active/closed subtotals with separator lines
- Three-column layout (active, closed, total) for kind and priority breakdowns

# Test: Stats full output

```console
$ tbd stats
By status:
  ○ open               2
  ◐ in_progress        0
  ● blocked            0
  ○ deferred           0
  ──────────────────────
    active             2
  ✓ closed             0
  ══════════════════════
    total              2

By kind:            active  closed   total
  bug                    1       0       1
  task                   1       0       1

By priority:        active  closed   total
  P2 (Medium)            2       0       2

Use 'tbd status' for setup info, 'tbd doctor' for health checks.
? 0
```

* * *

## Comparison Notes

The following differences exist between status and doctor:

1. **Git version placement**:
   - status: Shows in REPOSITORY section as `✓ Git X.Y.Z`
   - doctor: Shows in HEALTH CHECKS section as `✓ Git version - X.Y.Z`

2. **INTEGRATIONS section uses different checks**:
   - status: Checks “Claude Code hooks” in ./.claude/settings.json
     (renderIntegrationsSection)
   - doctor: Checks “Claude Code skill” in .claude/skills/tbd/SKILL.md
     (renderDiagnostics)
   - status: 2-space indent (` ✓ ...`)
   - doctor: No indent (`⚠ ...`)
   - doctor: Includes “Run: ...” fix suggestions

3. **REPOSITORY heading**:
   - status: No heading (starts directly with `tbd vX.Y.Z`)
   - doctor: Has `REPOSITORY` heading first

4. **STATISTICS section**:
   - status: Does not show statistics (points to `tbd stats`)
   - doctor: Shows summary statistics with `STATISTICS` heading (Ready/In
     progress/Blocked/Open/Total)
   - stats: Shows detailed breakdown with status icons, active/closed subtotals, and
     three-column layout

5. **Shared sections from sections.ts**:
   - Repository section: SHARED (but gitVersion param differs)
   - Config section: SHARED
   - Integrations section: NOT SHARED (different renderers!)
   - Statistics section: SHARED (but different headings)

These differences reveal that “shared section renderers” are only partially shared.
The INTEGRATIONS section is NOT using the shared renderer in doctor.
