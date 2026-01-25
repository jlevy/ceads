/**
 * `tbd status` - Show repository status and orientation.
 *
 * This is the "orientation" command—like `git status`, it works regardless of
 * initialization state and helps users understand where they are.
 *
 * Unlike Beads where `bd status` is just an alias for `bd stats`, `tbd status`
 * is a distinct command that provides system orientation, not issue statistics.
 *
 * See: tbd-design.md §4.9 Status
 */

import { Command } from 'commander';
import { access, readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { homedir } from 'node:os';

import { VERSION } from '../lib/version.js';
import { BaseCommand } from '../lib/base-command.js';
import { formatHeading } from '../lib/output.js';
import { readConfig, findTbdRoot } from '../../file/config.js';
import { WORKTREE_DIR } from '../../lib/paths.js';
import {
  git,
  getCurrentBranch,
  checkWorktreeHealth,
  checkGitVersion,
  MIN_GIT_VERSION,
} from '../../file/git.js';

interface StatusData {
  initialized: boolean;
  tbd_version: string;
  working_directory: string;

  // Git info (always available)
  git_repository: boolean;
  git_branch: string | null;
  git_version: string | null;
  git_version_supported: boolean;

  // Beads detection (pre-init only)
  beads_detected: boolean;
  beads_issue_count: number | null;

  // Post-init only
  sync_branch: string | null;
  remote: string | null;
  display_prefix: string | null;
  worktree_path: string | null;
  worktree_healthy: boolean | null;

  // Integrations
  integrations: {
    claude_code: boolean;
    claude_code_path: string;
    codex: boolean;
    codex_path: string;
  };
}

class StatusHandler extends BaseCommand {
  async run(): Promise<void> {
    const cwd = process.cwd();

    // Find tbd root (may be in parent directory)
    const tbdRoot = await findTbdRoot(cwd);

    const statusData: StatusData = {
      initialized: tbdRoot !== null,
      tbd_version: VERSION,
      working_directory: cwd,
      git_repository: false,
      git_branch: null,
      git_version: null,
      git_version_supported: false,
      beads_detected: false,
      beads_issue_count: null,
      sync_branch: null,
      remote: null,
      display_prefix: null,
      worktree_path: null,
      worktree_healthy: null,
      integrations: {
        claude_code: false,
        claude_code_path: '~/.claude/settings.json',
        codex: false,
        codex_path: './AGENTS.md',
      },
    };

    // Check git repository
    const gitInfo = await this.checkGitRepo();
    statusData.git_repository = gitInfo.isRepo;
    statusData.git_branch = gitInfo.branch;

    // Check git version (only if git is available)
    if (gitInfo.isRepo) {
      try {
        const { version, supported } = await checkGitVersion();
        statusData.git_version = `${version.major}.${version.minor}.${version.patch}`;
        statusData.git_version_supported = supported;
      } catch {
        // Git version check failed - leave as null/false
      }
    }

    // Check for beads
    const beadsInfo = await this.checkBeads(cwd);
    statusData.beads_detected = beadsInfo.detected;
    statusData.beads_issue_count = beadsInfo.issueCount;

    // Check integrations (always show)
    statusData.integrations = await this.checkIntegrations(cwd);

    if (statusData.initialized && tbdRoot) {
      // Load config and issue info
      await this.loadPostInitInfo(tbdRoot, statusData);
    }

    this.output.data(statusData, () => {
      this.renderText(statusData);
    });
  }

  private async checkGitRepo(): Promise<{ isRepo: boolean; branch: string | null }> {
    try {
      const branch = await getCurrentBranch();
      return { isRepo: true, branch };
    } catch {
      // getCurrentBranch may fail in repos with no commits
      // Fall back to checking if we're in a git repo using git rev-parse --git-dir
      try {
        await git('rev-parse', '--git-dir');
        // We're in a git repo but can't get branch (maybe no commits)
        return { isRepo: true, branch: null };
      } catch {
        return { isRepo: false, branch: null };
      }
    }
  }

  private async checkBeads(cwd: string): Promise<{ detected: boolean; issueCount: number | null }> {
    const beadsDir = join(cwd, '.beads');
    try {
      await access(beadsDir);
      // Count issues in beads
      const issuesFile = join(beadsDir, 'issues.jsonl');
      try {
        const content = await readFile(issuesFile, 'utf-8');
        const lines = content
          .trim()
          .split('\n')
          .filter((l) => l.trim());
        return { detected: true, issueCount: lines.length };
      } catch {
        return { detected: true, issueCount: null };
      }
    } catch {
      return { detected: false, issueCount: null };
    }
  }

  private async checkIntegrations(cwd: string): Promise<StatusData['integrations']> {
    const claudeSettingsPath = join(homedir(), '.claude', 'settings.json');
    const agentsPath = join(cwd, 'AGENTS.md');

    const result: StatusData['integrations'] = {
      claude_code: false,
      claude_code_path: claudeSettingsPath.replace(homedir(), '~'),
      codex: false,
      codex_path: './AGENTS.md',
    };

    // Check Claude Code hooks
    try {
      await access(claudeSettingsPath);
      const content = await readFile(claudeSettingsPath, 'utf-8');
      const settings = JSON.parse(content) as Record<string, unknown>;
      const hooks = settings.hooks as Record<string, unknown> | undefined;
      if (hooks) {
        const sessionStart = hooks.SessionStart as { hooks?: { command?: string }[] }[];
        result.claude_code =
          sessionStart?.some((h) => h.hooks?.some((hook) => hook.command?.includes('tbd'))) ??
          false;
      }
    } catch {
      // Not installed
    }

    // Check Codex AGENTS.md (also used by Cursor since v1.6)
    try {
      await access(agentsPath);
      const content = await readFile(agentsPath, 'utf-8');
      result.codex = content.includes('BEGIN TBD INTEGRATION');
    } catch {
      // Not installed
    }

    return result;
  }

  private async loadPostInitInfo(cwd: string, data: StatusData): Promise<void> {
    // Load config
    try {
      const config = await readConfig(cwd);
      data.sync_branch = config.sync.branch;
      data.remote = config.sync.remote;
      data.display_prefix = config.display.id_prefix;
    } catch {
      // Config read failed
    }

    // Check worktree health
    const worktreePath = join(cwd, WORKTREE_DIR);
    const worktreeHealth = await checkWorktreeHealth(cwd);
    data.worktree_path = worktreePath;
    data.worktree_healthy = worktreeHealth.valid;
  }

  private renderText(data: StatusData): void {
    const colors = this.output.getColors();

    if (!data.initialized) {
      // Pre-init output
      console.log(`${colors.warn('Not a tbd repository.')}`);
      console.log('');
      console.log('Detected:');

      // Git status
      if (data.git_repository) {
        const branchInfo = data.git_branch ? ` (${data.git_branch} branch)` : '';
        console.log(`  ${colors.success('✓')} Git repository${branchInfo}`);
        // Show git version
        if (data.git_version) {
          const versionStatus = data.git_version_supported ? colors.success('✓') : colors.warn('⚠');
          const versionNote = data.git_version_supported
            ? ''
            : ` ${colors.dim(`(requires ${MIN_GIT_VERSION}+)`)}`;
          console.log(`  ${versionStatus} Git ${data.git_version}${versionNote}`);
        }
      } else {
        console.log(`  ${colors.error('✗')} Git repository not found`);
      }

      // Beads status
      if (data.beads_detected) {
        const countInfo =
          data.beads_issue_count !== null ? ` (.beads/ with ${data.beads_issue_count} issues)` : '';
        console.log(`  ${colors.success('✓')} Beads repository${countInfo}`);
      } else {
        console.log(`  ${colors.dim('✗')} Beads not detected`);
      }

      // tbd status
      console.log(`  ${colors.error('✗')} tbd not initialized`);

      console.log('');
      console.log('To get started:');
      if (data.beads_detected) {
        console.log(
          `  ${colors.bold('tbd setup --auto')}          # Migrate from Beads (recommended)`,
        );
      } else {
        console.log(
          `  ${colors.bold('tbd setup --auto --prefix=<name>')}   # Full setup with prefix`,
        );
      }
      console.log(`  ${colors.bold('tbd init --prefix=X')}       # Surgical init only`);
      return;
    }

    // Post-init output
    console.log(`${colors.bold('tbd')} v${data.tbd_version}`);
    console.log('');
    console.log(`Repository: ${data.working_directory}`);
    console.log(`  ${colors.success('✓')} Initialized (.tbd/)`);

    if (data.git_repository) {
      const branchInfo = data.git_branch ? ` (${data.git_branch})` : '';
      console.log(`  ${colors.success('✓')} Git repository${branchInfo}`);
      // Show git version
      if (data.git_version) {
        const versionStatus = data.git_version_supported ? colors.success('✓') : colors.warn('⚠');
        const versionNote = data.git_version_supported
          ? ''
          : ` ${colors.dim(`(requires ${MIN_GIT_VERSION}+)`)}`;
        console.log(`  ${versionStatus} Git ${data.git_version}${versionNote}`);
      }
    }

    // Beads coexistence warning
    if (data.beads_detected) {
      console.log('');
      console.log(`${colors.warn('⚠')}  Beads directory detected alongside tbd`);
      console.log(`   This may cause confusion for AI agents.`);
      console.log(`   Run ${colors.bold('tbd setup beads --disable')} for migration options`);
    }

    // Config info
    if (data.sync_branch || data.remote || data.display_prefix) {
      console.log('');
      if (data.sync_branch) {
        console.log(`${colors.dim('Sync branch:')} ${data.sync_branch}`);
      }
      if (data.remote) {
        console.log(`${colors.dim('Remote:')} ${data.remote}`);
      }
      if (data.display_prefix) {
        console.log(`${colors.dim('ID prefix:')} ${data.display_prefix}-`);
      }
    }

    // Integrations
    console.log('');
    console.log(colors.bold(formatHeading('Integrations')));

    // Track if any integrations are missing
    let hasMissingIntegrations = false;

    if (data.integrations.claude_code) {
      console.log(
        `  ${colors.success('✓')} Claude Code hooks ${colors.dim(`(${data.integrations.claude_code_path})`)}`,
      );
    } else {
      console.log(
        `  ${colors.dim('✗')} Claude Code hooks ${colors.dim(`(${data.integrations.claude_code_path})`)}`,
      );
      hasMissingIntegrations = true;
    }
    if (data.integrations.codex) {
      console.log(
        `  ${colors.success('✓')} Codex AGENTS.md ${colors.dim(`(${data.integrations.codex_path})`)}`,
      );
    } else {
      console.log(
        `  ${colors.dim('✗')} Codex AGENTS.md ${colors.dim(`(${data.integrations.codex_path})`)}`,
      );
      hasMissingIntegrations = true;
    }

    if (hasMissingIntegrations) {
      console.log('');
      console.log(`Run ${colors.bold('tbd setup auto')} to configure detected agents`);
    }

    // Worktree health
    if (data.worktree_healthy !== null) {
      console.log('');
      if (data.worktree_healthy) {
        console.log(`${colors.dim('Worktree:')} ${data.worktree_path} (healthy)`);
      } else {
        console.log(
          `${colors.warn('Worktree:')} ${data.worktree_path} (${colors.error('unhealthy')})`,
        );
        console.log(`  Run: tbd doctor --fix`);
      }
    }

    console.log('');
    console.log(
      `Use ${colors.bold("'tbd stats'")} for issue statistics, ${colors.bold("'tbd doctor'")} for health checks.`,
    );
  }
}

export const statusCommand = new Command('status')
  .description('Show repository status and orientation')
  .action(async (_options, command) => {
    const handler = new StatusHandler(command);
    await handler.run();
  });
