/**
 * `tbd workspace` - Workspace management commands.
 *
 * Workspaces are named directories for sync failure recovery, backups,
 * and bulk editing. Issues can be saved to a workspace and imported back.
 *
 * See: plan-2026-01-30-workspace-sync-alt.md
 */

import { Command } from 'commander';

import { BaseCommand } from '../lib/base-command.js';
import { requireInit, NotFoundError, ValidationError } from '../lib/errors.js';
import {
  listWorkspacesWithCounts,
  deleteWorkspace,
  workspaceExists,
} from '../../file/workspace.js';
import { isValidWorkspaceName } from '../../lib/paths.js';

/**
 * List all workspaces with issue counts.
 */
class WorkspaceListHandler extends BaseCommand {
  async run(): Promise<void> {
    const tbdRoot = await requireInit();

    const workspaces = await listWorkspacesWithCounts(tbdRoot);

    this.output.data(workspaces, () => {
      const colors = this.output.getColors();
      if (workspaces.length === 0) {
        console.log('No workspaces');
        return;
      }

      // Calculate column widths
      const maxNameLen = Math.max(9, ...workspaces.map((ws) => ws.name.length)); // 9 = "WORKSPACE".length
      const countWidth = 6;

      // Header
      const header = `${colors.dim('WORKSPACE'.padEnd(maxNameLen))}  ${colors.dim('open'.padStart(countWidth))}  ${colors.dim('in_progress'.padStart(11))}  ${colors.dim('closed'.padStart(countWidth))}  ${colors.dim('total'.padStart(countWidth))}`;
      console.log(header);

      // Rows
      for (const ws of workspaces) {
        const { name, counts } = ws;
        const row = `${name.padEnd(maxNameLen)}  ${String(counts.open).padStart(countWidth)}  ${String(counts.in_progress).padStart(11)}  ${String(counts.closed).padStart(countWidth)}  ${String(counts.total).padStart(countWidth)}`;
        console.log(row);
      }
    });
  }
}

/**
 * Delete a workspace.
 */
class WorkspaceDeleteHandler extends BaseCommand {
  async run(name: string, options: { force?: boolean }): Promise<void> {
    const tbdRoot = await requireInit();

    // Validate workspace name
    if (!isValidWorkspaceName(name)) {
      throw new ValidationError(
        `Invalid workspace name: "${name}". Use lowercase alphanumeric characters, hyphens, and underscores.`,
      );
    }

    // Check if workspace exists
    const exists = await workspaceExists(tbdRoot, name);
    if (!exists && !options.force) {
      throw new NotFoundError('Workspace', name);
    }

    if (this.checkDryRun('Would delete workspace', { name })) {
      return;
    }

    await this.execute(async () => {
      await deleteWorkspace(tbdRoot, name);
    }, 'Failed to delete workspace');

    this.output.success(`Deleted workspace "${name}"`);
  }
}

const listWorkspaceCommand = new Command('list')
  .description('List all workspaces')
  .action(async (_options, command) => {
    const handler = new WorkspaceListHandler(command);
    await handler.run();
  });

const deleteWorkspaceCommand = new Command('delete')
  .description('Delete a workspace')
  .argument('<name>', 'Workspace name to delete')
  .option('--force', 'Delete without error if workspace does not exist')
  .action(async (name, options, command) => {
    const handler = new WorkspaceDeleteHandler(command);
    await handler.run(name, options);
  });

export const workspaceCommand = new Command('workspace')
  .description('Manage workspaces for sync recovery and backups')
  .addCommand(listWorkspaceCommand)
  .addCommand(deleteWorkspaceCommand);
