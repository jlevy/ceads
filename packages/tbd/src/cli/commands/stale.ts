/**
 * `tbd stale` - List stale issues.
 *
 * See: tbd-design.md §4.4 Stale
 */

import { Command } from 'commander';

import { BaseCommand } from '../lib/base-command.js';
import { applyLimit } from '../lib/limit-utils.js';
import { loadDataContext } from '../lib/data-context.js';
import { requireInit, NotInitializedError, ValidationError } from '../lib/errors.js';
import { listIssues } from '../../file/storage.js';
import { IssueStatus } from '../../lib/schemas.js';
import type { Issue, IssueStatusType } from '../../lib/types.js';
import { nowDate, parseDate } from '../../utils/time-utils.js';
import { formatDisplayId, formatDebugId } from '../../lib/ids.js';
import { comparisonChain, ordering } from '../../lib/comparison-chain.js';

interface StaleOptions {
  days?: string;
  status?: string;
  limit?: string;
}

class StaleHandler extends BaseCommand {
  async run(options: StaleOptions): Promise<void> {
    const tbdRoot = await requireInit();

    // Load data context and issues
    let issues: Issue[];
    let dataCtx;
    try {
      dataCtx = await loadDataContext(tbdRoot);
      issues = await listIssues(dataCtx.dataSyncDir);
    } catch {
      throw new NotInitializedError('No issue store found. Run `tbd init` first.');
    }

    // Parse days threshold (default: 7)
    const daysThreshold = options.days ? parseInt(options.days, 10) : 7;
    if (isNaN(daysThreshold) || daysThreshold < 0) {
      throw new ValidationError('Invalid days value. Must be a positive number.');
    }

    // Parse status filter (default: open, in_progress)
    const allowedStatuses = new Set<IssueStatusType>();
    if (options.status) {
      const statuses = options.status.split(',').map((s) => s.trim());
      for (const s of statuses) {
        const result = IssueStatus.safeParse(s);
        if (!result.success) {
          throw new ValidationError(`Invalid status: ${s}`);
        }
        allowedStatuses.add(result.data);
      }
    } else {
      // Default: open and in_progress
      allowedStatuses.add('open');
      allowedStatuses.add('in_progress');
    }

    const currentTime = nowDate();
    const msPerDay = 24 * 60 * 60 * 1000;

    // Filter stale issues
    let staleIssues: { issue: Issue; daysSinceUpdate: number }[] = [];

    for (const issue of issues) {
      // Check status filter
      if (!allowedStatuses.has(issue.status)) continue;

      // Calculate days since last update
      const updatedAt = parseDate(issue.updated_at);
      if (!updatedAt) continue;
      const daysSinceUpdate = Math.floor((currentTime.getTime() - updatedAt.getTime()) / msPerDay);

      if (daysSinceUpdate >= daysThreshold) {
        staleIssues.push({ issue, daysSinceUpdate });
      }
    }

    // Sort by days since update (most stale first), then by ID for determinism
    staleIssues.sort(
      comparisonChain<{ issue: Issue; daysSinceUpdate: number }>()
        .compare((s) => s.daysSinceUpdate, ordering.reversed)
        .compare((s) => s.issue.id)
        .result(),
    );

    // Apply limit
    staleIssues = applyLimit(staleIssues, options.limit);

    const { mapping, prefix } = dataCtx;
    const showDebug = this.ctx.debug;

    // Format output
    const outputIssues = staleIssues.map((s) => ({
      id: showDebug
        ? formatDebugId(s.issue.id, mapping, prefix)
        : formatDisplayId(s.issue.id, mapping, prefix),
      days: s.daysSinceUpdate,
      status: s.issue.status,
      title: s.issue.title,
    }));

    this.output.data(outputIssues, () => {
      if (outputIssues.length === 0) {
        this.output.info(`No stale issues found (threshold: ${daysThreshold} days)`);
        return;
      }

      const colors = this.output.getColors();
      console.log(
        `${colors.dim('ISSUE'.padEnd(12))}${colors.dim('DAYS'.padEnd(6))}${colors.dim('STATUS'.padEnd(14))}${colors.dim('TITLE')}`,
      );
      for (const issue of outputIssues) {
        console.log(
          `${colors.id(issue.id.padEnd(12))}${String(issue.days).padEnd(6)}${issue.status.padEnd(14)}${issue.title}`,
        );
      }
    });
  }
}

export const staleCommand = new Command('stale')
  .description('List issues not updated recently')
  .option('--days <n>', 'Days since last update (default: 7)')
  .option('--status <status>', 'Filter by status (default: open, in_progress)')
  .option('--limit <n>', 'Limit results')
  .action(async (options, command) => {
    const handler = new StaleHandler(command);
    await handler.run(options);
  });
