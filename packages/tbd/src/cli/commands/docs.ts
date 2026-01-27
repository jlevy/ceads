/**
 * `tbd docs` - Display CLI documentation and manage doc cache.
 *
 * Shows the bundled documentation for tbd CLI.
 * Documentation can be filtered by section.
 *
 * Also provides --refresh and --status for syncing the doc cache from config.
 */

import { Command } from 'commander';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

import { BaseCommand } from '../lib/base-command.js';
import { CLIError, NotFoundError, NotInitializedError } from '../lib/errors.js';
import { renderMarkdown } from '../lib/output.js';
import type { DocSection } from '../../lib/types.js';
import GithubSlugger from 'github-slugger';
import { findTbdRoot, readConfig, updateLocalState } from '../../file/config.js';
import {
  DocSync,
  generateDefaultDocCacheConfig,
  mergeDocCacheConfig,
} from '../../file/doc-sync.js';

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
  all?: boolean;
  refresh?: boolean;
  status?: boolean;
}

class DocsHandler extends BaseCommand {
  async run(topic: string | undefined, options: DocsOptions): Promise<void> {
    // Handle doc cache sync options first
    if (options.refresh) {
      await this.handleRefresh();
      return;
    }

    if (options.status) {
      await this.handleStatus();
      return;
    }

    let content: string;
    try {
      content = await readFile(getDocsPath(), 'utf-8');
    } catch {
      // Fallback: try to read from source location during development
      try {
        const __filename = fileURLToPath(import.meta.url);
        const __dirname = dirname(__filename);
        // During development: src/cli/commands -> packages/tbd/docs
        const devPath = join(__dirname, '..', '..', '..', 'docs', 'tbd-docs.md');
        content = await readFile(devPath, 'utf-8');
      } catch {
        throw new CLIError('Documentation file not found. Please rebuild the CLI.');
      }
    }

    const sections = this.extractSections(content);

    // Show comprehensive documentation listing
    if (options.all) {
      await this.showComprehensiveListing();
      return;
    }

    // List available sections
    if (options.list) {
      this.output.data(sections, () => {
        const colors = this.output.getColors();
        console.log(colors.bold('Available documentation sections:'));
        console.log('');
        // Calculate max slug length for alignment
        const maxSlugLen = Math.max(...sections.map((s) => s.slug.length));
        for (const section of sections) {
          const paddedSlug = section.slug.padEnd(maxSlugLen);
          console.log(`  ${colors.id(paddedSlug)}  ${section.title}`);
        }
        console.log('');
        console.log(`Use ${colors.dim('tbd docs <topic>')} to view a specific section.`);
      });
      return;
    }

    // Determine which section to show (positional topic takes precedence)
    const sectionQuery = topic ?? options.section;

    // Filter by section if specified
    if (sectionQuery) {
      const sectionContent = this.extractSection(content, sections, sectionQuery);
      if (!sectionContent) {
        throw new NotFoundError(
          'Section',
          `"${sectionQuery}" (use --list to see available sections)`,
        );
      }
      content = sectionContent;
    }

    // Output the documentation with Markdown colorization
    console.log(renderMarkdown(content, this.ctx.color));
  }

  /**
   * Extract section metadata from the documentation.
   * Sections are top-level headers (## ).
   * Returns title and slugified ID for each section.
   */
  private extractSections(content: string): DocSection[] {
    const sections: DocSection[] = [];
    const lines = content.split('\n');
    const slugger = new GithubSlugger();

    for (const line of lines) {
      if (line.startsWith('## ')) {
        const title = line.slice(3).trim();
        const slug = slugger.slug(title);
        sections.push({ title, slug });
      }
    }

    return sections;
  }

  /**
   * Extract a specific section from the documentation.
   * Matches by slug or partial title match.
   * Returns content from the section header to the next section header.
   */
  private extractSection(content: string, sections: DocSection[], query: string): string | null {
    const lowerQuery = query.toLowerCase();

    // Find matching section - first try exact slug match, then partial title match
    const matchedSection =
      sections.find((s) => s.slug === lowerQuery) ??
      sections.find((s) => s.title.toLowerCase().includes(lowerQuery));

    if (!matchedSection) {
      return null;
    }

    const lines = content.split('\n');
    let inSection = false;
    const sectionLines: string[] = [];

    for (const line of lines) {
      if (line.startsWith('## ')) {
        if (inSection) {
          // End of our section
          break;
        }
        const currentTitle = line.slice(3).trim();
        if (currentTitle === matchedSection.title) {
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

  /**
   * Handle --refresh: Sync docs from config.
   * Merges user's config with defaults to ensure new bundled docs are included.
   */
  private async handleRefresh(): Promise<void> {
    const cwd = process.cwd();
    const tbdRoot = await findTbdRoot(cwd);

    if (!tbdRoot) {
      throw new NotInitializedError(cwd);
    }

    const config = await readConfig(tbdRoot);
    const colors = this.output.getColors();

    // Merge user's config with defaults (ensures new bundled docs are added)
    const defaults = await generateDefaultDocCacheConfig();
    const filesConfig = mergeDocCacheConfig(config.docs_cache?.files, defaults);

    const sync = new DocSync(tbdRoot, filesConfig);
    const result = await sync.sync();

    // Update last sync time
    await updateLocalState(tbdRoot, {
      last_doc_sync_at: new Date().toISOString(),
    });

    // Report results
    this.output.data(result, () => {
      if (result.added.length > 0) {
        console.log(colors.success(`Added ${result.added.length} doc(s)`));
        for (const path of result.added) {
          console.log(`  + ${path}`);
        }
      }

      if (result.updated.length > 0) {
        console.log(colors.success(`Updated ${result.updated.length} doc(s)`));
        for (const path of result.updated) {
          console.log(`  ~ ${path}`);
        }
      }

      if (result.removed.length > 0) {
        console.log(colors.warn(`Removed ${result.removed.length} doc(s)`));
        for (const path of result.removed) {
          console.log(`  - ${path}`);
        }
      }

      if (result.errors.length > 0) {
        console.log(colors.error(`Errors: ${result.errors.length}`));
        for (const { path, error } of result.errors) {
          console.log(`  ! ${path}: ${error}`);
        }
      }

      if (
        result.added.length === 0 &&
        result.updated.length === 0 &&
        result.removed.length === 0 &&
        result.errors.length === 0
      ) {
        console.log(colors.dim('Docs are up to date.'));
      }
    });
  }

  /**
   * Handle --status: Show what would change without actually changing files.
   * Merges user's config with defaults to ensure new bundled docs are included.
   */
  private async handleStatus(): Promise<void> {
    const cwd = process.cwd();
    const tbdRoot = await findTbdRoot(cwd);

    if (!tbdRoot) {
      throw new NotInitializedError(cwd);
    }

    const config = await readConfig(tbdRoot);
    const colors = this.output.getColors();

    // Merge user's config with defaults (ensures new bundled docs are added)
    const defaults = await generateDefaultDocCacheConfig();
    const filesConfig = mergeDocCacheConfig(config.docs_cache?.files, defaults);

    const sync = new DocSync(tbdRoot, filesConfig);
    const result = await sync.status();

    // Report results
    this.output.data(result, () => {
      const total = result.added.length + result.updated.length + result.removed.length;

      if (total === 0 && result.errors.length === 0) {
        console.log(colors.success('Docs are up to date. No changes needed.'));
        return;
      }

      console.log(colors.bold('Doc sync status (dry run):'));

      if (result.added.length > 0) {
        console.log(`  Would add ${result.added.length} doc(s):`);
        for (const path of result.added) {
          console.log(`    + ${path}`);
        }
      }

      if (result.updated.length > 0) {
        console.log(`  Would update ${result.updated.length} doc(s):`);
        for (const path of result.updated) {
          console.log(`    ~ ${path}`);
        }
      }

      if (result.removed.length > 0) {
        console.log(`  Would remove ${result.removed.length} doc(s):`);
        for (const path of result.removed) {
          console.log(`    - ${path}`);
        }
      }

      if (result.errors.length > 0) {
        console.log(colors.error(`  Errors: ${result.errors.length}`));
        for (const { path, error } of result.errors) {
          console.log(`    ! ${path}: ${error}`);
        }
      }

      console.log('');
      console.log(colors.dim('Run tbd docs --refresh to apply these changes.'));
    });
  }

  /**
   * Show a comprehensive listing of all documentation resources organized by purpose.
   */
  private async showComprehensiveListing(): Promise<void> {
    const colors = this.output.getColors();

    console.log(colors.bold('=== tbd Documentation Resources ==='));
    console.log('');

    // Getting Started
    console.log(colors.bold('Getting Started:'));
    console.log('  tbd                          Full orientation and project status');
    console.log('  tbd prime                    Workflow context and guidance');
    console.log('  tbd prime --brief            Quick reference (~35 lines)');
    console.log('  tbd --help                   CLI command reference');
    console.log('');

    // Workflows (Shortcuts)
    console.log(colors.bold('Workflows (Shortcuts):'));
    console.log('  tbd shortcut --list          List all available shortcuts');
    console.log('  tbd shortcut new-plan-spec   Plan a new feature');
    console.log('  tbd shortcut commit-code     Commit code properly');
    console.log('  tbd shortcut create-or-update-pr-simple  Create a pull request');
    console.log('');

    // Guidelines
    console.log(colors.bold('Guidelines (Coding Standards):'));
    console.log('  tbd guidelines --list        List all available guidelines');
    console.log('  tbd guidelines typescript-rules      TypeScript best practices');
    console.log('  tbd guidelines general-tdd-guidelines  Test-driven development');
    console.log('  tbd guidelines golden-testing-guidelines  Snapshot/golden testing');
    console.log('');

    // Templates
    console.log(colors.bold('Templates:'));
    console.log('  tbd template --list          List all available templates');
    console.log('  tbd template plan-spec       Feature planning template');
    console.log('  tbd template architecture-doc    Architecture document template');
    console.log('');

    // Design & Reference
    console.log(colors.bold('Design & Reference:'));
    console.log('  tbd docs --list              List documentation sections');
    console.log('  tbd design                   tbd design document');
    console.log('  tbd closing                  Session closing protocol');
    console.log('');

    // Quick Tips
    console.log(colors.bold('Quick Tips:'));
    console.log('  - Run tbd ready to see what issues are available to work on');
    console.log('  - Run tbd shortcut <name> to get step-by-step instructions');
    console.log('  - Run tbd guidelines <name> to get coding standards');
    console.log('  - Always run tbd sync at the end of a session');
  }
}

export const docsCommand = new Command('docs')
  .description('Display CLI documentation and manage doc cache')
  .argument('[topic]', 'Topic to display (e.g., "commands", "id-system")')
  .option('--section <name>', 'Show specific section (e.g., "commands", "workflows")')
  .option('--list', 'List available sections')
  .option('--all', 'Show comprehensive listing of all documentation resources')
  .option('--refresh', 'Sync docs from config to .tbd/docs/')
  .option('--status', 'Show what would change without actually syncing')
  .action(async (topic: string | undefined, options: DocsOptions, command: Command) => {
    const handler = new DocsHandler(command);
    await handler.run(topic, options);
  });
