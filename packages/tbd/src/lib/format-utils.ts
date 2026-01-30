/**
 * Human-readable formatting utilities for tbd CLI.
 *
 * Uses sindresorhus libraries for consistent, well-tested formatting:
 * - pretty-bytes: Byte sizes (1337 -> "1.34 kB")
 * - pretty-ms: Durations (3600000 -> "1h")
 */

import prettyBytes from 'pretty-bytes';
import prettyMs from 'pretty-ms';

import { CHARS_PER_TOKEN } from './paths.js';

// Re-export for direct use when needed
export { prettyBytes, prettyMs };

// =============================================================================
// Token Estimation
// =============================================================================

/**
 * Estimate token count from text content.
 * Uses CHARS_PER_TOKEN (~3.5) for markdown/code content.
 */
export function estimateTokens(text: string): number {
  return Math.ceil(text.length / CHARS_PER_TOKEN);
}

/**
 * Format token count: "~1.2k tok" or "~450 tok"
 */
export function formatTokens(tokens: number): string {
  if (tokens >= 1000) {
    return `~${(tokens / 1000).toFixed(1)}k tok`;
  }
  return `~${tokens} tok`;
}

// =============================================================================
// Size Formatting
// =============================================================================

/**
 * Format doc size for list display: "(1.8 kB, ~450 tok)"
 */
export function formatDocSize(sizeBytes: number, approxTokens: number): string {
  return `(${prettyBytes(sizeBytes)}, ${formatTokens(approxTokens)})`;
}

// =============================================================================
// Time Formatting
// =============================================================================

/**
 * Format relative time from Date: "2d ago", "3h ago", "5m ago"
 * Uses compact format for concise display.
 */
export function formatTimeAgo(date: Date): string {
  const ms = Date.now() - date.getTime();
  if (ms < 0) return 'just now';
  if (ms < 60000) return 'just now'; // Less than 1 minute
  return `${prettyMs(ms, { compact: true })} ago`;
}

/**
 * Format relative time from ISO timestamp string.
 * Returns null if timestamp is invalid.
 */
export function formatTimestampAgo(timestamp: string | undefined | null): string | null {
  if (!timestamp) return null;
  const date = new Date(timestamp);
  if (isNaN(date.getTime())) return null;
  return formatTimeAgo(date);
}

/**
 * Format duration in milliseconds: "2h 15m", "3d 4h"
 * Uses verbose format for clarity.
 */
export function formatDuration(ms: number): string {
  return prettyMs(ms, { verbose: true });
}

/**
 * Format duration compactly: "2h", "3d"
 * Uses compact format for tables and tight spaces.
 */
export function formatDurationCompact(ms: number): string {
  return prettyMs(ms, { compact: true });
}
