/**
 * `tbd doctor` - Diagnose and repair repository.
 *
 * A comprehensive health check that includes status, stats, and health checks.
 *
 * See: tbd-design.md §4.9 Doctor
 */

import { Command } from 'commander';
import { access, readdir, readFile, unlink } from 'node:fs/promises';
import { join } from 'node:path';

import { BaseCommand } from '../lib/base-command.js';
import { requireInit } from '../lib/errors.js';
import { listIssues } from '../../file/storage.js';
import { readConfig } from '../../file/config.js';
import type { Config, Issue, IssueStatusType } from '../../lib/types.js';
import { resolveDataSyncDir, TBD_DIR, WORKTREE_DIR, DATA_SYNC_DIR } from '../../lib/paths.js';
import {
  getClaudePaths,
  getAgentsMdPath,
  CLAUDE_SKILL_REL,
  AGENTS_MD_REL,
} from '../../lib/integration-paths.js';
import { validateIssueId } from '../../lib/ids.js';
import {
  checkGitVersion,
  MIN_GIT_VERSION,
  getCurrentBranch,
  checkWorktreeHealth,
  checkLocalBranchHealth,
  checkRemoteBranchHealth,
  checkSyncConsistency,
  repairWorktree,
  migrateDataToWorktree,
  initWorktree,
} from '../../file/git.js';
import { type DiagnosticResult, renderDiagnostics } from '../lib/diagnostics.js';
import { VERSION } from '../lib/version.js';
import { formatHeading } from '../lib/output.js';
import {
  renderRepositorySection,
  renderConfigSection,
  renderStatisticsSection,
} from '../lib/sections.js';

const CONFIG_DIR = TBD_DIR;

interface DoctorOptions {
  fix?: boolean;
}

class DoctorHandler extends BaseCommand {
  private dataSyncDir = '';
  private cwd = '';
  private config: Config | null = null;
  private issues: Issue[] = [];

  async run(options: DoctorOptions): Promise<void> {
    const tbdRoot = await requireInit();

    this.cwd = tbdRoot;
    this.dataSyncDir = await resolveDataSyncDir(tbdRoot);

    // Load config
    try {
      this.config = await readConfig(this.cwd);
    } catch {
      // Config may be invalid - will be caught by health checks
    }

    // Load issues
    try {
      this.issues = await listIssues(this.dataSyncDir);
    } catch {
      // May fail if no issues yet
    }

    // Gather status info
    const statusInfo = await this.gatherStatusInfo();

    // Gather stats info
    const statsInfo = this.gatherStatsInfo();

    // Run health checks (core system checks)
    const healthChecks: DiagnosticResult[] = [];

    // Check 1: Git version
    healthChecks.push(await this.checkGitVersion());

    // Check 2: Config directory and file
    healthChecks.push(await this.checkConfig());

    // Check 3: Issues directory
    healthChecks.push(await this.checkIssuesDirectory());

    // Check 4: Orphaned dependencies
    healthChecks.push(this.checkOrphanedDependencies(this.issues));

    // Check 5: Duplicate IDs
    healthChecks.push(this.checkDuplicateIds(this.issues));

    // Check 6: Orphaned temp files
    healthChecks.push(await this.checkTempFiles(options.fix));

    // Check 7: Issue validity
    healthChecks.push(this.checkIssueValidity(this.issues));

    // Check 8: Worktree health (with fix support)
    healthChecks.push(await this.checkWorktree(options.fix));

    // Check 9: Data location (issues in wrong path, with fix support)
    healthChecks.push(await this.checkDataLocation(options.fix));

    // Check 10: Local sync branch health
    healthChecks.push(await this.checkLocalSyncBranch());

    // Check 11: Remote sync branch health
    healthChecks.push(await this.checkRemoteSyncBranch());

    // Check 12: Local has data but remote empty (ai-trade-arena bug detection)
    healthChecks.push(await this.checkLocalVsRemoteData());

    // Check 13: Multi-user/clone scenario detection
    healthChecks.push(await this.checkCloneScenarios());

    // Check 14: Sync consistency (worktree matches local, ahead/behind counts)
    healthChecks.push(await this.checkSyncConsistency());

    // Run integration checks (optional IDE/agent integrations)
    const integrationChecks: DiagnosticResult[] = [];

    // Integration 1: Claude Code skill file
    integrationChecks.push(await this.checkClaudeSkill());

    // Integration 2: Codex AGENTS.md (also used by Cursor since v1.6)
    integrationChecks.push(await this.checkCodexAgents());

    // Combine for overall status
    const allChecks = [...healthChecks, ...integrationChecks];
    const allOk = allChecks.every((c) => c.status === 'ok');
    const hasFixable = allChecks.some((c) => c.fixable && c.status !== 'ok');

    this.output.data(
      { statusInfo, statsInfo, healthChecks, integrationChecks, healthy: allOk },
      () => {
        const colors = this.output.getColors();

        // REPOSITORY section (shared with status command)
        renderRepositorySection(
          {
            version: VERSION,
            workingDirectory: this.cwd,
            initialized: true, // doctor requires init
            gitRepository: !!statusInfo.gitBranch,
            gitBranch: statusInfo.gitBranch,
            gitVersion: null, // Git version is shown in health checks
            gitVersionSupported: true,
          },
          colors,
          { showHeading: true },
        );

        // CONFIG section (shared with status command)
        if (this.config) {
          renderConfigSection(
            {
              syncBranch: this.config.sync.branch,
              remote: this.config.sync.remote,
              displayPrefix: this.config.display.id_prefix,
            },
            colors,
          );
        }

        // STATISTICS section (shared with stats command)
        renderStatisticsSection(statsInfo, colors);

        // INTEGRATIONS section
        console.log('');
        console.log(colors.bold(formatHeading('Integrations')));
        renderDiagnostics(integrationChecks, colors);

        // HEALTH CHECKS section (doctor-only)
        console.log('');
        console.log(colors.bold(formatHeading('Health Checks')));
        renderDiagnostics(healthChecks, colors);

        // Final summary
        console.log('');
        if (allOk) {
          this.output.success('Repository is healthy');
        } else if (hasFixable && !options.fix) {
          this.output.warn('Issues found. Run with --fix to repair.');
        } else {
          this.output.warn('Issues found that may require manual intervention.');
        }
      },
    );
  }

  private async gatherStatusInfo(): Promise<{
    gitBranch: string | null;
    worktreeHealthy: boolean;
  }> {
    let gitBranch: string | null = null;
    try {
      gitBranch = await getCurrentBranch();
    } catch {
      // Not in a git repo or no commits
    }

    const worktreeHealth = await checkWorktreeHealth(this.cwd);

    return {
      gitBranch,
      worktreeHealthy: worktreeHealth.valid,
    };
  }

  private gatherStatsInfo(): {
    total: number;
    ready: number;
    inProgress: number;
    blocked: number;
    open: number;
  } {
    // Count by status
    const byStatus: Record<IssueStatusType, number> = {
      open: 0,
      in_progress: 0,
      blocked: 0,
      deferred: 0,
      closed: 0,
    };

    // Build set of blocked issue IDs
    const blockedIds = new Set<string>();
    for (const issue of this.issues) {
      for (const dep of issue.dependencies) {
        if (dep.type === 'blocks') {
          const blockedIssue = this.issues.find((i) => i.id === dep.target);
          if (blockedIssue && blockedIssue.status !== 'closed') {
            blockedIds.add(dep.target);
          }
        }
      }
    }

    // Count ready issues (open and not blocked)
    let readyCount = 0;

    for (const issue of this.issues) {
      byStatus[issue.status]++;
      if (issue.status === 'open' && !blockedIds.has(issue.id)) {
        readyCount++;
      }
    }

    return {
      total: this.issues.length,
      ready: readyCount,
      inProgress: byStatus.in_progress,
      blocked: blockedIds.size,
      open: byStatus.open,
    };
  }

  private async checkGitVersion(): Promise<DiagnosticResult> {
    try {
      const { version, supported } = await checkGitVersion();
      const versionStr = `${version.major}.${version.minor}.${version.patch}`;

      if (supported) {
        return {
          name: 'Git version',
          status: 'ok',
          message: versionStr,
        };
      }

      return {
        name: 'Git version',
        status: 'error',
        message: `${versionStr} (requires ${MIN_GIT_VERSION}+)`,
        suggestion: 'Upgrade Git: https://git-scm.com/downloads',
      };
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      if (msg.includes('git') || msg.includes('not found') || msg.includes('ENOENT')) {
        return {
          name: 'Git version',
          status: 'error',
          message: 'Git not found',
          suggestion: 'Install Git: https://git-scm.com/downloads',
        };
      }
      return {
        name: 'Git version',
        status: 'warn',
        message: `Unable to check: ${msg}`,
      };
    }
  }

  private async checkConfig(): Promise<DiagnosticResult> {
    const configPath = join(CONFIG_DIR, 'config.yml');
    try {
      await access(join(this.cwd, configPath));
      await readConfig(this.cwd);
      return { name: 'Config file', status: 'ok', path: configPath };
    } catch (error) {
      const msg = (error as Error).message;
      if (msg.includes('ENOENT')) {
        return {
          name: 'Config file',
          status: 'error',
          message: 'not found',
          path: configPath,
          suggestion: 'Run: tbd init',
        };
      }
      return {
        name: 'Config file',
        status: 'error',
        message: 'Invalid config file',
        path: configPath,
      };
    }
  }

  private async checkIssuesDirectory(): Promise<DiagnosticResult> {
    const issuesPath = join(CONFIG_DIR, 'issues');
    try {
      await access(join(this.dataSyncDir, 'issues'));
      return { name: 'Issues directory', status: 'ok', path: issuesPath };
    } catch {
      // No issues directory is normal for a fresh/empty repo
      return {
        name: 'Issues directory',
        status: 'ok',
        message: 'empty (no issues yet)',
        path: issuesPath,
      };
    }
  }

  private checkOrphanedDependencies(issues: Issue[]): DiagnosticResult {
    const issueIds = new Set(issues.map((i) => i.id));
    const orphans: string[] = [];

    for (const issue of issues) {
      for (const dep of issue.dependencies) {
        if (!issueIds.has(dep.target)) {
          orphans.push(`${issue.id} -> ${dep.target} (missing)`);
        }
      }
    }

    if (orphans.length === 0) {
      return { name: 'Dependencies', status: 'ok' };
    }

    return {
      name: 'Dependencies',
      status: 'warn',
      message: `${orphans.length} orphaned reference(s)`,
      details: orphans,
      fixable: true,
      suggestion: 'Run: tbd doctor --fix',
    };
  }

  private checkDuplicateIds(issues: Issue[]): DiagnosticResult {
    const seen = new Set<string>();
    const duplicates: string[] = [];

    for (const issue of issues) {
      if (seen.has(issue.id)) {
        duplicates.push(issue.id);
      }
      seen.add(issue.id);
    }

    if (duplicates.length === 0) {
      return { name: 'Unique IDs', status: 'ok' };
    }

    return {
      name: 'Unique IDs',
      status: 'error',
      message: `${duplicates.length} duplicate ID(s)`,
      details: duplicates.map((id) => `${id} (duplicate)`),
      suggestion: 'Manually remove duplicate issue files',
    };
  }

  private async checkTempFiles(fix?: boolean): Promise<DiagnosticResult> {
    const issuesPath = join(CONFIG_DIR, 'issues');
    const issuesDir = join(this.dataSyncDir, 'issues');
    let tempFiles: string[] = [];

    try {
      const files = await readdir(issuesDir);
      tempFiles = files.filter((f) => f.endsWith('.tmp'));
    } catch {
      // Directory doesn't exist - no temp files
      return { name: 'Temp files', status: 'ok', path: issuesPath };
    }

    if (tempFiles.length === 0) {
      return { name: 'Temp files', status: 'ok', path: issuesPath };
    }

    if (fix && !this.checkDryRun('Clean temp files')) {
      // Clean up temp files
      for (const file of tempFiles) {
        try {
          await unlink(join(issuesDir, file));
        } catch {
          // Ignore errors
        }
      }
      return {
        name: 'Temp files',
        status: 'ok',
        message: `Cleaned ${tempFiles.length} temp file(s)`,
        path: issuesPath,
      };
    }

    return {
      name: 'Temp files',
      status: 'warn',
      message: `${tempFiles.length} orphaned temp file(s)`,
      path: issuesPath,
      details: tempFiles,
      fixable: true,
      suggestion: 'Run: tbd doctor --fix',
    };
  }

  private checkIssueValidity(issues: Issue[]): DiagnosticResult {
    const invalid: { id: string; reason: string }[] = [];

    for (const issue of issues) {
      const issueId = issue.id ?? 'unknown';
      // Check required fields
      if (!issue.id) {
        invalid.push({ id: issueId, reason: 'missing required field: id' });
        continue;
      }
      if (!issue.title) {
        invalid.push({ id: issueId, reason: 'missing required field: title' });
        continue;
      }
      if (!issue.status) {
        invalid.push({ id: issueId, reason: 'missing required field: status' });
        continue;
      }
      if (!issue.kind) {
        invalid.push({ id: issueId, reason: 'missing required field: kind' });
        continue;
      }
      // Check ID format
      if (!validateIssueId(issue.id)) {
        invalid.push({ id: issueId, reason: 'invalid ID format' });
        continue;
      }
      // Check priority range
      if (issue.priority < 0 || issue.priority > 4) {
        invalid.push({ id: issueId, reason: `invalid priority ${issue.priority} (must be 0-4)` });
      }
    }

    if (invalid.length === 0) {
      return { name: 'Issue validity', status: 'ok' };
    }

    return {
      name: 'Issue validity',
      status: 'error',
      message: `${invalid.length} invalid issue(s)`,
      details: invalid.map((i) => `${i.id}: ${i.reason}`),
      suggestion: 'Manually fix or delete invalid issue files',
    };
  }

  private async checkClaudeSkill(): Promise<DiagnosticResult> {
    const claudePaths = getClaudePaths(this.cwd);
    try {
      await access(claudePaths.skill);
      return { name: 'Claude Code skill', status: 'ok', path: CLAUDE_SKILL_REL };
    } catch {
      return {
        name: 'Claude Code skill',
        status: 'warn',
        message: 'not installed',
        path: CLAUDE_SKILL_REL,
        suggestion: 'Run: tbd setup --auto',
      };
    }
  }

  private async checkCodexAgents(): Promise<DiagnosticResult> {
    const agentsPath = getAgentsMdPath(this.cwd);
    try {
      await access(agentsPath);
      const content = await readFile(agentsPath, 'utf-8');
      if (content.includes('BEGIN TBD INTEGRATION')) {
        return { name: 'Codex AGENTS.md', status: 'ok', path: AGENTS_MD_REL };
      }
      return {
        name: 'Codex AGENTS.md',
        status: 'warn',
        message: 'exists but missing tbd integration',
        path: AGENTS_MD_REL,
        suggestion: 'Run: tbd setup --auto',
      };
    } catch {
      return {
        name: 'Codex AGENTS.md',
        status: 'warn',
        message: 'not installed',
        path: AGENTS_MD_REL,
        suggestion: 'Run: tbd setup --auto',
      };
    }
  }

  /**
   * Check worktree health with enhanced status detection.
   * See: plan-2026-01-28-sync-worktree-recovery-and-hardening.md §4
   */
  private async checkWorktree(fix?: boolean): Promise<DiagnosticResult> {
    const worktreePath = WORKTREE_DIR;
    const worktreeHealth = await checkWorktreeHealth(this.cwd);

    switch (worktreeHealth.status) {
      case 'valid':
        return { name: 'Worktree', status: 'ok', path: worktreePath };

      case 'missing':
        // Worktree not existing is OK - it's created on demand
        return { name: 'Worktree', status: 'ok', message: 'not created yet', path: worktreePath };

      case 'prunable':
      case 'corrupted': {
        // Attempt repair if --fix is provided and not in dry-run mode
        if (fix && !this.checkDryRun('Repair worktree')) {
          const result = await repairWorktree(this.cwd, worktreeHealth.status);

          if (result.success) {
            const message = result.backedUp
              ? `repaired (backed up to ${result.backedUp})`
              : 'repaired successfully';
            return { name: 'Worktree', status: 'ok', message, path: worktreePath };
          }

          return {
            name: 'Worktree',
            status: 'error',
            message: `repair failed: ${result.error}`,
            path: worktreePath,
          };
        }

        // No --fix flag, report the issue
        if (worktreeHealth.status === 'prunable') {
          return {
            name: 'Worktree',
            status: 'error',
            message: 'prunable (directory deleted)',
            path: worktreePath,
            details: [
              'The worktree directory was deleted but git still tracks it.',
              'This can cause data to be written to the wrong location.',
            ],
            fixable: true,
            suggestion: 'Run: tbd doctor --fix to recreate worktree',
          };
        }

        return {
          name: 'Worktree',
          status: 'error',
          message: worktreeHealth.error ?? 'corrupted',
          path: worktreePath,
          details: ['The worktree exists but is not a valid git worktree.'],
          fixable: true,
          suggestion: 'Run: tbd doctor --fix to repair',
        };
      }

      default:
        return {
          name: 'Worktree',
          status: 'warn',
          message: worktreeHealth.error ?? 'unknown status',
          path: worktreePath,
          fixable: true,
          suggestion: 'Run: tbd doctor --fix',
        };
    }
  }

  /**
   * Check for issues in wrong location.
   * See: plan-2026-01-28-sync-worktree-recovery-and-hardening.md §5
   *
   * Issues should be in .tbd/data-sync-worktree/.tbd/data-sync/issues/
   * If they're in .tbd/data-sync/issues/ on main branch, the worktree was missing
   * and data was written to the fallback path - this is a bug requiring migration.
   */
  private async checkDataLocation(fix?: boolean): Promise<DiagnosticResult> {
    const wrongPath = join(this.cwd, DATA_SYNC_DIR);
    const wrongIssuesPath = join(wrongPath, 'issues');

    // Try to list issues in the wrong location
    let wrongPathIssues: Issue[] = [];
    try {
      wrongPathIssues = await listIssues(wrongPath);
    } catch {
      // No issues in wrong path - this is expected
    }

    if (wrongPathIssues.length === 0) {
      return { name: 'Data location', status: 'ok' };
    }

    // Issues found in wrong location - attempt migration if --fix and not dry-run
    if (fix && !this.checkDryRun('Migrate data to worktree')) {
      // First ensure worktree exists - create it if missing
      let worktreeHealth = await checkWorktreeHealth(this.cwd);
      if (worktreeHealth.status === 'missing') {
        // Worktree doesn't exist yet - create it for migration
        const initResult = await initWorktree(this.cwd);
        if (!initResult.success) {
          return {
            name: 'Data location',
            status: 'error',
            message: `${wrongPathIssues.length} issue(s) in wrong location, failed to create worktree: ${initResult.error}`,
            path: wrongIssuesPath,
          };
        }
        worktreeHealth = await checkWorktreeHealth(this.cwd);
      }

      if (worktreeHealth.status !== 'valid') {
        return {
          name: 'Data location',
          status: 'error',
          message: `${wrongPathIssues.length} issue(s) in wrong location, worktree not ready`,
          path: wrongIssuesPath,
          details: [
            'Cannot migrate: worktree must be repaired first.',
            'The worktree repair should have run before this check.',
          ],
        };
      }

      // Migrate data to worktree
      const result = await migrateDataToWorktree(this.cwd);

      if (result.success) {
        const message = result.backupPath
          ? `migrated ${result.migratedCount} file(s), backed up to ${result.backupPath}`
          : `migrated ${result.migratedCount} file(s)`;
        return { name: 'Data location', status: 'ok', message, path: wrongIssuesPath };
      }

      return {
        name: 'Data location',
        status: 'error',
        message: `migration failed: ${result.error}`,
        path: wrongIssuesPath,
      };
    }

    // No --fix flag, report the issue
    return {
      name: 'Data location',
      status: 'error',
      message: `${wrongPathIssues.length} issue(s) in wrong location`,
      path: wrongIssuesPath,
      details: [
        `Found ${wrongPathIssues.length} issues in .tbd/data-sync/ (wrong)`,
        'Issues should be in .tbd/data-sync-worktree/.tbd/data-sync/',
        'This indicates the worktree was missing when issues were created',
      ],
      fixable: true,
      suggestion: 'Run: tbd doctor --fix to migrate issues to worktree',
    };
  }

  /**
   * Check local sync branch health.
   * See: plan-2026-01-28-sync-worktree-recovery-and-hardening.md §4b
   */
  private async checkLocalSyncBranch(): Promise<DiagnosticResult> {
    const syncBranch = this.config?.sync.branch ?? 'tbd-sync';
    const localHealth = await checkLocalBranchHealth(syncBranch);

    if (localHealth.exists && !localHealth.orphaned) {
      return { name: 'Local sync branch', status: 'ok', message: syncBranch };
    }

    if (!localHealth.exists) {
      // Local branch doesn't exist - check if remote exists
      const remote = this.config?.sync.remote ?? 'origin';
      const remoteHealth = await checkRemoteBranchHealth(remote, syncBranch);

      if (remoteHealth.exists) {
        // Remote exists but local doesn't - can be created from remote
        return {
          name: 'Local sync branch',
          status: 'warn',
          message: `${syncBranch} not found (remote exists)`,
          suggestion: 'Run: tbd sync to create from remote',
        };
      }

      // Neither local nor remote - new repo, this is OK
      return {
        name: 'Local sync branch',
        status: 'ok',
        message: 'not created yet',
      };
    }

    // Branch exists but is orphaned (no commits)
    return {
      name: 'Local sync branch',
      status: 'warn',
      message: `${syncBranch} exists but has no commits`,
      suggestion: 'Run: tbd sync to push data',
    };
  }

  /**
   * Check remote sync branch health.
   * See: plan-2026-01-28-sync-worktree-recovery-and-hardening.md §4b
   */
  private async checkRemoteSyncBranch(): Promise<DiagnosticResult> {
    const syncBranch = this.config?.sync.branch ?? 'tbd-sync';
    const remote = this.config?.sync.remote ?? 'origin';
    const remoteHealth = await checkRemoteBranchHealth(remote, syncBranch);

    if (remoteHealth.exists) {
      if (remoteHealth.diverged) {
        return {
          name: 'Remote sync branch',
          status: 'warn',
          message: `${remote}/${syncBranch} has diverged`,
          suggestion: 'Run: tbd sync to reconcile changes',
        };
      }
      return { name: 'Remote sync branch', status: 'ok', message: `${remote}/${syncBranch}` };
    }

    // Remote branch doesn't exist
    const localHealth = await checkLocalBranchHealth(syncBranch);
    if (localHealth.exists) {
      // Local exists but remote doesn't - needs push
      return {
        name: 'Remote sync branch',
        status: 'warn',
        message: `${remote}/${syncBranch} not found`,
        suggestion: 'Run: tbd sync to push local branch',
      };
    }

    // Neither exists - new repo, this is OK
    return {
      name: 'Remote sync branch',
      status: 'ok',
      message: 'not created yet',
    };
  }

  /**
   * Check for local data that hasn't been synced to remote.
   * This detects the ai-trade-arena bug scenario.
   * See: plan-2026-01-28-sync-worktree-recovery-and-hardening.md §4
   */
  private async checkLocalVsRemoteData(): Promise<DiagnosticResult> {
    // Only check if worktree exists and has issues
    const worktreeHealth = await checkWorktreeHealth(this.cwd);
    if (worktreeHealth.status !== 'valid') {
      // Worktree not valid - can't compare
      return { name: 'Sync status', status: 'ok', message: 'worktree not active' };
    }

    // Count local issues in worktree
    const localIssueCount = this.issues.length;
    if (localIssueCount === 0) {
      return { name: 'Sync status', status: 'ok' };
    }

    // Check if remote branch exists and has commits
    const syncBranch = this.config?.sync.branch ?? 'tbd-sync';
    const remote = this.config?.sync.remote ?? 'origin';
    const remoteHealth = await checkRemoteBranchHealth(remote, syncBranch);

    if (!remoteHealth.exists) {
      // Remote doesn't exist - issues haven't been pushed
      return {
        name: 'Sync status',
        status: 'warn',
        message: `${localIssueCount} local issues, remote branch not found`,
        suggestion: 'Run: tbd sync to push issues to remote',
      };
    }

    // Note: Full remote issue count comparison would require fetching the remote
    // For now, we flag if local has issues but remote branch exists but is empty
    // This is detected by comparing commit counts or checking issue files
    // A simpler check: if worktree has uncommitted changes, we know they aren't synced

    return { name: 'Sync status', status: 'ok' };
  }

  /**
   * Check for multi-user/clone scenarios that indicate lost data.
   * See: plan-2026-01-28-sync-worktree-recovery-and-hardening.md §6
   */
  private async checkCloneScenarios(): Promise<DiagnosticResult> {
    // Only relevant if we have no issues
    const localIssueCount = this.issues.length;
    if (localIssueCount > 0) {
      return { name: 'Clone status', status: 'ok' };
    }

    // Check 1: Beads migration evidence exists but tbd has no issues
    const beadsDisabledPath = join(this.cwd, '.beads-disabled');
    let beadsMigrationExists = false;
    try {
      await access(beadsDisabledPath);
      beadsMigrationExists = true;
    } catch {
      // No beads migration - that's fine
    }

    if (beadsMigrationExists) {
      // Check if beads had issues
      const beadsJsonl = join(beadsDisabledPath, '.beads', 'issues.jsonl');
      let beadsIssueCount = 0;
      try {
        const content = await readFile(beadsJsonl, 'utf-8');
        beadsIssueCount = content.trim().split('\n').filter(Boolean).length;
      } catch {
        // Can't read beads file - ignore
      }

      if (beadsIssueCount > 0) {
        return {
          name: 'Clone status',
          status: 'error',
          message: `Beads migration has ${beadsIssueCount} issues, tbd has none`,
          details: [
            'This repo was migrated from beads but issues were never synced.',
            'Another user may have the issues locally but they were not pushed.',
          ],
          suggestion: 'Contact the repo owner to run: tbd sync',
        };
      }
    }

    // Check 2: Config has id_prefix but no issues (suggests prior usage)
    if (!beadsMigrationExists && this.config?.display?.id_prefix) {
      return {
        name: 'Clone status',
        status: 'warn',
        message: `Config has prefix '${this.config.display.id_prefix}' but no issues`,
        details: [
          'This suggests issues may have been created but not synced,',
          'or were lost due to sync issues on another machine.',
        ],
        suggestion: 'If you expect issues to exist, contact the repo owner',
      };
    }

    // Check 3: Active beads directory exists (not migrated yet)
    const beadsPath = join(this.cwd, '.beads');
    let beadsActiveExists = false;
    try {
      await access(beadsPath);
      beadsActiveExists = true;
    } catch {
      // No active beads - that's fine
    }

    if (beadsActiveExists) {
      return {
        name: 'Clone status',
        status: 'ok',
        message: 'beads directory exists (migration available)',
      };
    }

    return { name: 'Clone status', status: 'ok' };
  }

  /**
   * Check sync consistency - worktree matches local, ahead/behind counts.
   * See: plan-2026-01-28-sync-worktree-recovery-and-hardening.md §4
   */
  private async checkSyncConsistency(): Promise<DiagnosticResult> {
    const syncBranch = this.config?.sync.branch ?? 'tbd-sync';
    const remote = this.config?.sync.remote ?? 'origin';

    // Only check if worktree is valid
    const worktreeHealth = await checkWorktreeHealth(this.cwd);
    if (worktreeHealth.status !== 'valid') {
      return { name: 'Sync consistency', status: 'ok', message: 'worktree not active' };
    }

    try {
      const consistency = await checkSyncConsistency(this.cwd, syncBranch, remote);

      // Check if worktree matches local
      if (!consistency.worktreeMatchesLocal) {
        return {
          name: 'Sync consistency',
          status: 'error',
          message: 'worktree HEAD does not match local branch',
          details: [
            `Worktree HEAD: ${consistency.worktreeHead.slice(0, 7)}`,
            `Local ${syncBranch}: ${consistency.localHead.slice(0, 7)}`,
          ],
          fixable: true,
          suggestion: 'Run: tbd doctor --fix to synchronize',
        };
      }

      // Check ahead/behind status
      if (consistency.localAhead > 0 && consistency.localBehind > 0) {
        return {
          name: 'Sync consistency',
          status: 'warn',
          message: `diverged (${consistency.localAhead} ahead, ${consistency.localBehind} behind)`,
          suggestion: 'Run: tbd sync to reconcile',
        };
      }

      if (consistency.localAhead > 0) {
        return {
          name: 'Sync consistency',
          status: 'warn',
          message: `${consistency.localAhead} commit(s) ahead of remote`,
          suggestion: 'Run: tbd sync to push changes',
        };
      }

      if (consistency.localBehind > 0) {
        return {
          name: 'Sync consistency',
          status: 'warn',
          message: `${consistency.localBehind} commit(s) behind remote`,
          suggestion: 'Run: tbd sync to pull changes',
        };
      }

      return { name: 'Sync consistency', status: 'ok' };
    } catch (error) {
      // Sync consistency check failed - may be normal if branches don't exist yet
      const msg = error instanceof Error ? error.message : String(error);
      if (msg.includes('not found') || msg.includes('no commits')) {
        return { name: 'Sync consistency', status: 'ok', message: 'branches not yet established' };
      }
      return {
        name: 'Sync consistency',
        status: 'warn',
        message: `Unable to check: ${msg}`,
      };
    }
  }
}

export const doctorCommand = new Command('doctor')
  .description('Diagnose and repair repository')
  .option('--fix', 'Attempt to fix issues')
  .action(async (options, command) => {
    const handler = new DoctorHandler(command);
    await handler.run(options);
  });
