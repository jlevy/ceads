/**
 * Tests for content hashing.
 *
 * Content hashes are used for conflict detection and must be:
 * - Deterministic: same content = same hash
 * - Stable: doesn't change based on field order or whitespace
 */

import { describe, it, expect } from 'vitest';
import { computeContentHash, canonicalizeForHash } from '../src/file/hash.js';
import type { Issue } from '../src/lib/types.js';

const makeIssue = (overrides: Partial<Issue> = {}): Issue => ({
  type: 'is',
  id: 'is-a1b2c3',
  version: 1,
  kind: 'task',
  title: 'Test issue',
  status: 'open',
  priority: 2,
  labels: [],
  dependencies: [],
  created_at: '2025-01-01T00:00:00Z',
  updated_at: '2025-01-01T00:00:00Z',
  ...overrides,
});

describe('canonicalizeForHash', () => {
  it('produces sorted keys', () => {
    const issue = makeIssue({ title: 'A', status: 'open' });
    const canonical = canonicalizeForHash(issue);

    // Keys should be in alphabetical order
    const lines = canonical.split('\n');
    const keyOrder = lines.filter((l) => l.includes(':')).map((l) => l.split(':')[0]!.trim());

    expect(keyOrder).toEqual([...keyOrder].sort());
  });

  it('sorts labels array', () => {
    const issue = makeIssue({ labels: ['zebra', 'apple', 'mango'] });
    const canonical = canonicalizeForHash(issue);

    // Labels should be sorted
    expect(canonical).toMatch(/labels:\s*-\s*apple\s*-\s*mango\s*-\s*zebra/);
  });

  it('sorts dependencies by target', () => {
    const issue = makeIssue({
      dependencies: [
        { type: 'blocks', target: 'is-ffffff' },
        { type: 'blocks', target: 'is-000000' },
        { type: 'blocks', target: 'is-aaaaaa' },
      ],
    });
    const canonical = canonicalizeForHash(issue);

    // Dependencies should be sorted by target
    const targetMatches = canonical.match(/target:\s*is-[a-f0-9]+/g);
    expect(targetMatches).toEqual(['target: is-000000', 'target: is-aaaaaa', 'target: is-ffffff']);
  });

  it('uses explicit nulls', () => {
    const issue = makeIssue({ description: null, notes: null });
    const canonical = canonicalizeForHash(issue);

    expect(canonical).toContain('description: null');
    expect(canonical).toContain('notes: null');
  });

  it('omits undefined fields', () => {
    const issue = makeIssue({ assignee: undefined });
    const canonical = canonicalizeForHash(issue);

    // Undefined fields should not appear
    expect(canonical).not.toContain('assignee:');
  });

  it('uses LF line endings', () => {
    const issue = makeIssue();
    const canonical = canonicalizeForHash(issue);

    expect(canonical).not.toContain('\r');
    expect(canonical).toContain('\n');
  });
});

describe('computeContentHash', () => {
  it('produces SHA-256 hash', () => {
    const issue = makeIssue();
    const hash = computeContentHash(issue);

    // SHA-256 produces 64 hex characters
    expect(hash).toMatch(/^[a-f0-9]{64}$/);
  });

  it('is deterministic', () => {
    const issue = makeIssue({ title: 'Same issue' });

    const hash1 = computeContentHash(issue);
    const hash2 = computeContentHash(issue);

    expect(hash1).toBe(hash2);
  });

  it('is stable across field order', () => {
    // Create issues with same data but defined in different order
    const issue1 = {
      type: 'is' as const,
      id: 'is-a1b2c3',
      version: 1,
      kind: 'task' as const,
      title: 'Test',
      status: 'open' as const,
      priority: 2,
      labels: [],
      dependencies: [],
      created_at: '2025-01-01T00:00:00Z',
      updated_at: '2025-01-01T00:00:00Z',
    };

    const issue2 = {
      status: 'open' as const,
      title: 'Test',
      version: 1,
      type: 'is' as const,
      kind: 'task' as const,
      id: 'is-a1b2c3',
      priority: 2,
      labels: [],
      dependencies: [],
      updated_at: '2025-01-01T00:00:00Z',
      created_at: '2025-01-01T00:00:00Z',
    };

    expect(computeContentHash(issue1)).toBe(computeContentHash(issue2));
  });

  it('changes when content changes', () => {
    const issue1 = makeIssue({ title: 'Title A' });
    const issue2 = makeIssue({ title: 'Title B' });

    expect(computeContentHash(issue1)).not.toBe(computeContentHash(issue2));
  });

  it('changes when labels change', () => {
    const issue1 = makeIssue({ labels: ['a'] });
    const issue2 = makeIssue({ labels: ['a', 'b'] });

    expect(computeContentHash(issue1)).not.toBe(computeContentHash(issue2));
  });

  it('is stable when labels are reordered', () => {
    const issue1 = makeIssue({ labels: ['a', 'b', 'c'] });
    const issue2 = makeIssue({ labels: ['c', 'a', 'b'] });

    expect(computeContentHash(issue1)).toBe(computeContentHash(issue2));
  });

  it('excludes version from hash (version is informational only)', () => {
    const issue1 = makeIssue({ version: 1 });
    const issue2 = makeIssue({ version: 5 });

    expect(computeContentHash(issue1)).toBe(computeContentHash(issue2));
  });
});
