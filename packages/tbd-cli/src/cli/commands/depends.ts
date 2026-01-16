/**
 * `tbd depends` - Dependency management commands.
 *
 * See: tbd-design-v3.md §4.6 Dependency Commands
 */

import { Command } from 'commander';

import { BaseCommand } from '../lib/baseCommand.js';
import { readIssue, writeIssue, listIssues } from '../../file/storage.js';
import { normalizeIssueId } from '../../lib/ids.js';
import type { Issue } from '../../lib/types.js';
import { resolveDataSyncDir } from '../../lib/paths.js';

// Add dependency
class DependsAddHandler extends BaseCommand {
  async run(id: string, targetId: string): Promise<void> {
    const normalizedId = normalizeIssueId(id);
    const normalizedTarget = normalizeIssueId(targetId);
    const dataSyncDir = await resolveDataSyncDir();

    // Load the blocking issue
    let issue;
    try {
      issue = await readIssue(dataSyncDir, normalizedId);
    } catch {
      this.output.error(`Issue not found: ${id}`);
      return;
    }

    // Verify target issue exists
    try {
      await readIssue(dataSyncDir, normalizedTarget);
    } catch {
      this.output.error(`Target issue not found: ${targetId}`);
      return;
    }

    // Check for self-reference
    if (normalizedId === normalizedTarget) {
      this.output.error('Issue cannot block itself');
      return;
    }

    if (this.checkDryRun('Would add dependency', { id: normalizedId, target: normalizedTarget })) {
      return;
    }

    // Check if dependency already exists
    const exists = issue.dependencies.some(
      (dep) => dep.type === 'blocks' && dep.target === normalizedTarget,
    );
    if (exists) {
      this.output.info('Dependency already exists');
      return;
    }

    // Add the dependency
    issue.dependencies.push({ type: 'blocks', target: normalizedTarget });
    issue.version += 1;
    issue.updated_at = new Date().toISOString();

    await this.execute(async () => {
      await writeIssue(dataSyncDir, issue);
    }, 'Failed to update issue');

    const displayId = `bd-${normalizedId.slice(3)}`;
    const displayTarget = `bd-${normalizedTarget.slice(3)}`;
    this.output.data({ id: displayId, blocks: displayTarget }, () => {
      this.output.success(`${displayId} now blocks ${displayTarget}`);
    });
  }
}

// Remove dependency
class DependsRemoveHandler extends BaseCommand {
  async run(id: string, targetId: string): Promise<void> {
    const normalizedId = normalizeIssueId(id);
    const normalizedTarget = normalizeIssueId(targetId);
    const dataSyncDir = await resolveDataSyncDir();

    // Load the blocking issue
    let issue;
    try {
      issue = await readIssue(dataSyncDir, normalizedId);
    } catch {
      this.output.error(`Issue not found: ${id}`);
      return;
    }

    if (
      this.checkDryRun('Would remove dependency', { id: normalizedId, target: normalizedTarget })
    ) {
      return;
    }

    // Find and remove the dependency
    const initialLength = issue.dependencies.length;
    issue.dependencies = issue.dependencies.filter(
      (dep) => !(dep.type === 'blocks' && dep.target === normalizedTarget),
    );

    if (issue.dependencies.length === initialLength) {
      this.output.info('Dependency not found');
      return;
    }

    issue.version += 1;
    issue.updated_at = new Date().toISOString();

    await this.execute(async () => {
      await writeIssue(dataSyncDir, issue);
    }, 'Failed to update issue');

    const displayId = `bd-${normalizedId.slice(3)}`;
    const displayTarget = `bd-${normalizedTarget.slice(3)}`;
    this.output.data({ id: displayId, removed: displayTarget }, () => {
      this.output.success(`Removed dependency: ${displayId} no longer blocks ${displayTarget}`);
    });
  }
}

// List dependencies
class DependsListHandler extends BaseCommand {
  async run(id: string): Promise<void> {
    const normalizedId = normalizeIssueId(id);
    const dataSyncDir = await resolveDataSyncDir();

    // Load the issue
    let issue;
    try {
      issue = await readIssue(dataSyncDir, normalizedId);
    } catch {
      this.output.error(`Issue not found: ${id}`);
      return;
    }

    // Load all issues to find reverse dependencies
    let allIssues: Issue[];
    try {
      allIssues = await listIssues(dataSyncDir);
    } catch {
      allIssues = [];
    }

    // Find what this issue blocks (from its dependencies)
    const blocks = issue.dependencies
      .filter((dep) => dep.type === 'blocks')
      .map((dep) => `bd-${dep.target.slice(3)}`);

    // Find what blocks this issue (reverse lookup)
    const blockedBy: string[] = [];
    for (const other of allIssues) {
      for (const dep of other.dependencies) {
        if (dep.type === 'blocks' && dep.target === normalizedId) {
          blockedBy.push(`bd-${other.id.slice(3)}`);
        }
      }
    }

    const deps = { blocks, blockedBy };
    this.output.data(deps, () => {
      const colors = this.output.getColors();
      if (deps.blocks.length > 0) {
        console.log(`${colors.bold('Blocks:')} ${deps.blocks.join(', ')}`);
      }
      if (deps.blockedBy.length > 0) {
        console.log(`${colors.bold('Blocked by:')} ${deps.blockedBy.join(', ')}`);
      }
      if (deps.blocks.length === 0 && deps.blockedBy.length === 0) {
        console.log('No dependencies');
      }
    });
  }
}

const addCommand = new Command('add')
  .description('Add a blocks dependency')
  .argument('<id>', 'Issue ID that blocks')
  .argument('<target>', 'Issue ID that is blocked')
  .action(async (id, target, _options, command) => {
    const handler = new DependsAddHandler(command);
    await handler.run(id, target);
  });

const removeCommand = new Command('remove')
  .description('Remove a blocks dependency')
  .argument('<id>', 'Issue ID')
  .argument('<target>', 'Target issue ID')
  .action(async (id, target, _options, command) => {
    const handler = new DependsRemoveHandler(command);
    await handler.run(id, target);
  });

const listDepsCommand = new Command('list')
  .description('List dependencies for an issue')
  .argument('<id>', 'Issue ID')
  .action(async (id, _options, command) => {
    const handler = new DependsListHandler(command);
    await handler.run(id);
  });

export const dependsCommand = new Command('depends')
  .description('Manage issue dependencies')
  .addCommand(addCommand)
  .addCommand(removeCommand)
  .addCommand(listDepsCommand);
