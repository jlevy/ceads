/**
 * Tests for tree view utilities.
 */

import { describe, it, expect } from 'vitest';
import { buildIssueTree, renderIssueTree, countTreeIssues } from '../src/cli/lib/tree-view.js';
import { createColors } from '../src/cli/lib/output.js';
import { ISSUE_COLUMNS } from '../src/cli/lib/issue-format.js';
import type { IssueForDisplay } from '../src/cli/lib/issue-format.js';

// Use colors with 'never' to get predictable output without ANSI codes
const colors = createColors('never');

// Sample issues for testing
const sampleIssues: (IssueForDisplay & { parentId?: string })[] = [
  {
    id: 'bd-a1b2',
    priority: 0,
    status: 'blocked',
    kind: 'bug',
    title: 'Fix authentication timeout',
  },
  {
    id: 'bd-c3d4e5f6',
    priority: 2,
    status: 'open',
    kind: 'feature',
    title: 'Add dark mode',
  },
  {
    id: 'bd-x',
    priority: 1,
    status: 'in_progress',
    kind: 'task',
    title: 'Short ID issue',
  },
];

describe('buildIssueTree', () => {
  it('creates root nodes for issues without parents', () => {
    const roots = buildIssueTree(sampleIssues);
    expect(roots.length).toBe(3);
    expect(roots.map((r) => r.issue.id)).toEqual(['bd-a1b2', 'bd-c3d4e5f6', 'bd-x']);
  });

  it('nests children under parents', () => {
    const withParent = [
      {
        id: 'parent',
        priority: 1,
        status: 'open' as const,
        kind: 'epic' as const,
        title: 'Parent',
      },
      {
        id: 'child',
        priority: 2,
        status: 'open' as const,
        kind: 'task' as const,
        title: 'Child',
        parentId: 'parent',
      },
    ];
    const roots = buildIssueTree(withParent);
    expect(roots.length).toBe(1);
    expect(roots[0]!.children.length).toBe(1);
    expect(roots[0]!.children[0]!.issue.id).toBe('child');
  });
});

describe('renderIssueTree', () => {
  it('renders issues as formatted lines', () => {
    const roots = buildIssueTree(sampleIssues);
    const lines = renderIssueTree(roots, colors);
    expect(lines.length).toBe(3);
    expect(lines[0]).toContain('bd-a1b2');
    expect(lines[0]).toContain('[bug]');
  });

  it('pads ID column to consistent width for alignment', () => {
    const roots = buildIssueTree(sampleIssues);
    const lines = renderIssueTree(roots, colors);

    // All lines should have IDs padded to ISSUE_COLUMNS.ID width (12 characters)
    // Short ID 'bd-x' (4 chars) should be padded to 'bd-x        ' (12 chars)
    // This ensures columns align across different ID lengths
    for (const line of lines) {
      // Extract the first segment before double space (the ID column)
      const idMatch = /^(\S+\s*)\s{2}/.exec(line);
      if (idMatch) {
        const idCol = idMatch[1];
        expect(idCol!.length).toBe(ISSUE_COLUMNS.ID);
      }
    }
  });

  it('aligns columns regardless of ID length', () => {
    const roots = buildIssueTree(sampleIssues);
    const lines = renderIssueTree(roots, colors);

    // Get the position of P0/P1/P2 in each line - they should all be at the same offset
    const priPositions = lines.map((line) => {
      const match = /P\d/.exec(line);
      return match ? line.indexOf(match[0]) : -1;
    });

    // All priority columns should be at the same position
    const firstPos = priPositions[0];
    for (const pos of priPositions) {
      expect(pos).toBe(firstPos);
    }
  });

  it('renders tree connectors for children', () => {
    const withChild = [
      {
        id: 'parent',
        priority: 1,
        status: 'open' as const,
        kind: 'epic' as const,
        title: 'Parent',
      },
      {
        id: 'child',
        priority: 2,
        status: 'open' as const,
        kind: 'task' as const,
        title: 'Child',
        parentId: 'parent',
      },
    ];
    const roots = buildIssueTree(withChild);
    const lines = renderIssueTree(roots, colors);
    expect(lines.length).toBe(2);
    expect(lines[1]).toContain('└──');
  });
});

describe('countTreeIssues', () => {
  it('counts all issues including nested children', () => {
    const withChild = [
      {
        id: 'parent',
        priority: 1,
        status: 'open' as const,
        kind: 'epic' as const,
        title: 'Parent',
      },
      {
        id: 'child',
        priority: 2,
        status: 'open' as const,
        kind: 'task' as const,
        title: 'Child',
        parentId: 'parent',
      },
    ];
    const roots = buildIssueTree(withChild);
    expect(countTreeIssues(roots)).toBe(2);
  });

  it('counts deeply nested trees', () => {
    const nested = [
      { id: 'root', priority: 1, status: 'open' as const, kind: 'epic' as const, title: 'Root' },
      {
        id: 'level1',
        priority: 2,
        status: 'open' as const,
        kind: 'task' as const,
        title: 'Level 1',
        parentId: 'root',
      },
      {
        id: 'level2',
        priority: 2,
        status: 'open' as const,
        kind: 'task' as const,
        title: 'Level 2',
        parentId: 'level1',
      },
    ];
    const roots = buildIssueTree(nested);
    expect(countTreeIssues(roots)).toBe(3);
  });
});
