---
title: Convex Limits and Best Practices
description: Comprehensive reference for Convex platform limits, workarounds, and performance best practices
author: Joshua Levy (github.com/jlevy) with LLM assistance
---
# Convex Database Limits, Best Practices, and Workarounds

## Core Limits Reference

### Transaction Read/Write Limits

| Limit Type | Value |
| --- | --- |
| Maximum data read | 8 MiB per query/mutation |
| Maximum documents scanned | 16,384 per query/mutation |
| Maximum data written | 8 MiB per mutation |
| Maximum documents written | 8,192 per mutation |
| Maximum db.get/db.query calls | 4,096 per transaction |

The read limit includes **all scanned document bytes**, not just returned results.
Convex does not support field projection.

### Document Size and Structure Limits

| Limit | Value |
| --- | --- |
| Maximum document size | 1 MiB |
| Maximum fields per document | 1,024 |
| Maximum nesting depth | 16 levels |
| Maximum array elements | 8,192 per array |
| Maximum field name length | 1,024 characters |
| Maximum identifier length | 64 characters |

The 8,192 array limit also applies to arrays **returned** by query functions.
Use `.take(8000)` to stay safely under this limit.

### Concurrency and Execution Limits

| Limit | Value |
| --- | --- |
| Concurrent queries/mutations/actions (default) | 16 each |
| Scheduled job parallelism | 10 concurrent |
| Query/Mutation user timeout | 1 second |
| Action timeout | 10 minutes |
| Log lines per execution | 256 (silently truncated) |
| Max scheduled per mutation | 1,000 |

### Action Memory Limits

| Runtime | Memory Limit |
| --- | --- |
| Convex Runtime (default) | 64 MB |
| Node.js Runtime (`"use node;"`) | 512 MB |

### Index and Schema Limits

| Limit | Value |
| --- | --- |
| Indexes per table | 32 (source code: 64) |
| Fields per index | 16 |
| Full-text indexes per table | 4 |
| Vector indexes per table | 4 |
| Vector index max documents | 100,000 |
| Maximum tables | 10,000 |

### Storage and Bandwidth (Starter / Professional)

| Resource | Starter | Professional |
| --- | --- | --- |
| Database storage | 0.5 GB | 50 GB |
| Database bandwidth/month | 1 GB | 50 GB |
| File storage | 1 GB | 100 GB |
| Function calls/month | 1,000,000 | 25,000,000 |

## Function Calling Rules

| Caller | Can Call | Method |
| --- | --- | --- |
| Query | Helper functions only | Direct call |
| Mutation | Helper functions only | Direct call |
| Action | Queries, mutations, actions | `ctx.runQuery/runMutation/runAction` |

- Queries and mutations cannot call other queries/mutations
- Actions orchestrate across transactions (not atomic)
- Avoid nested same-runtime action calls; use helper functions instead

## Common Pitfalls and Workarounds

### 1. Exceeding 8 MiB Read Limit with `.collect()`

Never use `.collect()` on unbounded tables.
Use `.take(n)` or `.paginate()`.

### 2. Large Documents Causing Read Limit Issues

Keep documents used for listing/counting small (<10KB). Store large payloads in separate
detail tables.

### 3. Counting/Aggregating Large Datasets

Use the [Convex Aggregate Component](https://github.com/get-convex/aggregate) for O(log
n) counts and sums.

### 4. Post-Index Filtering

Create composite indexes instead of `.withIndex()` followed by `.filter()`.

```typescript
// BAD: reads all items for parentId, then filters
.withIndex('by_parent', q => q.eq('parentId', id))
.filter(q => q.eq(q.field('status'), 'active'))

// GOOD: composite index
.withIndex('by_parent_and_status', q => q.eq('parentId', id).eq('status', 'active'))
```

### 5. OCC Conflicts

- Consolidate related writes into single mutations
- Batch create operations
- Use namespacing to isolate writes
- Stagger scheduled mutations with delays

### 6. Pagination Loops in Queries

Never use pagination loops in queries/mutations (1s timeout, test hangs).
Use actions for pagination loops (10-minute limit).

### 7. Bucket Timestamp Keys

Bucket monotonically increasing keys to spread writes across B-tree nodes:

```typescript
const bucketedTime = Math.floor(timestamp / 60000) * 60000;
```

### 8. Dangling Promises in Actions

Always `await` every async call.
Never use `void asyncFn()` or `asyncFn().catch()`. Use `ctx.scheduler.runAfter` for
truly independent operations.

### 9. Nested Same-Runtime Action Calls

Use `ctx.runAction()` only for cross-runtime calls (V8 to Node.js).
Extract shared logic into plain TypeScript helper functions.

## Best Practices Checklist

- Never `.collect()` on unbounded tables; use `.take()` or `.paginate()`
- Use composite indexes matching query patterns
- Keep listing documents small (<10KB); separate large payloads
- Use Aggregate Component for stats over >100 records
- Bound all aggregate reads with `lower`/`upper`
- Namespace writes to avoid OCC contention
- Keep queries/mutations under 1 second; use actions for heavy work
- Await all promises in actions
- Use `internalQuery`/`internalMutation`/`internalAction` for private functions
- Always include `args` and `returns` validators

## Decision Matrix

| Use Case | Pattern |
| --- | --- |
| Count <100 records | Direct `.collect()` |
| Count 100-1000 records | `.take(limit)` with head+1 |
| Count >1000 records | Aggregate Component |
| List unbounded records | `.paginate()` |
| Large text fields (>10KB) | Separate detail table |
| Processing <10 min | Action with progress logging |
| Processing >10 min | Resumable action or scheduled jobs |
