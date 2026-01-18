/**
 * Status formatting utilities.
 *
 * Status values: open, in_progress, blocked, deferred, closed.
 */

import { ICONS, type createColors } from '../cli/lib/output.js';
import type { IssueStatusType } from './types.js';

/**
 * Get the icon for a status value.
 *
 * - open: ○ (empty circle)
 * - in_progress: ◐ (half-filled circle)
 * - blocked: ● (filled circle)
 * - deferred: ○ (empty circle, same as open)
 * - closed: ✓ (checkmark)
 */
export function getStatusIcon(status: IssueStatusType): string {
  switch (status) {
    case 'open':
      return ICONS.OPEN;
    case 'in_progress':
      return ICONS.IN_PROGRESS;
    case 'blocked':
      return ICONS.BLOCKED;
    case 'deferred':
      return ICONS.DEFERRED;
    case 'closed':
      return ICONS.CLOSED;
    default:
      return '';
  }
}

/**
 * Format a status for display with icon prefix.
 * Format: "icon status" (e.g., "○ open", "◐ in_progress")
 *
 * @example formatStatus('open') → "○ open"
 * @example formatStatus('blocked') → "● blocked"
 */
export function formatStatus(status: IssueStatusType): string {
  const icon = getStatusIcon(status);
  return `${icon} ${status}`;
}

/**
 * Get the color function for a status value.
 *
 * - open: blue (info)
 * - in_progress: green (success)
 * - blocked: red (error)
 * - deferred: dim
 * - closed: dim
 *
 * @param status - The status value
 * @param colors - The colors object from createColors()
 * @returns A function that applies the appropriate color
 */
export function getStatusColor(
  status: IssueStatusType,
  colors: ReturnType<typeof createColors>,
): (s: string) => string {
  switch (status) {
    case 'open':
      return colors.info;
    case 'in_progress':
      return colors.success;
    case 'blocked':
      return colors.error;
    case 'deferred':
      return colors.dim;
    case 'closed':
      return colors.dim;
    default:
      return (s) => s;
  }
}
