/**
 * Text truncation utilities for CLI output.
 *
 * Provides consistent truncation with Unicode ellipsis character.
 */

/**
 * Unicode ellipsis character (U+2026). Use this instead of '...'.
 */
export const ELLIPSIS = '…';

/**
 * Options for truncate function.
 */
export interface TruncateOptions {
  /** If true, truncate at last word boundary before maxLength. */
  wordBoundary?: boolean;
}

/**
 * Truncate text to maxLength, appending ellipsis if truncated.
 *
 * @param text - Text to truncate
 * @param maxLength - Maximum length including ellipsis
 * @param options - Truncation options
 * @returns Truncated text with ellipsis, or original if short enough
 */
export function truncate(text: string, maxLength: number, options?: TruncateOptions): string {
  if (maxLength <= 0) {
    return '';
  }

  if (text.length <= maxLength) {
    return text;
  }

  if (maxLength === 1) {
    return ELLIPSIS;
  }

  const truncatedLength = maxLength - 1; // Reserve space for ellipsis

  if (options?.wordBoundary) {
    // Find last space within the truncation limit
    const lastSpace = text.lastIndexOf(' ', truncatedLength);
    if (lastSpace > 0) {
      return text.slice(0, lastSpace) + ELLIPSIS;
    }
  }

  // Character-level truncation
  return text.slice(0, truncatedLength) + ELLIPSIS;
}

/**
 * Truncate text from the middle, preserving start and end.
 * Useful for paths and IDs where both prefix and suffix are meaningful.
 *
 * @param text - Text to truncate
 * @param maxLength - Maximum length including ellipsis
 * @returns Truncated text with ellipsis in middle, or original if short enough
 */
export function truncateMiddle(text: string, maxLength: number): string {
  if (maxLength <= 0) {
    return '';
  }

  if (text.length <= maxLength) {
    return text;
  }

  if (maxLength === 1) {
    return ELLIPSIS;
  }

  if (maxLength === 2) {
    // Only room for one char + ellipsis
    return text[0] + ELLIPSIS;
  }

  // Calculate how many characters to keep on each side
  // Subtract 1 for the ellipsis
  const availableChars = maxLength - 1;
  const endLength = Math.floor(availableChars / 2);
  const startLength = availableChars - endLength;

  const start = text.slice(0, startLength);
  const end = text.slice(text.length - endLength);

  return start + ELLIPSIS + end;
}
