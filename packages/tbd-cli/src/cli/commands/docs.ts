/**
 * `tbd docs` - Display CLI documentation.
 *
 * Shows the bundled documentation for tbd CLI.
 * Documentation can be filtered by section.
 */

import { Command } from 'commander';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

import { BaseCommand } from '../lib/baseCommand.js';

/**
 * Get the path to the bundled docs file.
 * The docs file is copied to dist/docs/ during build.
 */
function getDocsPath(): string {
  const __filename = fileURLToPath(import.meta.url);
  const __dirname = dirname(__filename);
  // When bundled, runs from dist/bin.mjs or dist/cli.mjs
  // Docs are at dist/docs/tbd-docs.md (same level as the bundle)
  return join(__dirname, 'docs', 'tbd-docs.md');
}

interface DocsOptions {
  section?: string;
  list?: boolean;
}

class DocsHandler extends BaseCommand {
  async run(options: DocsOptions): Promise<void> {
    let content: string;
    try {
      content = await readFile(getDocsPath(), 'utf-8');
    } catch {
      // Fallback: try to read from source location during development
      try {
        const __filename = fileURLToPath(import.meta.url);
        const __dirname = dirname(__filename);
        // During development without bundle: src/cli/commands -> src/docs
        const devPath = join(__dirname, '..', '..', 'docs', 'tbd-docs.md');
        content = await readFile(devPath, 'utf-8');
      } catch {
        // Last fallback: repo-level docs
        try {
          const __filename = fileURLToPath(import.meta.url);
          const __dirname = dirname(__filename);
          // From packages/tbd-cli/dist -> packages/tbd-cli/../../docs
          const repoPath = join(__dirname, '..', '..', '..', 'docs', 'tbd-docs.md');
          content = await readFile(repoPath, 'utf-8');
        } catch {
          this.output.error('Documentation file not found. Please rebuild the CLI.');
          return;
        }
      }
    }

    // List available sections
    if (options.list) {
      const sections = this.extractSections(content);
      this.output.data(sections, () => {
        const colors = this.output.getColors();
        console.log(colors.bold('Available documentation sections:'));
        console.log('');
        for (const section of sections) {
          console.log(`  ${section}`);
        }
        console.log('');
        console.log(`Use ${colors.dim('tbd docs --section <name>')} to view a specific section.`);
      });
      return;
    }

    // Filter by section if specified
    if (options.section) {
      const sectionContent = this.extractSection(content, options.section);
      if (!sectionContent) {
        this.output.error(`Section "${options.section}" not found.`);
        console.log('');
        console.log('Use --list to see available sections.');
        return;
      }
      content = sectionContent;
    }

    // Output the documentation
    console.log(content);
  }

  /**
   * Extract section names from the documentation.
   * Sections are top-level headers (## ).
   */
  private extractSections(content: string): string[] {
    const sections: string[] = [];
    const lines = content.split('\n');

    for (const line of lines) {
      if (line.startsWith('## ')) {
        const sectionName = line.slice(3).trim();
        sections.push(sectionName);
      }
    }

    return sections;
  }

  /**
   * Extract a specific section from the documentation.
   * Returns content from the section header to the next section header.
   */
  private extractSection(content: string, sectionName: string): string | null {
    const lines = content.split('\n');
    const lowerName = sectionName.toLowerCase();

    let inSection = false;
    const sectionLines: string[] = [];

    for (const line of lines) {
      if (line.startsWith('## ')) {
        if (inSection) {
          // End of our section
          break;
        }
        const currentSection = line.slice(3).trim().toLowerCase();
        if (currentSection.includes(lowerName)) {
          inSection = true;
          sectionLines.push(line);
        }
      } else if (inSection) {
        sectionLines.push(line);
      }
    }

    if (sectionLines.length === 0) {
      return null;
    }

    // Trim trailing empty lines
    while (sectionLines.length > 0) {
      const lastLine = sectionLines[sectionLines.length - 1];
      if (lastLine?.trim() === '') {
        sectionLines.pop();
      } else {
        break;
      }
    }

    return sectionLines.join('\n');
  }
}

export const docsCommand = new Command('docs')
  .description('Display CLI documentation')
  .option('--section <name>', 'Show specific section (e.g., "commands", "workflows")')
  .option('--list', 'List available sections')
  .action(async (options, command) => {
    const handler = new DocsHandler(command);
    await handler.run(options);
  });
