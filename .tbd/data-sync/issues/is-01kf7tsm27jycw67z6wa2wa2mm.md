---
created_at: 2026-01-18T05:56:07.878Z
dependencies: []
id: is-01kf7tsm27jycw67z6wa2wa2mm
kind: task
labels: []
priority: 2
status: open
title: Parallelize file reading in listIssues() for faster list command
type: is
updated_at: 2026-01-18T05:56:24.501Z
version: 2
---
## Problem

The listIssues() function in file/storage.ts reads issue files sequentially with await in a for loop. With 351 issues, this takes ~100ms.

## Evidence

- Sequential read+parse: 100ms for 351 issues
- Parallel read (Promise.all) + sequential parse: 63ms
- Potential savings: ~35ms (35% faster for file I/O phase)

## Current Code (storage.ts:61-72)

```typescript
for (const file of files) {
  const issue = await readIssue(baseDir, id);  // Sequential!
  issues.push(issue);
}
```

## Fix

Use Promise.all for file reading, then parse sequentially:

```typescript
const contents = await Promise.all(
  files.map(f => readFile(join(issuesDir, f), 'utf-8'))
);
// Then parse each content
```
