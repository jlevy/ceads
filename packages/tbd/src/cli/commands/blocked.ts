/**
 * `tbd blocked` - List blocked issues.
 *
 * See: tbd-design.md §4.4 Blocked
 */

import { Command } from 'commander';

import { BaseCommand } from '../lib/base-command.js';
import { loadDataContext, type TbdDataContext } from '../lib/data-context.js';
import { requireInit, NotInitializedError } from '../lib/errors.js';
import { applyLimit } from '../lib/limit-utils.js';
import { listIssues } from '../../file/storage.js';
import type { Issue } from '../../lib/types.js';
import { formatDisplayId, formatDebugId } from '../../lib/ids.js';
import { comparisonChain } from '../../lib/comparison-chain.js';
import {
  formatIssueLine,
  formatIssueLong,
  formatIssueHeader,
  formatIssueCompact,
  type IssueForDisplay,
} from '../lib/issue-format.js';

interface BlockedOptions {
  limit?: string;
  long?: boolean;
}

class BlockedHandler extends BaseCommand {
  async run(options: BlockedOptions): Promise<void> {
    const tbdRoot = await requireInit();

    // Load data context and issues
    let issues: Issue[];
    let dataCtx: TbdDataContext;
    try {
      dataCtx = await loadDataContext(tbdRoot);
      issues = await listIssues(dataCtx.dataSyncDir);
    } catch {
      throw new NotInitializedError('No issue store found. Run `tbd init` first.');
    }

    const { mapping, prefix } = dataCtx;
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
    let blockedIssues: {
      issue: Issue;
      blockedBy: { id: string; issue: Issue }[];
      explicitlyBlocked?: boolean;
    }[] = [];

    for (const issue of issues) {
      // Skip closed issues
      if (issue.status === 'closed') continue;

      const unresolvedBlockers: { id: string; issue: Issue }[] = [];

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
          unresolvedBlockers.push({ id: blockerDisplayId, issue: blocker });
        }
      }

      if (isExplicitlyBlocked || unresolvedBlockers.length > 0) {
        blockedIssues.push({
          issue,
          blockedBy: unresolvedBlockers,
          explicitlyBlocked: isExplicitlyBlocked && unresolvedBlockers.length === 0,
        });
      }
    }

    // Sort by priority
    blockedIssues.sort(
      comparisonChain<{ issue: Issue }>()
        .compare((b) => b.issue.priority)
        .compare((b) => b.issue.id)
        .result(),
    );

    // Apply limit
    blockedIssues = applyLimit(blockedIssues, options.limit);

    // Format output
    const colors = this.output.getColors();
    const outputIssues = blockedIssues.map((b) => {
      const displayId = showDebug
        ? formatDebugId(b.issue.id, mapping, prefix)
        : formatDisplayId(b.issue.id, mapping, prefix);
      return {
        id: displayId,
        priority: b.issue.priority,
        status: b.issue.status,
        kind: b.issue.kind,
        title: b.issue.title,
        description: b.issue.description,
        blockedBy: b.explicitlyBlocked
          ? ['(explicitly blocked)']
          : b.blockedBy.map((blocker) =>
              formatIssueCompact(
                {
                  id: blocker.id,
                  priority: blocker.issue.priority,
                  status: blocker.issue.status,
                  kind: blocker.issue.kind,
                  title: blocker.issue.title.slice(0, 20),
                },
                colors,
              ),
            ),
      };
    });

    this.output.data(outputIssues, () => {
      if (outputIssues.length === 0) {
        this.output.info('No blocked issues found');
        return;
      }

      console.log(formatIssueHeader(colors));
      for (const issue of outputIssues) {
        if (options.long) {
          console.log(formatIssueLong(issue as IssueForDisplay, colors));
        } else {
          console.log(formatIssueLine(issue as IssueForDisplay, colors));
        }
        // Show blockers on indented line
        console.log(`      ${colors.dim('blocked by:')} ${issue.blockedBy.join(', ')}`);
      }
    });
  }
}

export const blockedCommand = new Command('blocked')
  .description('List blocked issues')
  .option('--limit <n>', 'Limit results')
  .option('--long', 'Show descriptions')
  .action(async (options, command) => {
    const handler = new BlockedHandler(command);
    await handler.run(options);
  });
