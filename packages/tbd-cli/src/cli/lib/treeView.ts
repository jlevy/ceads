/**
 * Tree view utilities for displaying issues with parent-child relationships.
 *
 * Used by `tbd list --pretty` to show hierarchical issue structure.
 */

import type { createColors } from './output.js';
import { formatPriority, getPriorityColor } from '../../lib/priority.js';
import { getStatusIcon, getStatusColor } from '../../lib/status.js';
import { formatKind, wrapDescription, type IssueForDisplay } from './issueFormat.js';

/**
 * Options for tree rendering.
 */
export interface TreeRenderOptions {
  /** Show descriptions (--long mode) */
  long?: boolean;
  /** Terminal width for description wrapping */
  maxWidth?: number;
}

/**
 * Tree node representing an issue with its children.
 */
export interface TreeNode {
  issue: IssueForDisplay;
  children: TreeNode[];
}

/**
 * Unicode box-drawing characters for tree display.
 */
const TREE_CHARS = {
  /** Middle child connector: ├── */
  BRANCH: '├── ',
  /** Last child connector: └── */
  LAST: '└── ',
  /** Vertical line continuation: │    */
  VERTICAL: '│   ',
  /** Empty space for alignment:      */
  SPACE: '    ',
} as const;

/**
 * Build a tree structure from a flat list of issues.
 *
 * Groups children under their parents based on parent_id.
 * Issues without a parent (or whose parent is not in the list) become root nodes.
 *
 * @param issues - Flat list of issues with optional parent_id
 * @returns Array of root tree nodes with nested children
 */
export function buildIssueTree(issues: (IssueForDisplay & { parentId?: string })[]): TreeNode[] {
  // Create a map for quick lookup by ID
  const issueMap = new Map<string, TreeNode>();
  const roots: TreeNode[] = [];

  // First pass: create nodes for all issues
  for (const issue of issues) {
    issueMap.set(issue.id, { issue, children: [] });
  }

  // Second pass: build parent-child relationships
  for (const issue of issues) {
    const node = issueMap.get(issue.id)!;

    if (issue.parentId && issueMap.has(issue.parentId)) {
      // Has a parent that's in our list - add as child
      const parentNode = issueMap.get(issue.parentId)!;
      parentNode.children.push(node);
    } else {
      // No parent or parent not in list - this is a root
      roots.push(node);
    }
  }

  return roots;
}

/**
 * Format a single issue line for tree view (no header, compact format).
 *
 * Format: {ID}  {PRI}  {STATUS}  [kind] {TITLE}
 */
function formatTreeIssueLine(
  issue: IssueForDisplay,
  colors: ReturnType<typeof createColors>,
): string {
  const id = colors.id(issue.id);
  const pri = getPriorityColor(issue.priority, colors)(formatPriority(issue.priority));
  const statusText = `${getStatusIcon(issue.status)} ${issue.status}`;
  const status = getStatusColor(issue.status, colors)(statusText);
  const kind = colors.dim(formatKind(issue.kind));

  return `${id}  ${pri}  ${status}  ${kind} ${issue.title}`;
}

/**
 * Render a tree node and its children as formatted lines.
 *
 * @param node - The tree node to render
 * @param colors - Color functions for formatting
 * @param prefix - Current line prefix (for nested indentation)
 * @param options - Rendering options (long mode, max width)
 * @returns Array of formatted lines
 */
function renderTreeNode(
  node: TreeNode,
  colors: ReturnType<typeof createColors>,
  prefix = '',
  options: TreeRenderOptions = {},
): string[] {
  const lines: string[] = [];
  const { long = false, maxWidth = 80 } = options;

  // Render this node
  const issueLine = formatTreeIssueLine(node.issue, colors);
  lines.push(prefix + issueLine);

  // Render description if --long and description exists
  if (long && node.issue.description) {
    // Calculate indent: prefix length + 6 spaces for description alignment
    const descIndent = prefix.length + 6;
    const descWidth = maxWidth - descIndent;
    if (descWidth > 20) {
      const wrapped = wrapDescription(node.issue.description, 6, 2, descWidth + 6);
      if (wrapped) {
        // Add prefix to each description line
        const descLines = wrapped.split('\n');
        for (const descLine of descLines) {
          lines.push(prefix + colors.dim(descLine));
        }
      }
    }
  }

  // Render children
  const childCount = node.children.length;
  node.children.forEach((child, index) => {
    const isLastChild = index === childCount - 1;

    // Determine the connector for this child
    const connector = isLastChild ? TREE_CHARS.LAST : TREE_CHARS.BRANCH;

    // Determine the prefix for continuation lines (descriptions, grandchildren)
    // If this child is not last, we need a vertical line; otherwise space
    const childPrefix = prefix + (isLastChild ? TREE_CHARS.SPACE : TREE_CHARS.VERTICAL);

    // Render child with childPrefix so it knows the correct indentation for descriptions
    const childLines = renderTreeNode(child, colors, childPrefix, options);

    // Process lines: first line gets connector, others keep childPrefix
    childLines.forEach((line, lineIndex) => {
      if (lineIndex === 0) {
        // Replace childPrefix with connector for the first line
        const lineWithoutPrefix = line.slice(childPrefix.length);
        lines.push(colors.dim(connector) + lineWithoutPrefix);
      } else {
        // Keep childPrefix for continuation lines (already included)
        lines.push(line);
      }
    });
  });

  return lines;
}

/**
 * Render a complete tree view of issues.
 *
 * @param roots - Array of root tree nodes
 * @param colors - Color functions for formatting
 * @param options - Rendering options (long mode, max width)
 * @returns Array of formatted lines (without header, count is separate)
 */
export function renderIssueTree(
  roots: TreeNode[],
  colors: ReturnType<typeof createColors>,
  options: TreeRenderOptions = {},
): string[] {
  const lines: string[] = [];

  for (const root of roots) {
    const rootLines = renderTreeNode(root, colors, '', options);
    lines.push(...rootLines);
  }

  return lines;
}

/**
 * Count total issues in a tree (including all nested children).
 */
export function countTreeIssues(roots: TreeNode[]): number {
  let count = 0;

  function countNode(node: TreeNode): void {
    count++;
    for (const child of node.children) {
      countNode(child);
    }
  }

  for (const root of roots) {
    countNode(root);
  }

  return count;
}
