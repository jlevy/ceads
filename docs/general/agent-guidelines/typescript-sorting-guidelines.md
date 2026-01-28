# TypeScript Sorting Patterns

**Author**: Joshua Levy (github.com/jlevy) with LLM assistance

**Last Updated**: 2026-01-28

**Related**:

- `docs/general/agent-guidelines/typescript-testing-guidelines.md`
- `docs/general/agent-guidelines/golden-testing-guidelines.md`

* * *

## 1. Always Make Sorting Deterministic

Never leave a sort with only a primary key.
When two items have the same primary sort value, the output order is undefined and will
vary across runs, platforms, and data sizes.
This causes flaky tests, confusing UI, and unreproducible bugs.

**Always add a secondary (or tertiary) sort key that is guaranteed unique**, such as an
ID or timestamp.

### ❌ BAD: Primary sort only

```typescript
// If two issues share the same priority, order is random.
issues.sort((a, b) => a.priority - b.priority);
```

### ✅ GOOD: Secondary sort for determinism

```typescript
issues.sort((a, b) => {
  const cmp = a.priority - b.priority;
  if (cmp !== 0) return cmp;
  return a.id.localeCompare(b.id);
});
```

This pattern applies everywhere: UI lists, CLI output, test assertions, API responses.
If you can’t guarantee uniqueness of the primary key, you need a tiebreaker.

## 2. Use Comparison Chains for Multi-Field Sorts

Hand-written multi-field comparators are verbose and error-prone.
A **comparison chain** (inspired by Google Guava’s `ComparisonChain`) provides a fluent
API that’s easier to read, write, and maintain.

### Before: Manual multi-field sort with nulls

```typescript
items.sort((a, b) => {
  // Primary: priority ascending
  if (a.priority !== b.priority) return a.priority - b.priority;
  // Secondary: title, nulls last
  if (a.title === null && b.title !== null) return 1;
  if (a.title !== null && b.title === null) return -1;
  if (a.title !== null && b.title !== null) {
    const cmp = a.title.localeCompare(b.title);
    if (cmp !== 0) return cmp;
  }
  // Tertiary: ID for determinism
  return a.id.localeCompare(b.id);
});
```

### After: Comparison chain

```typescript
items.sort(
  comparisonChain<Item>()
    .compare((i) => i.priority)
    .compare((i) => i.title, ordering.nullsLast)
    .compare((i) => i.id)
    .result(),
);
```

The chain short-circuits: once a `.compare()` step returns non-zero, subsequent steps
are skipped. This matches the semantics of manual `if (cmp !== 0) return cmp` chains.

## 3. Comparison Chain Reference Implementation

The following is a standalone, dependency-free utility.
Copy it into your project:

```typescript
export type Selector<T, K> = (item: T) => K;
export type Comparator<T> = (a: T, b: T) => number;

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const defaultCompare: Comparator<any> = (a, b) => {
  if (typeof a === 'string' && typeof b === 'string') {
    return a.localeCompare(b);
  }
  if (a < b) return -1;
  if (a > b) return 1;
  return 0;
};

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const nullLastCompare: Comparator<any> = (a, b) => {
  if (a == null) return b == null ? 0 : 1;
  if (b == null) return -1;
  return defaultCompare(a, b);
};

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const nullFirstCompare: Comparator<any> = (a, b) => {
  if (a == null) return b == null ? 0 : -1;
  if (b == null) return 1;
  return defaultCompare(a, b);
};

/**
 * A Google Guava-style comparison chain for fluent multi-field sorting.
 *
 * items.sort(comparisonChain<Item>()
 *   .compare(item => item.title, ordering.nullsLast)
 *   .compare(item => item.url)
 *   .result());
 */
export const comparisonChain = <T>() => {
  let compare: Comparator<T> = () => 0;

  const chain: {
    compare: <K>(selector: Selector<T, K>, comparator?: Comparator<K>) => typeof chain;
    result: () => Comparator<T>;
  } = {
    compare: <K>(selector: Selector<T, K>, comparator: Comparator<K> = defaultCompare) => {
      const prevCompare = compare;
      compare = (a, b) => prevCompare(a, b) || comparator(selector(a), selector(b));
      return chain;
    },
    result: () => compare,
  };

  return chain;
};

export const reverse =
  <T>(comparator: Comparator<T>) =>
  (a: T, b: T) =>
    comparator(b, a);

const manualOrderComparator = <T>(order: readonly T[]): Comparator<T> => {
  const orderMap = new Map(order.map((value, index) => [value, index]));
  return (a: T, b: T): number => {
    const indexA = orderMap.get(a);
    const indexB = orderMap.get(b);
    if (indexA === undefined) return indexB === undefined ? 0 : 1;
    if (indexB === undefined) return -1;
    return indexA - indexB;
  };
};

export const ordering = {
  nullsLast: nullLastCompare,
  nullsFirst: nullFirstCompare,
  default: defaultCompare,
  reversed: reverse(defaultCompare),
  manual: manualOrderComparator,
};
```

## 4. Common Ordering Strategies

| Ordering | Behavior |
| --- | --- |
| `ordering.default` | Strings via `localeCompare`, numbers via `<`/`>` |
| `ordering.reversed` | Reverse of default (descending) |
| `ordering.nullsLast` | `null`/`undefined` sort after all non-null values |
| `ordering.nullsFirst` | `null`/`undefined` sort before all non-null values |
| `ordering.manual(…)` | Sort by position in an explicit array; unlisted go last |
| `reverse(cmp)` | Wrap any comparator to invert its direction |

## 5. Usage Examples

### Simple priority + ID sort

```typescript
issues.sort(
  comparisonChain<Issue>()
    .compare((i) => i.priority)
    .compare((i) => i.id)
    .result(),
);
```

### Descending date with ID tiebreaker

```typescript
staleItems.sort(
  comparisonChain<StaleItem>()
    .compare((s) => s.daysSinceUpdate, ordering.reversed)
    .compare((s) => s.issue.id)
    .result(),
);
```

### Multi-field with nulls

```typescript
items.sort(
  comparisonChain<Item>()
    .compare((i) => i.title, ordering.nullsLast)
    .compare((i) => i.url, ordering.nullsLast)
    .compare((i) => i.sequenceNum, ordering.nullsLast)
    .result(),
);
```

### Custom enum ordering

```typescript
const statusOrder = ['active', 'pending', 'archived'] as const;

items.sort(
  comparisonChain<Item>()
    .compare((i) => i.status, ordering.manual(statusOrder))
    .compare((i) => i.name)
    .result(),
);
```

### With a custom comparator (e.g. natural sort)

```typescript
import { naturalCompare } from './sort.js';

items.sort(
  comparisonChain<Item>()
    .compare((i) => i.priority)
    .compare((i) => getShortId(i), (a, b) => naturalCompare(a, b))
    .result(),
);
```
