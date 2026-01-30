/**
 * `tbd list` - List issues.
 *
 * See: tbd-design.md §4.4 List
 */

import { Command } from 'commander';

import { BaseCommand } from '../lib/base-command.js';
import { applyLimit } from '../lib/limit-utils.js';
import { requireInit, CLIError } from '../lib/errors.js';
import { loadDataContext, type TbdDataContext } from '../lib/data-context.js';
import type { Issue, IssueStatusType, IssueKindType } from '../../lib/types.js';
import { listIssues } from '../../file/storage.js';
import { formatDisplayId, formatDebugId, extractUlidFromInternalId } from '../../lib/ids.js';
import type { IdMapping } from '../../file/id-mapping.js';
import { resolveToInternalId } from '../../file/id-mapping.js';
import { naturalCompare } from '../../lib/sort.js';
import { comparisonChain, ordering } from '../../lib/comparison-chain.js';
import {
  formatIssueLine,
  formatIssueLong,
  formatIssueHeader,
  formatSpecGroupHeader,
  formatNoSpecGroupHeader,
  type IssueForDisplay,
} from '../lib/issue-format.js';
import { parsePriority } from '../../lib/priority.js';
import { buildIssueTree, renderIssueTree } from '../lib/tree-view.js';
import { getTerminalWidth, type createColors } from '../lib/output.js';
import { matchesSpecPath } from '../../lib/spec-matching.js';

interface ListOptions {
  status?: IssueStatusType;
  all?: boolean;
  type?: IssueKindType;
  priority?: string;
  assignee?: string;
  label?: string[];
  parent?: string;
  spec?: string;
  deferred?: boolean;
  deferBefore?: string;
  sort?: string;
  limit?: string;
  count?: boolean;
  long?: boolean;
  pretty?: boolean;
  specs?: boolean;
}

class ListHandler extends BaseCommand {
  async run(options: ListOptions): Promise<void> {
    const tbdRoot = await requireInit();

    let issues: Issue[];
    let dataCtx: TbdDataContext;

    try {
      // Load shared data context (dataSyncDir, mapping, config, prefix)
      dataCtx = await loadDataContext(tbdRoot);
      issues = await listIssues(dataCtx.dataSyncDir);
    } catch {
      throw new CLIError('Failed to read issues');
    }

    // Apply filters
    issues = this.filterIssues(issues, options, dataCtx.mapping);

    // Sort results (with secondary sort by short ID for stable ordering)
    issues = this.sortIssues(issues, options.sort ?? 'priority', dataCtx.mapping);

    // Apply limit
    issues = applyLimit(issues, options.limit);

    // Count-only mode for testing
    if (options.count) {
      this.output.data({ count: issues.length }, () => {
        console.log(issues.length);
      });
      return;
    }

    const showDebug = this.ctx.debug;
    const { mapping, prefix } = dataCtx;

    // Format output - use short display IDs instead of internal ULIDs
    const displayIssues = issues.map((i) => ({
      id: showDebug ? formatDebugId(i.id, mapping, prefix) : formatDisplayId(i.id, mapping, prefix),
      internalId: i.id,
      parentId: i.parent_id
        ? showDebug
          ? formatDebugId(i.parent_id, mapping, prefix)
          : formatDisplayId(i.parent_id, mapping, prefix)
        : undefined,
      priority: i.priority,
      status: i.status,
      kind: i.kind,
      title: i.title,
      description: i.description ?? undefined,
      assignee: i.assignee ?? undefined,
      labels: i.labels,
      spec_path: i.spec_path ?? undefined,
    }));

    this.output.data(displayIssues, () => {
      if (issues.length === 0) {
        console.log('No issues found');
        return;
      }

      const colors = this.output.getColors();

      if (options.specs) {
        this.renderGroupedBySpec(displayIssues, options, colors);
      } else {
        this.renderFlat(displayIssues, options, colors);
      }

      console.log('');
      console.log(colors.dim(`${issues.length} issue(s)`));
    });
  }

  private renderFlat(
    displayIssues: (IssueForDisplay & { parentId?: string; spec_path?: string })[],
    options: ListOptions,
    colors: ReturnType<typeof createColors>,
  ): void {
    if (options.pretty) {
      const tree = buildIssueTree(displayIssues);
      const lines = renderIssueTree(tree, colors, {
        long: options.long,
        maxWidth: getTerminalWidth(),
      });
      for (const line of lines) {
        console.log(line);
      }
    } else {
      console.log(formatIssueHeader(colors));
      for (const issue of displayIssues) {
        if (options.long) {
          console.log(formatIssueLong(issue, colors));
        } else {
          console.log(formatIssueLine(issue, colors));
        }
      }
    }
  }

  private renderGroupedBySpec(
    displayIssues: (IssueForDisplay & { parentId?: string; spec_path?: string })[],
    options: ListOptions,
    colors: ReturnType<typeof createColors>,
  ): void {
    // Group issues by spec_path
    const specGroups = new Map<string, typeof displayIssues>();
    const noSpecIssues: typeof displayIssues = [];

    for (const issue of displayIssues) {
      if (issue.spec_path) {
        const group = specGroups.get(issue.spec_path);
        if (group) {
          group.push(issue);
        } else {
          specGroups.set(issue.spec_path, [issue]);
        }
      } else {
        noSpecIssues.push(issue);
      }
    }

    // Render each spec group
    let first = true;
    for (const [specPath, groupIssues] of specGroups) {
      if (!first) {
        console.log('');
      }
      first = false;

      console.log(formatSpecGroupHeader(specPath, groupIssues.length, colors));
      console.log('');
      this.renderFlat(groupIssues, options, colors);
    }

    // Render "No spec" group at the end
    if (noSpecIssues.length > 0) {
      if (!first) {
        console.log('');
      }
      console.log(formatNoSpecGroupHeader(noSpecIssues.length, colors));
      console.log('');
      this.renderFlat(noSpecIssues, options, colors);
    }
  }

  private filterIssues(issues: Issue[], options: ListOptions, mapping: IdMapping): Issue[] {
    // Resolve parent filter to internal ID if provided
    let resolvedParentId: string | undefined;
    if (options.parent) {
      try {
        resolvedParentId = resolveToInternalId(options.parent, mapping);
      } catch {
        // If parent ID cannot be resolved, no issues will match
        return [];
      }
    }

    return issues.filter((issue) => {
      // By default, exclude closed issues unless --all or --status closed
      if (!options.all && options.status !== 'closed' && issue.status === 'closed') {
        return false;
      }

      // Status filter
      if (options.status && issue.status !== options.status) {
        return false;
      }

      // Type filter
      if (options.type && issue.kind !== options.type) {
        return false;
      }

      // Priority filter - supports both numeric (1) and prefixed (P1) formats
      if (options.priority !== undefined) {
        const priority = parsePriority(options.priority);
        if (priority !== undefined && issue.priority !== priority) {
          return false;
        }
      }

      // Assignee filter
      if (options.assignee && issue.assignee !== options.assignee) {
        return false;
      }

      // Label filter (all must match)
      if (options.label && options.label.length > 0) {
        const hasAllLabels = options.label.every((l) => issue.labels.includes(l));
        if (!hasAllLabels) {
          return false;
        }
      }

      // Parent filter (compare resolved internal IDs)
      if (resolvedParentId && issue.parent_id !== resolvedParentId) {
        return false;
      }

      // Spec path filter (uses gradual matching)
      if (options.spec) {
        if (!issue.spec_path || !matchesSpecPath(issue.spec_path, options.spec)) {
          return false;
        }
      }

      // Deferred filter
      if (options.deferred && issue.status !== 'deferred') {
        return false;
      }

      return true;
    });
  }

  private sortIssues(issues: Issue[], sortField: string, mapping: IdMapping): Issue[] {
    // Helper to get short ID for secondary sort
    const getShortId = (issue: Issue): string => {
      const ulid = extractUlidFromInternalId(issue.id);
      return mapping.ulidToShort.get(ulid) ?? ulid;
    };

    const primarySelector: (i: Issue) => number =
      sortField === 'created'
        ? (i) => new Date(i.created_at).getTime()
        : sortField === 'updated'
          ? (i) => new Date(i.updated_at).getTime()
          : (i) => i.priority;

    // For created/updated, reverse so newest comes first; for priority, ascending
    const primaryOrdering =
      sortField === 'created' || sortField === 'updated' ? ordering.reversed : ordering.default;

    return [...issues].sort(
      comparisonChain<Issue>()
        .compare(primarySelector, primaryOrdering)
        .compare(getShortId, (a, b) => naturalCompare(a, b))
        .result(),
    );
  }
}

export const listCommand = new Command('list')
  .description('List issues')
  .option('--status <status>', 'Filter: open, in_progress, blocked, deferred, closed')
  .option('--all', 'Include closed issues')
  .option('--type <type>', 'Filter: bug, feature, task, epic')
  .option('--priority <0-4>', 'Filter by priority')
  .option('--assignee <name>', 'Filter by assignee')
  .option('--label <label>', 'Filter by label (repeatable)', (val, prev: string[] = []) => [
    ...prev,
    val,
  ])
  .option('--parent <id>', 'List children of parent')
  .option(
    '--spec <path>',
    'Filter by spec path (matches full path, partial path suffix, or filename)',
  )
  .option('--deferred', 'Show only deferred issues')
  .option('--defer-before <date>', 'Deferred before date')
  .option('--sort <field>', 'Sort by: priority, created, updated', 'priority')
  .option('--limit <n>', 'Limit results')
  .option('--count', 'Output only the count of matching issues')
  .option('--long', 'Show descriptions')
  .option('--pretty', 'Show tree view with parent-child relationships')
  .option('--specs', 'Group output by linked spec')
  .action(async (options, command) => {
    const handler = new ListHandler(command);
    await handler.run(options);
  });
