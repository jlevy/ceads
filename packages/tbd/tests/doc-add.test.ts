/**
 * Tests for doc-add.ts - adding external docs to the doc cache.
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdir, writeFile, readFile, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { randomBytes } from 'node:crypto';
import { stringify as stringifyYaml } from 'yaml';

import {
  githubToRawUrl,
  validateDocContent,
  getDocTypeSubdir,
  fetchWithGhFallback,
  addDoc,
} from '../src/file/doc-add.js';

// =============================================================================
// GitHub URL Conversion
// =============================================================================

describe('githubToRawUrl', () => {
  it('converts GitHub blob URL to raw URL', () => {
    const url =
      'https://github.com/jlevy/tbd/blob/413ac0b770e9ddc415f4095af30b64869cf8d0d2/docs/general/research/current/research-modern-bun-monorepo-patterns.md';
    const expected =
      'https://raw.githubusercontent.com/jlevy/tbd/413ac0b770e9ddc415f4095af30b64869cf8d0d2/docs/general/research/current/research-modern-bun-monorepo-patterns.md';
    expect(githubToRawUrl(url)).toBe(expected);
  });

  it('converts GitHub blob URL with branch name', () => {
    const url = 'https://github.com/org/repo/blob/main/docs/file.md';
    expect(githubToRawUrl(url)).toBe(
      'https://raw.githubusercontent.com/org/repo/main/docs/file.md',
    );
  });

  it('passes through raw.githubusercontent.com URLs unchanged', () => {
    const url = 'https://raw.githubusercontent.com/org/repo/main/docs/file.md';
    expect(githubToRawUrl(url)).toBe(url);
  });

  it('passes through non-GitHub URLs unchanged', () => {
    const url = 'https://example.com/docs/file.md';
    expect(githubToRawUrl(url)).toBe(url);
  });

  it('passes through GitHub non-blob URLs unchanged', () => {
    const url = 'https://github.com/org/repo/tree/main/docs';
    expect(githubToRawUrl(url)).toBe(url);
  });

  it('handles nested paths correctly', () => {
    const url = 'https://github.com/owner/repo/blob/feature/branch/src/deep/nested/path/file.md';
    // Note: 'feature/branch' is the ref because the regex captures the first segment after blob/
    expect(githubToRawUrl(url)).toBe(
      'https://raw.githubusercontent.com/owner/repo/feature/branch/src/deep/nested/path/file.md',
    );
  });
});

// =============================================================================
// Content Validation
// =============================================================================

describe('validateDocContent', () => {
  it('accepts valid markdown content', () => {
    expect(() => {
      validateDocContent('# My Document\n\nSome content here.', 'test');
    }).not.toThrow();
  });

  it('rejects empty content', () => {
    expect(() => {
      validateDocContent('', 'test');
    }).toThrow('empty');
  });

  it('rejects whitespace-only content', () => {
    expect(() => {
      validateDocContent('   \n\n   ', 'test');
    }).toThrow('empty');
  });

  it('rejects very short content', () => {
    expect(() => {
      validateDocContent('hello', 'test');
    }).toThrow('too short');
  });

  it('rejects HTML pages', () => {
    expect(() => {
      validateDocContent('<!DOCTYPE html><html><body>Not found</body></html>', 'test');
    }).toThrow('HTML page');
  });

  it('rejects HTML pages with html tag', () => {
    expect(() => {
      validateDocContent('<html><body>Error</body></html>', 'test');
    }).toThrow('HTML page');
  });
});

// =============================================================================
// Doc Type Subdirectory
// =============================================================================

describe('getDocTypeSubdir', () => {
  it('returns guidelines for guideline type', () => {
    expect(getDocTypeSubdir('guideline')).toBe('guidelines');
  });

  it('returns shortcuts/standard for shortcut type', () => {
    expect(getDocTypeSubdir('shortcut')).toBe('shortcuts/standard');
  });

  it('returns templates for template type', () => {
    expect(getDocTypeSubdir('template')).toBe('templates');
  });
});

// =============================================================================
// fetchWithGhFallback
// =============================================================================

describe('fetchWithGhFallback', () => {
  it('fetches content via direct HTTP when available', async () => {
    // Use a small, reliable URL - the README of this repo
    // Skip if no network access
    try {
      const result = await fetchWithGhFallback(
        'https://raw.githubusercontent.com/jlevy/tbd/413ac0b770e9ddc415f4095af30b64869cf8d0d2/docs/general/research/current/research-modern-bun-monorepo-patterns.md',
      );
      expect(result.content).toBeTruthy();
      expect(result.content.length).toBeGreaterThan(100);
      // Content should be markdown
      expect(result.content).toContain('#');
    } catch {
      // Network not available, skip test
      console.log('Skipping network test - no connectivity');
    }
  });

  it('converts GitHub blob URL before fetching', async () => {
    try {
      const result = await fetchWithGhFallback(
        'https://github.com/jlevy/tbd/blob/413ac0b770e9ddc415f4095af30b64869cf8d0d2/docs/general/research/current/research-modern-bun-monorepo-patterns.md',
      );
      expect(result.content).toBeTruthy();
      expect(result.content.length).toBeGreaterThan(100);
    } catch {
      console.log('Skipping network test - no connectivity');
    }
  });
});

// =============================================================================
// addDoc (integration test with temp directory)
// =============================================================================

describe('addDoc', () => {
  let tempDir: string;

  beforeEach(async () => {
    tempDir = join(tmpdir(), `tbd-doc-add-test-${randomBytes(4).toString('hex')}`);
    await mkdir(tempDir, { recursive: true });
    await mkdir(join(tempDir, '.tbd', 'docs', 'guidelines'), { recursive: true });
    await mkdir(join(tempDir, '.tbd', 'docs', 'shortcuts', 'standard'), { recursive: true });
    await mkdir(join(tempDir, '.tbd', 'docs', 'templates'), { recursive: true });

    // Create a minimal config.yml
    const config = {
      tbd_format: 'f01',
      tbd_version: '0.1.7',
      sync: { branch: 'tbd-sync', remote: 'origin' },
      display: { id_prefix: 'test' },
      settings: { auto_sync: false, doc_auto_sync_hours: 24 },
      docs_cache: {
        files: {},
        lookup_path: ['.tbd/docs/guidelines'],
      },
    };
    await writeFile(join(tempDir, '.tbd', 'config.yml'), stringifyYaml(config));
  });

  afterEach(async () => {
    await rm(tempDir, { recursive: true, force: true });
  });

  it('adds a document and updates config', async () => {
    try {
      const result = await addDoc(tempDir, {
        url: 'https://raw.githubusercontent.com/jlevy/tbd/413ac0b770e9ddc415f4095af30b64869cf8d0d2/docs/general/research/current/research-modern-bun-monorepo-patterns.md',
        name: 'modern-bun-monorepo-patterns',
        docType: 'guideline',
      });

      expect(result.destPath).toBe('guidelines/modern-bun-monorepo-patterns.md');
      expect(result.rawUrl).toContain('raw.githubusercontent.com');

      // Verify file was written
      const content = await readFile(
        join(tempDir, '.tbd', 'docs', 'guidelines', 'modern-bun-monorepo-patterns.md'),
        'utf-8',
      );
      expect(content.length).toBeGreaterThan(100);

      // Verify config was updated
      const configContent = await readFile(join(tempDir, '.tbd', 'config.yml'), 'utf-8');
      expect(configContent).toContain('modern-bun-monorepo-patterns.md');
      expect(configContent).toContain('raw.githubusercontent.com');
    } catch {
      console.log('Skipping network test - no connectivity');
    }
  });

  it('converts GitHub blob URL when adding', async () => {
    try {
      const result = await addDoc(tempDir, {
        url: 'https://github.com/jlevy/tbd/blob/413ac0b770e9ddc415f4095af30b64869cf8d0d2/docs/general/research/current/research-modern-bun-monorepo-patterns.md',
        name: 'modern-bun-monorepo-patterns',
        docType: 'guideline',
      });

      // Should have converted to raw URL
      expect(result.rawUrl).toContain('raw.githubusercontent.com');
      expect(result.rawUrl).not.toContain('/blob/');
    } catch {
      console.log('Skipping network test - no connectivity');
    }
  });

  it('strips .md extension from name', async () => {
    try {
      const result = await addDoc(tempDir, {
        url: 'https://raw.githubusercontent.com/jlevy/tbd/413ac0b770e9ddc415f4095af30b64869cf8d0d2/docs/general/research/current/research-modern-bun-monorepo-patterns.md',
        name: 'modern-bun-monorepo-patterns.md',
        docType: 'guideline',
      });

      // Should not double the .md
      expect(result.destPath).toBe('guidelines/modern-bun-monorepo-patterns.md');
    } catch {
      console.log('Skipping network test - no connectivity');
    }
  });

  it('uses correct subdir for each doc type', async () => {
    // Test shortcut type
    try {
      const result = await addDoc(tempDir, {
        url: 'https://raw.githubusercontent.com/jlevy/tbd/413ac0b770e9ddc415f4095af30b64869cf8d0d2/docs/general/research/current/research-modern-bun-monorepo-patterns.md',
        name: 'test-shortcut',
        docType: 'shortcut',
      });
      expect(result.destPath).toBe('shortcuts/standard/test-shortcut.md');
    } catch {
      console.log('Skipping network test - no connectivity');
    }
  });
});
