/**
 * `tbd list` - List issues.
 *
 * See: tbd-design-v3.md §4.4 List
 */

import { Command } from 'commander';

import { BaseCommand } from '../lib/baseCommand.js';
import type { IssueStatusType, IssueKindType } from '../../lib/types.js';

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
}

class ListHandler extends BaseCommand {
  async run(options: ListOptions): Promise<void> {
    // TODO: Implement list with filters
    // 1. Load issues from worktree
    // 2. Apply filters
    // 3. Sort results
    // 4. Format output

    const mockIssues = [
      { id: 'bd-a1b2c3', priority: 1, status: 'in_progress', title: 'Fix auth bug' },
      { id: 'bd-d4e5f6', priority: 2, status: 'open', title: 'Add OAuth support' },
    ];

    this.output.data(mockIssues, () => {
      const colors = this.output.getColors();
      console.log(
        `${colors.dim('ID'.padEnd(12))}${colors.dim('PRI'.padEnd(5))}${colors.dim('STATUS'.padEnd(14))}${colors.dim('TITLE')}`,
      );
      for (const issue of mockIssues) {
        console.log(
          `${colors.id(issue.id.padEnd(12))}${String(issue.priority).padEnd(5)}${issue.status.padEnd(14)}${issue.title}`,
        );
      }
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
  .action(async (options, command) => {
    const handler = new ListHandler(command);
    await handler.run(options);
  });
