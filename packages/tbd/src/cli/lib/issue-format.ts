/**
 * Issue formatting utilities for consistent CLI output.
 *
 * Provides standardized formatting for issue display across all commands.
 */

import { formatPriority, getPriorityColor } from '../../lib/priority.js';
import { getStatusIcon, getStatusColor } from '../../lib/status.js';
import { truncate, ELLIPSIS } from '../../lib/truncate.js';
import type { createColors } from './output.js';
import type { IssueKindType, IssueStatusType } from '../../lib/types.js';

/**
 * Column width constants for issue tables.
 */
export const ISSUE_COLUMNS = {
  ID: 12,
  PRIORITY: 5,
  STATUS: 16,
  ASSIGNEE: 10,
} as const;

/**
 * Issue data structure for formatting.
 */
export interface IssueForDisplay {
  id: string;
  priority: number;
  status: IssueStatusType;
  kind: IssueKindType;
  title: string;
  description?: string;
  labels?: string[];
  assignee?: string;
}

/**
 * Format a kind in brackets.
 *
 * @example formatKind('bug') → "[bug]"
 * @example formatKind('feature') → "[feature]"
 */
export function formatKind(kind: IssueKindType): string {
  return `[${kind}]`;
}

/**
 * Format a standard issue line for table display.
 *
 * Format: {ID}  {PRI}  {STATUS}  [kind] {TITLE}
 *
 * @example "bd-a1b2     P0   ● blocked        [bug] Fix authentication timeout"
 */
export function formatIssueLine(
  issue: IssueForDisplay,
  colors: ReturnType<typeof createColors>,
): string {
  const idCol = colors.id(issue.id.padEnd(ISSUE_COLUMNS.ID));
  const priCol = getPriorityColor(
    issue.priority,
    colors,
  )(formatPriority(issue.priority).padEnd(ISSUE_COLUMNS.PRIORITY));
  const statusText = `${getStatusIcon(issue.status)} ${issue.status}`;
  const statusCol = getStatusColor(issue.status, colors)(statusText.padEnd(ISSUE_COLUMNS.STATUS));
  const kindPrefix = colors.dim(formatKind(issue.kind));

  return `${idCol}${priCol}${statusCol}${kindPrefix} ${issue.title}`;
}

/**
 * Format an extended issue line with assignee column.
 *
 * Format: {ID}  {PRI}  {STATUS}  {ASSIGNEE}  [kind] {TITLE}
 */
export function formatIssueLineExtended(
  issue: IssueForDisplay,
  colors: ReturnType<typeof createColors>,
): string {
  const idCol = colors.id(issue.id.padEnd(ISSUE_COLUMNS.ID));
  const priCol = getPriorityColor(
    issue.priority,
    colors,
  )(formatPriority(issue.priority).padEnd(ISSUE_COLUMNS.PRIORITY));
  const statusText = `${getStatusIcon(issue.status)} ${issue.status}`;
  const statusCol = getStatusColor(issue.status, colors)(statusText.padEnd(ISSUE_COLUMNS.STATUS));
  const assigneeText = issue.assignee ? `@${issue.assignee}` : '-';
  const assigneeCol = assigneeText.padEnd(ISSUE_COLUMNS.ASSIGNEE);
  const kindPrefix = colors.dim(formatKind(issue.kind));

  return `${idCol}${priCol}${statusCol}${assigneeCol}${kindPrefix} ${issue.title}`;
}

/**
 * Format an issue line with labels.
 *
 * Format: {ID}  {PRI}  {STATUS}  [kind] {TITLE}  [labels]
 */
export function formatIssueWithLabels(
  issue: IssueForDisplay,
  colors: ReturnType<typeof createColors>,
): string {
  const baseLine = formatIssueLine(issue, colors);

  if (!issue.labels || issue.labels.length === 0) {
    return baseLine;
  }

  const labelsText = colors.label(`[${issue.labels.join(', ')}]`);
  return `${baseLine}  ${labelsText}`;
}

/**
 * Format a compact issue reference.
 *
 * Format: {ID} {STATUS_ICON} {TITLE}
 * (No kind shown)
 *
 * @example "bd-a1b2 ● Fix authentication timeout"
 */
export function formatIssueCompact(
  issue: IssueForDisplay,
  colors: ReturnType<typeof createColors>,
): string {
  const icon = getStatusIcon(issue.status);
  return `${colors.id(issue.id)} ${icon} ${issue.title}`;
}

/**
 * Format an inline issue mention.
 *
 * Format: {ID} ({TITLE})
 * (No kind shown)
 *
 * @example "bd-a1b2 (Fix authentication timeout)"
 */
export function formatIssueInline(issue: IssueForDisplay): string {
  return `${issue.id} (${issue.title})`;
}

/**
 * Format the table header row for issue listings.
 */
export function formatIssueHeader(colors: ReturnType<typeof createColors>): string {
  const idHeader = 'ID'.padEnd(ISSUE_COLUMNS.ID);
  const priHeader = 'PRI'.padEnd(ISSUE_COLUMNS.PRIORITY);
  const statusHeader = 'STATUS'.padEnd(ISSUE_COLUMNS.STATUS);
  const titleHeader = 'TITLE';

  return colors.dim(`${idHeader}${priHeader}${statusHeader}${titleHeader}`);
}

/**
 * Format the extended table header row with assignee column.
 */
export function formatIssueHeaderExtended(colors: ReturnType<typeof createColors>): string {
  const idHeader = 'ID'.padEnd(ISSUE_COLUMNS.ID);
  const priHeader = 'PRI'.padEnd(ISSUE_COLUMNS.PRIORITY);
  const statusHeader = 'STATUS'.padEnd(ISSUE_COLUMNS.STATUS);
  const assigneeHeader = 'ASSIGNEE'.padEnd(ISSUE_COLUMNS.ASSIGNEE);
  const titleHeader = 'TITLE';

  return colors.dim(`${idHeader}${priHeader}${statusHeader}${assigneeHeader}${titleHeader}`);
}

/**
 * Format an issue with long format (includes description on second line).
 *
 * Description is indented 6 spaces, dim color, max 2 lines.
 */
export function formatIssueLong(
  issue: IssueForDisplay,
  colors: ReturnType<typeof createColors>,
  maxWidth = 80,
): string {
  const firstLine = formatIssueLine(issue, colors);

  if (!issue.description) {
    return firstLine;
  }

  const descLines = wrapDescription(issue.description, 6, 2, maxWidth);
  if (!descLines) {
    return firstLine;
  }

  return `${firstLine}\n${colors.dim(descLines)}`;
}

/**
 * Word-wrap description text with indentation.
 *
 * @param text - The text to wrap
 * @param indent - Number of spaces to indent each line
 * @param maxLines - Maximum number of lines (truncates with ellipsis)
 * @param maxWidth - Maximum width per line (including indent)
 */
export function wrapDescription(
  text: string,
  indent: number,
  maxLines: number,
  maxWidth: number,
): string {
  if (!text) return '';

  const indentStr = ' '.repeat(indent);
  const contentWidth = maxWidth - indent;

  // Split into words and wrap
  const words = text.split(/\s+/);
  const lines: string[] = [];
  let currentLine = '';

  for (const word of words) {
    if (!currentLine) {
      currentLine = word;
    } else if (currentLine.length + 1 + word.length <= contentWidth) {
      currentLine += ' ' + word;
    } else {
      lines.push(currentLine);
      currentLine = word;

      // Stop if we've hit max lines
      if (lines.length >= maxLines) {
        break;
      }
    }
  }

  // Add remaining content
  if (currentLine && lines.length < maxLines) {
    lines.push(currentLine);
  }

  // Truncate last line if we have more content
  if (lines.length === maxLines && currentLine && !lines.includes(currentLine)) {
    const lastLine = lines[maxLines - 1];
    if (lastLine) {
      lines[maxLines - 1] = truncate(lastLine, contentWidth - 1) + ELLIPSIS;
    }
  }

  return lines.map((line) => indentStr + line).join('\n');
}

/**
 * Format a spec path with the filename portion bolded.
 *
 * e.g. "docs/project/specs/active/plan-2026-01-27-my-feature.md"
 * → "docs/project/specs/active/" + bold("plan-2026-01-27-my-feature.md")
 */
export function formatSpecName(specPath: string, colors: ReturnType<typeof createColors>): string {
  const lastSlash = specPath.lastIndexOf('/');
  if (lastSlash === -1) {
    return colors.bold(specPath);
  }
  const dir = specPath.slice(0, lastSlash + 1);
  const filename = specPath.slice(lastSlash + 1);
  return dir + colors.bold(filename);
}

/**
 * Format a spec group header for --specs output.
 *
 * Renders "Spec: path/to/bold-filename.md (count)".
 */
export function formatSpecGroupHeader(
  specPath: string,
  count: number,
  colors: ReturnType<typeof createColors>,
): string {
  return 'Spec: ' + formatSpecName(specPath, colors) + colors.dim(` (${count})`);
}

/**
 * Format the "No spec" group header for beads without a linked spec.
 */
export function formatNoSpecGroupHeader(
  count: number,
  colors: ReturnType<typeof createColors>,
): string {
  return colors.bold('(No spec)') + colors.dim(` (${count})`);
}
