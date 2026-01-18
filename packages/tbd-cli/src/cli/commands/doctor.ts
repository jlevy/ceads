/**
 * `tbd doctor` - Diagnose and repair repository.
 *
 * See: tbd-full-design.md §4.9 Doctor
 */

import { Command } from 'commander';
import { access, readdir, unlink } from 'node:fs/promises';
import { join } from 'node:path';

import { BaseCommand } from '../lib/baseCommand.js';
import { requireInit } from '../lib/errors.js';
import { listIssues } from '../../file/storage.js';
import { readConfig } from '../../file/config.js';
import type { Issue } from '../../lib/types.js';
import { resolveDataSyncDir, TBD_DIR } from '../../lib/paths.js';
import { validateIssueId } from '../../lib/ids.js';
import { checkGitVersion, MIN_GIT_VERSION } from '../../file/git.js';

const CONFIG_DIR = TBD_DIR;

interface DoctorOptions {
  fix?: boolean;
}

interface CheckResult {
  name: string;
  status: 'ok' | 'warn' | 'error';
  message?: string;
  fixable?: boolean;
}

class DoctorHandler extends BaseCommand {
  private dataSyncDir = '';

  async run(options: DoctorOptions): Promise<void> {
    await requireInit();

    this.dataSyncDir = await resolveDataSyncDir();
    const checks: CheckResult[] = [];
    let issues: Issue[] = [];

    // Check 1: Git version
    const gitVersionCheck = await this.checkGitVersion();
    checks.push(gitVersionCheck);

    // Check 2: Config directory and file
    const configCheck = await this.checkConfig();
    checks.push(configCheck);

    // Check 3: Issues directory
    const issuesDirCheck = await this.checkIssuesDirectory();
    checks.push(issuesDirCheck);

    // If issues directory exists, load issues for further checks
    if (issuesDirCheck.status === 'ok') {
      try {
        issues = await listIssues(this.dataSyncDir);
      } catch {
        // Already handled by issuesDirCheck
      }
    }

    // Check 4: Orphaned dependencies
    const orphanCheck = this.checkOrphanedDependencies(issues);
    checks.push(orphanCheck);

    // Check 5: Duplicate IDs
    const duplicateCheck = this.checkDuplicateIds(issues);
    checks.push(duplicateCheck);

    // Check 6: Orphaned temp files
    const tempFilesCheck = await this.checkTempFiles(options.fix);
    checks.push(tempFilesCheck);

    // Check 7: Issue validity
    const validityCheck = this.checkIssueValidity(issues);
    checks.push(validityCheck);

    // Check 8: Claude Code skill file
    const skillCheck = await this.checkClaudeSkill();
    checks.push(skillCheck);

    const allOk = checks.every((c) => c.status === 'ok');
    const hasFixable = checks.some((c) => c.fixable && c.status !== 'ok');

    this.output.data({ checks, healthy: allOk }, () => {
      const colors = this.output.getColors();
      for (const check of checks) {
        const icon =
          check.status === 'ok'
            ? colors.success('✓')
            : check.status === 'warn'
              ? colors.warn('⚠')
              : colors.error('✗');
        const msg = check.message ? ` - ${check.message}` : '';
        const fixNote = check.fixable && check.status !== 'ok' ? ' [fixable]' : '';
        console.log(`${icon} ${check.name}${msg}${colors.dim(fixNote)}`);
      }
      console.log('');
      if (allOk) {
        this.output.success('Repository is healthy');
      } else if (hasFixable && !options.fix) {
        this.output.warn('Issues found. Run with --fix to repair.');
      } else {
        this.output.warn('Issues found that may require manual intervention.');
      }
    });
  }

  private async checkGitVersion(): Promise<CheckResult> {
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
        fixable: false,
      };
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      if (msg.includes('git') || msg.includes('not found') || msg.includes('ENOENT')) {
        return {
          name: 'Git version',
          status: 'error',
          message: 'Git not found',
          fixable: false,
        };
      }
      return {
        name: 'Git version',
        status: 'warn',
        message: `Unable to check: ${msg}`,
        fixable: false,
      };
    }
  }

  private async checkConfig(): Promise<CheckResult> {
    try {
      await access(join(process.cwd(), CONFIG_DIR, 'config.yml'));
      await readConfig(process.cwd());
      return { name: 'Config file', status: 'ok' };
    } catch (error) {
      const msg = (error as Error).message;
      if (msg.includes('ENOENT')) {
        return {
          name: 'Config file',
          status: 'error',
          message: 'config.yml not found',
          fixable: false,
        };
      }
      return {
        name: 'Config file',
        status: 'error',
        message: 'Invalid config file',
        fixable: false,
      };
    }
  }

  private async checkIssuesDirectory(): Promise<CheckResult> {
    try {
      await access(join(this.dataSyncDir, 'issues'));
      return { name: 'Issues directory', status: 'ok' };
    } catch {
      return {
        name: 'Issues directory',
        status: 'warn',
        message: 'Issues directory not found (may be empty)',
        fixable: false,
      };
    }
  }

  private checkOrphanedDependencies(issues: Issue[]): CheckResult {
    const issueIds = new Set(issues.map((i) => i.id));
    const orphans: string[] = [];

    for (const issue of issues) {
      for (const dep of issue.dependencies) {
        if (!issueIds.has(dep.target)) {
          orphans.push(`${issue.id} -> ${dep.target}`);
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
      fixable: true,
    };
  }

  private checkDuplicateIds(issues: Issue[]): CheckResult {
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
      fixable: false,
    };
  }

  private async checkTempFiles(fix?: boolean): Promise<CheckResult> {
    const issuesDir = join(this.dataSyncDir, 'issues');
    let tempFiles: string[] = [];

    try {
      const files = await readdir(issuesDir);
      tempFiles = files.filter((f) => f.endsWith('.tmp'));
    } catch {
      // Directory doesn't exist - no temp files
      return { name: 'Temp files', status: 'ok' };
    }

    if (tempFiles.length === 0) {
      return { name: 'Temp files', status: 'ok' };
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
      };
    }

    return {
      name: 'Temp files',
      status: 'warn',
      message: `${tempFiles.length} orphaned temp file(s)`,
      fixable: true,
    };
  }

  private checkIssueValidity(issues: Issue[]): CheckResult {
    const invalid: string[] = [];

    for (const issue of issues) {
      // Check required fields
      if (!issue.id || !issue.title || !issue.status || !issue.kind) {
        invalid.push(issue.id ?? 'unknown');
      }
      // Check ID format
      if (issue.id && !validateIssueId(issue.id)) {
        invalid.push(issue.id);
      }
      // Check priority range
      if (issue.priority < 0 || issue.priority > 4) {
        invalid.push(issue.id);
      }
    }

    if (invalid.length === 0) {
      return { name: 'Issue validity', status: 'ok' };
    }

    return {
      name: 'Issue validity',
      status: 'error',
      message: `${invalid.length} invalid issue(s)`,
      fixable: false,
    };
  }

  private async checkClaudeSkill(): Promise<CheckResult> {
    const skillPath = join(process.cwd(), '.claude', 'skills', 'tbd', 'SKILL.md');
    try {
      await access(skillPath);
      return { name: 'Claude Code skill', status: 'ok' };
    } catch {
      return {
        name: 'Claude Code skill',
        status: 'warn',
        message: 'Not installed (run: tbd setup claude)',
        fixable: false,
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
