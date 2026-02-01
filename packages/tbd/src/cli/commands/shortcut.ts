/**
 * `tbd shortcut` - Find and output documentation shortcuts.
 *
 * Shortcuts are reusable instruction templates for common tasks.
 * Give a name or description and tbd will find the matching shortcut.
 *
 * See: docs/project/specs/active/plan-2026-01-22-doc-cache-abstraction.md
 */

import { Command } from 'commander';
import pc from 'picocolors';

import { BaseCommand } from '../lib/base-command.js';
import { SHORTCUT_AGENT_HEADER } from '../lib/doc-prompts.js';
import { requireInit, CLIError } from '../lib/errors.js';
import { DocCache, SCORE_PREFIX_MATCH } from '../../file/doc-cache.js';
import { addDoc } from '../../file/doc-add.js';
import { readConfig } from '../../file/config.js';
import { DEFAULT_SHORTCUT_PATHS } from '../../lib/paths.js';
import { truncate } from '../../lib/truncate.js';
import { formatDocSize } from '../../lib/format-utils.js';
import { getTerminalWidth } from '../lib/output.js';

interface ShortcutOptions {
  list?: boolean;
  all?: boolean;
  refresh?: boolean;
  quiet?: boolean;
  category?: string;
  add?: string;
  name?: string;
}

/**
 * Shortcut categories for filtering.
 * Categories are read from frontmatter.
 */
type ShortcutCategory =
  | 'planning'
  | 'documentation'
  | 'review'
  | 'git'
  | 'cleanup'
  | 'session'
  | 'meta';

class ShortcutHandler extends BaseCommand {
  async run(query: string | undefined, options: ShortcutOptions): Promise<void> {
    await this.execute(async () => {
      // Add mode
      if (options.add) {
        if (!options.name) {
          throw new CLIError('--name is required when using --add');
        }
        const tbdRoot = await requireInit();
        console.log(`Adding shortcut: ${options.name}`);
        console.log(`  URL: ${options.add}`);
        const result = await addDoc(tbdRoot, {
          url: options.add,
          name: options.name,
          docType: 'shortcut',
        });
        if (result.usedGhCli) {
          console.log(pc.dim('  (fetched via gh CLI due to direct access restriction)'));
        }
        console.log(pc.green(`  Added to ${result.destPath}`));
        console.log(pc.green(`  Config updated with source: ${result.rawUrl}`));
        console.log('');
        console.log('Run `tbd shortcut --list` to verify.');
        return;
      }

      // Get tbd root (supports running from subdirectories)
      const tbdRoot = await requireInit();

      // Read config to get lookup paths (fall back to defaults)
      const config = await readConfig(tbdRoot);
      const lookupPaths = config.docs_cache?.lookup_path ?? DEFAULT_SHORTCUT_PATHS;

      // Create and load the doc cache with proper base directory
      const cache = new DocCache(lookupPaths, tbdRoot);
      await cache.load({ quiet: this.ctx.quiet });

      // Refresh mode: regenerate cache and update skill files
      if (options.refresh) {
        await this.handleRefresh(cache, tbdRoot, options.quiet);
        return;
      }

      // List mode
      if (options.list || options.category) {
        await this.handleList(cache, options.all, options.category);
        return;
      }

      // No query: show explanation + help
      if (!query) {
        await this.handleNoQuery(cache);
        return;
      }

      // Query provided: try exact match first, then fuzzy
      await this.handleQuery(cache, query);
    }, 'Failed to find shortcut');
  }

  /**
   * Handle --refresh mode: no-op since shortcuts are now generated on-the-fly.
   * Kept for backward compatibility.
   */
  private async handleRefresh(cache: DocCache, _tbdRoot: string, quiet?: boolean): Promise<void> {
    const docs = cache.list();

    // Count shortcuts (excluding system docs)
    const shortcutCount = docs.filter(
      (d) => d.name !== 'skill' && d.name !== 'skill-brief' && d.name !== 'shortcut-explanation',
    ).length;

    if (!quiet) {
      if (this.ctx.json) {
        this.output.data({
          refreshed: true,
          shortcutCount,
          message: 'Shortcuts are now generated on-the-fly (no cache)',
        });
      } else {
        console.log(`${shortcutCount} shortcut(s) available (generated on-the-fly)`);
      }
    }
  }

  /**
   * Handle --list mode: show all available shortcuts.
   */
  private async handleList(
    cache: DocCache,
    includeAll?: boolean,
    category?: string,
  ): Promise<void> {
    let docs = cache.list(includeAll);

    // Filter by category if specified (read from frontmatter)
    if (category) {
      docs = docs.filter((d) => {
        const docCategory = d.frontmatter?.category as ShortcutCategory | undefined;
        return docCategory === category;
      });
    }

    if (this.ctx.json) {
      this.output.data(
        docs.map((d) => ({
          name: d.name,
          title: d.frontmatter?.title,
          description: d.frontmatter?.description,
          category: d.frontmatter?.category,
          path: d.path,
          sourceDir: d.sourceDir,
          sizeBytes: d.sizeBytes,
          approxTokens: d.approxTokens,
          shadowed: cache.isShadowed(d),
        })),
      );
      return;
    }

    if (docs.length === 0) {
      console.log('No shortcuts found.');
      console.log('Run `tbd setup --auto` to install built-in shortcuts.');
      return;
    }

    const maxWidth = getTerminalWidth();

    for (const doc of docs) {
      const shadowed = cache.isShadowed(doc);
      const name = doc.name;
      const title = doc.frontmatter?.title;
      const description = doc.frontmatter?.description ?? this.extractFallbackText(doc.content);

      if (shadowed) {
        // Muted style for shadowed entries
        const line = `${name} (${doc.sourceDir}) [shadowed]`;
        console.log(pc.dim(truncate(line, maxWidth)));
      } else {
        // Line 1: name (bold) + size/token info (dimmed)
        const sizeInfo = formatDocSize(doc.sizeBytes, doc.approxTokens);
        console.log(`${pc.bold(name)} ${pc.dim(sizeInfo)}`);

        // Line 2+: Indented "Title: Description"
        // Only truncate fallback body text; never truncate actual title/description
        const hasFrontmatter = title ?? doc.frontmatter?.description;
        const content =
          title && description ? `${title}: ${description}` : (title ?? description ?? '');
        if (content) {
          this.printWrappedDescription(content, maxWidth, !hasFrontmatter);
        }
      }
    }
  }

  /**
   * Extract fallback text from content when no frontmatter description exists.
   * Strips frontmatter and markdown syntax, takes first text, condenses whitespace.
   */
  private extractFallbackText(content: string): string | undefined {
    // Strip YAML frontmatter if present
    let text = content;
    if (text.startsWith('---')) {
      const endIndex = text.indexOf('---', 3);
      if (endIndex !== -1) {
        text = text.slice(endIndex + 3);
      }
    }

    // Strip markdown headers (# Title -> Title)
    text = text.replace(/^#+\s*/gm, '');
    // Strip bold/italic markers
    text = text.replace(/\*\*|__|\*|_/g, '');
    // Strip code blocks
    text = text.replace(/```[\s\S]*?```/g, '');
    // Strip inline code
    text = text.replace(/`[^`]+`/g, '');
    // Strip blockquotes
    text = text.replace(/^>\s*/gm, '');

    // Condense all whitespace to single spaces and trim
    text = text.replace(/\s+/g, ' ').trim();

    // Return first chunk of text (up to ~200 chars for reasonable fallback)
    if (text.length === 0) return undefined;
    return text.slice(0, 200);
  }

  /**
   * Print description indented, wrapped across lines.
   * @param text - Text to print
   * @param maxWidth - Terminal width
   * @param shouldTruncate - If true, truncate to two lines; if false, wrap all lines
   */
  private printWrappedDescription(text: string, maxWidth: number, shouldTruncate: boolean): void {
    const indent = '   ';
    const availableWidth = maxWidth - indent.length;

    if (text.length <= availableWidth) {
      // Fits on one line
      console.log(`${indent}${text}`);
      return;
    }

    if (shouldTruncate) {
      // Truncate to two lines max (for fallback body text)
      const firstLine = this.wrapAtWord(text, availableWidth);
      const remainder = text.slice(firstLine.length).trimStart();
      console.log(`${indent}${firstLine}`);
      if (remainder) {
        console.log(`${indent}${truncate(remainder, availableWidth)}`);
      }
    } else {
      // Wrap all lines without truncation (for title/description)
      let remaining = text;
      while (remaining.length > 0) {
        if (remaining.length <= availableWidth) {
          console.log(`${indent}${remaining}`);
          break;
        }
        const line = this.wrapAtWord(remaining, availableWidth);
        console.log(`${indent}${line}`);
        remaining = remaining.slice(line.length).trimStart();
      }
    }
  }

  /**
   * Wrap text at word boundary to fit within maxWidth.
   */
  private wrapAtWord(text: string, maxWidth: number): string {
    if (text.length <= maxWidth) return text;
    const lastSpace = text.lastIndexOf(' ', maxWidth);
    if (lastSpace > 0) {
      return text.slice(0, lastSpace);
    }
    return text.slice(0, maxWidth);
  }

  /**
   * Handle no query: show explanation + help.
   */
  private async handleNoQuery(cache: DocCache): Promise<void> {
    // Try to find the shortcut-explanation.md
    const explanation = cache.get('shortcut-explanation');
    if (explanation) {
      console.log(explanation.doc.content);
    } else {
      // Fallback explanation
      console.log('tbd shortcut - Find and output documentation shortcuts');
      console.log('');
      console.log('Usage:');
      console.log('  tbd shortcut <name>           Find shortcut by exact name');
      console.log('  tbd shortcut <description>    Find shortcut by fuzzy match');
      console.log('  tbd shortcut --list           List all available shortcuts');
      console.log('  tbd shortcut --list --all     Include shadowed shortcuts');
      console.log('');
      console.log('No shortcuts found. Run `tbd setup --auto` to install built-in shortcuts.');
    }
  }

  /**
   * Handle query: exact match first, then fuzzy.
   */
  private async handleQuery(cache: DocCache, query: string): Promise<void> {
    // Try exact match first
    const exactMatch = cache.get(query);
    if (exactMatch) {
      if (this.ctx.json) {
        this.output.data({
          name: exactMatch.doc.name,
          title: exactMatch.doc.frontmatter?.title,
          score: exactMatch.score,
          content: exactMatch.doc.content,
        });
      } else {
        console.log(SHORTCUT_AGENT_HEADER + '\n');
        console.log(exactMatch.doc.content);
      }
      return;
    }

    // Fuzzy match
    const matches = cache.search(query, 5);
    if (matches.length === 0) {
      console.log(`No shortcut found matching: ${query}`);
      console.log('Run `tbd shortcut --list` to see available shortcuts.');
      return;
    }

    const best = matches[0]!;
    // Use PREFIX_MATCH (0.9) as threshold for high confidence
    // Below this, show suggestions instead of auto-selecting
    if (best.score < SCORE_PREFIX_MATCH) {
      // Low confidence - show suggestions instead
      console.log(`No exact match for "${query}". Did you mean:`);
      for (const m of matches) {
        const name = m.doc.frontmatter?.title ?? m.doc.name;
        console.log(`  ${name} ${pc.dim(`(score: ${m.score.toFixed(2)})`)}`);
      }
      return;
    }

    // Good fuzzy match - output it
    if (this.ctx.json) {
      this.output.data({
        name: best.doc.name,
        title: best.doc.frontmatter?.title,
        score: best.score,
        content: best.doc.content,
      });
    } else {
      console.log(SHORTCUT_AGENT_HEADER + '\n');
      console.log(best.doc.content);
    }
  }
}

export const shortcutCommand = new Command('shortcut')
  .description('Find and output documentation shortcuts')
  .argument('[query]', 'Shortcut name or description to search for')
  .option('--list', 'List all available shortcuts')
  .option('--all', 'Include shadowed shortcuts (use with --list)')
  .option(
    '--category <category>',
    'Filter by category: planning, documentation, review, git, cleanup, session, meta',
  )
  .option('--refresh', 'Refresh the cached shortcut directory')
  .option('--quiet', 'Suppress output (use with --refresh)')
  .option('--add <url>', 'Add a shortcut from a URL')
  .option('--name <name>', 'Name for the added shortcut (required with --add)')
  .action(async (query: string | undefined, options: ShortcutOptions, command) => {
    const handler = new ShortcutHandler(command);
    await handler.run(query, options);
  });
