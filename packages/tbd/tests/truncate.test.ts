/**
 * Tests for truncation utilities.
 */

import { describe, it, expect } from 'vitest';
import { ELLIPSIS, truncate, truncateMiddle } from '../src/lib/truncate.js';

describe('ELLIPSIS constant', () => {
  it('uses Unicode ellipsis character', () => {
    expect(ELLIPSIS).toBe('…');
  });

  it('is a single character', () => {
    expect(ELLIPSIS.length).toBe(1);
  });
});

describe('truncate', () => {
  describe('basic truncation', () => {
    it('returns original string if shorter than maxLength', () => {
      expect(truncate('hello', 10)).toBe('hello');
    });

    it('returns original string if equal to maxLength', () => {
      expect(truncate('hello', 5)).toBe('hello');
    });

    it('truncates string longer than maxLength with ellipsis', () => {
      expect(truncate('hello world', 8)).toBe('hello w…');
    });

    it('handles empty string', () => {
      expect(truncate('', 10)).toBe('');
    });

    it('handles maxLength of 1', () => {
      expect(truncate('hello', 1)).toBe('…');
    });

    it('handles maxLength of 0', () => {
      expect(truncate('hello', 0)).toBe('');
    });
  });

  describe('word boundary truncation', () => {
    it('truncates at word boundary when wordBoundary option is true', () => {
      expect(truncate('hello world foo', 12, { wordBoundary: true })).toBe('hello world…');
    });

    it('falls back to character truncation if no word boundary found', () => {
      expect(truncate('helloworld', 6, { wordBoundary: true })).toBe('hello…');
    });

    it('handles single word longer than maxLength', () => {
      expect(truncate('superlongword', 8, { wordBoundary: true })).toBe('superlo…');
    });

    it('truncates at last space before maxLength', () => {
      expect(truncate('the quick brown fox', 15, { wordBoundary: true })).toBe('the quick…');
    });
  });

  describe('unicode handling', () => {
    it('handles unicode characters correctly', () => {
      expect(truncate('héllo wörld', 8)).toBe('héllo w…');
    });

    it('handles emoji', () => {
      // Note: some emojis are multiple code points
      expect(truncate('hello 👋 world', 9)).toBe('hello 👋…');
    });
  });

  describe('edge cases', () => {
    it('preserves trailing spaces when not at boundary', () => {
      expect(truncate('hello   ', 6)).toBe('hello…');
    });

    it('handles string with only spaces', () => {
      expect(truncate('     ', 3)).toBe('  …');
    });

    it('handles newlines', () => {
      expect(truncate('hello\nworld', 8)).toBe('hello\nw…');
    });
  });
});

describe('truncateMiddle', () => {
  describe('basic middle truncation', () => {
    it('returns original string if shorter than maxLength', () => {
      expect(truncateMiddle('hello', 10)).toBe('hello');
    });

    it('returns original string if equal to maxLength', () => {
      expect(truncateMiddle('hello', 5)).toBe('hello');
    });

    it('truncates from middle with ellipsis', () => {
      // 8 chars total: 4 start + ellipsis + 3 end = "hell…rld"
      expect(truncateMiddle('hello world', 8)).toBe('hell…rld');
    });

    it('handles empty string', () => {
      expect(truncateMiddle('', 10)).toBe('');
    });

    it('handles maxLength of 1', () => {
      expect(truncateMiddle('hello', 1)).toBe('…');
    });

    it('handles maxLength of 0', () => {
      expect(truncateMiddle('hello', 0)).toBe('');
    });
  });

  describe('path truncation', () => {
    it('truncates long paths preserving start and end', () => {
      // 30 chars: 15 start + ellipsis + 14 end
      expect(truncateMiddle('/Users/levy/wrk/github/tbd/packages/tbd/src/lib/output.ts', 30)).toBe(
        '/Users/levy/wrk…/lib/output.ts',
      );
    });

    it('preserves file extension when truncating paths', () => {
      // 20 chars: 10 start + ellipsis + 9 end
      const result = truncateMiddle('very-long-filename.test.ts', 20);
      expect(result).toBe('very-long-…e.test.ts');
      expect(result.endsWith('.ts')).toBe(true);
    });
  });

  describe('ID truncation', () => {
    it('truncates long IDs preserving prefix and suffix', () => {
      // 15 chars: 7 start + ellipsis + 7 end
      expect(truncateMiddle('is-01hx5zzkbkactav9wevgemmvrz', 15)).toBe('is-01hx…gemmvrz');
    });
  });

  describe('edge cases', () => {
    it('handles odd maxLength', () => {
      // 7 chars: 3 start + ellipsis + 3 end = "hel…rld"
      expect(truncateMiddle('hello world', 7)).toBe('hel…rld');
    });

    it('handles even maxLength', () => {
      // 6 chars: 3 start + ellipsis + 2 end = "hel…ld"
      expect(truncateMiddle('hello world', 6)).toBe('hel…ld');
    });

    it('handles maxLength of 2', () => {
      expect(truncateMiddle('hello', 2)).toBe('h…');
    });

    it('handles maxLength of 3', () => {
      expect(truncateMiddle('hello', 3)).toBe('h…o');
    });
  });
});
