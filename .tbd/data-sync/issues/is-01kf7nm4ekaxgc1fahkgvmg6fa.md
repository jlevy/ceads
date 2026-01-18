---
created_at: 2026-01-18T04:25:45.170Z
dependencies:
  - target: is-01kf7ncbebn4m3vf22k1jkkce5
    type: blocks
  - target: is-01kf7nccjfqg3mz4ash9sf10gc
    type: blocks
  - target: is-01kf7nce0tke23q8brce4p9ppn
    type: blocks
  - target: is-01kf7ncf2nwaden4yapxtkeqnh
    type: blocks
  - target: is-01kf7ncg54qrg8g2qvf1mswzy3
    type: blocks
  - target: is-01kf7nbezdmr4qwytemnz1mf20
    type: blocks
id: is-01kf7nm4ekaxgc1fahkgvmg6fa
kind: task
labels: []
priority: 2
status: open
title: Create shared diagnostic output utilities
type: is
updated_at: 2026-01-18T04:26:06.359Z
version: 7
---
Create shared utilities for consistent diagnostic output across doctor, setup --check, and status commands.

**Proposed interface:**
```typescript
interface DiagnosticResult {
  name: string;
  status: 'ok' | 'warn' | 'error';
  message?: string;
  path?: string;          // File/dir path being checked
  details?: string[];     // Specific items when issues found
  fixable?: boolean;
  suggestion?: string;    // e.g., 'Run: tbd setup claude'
}

function renderDiagnostic(result: DiagnosticResult, colors: Colors): void {
  const icon = result.status === 'ok' ? '✓' : result.status === 'warn' ? '⚠' : '✗';
  const pathInfo = result.path ? colors.dim(` (${result.path})`) : '';
  console.log(`${icon} ${result.name}${result.message ? ' - ' + result.message : ''}${pathInfo}`);
  
  if (result.details) {
    for (const detail of result.details) {
      console.log(`    ${detail}`);
    }
  }
  
  if (result.suggestion && result.status \!== 'ok') {
    console.log(`    ${result.suggestion}`);
  }
}
```

**Location options:**
1. Add to existing lib/output.ts
2. Create new lib/diagnostics.ts

**Used by:**
- doctor.ts - already uses similar CheckResult interface
- setup.ts - claude, codex, cursor --check handlers
- status.ts - integration checks
