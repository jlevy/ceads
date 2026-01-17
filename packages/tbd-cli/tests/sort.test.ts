/**
 * Tests for natural sort utilities.
 *
 * Natural sort handles alphanumeric strings where numeric portions are
 * sorted numerically (so "10" comes after "9", not after "1").
 */

import { describe, it, expect } from 'vitest';
import { naturalCompare, naturalSort, naturalSortBy } from '../src/lib/sort.js';

describe('naturalCompare', () => {
  it('sorts purely numeric strings numerically', () => {
    expect(naturalCompare('1', '2')).toBeLessThan(0);
    expect(naturalCompare('2', '10')).toBeLessThan(0);
    expect(naturalCompare('9', '10')).toBeLessThan(0);
    expect(naturalCompare('10', '11')).toBeLessThan(0);
    expect(naturalCompare('100', '11')).toBeGreaterThan(0);
    expect(naturalCompare('1', '1')).toBe(0);
  });

  it('sorts purely alphabetic strings lexicographically', () => {
    expect(naturalCompare('a', 'b')).toBeLessThan(0);
    expect(naturalCompare('abc', 'abd')).toBeLessThan(0);
    expect(naturalCompare('abc', 'abc')).toBe(0);
    expect(naturalCompare('z', 'a')).toBeGreaterThan(0);
  });

  it('sorts alphanumeric strings with numeric portions numerically', () => {
    expect(naturalCompare('a1', 'a2')).toBeLessThan(0);
    expect(naturalCompare('a2', 'a10')).toBeLessThan(0);
    expect(naturalCompare('a9', 'a10')).toBeLessThan(0);
    expect(naturalCompare('file1.txt', 'file10.txt')).toBeLessThan(0);
    expect(naturalCompare('file2.txt', 'file10.txt')).toBeLessThan(0);
  });

  it('handles mixed alphanumeric IDs like bead short IDs', () => {
    expect(naturalCompare('a7k2', 'b3m9')).toBeLessThan(0);
    expect(naturalCompare('a7k2', 'a7k3')).toBeLessThan(0);
    expect(naturalCompare('100', 'a7k2')).toBeLessThan(0); // numeric before alpha
  });

  it('is case-insensitive for alphabetic portions', () => {
    expect(naturalCompare('ABC', 'abc')).toBe(0);
    expect(naturalCompare('File1', 'file2')).toBeLessThan(0);
  });

  it('handles empty strings', () => {
    expect(naturalCompare('', '')).toBe(0);
    expect(naturalCompare('', 'a')).toBeLessThan(0);
    expect(naturalCompare('a', '')).toBeGreaterThan(0);
  });

  it('handles leading zeros', () => {
    // "01" and "1" are numerically equal, but shorter wins
    expect(naturalCompare('01', '1')).toBeGreaterThan(0); // '01' has more chars
    expect(naturalCompare('001', '01')).toBeGreaterThan(0);
  });

  it('handles version-like strings', () => {
    expect(naturalCompare('v1.2.3', 'v1.2.10')).toBeLessThan(0);
    expect(naturalCompare('v1.9', 'v1.10')).toBeLessThan(0);
    expect(naturalCompare('v2.0', 'v1.10')).toBeGreaterThan(0);
  });
});

describe('naturalSort', () => {
  it('sorts an array of purely numeric strings', () => {
    const input = ['1', '10', '2', '9', '11', '100', '90'];
    const expected = ['1', '2', '9', '10', '11', '90', '100'];
    expect(naturalSort(input)).toEqual(expected);
  });

  it('sorts an array of alphanumeric strings', () => {
    const input = ['a1', 'a10', 'a2', 'a9'];
    const expected = ['a1', 'a2', 'a9', 'a10'];
    expect(naturalSort(input)).toEqual(expected);
  });

  it('sorts file names naturally', () => {
    const input = ['file1.txt', 'file10.txt', 'file2.txt', 'file20.txt'];
    const expected = ['file1.txt', 'file2.txt', 'file10.txt', 'file20.txt'];
    expect(naturalSort(input)).toEqual(expected);
  });

  it('sorts mixed numeric and alphanumeric IDs', () => {
    // Numeric IDs come before alphanumeric (since digits < letters in ASCII)
    const input = ['a7k2', '100', '10', '1', 'b3m9', '2'];
    const expected = ['1', '2', '10', '100', 'a7k2', 'b3m9'];
    expect(naturalSort(input)).toEqual(expected);
  });

  it('does not mutate the original array', () => {
    const input = ['3', '1', '2'];
    const copy = [...input];
    naturalSort(input);
    expect(input).toEqual(copy);
  });

  it('handles empty array', () => {
    expect(naturalSort([])).toEqual([]);
  });

  it('handles single element', () => {
    expect(naturalSort(['a'])).toEqual(['a']);
  });
});

describe('naturalSortBy', () => {
  it('sorts objects by a string key', () => {
    const input = [
      { id: '10', name: 'ten' },
      { id: '2', name: 'two' },
      { id: '1', name: 'one' },
    ];
    const expected = [
      { id: '1', name: 'one' },
      { id: '2', name: 'two' },
      { id: '10', name: 'ten' },
    ];
    expect(naturalSortBy(input, (x) => x.id)).toEqual(expected);
  });

  it('sorts by nested property', () => {
    const input = [
      { data: { version: 'v1.10' } },
      { data: { version: 'v1.2' } },
      { data: { version: 'v1.9' } },
    ];
    const expected = [
      { data: { version: 'v1.2' } },
      { data: { version: 'v1.9' } },
      { data: { version: 'v1.10' } },
    ];
    expect(naturalSortBy(input, (x) => x.data.version)).toEqual(expected);
  });

  it('does not mutate the original array', () => {
    const input = [{ id: '3' }, { id: '1' }, { id: '2' }];
    const copy = JSON.parse(JSON.stringify(input));
    naturalSortBy(input, (x) => x.id);
    expect(input).toEqual(copy);
  });
});
