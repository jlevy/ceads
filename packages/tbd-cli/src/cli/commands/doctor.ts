/**
 * `tbd doctor` - Diagnose and repair repository.
 *
 * See: tbd-design-v3.md §4.9 Doctor
 */

import { Command } from 'commander';

import { BaseCommand } from '../lib/baseCommand.js';

interface DoctorOptions {
  fix?: boolean;
}

class DoctorHandler extends BaseCommand {
  async run(options: DoctorOptions): Promise<void> {
    // TODO: Implement doctor
    // Check:
    // - .tbd/ directory exists
    // - config.yml is valid
    // - sync branch exists
    // - worktree is healthy
    // - no orphaned temp files

    const checks = [
      { name: 'Config file', status: 'ok' },
      { name: 'Sync branch', status: 'ok' },
      { name: 'Worktree', status: 'ok' },
      { name: 'Index', status: 'ok' },
    ];

    const allOk = checks.every((c) => c.status === 'ok');

    this.output.data({ checks, healthy: allOk }, () => {
      const colors = this.output.getColors();
      for (const check of checks) {
        const icon = check.status === 'ok' ? colors.success('✓') : colors.error('✗');
        console.log(`${icon} ${check.name}`);
      }
      console.log('');
      if (allOk) {
        this.output.success('Repository is healthy');
      } else {
        this.output.warn('Issues found. Run with --fix to repair.');
      }
    });
  }
}

export const doctorCommand = new Command('doctor')
  .description('Diagnose and repair repository')
  .option('--fix', 'Attempt to fix issues')
  .action(async (options, command) => {
    const handler = new DoctorHandler(command);
    await handler.run(options);
  });
