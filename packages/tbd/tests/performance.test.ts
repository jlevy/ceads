/**
 * Performance tests for tbd.
 *
 * These tests verify that operations complete within acceptable time limits
 * when working with large numbers of issues (1000+).
 *
 * Performance targets:
 * - List 1000 issues: <100ms
 * - Search 1000 issues: <200ms
 * - Write single issue: <200ms (first write can be slow due to disk caching)
 */

import { describe, it, expect, beforeEach, afterEach, beforeAll, afterAll } from 'vitest';
import { mkdtemp, rm, mkdir } from 'node:fs/promises';
import { tmpdir, platform } from 'node:os';
import { join } from 'node:path';

// Windows file I/O is significantly slower, skip bulk write tests there
const isWindows = platform() === 'win32';
const describeUnlessWindows = isWindows ? describe.skip : describe;
import { writeIssue, listIssues, readIssue } from '../src/file/storage.js';
import type { Issue } from '../src/lib/types.js';

// Helper to generate test issues with valid ULID format
// ULID format: 26 lowercase alphanumeric chars
function generateTestIssue(index: number): Issue {
  // Generate a valid 26-char ULID-like ID: 01perf + 4 digit index (0-padded) + 16 zeros
  // Example: 01perf0000000000000000000 for index 0
  const indexPart = String(index).padStart(4, '0');
  const ulid = `01perf${indexPart}0000000000000000`.slice(0, 26);

  return {
    type: 'is',
    id: `is-${ulid}`,
    version: 1,
    kind: index % 3 === 0 ? 'bug' : index % 3 === 1 ? 'task' : 'epic',
    title: `Test issue ${index} for performance testing`,
    description: `Description for issue ${index}. This is a longer description to simulate real-world usage with various content.`,
    status: index % 5 === 0 ? 'closed' : index % 4 === 0 ? 'in_progress' : 'open',
    priority: (index % 4) as 0 | 1 | 2 | 3,
    labels: index % 2 === 0 ? ['label-a', 'label-b'] : ['label-c'],
    dependencies: [],
    created_at: new Date(Date.now() - index * 1000 * 60).toISOString(),
    updated_at: new Date(Date.now() - index * 500 * 60).toISOString(),
  };
}

// Helper to measure execution time
async function measureTime<T>(fn: () => Promise<T>): Promise<{ result: T; ms: number }> {
  const start = performance.now();
  const result = await fn();
  const ms = performance.now() - start;
  return { result, ms };
}

describe('performance tests', () => {
  let tempDir: string;
  const ISSUE_COUNT = 1000;

  beforeEach(async () => {
    tempDir = await mkdtemp(join(tmpdir(), 'tbd-perf-'));
    await mkdir(join(tempDir, 'issues'), { recursive: true });
  });

  afterEach(async () => {
    // Windows may have file locking issues, retry cleanup with backoff
    for (let attempt = 0; attempt < 3; attempt++) {
      try {
        await rm(tempDir, { recursive: true, force: true });
        break;
      } catch {
        if (attempt < 2) await new Promise((r) => setTimeout(r, 100 * (attempt + 1)));
      }
    }
  });

  describe('write performance', () => {
    it('writes single issue in <200ms', async () => {
      const issue = generateTestIssue(1);
      const { ms } = await measureTime(() => writeIssue(tempDir, issue));

      // Allow 500ms on Windows CI (slower file I/O, cold start), 200ms elsewhere
      // First write can be slow due to filesystem caching and disk variance
      expect(ms).toBeLessThan(isWindows ? 500 : 200);
    });

    it('writes 100 issues in <3000ms (30ms avg)', async () => {
      const issues = Array.from({ length: 100 }, (_, i) => generateTestIssue(i));

      const { ms } = await measureTime(async () => {
        for (const issue of issues) {
          await writeIssue(tempDir, issue);
        }
      });

      // Allow 5000ms on Windows CI (slower file I/O), 3000ms elsewhere
      expect(ms).toBeLessThan(isWindows ? 5000 : 3000);
      const avgMs = ms / 100;
      // Log average for visibility in test output
      console.log(`Average write time: ${avgMs.toFixed(2)}ms per issue`);
    });
  });

  // These tests require writing 1000 files, use beforeAll to do it once per describe block
  describeUnlessWindows('read performance', () => {
    let readTestDir: string;

    beforeAll(async () => {
      // Create a dedicated temp directory for read tests
      readTestDir = await mkdtemp(join(tmpdir(), 'tbd-perf-read-'));
      await mkdir(join(readTestDir, 'issues'), { recursive: true });

      // Pre-populate with issues for read tests (write in batches to avoid overwhelming I/O)
      const issues = Array.from({ length: ISSUE_COUNT }, (_, i) => generateTestIssue(i));
      const BATCH_SIZE = 50;
      for (let i = 0; i < issues.length; i += BATCH_SIZE) {
        const batch = issues.slice(i, i + BATCH_SIZE);
        await Promise.all(batch.map((issue) => writeIssue(readTestDir, issue)));
      }
    }, 60000); // 60s timeout for setup

    afterAll(async () => {
      if (readTestDir) {
        await rm(readTestDir, { recursive: true, force: true }).catch(() => undefined);
      }
    });

    it('lists 1000 issues in <2000ms', async () => {
      const { result, ms } = await measureTime(() => listIssues(readTestDir));

      expect(result).toHaveLength(ISSUE_COUNT);
      // Allow up to 2s for CI environments; local should be <500ms
      expect(ms).toBeLessThan(2000);
      console.log(`Listed ${ISSUE_COUNT} issues in ${ms.toFixed(2)}ms`);
    });

    it('reads single issue in <20ms', async () => {
      const issueId = generateTestIssue(500).id;
      const { ms } = await measureTime(() => readIssue(readTestDir, issueId));

      expect(ms).toBeLessThan(20);
    });

    it('reads 100 random issues in <500ms', async () => {
      const indices = Array.from({ length: 100 }, () => Math.floor(Math.random() * ISSUE_COUNT));
      const issueIds = indices.map((i) => generateTestIssue(i).id);

      const { ms } = await measureTime(async () => {
        for (const id of issueIds) {
          await readIssue(readTestDir, id);
        }
      });

      expect(ms).toBeLessThan(500);
      console.log(`Read 100 random issues in ${ms.toFixed(2)}ms (${(ms / 100).toFixed(2)}ms avg)`);
    });
  });

  // These tests require writing 1000 files, use beforeAll to do it once per describe block
  describeUnlessWindows('listing with filtering', () => {
    let filterTestDir: string;

    beforeAll(async () => {
      // Create a dedicated temp directory for filter tests
      filterTestDir = await mkdtemp(join(tmpdir(), 'tbd-perf-filter-'));
      await mkdir(join(filterTestDir, 'issues'), { recursive: true });

      // Pre-populate with issues (write in batches to avoid overwhelming I/O)
      const issues = Array.from({ length: ISSUE_COUNT }, (_, i) => generateTestIssue(i));
      const BATCH_SIZE = 50;
      for (let i = 0; i < issues.length; i += BATCH_SIZE) {
        const batch = issues.slice(i, i + BATCH_SIZE);
        await Promise.all(batch.map((issue) => writeIssue(filterTestDir, issue)));
      }
    }, 60000); // 60s timeout for setup

    afterAll(async () => {
      if (filterTestDir) {
        await rm(filterTestDir, { recursive: true, force: true }).catch(() => undefined);
      }
    });

    it('filters 1000 issues by status in-memory in <50ms', async () => {
      // First list all issues
      const allIssues = await listIssues(filterTestDir);

      // Then filter in memory (simulating what commands do)
      const { result, ms } = await measureTime(() => {
        return Promise.resolve(allIssues.filter((i) => i.status === 'open'));
      });

      expect(result.length).toBeGreaterThan(0);
      expect(ms).toBeLessThan(50);
      console.log(`Filtered to ${result.length} open issues in ${ms.toFixed(2)}ms`);
    });

    it('sorts 1000 issues by priority in <50ms', async () => {
      const allIssues = await listIssues(filterTestDir);

      const { result, ms } = await measureTime(() => {
        return Promise.resolve([...allIssues].sort((a, b) => a.priority - b.priority));
      });

      expect(result).toHaveLength(ISSUE_COUNT);
      expect(ms).toBeLessThan(50);
      console.log(`Sorted ${ISSUE_COUNT} issues by priority in ${ms.toFixed(2)}ms`);
    });
  });
});
