/**
 * Comparison chain utilities for complex multi-field sorting.
 *
 * Inspired by Google Guava's ComparisonChain, this provides a fluent API
 * for building comparators with multiple sort keys, null handling, and
 * custom orderings.
 *
 * Example:
 *
 *   items.sort(comparisonChain<Item>()
 *     .compare(item => item.title, ordering.nullsLast)
 *     .compare(item => item.url)
 *     .result());
 */

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
 * A Google Guava-style comparison chain to make complex sorting, such as secondary
 * sorts, significantly easier.
 *
 * For example:
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

/**
 * Reverse a comparator's ordering.
 */
export const reverse =
  <T>(comparator: Comparator<T>) =>
  (a: T, b: T) =>
    comparator(b, a);

/**
 * Create a comparator that sorts values in a manually specified order.
 * Values not in the order array are placed at the end.
 */
const manualOrderComparator = <T>(order: readonly T[]): Comparator<T> => {
  const orderMap = new Map(order.map((value, index) => [value, index]));

  return (a: T, b: T): number => {
    const indexA = orderMap.get(a);
    const indexB = orderMap.get(b);

    // Values not in the manually ordered array go at the end.
    if (indexA === undefined) return indexB === undefined ? 0 : 1;
    if (indexB === undefined) return -1;

    return indexA - indexB;
  };
};

/**
 * Common ordering strategies for use with comparisonChain.
 */
export const ordering = {
  nullsLast: nullLastCompare,
  nullsFirst: nullFirstCompare,
  default: defaultCompare,
  reversed: reverse(defaultCompare),
  manual: manualOrderComparator,
};
