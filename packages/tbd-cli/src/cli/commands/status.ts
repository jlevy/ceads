/**
 * `tbd status` - Show repository status and orientation.
 *
 * This is the "orientation" command—like `git status`, it works regardless of
 * initialization state and helps users understand where they are.
 *
 * Unlike Beads where `bd status` is just an alias for `bd stats`, `tbd status`
 * is a distinct command that provides system orientation, not issue statistics.
 *
 * See: tbd-design-v3.md §4.9 Status
 */

import { Command } from 'commander';
import { access, readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { homedir } from 'node:os';

import { VERSION } from '../lib/version.js';
import { BaseCommand } from '../lib/baseCommand.js';
import { readConfig } from '../../file/config.js';
import { listIssues } from '../../file/storage.js';
import { resolveDataSyncDir, TBD_DIR, WORKTREE_DIR } from '../../lib/paths.js';
import { git, getCurrentBranch, checkWorktreeHealth } from '../../file/git.js';

interface StatusData {
  initialized: boolean;
  tbd_version: string;
  working_directory: string;

  // Git info (always available)
  git_repository: boolean;
  git_branch: string | null;

  // Beads detection (pre-init only)
  beads_detected: boolean;
  beads_issue_count: number | null;

  // Post-init only
  sync_branch: string | null;
  remote: string | null;
  display_prefix: string | null;
  worktree_path: string | null;
  worktree_healthy: boolean | null;

  // Issue summary (post-init only)
  issues: {
    total: number;
    open: number;
    in_progress: number;
    blocked: number;
    ready: number;
  } | null;

  // Integrations
  integrations: {
    claude_code: boolean;
    cursor: boolean;
    codex: boolean;
  };
}

class StatusHandler extends BaseCommand {
  async run(): Promise<void> {
    const cwd = process.cwd();
    const statusData: StatusData = {
      initialized: false,
      tbd_version: VERSION,
      working_directory: cwd,
      git_repository: false,
      git_branch: null,
      beads_detected: false,
      beads_issue_count: null,
      sync_branch: null,
      remote: null,
      display_prefix: null,
      worktree_path: null,
      worktree_healthy: null,
      issues: null,
      integrations: {
        claude_code: false,
        cursor: false,
        codex: false,
      },
    };

    // Check if initialized
    statusData.initialized = await this.checkInitialized(cwd);

    // Check git repository
    const gitInfo = await this.checkGitRepo();
    statusData.git_repository = gitInfo.isRepo;
    statusData.git_branch = gitInfo.branch;

    // Check for beads
    const beadsInfo = await this.checkBeads(cwd);
    statusData.beads_detected = beadsInfo.detected;
    statusData.beads_issue_count = beadsInfo.issueCount;

    // Check integrations (always show)
    statusData.integrations = await this.checkIntegrations(cwd);

    if (statusData.initialized) {
      // Load config and issue info
      await this.loadPostInitInfo(cwd, statusData);
    }

    this.output.data(statusData, () => {
      this.renderText(statusData);
    });
  }

  private async checkInitialized(cwd: string): Promise<boolean> {
    try {
      await access(join(cwd, TBD_DIR));
      return true;
    } catch {
      return false;
    }
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

  private async checkIntegrations(
    cwd: string,
  ): Promise<{ claude_code: boolean; cursor: boolean; codex: boolean }> {
    const result = { claude_code: false, cursor: false, codex: false };

    // Check Claude Code hooks
    const claudeSettingsPath = join(homedir(), '.claude', 'settings.json');
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

    // Check Cursor rules
    const cursorRulesPath = join(cwd, '.cursor', 'rules', 'tbd.mdc');
    try {
      await access(cursorRulesPath);
      result.cursor = true;
    } catch {
      // Not installed
    }

    // Check Codex AGENTS.md
    const agentsPath = join(cwd, 'AGENTS.md');
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

    // Load issue statistics
    try {
      const dataSyncDir = await resolveDataSyncDir(cwd);
      const issues = await listIssues(dataSyncDir);

      const stats = {
        total: issues.length,
        open: 0,
        in_progress: 0,
        blocked: 0,
        ready: 0,
      };

      // Build set of blocked issue IDs
      const blockedIds = new Set<string>();
      for (const issue of issues) {
        for (const dep of issue.dependencies) {
          if (dep.type === 'blocks') {
            // Find the issue that is blocked
            const blockedIssue = issues.find((i) => i.id === dep.target);
            if (blockedIssue && blockedIssue.status !== 'closed') {
              blockedIds.add(dep.target);
            }
          }
        }
      }

      for (const issue of issues) {
        if (issue.status === 'open') {
          stats.open++;
          // Check if ready (open and not blocked)
          if (!blockedIds.has(issue.id)) {
            stats.ready++;
          }
        } else if (issue.status === 'in_progress') {
          stats.in_progress++;
        } else if (issue.status === 'blocked') {
          stats.blocked++;
        }
      }

      data.issues = stats;
    } catch {
      // Issue load failed
    }
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
          `  ${colors.bold('tbd import --from-beads')}   # Migrate from Beads (recommended)`,
        );
      }
      console.log(`  ${colors.bold('tbd init')}                  # Start fresh`);
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

    // Issues summary
    if (data.issues) {
      console.log('');
      console.log(colors.bold('Issues:'));
      console.log(`  Ready:       ${data.issues.ready}`);
      console.log(`  In progress: ${data.issues.in_progress}`);
      console.log(`  Open:        ${data.issues.open}`);
      console.log(`  Total:       ${data.issues.total}`);
    }

    // Integrations
    console.log('');
    console.log(colors.bold('Integrations:'));
    if (data.integrations.claude_code) {
      console.log(`  ${colors.success('✓')} Claude Code hooks installed`);
    } else {
      console.log(`  ${colors.dim('✗')} Claude Code hooks (run: tbd setup claude)`);
    }
    if (data.integrations.cursor) {
      console.log(`  ${colors.success('✓')} Cursor rules installed`);
    } else {
      console.log(`  ${colors.dim('✗')} Cursor rules (run: tbd setup cursor)`);
    }
    if (data.integrations.codex) {
      console.log(`  ${colors.success('✓')} Codex AGENTS.md installed`);
    } else {
      console.log(`  ${colors.dim('✗')} Codex AGENTS.md (run: tbd setup codex)`);
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
    console.log(`Use ${colors.bold("'tbd stats'")} for detailed issue statistics.`);
  }
}

export const statusCommand = new Command('status')
  .description('Show repository status and orientation')
  .action(async (_options, command) => {
    const handler = new StatusHandler(command);
    await handler.run();
  });
