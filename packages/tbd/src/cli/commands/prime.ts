/**
 * `tbd prime` - Output workflow context for AI agents.
 *
 * Designed to be called by hooks at session start and before context compaction
 * to ensure agents remember the tbd workflow.
 *
 * See: tbd-design.md §6.4.3 The tbd prime Command
 */

import { Command } from 'commander';
import { readFile, access } from 'node:fs/promises';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

import { BaseCommand } from '../lib/baseCommand.js';
import { isInitialized } from '../../file/config.js';
import { stripFrontmatter } from '../../utils/markdownUtils.js';

interface PrimeOptions {
  export?: boolean;
  brief?: boolean;
}

/**
 * Get the path to the bundled SKILL.md file.
 */
function getSkillPath(): string {
  const __filename = fileURLToPath(import.meta.url);
  const __dirname = dirname(__filename);
  // When bundled, runs from dist/bin.mjs or dist/cli.mjs
  // Docs are at dist/docs/SKILL.md (same level as the bundle)
  return join(__dirname, 'docs', 'SKILL.md');
}

/**
 * Load the skill content from the bundled SKILL.md file with fallbacks.
 * This is exported for use by setup.ts for skill installation.
 */
export async function loadSkillContent(): Promise<string> {
  // Try bundled location first
  try {
    return await readFile(getSkillPath(), 'utf-8');
  } catch {
    // Fallback: try to read from source location during development
  }

  // Fallback for development without bundle
  try {
    const __filename = fileURLToPath(import.meta.url);
    const __dirname = dirname(__filename);
    const devPath = join(__dirname, '..', '..', 'docs', 'SKILL.md');
    return await readFile(devPath, 'utf-8');
  } catch {
    // Fallback: try repo-level docs
  }

  // Last fallback: repo-level docs
  try {
    const __filename = fileURLToPath(import.meta.url);
    const __dirname = dirname(__filename);
    const repoPath = join(__dirname, '..', '..', '..', '..', '..', 'docs', 'SKILL.md');
    return await readFile(repoPath, 'utf-8');
  } catch {
    // If all else fails, throw an error
    throw new Error('SKILL.md content file not found. Please rebuild the CLI.');
  }
}

/**
 * Load the prime content from the bundled SKILL.md file with fallbacks.
 * Strips frontmatter and adjusts the header for prime output.
 */
export async function loadPrimeContent(): Promise<string> {
  const skillContent = await loadSkillContent();
  const content = stripFrontmatter(skillContent);

  // Replace header for prime output context
  return content.replace(/^# tbd Workflow\b/, '# tbd Workflow Context');
}

/**
 * Brief prime content for minimal context (~200 tokens).
 * Useful for constrained context windows.
 */
const BRIEF_PRIME_CONTENT = `# tbd Quick Reference

\`tbd\` = git-native issue tracking. Use tbd commands, NOT bd commands.

## Session Closing Checklist (REQUIRED)

1. git add + git commit
2. git push
3. gh pr checks <PR> --watch  # WAIT for completion
4. tbd close/update <id>     # for issues worked on
5. tbd sync

## Key Commands

- \`tbd list --pretty\` - view open issues
- \`tbd show <id>\` - issue details
- \`tbd update <id> --status in_progress\` - claim issue
- \`tbd close <id>\` - complete issue
- \`tbd sync\` - sync with remote

Run \`tbd prime\` for full context.`;

class PrimeHandler extends BaseCommand {
  async run(options: PrimeOptions): Promise<void> {
    const cwd = process.cwd();

    // Silent exit if not in a tbd project
    if (!(await isInitialized(cwd))) {
      // Exit silently with code 0 (no output, no error)
      return;
    }

    // Check for Beads installation alongside tbd and warn
    const beadsWarning = await this.checkForBeads(cwd);
    if (beadsWarning) {
      console.log(beadsWarning);
      console.log('');
    }

    // Brief mode: output minimal context (~200 tokens)
    if (options.brief) {
      console.log(BRIEF_PRIME_CONTENT);
      return;
    }

    // Check for custom override file
    const customPrimePath = join(cwd, '.tbd', 'PRIME.md');

    // If --export, always show default content
    if (!options.export) {
      try {
        await access(customPrimePath);
        const customContent = await readFile(customPrimePath, 'utf-8');
        console.log(customContent);
        return;
      } catch {
        // No custom file, use default
      }
    }

    // Load and output default prime content from bundled file
    const primeContent = await loadPrimeContent();
    console.log(primeContent);
  }

  /**
   * Check if Beads is installed alongside tbd and return a warning message.
   * This helps users who are migrating from Beads to tbd.
   */
  private async checkForBeads(cwd: string): Promise<string | null> {
    const beadsDir = join(cwd, '.beads');
    try {
      await access(beadsDir);
      // .beads/ exists - warn the agent
      return `⚠️  WARNING: A .beads/ directory was detected alongside .tbd/
   When asked to use beads, use \`tbd\` commands, NOT \`bd\` commands.
   To complete migration: tbd setup beads --disable --confirm`;
    } catch {
      // No .beads/ directory, no warning needed
      return null;
    }
  }
}

export const primeCommand = new Command('prime')
  .description('Context-efficient instructions for agents, for use in every session')
  .option('--export', 'Output default content (ignores PRIME.md override)')
  .option('--brief', 'Output minimal context (~200 tokens) for constrained contexts')
  .action(async (options, command) => {
    const handler = new PrimeHandler(command);
    await handler.run(options);
  });
