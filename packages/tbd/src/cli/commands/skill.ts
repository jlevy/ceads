/**
 * `tbd skill` - Output AI agent skill file content.
 *
 * See: tbd-design.md §Prime-First Design
 */

import { Command } from 'commander';
import { readFile } from 'node:fs/promises';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

import { BaseCommand } from '../lib/base-command.js';
import { findTbdRoot } from '../../file/config.js';
import { DocCache, generateShortcutDirectory } from '../../file/doc-cache.js';
import { DEFAULT_SHORTCUT_PATHS, DEFAULT_GUIDELINES_PATHS } from '../../lib/paths.js';

interface SkillOptions {
  brief?: boolean;
}

/**
 * Get the path to a bundled doc file.
 */
function getDocPath(filename: string): string {
  const __filename = fileURLToPath(import.meta.url);
  const __dirname = dirname(__filename);
  // When bundled, runs from dist/bin.mjs or dist/cli.mjs
  // Docs are at dist/docs/ (same level as the bundle)
  return join(__dirname, 'docs', filename);
}

/**
 * Load a doc file content.
 */
async function loadDocContent(filename: string): Promise<string> {
  // Try bundled location first
  try {
    return await readFile(getDocPath(filename), 'utf-8');
  } catch {
    // Fallback for development
  }

  // Fallback: try to read from source location during development
  try {
    const __filename = fileURLToPath(import.meta.url);
    const __dirname = dirname(__filename);
    // During development: src/cli/commands -> packages/tbd/docs
    const devPath = join(__dirname, '..', '..', '..', 'docs', filename);
    return await readFile(devPath, 'utf-8');
  } catch {
    throw new Error(`${filename} not found. Please rebuild the CLI.`);
  }
}

class SkillHandler extends BaseCommand {
  async run(options: SkillOptions): Promise<void> {
    await this.execute(async () => {
      if (options.brief) {
        // Brief mode: just output skill-brief.md
        const content = await loadDocContent('skill-brief.md');
        console.log(content);
        return;
      }

      // Full mode: compose header + skill.md + shortcut directory
      const content = await this.composeFullSkill();
      console.log(content);
    }, 'Failed to output skill content');
  }

  /**
   * Compose the full skill output by combining:
   * 1. Claude header (YAML frontmatter)
   * 2. Base skill content (skill.md from shortcuts/system)
   * 3. Shortcut directory (from cache or generated on-the-fly)
   */
  private async composeFullSkill(): Promise<string> {
    // Load header (YAML frontmatter for Claude)
    const header = await loadDocContent('install/claude-header.md');

    // Load base skill content
    const baseSkill = await loadDocContent('shortcuts/system/skill.md');

    // Get shortcut directory
    const directory = await this.getShortcutDirectory();

    // Compose: header + base skill + (optional) shortcut directory
    let result = header + baseSkill;
    if (directory) {
      result = result.trimEnd() + '\n\n' + directory;
    }

    return result;
  }

  /**
   * Generate the shortcut directory on-the-fly.
   */
  private async getShortcutDirectory(): Promise<string | null> {
    // Try to find tbd root (may not be initialized)
    const tbdRoot = await findTbdRoot(process.cwd());
    if (!tbdRoot) {
      return null;
    }

    // Load shortcuts
    const shortcutCache = new DocCache(DEFAULT_SHORTCUT_PATHS, tbdRoot);
    await shortcutCache.load({ quiet: this.ctx.quiet });
    const shortcuts = shortcutCache.list();

    // Load guidelines
    const guidelinesCache = new DocCache(DEFAULT_GUIDELINES_PATHS, tbdRoot);
    await guidelinesCache.load({ quiet: this.ctx.quiet });
    const guidelines = guidelinesCache.list();

    // If no docs loaded, skip directory
    if (shortcuts.length === 0 && guidelines.length === 0) {
      return null;
    }

    return generateShortcutDirectory(shortcuts, guidelines);
  }
}

export const skillCommand = new Command('skill')
  .description('Output AI agent skill file content')
  .option('--brief', 'Output condensed workflow rules only')
  .action(async (options: SkillOptions, command) => {
    const handler = new SkillHandler(command);
    await handler.run(options);
  });
