/**
 * Tests for spec path matching utilities.
 */

import { describe, it, expect } from 'vitest';
import { matchesSpecPath } from '../src/lib/spec-matching.js';

describe('matchesSpecPath', () => {
  const storedPath = 'docs/project/specs/active/plan-2026-01-26-my-feature.md';

  describe('exact match', () => {
    it('matches identical paths', () => {
      expect(matchesSpecPath(storedPath, storedPath)).toBe(true);
    });

    it('matches after normalization of leading ./', () => {
      expect(matchesSpecPath(storedPath, './' + storedPath)).toBe(true);
      expect(matchesSpecPath('./' + storedPath, storedPath)).toBe(true);
    });

    it('matches after normalization of trailing /', () => {
      expect(matchesSpecPath('docs/project/specs/active/', 'docs/project/specs/active')).toBe(true);
    });
  });

  describe('filename match', () => {
    it('matches full filename', () => {
      expect(matchesSpecPath(storedPath, 'plan-2026-01-26-my-feature.md')).toBe(true);
    });

    it('does not match partial filename (too ambiguous)', () => {
      // "my-feature.md" should NOT match "plan-2026-01-26-my-feature.md"
      // because it's not the actual filename
      expect(matchesSpecPath(storedPath, 'my-feature.md')).toBe(false);
    });

    it('does not match filename substring', () => {
      expect(matchesSpecPath(storedPath, 'feature.md')).toBe(false);
      expect(matchesSpecPath(storedPath, 'plan-2026')).toBe(false);
    });
  });

  describe('suffix match', () => {
    it('matches partial path from end', () => {
      expect(matchesSpecPath(storedPath, 'active/plan-2026-01-26-my-feature.md')).toBe(true);
    });

    it('matches longer partial path', () => {
      expect(matchesSpecPath(storedPath, 'specs/active/plan-2026-01-26-my-feature.md')).toBe(true);
    });

    it('matches even longer partial path', () => {
      expect(
        matchesSpecPath(storedPath, 'project/specs/active/plan-2026-01-26-my-feature.md'),
      ).toBe(true);
    });

    it('does not match partial path that does not end at separator', () => {
      // "ive/plan-2026-01-26-my-feature.md" should not match
      // because "ive" is not a complete path component
      expect(matchesSpecPath(storedPath, 'ive/plan-2026-01-26-my-feature.md')).toBe(false);
    });
  });

  describe('case sensitivity', () => {
    it('is case-sensitive', () => {
      expect(matchesSpecPath(storedPath, 'Plan-2026-01-26-my-feature.md')).toBe(false);
      expect(matchesSpecPath(storedPath, 'PLAN-2026-01-26-my-feature.md')).toBe(false);
      expect(
        matchesSpecPath(storedPath, 'docs/project/specs/ACTIVE/plan-2026-01-26-my-feature.md'),
      ).toBe(false);
    });
  });

  describe('edge cases', () => {
    it('returns false for empty stored path', () => {
      expect(matchesSpecPath('', 'anything.md')).toBe(false);
    });

    it('returns false for empty query path', () => {
      expect(matchesSpecPath(storedPath, '')).toBe(false);
    });

    it('returns false for both empty', () => {
      expect(matchesSpecPath('', '')).toBe(false);
    });

    it('handles paths with multiple slashes', () => {
      expect(matchesSpecPath('docs//specs//file.md', 'docs/specs/file.md')).toBe(true);
    });

    it('handles simple filename stored path', () => {
      expect(matchesSpecPath('spec.md', 'spec.md')).toBe(true);
    });

    it('does not match unrelated paths', () => {
      expect(matchesSpecPath(storedPath, 'other-spec.md')).toBe(false);
      expect(matchesSpecPath(storedPath, 'docs/other/path.md')).toBe(false);
    });
  });

  describe('real-world scenarios', () => {
    it('matches spec created with full path, queried with filename', () => {
      const created = 'docs/project/specs/active/plan-2026-01-26-spec-linking.md';
      expect(matchesSpecPath(created, 'plan-2026-01-26-spec-linking.md')).toBe(true);
    });

    it('matches spec created with filename, queried with full path', () => {
      const created = 'plan-2026-01-26-spec-linking.md';
      // Full path query should not match a filename-only stored path
      // because the stored path doesn't contain the full path
      expect(
        matchesSpecPath(created, 'docs/project/specs/active/plan-2026-01-26-spec-linking.md'),
      ).toBe(false);
    });

    it('allows flexible querying of same spec by different users', () => {
      const stored = 'docs/project/specs/active/plan-2026-01-26-auth-feature.md';

      // All these should work for listing beads linked to this spec
      expect(matchesSpecPath(stored, 'plan-2026-01-26-auth-feature.md')).toBe(true);
      expect(matchesSpecPath(stored, 'active/plan-2026-01-26-auth-feature.md')).toBe(true);
      expect(matchesSpecPath(stored, 'specs/active/plan-2026-01-26-auth-feature.md')).toBe(true);
      expect(
        matchesSpecPath(stored, 'docs/project/specs/active/plan-2026-01-26-auth-feature.md'),
      ).toBe(true);
    });
  });
});
