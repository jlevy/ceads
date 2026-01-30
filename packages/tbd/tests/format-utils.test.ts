/**
 * Tests for human-readable formatting utilities.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  estimateTokens,
  formatTokens,
  formatDocSize,
  formatTimeAgo,
  formatTimestampAgo,
  formatDuration,
  formatDurationCompact,
} from '../src/lib/format-utils.js';

describe('estimateTokens', () => {
  it('estimates tokens using 3.5 chars per token', () => {
    // 35 chars / 3.5 = 10 tokens
    expect(estimateTokens('a'.repeat(35))).toBe(10);
  });

  it('rounds up to nearest integer', () => {
    // 7 chars / 3.5 = 2 tokens exactly
    expect(estimateTokens('a'.repeat(7))).toBe(2);
    // 8 chars / 3.5 = 2.28... -> 3 tokens (ceil)
    expect(estimateTokens('a'.repeat(8))).toBe(3);
  });

  it('handles empty string', () => {
    expect(estimateTokens('')).toBe(0);
  });

  it('handles typical markdown content', () => {
    const content = '# Hello World\n\nThis is a test document with **bold** and `code`.';
    const tokens = estimateTokens(content);
    // Content is 64 chars, 64/3.5 ≈ 18.3 -> 19 tokens
    expect(tokens).toBeGreaterThan(15);
    expect(tokens).toBeLessThan(25);
  });
});

describe('formatTokens', () => {
  it('formats small token counts without k suffix', () => {
    expect(formatTokens(100)).toBe('~100 tok');
    expect(formatTokens(999)).toBe('~999 tok');
  });

  it('formats large token counts with k suffix', () => {
    expect(formatTokens(1000)).toBe('~1.0k tok');
    expect(formatTokens(1500)).toBe('~1.5k tok');
    expect(formatTokens(12345)).toBe('~12.3k tok');
  });

  it('handles zero tokens', () => {
    expect(formatTokens(0)).toBe('~0 tok');
  });
});

describe('formatDocSize', () => {
  it('formats combined size and token info', () => {
    const result = formatDocSize(1337, 382);
    expect(result).toBe('(1.34 kB, ~382 tok)');
  });

  it('handles large files', () => {
    const result = formatDocSize(15000, 4285);
    expect(result).toBe('(15 kB, ~4.3k tok)');
  });

  it('handles small files', () => {
    const result = formatDocSize(500, 143);
    expect(result).toBe('(500 B, ~143 tok)');
  });
});

describe('formatTimeAgo', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('formats recent time as just now', () => {
    const now = new Date('2026-01-29T12:00:00Z');
    vi.setSystemTime(now);

    // 30 seconds ago
    const date = new Date('2026-01-29T11:59:30Z');
    expect(formatTimeAgo(date)).toBe('just now');
  });

  it('formats minutes ago', () => {
    const now = new Date('2026-01-29T12:00:00Z');
    vi.setSystemTime(now);

    // 5 minutes ago
    const date = new Date('2026-01-29T11:55:00Z');
    expect(formatTimeAgo(date)).toBe('5m ago');
  });

  it('formats hours ago', () => {
    const now = new Date('2026-01-29T12:00:00Z');
    vi.setSystemTime(now);

    // 2 hours ago
    const date = new Date('2026-01-29T10:00:00Z');
    expect(formatTimeAgo(date)).toBe('2h ago');
  });

  it('formats days ago', () => {
    const now = new Date('2026-01-29T12:00:00Z');
    vi.setSystemTime(now);

    // 3 days ago
    const date = new Date('2026-01-26T12:00:00Z');
    expect(formatTimeAgo(date)).toBe('3d ago');
  });

  it('handles future dates as just now', () => {
    const now = new Date('2026-01-29T12:00:00Z');
    vi.setSystemTime(now);

    // 5 minutes in the future
    const date = new Date('2026-01-29T12:05:00Z');
    expect(formatTimeAgo(date)).toBe('just now');
  });
});

describe('formatTimestampAgo', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-01-29T12:00:00Z'));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('formats ISO timestamp string', () => {
    expect(formatTimestampAgo('2026-01-29T11:55:00Z')).toBe('5m ago');
  });

  it('returns null for undefined', () => {
    expect(formatTimestampAgo(undefined)).toBeNull();
  });

  it('returns null for null', () => {
    expect(formatTimestampAgo(null)).toBeNull();
  });

  it('returns null for invalid timestamp', () => {
    expect(formatTimestampAgo('not-a-date')).toBeNull();
  });

  it('returns null for empty string', () => {
    expect(formatTimestampAgo('')).toBeNull();
  });
});

describe('formatDuration', () => {
  it('formats milliseconds in verbose form', () => {
    expect(formatDuration(1000)).toBe('1 second');
    expect(formatDuration(60000)).toBe('1 minute');
    expect(formatDuration(3600000)).toBe('1 hour');
  });

  it('formats combined durations', () => {
    // 2 hours 15 minutes
    expect(formatDuration(8100000)).toBe('2 hours 15 minutes');
  });
});

describe('formatDurationCompact', () => {
  it('formats milliseconds in compact form', () => {
    expect(formatDurationCompact(1000)).toBe('1s');
    expect(formatDurationCompact(60000)).toBe('1m');
    expect(formatDurationCompact(3600000)).toBe('1h');
  });

  it('formats combined durations compactly', () => {
    // 2 hours 15 minutes - compact shows only largest unit
    expect(formatDurationCompact(8100000)).toBe('2h');
  });
});
