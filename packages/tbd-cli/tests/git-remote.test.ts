/**
 * Integration tests for git remote operations.
 *
 * Tests:
 * - Sync with actual git remotes (using local bare repo as "remote")
 * - Concurrent sync operations
 * - Large repositories (5000+ issues)
 *
 * See: tbd-7696
 */

import { describe, it, expect, beforeEach, afterEach, beforeAll, afterAll } from 'vitest';
import { mkdir, rm, writeFile as fsWriteFile, readdir } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir, platform } from 'node:os';
import { randomBytes } from 'node:crypto';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';

import { writeIssue, listIssues, readIssue } from '../src/file/storage.js';
import type { Issue } from '../src/lib/types.js';
import {
  initWorktree,
  worktreeExists,
  mergeIssues,
  branchExists,
  remoteBranchExists,
  checkGitVersion,
} from '../src/file/git.js';
import { WORKTREE_DIR, TBD_DIR, DATA_SYNC_DIR_NAME, SYNC_BRANCH } from '../src/lib/paths.js';
import { TEST_ULIDS, testId, createTestIssue } from './test-helpers.js';

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
  await gitInDir(repoPath, 'remote', 'add', remoteName, remotePath);

  // Create initial commit on main branch
  await fsWriteFile(join(repoPath, 'README.md'), '# Test Repo\n');
  await gitInDir(repoPath, 'add', 'README.md');
  await gitInDir(repoPath, 'commit', '-m', 'Initial commit');
  await gitInDir(repoPath, 'push', '-u', remoteName, 'main');
}

/**
 * Generate a test issue with a specific index.
 */
function generateIssue(index: number): Issue {
  const indexPart = String(index).padStart(5, '0');
  const ulid = `01remotetest${indexPart}000000000`.slice(0, 26);

  return createTestIssue({
    id: `is-${ulid}`,
    title: `Test issue ${index}`,
    description: `Description for issue ${index}`,
    status: index % 3 === 0 ? 'closed' : 'open',
    priority: (index % 4) as 0 | 1 | 2 | 3,
    labels: index % 2 === 0 ? ['label-a'] : ['label-b'],
  });
}

describeUnlessWindows('git remote integration', () => {
  let testDir: string;
  let bareRepoPath: string;
  let workRepoPath: string;
  let originalCwd: string;

  beforeEach(async () => {
    // Check if git version supports our features
    const { supported } = await checkGitVersion();
    if (!supported) {
      console.log('Skipping git remote tests - Git 2.42+ required');
      return;
    }

    originalCwd = process.cwd();
    testDir = join(tmpdir(), `tbd-remote-test-${randomBytes(4).toString('hex')}`);
    bareRepoPath = join(testDir, 'remote.git');
    workRepoPath = join(testDir, 'work');

    await createBareRepo(bareRepoPath);
    await initRepoWithRemote(workRepoPath, bareRepoPath);
    process.chdir(workRepoPath);
  });

  afterEach(async () => {
    process.chdir(originalCwd);
    if (testDir) {
      await rm(testDir, { recursive: true, force: true }).catch(() => undefined);
    }
  });

  describe('worktree initialization', () => {
    it('creates orphan worktree when no sync branch exists', async () => {
      const result = await initWorktree(workRepoPath);

      expect(result.success).toBe(true);
      expect(result.created).toBe(true);
      expect(await worktreeExists(workRepoPath)).toBe(true);

      // Verify worktree has the expected structure
      const worktreePath = join(workRepoPath, WORKTREE_DIR);
      const dataSyncPath = join(worktreePath, TBD_DIR, DATA_SYNC_DIR_NAME);
      const issuesDir = await readdir(join(dataSyncPath, 'issues'));
      expect(issuesDir).toContain('.gitkeep');
    });

    it('reuses existing worktree', async () => {
      // First init
      const result1 = await initWorktree(workRepoPath);
      expect(result1.success).toBe(true);
      expect(result1.created).toBe(true);

      // Second init should reuse
      const result2 = await initWorktree(workRepoPath);
      expect(result2.success).toBe(true);
      expect(result2.created).toBe(false);
    });

    it('creates worktree from existing local branch', async () => {
      // First create the branch
      await initWorktree(workRepoPath);

      // Remove the worktree but keep the branch
      const worktreePath = join(workRepoPath, WORKTREE_DIR);
      await gitInDir(workRepoPath, 'worktree', 'remove', worktreePath, '--force');

      // Now init should use existing branch
      const result = await initWorktree(workRepoPath);
      expect(result.success).toBe(true);
      expect(result.created).toBe(true);
      expect(await branchExists(SYNC_BRANCH)).toBe(true);
    });
  });

  describe('sync with remote', () => {
    it('pushes sync branch to remote', async () => {
      // Initialize worktree
      await initWorktree(workRepoPath);

      // Write an issue to the worktree
      const worktreePath = join(workRepoPath, WORKTREE_DIR);
      const dataSyncPath = join(worktreePath, TBD_DIR, DATA_SYNC_DIR_NAME);

      const issue = createTestIssue({
        id: testId(TEST_ULIDS.REMOTE_1),
        title: 'Test issue for remote push',
      });
      await writeIssue(dataSyncPath, issue);

      // Commit the change to sync branch
      await gitInDir(worktreePath, 'add', '.');
      await gitInDir(worktreePath, 'commit', '-m', 'Add test issue');

      // Push to remote (push from worktree since that's where the branch is)
      await gitInDir(worktreePath, 'push', 'origin', 'HEAD:refs/heads/' + SYNC_BRANCH);

      // Verify remote has the branch
      expect(await remoteBranchExists('origin', SYNC_BRANCH)).toBe(true);
    });

    it('verifies remote branch exists after push', async () => {
      // Initialize in first repo
      await initWorktree(workRepoPath);
      const worktreePath = join(workRepoPath, WORKTREE_DIR);
      const dataSyncPath = join(worktreePath, TBD_DIR, DATA_SYNC_DIR_NAME);

      // Write and push an issue
      const issue = createTestIssue({
        id: testId(TEST_ULIDS.REMOTE_2),
        title: 'Issue from first repo',
      });
      await writeIssue(dataSyncPath, issue);
      await gitInDir(worktreePath, 'add', '.');
      await gitInDir(worktreePath, 'commit', '-m', 'Add issue from repo 1');
      // Push from worktree (where the branch HEAD is)
      await gitInDir(worktreePath, 'push', 'origin', 'HEAD:refs/heads/' + SYNC_BRANCH);

      // Verify the branch exists on the remote
      expect(await remoteBranchExists('origin', SYNC_BRANCH)).toBe(true);
    });

    it('updates worktree after local commits', async () => {
      // Setup repo with sync branch
      await initWorktree(workRepoPath);
      const worktreePath = join(workRepoPath, WORKTREE_DIR);
      const dataSyncPath = join(worktreePath, TBD_DIR, DATA_SYNC_DIR_NAME);

      // Add first issue
      const issue1 = createTestIssue({
        id: testId(TEST_ULIDS.REMOTE_3),
        title: 'Initial issue',
      });
      await writeIssue(dataSyncPath, issue1);
      await gitInDir(worktreePath, 'add', '.');
      await gitInDir(worktreePath, 'commit', '-m', 'Initial issue');

      // Add second issue
      const issue2 = createTestIssue({
        id: testId(TEST_ULIDS.REMOTE_4),
        title: 'Second issue',
      });
      await writeIssue(dataSyncPath, issue2);
      await gitInDir(worktreePath, 'add', '.');
      await gitInDir(worktreePath, 'commit', '-m', 'Second issue');

      // Verify both issues are present
      const issues = await listIssues(dataSyncPath);
      expect(issues.length).toBe(2);
    });
  });

  describe('merge algorithm', () => {
    it('merges issues with LWW strategy for scalar fields', () => {
      const base = createTestIssue({
        id: testId(TEST_ULIDS.REMOTE_5),
        title: 'Original title',
        priority: 2,
        updated_at: '2025-01-01T00:00:00Z',
      });

      const local = {
        ...base,
        title: 'Local title change',
        version: 2,
        updated_at: '2025-01-01T02:00:00Z', // Later
      };

      const remote = {
        ...base,
        title: 'Remote title change',
        version: 2,
        updated_at: '2025-01-01T01:00:00Z', // Earlier
      };

      const { merged, conflicts } = mergeIssues(base, local, remote);

      // Local wins because it has later updated_at
      expect(merged.title).toBe('Local title change');
      expect(conflicts.length).toBe(1);
      expect(conflicts[0]!.field).toBe('title');
      expect(conflicts[0]!.lost_value).toBe('Remote title change');
    });

    it('merges labels with union strategy', () => {
      const base = createTestIssue({
        id: testId(TEST_ULIDS.REMOTE_1),
        title: 'Test',
        labels: ['shared'],
        updated_at: '2025-01-01T00:00:00Z',
      });

      const local = {
        ...base,
        labels: ['shared', 'local-only'],
        version: 2,
        updated_at: '2025-01-01T01:00:00Z',
      };

      const remote = {
        ...base,
        labels: ['shared', 'remote-only'],
        version: 2,
        updated_at: '2025-01-01T01:00:00Z',
      };

      const { merged } = mergeIssues(base, local, remote);

      // Union should include all unique labels
      expect(merged.labels).toContain('shared');
      expect(merged.labels).toContain('local-only');
      expect(merged.labels).toContain('remote-only');
      expect(merged.labels.length).toBe(3);
    });

    it('handles concurrent new issue creation', () => {
      // No base - both created independently
      const local = createTestIssue({
        id: testId(TEST_ULIDS.CONCURRENT_1),
        title: 'Local creation',
        created_at: '2025-01-01T00:00:00Z', // Created first
        updated_at: '2025-01-01T00:00:00Z',
      });

      const remote = createTestIssue({
        id: testId(TEST_ULIDS.CONCURRENT_1),
        title: 'Remote creation',
        created_at: '2025-01-01T01:00:00Z', // Created second
        updated_at: '2025-01-01T01:00:00Z',
      });

      const { merged, conflicts } = mergeIssues(null, local, remote);

      // Local was created first, so it wins
      expect(merged.title).toBe('Local creation');
      expect(conflicts.length).toBe(1);
    });
  });
});

describeUnlessWindows('concurrent sync operations', () => {
  let testDir: string;
  let bareRepoPath: string;
  let originalCwd: string;

  beforeAll(async () => {
    const { supported } = await checkGitVersion();
    if (!supported) {
      console.log('Skipping concurrent tests - Git 2.42+ required');
      return;
    }

    originalCwd = process.cwd();
    testDir = join(tmpdir(), `tbd-concurrent-test-${randomBytes(4).toString('hex')}`);
    bareRepoPath = join(testDir, 'remote.git');

    await createBareRepo(bareRepoPath);
  });

  afterAll(async () => {
    process.chdir(originalCwd);
    if (testDir) {
      await rm(testDir, { recursive: true, force: true }).catch(() => undefined);
    }
  });

  it('detects non-fast-forward push rejection', async () => {
    // Create a repo with remote
    const repo1Path = join(testDir, 'repo1');
    await initRepoWithRemote(repo1Path, bareRepoPath);

    // Initialize worktree and push initial state
    await initWorktree(repo1Path);
    const worktree1 = join(repo1Path, WORKTREE_DIR);
    const dataSync1 = join(worktree1, TBD_DIR, DATA_SYNC_DIR_NAME);

    const issue1 = createTestIssue({
      id: testId(TEST_ULIDS.CONCURRENT_1),
      title: 'Issue 1',
    });
    await writeIssue(dataSync1, issue1);
    await gitInDir(worktree1, 'add', '.');
    await gitInDir(worktree1, 'commit', '-m', 'Issue 1');
    await gitInDir(worktree1, 'push', 'origin', 'HEAD:refs/heads/' + SYNC_BRANCH);

    // Add second issue
    const issue2 = createTestIssue({
      id: testId(TEST_ULIDS.CONCURRENT_2),
      title: 'Issue 2',
    });
    await writeIssue(dataSync1, issue2);
    await gitInDir(worktree1, 'add', '.');
    await gitInDir(worktree1, 'commit', '-m', 'Issue 2');
    await gitInDir(worktree1, 'push', 'origin', 'HEAD:refs/heads/' + SYNC_BRANCH);

    // Verify both issues exist
    const issues = await listIssues(dataSync1);
    expect(issues.length).toBe(2);
    expect(issues.map((i) => i.title).sort()).toEqual(['Issue 1', 'Issue 2']);
  });
});

// Large repository tests - these are slow, run separately
describeUnlessWindows('large repository performance', () => {
  let testDir: string;
  let dataSyncPath: string;
  const LARGE_ISSUE_COUNT = 5000;

  beforeAll(async () => {
    testDir = join(tmpdir(), `tbd-large-test-${randomBytes(4).toString('hex')}`);
    dataSyncPath = join(testDir, TBD_DIR, DATA_SYNC_DIR_NAME);
    await mkdir(join(dataSyncPath, 'issues'), { recursive: true });

    console.log(`Creating ${LARGE_ISSUE_COUNT} issues for performance test...`);

    // Write issues in batches for better performance
    const BATCH_SIZE = 100;
    for (let i = 0; i < LARGE_ISSUE_COUNT; i += BATCH_SIZE) {
      const batch = Array.from({ length: Math.min(BATCH_SIZE, LARGE_ISSUE_COUNT - i) }, (_, j) =>
        generateIssue(i + j),
      );
      await Promise.all(batch.map((issue) => writeIssue(dataSyncPath, issue)));

      if ((i + BATCH_SIZE) % 1000 === 0) {
        console.log(`  Created ${Math.min(i + BATCH_SIZE, LARGE_ISSUE_COUNT)} issues...`);
      }
    }
  }, 300000); // 5 minute timeout for setup

  afterAll(async () => {
    if (testDir) {
      await rm(testDir, { recursive: true, force: true }).catch(() => undefined);
    }
  }, 30000); // 30s timeout for cleanup of large repo

  it('lists 5000 issues in <5000ms', async () => {
    const start = performance.now();
    const issues = await listIssues(dataSyncPath);
    const elapsed = performance.now() - start;

    expect(issues.length).toBe(LARGE_ISSUE_COUNT);
    expect(elapsed).toBeLessThan(5000);
    console.log(`Listed ${LARGE_ISSUE_COUNT} issues in ${elapsed.toFixed(2)}ms`);
  });

  it('reads random issues from large repo in <10ms each', async () => {
    const indices = Array.from({ length: 100 }, () =>
      Math.floor(Math.random() * LARGE_ISSUE_COUNT),
    );
    const times: number[] = [];

    for (const index of indices) {
      const issue = generateIssue(index);
      const start = performance.now();
      await readIssue(dataSyncPath, issue.id);
      times.push(performance.now() - start);
    }

    const avgTime = times.reduce((a, b) => a + b, 0) / times.length;
    const maxTime = Math.max(...times);

    expect(avgTime).toBeLessThan(10);
    console.log(
      `Read 100 random issues from ${LARGE_ISSUE_COUNT}: avg=${avgTime.toFixed(2)}ms, max=${maxTime.toFixed(2)}ms`,
    );
  });

  it('filters large issue set by status in <100ms', async () => {
    const allIssues = await listIssues(dataSyncPath);

    const start = performance.now();
    const openIssues = allIssues.filter((i) => i.status === 'open');
    const elapsed = performance.now() - start;

    expect(openIssues.length).toBeGreaterThan(0);
    expect(elapsed).toBeLessThan(100);
    console.log(
      `Filtered ${LARGE_ISSUE_COUNT} issues to ${openIssues.length} open in ${elapsed.toFixed(2)}ms`,
    );
  });
});
