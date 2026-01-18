/**
 * Tests for workflow commands (ready, blocked, stale).
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdir, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { randomBytes } from 'node:crypto';

import { writeIssue, listIssues } from '../src/file/storage.js';
import type { Issue } from '../src/lib/types.js';
import { DATA_SYNC_DIR } from '../src/lib/paths.js';
import { TEST_ULIDS, testId } from './test-helpers.js';

describe('ready command logic', () => {
  let testDir: string;
  const issuesDir = DATA_SYNC_DIR;

  beforeEach(async () => {
    testDir = join(tmpdir(), `tbd-ready-test-${randomBytes(4).toString('hex')}`);
    await mkdir(join(testDir, issuesDir, 'issues'), { recursive: true });
    process.chdir(testDir);
  });

  afterEach(async () => {
    process.chdir('/');
    await rm(testDir, { recursive: true, force: true });
  });

  it('identifies ready issues (open, unassigned, unblocked)', async () => {
    const readyId = testId(TEST_ULIDS.READY_1);
    const assignedId = testId(TEST_ULIDS.READY_2);
    const inProgressId = testId(TEST_ULIDS.READY_3);

    // Ready issue - should be included
    const readyIssue: Issue = {
      type: 'is',
      id: readyId,
      version: 1,
      kind: 'task',
      title: 'Ready task',
      status: 'open',
      priority: 2,
      labels: [],
      dependencies: [],
      created_at: '2025-01-01T00:00:00Z',
      updated_at: '2025-01-01T00:00:00Z',
    };

    // Assigned issue - should be excluded
    const assignedIssue: Issue = {
      type: 'is',
      id: assignedId,
      version: 1,
      kind: 'task',
      title: 'Assigned task',
      status: 'open',
      priority: 1,
      labels: [],
      dependencies: [],
      created_at: '2025-01-01T00:00:00Z',
      updated_at: '2025-01-01T00:00:00Z',
      assignee: 'alice',
    };

    // In progress issue - should be excluded
    const inProgressIssue: Issue = {
      type: 'is',
      id: inProgressId,
      version: 1,
      kind: 'bug',
      title: 'In progress bug',
      status: 'in_progress',
      priority: 0,
      labels: [],
      dependencies: [],
      created_at: '2025-01-01T00:00:00Z',
      updated_at: '2025-01-01T00:00:00Z',
    };

    await writeIssue(issuesDir, readyIssue);
    await writeIssue(issuesDir, assignedIssue);
    await writeIssue(issuesDir, inProgressIssue);

    const issues = await listIssues(issuesDir);
    const issueMap = new Map(issues.map((i) => [i.id, i]));

    // Build reverse lookup for blockers
    const blockedByMap = new Map<string, string[]>();
    for (const issue of issues) {
      for (const dep of issue.dependencies) {
        if (dep.type === 'blocks') {
          const existing = blockedByMap.get(dep.target) ?? [];
          existing.push(issue.id);
          blockedByMap.set(dep.target, existing);
        }
      }
    }

    // Filter for ready issues using same logic as command
    const readyIssues = issues.filter((issue) => {
      if (issue.status !== 'open') return false;
      if (issue.assignee) return false;
      const blockers = blockedByMap.get(issue.id) ?? [];
      const hasUnresolvedBlocker = blockers.some((blockerId) => {
        const blocker = issueMap.get(blockerId);
        return blocker && blocker.status !== 'closed';
      });
      return !hasUnresolvedBlocker;
    });

    expect(readyIssues).toHaveLength(1);
    expect(readyIssues[0]!.id).toBe(readyId);
  });

  it('excludes issues with unresolved blockers', async () => {
    const blockerId = testId(TEST_ULIDS.BLOCKED_1);
    const blockedId = testId(TEST_ULIDS.BLOCKED_2);

    // Blocker issue (not closed) - has "blocks" dependency pointing to blocked issue
    const blockerIssue: Issue = {
      type: 'is',
      id: blockerId,
      version: 1,
      kind: 'task',
      title: 'Blocking task',
      status: 'in_progress',
      priority: 1,
      labels: [],
      dependencies: [{ type: 'blocks', target: blockedId }],
      created_at: '2025-01-01T00:00:00Z',
      updated_at: '2025-01-01T00:00:00Z',
    };

    // Blocked issue - should be excluded because blockerId blocks it
    const blockedIssue: Issue = {
      type: 'is',
      id: blockedId,
      version: 1,
      kind: 'task',
      title: 'Blocked task',
      status: 'open',
      priority: 2,
      labels: [],
      dependencies: [],
      created_at: '2025-01-01T00:00:00Z',
      updated_at: '2025-01-01T00:00:00Z',
    };

    await writeIssue(issuesDir, blockerIssue);
    await writeIssue(issuesDir, blockedIssue);

    const issues = await listIssues(issuesDir);

    // Build reverse lookup: which issues are blocked by which
    const blockedByMap = new Map<string, string[]>();
    for (const issue of issues) {
      for (const dep of issue.dependencies) {
        if (dep.type === 'blocks') {
          const existing = blockedByMap.get(dep.target) ?? [];
          existing.push(issue.id);
          blockedByMap.set(dep.target, existing);
        }
      }
    }
    const issueMap = new Map(issues.map((i) => [i.id, i]));

    const readyIssues = issues.filter((issue) => {
      if (issue.status !== 'open') return false;
      if (issue.assignee) return false;
      // Check if any other issue blocks this one
      const blockers = blockedByMap.get(issue.id) ?? [];
      const hasUnresolvedBlocker = blockers.some((blockerIdInner) => {
        const blocker = issueMap.get(blockerIdInner);
        return blocker && blocker.status !== 'closed';
      });
      return !hasUnresolvedBlocker;
    });

    expect(readyIssues).toHaveLength(0);
  });
});

describe('blocked command logic', () => {
  let testDir: string;
  const issuesDir = DATA_SYNC_DIR;

  beforeEach(async () => {
    testDir = join(tmpdir(), `tbd-blocked-test-${randomBytes(4).toString('hex')}`);
    await mkdir(join(testDir, issuesDir, 'issues'), { recursive: true });
    process.chdir(testDir);
  });

  afterEach(async () => {
    process.chdir('/');
    await rm(testDir, { recursive: true, force: true });
  });

  it('identifies explicitly blocked issues', async () => {
    const blockedId = testId(TEST_ULIDS.BLOCKED_3);
    const blockedIssue: Issue = {
      type: 'is',
      id: blockedId,
      version: 1,
      kind: 'task',
      title: 'Explicitly blocked',
      status: 'blocked',
      priority: 2,
      labels: [],
      dependencies: [],
      created_at: '2025-01-01T00:00:00Z',
      updated_at: '2025-01-01T00:00:00Z',
    };

    await writeIssue(issuesDir, blockedIssue);

    const issues = await listIssues(issuesDir);
    const blocked = issues.filter((i) => i.status === 'blocked');

    expect(blocked).toHaveLength(1);
    expect(blocked[0]!.title).toBe('Explicitly blocked');
  });

  it('identifies issues with unresolved dependencies', async () => {
    const blockerId = testId(TEST_ULIDS.WORKFLOW_1);
    const dependentId = testId(TEST_ULIDS.WORKFLOW_2);

    // Blocker issue with "blocks" pointing to dependent
    const blockerIssue: Issue = {
      type: 'is',
      id: blockerId,
      version: 1,
      kind: 'feature',
      title: 'Prerequisite feature',
      status: 'open',
      priority: 1,
      labels: [],
      dependencies: [{ type: 'blocks', target: dependentId }],
      created_at: '2025-01-01T00:00:00Z',
      updated_at: '2025-01-01T00:00:00Z',
    };

    // Dependent issue - is blocked by blockerId
    const dependentIssue: Issue = {
      type: 'is',
      id: dependentId,
      version: 1,
      kind: 'task',
      title: 'Dependent task',
      status: 'open',
      priority: 2,
      labels: [],
      dependencies: [],
      created_at: '2025-01-01T00:00:00Z',
      updated_at: '2025-01-01T00:00:00Z',
    };

    await writeIssue(issuesDir, blockerIssue);
    await writeIssue(issuesDir, dependentIssue);

    const issues = await listIssues(issuesDir);
    const issueMap = new Map(issues.map((i) => [i.id, i]));

    // Build reverse lookup: which issues are blocked by which
    const blockedByMap = new Map<string, string[]>();
    for (const issue of issues) {
      for (const dep of issue.dependencies) {
        if (dep.type === 'blocks') {
          const existing = blockedByMap.get(dep.target) ?? [];
          existing.push(issue.id);
          blockedByMap.set(dep.target, existing);
        }
      }
    }

    // Find issues that are blocked
    const blockedByDeps = issues.filter((issue) => {
      const blockers = blockedByMap.get(issue.id) ?? [];
      return blockers.some((blockerIdInner) => {
        const blocker = issueMap.get(blockerIdInner);
        return blocker && blocker.status !== 'closed';
      });
    });

    expect(blockedByDeps).toHaveLength(1);
    expect(blockedByDeps[0]!.id).toBe(dependentId);
  });
});

describe('stale command logic', () => {
  let testDir: string;
  const issuesDir = DATA_SYNC_DIR;

  beforeEach(async () => {
    testDir = join(tmpdir(), `tbd-stale-test-${randomBytes(4).toString('hex')}`);
    await mkdir(join(testDir, issuesDir, 'issues'), { recursive: true });
    process.chdir(testDir);
  });

  afterEach(async () => {
    process.chdir('/');
    await rm(testDir, { recursive: true, force: true });
  });

  it('identifies stale issues based on days threshold', async () => {
    const staleId = testId(TEST_ULIDS.STALE_1);
    const recentId = testId(TEST_ULIDS.STALE_2);

    const now = new Date();
    const tenDaysAgo = new Date(now.getTime() - 10 * 24 * 60 * 60 * 1000);
    const twoDaysAgo = new Date(now.getTime() - 2 * 24 * 60 * 60 * 1000);

    const staleIssue: Issue = {
      type: 'is',
      id: staleId,
      version: 1,
      kind: 'task',
      title: 'Old task',
      status: 'open',
      priority: 2,
      labels: [],
      dependencies: [],
      created_at: tenDaysAgo.toISOString(),
      updated_at: tenDaysAgo.toISOString(),
    };

    const recentIssue: Issue = {
      type: 'is',
      id: recentId,
      version: 1,
      kind: 'task',
      title: 'Recent task',
      status: 'open',
      priority: 2,
      labels: [],
      dependencies: [],
      created_at: twoDaysAgo.toISOString(),
      updated_at: twoDaysAgo.toISOString(),
    };

    await writeIssue(issuesDir, staleIssue);
    await writeIssue(issuesDir, recentIssue);

    const issues = await listIssues(issuesDir);
    const daysThreshold = 7;
    const msPerDay = 24 * 60 * 60 * 1000;

    const staleIssues = issues.filter((issue) => {
      const updatedAt = new Date(issue.updated_at);
      const daysSinceUpdate = Math.floor((now.getTime() - updatedAt.getTime()) / msPerDay);
      return daysSinceUpdate >= daysThreshold;
    });

    expect(staleIssues).toHaveLength(1);
    expect(staleIssues[0]!.id).toBe(staleId);
  });

  it('filters by status', async () => {
    const staleOpenId = testId(TEST_ULIDS.STALE_3);
    const staleClosedId = testId(TEST_ULIDS.STALE_4);

    const tenDaysAgo = new Date(Date.now() - 10 * 24 * 60 * 60 * 1000);

    const staleOpenIssue: Issue = {
      type: 'is',
      id: staleOpenId,
      version: 1,
      kind: 'task',
      title: 'Old open task',
      status: 'open',
      priority: 2,
      labels: [],
      dependencies: [],
      created_at: tenDaysAgo.toISOString(),
      updated_at: tenDaysAgo.toISOString(),
    };

    const staleClosedIssue: Issue = {
      type: 'is',
      id: staleClosedId,
      version: 2,
      kind: 'task',
      title: 'Old closed task',
      status: 'closed',
      priority: 2,
      labels: [],
      dependencies: [],
      created_at: tenDaysAgo.toISOString(),
      updated_at: tenDaysAgo.toISOString(),
      closed_at: tenDaysAgo.toISOString(),
    };

    await writeIssue(issuesDir, staleOpenIssue);
    await writeIssue(issuesDir, staleClosedIssue);

    const issues = await listIssues(issuesDir);
    const now = new Date();
    const msPerDay = 24 * 60 * 60 * 1000;
    const daysThreshold = 7;

    // Filter to only open issues (default behavior)
    const staleOpen = issues.filter((issue) => {
      if (issue.status !== 'open' && issue.status !== 'in_progress') return false;
      const updatedAt = new Date(issue.updated_at);
      const daysSinceUpdate = Math.floor((now.getTime() - updatedAt.getTime()) / msPerDay);
      return daysSinceUpdate >= daysThreshold;
    });

    expect(staleOpen).toHaveLength(1);
    expect(staleOpen[0]!.id).toBe(staleOpenId);
  });
});
