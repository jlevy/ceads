/**
 * `tbd ready` - List issues ready to work on.
 *
 * See: tbd-design-v3.md §4.4 Ready
 */

import { Command } from 'commander';

import { BaseCommand } from '../lib/baseCommand.js';
import { listIssues } from '../../file/storage.js';
import { IssueKind } from '../../lib/schemas.js';
import type { Issue, IssueKindType } from '../../lib/types.js';
import { resolveDataSyncDir } from '../../lib/paths.js';

interface ReadyOptions {
  type?: string;
  limit?: string;
}

class ReadyHandler extends BaseCommand {
  async run(options: ReadyOptions): Promise<void> {
    // Load all issues
    let issues: Issue[];
    try {
      const dataSyncDir = await resolveDataSyncDir();
      issues = await listIssues(dataSyncDir);
    } catch {
      this.output.error('No issue store found. Run `tbd init` first.');
      return;
    }

    // Build lookup map for dependency resolution
    const issueMap = new Map(issues.map((i) => [i.id, i]));

    // Build reverse lookup: which issues are blocked by which
    // "blocks" dependency means "this issue blocks target"
    const blockedByMap = new Map<string, string[]>();
    for (const issue of issues) {
      for (const dep of issue.dependencies) {
        if (dep.type === 'blocks') {
          const existing = blockedByMap.get(dep.target) ?? [];
          existing.push(issue.id);
          blockedByMap.set(dep.target, existing);
        }
      }
    }

    // Filter for ready issues
    let readyIssues = issues.filter((issue) => {
      // Must be open (not in_progress, blocked, deferred, or closed)
      if (issue.status !== 'open') return false;

      // Must not have an assignee
      if (issue.assignee) return false;

      // Must not have unresolved blocking dependencies
      const blockers = blockedByMap.get(issue.id) ?? [];
      const hasUnresolvedBlocker = blockers.some((blockerId) => {
        const blocker = issueMap.get(blockerId);
        return blocker && blocker.status !== 'closed';
      });
      if (hasUnresolvedBlocker) return false;

      return true;
    });

    // Filter by type if specified
    if (options.type) {
      const result = IssueKind.safeParse(options.type);
      if (!result.success) {
        this.output.error(`Invalid type: ${options.type}`);
        return;
      }
      const kind: IssueKindType = result.data;
      readyIssues = readyIssues.filter((i) => i.kind === kind);
    }

    // Sort by priority (lowest number = highest priority)
    readyIssues.sort((a, b) => a.priority - b.priority);

    // Apply limit
    if (options.limit) {
      const limit = parseInt(options.limit, 10);
      if (!isNaN(limit) && limit > 0) {
        readyIssues = readyIssues.slice(0, limit);
      }
    }

    // Format output
    const outputIssues = readyIssues.map((i) => ({
      id: `bd-${i.id.slice(3)}`,
      priority: i.priority,
      title: i.title,
    }));

    this.output.data(outputIssues, () => {
      if (outputIssues.length === 0) {
        this.output.info('No ready issues found');
        return;
      }

      const colors = this.output.getColors();
      console.log(
        `${colors.dim('ID'.padEnd(12))}${colors.dim('PRI'.padEnd(5))}${colors.dim('TITLE')}`,
      );
      for (const issue of outputIssues) {
        console.log(
          `${colors.id(issue.id.padEnd(12))}${String(issue.priority).padEnd(5)}${issue.title}`,
        );
      }
    });
  }
}

export const readyCommand = new Command('ready')
  .description('List issues ready to work on (open, unblocked, unclaimed)')
  .option('--type <type>', 'Filter by type')
  .option('--limit <n>', 'Limit results')
  .action(async (options, command) => {
    const handler = new ReadyHandler(command);
    await handler.run(options);
  });
