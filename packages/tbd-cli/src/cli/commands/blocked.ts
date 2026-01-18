/**
 * `tbd blocked` - List blocked issues.
 *
 * See: tbd-design-spec.md §4.4 Blocked
 */

import { Command } from 'commander';

import { BaseCommand } from '../lib/baseCommand.js';
import { requireInit, NotInitializedError } from '../lib/errors.js';
import { listIssues } from '../../file/storage.js';
import type { Issue } from '../../lib/types.js';
import { resolveDataSyncDir } from '../../lib/paths.js';
import { formatDisplayId, formatDebugId } from '../../lib/ids.js';
import { loadIdMapping } from '../../file/idMapping.js';
import { readConfig } from '../../file/config.js';

interface BlockedOptions {
  limit?: string;
}

class BlockedHandler extends BaseCommand {
  async run(options: BlockedOptions): Promise<void> {
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

    // Load ID mapping and config for display
    const mapping = await loadIdMapping(dataSyncDir);
    const config = await readConfig(process.cwd());
    const prefix = config.display.id_prefix;
    const showDebug = this.ctx.debug;

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

    // Find blocked issues (status=blocked OR has unresolved blocking dependencies)
    let blockedIssues: { issue: Issue; blockedBy: string[] }[] = [];

    for (const issue of issues) {
      // Skip closed issues
      if (issue.status === 'closed') continue;

      const unresolvedBlockers: string[] = [];

      // Check if status is explicitly blocked
      const isExplicitlyBlocked = issue.status === 'blocked';

      // Check for unresolved blocking dependencies (from reverse lookup)
      const blockerIds = blockedByMap.get(issue.id) ?? [];
      for (const blockerId of blockerIds) {
        const blocker = issueMap.get(blockerId);
        if (blocker && blocker.status !== 'closed') {
          const blockerDisplayId = showDebug
            ? formatDebugId(blockerId, mapping, prefix)
            : formatDisplayId(blockerId, mapping, prefix);
          unresolvedBlockers.push(`${blockerDisplayId} (${blocker.title.slice(0, 20)})`);
        }
      }

      if (isExplicitlyBlocked || unresolvedBlockers.length > 0) {
        blockedIssues.push({
          issue,
          blockedBy: unresolvedBlockers.length > 0 ? unresolvedBlockers : ['(explicitly blocked)'],
        });
      }
    }

    // Sort by priority
    blockedIssues.sort((a, b) => a.issue.priority - b.issue.priority);

    // Apply limit
    if (options.limit) {
      const limit = parseInt(options.limit, 10);
      if (!isNaN(limit) && limit > 0) {
        blockedIssues = blockedIssues.slice(0, limit);
      }
    }

    // Format output
    const outputIssues = blockedIssues.map((b) => ({
      id: showDebug
        ? formatDebugId(b.issue.id, mapping, prefix)
        : formatDisplayId(b.issue.id, mapping, prefix),
      title: b.issue.title,
      blockedBy: b.blockedBy,
    }));

    this.output.data(outputIssues, () => {
      if (outputIssues.length === 0) {
        this.output.info('No blocked issues found');
        return;
      }

      const colors = this.output.getColors();
      console.log(
        `${colors.dim('ISSUE'.padEnd(12))}${colors.dim('TITLE'.padEnd(25))}${colors.dim('BLOCKED BY')}`,
      );
      for (const issue of outputIssues) {
        console.log(
          `${colors.id(issue.id.padEnd(12))}${issue.title.slice(0, 23).padEnd(25)}${issue.blockedBy.join(', ')}`,
        );
      }
    });
  }
}

export const blockedCommand = new Command('blocked')
  .description('List blocked issues')
  .option('--limit <n>', 'Limit results')
  .action(async (options, command) => {
    const handler = new BlockedHandler(command);
    await handler.run(options);
  });
