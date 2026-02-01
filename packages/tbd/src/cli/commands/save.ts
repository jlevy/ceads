/**
 * `tbd save` - Save issues to a workspace or directory.
 *
 * Saves issues from the data-sync worktree to a named workspace or directory.
 * Used for sync failure recovery, backups, and bulk editing workflows.
 *
 * See: plan-2026-01-30-workspace-sync-alt.md
 */

import { Command } from 'commander';

import { BaseCommand } from '../lib/base-command.js';
import { requireInit, ValidationError } from '../lib/errors.js';
import { resolveDataSyncDir } from '../../lib/paths.js';
import { saveToWorkspace, type SaveOptions } from '../../file/workspace.js';

interface SaveCommandOptions {
  workspace?: string;
  dir?: string;
  outbox?: boolean;
  updatesOnly?: boolean;
}

class SaveHandler extends BaseCommand {
  async run(options: SaveCommandOptions): Promise<void> {
    const tbdRoot = await requireInit();
    const dataSyncDir = await resolveDataSyncDir(tbdRoot);

    // Validate that at least one target is specified
    if (!options.workspace && !options.dir && !options.outbox) {
      throw new ValidationError('One of --workspace, --dir, or --outbox is required');
    }

    // Build save options
    const saveOptions: SaveOptions = {
      workspace: options.workspace,
      dir: options.dir,
      outbox: options.outbox,
      updatesOnly: options.updatesOnly,
    };

    if (this.checkDryRun('Would save issues to workspace', saveOptions)) {
      return;
    }

    const spinner = this.output.spinner('Saving issues...');

    const result = await this.execute(async () => {
      return await saveToWorkspace(tbdRoot, dataSyncDir, saveOptions);
    }, 'Failed to save issues');

    spinner.stop();

    if (!result) {
      return;
    }

    // Format output
    const targetName = options.outbox ? 'outbox' : (options.workspace ?? options.dir ?? 'unknown');

    this.output.data(
      {
        saved: result.saved,
        conflicts: result.conflicts,
        target: targetName,
        totalSource: result.totalSource,
        filtered: result.filtered,
      },
      () => {
        if (result.saved === 0) {
          if (result.filtered) {
            this.output.info(`No issues to save (0 of ${result.totalSource} issues have updates)`);
          } else {
            this.output.info('No issues to save');
          }
        } else {
          if (result.filtered) {
            this.output.success(
              `Saved ${result.saved} issue(s) to ${targetName} (${result.saved} of ${result.totalSource} filtered)`,
            );
          } else {
            this.output.success(`Saved ${result.saved} issue(s) to ${targetName}`);
          }
          if (result.conflicts > 0) {
            this.output.warn(`${result.conflicts} conflict(s) moved to attic`);
          }
        }
      },
    );

    // Remind user to commit if saving to workspace
    if (options.workspace || options.outbox) {
      const colors = this.output.getColors();
      console.log(
        colors.dim(
          `\nRemember to commit: git add .tbd/workspaces && git commit -m "tbd: save workspace"`,
        ),
      );
    }
  }
}

export const saveCommand = new Command('save')
  .description('Save issues to a workspace or directory')
  .option('--workspace <name>', 'Save to named workspace under .tbd/workspaces/')
  .option('--dir <path>', 'Save to arbitrary directory')
  .option('--outbox', 'Shortcut for --workspace=outbox --updates-only')
  .option('--updates-only', 'Only save issues modified since last sync')
  .action(async (options, command) => {
    const handler = new SaveHandler(command);
    await handler.run(options);
  });
