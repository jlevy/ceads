/**
 * Priority formatting and parsing utilities.
 *
 * Priority values range from 0 (critical) to 4 (backlog).
 * Display format uses "P" prefix: P0, P1, P2, P3, P4.
 */

import type { createColors } from '../cli/lib/output.js';

/**
 * Valid priority values.
 */
export const MIN_PRIORITY = 0;
export const MAX_PRIORITY = 4;

/**
 * Format a priority number for display.
 * Always uses "P" prefix format.
 *
 * @example formatPriority(0) → "P0"
 * @example formatPriority(2) → "P2"
 */
export function formatPriority(priority: number): string {
  return `P${priority}`;
}

/**
 * Parse a priority string to a number.
 * Accepts both numeric ("1") and prefixed ("P1") formats.
 * Case-insensitive for prefixed format.
 *
 * @example parsePriority("P1") → 1
 * @example parsePriority("p0") → 0
 * @example parsePriority("2") → 2
 * @example parsePriority("invalid") → undefined
 *
 * @returns The priority number, or undefined if invalid.
 */
export function parsePriority(input: string): number | undefined {
  const trimmed = input.trim().toUpperCase();
  if (!trimmed) return undefined;

  let numStr: string;
  if (trimmed.startsWith('P')) {
    // Prefixed format: P0, P1, etc.
    if (trimmed.length !== 2) return undefined;
    numStr = trimmed.slice(1);
  } else {
    // Numeric format: 0, 1, etc.
    numStr = trimmed;
  }

  const num = parseInt(numStr, 10);
  if (isNaN(num) || num < MIN_PRIORITY || num > MAX_PRIORITY) {
    return undefined;
  }

  return num;
}

/**
 * Get the color function for a priority value.
 *
 * - P0 (critical): red
 * - P1 (high): yellow
 * - P2-P4: no color (identity function)
 *
 * @param priority - The priority number (0-4)
 * @param colors - The colors object from createColors()
 * @returns A function that applies the appropriate color
 */
export function getPriorityColor(
  priority: number,
  colors: ReturnType<typeof createColors>,
): (s: string) => string {
  switch (priority) {
    case 0:
      return colors.error;
    case 1:
      return colors.warn;
    default:
      return (s) => s;
  }
}
