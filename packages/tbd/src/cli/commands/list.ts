/**
 * `tbd list` - List issues.
 *
 * See: tbd-design.md §4.4 List
 */

import { Command } from 'commander';

import { BaseCommand } from '../lib/base-command.js';
import { requireInit, CLIError } from '../lib/errors.js';
import { loadDataContext, type TbdDataContext } from '../lib/data-context.js';
import type { Issue, IssueStatusType, IssueKindType } from '../../lib/types.js';
import { listIssues } from '../../file/storage.js';
import { formatDisplayId, formatDebugId, extractUlidFromInternalId } from '../../lib/ids.js';
import type { IdMapping } from '../../file/id-mapping.js';
import { resolveToInternalId } from '../../file/id-mapping.js';
import { naturalCompare } from '../../lib/sort.js';
import {
  formatIssueLine,
  formatIssueLong,
  formatIssueHeader,
  type IssueForDisplay,
} from '../lib/issue-format.js';
import { parsePriority } from '../../lib/priority.js';
import { buildIssueTree, renderIssueTree } from '../lib/tree-view.js';

interface ListOptions {
  status?: IssueStatusType;
  all?: boolean;
  type?: IssueKindType;
  priority?: string;
  assignee?: string;
  label?: string[];
  parent?: string;
  deferred?: boolean;
  deferBefore?: string;
  sort?: string;
  limit?: string;
  count?: boolean;
  long?: boolean;
  pretty?: boolean;
}

class ListHandler extends BaseCommand {
  async run(options: ListOptions): Promise<void> {
    await requireInit();

    let issues: Issue[];
    let dataCtx: TbdDataContext;

    try {
      // Load shared data context (dataSyncDir, mapping, config, prefix)
      dataCtx = await loadDataContext();
      issues = await listIssues(dataCtx.dataSyncDir);
    } catch {
      throw new CLIError('Failed to read issues');
    }

    // Apply filters
    issues = this.filterIssues(issues, options, dataCtx.mapping);

    // Sort results (with secondary sort by short ID for stable ordering)
    issues = this.sortIssues(issues, options.sort ?? 'priority', dataCtx.mapping);

    // Apply limit
    if (options.limit) {
      const limit = parseInt(options.limit, 10);
      if (!isNaN(limit) && limit > 0) {
        issues = issues.slice(0, limit);
      }
    }

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
      description: i.description,
      assignee: i.assignee,
      labels: i.labels,
    }));

    this.output.data(displayIssues, () => {
      if (issues.length === 0) {
        console.log('No issues found');
        return;
      }

      const colors = this.output.getColors();

      if (options.pretty) {
        // Tree view: show parent-child relationships
        const tree = buildIssueTree(displayIssues as (IssueForDisplay & { parentId?: string })[]);
        const lines = renderIssueTree(tree, colors, {
          long: options.long,
          maxWidth: process.stdout.columns ?? 80,
        });
        for (const line of lines) {
          console.log(line);
        }
      } else {
        // Table view: standard tabular format
        console.log(formatIssueHeader(colors));
        for (const issue of displayIssues) {
          if (options.long) {
            console.log(formatIssueLong(issue as IssueForDisplay, colors));
          } else {
            console.log(formatIssueLine(issue as IssueForDisplay, colors));
          }
        }
      }

      console.log('');
      console.log(colors.dim(`${issues.length} issue(s)`));
    });
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
      // By default, exclude closed issues unless --all
      if (!options.all && issue.status === 'closed') {
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

    return [...issues].sort((a, b) => {
      let primaryCompare: number;

      switch (sortField) {
        case 'priority':
          primaryCompare = a.priority - b.priority;
          break;
        case 'created':
          primaryCompare = new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
          break;
        case 'updated':
          primaryCompare = new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime();
          break;
        default:
          primaryCompare = a.priority - b.priority;
      }

      // Secondary sort by short ID using natural ordering for stable, intuitive results
      if (primaryCompare !== 0) {
        return primaryCompare;
      }
      return naturalCompare(getShortId(a), getShortId(b));
    });
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
  .option('--deferred', 'Show only deferred issues')
  .option('--defer-before <date>', 'Deferred before date')
  .option('--sort <field>', 'Sort by: priority, created, updated', 'priority')
  .option('--limit <n>', 'Limit results')
  .option('--count', 'Output only the count of matching issues')
  .option('--long', 'Show descriptions')
  .option('--pretty', 'Show tree view with parent-child relationships')
  .action(async (options, command) => {
    const handler = new ListHandler(command);
    await handler.run(options);
  });
