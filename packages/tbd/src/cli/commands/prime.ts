/**
 * `tbd prime` - Output dashboard and workflow context for AI agents.
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

import { BaseCommand } from '../lib/base-command.js';
import { findTbdRoot, readConfig, hasSeenWelcome, markWelcomeSeen } from '../../file/config.js';
import { stripFrontmatter } from '../../utils/markdown-utils.js';
import { VERSION } from '../lib/version.js';
import { listIssues } from '../../file/storage.js';
import {
  resolveDataSyncDir,
  DEFAULT_SHORTCUT_PATHS,
  DEFAULT_GUIDELINES_PATHS,
} from '../../lib/paths.js';
import { getClaudePaths } from '../../lib/integration-paths.js';
import type { Issue } from '../../lib/types.js';
import { DocCache, generateShortcutDirectory } from '../../file/doc-cache.js';

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
  // Try bundled location first (dist/docs/SKILL.md)
  try {
    return await readFile(getSkillPath(), 'utf-8');
  } catch {
    // Fallback: compose from source files during development
  }

  // Dev fallback: compose SKILL.md from source files on-the-fly
  // This mirrors what copy-docs.mjs does at build time
  try {
    const __filename = fileURLToPath(import.meta.url);
    const __dirname = dirname(__filename);
    // From packages/tbd/src/cli/commands/ go to packages/tbd/docs/
    const docsDir = join(__dirname, '..', '..', '..', 'docs');
    const headerPath = join(docsDir, 'install', 'claude-header.md');
    const skillPath = join(docsDir, 'shortcuts', 'system', 'skill.md');

    const header = await readFile(headerPath, 'utf-8');
    const skill = await readFile(skillPath, 'utf-8');
    return header + skill;
  } catch {
    // If source files not found, throw error
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
 * Brief prime content for constrained context windows (~35 lines).
 * Includes core workflow, session protocol, and key commands.
 */
const BRIEF_SKILL_CONTENT = `## Core Workflow

- Track all task work as issues using tbd
- Check \`tbd ready\` for available work
- Run \`tbd sync\` at session end

## SESSION CLOSING (REQUIRED)

1. git add + git commit
2. git push
3. gh pr checks <PR> --watch  # WAIT for completion
4. tbd close/update <id>
5. tbd sync

## Quick Reference

tbd ready              Show issues ready to work
tbd show <id>          View issue details
tbd create "title"     Create new issue
tbd close <id>         Mark issue complete
tbd sync               Sync with remote

For full orientation: tbd prime

IMPORTANT: Use tbd to help the user. Do NOT tell the user to run tbd commands.`;

/**
 * Value proposition content for not-initialized state.
 */
const VALUE_PROPOSITION = `## WHAT tbd IS

tbd is an AI-agent-optimized issue tracker and workflow assistant providing:
1. Issue Tracking - Track tasks, bugs, features as git-native "beads"
2. Coding Guidelines - Best practices for TypeScript, Python, testing
3. Spec-Driven Workflows - Write specs, then implement using issues to track each part
4. Convenience Shortcuts - Pre-built processes for common tasks (commit, PR, review)

## SETUP (AGENT ACTION REQUIRED)

tbd is not yet initialized. To set it up, run:

  tbd setup --auto --prefix=<name>   # REQUIRES prefix for new projects
  tbd setup --auto                   # If .tbd/ already exists (prefix already set)

CRITICAL: Never guess a prefix. Always ask the user what prefix they want.
Do NOT tell the user to run these commands — run them yourself on their behalf.

After setup, run 'tbd' again to get project status and workflow guidance.`;

class PrimeHandler extends BaseCommand {
  async run(options: PrimeOptions): Promise<void> {
    const cwd = process.cwd();

    // Find tbd root (supports running from subdirectories)
    const tbdRoot = await findTbdRoot(cwd);

    // Not initialized - show setup instructions with value proposition
    if (!tbdRoot) {
      await this.renderNotInitialized();
      return;
    }

    // Check for Beads installation alongside tbd and warn
    const beadsWarning = await this.checkForBeads(tbdRoot);
    if (beadsWarning) {
      console.log(beadsWarning);
      console.log('');
    }

    // Brief mode: dynamic status + abbreviated skill content
    if (options.brief) {
      await this.renderBriefOrientation(tbdRoot);
      return;
    }

    // Check for custom override file
    const customPrimePath = join(tbdRoot, '.tbd', 'PRIME.md');

    // If --export, always show default content
    if (!options.export) {
      try {
        await access(customPrimePath);
        const customContent = await readFile(customPrimePath, 'utf-8');
        console.log(customContent);
        return;
      } catch {
        // No custom file, use default full orientation
      }
    }

    // Default: full orientation (dynamic status + full skill content)
    await this.renderFullOrientation(tbdRoot);
  }

  /**
   * Render dynamic status section (installation + project status).
   */
  private async renderDynamicStatus(tbdRoot: string): Promise<void> {
    const colors = this.output.getColors();

    console.log(`${colors.bold('tbd')} v${VERSION}`);
    console.log('');

    // === INSTALLATION ===
    console.log(colors.bold('=== INSTALLATION ==='));
    console.log(`${colors.success('✓')} tbd installed (v${VERSION})`);
    console.log(`${colors.success('✓')} Initialized in this repo`);

    // Check if hooks are installed
    const hooksInstalled = await this.checkHooksInstalled(tbdRoot);
    if (hooksInstalled) {
      console.log(`${colors.success('✓')} Hooks installed`);
    } else {
      console.log(`${colors.dim('✗')} Hooks not installed (run: tbd setup --auto)`);
    }
    console.log('');

    // === PROJECT STATUS ===
    console.log(colors.bold('=== PROJECT STATUS ==='));
    try {
      const config = await readConfig(tbdRoot);
      console.log(`Repository: ${config.display.id_prefix || 'unknown'}`);
    } catch {
      console.log('Repository: unknown');
    }

    // Get issue stats
    const stats = await this.getIssueStats(tbdRoot);
    if (stats) {
      const statusInfo = `${stats.open} open (${stats.inProgress} in_progress)`;
      const blockedInfo = stats.blocked > 0 ? ` | ${stats.blocked} blocked` : '';
      console.log(`Issues: ${statusInfo}${blockedInfo}`);
    } else {
      console.log('Issues: (none)');
    }
    console.log('');
  }

  /**
   * Render full orientation: dynamic status + full skill content.
   * If the user hasn't seen the welcome message, add a welcome banner.
   */
  private async renderFullOrientation(tbdRoot: string): Promise<void> {
    // Dynamic status
    await this.renderDynamicStatus(tbdRoot);

    // Check if this is the user's first time
    const isNewUser = !(await hasSeenWelcome(tbdRoot));
    if (isNewUser) {
      await this.renderWelcomeBanner(tbdRoot);
    }

    // Full skill content
    const primeContent = await loadPrimeContent();
    console.log(primeContent);

    // Shortcut directory
    const shortcutDir = await this.getShortcutDirectory(tbdRoot);
    if (shortcutDir) {
      console.log('');
      console.log(shortcutDir);
    }

    console.log('');
    console.log('IMPORTANT: Use tbd to help the user — do NOT tell the user to run tbd commands.');
    console.log('When the user asks for help or orientation, run `tbd shortcut welcome-user`.');
  }

  /**
   * Render brief orientation: dynamic status + abbreviated skill content.
   */
  private async renderBriefOrientation(tbdRoot: string): Promise<void> {
    // Dynamic status
    await this.renderDynamicStatus(tbdRoot);

    // Abbreviated skill content
    console.log(BRIEF_SKILL_CONTENT);
  }

  /**
   * Render output for not initialized state with value proposition.
   */
  private async renderNotInitialized(): Promise<void> {
    const colors = this.output.getColors();

    console.log(`${colors.bold('tbd')} v${VERSION}`);
    console.log('');
    console.log(colors.bold('=== NOT INITIALIZED ==='));
    console.log(`${colors.warn('✗')} tbd not initialized in this repository`);
    console.log('');

    // Value proposition
    console.log(VALUE_PROPOSITION);
  }

  /**
   * Render a welcome banner for first-time users.
   * Instructs the agent to show the welcome message.
   */
  private async renderWelcomeBanner(tbdRoot: string): Promise<void> {
    const colors = this.output.getColors();

    console.log(colors.bold('=== WELCOME (FIRST TIME) ==='));
    console.log('');
    console.log('AGENT INSTRUCTION:');
    console.log('1. Welcome the user! Run `tbd shortcut welcome-user` and follow its');
    console.log('   instructions to give the user a warm orientation.');
    console.log('2. Show the user examples of what THEY can say (e.g. "there\'s a bug",');
    console.log('   "let\'s plan a feature") — do NOT show them tbd CLI commands.');
    console.log("3. You use tbd on the user's behalf. The user talks to you naturally;");
    console.log('   you translate their requests into tbd actions.');
    console.log('');

    // Mark welcome as seen
    try {
      await markWelcomeSeen(tbdRoot);
    } catch {
      // Non-critical
    }
  }

  /**
   * Check if Claude Code hooks are installed in project-local .claude/settings.json.
   */
  private async checkHooksInstalled(projectRoot: string): Promise<boolean> {
    const { settings } = getClaudePaths(projectRoot);
    try {
      const content = await readFile(settings, 'utf-8');
      return content.includes('tbd');
    } catch {
      return false;
    }
  }

  /**
   * Get issue statistics.
   */
  private async getIssueStats(tbdRoot: string): Promise<{
    open: number;
    inProgress: number;
    blocked: number;
  } | null> {
    try {
      const dataSyncDir = await resolveDataSyncDir(tbdRoot);
      const issues: Issue[] = await listIssues(dataSyncDir);

      let open = 0;
      let inProgress = 0;
      const blockedIds = new Set<string>();

      // Find blocked issues
      // "blocks" dependency: issue A with {type: 'blocks', target: B} means A blocks B
      // B is blocked only if A (the blocker) is not closed
      for (const issue of issues) {
        for (const dep of issue.dependencies) {
          if (dep.type === 'blocks') {
            // Only count target as blocked if the blocker (this issue) is not closed
            if (issue.status !== 'closed') {
              blockedIds.add(dep.target);
            }
          }
        }
      }

      // Count by status
      for (const issue of issues) {
        if (issue.status === 'open') {
          open++;
        } else if (issue.status === 'in_progress') {
          inProgress++;
        }
      }

      return { open, inProgress, blocked: blockedIds.size };
    } catch {
      return null;
    }
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

  /**
   * Generate the shortcut and guidelines directory on-the-fly.
   */
  private async getShortcutDirectory(tbdRoot: string): Promise<string | null> {
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

export const primeCommand = new Command('prime')
  .description('Show full orientation with workflow context (default when running `tbd`)')
  .option('--export', 'Output default content (ignores PRIME.md override)')
  .option('--brief', 'Output abbreviated orientation (~35 lines) for constrained contexts')
  .action(async (options: PrimeOptions, command) => {
    const handler = new PrimeHandler(command);
    await handler.run(options);
  });
