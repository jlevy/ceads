/**
 * `tbd import` - Import from Beads or other sources.
 *
 * See: tbd-design-v3.md §5.1 Import Strategy
 */

import { Command } from 'commander';

import { BaseCommand } from '../lib/baseCommand.js';

interface ImportOptions {
  fromBeads?: boolean;
  beadsDir?: string;
  merge?: boolean;
}

class ImportHandler extends BaseCommand {
  async run(file: string | undefined, options: ImportOptions): Promise<void> {
    if (this.checkDryRun('Would import issues', { file, ...options })) {
      return;
    }

    // TODO: Implement import
    // 1. Parse source (JSONL file or Beads database)
    // 2. Map IDs (Beads ID -> tbd ID)
    // 3. Convert fields
    // 4. Handle duplicates (merge or skip)
    // 5. Save issues and sync

    if (options.fromBeads) {
      this.output.info('Importing from Beads database...');
    } else if (file) {
      this.output.info(`Importing from ${file}...`);
    }

    // Mock output
    const result = {
      imported: 42,
      skipped: 3,
      merged: 5,
    };

    this.output.data(result, () => {
      this.output.success(`Imported ${result.imported} issues`);
      if (result.skipped > 0) {
        this.output.info(`Skipped ${result.skipped} duplicates`);
      }
      if (result.merged > 0) {
        this.output.info(`Merged ${result.merged} existing issues`);
      }
    });
  }
}

export const importCommand = new Command('import')
  .description('Import issues from Beads or JSONL file')
  .argument('[file]', 'JSONL file to import')
  .option('--from-beads', 'Import directly from Beads database')
  .option('--beads-dir <path>', 'Beads data directory')
  .option('--merge', 'Merge with existing issues instead of skipping duplicates')
  .action(async (file, options, command) => {
    const handler = new ImportHandler(command);
    await handler.run(file, options);
  });
