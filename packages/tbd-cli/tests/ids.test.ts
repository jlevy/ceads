/**
 * Tests for ID generation.
 *
 * The system uses dual IDs:
 * - Internal ID: ULID-based, globally unique (is-01hx5zzk...)
 * - Short ID: Base36, human-friendly for CLI (a7k2)
 */

import { describe, it, expect } from 'vitest';
import {
  generateInternalId,
  generateShortId,
  validateIssueId,
  validateShortId,
  normalizeIssueId,
  isInternalId,
  isShortId,
  formatDisplayId,
  extractShortId,
  extractPrefix,
} from '../src/lib/ids.js';
import { IssueId } from '../src/lib/schemas.js';

// Sample valid ULID for testing (26 lowercase alphanumeric chars)
const VALID_ULID = '01hx5zzkbkactav9wevgemmvrz';

describe('generateInternalId', () => {
  it('generates valid ULID-based issue ID format', () => {
    const id = generateInternalId();
    expect(id).toMatch(/^is-[0-9a-z]{26}$/);
    expect(IssueId.safeParse(id).success).toBe(true);
  });

  it('generates unique IDs', () => {
    const ids = new Set<string>();
    for (let i = 0; i < 100; i++) {
      ids.add(generateInternalId());
    }
    expect(ids.size).toBe(100);
  });

  it('generates lowercase IDs', () => {
    const id = generateInternalId();
    expect(id).toBe(id.toLowerCase());
  });
});

describe('generateShortId', () => {
  it('generates base36 short ID with default length', () => {
    const id = generateShortId();
    expect(id).toMatch(/^[a-z0-9]{4}$/);
  });

  it('generates short ID with custom length', () => {
    expect(generateShortId(3)).toMatch(/^[a-z0-9]{3}$/);
    expect(generateShortId(5)).toMatch(/^[a-z0-9]{5}$/);
    expect(generateShortId(6)).toMatch(/^[a-z0-9]{6}$/);
    expect(generateShortId(8)).toMatch(/^[a-z0-9]{8}$/);
  });

  it('generates unique IDs', () => {
    const ids = new Set<string>();
    for (let i = 0; i < 100; i++) {
      ids.add(generateShortId());
    }
    // High probability of uniqueness (36^4 = 1.6M possibilities)
    expect(ids.size).toBeGreaterThan(95);
  });
});

describe('validateIssueId', () => {
  it('accepts valid ULID-based internal IDs', () => {
    expect(validateIssueId(`is-${VALID_ULID}`)).toBe(true);
    expect(validateIssueId('is-00000000000000000000000000')).toBe(true);
    expect(validateIssueId('is-zzzzzzzzzzzzzzzzzzzzzzzzzz')).toBe(true);
  });

  it('rejects invalid IDs', () => {
    expect(validateIssueId('is-a1b2c3')).toBe(false); // old 6-char format
    expect(validateIssueId(`bd-${VALID_ULID}`)).toBe(false); // wrong prefix
    expect(validateIssueId(VALID_ULID)).toBe(false); // missing prefix
    expect(validateIssueId('is-')).toBe(false); // empty
    expect(validateIssueId(`IS-${VALID_ULID}`)).toBe(false); // uppercase prefix
  });
});

describe('validateShortId', () => {
  it('accepts valid short IDs', () => {
    expect(validateShortId('a7k2')).toBe(true);
    expect(validateShortId('0000')).toBe(true);
    expect(validateShortId('zzzz')).toBe(true);
    expect(validateShortId('a7k2x')).toBe(true); // 5 chars
  });

  it('rejects invalid short IDs', () => {
    expect(validateShortId('')).toBe(false); // empty
    expect(validateShortId('ABC1')).toBe(false); // uppercase
    expect(validateShortId('a-b')).toBe(false); // contains hyphen
    expect(validateShortId('ab_c')).toBe(false); // contains underscore
  });

  it('accepts short IDs of various lengths for import preservation', () => {
    // New IDs are 4 chars, but imports can preserve longer numeric IDs
    expect(validateShortId('1')).toBe(true); // single char
    expect(validateShortId('100')).toBe(true); // 3 chars (from tbd-100)
    expect(validateShortId('abc')).toBe(true); // 3 chars
    expect(validateShortId('abcdef')).toBe(true); // 6 chars
    expect(validateShortId('12345678901234')).toBe(true); // 14 chars
  });
});

describe('isInternalId', () => {
  it('identifies internal IDs correctly', () => {
    expect(isInternalId(`is-${VALID_ULID}`)).toBe(true);
    expect(isInternalId('a7k2')).toBe(false);
    expect(isInternalId('bd-a7k2')).toBe(false);
  });
});

describe('isShortId', () => {
  it('identifies short IDs correctly', () => {
    expect(isShortId('a7k2')).toBe(true);
    expect(isShortId('bd-a7k2')).toBe(true);
    expect(isShortId(`is-${VALID_ULID}`)).toBe(false);
  });
});

describe('normalizeIssueId', () => {
  it('passes through valid internal IDs', () => {
    expect(normalizeIssueId(`is-${VALID_ULID}`)).toBe(`is-${VALID_ULID}`);
  });

  it('converts uppercase to lowercase', () => {
    expect(normalizeIssueId(`IS-${VALID_ULID.toUpperCase()}`)).toBe(`is-${VALID_ULID}`);
  });

  it('adds is- prefix to bare ULIDs', () => {
    expect(normalizeIssueId(VALID_ULID)).toBe(`is-${VALID_ULID}`);
  });

  it('converts bd- prefix to is- for full ULIDs', () => {
    expect(normalizeIssueId(`bd-${VALID_ULID}`)).toBe(`is-${VALID_ULID}`);
  });

  it('returns short IDs unchanged (cannot resolve without mapping)', () => {
    // Short IDs require mapping lookup which normalizeIssueId doesn't have access to
    expect(normalizeIssueId('bd-a7k2')).toBe('bd-a7k2');
    expect(normalizeIssueId('a7k2')).toBe('a7k2');
  });

  it('returns corrupted is- IDs as-is for later validation', () => {
    // IDs that start with is- but have wrong length
    expect(normalizeIssueId('is-abc')).toBe('is-abc');
    expect(normalizeIssueId('is-toolong1234567890123456789')).toBe('is-toolong1234567890123456789');
  });

  it('returns bd- short IDs unchanged when not full ULID', () => {
    // bd- prefix with short ID (not 26 chars)
    expect(normalizeIssueId('bd-a7k2x')).toBe('bd-a7k2x');
    expect(normalizeIssueId('bd-12345')).toBe('bd-12345');
  });

  it('returns other prefixed IDs unchanged', () => {
    // Other prefixes that aren't is- or bd-
    expect(normalizeIssueId('xx-abcdef')).toBe('xx-abcdef');
  });
});

describe('formatDisplayId', () => {
  // Create a mock mapping for tests
  const createMockMapping = () => ({
    shortToUlid: new Map([
      ['a7k2', VALID_ULID],
      ['xyz1', 'abcdef123456789012345678'],
    ]),
    ulidToShort: new Map([
      [VALID_ULID, 'a7k2'],
      ['abcdef123456789012345678', 'xyz1'],
    ]),
  });

  it('formats internal ID with default tbd- prefix', () => {
    const mapping = createMockMapping();
    const displayId = formatDisplayId(`is-${VALID_ULID}`, mapping);
    expect(displayId).toBe('tbd-a7k2');
  });

  it('uses custom prefix when provided', () => {
    const mapping = createMockMapping();
    const displayId = formatDisplayId(`is-${VALID_ULID}`, mapping, 'proj');
    expect(displayId).toBe('proj-a7k2');
  });

  it('handles IDs without is- prefix', () => {
    const mapping = createMockMapping();
    const displayId = formatDisplayId(VALID_ULID, mapping);
    expect(displayId).toBe('tbd-a7k2');
  });

  it('returns short ID from mapping', () => {
    const mapping = createMockMapping();
    const displayId = formatDisplayId('is-abcdef123456789012345678', mapping);
    expect(displayId).toBe('tbd-xyz1');
  });

  it('throws error when ID not in mapping', () => {
    const mapping = createMockMapping();
    expect(() => formatDisplayId('is-notinmapping00000000000', mapping)).toThrow(
      'No short ID mapping found',
    );
  });
});

// Tests for test-helpers.ts ID validation functions
import {
  isValidShortIdFormat,
  isValidInternalIdFormat,
  isDisplayIdNotInternal,
  isCorrectWorktreePath,
  isWrongMainBranchPath,
  hasCorrectFrontmatterFormat,
  BEADS_TO_TBD_STATUS,
} from './test-helpers.js';

describe('test helper: isValidShortIdFormat', () => {
  it('accepts valid 4-char short IDs', () => {
    expect(isValidShortIdFormat('a7k2')).toBe(true);
    expect(isValidShortIdFormat('bd-a7k2')).toBe(true);
    expect(isValidShortIdFormat('tbd-a7k2')).toBe(true);
  });

  it('accepts valid 5-char short IDs', () => {
    expect(isValidShortIdFormat('a7k2x')).toBe(true);
    expect(isValidShortIdFormat('bd-a7k2x')).toBe(true);
  });

  it('accepts preserved import IDs of various lengths (1-16 chars)', () => {
    expect(isValidShortIdFormat('1')).toBe(true);
    expect(isValidShortIdFormat('100')).toBe(true);
    expect(isValidShortIdFormat('bd-100')).toBe(true);
    expect(isValidShortIdFormat('tbd-100')).toBe(true);
    expect(isValidShortIdFormat('abc')).toBe(true);
    expect(isValidShortIdFormat('abcdef')).toBe(true);
    expect(isValidShortIdFormat('1234567890123456')).toBe(true); // 16 chars
  });

  it('rejects 26-char ULIDs (the bug we want to catch)', () => {
    expect(isValidShortIdFormat('bd-01kf2sp62c0dhqcwahs6ah5k92')).toBe(false);
    expect(isValidShortIdFormat('01kf2sp62c0dhqcwahs6ah5k92')).toBe(false);
  });

  it('rejects IDs that are too long (> 16 chars)', () => {
    expect(isValidShortIdFormat('12345678901234567')).toBe(false); // 17 chars
  });
});

describe('test helper: isValidInternalIdFormat', () => {
  it('accepts valid internal IDs', () => {
    expect(isValidInternalIdFormat('is-01kf2sp62c0dhqcwahs6ah5k92')).toBe(true);
    expect(isValidInternalIdFormat('is-00000000000000000000000000')).toBe(true);
  });

  it('rejects short IDs', () => {
    expect(isValidInternalIdFormat('is-a7k2')).toBe(false);
    expect(isValidInternalIdFormat('a7k2')).toBe(false);
  });

  it('rejects wrong prefix', () => {
    expect(isValidInternalIdFormat('bd-01kf2sp62c0dhqcwahs6ah5k92')).toBe(false);
  });
});

describe('test helper: isDisplayIdNotInternal', () => {
  it('accepts short display IDs', () => {
    expect(isDisplayIdNotInternal('bd-a7k2')).toBe(true);
    expect(isDisplayIdNotInternal('bd-abcde')).toBe(true);
  });

  it('rejects internal ULID IDs shown as display IDs (the bug)', () => {
    expect(isDisplayIdNotInternal('bd-01kf2sp62c0dhqcwahs6ah5k92')).toBe(false);
  });
});

describe('test helper: isCorrectWorktreePath', () => {
  it('accepts paths in the worktree', () => {
    expect(
      isCorrectWorktreePath('.tbd/data-sync-worktree/.tbd/data-sync/issues/is-abc123.md'),
    ).toBe(true);
  });

  it('rejects paths directly on main branch', () => {
    expect(isCorrectWorktreePath('.tbd/data-sync/issues/is-abc123.md')).toBe(false);
  });
});

describe('test helper: isWrongMainBranchPath', () => {
  it('identifies files wrongly on main branch', () => {
    expect(isWrongMainBranchPath('.tbd/data-sync/issues/is-abc123.md')).toBe(true);
  });

  it('does not flag correct worktree paths', () => {
    expect(
      isWrongMainBranchPath('.tbd/data-sync-worktree/.tbd/data-sync/issues/is-abc123.md'),
    ).toBe(false);
  });
});

describe('test helper: hasCorrectFrontmatterFormat', () => {
  it('accepts content with no extra newline after frontmatter', () => {
    const correct = `---
title: Test
---
Body content here.`;
    expect(hasCorrectFrontmatterFormat(correct)).toBe(true);
  });

  it('rejects content with extra newline after frontmatter (the bug)', () => {
    const incorrect = `---
title: Test
---

Body content here.`;
    expect(hasCorrectFrontmatterFormat(incorrect)).toBe(false);
  });

  it('accepts content with empty body', () => {
    const emptyBody = `---
title: Test
---
`;
    expect(hasCorrectFrontmatterFormat(emptyBody)).toBe(true);
  });
});

describe('test helper: BEADS_TO_TBD_STATUS', () => {
  it('maps all beads statuses correctly', () => {
    expect(BEADS_TO_TBD_STATUS.open).toBe('open');
    expect(BEADS_TO_TBD_STATUS.in_progress).toBe('in_progress');
    expect(BEADS_TO_TBD_STATUS.blocked).toBe('blocked');
    expect(BEADS_TO_TBD_STATUS.deferred).toBe('deferred');
    expect(BEADS_TO_TBD_STATUS.closed).toBe('closed');
    expect(BEADS_TO_TBD_STATUS.tombstone).toBe('closed');
  });

  it('maps done to closed (the bug tbd-1813)', () => {
    // This is a critical mapping that was missing in import.ts
    expect(BEADS_TO_TBD_STATUS.done).toBe('closed');
  });

  it('has all expected beads statuses', () => {
    const expectedStatuses = [
      'open',
      'in_progress',
      'done',
      'closed',
      'tombstone',
      'blocked',
      'deferred',
    ];
    for (const status of expectedStatuses) {
      expect(BEADS_TO_TBD_STATUS[status]).toBeDefined();
    }
  });
});

// Tests for adaptive short ID length and collision handling
import {
  calculateOptimalLength,
  generateUniqueShortId,
  type IdMapping,
} from '../src/file/idMapping.js';

describe('calculateOptimalLength', () => {
  it('returns 4 chars for databases under 50K issues', () => {
    expect(calculateOptimalLength(0)).toBe(4);
    expect(calculateOptimalLength(100)).toBe(4);
    expect(calculateOptimalLength(1000)).toBe(4);
    expect(calculateOptimalLength(10000)).toBe(4);
    expect(calculateOptimalLength(49999)).toBe(4);
  });

  it('returns 5 chars at 50K threshold and above', () => {
    expect(calculateOptimalLength(50000)).toBe(5);
    expect(calculateOptimalLength(100000)).toBe(5);
    expect(calculateOptimalLength(1000000)).toBe(5);
  });
});

describe('generateUniqueShortId', () => {
  // Helper to create a mapping with n existing IDs
  function createMappingWithNIds(n: number): IdMapping {
    const shortToUlid = new Map<string, string>();
    const ulidToShort = new Map<string, string>();

    // Pre-populate with n IDs
    for (let i = 0; i < n; i++) {
      const shortId = i.toString(36).padStart(4, '0'); // '0000', '0001', etc.
      const fakeUlid = i.toString(36).padStart(26, '0');
      shortToUlid.set(shortId, fakeUlid);
      ulidToShort.set(fakeUlid, shortId);
    }

    return { shortToUlid, ulidToShort };
  }

  it('generates unique short ID for empty mapping', () => {
    const mapping = createMappingWithNIds(0);
    const id = generateUniqueShortId(mapping);
    expect(id).toMatch(/^[a-z0-9]{4}$/); // Default 4-char length
    expect(mapping.shortToUlid.has(id)).toBe(false);
  });

  it('generates unique ID that does not collide with existing', () => {
    const mapping = createMappingWithNIds(100);
    const id = generateUniqueShortId(mapping);
    expect(mapping.shortToUlid.has(id)).toBe(false);
  });

  it('handles high-collision scenario by retrying', () => {
    // Create a mapping where we artificially fill most of the 4-char space
    // This tests the retry logic
    const mapping: IdMapping = {
      shortToUlid: new Map(),
      ulidToShort: new Map(),
    };

    // Fill with 1000 IDs - still plenty of room, but enough to test retries work
    for (let i = 0; i < 1000; i++) {
      const shortId = i.toString(36).padStart(4, '0');
      mapping.shortToUlid.set(shortId, `ulid${i}`);
      mapping.ulidToShort.set(`ulid${i}`, shortId);
    }

    // Should still successfully generate unique IDs
    const generated = new Set<string>();
    for (let i = 0; i < 50; i++) {
      const id = generateUniqueShortId(mapping);
      expect(mapping.shortToUlid.has(id)).toBe(false);
      expect(generated.has(id)).toBe(false);
      generated.add(id);
    }
  });

  it('generates IDs with length based on existing count', () => {
    const mapping: IdMapping = {
      shortToUlid: new Map(),
      ulidToShort: new Map(),
    };

    // Empty mapping should generate 4-char IDs
    const id = generateUniqueShortId(mapping);
    expect(id.length).toBe(4);
  });
});

describe('extractShortId', () => {
  it('extracts short ID from prefixed ID', () => {
    expect(extractShortId('tbd-100')).toBe('100');
    expect(extractShortId('bd-a7k2')).toBe('a7k2');
    expect(extractShortId('proj-xyz123')).toBe('xyz123');
  });

  it('returns ID as-is when no prefix', () => {
    expect(extractShortId('a7k2')).toBe('a7k2');
    expect(extractShortId('100')).toBe('100');
    expect(extractShortId('xyz123')).toBe('xyz123');
  });

  it('handles uppercase input by normalizing to lowercase', () => {
    expect(extractShortId('TBD-100')).toBe('100');
    expect(extractShortId('BD-A7K2')).toBe('a7k2');
  });

  it('handles multi-letter prefixes', () => {
    expect(extractShortId('myproject-12345')).toBe('12345');
    expect(extractShortId('abc-def')).toBe('def');
  });
});

describe('extractPrefix', () => {
  it('extracts prefix from prefixed ID', () => {
    expect(extractPrefix('tbd-100')).toBe('tbd');
    expect(extractPrefix('bd-a7k2')).toBe('bd');
    expect(extractPrefix('proj-xyz123')).toBe('proj');
  });

  it('returns null when no prefix', () => {
    expect(extractPrefix('a7k2')).toBeNull();
    expect(extractPrefix('100')).toBeNull();
    expect(extractPrefix('xyz123')).toBeNull();
  });

  it('normalizes prefix to lowercase', () => {
    expect(extractPrefix('TBD-100')).toBe('tbd');
    expect(extractPrefix('BD-A7K2')).toBe('bd');
    expect(extractPrefix('PROJ-xyz')).toBe('proj');
  });

  it('handles multi-letter prefixes', () => {
    expect(extractPrefix('myproject-12345')).toBe('myproject');
    expect(extractPrefix('abc-def')).toBe('abc');
  });

  it('returns null for numeric-only strings', () => {
    expect(extractPrefix('12345')).toBeNull();
    expect(extractPrefix('0')).toBeNull();
  });

  it('returns null for strings starting with numbers', () => {
    expect(extractPrefix('123-abc')).toBeNull();
    expect(extractPrefix('1abc-def')).toBeNull();
  });
});
