/**
 * Tests for github-fetch.ts - GitHub URL utilities and content fetching.
 *
 * Fetch functions are tested with mocked globalThis.fetch and child_process
 * so tests run without network access and never silently skip.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

import {
  githubBlobToRawUrl,
  isGitHubUrl,
  parseRawGitHubUrl,
  directFetch,
  ghCliFetch,
  fetchWithGhFallback,
} from '../src/file/github-fetch.js';

// =============================================================================
// githubBlobToRawUrl
// =============================================================================

describe('githubBlobToRawUrl', () => {
  it('converts GitHub blob URL to raw URL', () => {
    const url =
      'https://github.com/jlevy/tbd/blob/413ac0b770e9ddc415f4095af30b64869cf8d0d2/docs/general/research/current/research-modern-bun-monorepo-patterns.md';
    expect(githubBlobToRawUrl(url)).toBe(
      'https://raw.githubusercontent.com/jlevy/tbd/413ac0b770e9ddc415f4095af30b64869cf8d0d2/docs/general/research/current/research-modern-bun-monorepo-patterns.md',
    );
  });

  it('converts GitHub blob URL with branch name', () => {
    expect(githubBlobToRawUrl('https://github.com/org/repo/blob/main/docs/file.md')).toBe(
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

  it('passes through GitHub tree URLs unchanged', () => {
    const url = 'https://github.com/org/repo/tree/main/docs';
    expect(githubBlobToRawUrl(url)).toBe(url);
  });

  it('handles http:// URLs', () => {
    expect(githubBlobToRawUrl('http://github.com/org/repo/blob/main/file.md')).toBe(
      'https://raw.githubusercontent.com/org/repo/main/file.md',
    );
  });
});

// =============================================================================
// isGitHubUrl
// =============================================================================

describe('isGitHubUrl', () => {
  it('recognizes github.com URLs', () => {
    expect(isGitHubUrl('https://github.com/org/repo')).toBe(true);
  });

  it('recognizes raw.githubusercontent.com URLs', () => {
    expect(isGitHubUrl('https://raw.githubusercontent.com/org/repo/main/file.md')).toBe(true);
  });

  it('rejects non-GitHub URLs', () => {
    expect(isGitHubUrl('https://example.com/docs')).toBe(false);
  });

  it('rejects partial matches', () => {
    expect(isGitHubUrl('https://notgithub.com/org/repo')).toBe(false);
  });
});

// =============================================================================
// parseRawGitHubUrl
// =============================================================================

describe('parseRawGitHubUrl', () => {
  it('parses raw GitHub URL into components', () => {
    const result = parseRawGitHubUrl(
      'https://raw.githubusercontent.com/jlevy/tbd/main/docs/file.md',
    );
    expect(result).toEqual({
      owner: 'jlevy',
      repo: 'tbd',
      ref: 'main',
      path: 'docs/file.md',
    });
  });

  it('parses URL with commit SHA ref', () => {
    const result = parseRawGitHubUrl(
      'https://raw.githubusercontent.com/org/repo/abc123/src/index.ts',
    );
    expect(result).toEqual({
      owner: 'org',
      repo: 'repo',
      ref: 'abc123',
      path: 'src/index.ts',
    });
  });

  it('returns null for non-raw-GitHub URLs', () => {
    expect(parseRawGitHubUrl('https://github.com/org/repo/blob/main/file.md')).toBeNull();
    expect(parseRawGitHubUrl('https://example.com/file.md')).toBeNull();
  });
});

// =============================================================================
// directFetch (mocked)
// =============================================================================

describe('directFetch', () => {
  let originalFetch: typeof globalThis.fetch;

  beforeEach(() => {
    originalFetch = globalThis.fetch;
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  it('returns response body text on 200', async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      text: () => Promise.resolve('# Hello World\n\nSome content.'),
    });

    const result = await directFetch('https://example.com/file.md');
    expect(result).toBe('# Hello World\n\nSome content.');

    expect(globalThis.fetch).toHaveBeenCalledOnce();
    const [url, init] = (globalThis.fetch as ReturnType<typeof vi.fn>).mock.calls[0]!;
    expect(url).toBe('https://example.com/file.md');
    expect(init.headers['User-Agent']).toBe('get-tbd/1.0');
    expect(init.headers.Accept).toContain('text/plain');
  });

  it('throws on HTTP 403', async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 403,
      statusText: 'Forbidden',
    });

    await expect(directFetch('https://example.com/file.md')).rejects.toThrow('HTTP 403: Forbidden');
  });

  it('throws on HTTP 404', async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 404,
      statusText: 'Not Found',
    });

    await expect(directFetch('https://example.com/file.md')).rejects.toThrow('HTTP 404: Not Found');
  });

  it('throws on HTTP 500', async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 500,
      statusText: 'Internal Server Error',
    });

    await expect(directFetch('https://example.com/file.md')).rejects.toThrow('HTTP 500');
  });

  it('throws on network error', async () => {
    globalThis.fetch = vi.fn().mockRejectedValue(new TypeError('fetch failed'));

    await expect(directFetch('https://example.com/file.md')).rejects.toThrow('fetch failed');
  });

  it('passes AbortSignal for timeout', async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      text: () => Promise.resolve('content'),
    });

    await directFetch('https://example.com/file.md', { timeout: 5000 });

    const [, init] = (globalThis.fetch as ReturnType<typeof vi.fn>).mock.calls[0]!;
    expect(init.signal).toBeInstanceOf(AbortSignal);
  });
});

// =============================================================================
// ghCliFetch (mocked via child_process)
// =============================================================================

// We mock the module at the top level for ghCliFetch tests.
// ghCliFetch uses execFile internally, which we mock via vi.mock.
vi.mock('node:child_process', async (importOriginal) => {
  return {
    ...(await importOriginal()),
    execFile: vi.fn(),
  };
});

// We need to import the mocked execFile to set up return values
import { execFile } from 'node:child_process';

describe('ghCliFetch', () => {
  beforeEach(() => {
    vi.mocked(execFile).mockReset();
  });

  it('decodes base64 content from gh api for raw GitHub URLs', async () => {
    const base64Content = Buffer.from('# Hello from gh CLI').toString('base64');

    // execFile is called as execFile(cmd, args, callback)
    vi.mocked(execFile).mockImplementation((_cmd, _args, callback: unknown) => {
      (callback as (err: null, result: { stdout: string; stderr: string }) => void)(null, {
        stdout: base64Content + '\n',
        stderr: '',
      });
      return undefined as never;
    });

    const result = await ghCliFetch('https://raw.githubusercontent.com/org/repo/main/docs/file.md');
    expect(result).toBe('# Hello from gh CLI');

    // Verify the correct API endpoint was constructed
    const call = vi.mocked(execFile).mock.calls[0]!;
    expect(call[0]).toBe('gh');
    const args = call[1] as string[];
    expect(args[0]).toBe('api');
    expect(args[1]).toBe('/repos/org/repo/contents/docs/file.md?ref=main');
    expect(args).toContain('--jq');
    expect(args).toContain('.content');
  });

  it('wraps execFile errors with descriptive message', async () => {
    vi.mocked(execFile).mockImplementation((_cmd, _args, callback: unknown) => {
      (callback as (err: Error) => void)(new Error('gh: not logged in'));
      return undefined as never;
    });

    await expect(
      ghCliFetch('https://raw.githubusercontent.com/org/repo/main/docs/file.md'),
    ).rejects.toThrow('Failed to fetch via gh CLI: gh: not logged in');
  });

  it('falls back to direct gh api call for non-raw-GitHub URLs', async () => {
    vi.mocked(execFile).mockImplementation((_cmd, _args, callback: unknown) => {
      (callback as (err: null, result: { stdout: string; stderr: string }) => void)(null, {
        stdout: '{"data": "some api response"}',
        stderr: '',
      });
      return undefined as never;
    });

    const result = await ghCliFetch('https://api.github.com/some/endpoint');
    expect(result).toBe('{"data": "some api response"}');

    // Should call gh api directly with the URL
    const call = vi.mocked(execFile).mock.calls[0]!;
    expect(call[0]).toBe('gh');
    const args = call[1] as string[];
    expect(args).toEqual(['api', 'https://api.github.com/some/endpoint']);
  });

  it('wraps errors from non-raw-GitHub URL fallback path', async () => {
    vi.mocked(execFile).mockImplementation((_cmd, _args, callback: unknown) => {
      (callback as (err: Error) => void)(new Error('connection refused'));
      return undefined as never;
    });

    await expect(ghCliFetch('https://api.github.com/some/endpoint')).rejects.toThrow(
      'Failed to fetch via gh CLI: connection refused',
    );
  });

  it('constructs correct API URL with ref query param', async () => {
    const base64Content = Buffer.from('content').toString('base64');

    vi.mocked(execFile).mockImplementation((_cmd, _args, callback: unknown) => {
      (callback as (err: null, result: { stdout: string; stderr: string }) => void)(null, {
        stdout: base64Content,
        stderr: '',
      });
      return undefined as never;
    });

    await ghCliFetch('https://raw.githubusercontent.com/jlevy/tbd/abc123def/src/deep/path/file.ts');

    const args = vi.mocked(execFile).mock.calls[0]![1] as string[];
    expect(args[1]).toBe('/repos/jlevy/tbd/contents/src/deep/path/file.ts?ref=abc123def');
  });
});

// =============================================================================
// fetchWithGhFallback (mocked)
// =============================================================================

describe('fetchWithGhFallback', () => {
  let originalFetch: typeof globalThis.fetch;

  beforeEach(() => {
    originalFetch = globalThis.fetch;
    vi.mocked(execFile).mockReset();
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  it('returns content from direct fetch on success', async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      text: () => Promise.resolve('# Direct content'),
    });

    const result = await fetchWithGhFallback('https://example.com/file.md');
    expect(result.content).toBe('# Direct content');
    expect(result.usedGhCli).toBe(false);

    // gh CLI should not have been called
    expect(execFile).not.toHaveBeenCalled();
  });

  it('falls back to gh CLI on HTTP 403', async () => {
    // Direct fetch returns 403
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 403,
      statusText: 'Forbidden',
    });

    // gh CLI returns content
    const base64Content = Buffer.from('# Content via gh CLI').toString('base64');
    vi.mocked(execFile).mockImplementation((_cmd, _args, callback: unknown) => {
      (callback as (err: null, result: { stdout: string; stderr: string }) => void)(null, {
        stdout: base64Content,
        stderr: '',
      });
      return undefined as never;
    });

    const result = await fetchWithGhFallback(
      'https://raw.githubusercontent.com/org/repo/main/file.md',
    );
    expect(result.content).toBe('# Content via gh CLI');
    expect(result.usedGhCli).toBe(true);
  });

  it('re-throws non-403 HTTP errors without trying gh CLI', async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 404,
      statusText: 'Not Found',
    });

    await expect(
      fetchWithGhFallback('https://raw.githubusercontent.com/org/repo/main/file.md'),
    ).rejects.toThrow('HTTP 404');

    // gh CLI should not have been called
    expect(execFile).not.toHaveBeenCalled();
  });

  it('re-throws network errors without trying gh CLI', async () => {
    globalThis.fetch = vi.fn().mockRejectedValue(new TypeError('fetch failed'));

    await expect(fetchWithGhFallback('https://example.com/file.md')).rejects.toThrow(
      'fetch failed',
    );

    expect(execFile).not.toHaveBeenCalled();
  });

  it('throws if both direct fetch (403) and gh CLI fail', async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 403,
      statusText: 'Forbidden',
    });

    vi.mocked(execFile).mockImplementation((_cmd, _args, callback: unknown) => {
      (callback as (err: Error) => void)(new Error('gh: not logged in'));
      return undefined as never;
    });

    await expect(
      fetchWithGhFallback('https://raw.githubusercontent.com/org/repo/main/file.md'),
    ).rejects.toThrow('Failed to fetch via gh CLI');
  });

  it('converts blob URL to raw URL before fetching', async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      text: () => Promise.resolve('content'),
    });

    await fetchWithGhFallback('https://github.com/org/repo/blob/main/docs/file.md');

    // Should have called fetch with the raw URL, not the blob URL
    const [url] = (globalThis.fetch as ReturnType<typeof vi.fn>).mock.calls[0]!;
    expect(url).toBe('https://raw.githubusercontent.com/org/repo/main/docs/file.md');
  });

  it('passes through non-GitHub URLs unchanged', async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      text: () => Promise.resolve('content'),
    });

    await fetchWithGhFallback('https://example.com/docs/file.md');

    const [url] = (globalThis.fetch as ReturnType<typeof vi.fn>).mock.calls[0]!;
    expect(url).toBe('https://example.com/docs/file.md');
  });
});
