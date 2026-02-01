/**
 * Tests for gitignore utilities.
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtemp, rm, readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { hasGitignorePattern, ensureGitignorePatterns } from '../src/utils/gitignore-utils.js';

describe('hasGitignorePattern', () => {
  it('finds exact match', () => {
    const content = 'node_modules/\n.env\n*.log';
    expect(hasGitignorePattern(content, 'node_modules/')).toBe(true);
    expect(hasGitignorePattern(content, '.env')).toBe(true);
    expect(hasGitignorePattern(content, '*.log')).toBe(true);
  });

  it('normalizes trailing slashes', () => {
    const content = 'node_modules/\ndist';
    // Pattern without slash matches pattern with slash
    expect(hasGitignorePattern(content, 'node_modules')).toBe(true);
    // Pattern with slash matches pattern without slash
    expect(hasGitignorePattern(content, 'dist/')).toBe(true);
  });

  it('returns false for non-existent pattern', () => {
    const content = 'node_modules/\n.env';
    expect(hasGitignorePattern(content, 'coverage')).toBe(false);
    expect(hasGitignorePattern(content, 'build')).toBe(false);
  });

  it('skips comment lines', () => {
    const content = '# This is a comment\n#node_modules\nnode_modules/';
    // The commented pattern should not match
    expect(hasGitignorePattern(content, '#node_modules')).toBe(false);
    // But the actual pattern should
    expect(hasGitignorePattern(content, 'node_modules')).toBe(true);
  });

  it('skips blank lines', () => {
    const content = 'node_modules/\n\n\n.env\n   \n*.log';
    expect(hasGitignorePattern(content, 'node_modules')).toBe(true);
    expect(hasGitignorePattern(content, '.env')).toBe(true);
    expect(hasGitignorePattern(content, '*.log')).toBe(true);
  });

  it('is case-sensitive', () => {
    const content = 'node_modules/\nDist/';
    expect(hasGitignorePattern(content, 'Node_Modules')).toBe(false);
    expect(hasGitignorePattern(content, 'dist')).toBe(false);
    expect(hasGitignorePattern(content, 'Dist')).toBe(true);
  });

  it('does not match substrings', () => {
    const content = 'node_modules/';
    expect(hasGitignorePattern(content, 'node')).toBe(false);
    expect(hasGitignorePattern(content, 'modules')).toBe(false);
  });

  it('handles empty content', () => {
    expect(hasGitignorePattern('', 'node_modules')).toBe(false);
  });

  it('handles content with only comments and blanks', () => {
    const content = '# Comment\n\n# Another comment\n   ';
    expect(hasGitignorePattern(content, 'anything')).toBe(false);
  });
});

describe('ensureGitignorePatterns', () => {
  let tempDir: string;

  beforeEach(async () => {
    tempDir = await mkdtemp(join(tmpdir(), 'gitignore-test-'));
  });

  afterEach(async () => {
    await rm(tempDir, { recursive: true, force: true });
  });

  it('creates new file with patterns', async () => {
    const gitignorePath = join(tempDir, '.gitignore');

    const result = await ensureGitignorePatterns(gitignorePath, ['node_modules/', '.env', '*.log']);

    expect(result.created).toBe(true);
    expect(result.added).toEqual(['node_modules/', '.env', '*.log']);
    expect(result.skipped).toEqual([]);

    const content = await readFile(gitignorePath, 'utf-8');
    expect(content).toContain('node_modules/');
    expect(content).toContain('.env');
    expect(content).toContain('*.log');
  });

  it('appends to existing file', async () => {
    const gitignorePath = join(tempDir, '.gitignore');
    await writeFile(gitignorePath, '# Existing content\nnode_modules/\n');

    const result = await ensureGitignorePatterns(gitignorePath, ['.env', '*.log']);

    expect(result.created).toBe(false);
    expect(result.added).toEqual(['.env', '*.log']);
    expect(result.skipped).toEqual([]);

    const content = await readFile(gitignorePath, 'utf-8');
    expect(content).toContain('# Existing content');
    expect(content).toContain('node_modules/');
    expect(content).toContain('.env');
    expect(content).toContain('*.log');
  });

  it('skips existing patterns (idempotent)', async () => {
    const gitignorePath = join(tempDir, '.gitignore');
    await writeFile(gitignorePath, 'node_modules/\n.env\n');

    const result = await ensureGitignorePatterns(gitignorePath, ['node_modules/', '.env', '*.log']);

    expect(result.created).toBe(false);
    expect(result.added).toEqual(['*.log']);
    expect(result.skipped).toEqual(['node_modules/', '.env']);

    const content = await readFile(gitignorePath, 'utf-8');
    // Should not have duplicates
    const nodeModulesCount = (content.match(/node_modules/g) ?? []).length;
    expect(nodeModulesCount).toBe(1);
  });

  it('returns early when all patterns exist', async () => {
    const gitignorePath = join(tempDir, '.gitignore');
    const originalContent = 'node_modules/\n.env\n';
    await writeFile(gitignorePath, originalContent);

    const result = await ensureGitignorePatterns(gitignorePath, ['node_modules/', '.env']);

    expect(result.created).toBe(false);
    expect(result.added).toEqual([]);
    expect(result.skipped).toEqual(['node_modules/', '.env']);

    // File should not be modified
    const content = await readFile(gitignorePath, 'utf-8');
    expect(content).toBe(originalContent);
  });

  it('adds header when provided', async () => {
    const gitignorePath = join(tempDir, '.gitignore');

    await ensureGitignorePatterns(gitignorePath, ['node_modules/'], '# Added by tbd');

    const content = await readFile(gitignorePath, 'utf-8');
    expect(content).toContain('# Added by tbd');
    expect(content.indexOf('# Added by tbd')).toBeLessThan(content.indexOf('node_modules/'));
  });

  it('handles patterns with comments and blanks', async () => {
    const gitignorePath = join(tempDir, '.gitignore');

    const result = await ensureGitignorePatterns(gitignorePath, [
      '# Dependencies',
      'node_modules/',
      '',
      '# Build output',
      'dist/',
    ]);

    expect(result.added).toEqual(['node_modules/', 'dist/']);

    const content = await readFile(gitignorePath, 'utf-8');
    expect(content).toContain('# Dependencies');
    expect(content).toContain('# Build output');
  });

  it('normalizes trailing slashes when checking', async () => {
    const gitignorePath = join(tempDir, '.gitignore');
    await writeFile(gitignorePath, 'dist\n');

    const result = await ensureGitignorePatterns(gitignorePath, ['dist/']);

    expect(result.skipped).toEqual(['dist/']);
    expect(result.added).toEqual([]);
  });

  it('preserves existing user content', async () => {
    const gitignorePath = join(tempDir, '.gitignore');
    const userContent = '# My custom ignores\n.myconfig\nmy-secret.key\n';
    await writeFile(gitignorePath, userContent);

    await ensureGitignorePatterns(gitignorePath, ['node_modules/', '.env']);

    const content = await readFile(gitignorePath, 'utf-8');
    expect(content).toContain('# My custom ignores');
    expect(content).toContain('.myconfig');
    expect(content).toContain('my-secret.key');
    expect(content).toContain('node_modules/');
    expect(content).toContain('.env');
  });
});

describe('ensureGitignorePatterns integration', () => {
  let tempDir: string;

  beforeEach(async () => {
    tempDir = await mkdtemp(join(tmpdir(), 'gitignore-e2e-'));
  });

  afterEach(async () => {
    await rm(tempDir, { recursive: true, force: true });
  });

  it('full workflow: create, append, idempotent', async () => {
    const gitignorePath = join(tempDir, '.gitignore');

    // Step 1: Create new file
    const result1 = await ensureGitignorePatterns(gitignorePath, ['node_modules/', '.env']);
    expect(result1.created).toBe(true);
    expect(result1.added).toEqual(['node_modules/', '.env']);

    // Step 2: Add user pattern manually
    let content = await readFile(gitignorePath, 'utf-8');
    content += '# User added\n.myconfig\n';
    await writeFile(gitignorePath, content);

    // Step 3: Run again with same + new patterns
    const result2 = await ensureGitignorePatterns(gitignorePath, [
      'node_modules/',
      '.env',
      '*.log',
    ]);
    expect(result2.created).toBe(false);
    expect(result2.added).toEqual(['*.log']);
    expect(result2.skipped).toEqual(['node_modules/', '.env']);

    // Step 4: Verify user pattern preserved
    const finalContent = await readFile(gitignorePath, 'utf-8');
    expect(finalContent).toContain('.myconfig');
    expect(finalContent).toContain('# User added');

    // Step 5: Run again - should be no-op
    const result3 = await ensureGitignorePatterns(gitignorePath, [
      'node_modules/',
      '.env',
      '*.log',
    ]);
    expect(result3.added).toEqual([]);
    expect(result3.skipped).toEqual(['node_modules/', '.env', '*.log']);
  });
});
