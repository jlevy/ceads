/**
 * Utility for parsing limit options in CLI commands.
 */

/**
 * Parse a limit option and apply it to an array.
 *
 * @param items - Array to limit
 * @param limitOption - String limit option from CLI (may be undefined)
 * @returns Limited array (or original if no valid limit)
 */
export function applyLimit<T>(items: T[], limitOption: string | undefined): T[] {
  if (!limitOption) {
    return items;
  }
  const limit = parseInt(limitOption, 10);
  if (isNaN(limit) || limit <= 0) {
    return items;
  }
  return items.slice(0, limit);
}
