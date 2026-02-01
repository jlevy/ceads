/**
 * Sync summary formatting utilities.
 *
 * Provides consistent formatting for sync operation results.
 */

/**
 * Tallies for a sync direction (sent or received).
 */
export interface SyncTallies {
  new: number;
  updated: number;
  deleted: number;
}

/**
 * Full sync summary with both directions.
 */
export interface SyncSummary {
  sent: SyncTallies;
  received: SyncTallies;
  conflicts: number;
  /** True if push to remote failed */
  pushFailed?: boolean;
  /** Error message if push failed */
  pushError?: string;
}

/**
 * Create empty sync tallies.
 */
export function emptyTallies(): SyncTallies {
  return { new: 0, updated: 0, deleted: 0 };
}

/**
 * Create empty sync summary.
 */
export function emptySummary(): SyncSummary {
  return {
    sent: emptyTallies(),
    received: emptyTallies(),
    conflicts: 0,
  };
}

/**
 * Check if tallies have any non-zero values.
 */
export function hasTallies(tallies: SyncTallies): boolean {
  return tallies.new > 0 || tallies.updated > 0 || tallies.deleted > 0;
}

/**
 * Format tallies for display (e.g., "1 new, 2 updated").
 * Omits zero counts.
 */
export function formatTallies(tallies: SyncTallies): string {
  const parts: string[] = [];

  if (tallies.new > 0) {
    parts.push(`${tallies.new} new`);
  }
  if (tallies.updated > 0) {
    parts.push(`${tallies.updated} updated`);
  }
  if (tallies.deleted > 0) {
    parts.push(`${tallies.deleted} deleted`);
  }

  return parts.join(', ');
}

/**
 * Format sync summary for display.
 *
 * Examples:
 * - "sent 1 new"
 * - "sent 2 updated, received 1 new"
 * - "received 3 new, 1 updated"
 * - "" (empty if nothing to report - caller should show "Already in sync")
 */
export function formatSyncSummary(summary: SyncSummary): string {
  const parts: string[] = [];

  const sentStr = formatTallies(summary.sent);
  const receivedStr = formatTallies(summary.received);

  if (sentStr) {
    parts.push(`sent ${sentStr}`);
  }
  if (receivedStr) {
    parts.push(`received ${receivedStr}`);
  }

  if (parts.length === 0) {
    return '';
  }

  let result = parts.join(', ');

  if (summary.conflicts > 0) {
    result += ` (${summary.conflicts} conflict${summary.conflicts === 1 ? '' : 's'} resolved)`;
  }

  return result;
}

/**
 * Parse git status --porcelain output to get tallies.
 *
 * @param statusOutput - Output from `git status --porcelain`
 * @returns Tallies for new, updated, deleted files
 */
export function parseGitStatus(statusOutput: string): SyncTallies {
  const tallies = emptyTallies();

  if (!statusOutput || statusOutput.trim() === '') {
    return tallies;
  }

  for (const line of statusOutput.split('\n')) {
    if (!line) continue;

    const statusCode = line.slice(0, 2).trim();

    switch (statusCode) {
      case 'A':
      case '??':
        tallies.new++;
        break;
      case 'M':
      case 'MM':
        tallies.updated++;
        break;
      case 'D':
        tallies.deleted++;
        break;
    }
  }

  return tallies;
}

/**
 * Parse git diff --name-status output to get tallies.
 *
 * @param diffOutput - Output from `git diff --name-status`
 * @returns Tallies for new, updated, deleted files
 */
export function parseGitDiff(diffOutput: string): SyncTallies {
  const tallies = emptyTallies();

  if (!diffOutput || diffOutput.trim() === '') {
    return tallies;
  }

  for (const line of diffOutput.split('\n')) {
    if (!line) continue;

    const statusCode = line[0];

    switch (statusCode) {
      case 'A':
        tallies.new++;
        break;
      case 'M':
        tallies.updated++;
        break;
      case 'D':
        tallies.deleted++;
        break;
    }
  }

  return tallies;
}
