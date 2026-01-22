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
import { DocCache, SCORE_MIN_THRESHOLD } from '../../file/doc-cache.js';
import { DEFAULT_DOC_PATHS } from '../../lib/paths.js';

interface ShortcutOptions {
  list?: boolean;
  all?: boolean;
}

class ShortcutHandler extends BaseCommand {
  async run(query: string | undefined, options: ShortcutOptions): Promise<void> {
    await this.execute(async () => {
      // Create and load the doc cache
      const cache = new DocCache(DEFAULT_DOC_PATHS);
      await cache.load();

      // List mode
      if (options.list) {
        await this.handleList(cache, options.all);
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
   * Handle --list mode: show all available shortcuts.
   */
  private async handleList(cache: DocCache, includeAll?: boolean): Promise<void> {
    const docs = cache.list(includeAll);

    if (this.ctx.json) {
      this.output.data(
        docs.map((d) => ({
          name: d.name,
          title: d.frontmatter?.title,
          description: d.frontmatter?.description,
          path: d.path,
          sourceDir: d.sourceDir,
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

    for (const doc of docs) {
      const shadowed = cache.isShadowed(doc);
      const title = doc.frontmatter?.title ?? doc.name;

      if (shadowed) {
        // Muted style for shadowed entries
        console.log(pc.dim(`  ${title}  (${doc.sourceDir}) [shadowed]`));
      } else {
        console.log(title);
        console.log(pc.dim(`  ${doc.sourceDir}`));
      }
    }
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
    if (best.score < SCORE_MIN_THRESHOLD) {
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
      console.log(best.doc.content);
    }
  }
}

export const shortcutCommand = new Command('shortcut')
  .description('Find and output documentation shortcuts')
  .argument('[query]', 'Shortcut name or description to search for')
  .option('--list', 'List all available shortcuts')
  .option('--all', 'Include shadowed shortcuts (use with --list)')
  .action(async (query: string | undefined, options: ShortcutOptions, command) => {
    const handler = new ShortcutHandler(command);
    await handler.run(query, options);
  });
