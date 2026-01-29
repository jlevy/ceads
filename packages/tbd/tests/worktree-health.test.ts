/**
 * Tests for worktree health detection functions.
 *
 * See: plan-2026-01-28-sync-worktree-recovery-and-hardening.md
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdir, rm, writeFile as fsWriteFile } from 'node:fs/promises';
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
} from '../src/file/git.js';
import { resolveDataSyncDir, WorktreeMissingError, clearPathCache } from '../src/lib/paths.js';
import { WORKTREE_DIR, TBD_DIR, DATA_SYNC_DIR_NAME, SYNC_BRANCH } from '../src/lib/paths.js';

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
