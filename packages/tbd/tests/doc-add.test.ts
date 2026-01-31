/**
 * Tests for doc-add.ts - adding external docs to the doc cache.
 *
 * Fetch functions are mocked so tests run without network access
 * and never silently skip. See github-fetch.test.ts for fetch tests.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { mkdir, writeFile, readFile, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { randomBytes } from 'node:crypto';
import { stringify as stringifyYaml } from 'yaml';

// Mock github-fetch so addDoc doesn't hit the network
vi.mock('../src/file/github-fetch.js', async (importOriginal) => {
  return {
    ...(await importOriginal()),
    fetchWithGhFallback: vi.fn().mockResolvedValue({
      content: '# Mocked Document\n\nThis is mocked content for testing.\n',
      usedGhCli: false,
    }),
  };
});

import { validateDocContent, getDocTypeSubdir, addDoc } from '../src/file/doc-add.js';

import { githubBlobToRawUrl, fetchWithGhFallback } from '../src/file/github-fetch.js';

// =============================================================================
// GitHub URL Conversion
// =============================================================================

describe('githubBlobToRawUrl', () => {
  it('converts GitHub blob URL to raw URL', () => {
    const url =
      'https://github.com/jlevy/tbd/blob/413ac0b770e9ddc415f4095af30b64869cf8d0d2/docs/general/research/current/research-modern-bun-monorepo-patterns.md';
    const expected =
      'https://raw.githubusercontent.com/jlevy/tbd/413ac0b770e9ddc415f4095af30b64869cf8d0d2/docs/general/research/current/research-modern-bun-monorepo-patterns.md';
    expect(githubBlobToRawUrl(url)).toBe(expected);
  });

  it('converts GitHub blob URL with branch name', () => {
    const url = 'https://github.com/org/repo/blob/main/docs/file.md';
    expect(githubBlobToRawUrl(url)).toBe(
      'https://raw.githubusercontent.com/org/repo/main/docs/file.md',
    );
  });

  it('passes through raw.githubusercontent.com URLs unchanged', () => {
    const url = 'https://raw.githubusercontent.com/org/repo/main/docs/file.md';
    expect(githubBlobToRawUrl(url)).toBe(url);
  });

  it('passes through non-GitHub URLs unchanged', () => {
    const url = 'https://example.com/docs/file.md';
    expect(githubBlobToRawUrl(url)).toBe(url);
  });

  it('passes through GitHub non-blob URLs unchanged', () => {
    const url = 'https://github.com/org/repo/tree/main/docs';
    expect(githubBlobToRawUrl(url)).toBe(url);
  });

  it('handles nested paths correctly', () => {
    const url = 'https://github.com/owner/repo/blob/feature/branch/src/deep/nested/path/file.md';
    // Note: 'feature/branch' is the ref because the regex captures the first segment after blob/
    expect(githubBlobToRawUrl(url)).toBe(
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

  it('returns shortcuts/custom for shortcut type', () => {
    expect(getDocTypeSubdir('shortcut')).toBe('shortcuts/custom');
  });

  it('returns templates for template type', () => {
    expect(getDocTypeSubdir('template')).toBe('templates');
  });
});

// =============================================================================
// addDoc (mocked fetch, real filesystem)
// =============================================================================

describe('addDoc', () => {
  let tempDir: string;

  beforeEach(async () => {
    vi.mocked(fetchWithGhFallback).mockReset();
    vi.mocked(fetchWithGhFallback).mockResolvedValue({
      content: '# Mocked Document\n\nThis is mocked content for testing.\n',
      usedGhCli: false,
    });

    tempDir = join(tmpdir(), `tbd-doc-add-test-${randomBytes(4).toString('hex')}`);
    await mkdir(tempDir, { recursive: true });
    await mkdir(join(tempDir, '.tbd', 'docs', 'guidelines'), { recursive: true });
    await mkdir(join(tempDir, '.tbd', 'docs', 'shortcuts', 'custom'), { recursive: true });
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
    const result = await addDoc(tempDir, {
      url: 'https://raw.githubusercontent.com/org/repo/main/docs/file.md',
      name: 'modern-bun-monorepo-patterns',
      docType: 'guideline',
    });

    expect(result.destPath).toBe('guidelines/modern-bun-monorepo-patterns.md');
    expect(result.rawUrl).toContain('raw.githubusercontent.com');

    // Verify fetchWithGhFallback was called with the URL
    expect(fetchWithGhFallback).toHaveBeenCalledWith(
      'https://raw.githubusercontent.com/org/repo/main/docs/file.md',
    );

    // Verify file was written
    const content = await readFile(
      join(tempDir, '.tbd', 'docs', 'guidelines', 'modern-bun-monorepo-patterns.md'),
      'utf-8',
    );
    expect(content).toBe('# Mocked Document\n\nThis is mocked content for testing.\n');

    // Verify config was updated
    const configContent = await readFile(join(tempDir, '.tbd', 'config.yml'), 'utf-8');
    expect(configContent).toContain('modern-bun-monorepo-patterns.md');
    expect(configContent).toContain('raw.githubusercontent.com');
  });

  it('converts GitHub blob URL in rawUrl result', async () => {
    const result = await addDoc(tempDir, {
      url: 'https://github.com/org/repo/blob/main/docs/file.md',
      name: 'modern-bun-monorepo-patterns',
      docType: 'guideline',
    });

    // rawUrl should be the converted raw URL
    expect(result.rawUrl).toBe('https://raw.githubusercontent.com/org/repo/main/docs/file.md');
    expect(result.rawUrl).not.toContain('/blob/');
  });

  it('strips .md extension from name', async () => {
    const result = await addDoc(tempDir, {
      url: 'https://raw.githubusercontent.com/org/repo/main/docs/file.md',
      name: 'modern-bun-monorepo-patterns.md',
      docType: 'guideline',
    });

    // Should not double the .md
    expect(result.destPath).toBe('guidelines/modern-bun-monorepo-patterns.md');
  });

  it('uses shortcuts/custom subdir for shortcut type', async () => {
    const result = await addDoc(tempDir, {
      url: 'https://raw.githubusercontent.com/org/repo/main/docs/file.md',
      name: 'test-shortcut',
      docType: 'shortcut',
    });

    expect(result.destPath).toBe('shortcuts/custom/test-shortcut.md');

    // Verify file went to the right place
    const content = await readFile(
      join(tempDir, '.tbd', 'docs', 'shortcuts', 'custom', 'test-shortcut.md'),
      'utf-8',
    );
    expect(content).toBe('# Mocked Document\n\nThis is mocked content for testing.\n');
  });

  it('uses templates subdir for template type', async () => {
    const result = await addDoc(tempDir, {
      url: 'https://raw.githubusercontent.com/org/repo/main/docs/file.md',
      name: 'test-template',
      docType: 'template',
    });

    expect(result.destPath).toBe('templates/test-template.md');
  });

  it('adds lookup_path entry if not already present', async () => {
    await addDoc(tempDir, {
      url: 'https://raw.githubusercontent.com/org/repo/main/docs/file.md',
      name: 'test-shortcut',
      docType: 'shortcut',
    });

    const configContent = await readFile(join(tempDir, '.tbd', 'config.yml'), 'utf-8');
    expect(configContent).toContain('.tbd/docs/shortcuts/custom');
  });

  it('does not duplicate lookup_path entry on second add', async () => {
    await addDoc(tempDir, {
      url: 'https://raw.githubusercontent.com/org/repo/main/docs/file1.md',
      name: 'first-guideline',
      docType: 'guideline',
    });

    await addDoc(tempDir, {
      url: 'https://raw.githubusercontent.com/org/repo/main/docs/file2.md',
      name: 'second-guideline',
      docType: 'guideline',
    });

    const configContent = await readFile(join(tempDir, '.tbd', 'config.yml'), 'utf-8');
    // Count occurrences of .tbd/docs/guidelines
    const matches = configContent.match(/\.tbd\/docs\/guidelines/g);
    expect(matches?.length).toBe(1);
  });

  it('reports usedGhCli from fetch result', async () => {
    vi.mocked(fetchWithGhFallback).mockResolvedValue({
      content: '# Fetched via gh CLI\n\nContent here.\n',
      usedGhCli: true,
    });

    const result = await addDoc(tempDir, {
      url: 'https://raw.githubusercontent.com/org/repo/main/docs/file.md',
      name: 'gh-fetched-doc',
      docType: 'guideline',
    });

    expect(result.usedGhCli).toBe(true);
  });

  it('throws when fetch fails', async () => {
    vi.mocked(fetchWithGhFallback).mockRejectedValue(new Error('HTTP 404: Not Found'));

    await expect(
      addDoc(tempDir, {
        url: 'https://raw.githubusercontent.com/org/repo/main/nonexistent.md',
        name: 'missing-doc',
        docType: 'guideline',
      }),
    ).rejects.toThrow('HTTP 404');
  });

  it('throws when content fails validation', async () => {
    vi.mocked(fetchWithGhFallback).mockResolvedValue({
      content: '',
      usedGhCli: false,
    });

    await expect(
      addDoc(tempDir, {
        url: 'https://raw.githubusercontent.com/org/repo/main/empty.md',
        name: 'empty-doc',
        docType: 'guideline',
      }),
    ).rejects.toThrow('empty');
  });
});
