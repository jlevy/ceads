/**
 * Tests for issue formatting utilities.
 */

import { describe, it, expect } from 'vitest';
import {
  ISSUE_COLUMNS,
  formatKind,
  formatIssueLine,
  formatIssueLineExtended,
  formatIssueWithLabels,
  formatIssueCompact,
  formatIssueInline,
  formatIssueHeader,
  formatIssueLong,
  wrapDescription,
} from '../src/cli/lib/issueFormat.js';
import { createColors } from '../src/cli/lib/output.js';

// Use colors with 'never' to get predictable output without ANSI codes
const colors = createColors('never');

// Sample issue data for testing
const sampleIssue = {
  id: 'bd-a1b2',
  priority: 0,
  status: 'blocked' as const,
  kind: 'bug' as const,
  title: 'Fix authentication timeout',
  description: 'Users report 30s delays when logging in.',
  labels: ['urgent', 'security'],
  assignee: 'alice',
};

describe('ISSUE_COLUMNS', () => {
  it('has correct column widths', () => {
    expect(ISSUE_COLUMNS.ID).toBe(12);
    expect(ISSUE_COLUMNS.PRIORITY).toBe(5);
    expect(ISSUE_COLUMNS.STATUS).toBe(16);
    expect(ISSUE_COLUMNS.ASSIGNEE).toBe(10);
  });
});

describe('formatKind', () => {
  it('formats bug in brackets', () => {
    expect(formatKind('bug')).toBe('[bug]');
  });

  it('formats feature in brackets', () => {
    expect(formatKind('feature')).toBe('[feature]');
  });

  it('formats task in brackets', () => {
    expect(formatKind('task')).toBe('[task]');
  });

  it('formats epic in brackets', () => {
    expect(formatKind('epic')).toBe('[epic]');
  });
});

describe('formatIssueLine', () => {
  it('formats issue with all columns', () => {
    const result = formatIssueLine(sampleIssue, colors);
    // ID (12) + PRI (5) + STATUS (16) + kind + title
    expect(result).toContain('bd-a1b2');
    expect(result).toContain('P0');
    expect(result).toContain('● blocked');
    expect(result).toContain('[bug]');
    expect(result).toContain('Fix authentication timeout');
  });

  it('pads columns to correct widths', () => {
    const result = formatIssueLine(sampleIssue, colors);
    // ID should be padded to 12 chars
    expect(result.startsWith('bd-a1b2     ')).toBe(true);
  });
});

describe('formatIssueLineExtended', () => {
  it('includes assignee column', () => {
    const result = formatIssueLineExtended(sampleIssue, colors);
    expect(result).toContain('@alice');
    expect(result).toContain('[bug]');
    expect(result).toContain('Fix authentication timeout');
  });

  it('shows dash when no assignee', () => {
    const issueNoAssignee = { ...sampleIssue, assignee: undefined };
    const result = formatIssueLineExtended(issueNoAssignee, colors);
    expect(result).toContain('-');
  });
});

describe('formatIssueWithLabels', () => {
  it('includes labels after title', () => {
    const result = formatIssueWithLabels(sampleIssue, colors);
    expect(result).toContain('[bug] Fix authentication timeout');
    expect(result).toContain('[urgent, security]');
  });

  it('omits labels section when no labels', () => {
    const issueNoLabels = { ...sampleIssue, labels: [] };
    const result = formatIssueWithLabels(issueNoLabels, colors);
    expect(result).not.toContain('[,]');
    expect(result).toContain('Fix authentication timeout');
  });
});

describe('formatIssueCompact', () => {
  it('formats with ID, icon, and title only', () => {
    const result = formatIssueCompact(sampleIssue, colors);
    expect(result).toBe('bd-a1b2 ● Fix authentication timeout');
  });

  it('does not include kind', () => {
    const result = formatIssueCompact(sampleIssue, colors);
    expect(result).not.toContain('[bug]');
  });
});

describe('formatIssueInline', () => {
  it('formats as ID (title)', () => {
    const result = formatIssueInline(sampleIssue);
    expect(result).toBe('bd-a1b2 (Fix authentication timeout)');
  });

  it('does not include kind', () => {
    const result = formatIssueInline(sampleIssue);
    expect(result).not.toContain('[bug]');
  });
});

describe('formatIssueHeader', () => {
  it('includes all column headers', () => {
    const result = formatIssueHeader(colors);
    expect(result).toContain('ID');
    expect(result).toContain('PRI');
    expect(result).toContain('STATUS');
    expect(result).toContain('TITLE');
  });

  it('pads columns to correct widths', () => {
    const result = formatIssueHeader(colors);
    // ID header padded to 12 chars
    expect(result.startsWith('ID          ')).toBe(true);
  });
});

describe('formatIssueLong', () => {
  it('includes description on second line', () => {
    const result = formatIssueLong(sampleIssue, colors);
    const lines = result.split('\n');
    expect(lines.length).toBe(2);
    expect(lines[1]).toContain('Users report 30s delays');
  });

  it('indents description with 6 spaces', () => {
    const result = formatIssueLong(sampleIssue, colors);
    const lines = result.split('\n');
    expect(lines[1]!.startsWith('      ')).toBe(true);
  });

  it('handles issue without description', () => {
    const issueNoDesc = { ...sampleIssue, description: undefined };
    const result = formatIssueLong(issueNoDesc, colors);
    const lines = result.split('\n');
    expect(lines.length).toBe(1);
  });
});

describe('wrapDescription', () => {
  it('wraps long text at word boundaries', () => {
    const text = 'This is a long description that should wrap to multiple lines when displayed';
    const result = wrapDescription(text, 6, 2, 40);
    const lines = result.split('\n');
    expect(lines.length).toBe(2);
    for (const line of lines) {
      expect(line.startsWith('      ')).toBe(true);
    }
  });

  it('truncates with ellipsis when exceeding max lines', () => {
    const text =
      'Line one content here. Line two content here. Line three content here. Line four content here.';
    const result = wrapDescription(text, 6, 2, 30);
    expect(result).toContain('…');
  });

  it('handles empty description', () => {
    const result = wrapDescription('', 6, 2, 40);
    expect(result).toBe('');
  });

  it('handles short description', () => {
    const result = wrapDescription('Short desc', 6, 2, 40);
    expect(result).toBe('      Short desc');
  });
});
