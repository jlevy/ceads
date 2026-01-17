/**
 * `tbd dep` - Dependency management commands.
 *
 * See: tbd-design-v3.md §4.6 Dependency Commands
 */

import { Command } from 'commander';

import { BaseCommand } from '../lib/baseCommand.js';
import { requireInit } from '../lib/errors.js';
import { readIssue, writeIssue, listIssues } from '../../file/storage.js';
import { formatDisplayId, formatDebugId } from '../../lib/ids.js';
import type { Issue } from '../../lib/types.js';
import { resolveDataSyncDir } from '../../lib/paths.js';
import { now } from '../../utils/timeUtils.js';
import { loadIdMapping, resolveToInternalId } from '../../file/idMapping.js';

// Add dependency
class DependsAddHandler extends BaseCommand {
  async run(id: string, targetId: string): Promise<void> {
    await requireInit();

    const dataSyncDir = await resolveDataSyncDir();

    // Load ID mapping for resolution
    const mapping = await loadIdMapping(dataSyncDir);

    // Resolve both IDs to internal IDs
    let internalId: string;
    let internalTarget: string;
    try {
      internalId = resolveToInternalId(id, mapping);
    } catch {
      this.output.error(`Issue not found: ${id}`);
      return;
    }
    try {
      internalTarget = resolveToInternalId(targetId, mapping);
    } catch {
      this.output.error(`Target issue not found: ${targetId}`);
      return;
    }

    // Load the blocking issue
    let issue;
    try {
      issue = await readIssue(dataSyncDir, internalId);
    } catch {
      this.output.error(`Issue not found: ${id}`);
      return;
    }

    // Verify target issue exists
    try {
      await readIssue(dataSyncDir, internalTarget);
    } catch {
      this.output.error(`Target issue not found: ${targetId}`);
      return;
    }

    // Check for self-reference
    if (internalId === internalTarget) {
      this.output.error('Issue cannot block itself');
      return;
    }

    if (this.checkDryRun('Would add dependency', { id: internalId, target: internalTarget })) {
      return;
    }

    // Check if dependency already exists
    const exists = issue.dependencies.some(
      (dep) => dep.type === 'blocks' && dep.target === internalTarget,
    );
    if (exists) {
      this.output.info('Dependency already exists');
      return;
    }

    // Add the dependency
    issue.dependencies.push({ type: 'blocks', target: internalTarget });
    issue.version += 1;
    issue.updated_at = now();

    await this.execute(async () => {
      await writeIssue(dataSyncDir, issue);
    }, 'Failed to update issue');

    // Use already loaded mapping for display
    const showDebug = this.ctx.debug;
    const displayId = showDebug
      ? formatDebugId(internalId, mapping)
      : formatDisplayId(internalId, mapping);
    const displayTarget = showDebug
      ? formatDebugId(internalTarget, mapping)
      : formatDisplayId(internalTarget, mapping);

    this.output.data({ id: displayId, blocks: displayTarget }, () => {
      this.output.success(`${displayId} now blocks ${displayTarget}`);
    });
  }
}

// Remove dependency
class DependsRemoveHandler extends BaseCommand {
  async run(id: string, targetId: string): Promise<void> {
    await requireInit();

    const dataSyncDir = await resolveDataSyncDir();

    // Load ID mapping for resolution
    const mapping = await loadIdMapping(dataSyncDir);

    // Resolve both IDs to internal IDs
    let internalId: string;
    let internalTarget: string;
    try {
      internalId = resolveToInternalId(id, mapping);
    } catch {
      this.output.error(`Issue not found: ${id}`);
      return;
    }
    try {
      internalTarget = resolveToInternalId(targetId, mapping);
    } catch {
      this.output.error(`Target issue not found: ${targetId}`);
      return;
    }

    // Load the blocking issue
    let issue;
    try {
      issue = await readIssue(dataSyncDir, internalId);
    } catch {
      this.output.error(`Issue not found: ${id}`);
      return;
    }

    if (this.checkDryRun('Would remove dependency', { id: internalId, target: internalTarget })) {
      return;
    }

    // Find and remove the dependency
    const initialLength = issue.dependencies.length;
    issue.dependencies = issue.dependencies.filter(
      (dep) => !(dep.type === 'blocks' && dep.target === internalTarget),
    );

    if (issue.dependencies.length === initialLength) {
      this.output.info('Dependency not found');
      return;
    }

    issue.version += 1;
    issue.updated_at = now();

    await this.execute(async () => {
      await writeIssue(dataSyncDir, issue);
    }, 'Failed to update issue');

    // Use already loaded mapping for display
    const showDebug = this.ctx.debug;
    const displayId = showDebug
      ? formatDebugId(internalId, mapping)
      : formatDisplayId(internalId, mapping);
    const displayTarget = showDebug
      ? formatDebugId(internalTarget, mapping)
      : formatDisplayId(internalTarget, mapping);

    this.output.data({ id: displayId, removed: displayTarget }, () => {
      this.output.success(`Removed dependency: ${displayId} no longer blocks ${displayTarget}`);
    });
  }
}

// List dependencies
class DependsListHandler extends BaseCommand {
  async run(id: string): Promise<void> {
    await requireInit();

    const dataSyncDir = await resolveDataSyncDir();

    // Load ID mapping for resolution and display
    const mapping = await loadIdMapping(dataSyncDir);

    // Resolve input ID to internal ID
    let internalId: string;
    try {
      internalId = resolveToInternalId(id, mapping);
    } catch {
      this.output.error(`Issue not found: ${id}`);
      return;
    }

    // Load the issue
    let issue;
    try {
      issue = await readIssue(dataSyncDir, internalId);
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

    const showDebug = this.ctx.debug;

    // Find what this issue blocks (from its dependencies)
    const blocks = issue.dependencies
      .filter((dep) => dep.type === 'blocks')
      .map((dep) =>
        showDebug ? formatDebugId(dep.target, mapping) : formatDisplayId(dep.target, mapping),
      );

    // Find what blocks this issue (reverse lookup)
    const blockedBy: string[] = [];
    for (const other of allIssues) {
      for (const dep of other.dependencies) {
        if (dep.type === 'blocks' && dep.target === internalId) {
          blockedBy.push(
            showDebug ? formatDebugId(other.id, mapping) : formatDisplayId(other.id, mapping),
          );
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

export const depCommand = new Command('dep')
  .description('Manage issue dependencies')
  .addCommand(addCommand)
  .addCommand(removeCommand)
  .addCommand(listDepsCommand);
