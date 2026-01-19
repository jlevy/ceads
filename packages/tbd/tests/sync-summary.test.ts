/**
 * Tests for sync summary utilities.
 */

import { describe, it, expect } from 'vitest';
import {
  emptyTallies,
  emptySummary,
  hasTallies,
  formatTallies,
  formatSyncSummary,
  parseGitStatus,
  parseGitDiff,
} from '../src/lib/sync-summary.js';

describe('emptyTallies', () => {
  it('returns zeroed tallies', () => {
    const tallies = emptyTallies();
    expect(tallies.new).toBe(0);
    expect(tallies.updated).toBe(0);
    expect(tallies.deleted).toBe(0);
  });
});

describe('emptySummary', () => {
  it('returns zeroed summary', () => {
    const summary = emptySummary();
    expect(summary.sent.new).toBe(0);
    expect(summary.sent.updated).toBe(0);
    expect(summary.sent.deleted).toBe(0);
    expect(summary.received.new).toBe(0);
    expect(summary.received.updated).toBe(0);
    expect(summary.received.deleted).toBe(0);
    expect(summary.conflicts).toBe(0);
  });
});

describe('hasTallies', () => {
  it('returns false for empty tallies', () => {
    expect(hasTallies(emptyTallies())).toBe(false);
  });

  it('returns true for new files', () => {
    expect(hasTallies({ new: 1, updated: 0, deleted: 0 })).toBe(true);
  });

  it('returns true for updated files', () => {
    expect(hasTallies({ new: 0, updated: 1, deleted: 0 })).toBe(true);
  });

  it('returns true for deleted files', () => {
    expect(hasTallies({ new: 0, updated: 0, deleted: 1 })).toBe(true);
  });
});

describe('formatTallies', () => {
  it('returns empty string for empty tallies', () => {
    expect(formatTallies(emptyTallies())).toBe('');
  });

  it('formats new files only', () => {
    expect(formatTallies({ new: 1, updated: 0, deleted: 0 })).toBe('1 new');
  });

  it('formats updated files only', () => {
    expect(formatTallies({ new: 0, updated: 2, deleted: 0 })).toBe('2 updated');
  });

  it('formats deleted files only', () => {
    expect(formatTallies({ new: 0, updated: 0, deleted: 3 })).toBe('3 deleted');
  });

  it('formats multiple types', () => {
    expect(formatTallies({ new: 1, updated: 2, deleted: 0 })).toBe('1 new, 2 updated');
  });

  it('formats all types', () => {
    expect(formatTallies({ new: 1, updated: 2, deleted: 3 })).toBe('1 new, 2 updated, 3 deleted');
  });
});

describe('formatSyncSummary', () => {
  it('returns empty string when nothing to report', () => {
    expect(formatSyncSummary(emptySummary())).toBe('');
  });

  it('formats sent only', () => {
    const summary = emptySummary();
    summary.sent.new = 1;
    expect(formatSyncSummary(summary)).toBe('sent 1 new');
  });

  it('formats received only', () => {
    const summary = emptySummary();
    summary.received.new = 1;
    expect(formatSyncSummary(summary)).toBe('received 1 new');
  });

  it('formats sent and received', () => {
    const summary = emptySummary();
    summary.sent.updated = 2;
    summary.received.new = 1;
    expect(formatSyncSummary(summary)).toBe('sent 2 updated, received 1 new');
  });

  it('includes conflicts', () => {
    const summary = emptySummary();
    summary.sent.new = 1;
    summary.conflicts = 2;
    expect(formatSyncSummary(summary)).toBe('sent 1 new (2 conflicts resolved)');
  });

  it('formats single conflict correctly', () => {
    const summary = emptySummary();
    summary.received.updated = 1;
    summary.conflicts = 1;
    expect(formatSyncSummary(summary)).toBe('received 1 updated (1 conflict resolved)');
  });
});

describe('parseGitStatus', () => {
  it('returns empty tallies for empty input', () => {
    expect(parseGitStatus('')).toEqual(emptyTallies());
  });

  it('parses new files (??)', () => {
    const tallies = parseGitStatus('?? file1.md\n?? file2.md');
    expect(tallies.new).toBe(2);
    expect(tallies.updated).toBe(0);
    expect(tallies.deleted).toBe(0);
  });

  it('parses added files (A)', () => {
    const tallies = parseGitStatus('A  file1.md');
    expect(tallies.new).toBe(1);
  });

  it('parses modified files (M)', () => {
    const tallies = parseGitStatus('M  file1.md\nMM file2.md');
    expect(tallies.updated).toBe(2);
  });

  it('parses deleted files (D)', () => {
    const tallies = parseGitStatus('D  file1.md');
    expect(tallies.deleted).toBe(1);
  });

  it('parses mixed status', () => {
    const status = '?? new.md\nM  updated.md\nD  deleted.md';
    const tallies = parseGitStatus(status);
    expect(tallies.new).toBe(1);
    expect(tallies.updated).toBe(1);
    expect(tallies.deleted).toBe(1);
  });
});

describe('parseGitDiff', () => {
  it('returns empty tallies for empty input', () => {
    expect(parseGitDiff('')).toEqual(emptyTallies());
  });

  it('parses added files', () => {
    const tallies = parseGitDiff('A\tfile1.md\nA\tfile2.md');
    expect(tallies.new).toBe(2);
  });

  it('parses modified files', () => {
    const tallies = parseGitDiff('M\tfile1.md');
    expect(tallies.updated).toBe(1);
  });

  it('parses deleted files', () => {
    const tallies = parseGitDiff('D\tfile1.md');
    expect(tallies.deleted).toBe(1);
  });

  it('parses mixed diff', () => {
    const diff = 'A\tnew.md\nM\tupdated.md\nD\tdeleted.md';
    const tallies = parseGitDiff(diff);
    expect(tallies.new).toBe(1);
    expect(tallies.updated).toBe(1);
    expect(tallies.deleted).toBe(1);
  });
});
