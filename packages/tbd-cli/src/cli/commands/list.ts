/**
 * `tbd list` - List issues.
 *
 * See: tbd-design-v3.md §4.4 List
 */

import { Command } from 'commander';

import { BaseCommand } from '../lib/baseCommand.js';
import { requireInit } from '../lib/errors.js';
import type { Issue, IssueStatusType, IssueKindType } from '../../lib/types.js';
import { listIssues } from '../../file/storage.js';
import { formatDisplayId, formatDebugId, extractUlidFromInternalId } from '../../lib/ids.js';
import { resolveDataSyncDir } from '../../lib/paths.js';
import { loadIdMapping, type IdMapping } from '../../file/idMapping.js';
import { naturalCompare } from '../../lib/sort.js';

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
}

class ListHandler extends BaseCommand {
  async run(options: ListOptions): Promise<void> {
    await requireInit();

    let issues: Issue[];
    let dataSyncDir: string;
    let mapping: IdMapping;

    try {
      // Resolve the correct data sync directory (worktree or direct)
      dataSyncDir = await resolveDataSyncDir();
      issues = await listIssues(dataSyncDir);
      // Load ID mapping early so we can use it for sorting
      mapping = await loadIdMapping(dataSyncDir);
    } catch {
      this.output.error('Failed to read issues');
      return;
    }

    // Apply filters
    issues = this.filterIssues(issues, options);

    // Sort results (with secondary sort by short ID for stable ordering)
    issues = this.sortIssues(issues, options.sort ?? 'priority', mapping);

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

    // Format output - use short display IDs instead of internal ULIDs
    const displayIssues = issues.map((i) => ({
      id: showDebug ? formatDebugId(i.id, mapping) : formatDisplayId(i.id, mapping),
      internalId: i.id,
      priority: i.priority,
      status: i.status,
      kind: i.kind,
      title: i.title,
      assignee: i.assignee,
      labels: i.labels,
    }));

    this.output.data(displayIssues, () => {
      if (issues.length === 0) {
        this.output.info('No issues found');
        return;
      }

      const colors = this.output.getColors();
      console.log(
        `${colors.dim('ID'.padEnd(12))}${colors.dim('PRI'.padEnd(5))}${colors.dim('STATUS'.padEnd(14))}${colors.dim('TITLE')}`,
      );
      for (const issue of displayIssues) {
        const statusColor = this.getStatusColor(issue.status);
        console.log(
          `${colors.id(issue.id.padEnd(12))}${String(issue.priority).padEnd(5)}${statusColor(issue.status.padEnd(14))}${issue.title}`,
        );
      }
      console.log('');
      console.log(colors.dim(`${issues.length} issue(s)`));
    });
  }

  private filterIssues(issues: Issue[], options: ListOptions): Issue[] {
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

      // Priority filter
      if (options.priority !== undefined) {
        const priority = parseInt(options.priority, 10);
        if (!isNaN(priority) && issue.priority !== priority) {
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

      // Parent filter
      if (options.parent && issue.parent_id !== options.parent) {
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

  private getStatusColor(status: string): (s: string) => string {
    const colors = this.output.getColors();
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
  .action(async (options, command) => {
    const handler = new ListHandler(command);
    await handler.run(options);
  });
