---
created_at: 2026-01-26T17:47:12.591Z
dependencies: []
id: is-01kfxpnctge6yktmfndca9z88e
kind: bug
labels: []
parent_id: is-01kfxpq9c0j5wdsqy6vsqc3d1g
priority: 2
status: open
title: "Redesign stats command output: unified status section with active/closed/total columns"
type: is
updated_at: 2026-01-26T17:53:22.790Z
version: 6
---
The `tbd stats` output needs restructuring and better formatting.

**Current problems:**
- Confusing 'Summary' vs 'By status' sections with overlapping info
- Numbers not right-aligned
- Missing useful breakdowns (active vs closed per category)
- Colors and icons not used consistently

**New design:**

```
By status:
  ○ open            24
  ◐ in_progress      3
  ● blocked         11
  ────────────────────
  ◦ active          38
  ✓ closed         534
  ════════════════════
    total          572

By kind:                active  closed   total
  bug                       5      41      46
  feature                  12      15      27
  task                     18     436     454
  epic                      3      36      39
  chore                     0       6       6

By priority:            active  closed   total
  P0 (Critical)             2      10      12
  P1 (High)                10     225     235
  P2 (Medium)              20     251     271
  P3 (Low)                  6      46      52
  P4 (Lowest)               0       2       2
```

**Key changes:**
1. Single 'By status' section listing all statuses, with 'active' subtotal, 'closed', and 'total'
2. 'By kind' and 'By priority' get 3 columns: active, closed, total
3. All counts right-aligned to consistent column
4. Status icons using getStatusIcon()
5. Appropriate colors for priorities and statuses
6. Separator lines for visual grouping

**File:** packages/tbd/src/cli/commands/stats.ts
