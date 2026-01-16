/**
 * `tbd stale` - List stale issues.
 *
 * See: tbd-design-v3.md §4.4 Stale
 */

import { Command } from 'commander';

import { BaseCommand } from '../lib/baseCommand.js';
import { listIssues } from '../../file/storage.js';
import { IssueStatus } from '../../lib/schemas.js';
import type { Issue, IssueStatusType } from '../../lib/types.js';
import { resolveDataSyncDir } from '../../lib/paths.js';

interface StaleOptions {
  days?: string;
  status?: string;
  limit?: string;
}

class StaleHandler extends BaseCommand {
  async run(options: StaleOptions): Promise<void> {
    // Load all issues
    let issues: Issue[];
    try {
      const dataSyncDir = await resolveDataSyncDir();
      issues = await listIssues(dataSyncDir);
    } catch {
      this.output.error('No issue store found. Run `tbd init` first.');
      return;
    }

    // Parse days threshold (default: 7)
    const daysThreshold = options.days ? parseInt(options.days, 10) : 7;
    if (isNaN(daysThreshold) || daysThreshold < 0) {
      this.output.error('Invalid days value. Must be a positive number.');
      return;
    }

    // Parse status filter (default: open, in_progress)
    const allowedStatuses = new Set<IssueStatusType>();
    if (options.status) {
      const statuses = options.status.split(',').map((s) => s.trim());
      for (const s of statuses) {
        const result = IssueStatus.safeParse(s);
        if (!result.success) {
          this.output.error(`Invalid status: ${s}`);
          return;
        }
        allowedStatuses.add(result.data);
      }
    } else {
      // Default: open and in_progress
      allowedStatuses.add('open');
      allowedStatuses.add('in_progress');
    }

    const now = new Date();
    const msPerDay = 24 * 60 * 60 * 1000;

    // Filter stale issues
    let staleIssues: { issue: Issue; daysSinceUpdate: number }[] = [];

    for (const issue of issues) {
      // Check status filter
      if (!allowedStatuses.has(issue.status)) continue;

      // Calculate days since last update
      const updatedAt = new Date(issue.updated_at);
      const daysSinceUpdate = Math.floor((now.getTime() - updatedAt.getTime()) / msPerDay);

      if (daysSinceUpdate >= daysThreshold) {
        staleIssues.push({ issue, daysSinceUpdate });
      }
    }

    // Sort by days since update (most stale first)
    staleIssues.sort((a, b) => b.daysSinceUpdate - a.daysSinceUpdate);

    // Apply limit
    if (options.limit) {
      const limit = parseInt(options.limit, 10);
      if (!isNaN(limit) && limit > 0) {
        staleIssues = staleIssues.slice(0, limit);
      }
    }

    // Format output
    const outputIssues = staleIssues.map((s) => ({
      id: `bd-${s.issue.id.slice(3)}`,
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
