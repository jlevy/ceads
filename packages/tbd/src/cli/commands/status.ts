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

import { VERSION } from '../lib/version.js';
import { BaseCommand } from '../lib/base-command.js';
import { ICONS } from '../lib/output.js';
import {
  renderRepositorySection,
  renderConfigSection,
  renderIntegrationsSection,
  renderBeadsWarning,
  renderWorktreeStatus,
  renderFooter,
  type IntegrationCheck,
} from '../lib/sections.js';
import { readConfig, findTbdRoot } from '../../file/config.js';
import { WORKTREE_DIR } from '../../lib/paths.js';
import {
  getClaudePaths,
  getAgentsMdPath,
  CLAUDE_SETTINGS_DISPLAY,
  AGENTS_MD_DISPLAY,
} from '../../lib/integration-paths.js';
import {
  git,
  getCurrentBranch,
  checkWorktreeHealth,
  checkGitVersion,
  findGitRoot,
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

    // Find git root for checking integrations (.claude/, .beads/ are at git root)
    const gitRoot = await findGitRoot(cwd);

    // Use tbdRoot if available, otherwise gitRoot, otherwise cwd
    // .tbd/, .claude/, .beads/ are all at the project root (adjacent to .git/)
    const projectRoot = tbdRoot ?? gitRoot ?? cwd;

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
        claude_code_path: CLAUDE_SETTINGS_DISPLAY,
        codex: false,
        codex_path: AGENTS_MD_DISPLAY,
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

    // Check for beads (at project root, not cwd)
    const beadsInfo = await this.checkBeads(projectRoot);
    statusData.beads_detected = beadsInfo.detected;
    statusData.beads_issue_count = beadsInfo.issueCount;

    // Check integrations at project root (not cwd)
    statusData.integrations = await this.checkIntegrations(projectRoot);

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

  private async checkBeads(
    projectRoot: string,
  ): Promise<{ detected: boolean; issueCount: number | null }> {
    const beadsDir = join(projectRoot, '.beads');
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

  private async checkIntegrations(projectRoot: string): Promise<StatusData['integrations']> {
    // All integrations use project-local paths (relative to git/project root)
    const claudePaths = getClaudePaths(projectRoot);
    const agentsPath = getAgentsMdPath(projectRoot);

    const result: StatusData['integrations'] = {
      claude_code: false,
      claude_code_path: CLAUDE_SETTINGS_DISPLAY,
      codex: false,
      codex_path: AGENTS_MD_DISPLAY,
    };

    // Check Claude Code hooks in project-local settings
    try {
      await access(claudePaths.settings);
      const content = await readFile(claudePaths.settings, 'utf-8');
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
      // Pre-init output - unique to status, not shared with doctor
      this.renderPreInitText(data, colors);
      return;
    }

    // Post-init output - uses shared section renderers
    // REPOSITORY section (shared with doctor)
    renderRepositorySection(
      {
        version: data.tbd_version,
        workingDirectory: data.working_directory,
        initialized: data.initialized,
        gitRepository: data.git_repository,
        gitBranch: data.git_branch,
        gitVersion: data.git_version,
        gitVersionSupported: data.git_version_supported,
      },
      colors,
    );

    // Beads coexistence warning
    if (data.beads_detected) {
      renderBeadsWarning(colors);
    }

    // CONFIG section (shared with doctor)
    renderConfigSection(
      {
        syncBranch: data.sync_branch,
        remote: data.remote,
        displayPrefix: data.display_prefix,
      },
      colors,
    );

    // INTEGRATIONS section (shared with doctor)
    const integrationChecks: IntegrationCheck[] = [
      {
        name: 'Claude Code hooks',
        installed: data.integrations.claude_code,
        path: data.integrations.claude_code_path,
      },
      {
        name: 'Codex AGENTS.md',
        installed: data.integrations.codex,
        path: data.integrations.codex_path,
      },
    ];
    const hasMissingIntegrations = renderIntegrationsSection(integrationChecks, colors);

    if (hasMissingIntegrations) {
      console.log('');
      console.log(`Run ${colors.bold('tbd setup auto')} to configure detected agents`);
    }

    // Worktree health
    if (data.worktree_healthy !== null && data.worktree_path) {
      renderWorktreeStatus(data.worktree_path, data.worktree_healthy, colors);
    }

    // Footer (shared format)
    renderFooter(
      [
        { command: 'tbd stats', description: 'issue statistics' },
        { command: 'tbd doctor', description: 'health checks' },
      ],
      colors,
    );
  }

  /**
   * Render pre-init text (unique to status command).
   * This is not shared with doctor since doctor requires initialization.
   */
  private renderPreInitText(
    data: StatusData,
    colors: ReturnType<typeof this.output.getColors>,
  ): void {
    console.log(`${colors.warn('Not a tbd repository.')}`);
    console.log('');
    console.log('Detected:');

    // Git status
    if (data.git_repository) {
      const branchInfo = data.git_branch ? ` (${data.git_branch} branch)` : '';
      console.log(`  ${colors.success(ICONS.SUCCESS)} Git repository${branchInfo}`);
      // Show git version
      if (data.git_version) {
        const versionStatus = data.git_version_supported
          ? colors.success(ICONS.SUCCESS)
          : colors.warn(ICONS.WARN);
        const versionNote = data.git_version_supported
          ? ''
          : ` ${colors.dim(`(requires ${MIN_GIT_VERSION}+)`)}`;
        console.log(`  ${versionStatus} Git ${data.git_version}${versionNote}`);
      }
    } else {
      console.log(`  ${colors.error(ICONS.ERROR)} Git repository not found`);
    }

    // Beads status
    if (data.beads_detected) {
      const countInfo =
        data.beads_issue_count !== null ? ` (.beads/ with ${data.beads_issue_count} issues)` : '';
      console.log(`  ${colors.success(ICONS.SUCCESS)} Beads repository${countInfo}`);
    } else {
      console.log(`  ${colors.dim(ICONS.ERROR)} Beads not detected`);
    }

    // tbd status
    console.log(`  ${colors.error(ICONS.ERROR)} tbd not initialized`);

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
  }
}

export const statusCommand = new Command('status')
  .description('Show repository status and orientation')
  .action(async (_options, command) => {
    const handler = new StatusHandler(command);
    await handler.run();
  });
