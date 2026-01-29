/**
 * Tests for worktree health detection functions.
 *
 * See: plan-2026-01-28-sync-worktree-recovery-and-hardening.md
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdir, rm, writeFile as fsWriteFile, readdir, access, readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir, platform } from 'node:os';
import { randomBytes } from 'node:crypto';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';

import {
  checkWorktreeHealth,
  checkLocalBranchHealth,
  checkRemoteBranchHealth,
  checkSyncConsistency,
  initWorktree,
  checkGitVersion,
  repairWorktree,
  migrateDataToWorktree,
} from '../src/file/git.js';
import { resolveDataSyncDir, WorktreeMissingError, clearPathCache } from '../src/lib/paths.js';
import {
  WORKTREE_DIR,
  TBD_DIR,
  DATA_SYNC_DIR_NAME,
  SYNC_BRANCH,
  DATA_SYNC_DIR,
} from '../src/lib/paths.js';

const execFileAsync = promisify(execFile);

// Skip on Windows due to slower file I/O and git behavior differences
const isWindows = platform() === 'win32';
const describeUnlessWindows = isWindows ? describe.skip : describe;

/**
 * Execute a git command in a specific directory.
 */
async function gitInDir(dir: string, ...args: string[]): Promise<string> {
  const { stdout } = await execFileAsync('git', args, { cwd: dir });
  return stdout.trim();
}

/**
 * Create a bare git repository to act as a "remote".
 */
async function createBareRepo(path: string): Promise<void> {
  await mkdir(path, { recursive: true });
  await gitInDir(path, 'init', '--bare');
}

/**
 * Initialize a working repo with a remote pointing to the bare repo.
 */
async function initRepoWithRemote(
  repoPath: string,
  remotePath: string,
  remoteName = 'origin',
): Promise<void> {
  await mkdir(repoPath, { recursive: true });
  await gitInDir(repoPath, 'init', '-b', 'main');
  await gitInDir(repoPath, 'config', 'user.email', 'test@test.com');
  await gitInDir(repoPath, 'config', 'user.name', 'Test User');
  await gitInDir(repoPath, 'config', 'commit.gpgsign', 'false');
  await gitInDir(repoPath, 'remote', 'add', remoteName, remotePath);

  // Create initial commit on main branch
  await fsWriteFile(join(repoPath, 'README.md'), '# Test Repo\n');
  await gitInDir(repoPath, 'add', 'README.md');
  await gitInDir(repoPath, 'commit', '-m', 'Initial commit');
  await gitInDir(repoPath, 'push', '-u', remoteName, 'main');
}

describeUnlessWindows('worktree health checks', () => {
  let testDir: string;
  let bareRepoPath: string;
  let workRepoPath: string;
  let originalCwd: string;

  beforeEach(async () => {
    const { supported } = await checkGitVersion();
    if (!supported) {
      console.log('Skipping worktree health tests - Git 2.42+ required');
      return;
    }

    originalCwd = process.cwd();
    testDir = join(tmpdir(), `tbd-worktree-test-${randomBytes(4).toString('hex')}`);
    bareRepoPath = join(testDir, 'remote.git');
    workRepoPath = join(testDir, 'work');

    await createBareRepo(bareRepoPath);
    await initRepoWithRemote(workRepoPath, bareRepoPath);
    process.chdir(workRepoPath);
    clearPathCache();
  });

  afterEach(async () => {
    process.chdir(originalCwd);
    clearPathCache();
    if (testDir) {
      await rm(testDir, { recursive: true, force: true }).catch(() => undefined);
    }
  });

  describe('checkWorktreeHealth', () => {
    it('returns missing status when worktree does not exist', async () => {
      const health = await checkWorktreeHealth(workRepoPath);

      expect(health.status).toBe('missing');
      expect(health.exists).toBe(false);
      expect(health.valid).toBe(false);
    });

    it('returns valid status when worktree is properly set up', async () => {
      // Initialize worktree
      await initWorktree(workRepoPath);

      const health = await checkWorktreeHealth(workRepoPath);

      expect(health.status).toBe('valid');
      expect(health.exists).toBe(true);
      expect(health.valid).toBe(true);
      expect(health.branch).toBe(SYNC_BRANCH);
      expect(health.commit).toBeTruthy();
    });

    it('returns prunable status when worktree directory is deleted but git tracks it', async () => {
      // Initialize worktree
      await initWorktree(workRepoPath);

      // Verify worktree is valid first
      let health = await checkWorktreeHealth(workRepoPath);
      expect(health.status).toBe('valid');

      // Delete the worktree directory manually (simulating user deletion)
      const worktreePath = join(workRepoPath, WORKTREE_DIR);
      await rm(worktreePath, { recursive: true, force: true });

      // Check health again - git worktree list should show it as prunable
      // Note: Git marks worktrees as prunable when their directory is deleted
      health = await checkWorktreeHealth(workRepoPath);

      // The status depends on git's worktree tracking
      // When directory is deleted, git either marks as prunable (if it detected the deletion)
      // or missing (if the directory check happens first)
      expect(['prunable', 'missing']).toContain(health.status);
      expect(health.exists).toBe(false);
      expect(health.valid).toBe(false);
    });
  });

  describe('checkLocalBranchHealth', () => {
    it('returns exists: false when sync branch does not exist', async () => {
      const health = await checkLocalBranchHealth(SYNC_BRANCH);

      expect(health.exists).toBe(false);
    });

    it('returns exists: true after worktree is initialized', async () => {
      await initWorktree(workRepoPath);

      const health = await checkLocalBranchHealth(SYNC_BRANCH);

      expect(health.exists).toBe(true);
      expect(health.head).toBeTruthy();
    });
  });

  describe('checkRemoteBranchHealth', () => {
    it('returns exists: false when remote branch does not exist', async () => {
      const health = await checkRemoteBranchHealth('origin', SYNC_BRANCH);

      expect(health.exists).toBe(false);
    });

    it('returns exists: true after sync branch is pushed', async () => {
      // Initialize worktree and create sync branch
      await initWorktree(workRepoPath);

      // Push the sync branch to remote
      const worktreePath = join(workRepoPath, WORKTREE_DIR);
      await gitInDir(worktreePath, 'push', '-u', 'origin', SYNC_BRANCH);

      const health = await checkRemoteBranchHealth('origin', SYNC_BRANCH);

      expect(health.exists).toBe(true);
      expect(health.head).toBeTruthy();
    });
  });

  describe('checkSyncConsistency', () => {
    it('returns matching HEADs when worktree and local are in sync', async () => {
      // Initialize worktree
      await initWorktree(workRepoPath);

      // Push to remote
      const worktreePath = join(workRepoPath, WORKTREE_DIR);
      await gitInDir(worktreePath, 'push', '-u', 'origin', SYNC_BRANCH);

      const consistency = await checkSyncConsistency(workRepoPath, SYNC_BRANCH, 'origin');

      expect(consistency.worktreeMatchesLocal).toBe(true);
      expect(consistency.worktreeHead).toBeTruthy();
      expect(consistency.localHead).toBeTruthy();
      expect(consistency.worktreeHead).toBe(consistency.localHead);
      expect(consistency.localAhead).toBe(0);
      expect(consistency.localBehind).toBe(0);
    });

    it('detects when local is ahead of remote', async () => {
      // Initialize worktree
      await initWorktree(workRepoPath);

      // Push to remote
      const worktreePath = join(workRepoPath, WORKTREE_DIR);
      await gitInDir(worktreePath, 'push', '-u', 'origin', SYNC_BRANCH);

      // Create a new commit in worktree (making local ahead)
      await fsWriteFile(join(worktreePath, TBD_DIR, DATA_SYNC_DIR_NAME, 'test.txt'), 'test');
      await gitInDir(worktreePath, 'add', '-A');
      await gitInDir(worktreePath, 'commit', '-m', 'Test commit');

      const consistency = await checkSyncConsistency(workRepoPath, SYNC_BRANCH, 'origin');

      expect(consistency.localAhead).toBe(1);
      expect(consistency.localBehind).toBe(0);
    });
  });
});

describe('resolveDataSyncDir with allowFallback option', () => {
  let testDir: string;
  let originalCwd: string;

  beforeEach(async () => {
    originalCwd = process.cwd();
    testDir = join(tmpdir(), `tbd-paths-test-${randomBytes(4).toString('hex')}`);
    await mkdir(join(testDir, TBD_DIR), { recursive: true });
    process.chdir(testDir);
    clearPathCache();
  });

  afterEach(async () => {
    process.chdir(originalCwd);
    clearPathCache();
    if (testDir) {
      await rm(testDir, { recursive: true, force: true }).catch(() => undefined);
    }
  });

  it('returns direct path when allowFallback is true (default) and worktree missing', async () => {
    // No worktree exists, but allowFallback defaults to true
    const dataSyncDir = await resolveDataSyncDir(testDir);

    expect(dataSyncDir).toContain('data-sync');
    expect(dataSyncDir).not.toContain('data-sync-worktree');
  });

  it('returns direct path when allowFallback is explicitly true', async () => {
    const dataSyncDir = await resolveDataSyncDir(testDir, { allowFallback: true });

    expect(dataSyncDir).toContain('data-sync');
    expect(dataSyncDir).not.toContain('data-sync-worktree');
  });

  it('throws WorktreeMissingError when allowFallback is false and worktree missing', async () => {
    await expect(resolveDataSyncDir(testDir, { allowFallback: false })).rejects.toThrow(
      WorktreeMissingError,
    );
  });

  it('returns worktree path when worktree exists', async () => {
    // Create the worktree directory structure
    const worktreePath = join(testDir, WORKTREE_DIR, TBD_DIR, DATA_SYNC_DIR_NAME);
    await mkdir(worktreePath, { recursive: true });

    clearPathCache();
    const dataSyncDir = await resolveDataSyncDir(testDir);

    expect(dataSyncDir).toContain('data-sync-worktree');
  });
});

// =============================================================================
// Phase 3: Auto-Repair Tests
// See: plan-2026-01-28-sync-worktree-recovery-and-hardening.md
// =============================================================================

describeUnlessWindows('repairWorktree', () => {
  let testDir: string;
  let bareRepoPath: string;
  let workRepoPath: string;
  let originalCwd: string;

  beforeEach(async () => {
    const { supported } = await checkGitVersion();
    if (!supported) {
      console.log('Skipping repairWorktree tests - Git 2.42+ required');
      return;
    }

    originalCwd = process.cwd();
    testDir = join(tmpdir(), `tbd-repair-test-${randomBytes(4).toString('hex')}`);
    bareRepoPath = join(testDir, 'remote.git');
    workRepoPath = join(testDir, 'work');

    await createBareRepo(bareRepoPath);
    await initRepoWithRemote(workRepoPath, bareRepoPath);
    process.chdir(workRepoPath);
    clearPathCache();
  });

  afterEach(async () => {
    process.chdir(originalCwd);
    clearPathCache();
    if (testDir) {
      await rm(testDir, { recursive: true, force: true }).catch(() => undefined);
    }
  });

  it('repairs missing worktree by initializing it', async () => {
    // Worktree does not exist initially
    const health = await checkWorktreeHealth(workRepoPath);
    expect(health.status).toBe('missing');

    // Repair the missing worktree
    const result = await repairWorktree(workRepoPath, 'missing');

    expect(result.success).toBe(true);
    expect(result.path).toBeTruthy();

    // Verify worktree is now valid
    const healthAfter = await checkWorktreeHealth(workRepoPath);
    expect(healthAfter.status).toBe('valid');
    expect(healthAfter.valid).toBe(true);
  });

  it('repairs prunable worktree by pruning and reinitializing', async () => {
    // Initialize worktree first
    await initWorktree(workRepoPath);

    // Delete the worktree directory to make it prunable
    const worktreePath = join(workRepoPath, WORKTREE_DIR);
    await rm(worktreePath, { recursive: true, force: true });

    // Repair the prunable worktree
    const result = await repairWorktree(workRepoPath, 'prunable');

    expect(result.success).toBe(true);
    expect(result.path).toBeTruthy();

    // Verify worktree is now valid
    const healthAfter = await checkWorktreeHealth(workRepoPath);
    expect(healthAfter.status).toBe('valid');
  });

  it('repairs corrupted worktree by backing up and reinitializing', async () => {
    // Initialize worktree first
    await initWorktree(workRepoPath);

    // Corrupt the worktree by removing .git file but keeping directory
    const worktreePath = join(workRepoPath, WORKTREE_DIR);
    const dotGitPath = join(worktreePath, '.git');
    await rm(dotGitPath, { force: true });

    // Write some test data that should be backed up
    const testFile = join(worktreePath, 'test-data.txt');
    await fsWriteFile(testFile, 'important data');

    // Repair the corrupted worktree
    const result = await repairWorktree(workRepoPath, 'corrupted');

    expect(result.success).toBe(true);
    expect(result.path).toBeTruthy();
    expect(result.backedUp).toBeTruthy();

    // Verify backup was created
    const backupExists = await access(result.backedUp!).then(
      () => true,
      () => false,
    );
    expect(backupExists).toBe(true);

    // Verify worktree is now valid
    const healthAfter = await checkWorktreeHealth(workRepoPath);
    expect(healthAfter.status).toBe('valid');
  });
});

describeUnlessWindows('migrateDataToWorktree', () => {
  let testDir: string;
  let bareRepoPath: string;
  let workRepoPath: string;
  let originalCwd: string;

  beforeEach(async () => {
    const { supported } = await checkGitVersion();
    if (!supported) {
      console.log('Skipping migrateDataToWorktree tests - Git 2.42+ required');
      return;
    }

    originalCwd = process.cwd();
    testDir = join(tmpdir(), `tbd-migrate-test-${randomBytes(4).toString('hex')}`);
    bareRepoPath = join(testDir, 'remote.git');
    workRepoPath = join(testDir, 'work');

    await createBareRepo(bareRepoPath);
    await initRepoWithRemote(workRepoPath, bareRepoPath);
    process.chdir(workRepoPath);
    clearPathCache();
  });

  afterEach(async () => {
    process.chdir(originalCwd);
    clearPathCache();
    if (testDir) {
      await rm(testDir, { recursive: true, force: true }).catch(() => undefined);
    }
  });

  it('returns migratedCount 0 when no data in wrong location', async () => {
    // Initialize worktree
    await initWorktree(workRepoPath);

    const result = await migrateDataToWorktree(workRepoPath);

    expect(result.success).toBe(true);
    expect(result.migratedCount).toBe(0);
  });

  it('migrates issues from wrong location to worktree', async () => {
    // Initialize worktree first
    await initWorktree(workRepoPath);

    // Create data in the WRONG location (.tbd/data-sync/)
    const wrongIssuesPath = join(workRepoPath, DATA_SYNC_DIR, 'issues');
    await mkdir(wrongIssuesPath, { recursive: true });
    await fsWriteFile(join(wrongIssuesPath, 'test-abc1.md'), '# Test Issue\n\nThis is a test.');

    // Migrate data to worktree
    const result = await migrateDataToWorktree(workRepoPath);

    expect(result.success).toBe(true);
    expect(result.migratedCount).toBe(1);

    // Verify data is now in the correct location
    const correctIssuesPath = join(
      workRepoPath,
      WORKTREE_DIR,
      TBD_DIR,
      DATA_SYNC_DIR_NAME,
      'issues',
    );
    const migratedContent = await readFile(join(correctIssuesPath, 'test-abc1.md'), 'utf-8');
    expect(migratedContent).toContain('Test Issue');
  });

  it('migrates mappings from wrong location to worktree', async () => {
    // Initialize worktree first
    await initWorktree(workRepoPath);

    // Create mappings in the WRONG location
    const wrongMappingsPath = join(workRepoPath, DATA_SYNC_DIR, 'mappings');
    await mkdir(wrongMappingsPath, { recursive: true });
    await fsWriteFile(join(wrongMappingsPath, 'github.yml'), 'github: true');

    // Migrate data to worktree
    const result = await migrateDataToWorktree(workRepoPath);

    expect(result.success).toBe(true);
    expect(result.migratedCount).toBe(1);

    // Verify data is now in the correct location
    const correctMappingsPath = join(
      workRepoPath,
      WORKTREE_DIR,
      TBD_DIR,
      DATA_SYNC_DIR_NAME,
      'mappings',
    );
    const migratedContent = await readFile(join(correctMappingsPath, 'github.yml'), 'utf-8');
    expect(migratedContent).toBe('github: true');
  });

  it('creates backup before migration', async () => {
    // Initialize worktree first
    await initWorktree(workRepoPath);

    // Create data in the wrong location
    const wrongIssuesPath = join(workRepoPath, DATA_SYNC_DIR, 'issues');
    await mkdir(wrongIssuesPath, { recursive: true });
    await fsWriteFile(join(wrongIssuesPath, 'backup-test.md'), '# Backup Test');

    // Migrate data
    const result = await migrateDataToWorktree(workRepoPath);

    expect(result.success).toBe(true);
    expect(result.backupPath).toBeTruthy();

    // Verify backup exists and contains the original data
    const backupIssuesPath = join(result.backupPath!, 'issues');
    const backupFiles = await readdir(backupIssuesPath);
    expect(backupFiles).toContain('backup-test.md');
  });

  it('removes source files when removeSource is true', async () => {
    // Initialize worktree first
    await initWorktree(workRepoPath);

    // Create data in the wrong location
    const wrongIssuesPath = join(workRepoPath, DATA_SYNC_DIR, 'issues');
    await mkdir(wrongIssuesPath, { recursive: true });
    await fsWriteFile(join(wrongIssuesPath, 'remove-test.md'), '# Remove Test');

    // Migrate with removeSource = true
    const result = await migrateDataToWorktree(workRepoPath, true);

    expect(result.success).toBe(true);

    // Verify source file was removed
    const sourceFileExists = await access(join(wrongIssuesPath, 'remove-test.md')).then(
      () => true,
      () => false,
    );
    expect(sourceFileExists).toBe(false);
  });

  it('preserves source files when removeSource is false', async () => {
    // Initialize worktree first
    await initWorktree(workRepoPath);

    // Create data in the wrong location
    const wrongIssuesPath = join(workRepoPath, DATA_SYNC_DIR, 'issues');
    await mkdir(wrongIssuesPath, { recursive: true });
    await fsWriteFile(join(wrongIssuesPath, 'preserve-test.md'), '# Preserve Test');

    // Migrate with removeSource = false (default)
    const result = await migrateDataToWorktree(workRepoPath, false);

    expect(result.success).toBe(true);

    // Verify source file was preserved
    const sourceFileExists = await access(join(wrongIssuesPath, 'preserve-test.md')).then(
      () => true,
      () => false,
    );
    expect(sourceFileExists).toBe(true);
  });

  it('preserves all issue data during migration', async () => {
    // Initialize worktree first
    await initWorktree(workRepoPath);

    // Create a complete issue in the wrong location
    const wrongIssuesPath = join(workRepoPath, DATA_SYNC_DIR, 'issues');
    await mkdir(wrongIssuesPath, { recursive: true });

    const issueContent = `---
id: test-data-integrity
title: "Data Integrity Test"
status: open
type: task
priority: 2
created: 2026-01-28T12:00:00Z
---

# Data Integrity Test

This issue tests that all data is preserved during migration.

## Details

- Markdown formatting preserved
- YAML frontmatter preserved
- Special characters: "quotes", 'apostrophes', \`backticks\`
`;

    await fsWriteFile(join(wrongIssuesPath, 'test-data-integrity.md'), issueContent);

    // Migrate data
    const result = await migrateDataToWorktree(workRepoPath);

    expect(result.success).toBe(true);

    // Verify data integrity
    const correctIssuesPath = join(
      workRepoPath,
      WORKTREE_DIR,
      TBD_DIR,
      DATA_SYNC_DIR_NAME,
      'issues',
    );
    const migratedContent = await readFile(
      join(correctIssuesPath, 'test-data-integrity.md'),
      'utf-8',
    );

    // Content should be identical
    expect(migratedContent).toBe(issueContent);
  });
});

// =============================================================================
// Phase 4: Architectural Prevention Tests
// See: plan-2026-01-28-sync-worktree-recovery-and-hardening.md
// =============================================================================

describeUnlessWindows('worktree health after init (CI check)', () => {
  let testDir: string;
  let bareRepoPath: string;
  let workRepoPath: string;
  let originalCwd: string;

  beforeEach(async () => {
    const { supported } = await checkGitVersion();
    if (!supported) {
      console.log('Skipping CI health check tests - Git 2.42+ required');
      return;
    }

    originalCwd = process.cwd();
    testDir = join(tmpdir(), `tbd-ci-check-${randomBytes(4).toString('hex')}`);
    bareRepoPath = join(testDir, 'remote.git');
    workRepoPath = join(testDir, 'work');

    await createBareRepo(bareRepoPath);
    await initRepoWithRemote(workRepoPath, bareRepoPath);
    process.chdir(workRepoPath);
    clearPathCache();
  });

  afterEach(async () => {
    process.chdir(originalCwd);
    clearPathCache();
    if (testDir) {
      await rm(testDir, { recursive: true, force: true }).catch(() => undefined);
    }
  });

  it('checkWorktreeHealth returns valid after initWorktree', async () => {
    // Initialize worktree
    const initResult = await initWorktree(workRepoPath);
    expect(initResult.success).toBe(true);

    // Verify worktree is healthy
    const health = await checkWorktreeHealth(workRepoPath);
    expect(health.status).toBe('valid');
    expect(health.valid).toBe(true);
    expect(health.exists).toBe(true);
    expect(health.branch).toBe(SYNC_BRANCH);
  });

  it('worktree remains healthy after creating issues', async () => {
    // Initialize worktree
    await initWorktree(workRepoPath);

    // Create a test issue file in the worktree
    const issuesPath = join(workRepoPath, WORKTREE_DIR, TBD_DIR, DATA_SYNC_DIR_NAME, 'issues');
    await mkdir(issuesPath, { recursive: true });
    await fsWriteFile(
      join(issuesPath, 'is-0000000000000000000000test.md'),
      '---\nid: is-0000000000000000000000test\ntitle: Test\nstatus: open\n---\n',
    );

    // Verify worktree is still healthy
    const health = await checkWorktreeHealth(workRepoPath);
    expect(health.status).toBe('valid');
    expect(health.valid).toBe(true);
  });
});

describeUnlessWindows('architectural test: issues written to worktree path', () => {
  let testDir: string;
  let bareRepoPath: string;
  let workRepoPath: string;
  let originalCwd: string;

  beforeEach(async () => {
    const { supported } = await checkGitVersion();
    if (!supported) {
      console.log('Skipping architectural tests - Git 2.42+ required');
      return;
    }

    originalCwd = process.cwd();
    testDir = join(tmpdir(), `tbd-arch-test-${randomBytes(4).toString('hex')}`);
    bareRepoPath = join(testDir, 'remote.git');
    workRepoPath = join(testDir, 'work');

    await createBareRepo(bareRepoPath);
    await initRepoWithRemote(workRepoPath, bareRepoPath);
    process.chdir(workRepoPath);
    clearPathCache();
  });

  afterEach(async () => {
    process.chdir(originalCwd);
    clearPathCache();
    if (testDir) {
      await rm(testDir, { recursive: true, force: true }).catch(() => undefined);
    }
  });

  it('resolveDataSyncDir returns worktree path when worktree exists', async () => {
    // Initialize worktree
    await initWorktree(workRepoPath);
    clearPathCache();

    // Resolve data sync dir - should return worktree path
    const dataSyncDir = await resolveDataSyncDir(workRepoPath);

    // Verify it points to worktree path, not direct path
    expect(dataSyncDir).toContain('data-sync-worktree');
    expect(dataSyncDir).toBe(join(workRepoPath, WORKTREE_DIR, TBD_DIR, DATA_SYNC_DIR_NAME));
  });

  it('issues written via resolved path exist in worktree, not direct path', async () => {
    // Initialize worktree
    await initWorktree(workRepoPath);
    clearPathCache();

    // Get the resolved data sync dir (should be worktree path)
    const dataSyncDir = await resolveDataSyncDir(workRepoPath);
    const issuesDir = join(dataSyncDir, 'issues');
    await mkdir(issuesDir, { recursive: true });

    // Write an issue file
    const issueId = 'test-arch-001';
    const issuePath = join(issuesDir, `${issueId}.md`);
    await fsWriteFile(issuePath, '---\nid: test-arch-001\n---\n# Test');

    // Verify issue exists in worktree path
    const worktreeIssuesPath = join(
      workRepoPath,
      WORKTREE_DIR,
      TBD_DIR,
      DATA_SYNC_DIR_NAME,
      'issues',
    );
    const existsInWorktree = await access(join(worktreeIssuesPath, `${issueId}.md`)).then(
      () => true,
      () => false,
    );
    expect(existsInWorktree).toBe(true);

    // Verify issue does NOT exist in direct path (the wrong location)
    const directIssuesPath = join(workRepoPath, DATA_SYNC_DIR, 'issues');
    const existsInDirect = await access(join(directIssuesPath, `${issueId}.md`)).then(
      () => true,
      () => false,
    );
    expect(existsInDirect).toBe(false);
  });

  it('throws WorktreeMissingError when worktree missing and fallback disabled', async () => {
    // No worktree initialized - should throw when fallback disabled
    await expect(resolveDataSyncDir(workRepoPath, { allowFallback: false })).rejects.toThrow(
      WorktreeMissingError,
    );
  });
});
