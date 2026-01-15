/**
 * `tbd info` - Show repository info.
 *
 * See: tbd-design-v3.md §4.9 Info
 */

import { Command } from 'commander';

import { VERSION } from '../../index.js';
import { BaseCommand } from '../lib/baseCommand.js';

class InfoHandler extends BaseCommand {
  async run(): Promise<void> {
    // TODO: Implement info
    // Show repository info, config, sync status

    const info = {
      version: VERSION,
      syncBranch: 'tbd-sync',
      remote: 'origin',
      workingDirectory: process.cwd(),
      configFile: '.tbd/config.yml',
    };

    this.output.data(info, () => {
      const colors = this.output.getColors();
      console.log(`${colors.bold('tbd')} version ${VERSION}`);
      console.log(`${colors.dim('Sync branch:')} ${info.syncBranch}`);
      console.log(`${colors.dim('Remote:')} ${info.remote}`);
      console.log(`${colors.dim('Working directory:')} ${info.workingDirectory}`);
    });
  }
}

export const infoCommand = new Command('info')
  .description('Show repository information')
  .action(async (_options, command) => {
    const handler = new InfoHandler(command);
    await handler.run();
  });
