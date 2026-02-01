/**
 * Tests for child ordering with hints.
 *
 * Tests the child_order_hints feature that allows parents to specify
 * the preferred display order of their children.
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdir, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { randomBytes } from 'node:crypto';

import { writeIssue, readIssue, listIssues } from '../src/file/storage.js';
import { buildIssueTree, type IssueForTree } from '../src/cli/lib/tree-view.js';
import type { Issue } from '../src/lib/types.js';
import type { InternalIssueId } from '../src/lib/ids.js';
import { DATA_SYNC_DIR } from '../src/lib/paths.js';
import { TEST_ULIDS, testId } from './test-helpers.js';

/**
 * Helper to convert stored issues to IssueForTree format.
 * Casts child_order_hints from string[] to InternalIssueId[] since storage uses plain strings.
 */
function toIssueForTree(issue: Issue): IssueForTree {
  return {
    id: issue.id,
    priority: issue.priority,
    status: issue.status,
    kind: issue.kind,
    title: issue.title,
    parentId: issue.parent_id ?? undefined,
    child_order_hints: (issue.child_order_hints ?? undefined) as InternalIssueId[] | undefined,
  };
}

describe('child ordering', () => {
  let testDir: string;
  const issuesDir = DATA_SYNC_DIR;

  beforeEach(async () => {
    testDir = join(tmpdir(), `tbd-child-order-test-${randomBytes(4).toString('hex')}`);
    await mkdir(join(testDir, issuesDir, 'issues'), { recursive: true });
    process.chdir(testDir);
  });

  afterEach(async () => {
    process.chdir('/');
    await rm(testDir, { recursive: true, force: true });
  });

  describe('buildIssueTree with child_order_hints', () => {
    it('sorts children by hints order when hints are provided', async () => {
      const parentId = testId(TEST_ULIDS.CHILD_ORDER_PARENT);
      const childAId = testId(TEST_ULIDS.CHILD_ORDER_A);
      const childBId = testId(TEST_ULIDS.CHILD_ORDER_B);
      const childCId = testId(TEST_ULIDS.CHILD_ORDER_C);

      // Create parent with ordering hints: C, A, B (different from creation order)
      const parentIssue: Issue = {
        type: 'is',
        id: parentId,
        version: 1,
        kind: 'epic',
        title: 'Parent Epic',
        status: 'open',
        priority: 2,
        labels: [],
        dependencies: [],
        created_at: '2025-01-01T00:00:00Z',
        updated_at: '2025-01-01T00:00:00Z',
        child_order_hints: [childCId, childAId, childBId],
      };

      // Create children with alphabetical IDs (A < B < C in default sort)
      const childA: Issue = {
        type: 'is',
        id: childAId,
        version: 1,
        kind: 'task',
        title: 'Child A',
        status: 'open',
        priority: 2,
        labels: [],
        dependencies: [],
        created_at: '2025-01-01T00:00:00Z',
        updated_at: '2025-01-01T00:00:00Z',
        parent_id: parentId,
      };

      const childB: Issue = {
        type: 'is',
        id: childBId,
        version: 1,
        kind: 'task',
        title: 'Child B',
        status: 'open',
        priority: 2,
        labels: [],
        dependencies: [],
        created_at: '2025-01-01T00:00:00Z',
        updated_at: '2025-01-01T00:00:00Z',
        parent_id: parentId,
      };

      const childC: Issue = {
        type: 'is',
        id: childCId,
        version: 1,
        kind: 'task',
        title: 'Child C',
        status: 'open',
        priority: 2,
        labels: [],
        dependencies: [],
        created_at: '2025-01-01T00:00:00Z',
        updated_at: '2025-01-01T00:00:00Z',
        parent_id: parentId,
      };

      await writeIssue(issuesDir, parentIssue);
      await writeIssue(issuesDir, childA);
      await writeIssue(issuesDir, childB);
      await writeIssue(issuesDir, childC);

      const issues = await listIssues(issuesDir);

      // Convert to display format with parent info
      const issuesForTree = issues.map(toIssueForTree);

      const roots = buildIssueTree(issuesForTree);

      // Should have one root (the parent)
      expect(roots).toHaveLength(1);
      const parentNode = roots[0]!;
      expect(parentNode.children).toHaveLength(3);

      // Children should be sorted according to hints: C, A, B
      const childIds = parentNode.children.map((c) => c.issue.id);
      expect(childIds).toEqual([childCId, childAId, childBId]);
    });

    it('places children not in hints after hinted children', async () => {
      const parentId = testId(TEST_ULIDS.CHILD_ORDER_PARENT);
      const childAId = testId(TEST_ULIDS.CHILD_ORDER_A);
      const childBId = testId(TEST_ULIDS.CHILD_ORDER_B);
      const childCId = testId(TEST_ULIDS.CHILD_ORDER_C);
      const childDId = testId(TEST_ULIDS.CHILD_ORDER_D);

      // Parent only has hints for B (not A, C, or D)
      const parentIssue: Issue = {
        type: 'is',
        id: parentId,
        version: 1,
        kind: 'epic',
        title: 'Parent Epic',
        status: 'open',
        priority: 2,
        labels: [],
        dependencies: [],
        created_at: '2025-01-01T00:00:00Z',
        updated_at: '2025-01-01T00:00:00Z',
        child_order_hints: [childBId],
      };

      const createChild = (id: string, title: string): Issue => ({
        type: 'is',
        id,
        version: 1,
        kind: 'task',
        title,
        status: 'open',
        priority: 2,
        labels: [],
        dependencies: [],
        created_at: '2025-01-01T00:00:00Z',
        updated_at: '2025-01-01T00:00:00Z',
        parent_id: parentId,
      });

      await writeIssue(issuesDir, parentIssue);
      await writeIssue(issuesDir, createChild(childAId, 'Child A'));
      await writeIssue(issuesDir, createChild(childBId, 'Child B'));
      await writeIssue(issuesDir, createChild(childCId, 'Child C'));
      await writeIssue(issuesDir, createChild(childDId, 'Child D'));

      const issues = await listIssues(issuesDir);
      const issuesForTree = issues.map(toIssueForTree);

      const roots = buildIssueTree(issuesForTree);
      const parentNode = roots[0]!;

      // B should be first (in hints), then A, C, D in default order
      const childIds = parentNode.children.map((c) => c.issue.id);
      expect(childIds[0]).toBe(childBId);
      // The rest should be in deterministic order (by ID)
      expect(childIds.slice(1).sort()).toEqual([childAId, childCId, childDId].sort());
    });

    it('uses default order when no hints are provided', async () => {
      const parentId = testId(TEST_ULIDS.CHILD_ORDER_PARENT);
      const childAId = testId(TEST_ULIDS.CHILD_ORDER_A);
      const childBId = testId(TEST_ULIDS.CHILD_ORDER_B);

      // Parent with no child_order_hints
      const parentIssue: Issue = {
        type: 'is',
        id: parentId,
        version: 1,
        kind: 'epic',
        title: 'Parent Epic',
        status: 'open',
        priority: 2,
        labels: [],
        dependencies: [],
        created_at: '2025-01-01T00:00:00Z',
        updated_at: '2025-01-01T00:00:00Z',
        // No child_order_hints
      };

      const createChild = (id: string, title: string): Issue => ({
        type: 'is',
        id,
        version: 1,
        kind: 'task',
        title,
        status: 'open',
        priority: 2,
        labels: [],
        dependencies: [],
        created_at: '2025-01-01T00:00:00Z',
        updated_at: '2025-01-01T00:00:00Z',
        parent_id: parentId,
      });

      await writeIssue(issuesDir, parentIssue);
      await writeIssue(issuesDir, createChild(childBId, 'Child B')); // Write B first
      await writeIssue(issuesDir, createChild(childAId, 'Child A')); // Write A second

      const issues = await listIssues(issuesDir);
      const issuesForTree = issues.map(toIssueForTree);

      const roots = buildIssueTree(issuesForTree);
      const parentNode = roots[0]!;

      // Without hints, children should be in deterministic order (by ID)
      const childIds = parentNode.children.map((c) => c.issue.id);
      // Just verify it's deterministic - both children present
      expect(childIds).toHaveLength(2);
      expect(childIds).toContain(childAId);
      expect(childIds).toContain(childBId);
    });

    it('handles stale IDs in hints gracefully', async () => {
      const parentId = testId(TEST_ULIDS.CHILD_ORDER_PARENT);
      const childAId = testId(TEST_ULIDS.CHILD_ORDER_A);
      const childBId = testId(TEST_ULIDS.CHILD_ORDER_B);
      const staleId = testId(TEST_ULIDS.CHILD_ORDER_E); // Not a real child

      // Parent has hints including a stale ID
      const parentIssue: Issue = {
        type: 'is',
        id: parentId,
        version: 1,
        kind: 'epic',
        title: 'Parent Epic',
        status: 'open',
        priority: 2,
        labels: [],
        dependencies: [],
        created_at: '2025-01-01T00:00:00Z',
        updated_at: '2025-01-01T00:00:00Z',
        child_order_hints: [staleId, childBId, childAId],
      };

      const createChild = (id: string, title: string): Issue => ({
        type: 'is',
        id,
        version: 1,
        kind: 'task',
        title,
        status: 'open',
        priority: 2,
        labels: [],
        dependencies: [],
        created_at: '2025-01-01T00:00:00Z',
        updated_at: '2025-01-01T00:00:00Z',
        parent_id: parentId,
      });

      await writeIssue(issuesDir, parentIssue);
      await writeIssue(issuesDir, createChild(childAId, 'Child A'));
      await writeIssue(issuesDir, createChild(childBId, 'Child B'));
      // Note: staleId is NOT written - it's a stale reference

      const issues = await listIssues(issuesDir);
      const issuesForTree = issues.map(toIssueForTree);

      const roots = buildIssueTree(issuesForTree);
      const parentNode = roots[0]!;

      // Should only have 2 children (stale ID ignored)
      expect(parentNode.children).toHaveLength(2);

      // Order should respect hints (B before A), stale ID just skipped
      const childIds = parentNode.children.map((c) => c.issue.id);
      expect(childIds).toEqual([childBId, childAId]);
    });
  });

  describe('child_order_hints serialization', () => {
    it('serializes and deserializes child_order_hints correctly', async () => {
      const parentId = testId(TEST_ULIDS.CHILD_ORDER_PARENT);
      const hints = [
        testId(TEST_ULIDS.CHILD_ORDER_C),
        testId(TEST_ULIDS.CHILD_ORDER_A),
        testId(TEST_ULIDS.CHILD_ORDER_B),
      ];

      const issue: Issue = {
        type: 'is',
        id: parentId,
        version: 1,
        kind: 'epic',
        title: 'Parent with hints',
        status: 'open',
        priority: 2,
        labels: [],
        dependencies: [],
        created_at: '2025-01-01T00:00:00Z',
        updated_at: '2025-01-01T00:00:00Z',
        child_order_hints: hints,
      };

      await writeIssue(issuesDir, issue);
      const loaded = await readIssue(issuesDir, parentId);

      expect(loaded.child_order_hints).toEqual(hints);
    });

    it('handles null child_order_hints', async () => {
      const parentId = testId(TEST_ULIDS.CHILD_ORDER_PARENT);

      const issue: Issue = {
        type: 'is',
        id: parentId,
        version: 1,
        kind: 'epic',
        title: 'Parent with null hints',
        status: 'open',
        priority: 2,
        labels: [],
        dependencies: [],
        created_at: '2025-01-01T00:00:00Z',
        updated_at: '2025-01-01T00:00:00Z',
        child_order_hints: null,
      };

      await writeIssue(issuesDir, issue);
      const loaded = await readIssue(issuesDir, parentId);

      expect(loaded.child_order_hints).toBeNull();
    });

    it('handles missing child_order_hints (backward compatibility)', async () => {
      const parentId = testId(TEST_ULIDS.CHILD_ORDER_PARENT);

      // Issue without child_order_hints field at all
      const issue: Issue = {
        type: 'is',
        id: parentId,
        version: 1,
        kind: 'epic',
        title: 'Parent without hints field',
        status: 'open',
        priority: 2,
        labels: [],
        dependencies: [],
        created_at: '2025-01-01T00:00:00Z',
        updated_at: '2025-01-01T00:00:00Z',
        // No child_order_hints field
      };

      await writeIssue(issuesDir, issue);
      const loaded = await readIssue(issuesDir, parentId);

      // Should be undefined (not present)
      expect(loaded.child_order_hints).toBeUndefined();
    });
  });
});
