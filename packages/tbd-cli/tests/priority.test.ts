/**
 * Tests for priority utilities.
 */

import { describe, it, expect } from 'vitest';
import { formatPriority, parsePriority, getPriorityColor } from '../src/lib/priority.js';
import { createColors } from '../src/cli/lib/output.js';

describe('formatPriority', () => {
  it('formats priority 0 as P0', () => {
    expect(formatPriority(0)).toBe('P0');
  });

  it('formats priority 1 as P1', () => {
    expect(formatPriority(1)).toBe('P1');
  });

  it('formats priority 2 as P2', () => {
    expect(formatPriority(2)).toBe('P2');
  });

  it('formats priority 3 as P3', () => {
    expect(formatPriority(3)).toBe('P3');
  });

  it('formats priority 4 as P4', () => {
    expect(formatPriority(4)).toBe('P4');
  });
});

describe('parsePriority', () => {
  describe('numeric input', () => {
    it('parses "0" to 0', () => {
      expect(parsePriority('0')).toBe(0);
    });

    it('parses "1" to 1', () => {
      expect(parsePriority('1')).toBe(1);
    });

    it('parses "4" to 4', () => {
      expect(parsePriority('4')).toBe(4);
    });
  });

  describe('prefixed input', () => {
    it('parses "P0" to 0', () => {
      expect(parsePriority('P0')).toBe(0);
    });

    it('parses "P1" to 1', () => {
      expect(parsePriority('P1')).toBe(1);
    });

    it('parses "P4" to 4', () => {
      expect(parsePriority('P4')).toBe(4);
    });
  });

  describe('case insensitivity', () => {
    it('parses "p1" to 1', () => {
      expect(parsePriority('p1')).toBe(1);
    });

    it('parses "p0" to 0', () => {
      expect(parsePriority('p0')).toBe(0);
    });
  });

  describe('invalid input', () => {
    it('returns undefined for invalid string', () => {
      expect(parsePriority('invalid')).toBeUndefined();
    });

    it('returns undefined for empty string', () => {
      expect(parsePriority('')).toBeUndefined();
    });

    it('returns undefined for out of range value', () => {
      expect(parsePriority('5')).toBeUndefined();
      expect(parsePriority('P5')).toBeUndefined();
      expect(parsePriority('-1')).toBeUndefined();
    });

    it('returns undefined for partial match', () => {
      expect(parsePriority('PP1')).toBeUndefined();
      expect(parsePriority('P1P')).toBeUndefined();
    });
  });

  describe('whitespace handling', () => {
    it('trims leading and trailing whitespace', () => {
      expect(parsePriority(' P1 ')).toBe(1);
      expect(parsePriority(' 2 ')).toBe(2);
    });
  });
});

describe('getPriorityColor', () => {
  const colors = createColors('always');

  it('returns error color (red) for P0', () => {
    const colorFn = getPriorityColor(0, colors);
    expect(colorFn('P0')).toBe(colors.error('P0'));
  });

  it('returns warn color (yellow) for P1', () => {
    const colorFn = getPriorityColor(1, colors);
    expect(colorFn('P1')).toBe(colors.warn('P1'));
  });

  it('returns identity function for P2', () => {
    const colorFn = getPriorityColor(2, colors);
    expect(colorFn('P2')).toBe('P2');
  });

  it('returns identity function for P3', () => {
    const colorFn = getPriorityColor(3, colors);
    expect(colorFn('P3')).toBe('P3');
  });

  it('returns identity function for P4', () => {
    const colorFn = getPriorityColor(4, colors);
    expect(colorFn('P4')).toBe('P4');
  });
});
