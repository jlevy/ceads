/**
 * Tests for project path utilities.
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtemp, rm, mkdir, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import {
  normalizePath,
  isPathWithinProject,
  resolveProjectPath,
  validateFileExists,
  resolveAndValidatePath,
  ProjectPathError,
} from '../src/lib/project-paths.js';

describe('normalizePath', () => {
  it('removes leading ./', () => {
    expect(normalizePath('./docs/spec.md')).toBe('docs/spec.md');
    expect(normalizePath('./foo/./bar')).toBe('foo/bar');
  });

  it('removes multiple leading ./', () => {
    expect(normalizePath('././docs/spec.md')).toBe('docs/spec.md');
  });

  it('converts backslashes to forward slashes', () => {
    expect(normalizePath('docs\\project\\spec.md')).toBe('docs/project/spec.md');
    expect(normalizePath('docs\\\\project\\\\spec.md')).toBe('docs/project/spec.md');
  });

  it('removes redundant slashes', () => {
    expect(normalizePath('docs//project///spec.md')).toBe('docs/project/spec.md');
  });

  it('handles empty string', () => {
    expect(normalizePath('')).toBe('');
  });

  it('handles just .', () => {
    expect(normalizePath('.')).toBe('');
    expect(normalizePath('./')).toBe('');
  });

  it('removes trailing slash', () => {
    expect(normalizePath('docs/project/')).toBe('docs/project');
  });

  it('handles simple filename', () => {
    expect(normalizePath('spec.md')).toBe('spec.md');
  });

  it('resolves .. components', () => {
    expect(normalizePath('docs/project/../spec.md')).toBe('docs/spec.md');
    expect(normalizePath('a/b/c/../../d')).toBe('a/d');
  });
});

describe('isPathWithinProject', () => {
  const projectRoot = '/home/user/project';

  it('returns true for path at project root', () => {
    expect(isPathWithinProject('/home/user/project', projectRoot)).toBe(true);
  });

  it('returns true for subdirectory', () => {
    expect(isPathWithinProject('/home/user/project/docs', projectRoot)).toBe(true);
    expect(isPathWithinProject('/home/user/project/docs/spec.md', projectRoot)).toBe(true);
  });

  it('returns true for deeply nested path', () => {
    expect(isPathWithinProject('/home/user/project/a/b/c/d/e.md', projectRoot)).toBe(true);
  });

  it('returns false for parent directory', () => {
    expect(isPathWithinProject('/home/user', projectRoot)).toBe(false);
  });

  it('returns false for sibling directory', () => {
    expect(isPathWithinProject('/home/user/other-project', projectRoot)).toBe(false);
  });

  it('returns false for path with similar prefix', () => {
    // /home/user/project-backup should NOT match /home/user/project
    expect(isPathWithinProject('/home/user/project-backup', projectRoot)).toBe(false);
    expect(isPathWithinProject('/home/user/project-backup/file', projectRoot)).toBe(false);
  });

  it('returns false for completely unrelated path', () => {
    expect(isPathWithinProject('/etc/passwd', projectRoot)).toBe(false);
    expect(isPathWithinProject('/tmp/file', projectRoot)).toBe(false);
  });
});

describe('resolveProjectPath', () => {
  const projectRoot = '/home/user/project';

  describe('absolute paths', () => {
    it('converts absolute path within project to relative', () => {
      const result = resolveProjectPath(
        '/home/user/project/docs/spec.md',
        projectRoot,
        projectRoot,
      );
      expect(result.relativePath).toBe('docs/spec.md');
      // Note: absolutePath varies by platform (Windows adds drive letter)
      // so we only verify relativePath which is the primary output
    });

    it('converts deeply nested absolute path', () => {
      const result = resolveProjectPath(
        '/home/user/project/docs/project/specs/active/plan.md',
        projectRoot,
        projectRoot,
      );
      expect(result.relativePath).toBe('docs/project/specs/active/plan.md');
    });

    it('handles absolute path at project root', () => {
      const result = resolveProjectPath('/home/user/project/file.md', projectRoot, projectRoot);
      expect(result.relativePath).toBe('file.md');
    });

    it('throws for absolute path outside project', () => {
      expect(() => resolveProjectPath('/etc/passwd', projectRoot, projectRoot)).toThrow(
        ProjectPathError,
      );
      expect(() => resolveProjectPath('/etc/passwd', projectRoot, projectRoot)).toThrow(
        'Path is outside project root',
      );
    });

    it('throws for absolute path in sibling directory', () => {
      expect(() =>
        resolveProjectPath('/home/user/other-project/file.md', projectRoot, projectRoot),
      ).toThrow(ProjectPathError);
    });
  });

  describe('relative paths from project root', () => {
    it('normalizes simple relative path', () => {
      const result = resolveProjectPath('docs/spec.md', projectRoot, projectRoot);
      expect(result.relativePath).toBe('docs/spec.md');
    });

    it('removes leading ./ from relative path', () => {
      const result = resolveProjectPath('./docs/spec.md', projectRoot, projectRoot);
      expect(result.relativePath).toBe('docs/spec.md');
    });

    it('handles filename only', () => {
      const result = resolveProjectPath('README.md', projectRoot, projectRoot);
      expect(result.relativePath).toBe('README.md');
    });
  });

  describe('relative paths from subdirectory', () => {
    const cwd = '/home/user/project/src';

    it('resolves relative path from subdirectory', () => {
      const result = resolveProjectPath('../docs/spec.md', projectRoot, cwd);
      expect(result.relativePath).toBe('docs/spec.md');
    });

    it('resolves path relative to cwd', () => {
      const result = resolveProjectPath('utils/helper.ts', projectRoot, cwd);
      expect(result.relativePath).toBe('src/utils/helper.ts');
    });

    it('resolves multiple .. components', () => {
      const deepCwd = '/home/user/project/src/lib/utils';
      const result = resolveProjectPath('../../../docs/spec.md', projectRoot, deepCwd);
      expect(result.relativePath).toBe('docs/spec.md');
    });

    it('throws when .. escapes project', () => {
      expect(() => resolveProjectPath('../../other-project/file.md', projectRoot, cwd)).toThrow(
        ProjectPathError,
      );
      expect(() => resolveProjectPath('../../other-project/file.md', projectRoot, cwd)).toThrow(
        'outside project root',
      );
    });
  });

  describe('normalization', () => {
    it('converts backslashes to forward slashes', () => {
      const result = resolveProjectPath('docs\\spec.md', projectRoot, projectRoot);
      expect(result.relativePath).toBe('docs/spec.md');
    });

    it('removes redundant slashes', () => {
      const result = resolveProjectPath('docs//project///spec.md', projectRoot, projectRoot);
      expect(result.relativePath).toBe('docs/project/spec.md');
    });

    it('resolves . components', () => {
      const result = resolveProjectPath('./docs/./spec.md', projectRoot, projectRoot);
      expect(result.relativePath).toBe('docs/spec.md');
    });

    it('resolves .. components within project', () => {
      const result = resolveProjectPath('docs/project/../spec.md', projectRoot, projectRoot);
      expect(result.relativePath).toBe('docs/spec.md');
    });
  });

  describe('error codes', () => {
    it('has OUTSIDE_PROJECT code for paths outside project', () => {
      try {
        resolveProjectPath('/etc/passwd', projectRoot, projectRoot);
        expect.fail('Should have thrown');
      } catch (error) {
        expect(error).toBeInstanceOf(ProjectPathError);
        expect((error as ProjectPathError).code).toBe('OUTSIDE_PROJECT');
      }
    });
  });
});

describe('validateFileExists', () => {
  let tempDir: string;

  beforeEach(async () => {
    tempDir = await mkdtemp(join(tmpdir(), 'project-paths-test-'));
  });

  afterEach(async () => {
    await rm(tempDir, { recursive: true, force: true });
  });

  it('returns true for existing file', async () => {
    const filePath = join(tempDir, 'test.md');
    await writeFile(filePath, 'content');

    const resolved = { relativePath: 'test.md', absolutePath: filePath };
    await expect(validateFileExists(resolved)).resolves.toBe(true);
  });

  it('throws for non-existent file', async () => {
    const resolved = { relativePath: 'missing.md', absolutePath: join(tempDir, 'missing.md') };

    await expect(validateFileExists(resolved)).rejects.toThrow(ProjectPathError);
    await expect(validateFileExists(resolved)).rejects.toThrow('File not found: missing.md');
  });

  it('throws for directory instead of file', async () => {
    const dirPath = join(tempDir, 'subdir');
    await mkdir(dirPath);

    const resolved = { relativePath: 'subdir', absolutePath: dirPath };

    await expect(validateFileExists(resolved)).rejects.toThrow(ProjectPathError);
    await expect(validateFileExists(resolved)).rejects.toThrow('Path is not a file');
  });

  it('has NOT_FOUND code for missing files', async () => {
    const resolved = { relativePath: 'missing.md', absolutePath: join(tempDir, 'missing.md') };

    try {
      await validateFileExists(resolved);
      expect.fail('Should have thrown');
    } catch (error) {
      expect(error).toBeInstanceOf(ProjectPathError);
      expect((error as ProjectPathError).code).toBe('NOT_FOUND');
    }
  });

  it('has NOT_A_FILE code for directories', async () => {
    const dirPath = join(tempDir, 'subdir');
    await mkdir(dirPath);
    const resolved = { relativePath: 'subdir', absolutePath: dirPath };

    try {
      await validateFileExists(resolved);
      expect.fail('Should have thrown');
    } catch (error) {
      expect(error).toBeInstanceOf(ProjectPathError);
      expect((error as ProjectPathError).code).toBe('NOT_A_FILE');
    }
  });
});

describe('resolveAndValidatePath', () => {
  let tempDir: string;

  beforeEach(async () => {
    tempDir = await mkdtemp(join(tmpdir(), 'project-paths-test-'));
    await mkdir(join(tempDir, 'docs'));
  });

  afterEach(async () => {
    await rm(tempDir, { recursive: true, force: true });
  });

  it('resolves and validates existing file', async () => {
    const filePath = join(tempDir, 'docs', 'spec.md');
    await writeFile(filePath, 'content');

    const result = await resolveAndValidatePath('docs/spec.md', tempDir, tempDir);
    expect(result.relativePath).toBe('docs/spec.md');
    expect(result.absolutePath).toBe(filePath);
  });

  it('throws for non-existent file', async () => {
    await expect(resolveAndValidatePath('docs/missing.md', tempDir, tempDir)).rejects.toThrow(
      'File not found',
    );
  });

  it('throws for path outside project', async () => {
    await expect(resolveAndValidatePath('/etc/passwd', tempDir, tempDir)).rejects.toThrow(
      'outside project root',
    );
  });

  it('resolves from subdirectory correctly', async () => {
    const filePath = join(tempDir, 'docs', 'spec.md');
    await writeFile(filePath, 'content');
    const srcDir = join(tempDir, 'src');
    await mkdir(srcDir);

    const result = await resolveAndValidatePath('../docs/spec.md', tempDir, srcDir);
    expect(result.relativePath).toBe('docs/spec.md');
  });
});

describe('real-world scenarios', () => {
  let tempDir: string;

  beforeEach(async () => {
    tempDir = await mkdtemp(join(tmpdir(), 'project-paths-test-'));
    await mkdir(join(tempDir, 'docs', 'project', 'specs', 'active'), { recursive: true });
    await mkdir(join(tempDir, 'src'), { recursive: true });
    await writeFile(
      join(tempDir, 'docs', 'project', 'specs', 'active', 'plan-2026-01-26-feature.md'),
      '# Feature Spec',
    );
  });

  afterEach(async () => {
    await rm(tempDir, { recursive: true, force: true });
  });

  it('normalizes full path consistently', async () => {
    const result = await resolveAndValidatePath(
      'docs/project/specs/active/plan-2026-01-26-feature.md',
      tempDir,
      tempDir,
    );
    expect(result.relativePath).toBe('docs/project/specs/active/plan-2026-01-26-feature.md');
  });

  it('normalizes path with ./ consistently', async () => {
    const result = await resolveAndValidatePath(
      './docs/project/specs/active/plan-2026-01-26-feature.md',
      tempDir,
      tempDir,
    );
    expect(result.relativePath).toBe('docs/project/specs/active/plan-2026-01-26-feature.md');
  });

  it('normalizes absolute path consistently', async () => {
    const absolutePath = join(
      tempDir,
      'docs',
      'project',
      'specs',
      'active',
      'plan-2026-01-26-feature.md',
    );
    const result = await resolveAndValidatePath(absolutePath, tempDir, tempDir);
    expect(result.relativePath).toBe('docs/project/specs/active/plan-2026-01-26-feature.md');
  });

  it('normalizes path from subdirectory consistently', async () => {
    const srcDir = join(tempDir, 'src');
    const result = await resolveAndValidatePath(
      '../docs/project/specs/active/plan-2026-01-26-feature.md',
      tempDir,
      srcDir,
    );
    expect(result.relativePath).toBe('docs/project/specs/active/plan-2026-01-26-feature.md');
  });

  it('all normalization approaches produce identical result', async () => {
    const srcDir = join(tempDir, 'src');
    const absolutePath = join(
      tempDir,
      'docs',
      'project',
      'specs',
      'active',
      'plan-2026-01-26-feature.md',
    );

    const fromRoot = await resolveAndValidatePath(
      'docs/project/specs/active/plan-2026-01-26-feature.md',
      tempDir,
      tempDir,
    );
    const withDotSlash = await resolveAndValidatePath(
      './docs/project/specs/active/plan-2026-01-26-feature.md',
      tempDir,
      tempDir,
    );
    const fromAbsolute = await resolveAndValidatePath(absolutePath, tempDir, tempDir);
    const fromSubdir = await resolveAndValidatePath(
      '../docs/project/specs/active/plan-2026-01-26-feature.md',
      tempDir,
      srcDir,
    );

    // All should produce the exact same relative path
    expect(fromRoot.relativePath).toBe(withDotSlash.relativePath);
    expect(fromRoot.relativePath).toBe(fromAbsolute.relativePath);
    expect(fromRoot.relativePath).toBe(fromSubdir.relativePath);
  });
});
