/**
 * `tbd readme` - Display the README.
 *
 * Shows the bundled README (same as the GitHub landing page).
 */

import { Command } from 'commander';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

import { BaseCommand } from '../lib/baseCommand.js';
import { renderMarkdown } from '../lib/output.js';

/**
 * Get the path to the bundled README file.
 * The README is copied to dist/docs/ during build.
 */
function getReadmePath(): string {
  const __filename = fileURLToPath(import.meta.url);
  const __dirname = dirname(__filename);
  // When bundled, runs from dist/bin.mjs or dist/cli.mjs
  // README is at dist/docs/README.md (same level as the bundle)
  return join(__dirname, 'docs', 'README.md');
}

class ReadmeHandler extends BaseCommand {
  async run(): Promise<void> {
    let content: string;
    try {
      content = await readFile(getReadmePath(), 'utf-8');
    } catch {
      // Fallback: try to read from source location during development
      try {
        const __filename = fileURLToPath(import.meta.url);
        const __dirname = dirname(__filename);
        // During development without bundle: src/cli/commands -> repo root
        const devPath = join(__dirname, '..', '..', '..', '..', '..', 'README.md');
        content = await readFile(devPath, 'utf-8');
      } catch {
        // Last fallback: try package-level README
        try {
          const __filename = fileURLToPath(import.meta.url);
          const __dirname = dirname(__filename);
          // From packages/tbd-cli/src/cli/commands -> packages/tbd-cli/README.md
          const pkgPath = join(__dirname, '..', '..', '..', 'README.md');
          content = await readFile(pkgPath, 'utf-8');
        } catch {
          this.output.error('README file not found. Please rebuild the CLI.');
          return;
        }
      }
    }

    // Output the README with Markdown colorization
    console.log(renderMarkdown(content, this.ctx.color));
  }
}

export const readmeCommand = new Command('readme')
  .description('Display the README (same as GitHub landing page)')
  .action(async (_options: object, command: Command) => {
    const handler = new ReadmeHandler(command);
    await handler.run();
  });
