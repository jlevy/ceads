/**
 * Tests for doctor and sync command logic.
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdir, rm, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { randomBytes } from 'node:crypto';

import { writeIssue, listIssues } from '../src/file/storage.js';
import { loadIdMapping, saveIdMapping } from '../src/file/id-mapping.js';
import type { Issue } from '../src/lib/types.js';
import { DATA_SYNC_DIR, TBD_DIR } from '../src/lib/paths.js';
import { detectDuplicateYamlKeys } from '../src/utils/yaml-utils.js';
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

  it('detects duplicate keys in ids.yml (merge conflict resolution bug)', async () => {
    // Simulate the exact bug: after resolving a merge conflict in ids.yml,
    // both sides' entries are kept, creating duplicate YAML keys.
    const mappingsDir = join(testDir, issuesDir, 'mappings');
    await mkdir(mappingsDir, { recursive: true });

    const idsYmlWithDuplicates = `5j0r: 01aaaaaaaaaaaaaaaaaaaaaa01
a1b2: 01aaaaaaaaaaaaaaaaaaaaaa02
c3d4: 01aaaaaaaaaaaaaaaaaaaaaa03
5j0r: 01aaaaaaaaaaaaaaaaaaaaaa01
vb4g: 01aaaaaaaaaaaaaaaaaaaaaa04
vb4g: 01aaaaaaaaaaaaaaaaaaaaaa04`;

    await writeFile(join(mappingsDir, 'ids.yml'), idsYmlWithDuplicates);

    // detectDuplicateYamlKeys should find the duplicates
    const duplicates = detectDuplicateYamlKeys(idsYmlWithDuplicates);
    expect(duplicates).toContain('5j0r');
    expect(duplicates).toContain('vb4g');
    expect(duplicates).toHaveLength(2);

    // loadIdMapping should NOT throw (the fix)
    const mapping = await loadIdMapping(join(testDir, issuesDir));
    expect(mapping.shortToUlid.size).toBe(4); // 5j0r, a1b2, c3d4, vb4g

    // Re-saving should deduplicate the file
    await saveIdMapping(join(testDir, issuesDir), mapping);

    // Read back and verify no more duplicates
    const { readFile: rf } = await import('node:fs/promises');
    const fixedContent = await rf(join(mappingsDir, 'ids.yml'), 'utf-8');
    const fixedDuplicates = detectDuplicateYamlKeys(fixedContent);
    expect(fixedDuplicates).toEqual([]);
  });
});

describe('checkRepoCacheHealth', () => {
  let testDir: string;

  beforeEach(async () => {
    testDir = join(tmpdir(), `tbd-repocache-test-${randomBytes(4).toString('hex')}`);
    await mkdir(join(testDir, '.tbd'), { recursive: true });
  });

  afterEach(async () => {
    await rm(testDir, { recursive: true, force: true });
  });

  it('returns ok with no repo sources', async () => {
    const { checkRepoCacheHealth } = await import('../src/cli/commands/doctor.js');
    const result = await checkRepoCacheHealth(testDir, []);
    expect(result.status).toBe('ok');
    expect(result.message).toContain('no repo sources');
  });

  it('warns when repo source cache dir is missing', async () => {
    const { checkRepoCacheHealth } = await import('../src/cli/commands/doctor.js');
    const sources = [
      {
        type: 'repo' as const,
        prefix: 'ext',
        url: 'https://github.com/org/repo',
        ref: 'main',
        paths: ['guidelines'],
      },
    ];
    const result = await checkRepoCacheHealth(testDir, sources);
    expect(result.status).toBe('warn');
    expect(result.message).toContain('missing');
    expect(result.suggestion).toContain('tbd sync --docs');
  });

  it('returns ok when repo cache dir exists', async () => {
    const { checkRepoCacheHealth } = await import('../src/cli/commands/doctor.js');
    const { repoUrlToSlug } = await import('../src/lib/repo-url.js');
    const url = 'https://github.com/org/repo';
    const slug = repoUrlToSlug(url);
    await mkdir(join(testDir, '.tbd', 'repo-cache', slug), { recursive: true });
    const sources = [
      { type: 'repo' as const, prefix: 'ext', url, ref: 'main', paths: ['guidelines'] },
    ];
    const result = await checkRepoCacheHealth(testDir, sources);
    expect(result.status).toBe('ok');
  });

  it('warns about orphaned cache dirs', async () => {
    const { checkRepoCacheHealth } = await import('../src/cli/commands/doctor.js');
    // Create a cache dir that's not referenced by any source
    await mkdir(join(testDir, '.tbd', 'repo-cache', 'orphaned-slug'), { recursive: true });
    const result = await checkRepoCacheHealth(testDir, []);
    expect(result.status).toBe('warn');
    expect(result.details).toBeDefined();
    expect(result.details!.some((d: string) => d.includes('orphaned'))).toBe(true);
  });

  it('skips internal sources', async () => {
    const { checkRepoCacheHealth } = await import('../src/cli/commands/doctor.js');
    const sources = [{ type: 'internal' as const, prefix: 'sys', paths: ['shortcuts'] }];
    const result = await checkRepoCacheHealth(testDir, sources);
    expect(result.status).toBe('ok');
    expect(result.message).toContain('no repo sources');
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
