/**
 * Time utilities for tbd.
 *
 * All timestamps should be ISO 8601 UTC format with Z suffix.
 * Use these functions instead of raw Date calls for consistency.
 */

/**
 * Get current time as ISO 8601 UTC string.
 * Use this when recording timestamps for new/updated issues.
 */
export function now(): string {
  return new Date().toISOString();
}

/**
 * Get current time as Date object.
 * Use this when you need date arithmetic or comparisons.
 */
export function nowDate(): Date {
  return new Date();
}

/**
 * Parse a timestamp string to Date object.
 * Returns null if the timestamp is invalid.
 */
export function parseDate(timestamp: string | undefined | null): Date | null {
  if (!timestamp) return null;
  try {
    const date = new Date(timestamp);
    if (isNaN(date.getTime())) return null;
    return date;
  } catch {
    return null;
  }
}

/**
 * Normalize any timestamp to ISO 8601 UTC format with Z suffix.
 * Handles various formats including timezone offsets like -08:00.
 * Returns null if the timestamp is invalid or missing.
 */
export function normalizeTimestamp(timestamp: string | undefined | null): string | null {
  const date = parseDate(timestamp);
  return date?.toISOString() ?? null;
}

/**
 * Check if a timestamp string is valid.
 */
export function isValidTimestamp(timestamp: string | undefined | null): boolean {
  return parseDate(timestamp) !== null;
}

/**
 * Get current time as a filename-safe timestamp.
 * Replaces colons with dashes and removes milliseconds for filesystem compatibility.
 */
export function nowFilenameTimestamp(): string {
  return new Date()
    .toISOString()
    .replace(/:/g, '-')
    .replace(/\.\d+Z$/, 'Z');
}
