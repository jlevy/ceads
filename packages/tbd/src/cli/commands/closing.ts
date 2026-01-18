/**
 * `tbd closing` - Display the session closing protocol reminder.
 *
 * Shows the close protocol checklist for completing work.
 * Used by the Claude Code PostToolUse hook after git push.
 */

import { Command } from 'commander';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

import { BaseCommand } from '../lib/baseCommand.js';
import { CLIError } from '../lib/errors.js';
import { renderMarkdown } from '../lib/output.js';

/**
 * Get the path to the bundled closing file.
 * The file is copied to dist/docs/ during build.
 */
function getCloseProtocolPath(): string {
  const __filename = fileURLToPath(import.meta.url);
  const __dirname = dirname(__filename);
  return join(__dirname, 'docs', 'tbd-closing.md');
}

class CloseProtocolHandler extends BaseCommand {
  async run(): Promise<void> {
    let content: string;
    try {
      content = await readFile(getCloseProtocolPath(), 'utf-8');
    } catch {
      // Fallback: try to read from source location during development
      try {
        const __filename = fileURLToPath(import.meta.url);
        const __dirname = dirname(__filename);
        const devPath = join(__dirname, '..', '..', 'docs', 'tbd-closing.md');
        content = await readFile(devPath, 'utf-8');
      } catch {
        // Last fallback: repo-level docs
        try {
          const __filename = fileURLToPath(import.meta.url);
          const __dirname = dirname(__filename);
          const repoPath = join(__dirname, '..', '..', '..', 'docs', 'tbd-closing.md');
          content = await readFile(repoPath, 'utf-8');
        } catch {
          throw new CLIError('Close protocol file not found. Please rebuild the CLI.');
        }
      }
    }

    console.log(renderMarkdown(content, this.ctx.color));
  }
}

export const closeProtocolCommand = new Command('closing')
  .description('Display the session closing protocol reminder')
  .action(async (_options: unknown, command: Command) => {
    const handler = new CloseProtocolHandler(command);
    await handler.run();
  });
