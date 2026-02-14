/**
 * Tests for repo-url.ts - URL normalization and slugification.
 */

import { describe, it, expect } from 'vitest';
import { normalizeRepoUrl, repoUrlToSlug, getCloneUrl } from '../src/lib/repo-url.js';

describe('repo-url', () => {
  describe('normalizeRepoUrl', () => {
    it('normalizes short format (github.com/org/repo)', () => {
      const result = normalizeRepoUrl('github.com/jlevy/speculate');
      expect(result.host).toBe('github.com');
      expect(result.owner).toBe('jlevy');
      expect(result.repo).toBe('speculate');
    });

    it('normalizes HTTPS URL', () => {
      const result = normalizeRepoUrl('https://github.com/jlevy/speculate');
      expect(result.host).toBe('github.com');
      expect(result.owner).toBe('jlevy');
      expect(result.repo).toBe('speculate');
    });

    it('normalizes HTTPS URL with .git suffix', () => {
      const result = normalizeRepoUrl('https://github.com/jlevy/speculate.git');
      expect(result.host).toBe('github.com');
      expect(result.owner).toBe('jlevy');
      expect(result.repo).toBe('speculate');
    });

    it('normalizes SSH URL (git@)', () => {
      const result = normalizeRepoUrl('git@github.com:jlevy/speculate.git');
      expect(result.host).toBe('github.com');
      expect(result.owner).toBe('jlevy');
      expect(result.repo).toBe('speculate');
    });

    it('normalizes SSH URL without .git suffix', () => {
      const result = normalizeRepoUrl('git@github.com:jlevy/speculate');
      expect(result.host).toBe('github.com');
      expect(result.owner).toBe('jlevy');
      expect(result.repo).toBe('speculate');
    });

    it('strips trailing slash', () => {
      const result = normalizeRepoUrl('github.com/jlevy/speculate/');
      expect(result.repo).toBe('speculate');
    });

    it('handles mixed case host', () => {
      const result = normalizeRepoUrl('GitHub.com/jlevy/speculate');
      expect(result.host).toBe('github.com');
    });

    it('throws on invalid URL', () => {
      expect(() => normalizeRepoUrl('')).toThrow();
      expect(() => normalizeRepoUrl('not-a-url')).toThrow();
      expect(() => normalizeRepoUrl('github.com')).toThrow();
      expect(() => normalizeRepoUrl('github.com/only-owner')).toThrow();
    });
  });

  describe('repoUrlToSlug', () => {
    it('converts short URL to filesystem slug', () => {
      expect(repoUrlToSlug('github.com/jlevy/speculate')).toBe('github.com-jlevy-speculate');
    });

    it('converts HTTPS URL to slug', () => {
      expect(repoUrlToSlug('https://github.com/jlevy/speculate')).toBe(
        'github.com-jlevy-speculate',
      );
    });

    it('converts SSH URL to slug', () => {
      expect(repoUrlToSlug('git@github.com:jlevy/speculate.git')).toBe(
        'github.com-jlevy-speculate',
      );
    });

    it('is deterministic (same input always produces same output)', () => {
      const inputs = [
        'github.com/jlevy/speculate',
        'https://github.com/jlevy/speculate',
        'https://github.com/jlevy/speculate.git',
        'git@github.com:jlevy/speculate.git',
      ];
      const slugs = inputs.map(repoUrlToSlug);
      // All should produce the same slug
      expect(new Set(slugs).size).toBe(1);
    });

    it('produces different slugs for different repos', () => {
      const slug1 = repoUrlToSlug('github.com/jlevy/speculate');
      const slug2 = repoUrlToSlug('github.com/jlevy/tbd');
      expect(slug1).not.toBe(slug2);
    });
  });

  describe('getCloneUrl', () => {
    it('returns HTTPS clone URL from short format', () => {
      expect(getCloneUrl('github.com/jlevy/speculate')).toBe(
        'https://github.com/jlevy/speculate.git',
      );
    });

    it('returns HTTPS clone URL from SSH format', () => {
      expect(getCloneUrl('git@github.com:jlevy/speculate.git')).toBe(
        'https://github.com/jlevy/speculate.git',
      );
    });

    it('returns normalized HTTPS clone URL', () => {
      expect(getCloneUrl('https://github.com/jlevy/speculate')).toBe(
        'https://github.com/jlevy/speculate.git',
      );
    });
  });
});
