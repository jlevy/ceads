/**
 * Natural sort utilities.
 *
 * Provides alphanumeric sorting where numeric portions are sorted numerically.
 * Similar to `sort -V` (version sort) or `sort -n` for numbers.
 *
 * Examples:
 *   ["1", "2", "9", "10", "11"] instead of ["1", "10", "11", "2", "9"]
 *   ["a1", "a2", "a10"] instead of ["a1", "a10", "a2"]
 *   ["file1.txt", "file2.txt", "file10.txt"] instead of ["file1.txt", "file10.txt", "file2.txt"]
 */

/**
 * Split a string into alternating runs of digits and non-digits.
 * @param str - The string to split
 * @returns Array of [isNumeric, value] tuples
 */
function splitIntoChunks(str: string): [boolean, string][] {
  const chunks: [boolean, string][] = [];
  let current = '';
  let currentIsNumeric: boolean | null = null;

  for (const char of str) {
    const isDigit = char >= '0' && char <= '9';

    if (currentIsNumeric === null) {
      // First character
      currentIsNumeric = isDigit;
      current = char;
    } else if (isDigit === currentIsNumeric) {
      // Same type, continue accumulating
      current += char;
    } else {
      // Type changed, push current chunk and start new one
      chunks.push([currentIsNumeric, current]);
      currentIsNumeric = isDigit;
      current = char;
    }
  }

  // Push final chunk
  if (current) {
    chunks.push([currentIsNumeric!, current]);
  }

  return chunks;
}

/**
 * Compare two strings using natural (alphanumeric) ordering.
 *
 * Numeric portions are compared numerically, non-numeric portions are
 * compared lexicographically (case-insensitive). Numbers sort before letters
 * when they appear at the same position in mixed comparisons, matching
 * the behavior of `sort -V` (version sort).
 *
 * @param a - First string
 * @param b - Second string
 * @returns Negative if a < b, positive if a > b, zero if equal
 */
export function naturalCompare(a: string, b: string): number {
  // Handle empty strings
  if (!a && !b) return 0;
  if (!a) return -1;
  if (!b) return 1;

  const chunksA = splitIntoChunks(a);
  const chunksB = splitIntoChunks(b);

  const minLen = Math.min(chunksA.length, chunksB.length);

  for (let i = 0; i < minLen; i++) {
    const [isNumericA, valueA] = chunksA[i]!;
    const [isNumericB, valueB] = chunksB[i]!;

    if (isNumericA && isNumericB) {
      // Both are numeric - compare as numbers
      const numA = parseInt(valueA, 10);
      const numB = parseInt(valueB, 10);
      if (numA !== numB) {
        return numA - numB;
      }
      // If numerically equal but different strings (e.g., "01" vs "1"),
      // prefer shorter (fewer leading zeros)
      if (valueA.length !== valueB.length) {
        return valueA.length - valueB.length;
      }
    } else if (!isNumericA && !isNumericB) {
      // Both are non-numeric - compare lexicographically (case-insensitive)
      const lowerA = valueA.toLowerCase();
      const lowerB = valueB.toLowerCase();
      if (lowerA !== lowerB) {
        return lowerA.localeCompare(lowerB);
      }
      // Same when lowercased - they're equal for sorting purposes
    } else {
      // Mixed: numeric comes before non-numeric
      // (so "1" comes before "a" at the same position)
      // This matches `sort -V` behavior
      return isNumericA ? -1 : 1;
    }
  }

  // All compared chunks are equal, shorter string comes first
  return chunksA.length - chunksB.length;
}

/**
 * Sort an array of strings using natural (alphanumeric) ordering.
 *
 * @param arr - Array to sort
 * @returns New sorted array (does not mutate original)
 */
export function naturalSort(arr: readonly string[]): string[] {
  return [...arr].sort(naturalCompare);
}

/**
 * Sort an array of objects by a string key using natural ordering.
 *
 * @param arr - Array to sort
 * @param keyFn - Function to extract the sort key from each element
 * @returns New sorted array (does not mutate original)
 */
export function naturalSortBy<T>(arr: readonly T[], keyFn: (item: T) => string): T[] {
  return [...arr].sort((a, b) => naturalCompare(keyFn(a), keyFn(b)));
}
