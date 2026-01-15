/**
 * `tbd info` - Show repository info.
 *
 * See: tbd-design-v3.md §4.9 Info
 */

import { Command } from 'commander';
import { access } from 'node:fs/promises';

import { VERSION } from '../../index.js';
import { BaseCommand } from '../lib/baseCommand.js';
import { readConfig, CONFIG_FILE_PATH } from '../../file/config.js';
import { listIssues } from '../../file/storage.js';

// Base directory for issues
const ISSUES_BASE_DIR = '.tbd-sync';

class InfoHandler extends BaseCommand {
  async run(): Promise<void> {
    // Check if initialized
    let initialized = false;
    try {
      await access('.tbd');
      initialized = true;
    } catch {
      initialized = false;
    }

    // Try to read config
    let config;
    try {
      config = await readConfig('.');
    } catch {
      config = null;
    }

    // Count issues
    let issueCount = 0;
    try {
      const issues = await listIssues(ISSUES_BASE_DIR);
      issueCount = issues.length;
    } catch {
      issueCount = 0;
    }

    const info = {
      version: VERSION,
      initialized,
      workingDirectory: process.cwd(),
      configFile: CONFIG_FILE_PATH,
      syncBranch: config?.sync.branch ?? 'tbd-sync',
      remote: config?.sync.remote ?? 'origin',
      idPrefix: config?.display.id_prefix ?? 'bd',
      issueCount,
    };

    this.output.data(info, () => {
      const colors = this.output.getColors();
      console.log(`${colors.bold('tbd')} version ${VERSION}`);
      console.log('');

      if (!initialized) {
        console.log(`${colors.warn('Not initialized.')} Run ${colors.bold('tbd init')} to set up.`);
        return;
      }

      console.log(`${colors.dim('Working directory:')} ${info.workingDirectory}`);
      console.log(`${colors.dim('Config file:')} ${info.configFile}`);
      console.log(`${colors.dim('Sync branch:')} ${info.syncBranch}`);
      console.log(`${colors.dim('Remote:')} ${info.remote}`);
      console.log(`${colors.dim('ID prefix:')} ${info.idPrefix}-`);
      console.log(`${colors.dim('Total issues:')} ${info.issueCount}`);
    });
  }
}

export const infoCommand = new Command('info')
  .description('Show repository information')
  .action(async (_options, command) => {
    const handler = new InfoHandler(command);
    await handler.run();
  });
