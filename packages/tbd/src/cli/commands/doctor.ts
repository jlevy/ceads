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
import { resolveDataSyncDir, TBD_DIR, WORKTREE_DIR } from '../../lib/paths.js';
import { validateIssueId } from '../../lib/ids.js';
import {
  checkGitVersion,
  MIN_GIT_VERSION,
  getCurrentBranch,
  checkWorktreeHealth,
} from '../../file/git.js';
import { type DiagnosticResult, renderDiagnostics } from '../lib/diagnostics.js';
import { VERSION } from '../lib/version.js';
import { formatHeading } from '../lib/output.js';

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

    // Check 8: Worktree health
    healthChecks.push(await this.checkWorktree());

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

        // REPOSITORY section (matches status command)
        console.log(colors.bold(formatHeading('Repository')));
        console.log(`tbd v${VERSION}`);
        console.log(`Repository: ${this.cwd}`);
        console.log(`  ${colors.success('✓')} Initialized (.tbd/)`);
        if (statusInfo.gitBranch) {
          console.log(`  ${colors.success('✓')} Git repository (${statusInfo.gitBranch})`);
        }
        if (this.config) {
          console.log('');
          console.log(`${colors.dim('Sync branch:')} ${this.config.sync.branch}`);
          console.log(`${colors.dim('Remote:')} ${this.config.sync.remote}`);
          if (this.config.display.id_prefix) {
            console.log(`${colors.dim('ID prefix:')} ${this.config.display.id_prefix}-`);
          }
        }

        // STATISTICS section
        console.log('');
        console.log(colors.bold(formatHeading('Statistics')));
        console.log(`  Ready:       ${statsInfo.ready}`);
        console.log(`  In progress: ${statsInfo.inProgress}`);
        console.log(`  Blocked:     ${statsInfo.blocked}`);
        console.log(`  Open:        ${statsInfo.open}`);
        console.log(`  Total:       ${statsInfo.total}`);

        // INTEGRATIONS section (matches status command)
        console.log('');
        console.log(colors.bold(formatHeading('Integrations')));
        renderDiagnostics(integrationChecks, colors);

        // HEALTH CHECKS section
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

    if (fix) {
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
    const skillRelPath = join('.claude', 'skills', 'tbd', 'SKILL.md');
    const skillPath = join(process.cwd(), skillRelPath);
    try {
      await access(skillPath);
      return { name: 'Claude Code skill', status: 'ok', path: skillRelPath };
    } catch {
      return {
        name: 'Claude Code skill',
        status: 'warn',
        message: 'not installed',
        path: skillRelPath,
        suggestion: 'Run: tbd setup --auto',
      };
    }
  }

  private async checkCodexAgents(): Promise<DiagnosticResult> {
    const agentsRelPath = 'AGENTS.md';
    const agentsPath = join(this.cwd, agentsRelPath);
    try {
      await access(agentsPath);
      const content = await readFile(agentsPath, 'utf-8');
      if (content.includes('BEGIN TBD INTEGRATION')) {
        return { name: 'Codex AGENTS.md', status: 'ok', path: agentsRelPath };
      }
      return {
        name: 'Codex AGENTS.md',
        status: 'warn',
        message: 'exists but missing tbd integration',
        path: agentsRelPath,
        suggestion: 'Run: tbd setup --auto',
      };
    } catch {
      return {
        name: 'Codex AGENTS.md',
        status: 'warn',
        message: 'not installed',
        path: agentsRelPath,
        suggestion: 'Run: tbd setup --auto',
      };
    }
  }

  private async checkWorktree(): Promise<DiagnosticResult> {
    const worktreePath = WORKTREE_DIR;
    const worktreeHealth = await checkWorktreeHealth(this.cwd);
    if (worktreeHealth.valid) {
      return { name: 'Worktree', status: 'ok', path: worktreePath };
    }
    if (!worktreeHealth.exists) {
      // Worktree not existing is OK - it's created on demand
      return { name: 'Worktree', status: 'ok', message: 'not created yet', path: worktreePath };
    }
    return {
      name: 'Worktree',
      status: 'warn',
      message: worktreeHealth.error ?? 'unhealthy',
      path: worktreePath,
      fixable: true,
      suggestion: 'Run: tbd doctor --fix',
    };
  }
}

export const doctorCommand = new Command('doctor')
  .description('Diagnose and repair repository')
  .option('--fix', 'Attempt to fix issues')
  .action(async (options, command) => {
    const handler = new DoctorHandler(command);
    await handler.run(options);
  });
