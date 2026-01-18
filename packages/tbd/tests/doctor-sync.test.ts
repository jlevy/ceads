/**
 * Tests for doctor and sync command logic.
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdir, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { randomBytes } from 'node:crypto';

import { writeIssue, listIssues } from '../src/file/storage.js';
import type { Issue } from '../src/lib/types.js';
import { DATA_SYNC_DIR, TBD_DIR } from '../src/lib/paths.js';
import { TEST_ULIDS, testId } from './test-helpers.js';

describe('doctor command logic', () => {
  let testDir: string;
  const issuesDir = DATA_SYNC_DIR;
  const configDir = TBD_DIR;

  beforeEach(async () => {
    testDir = join(tmpdir(), `tbd-doctor-test-${randomBytes(4).toString('hex')}`);
    await mkdir(join(testDir, issuesDir, 'issues'), { recursive: true });
    await mkdir(join(testDir, configDir), { recursive: true });
    process.chdir(testDir);
  });

  afterEach(async () => {
    process.chdir('/');
    await rm(testDir, { recursive: true, force: true });
  });

  it('detects orphaned dependencies', async () => {
    const issueId = testId(TEST_ULIDS.DOCTOR_1);
    const orphanTargetId = testId(TEST_ULIDS.DOCTOR_999);
    const issue1: Issue = {
      type: 'is',
      id: issueId,
      version: 1,
      kind: 'task',
      title: 'Task with orphan dep',
      status: 'open',
      priority: 2,
      labels: [],
      dependencies: [{ type: 'blocks', target: orphanTargetId }], // Non-existent target
      created_at: '2025-01-01T00:00:00Z',
      updated_at: '2025-01-01T00:00:00Z',
    };

    await writeIssue(issuesDir, issue1);

    const issues = await listIssues(issuesDir);
    const issueIds = new Set(issues.map((i) => i.id));
    const orphans: string[] = [];

    for (const issue of issues) {
      for (const dep of issue.dependencies) {
        if (!issueIds.has(dep.target)) {
          orphans.push(`${issue.id} -> ${dep.target}`);
        }
      }
    }

    expect(orphans.length).toBe(1);
    expect(orphans[0]).toBe(`${issueId} -> ${orphanTargetId}`);
  });

  it('detects duplicate IDs', async () => {
    const issue1Id = testId(TEST_ULIDS.DOCTOR_2);
    const issue2Id = testId(TEST_ULIDS.DOCTOR_3);
    const issue1: Issue = {
      type: 'is',
      id: issue1Id,
      version: 1,
      kind: 'task',
      title: 'First task',
      status: 'open',
      priority: 2,
      labels: [],
      dependencies: [],
      created_at: '2025-01-01T00:00:00Z',
      updated_at: '2025-01-01T00:00:00Z',
    };

    const issue2: Issue = {
      type: 'is',
      id: issue2Id,
      version: 1,
      kind: 'task',
      title: 'Second task',
      status: 'open',
      priority: 2,
      labels: [],
      dependencies: [],
      created_at: '2025-01-01T00:00:00Z',
      updated_at: '2025-01-01T00:00:00Z',
    };

    await writeIssue(issuesDir, issue1);
    await writeIssue(issuesDir, issue2);

    const issues = await listIssues(issuesDir);
    const seen = new Set<string>();
    const duplicates: string[] = [];

    for (const issue of issues) {
      if (seen.has(issue.id)) {
        duplicates.push(issue.id);
      }
      seen.add(issue.id);
    }

    // No duplicates when IDs are unique
    expect(duplicates.length).toBe(0);
  });

  it('validates issue fields', async () => {
    const issueId = testId(TEST_ULIDS.DOCTOR_4);
    const issue: Issue = {
      type: 'is',
      id: issueId,
      version: 1,
      kind: 'task',
      title: 'Valid task',
      status: 'open',
      priority: 2,
      labels: [],
      dependencies: [],
      created_at: '2025-01-01T00:00:00Z',
      updated_at: '2025-01-01T00:00:00Z',
    };

    await writeIssue(issuesDir, issue);

    const issues = await listIssues(issuesDir);
    const invalid: string[] = [];

    for (const iss of issues) {
      if (!iss.id || !iss.title || !iss.status || !iss.kind) {
        invalid.push(iss.id ?? 'unknown');
      }
      if (iss.id && !iss.id.startsWith('is-')) {
        invalid.push(iss.id);
      }
      if (iss.priority < 0 || iss.priority > 4) {
        invalid.push(iss.id);
      }
    }

    expect(invalid.length).toBe(0);
  });
});

describe('sync status logic', () => {
  let testDir: string;
  const issuesDir = DATA_SYNC_DIR;

  beforeEach(async () => {
    testDir = join(tmpdir(), `tbd-sync-test-${randomBytes(4).toString('hex')}`);
    await mkdir(join(testDir, issuesDir, 'issues'), { recursive: true });
    process.chdir(testDir);
  });

  afterEach(async () => {
    process.chdir('/');
    await rm(testDir, { recursive: true, force: true });
  });

  it('detects local issues', async () => {
    const issueId = testId(TEST_ULIDS.SYNC_1);
    const issue: Issue = {
      type: 'is',
      id: issueId,
      version: 1,
      kind: 'task',
      title: 'Local task',
      status: 'open',
      priority: 2,
      labels: [],
      dependencies: [],
      created_at: '2025-01-01T00:00:00Z',
      updated_at: '2025-01-01T00:00:00Z',
    };

    await writeIssue(issuesDir, issue);

    const issues = await listIssues(issuesDir);
    expect(issues.length).toBe(1);
    expect(issues[0]!.id).toBe(issueId);
  });
});
