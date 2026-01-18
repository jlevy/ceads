/**
 * `tbd ready` - List issues ready to work on.
 *
 * See: tbd-design-spec.md §4.4 Ready
 */

import { Command } from 'commander';

import { BaseCommand } from '../lib/baseCommand.js';
import { requireInit, NotInitializedError, ValidationError } from '../lib/errors.js';
import { listIssues } from '../../file/storage.js';
import { IssueKind } from '../../lib/schemas.js';
import type { Issue, IssueKindType } from '../../lib/types.js';
import { resolveDataSyncDir } from '../../lib/paths.js';
import { formatDisplayId, formatDebugId } from '../../lib/ids.js';
import { loadIdMapping } from '../../file/idMapping.js';
import { readConfig } from '../../file/config.js';
import {
  formatIssueLine,
  formatIssueLong,
  formatIssueHeader,
  type IssueForDisplay,
} from '../lib/issueFormat.js';

interface ReadyOptions {
  type?: string;
  limit?: string;
  long?: boolean;
}

class ReadyHandler extends BaseCommand {
  async run(options: ReadyOptions): Promise<void> {
    await requireInit();

    // Load all issues
    let issues: Issue[];
    let dataSyncDir: string;
    try {
      dataSyncDir = await resolveDataSyncDir();
      issues = await listIssues(dataSyncDir);
    } catch {
      throw new NotInitializedError('No issue store found. Run `tbd init` first.');
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
        throw new ValidationError(`Invalid type: ${options.type}`);
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

    // Load ID mapping and config for display
    const mapping = await loadIdMapping(dataSyncDir);
    const config = await readConfig(process.cwd());
    const prefix = config.display.id_prefix;
    const showDebug = this.ctx.debug;

    // Format output
    const outputIssues = readyIssues.map((i) => ({
      id: showDebug ? formatDebugId(i.id, mapping, prefix) : formatDisplayId(i.id, mapping, prefix),
      priority: i.priority,
      status: i.status,
      kind: i.kind,
      title: i.title,
      description: i.description,
    }));

    this.output.data(outputIssues, () => {
      if (outputIssues.length === 0) {
        this.output.info('No ready issues found');
        return;
      }

      const colors = this.output.getColors();
      console.log(formatIssueHeader(colors));
      for (const issue of outputIssues) {
        if (options.long) {
          console.log(formatIssueLong(issue as IssueForDisplay, colors));
        } else {
          console.log(formatIssueLine(issue as IssueForDisplay, colors));
        }
      }
    });
  }
}

export const readyCommand = new Command('ready')
  .description('List issues ready to work on (open, unblocked, unclaimed)')
  .option('--type <type>', 'Filter by type')
  .option('--limit <n>', 'Limit results')
  .option('--long', 'Show descriptions')
  .action(async (options, command) => {
    const handler = new ReadyHandler(command);
    await handler.run(options);
  });
