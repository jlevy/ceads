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
import { isInitialized, readConfig } from '../../file/config.js';
import { stripFrontmatter } from '../../utils/markdown-utils.js';
import { VERSION } from '../lib/version.js';
import { listIssues } from '../../file/storage.js';
import { resolveDataSyncDir } from '../../lib/paths.js';
import type { Issue } from '../../lib/types.js';

interface PrimeOptions {
  export?: boolean;
  brief?: boolean;
  full?: boolean;
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

    // Not initialized - show setup instructions
    if (!(await isInitialized(cwd))) {
      this.renderNotInitialized();
      return;
    }

    // Check for Beads installation alongside tbd and warn
    const beadsWarning = await this.checkForBeads(cwd);
    if (beadsWarning) {
      console.log(beadsWarning);
      console.log('');
    }

    // --full: output full SKILL.md content (legacy behavior)
    if (options.full) {
      const primeContent = await loadPrimeContent();
      console.log(primeContent);
      return;
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
        // No custom file, use default dashboard
      }
    }

    // Default: output dashboard format
    await this.renderDashboard(cwd);
  }

  /**
   * Render the dashboard for initialized repos.
   */
  private async renderDashboard(cwd: string): Promise<void> {
    const colors = this.output.getColors();

    console.log(`${colors.bold('tbd')} v${VERSION}`);
    console.log('');

    // --- INSTALLATION ---
    console.log(colors.bold('--- INSTALLATION ---'));
    console.log(`${colors.success('✓')} tbd installed (v${VERSION})`);
    console.log(`${colors.success('✓')} Initialized in this repo`);

    // Check if hooks are installed
    const hooksInstalled = await this.checkHooksInstalled();
    if (hooksInstalled) {
      console.log(`${colors.success('✓')} Hooks installed`);
    } else {
      console.log(`${colors.dim('✗')} Hooks not installed (run: tbd setup claude)`);
    }
    console.log('');

    // --- PROJECT STATUS ---
    console.log(colors.bold('--- PROJECT STATUS ---'));
    try {
      const config = await readConfig(cwd);
      console.log(`Repository: ${config.display.id_prefix || 'unknown'}`);
    } catch {
      console.log('Repository: unknown');
    }

    // Get issue stats
    const stats = await this.getIssueStats();
    if (stats) {
      const statusInfo = `${stats.open} open (${stats.inProgress} in_progress)`;
      const blockedInfo = stats.blocked > 0 ? ` | ${stats.blocked} blocked` : '';
      console.log(`Issues: ${statusInfo}${blockedInfo}`);
    } else {
      console.log('Issues: (none)');
    }
    console.log('');

    // --- WORKFLOW RULES ---
    console.log(colors.bold('--- WORKFLOW RULES ---'));
    console.log('- Track all task work as issues using tbd');
    console.log('- Check `tbd ready` for available work');
    console.log('- Run `tbd sync` at session end');
    console.log('');

    // --- QUICK REFERENCE ---
    console.log(colors.bold('--- QUICK REFERENCE ---'));
    console.log('tbd ready              Show issues ready to work');
    console.log('tbd show <id>          View issue details');
    console.log('tbd create "title"     Create new issue');
    console.log('tbd close <id>         Mark issue complete');
    console.log('tbd sync               Sync with remote');
    console.log('');

    console.log(`For full documentation: ${colors.bold('tbd skill')}`);
    console.log(`For CLI reference: ${colors.bold('tbd --help')}`);
  }

  /**
   * Render output for not initialized state.
   */
  private renderNotInitialized(): void {
    const colors = this.output.getColors();

    console.log(`${colors.bold('tbd')} v${VERSION}`);
    console.log('');
    console.log(colors.bold('--- PROJECT NOT INITIALIZED ---'));
    console.log(`${colors.warn('✗')} Not initialized in this repository`);
    console.log('');
    console.log('To set up tbd in this project:');
    console.log('');
    console.log('  tbd setup --auto              # Non-interactive (for agents)');
    console.log('  tbd setup --interactive       # Interactive (for humans)');
    console.log('');
    console.log("After setup, run 'tbd' again to see project status.");
    console.log('');
    console.log(`For CLI reference: ${colors.bold('tbd --help')}`);
  }

  /**
   * Check if Claude Code hooks are installed.
   */
  private async checkHooksInstalled(): Promise<boolean> {
    const { homedir } = await import('node:os');
    const settingsPath = join(homedir(), '.claude', 'settings.json');
    try {
      const content = await readFile(settingsPath, 'utf-8');
      return content.includes('tbd');
    } catch {
      return false;
    }
  }

  /**
   * Get issue statistics.
   */
  private async getIssueStats(): Promise<{
    open: number;
    inProgress: number;
    blocked: number;
  } | null> {
    try {
      const dataSyncDir = await resolveDataSyncDir();
      const issues: Issue[] = await listIssues(dataSyncDir);

      let open = 0;
      let inProgress = 0;
      const blockedIds = new Set<string>();

      // Find blocked issues
      for (const issue of issues) {
        for (const dep of issue.dependencies) {
          if (dep.type === 'blocks') {
            const blockedIssue = issues.find((i) => i.id === dep.target);
            if (blockedIssue && blockedIssue.status !== 'closed') {
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
}

export const primeCommand = new Command('prime')
  .description('Show dashboard and workflow context (default when running `tbd`)')
  .option('--export', 'Output default content (ignores PRIME.md override)')
  .option('--brief', 'Output minimal context (~200 tokens) for constrained contexts')
  .option('--full', 'Output full SKILL.md content (for agents needing complete docs)')
  .action(async (options: PrimeOptions, command) => {
    const handler = new PrimeHandler(command);
    await handler.run(options);
  });
