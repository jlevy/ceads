/**
 * Test utilities for doc infrastructure tests.
 *
 * Provides helpers for creating temp doc directories, populating with fixture
 * docs, and generating mock configs.
 */

import { mkdir, writeFile, cp, rm } from 'node:fs/promises';
import { join, dirname } from 'node:path';
import { tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';

const __dirname = dirname(fileURLToPath(import.meta.url));
const fixturesDir = join(__dirname, '..', 'fixtures', 'test-docs');

const execFileAsync = promisify(execFile);

/**
 * Create a temporary directory with .tbd/docs/ structure.
 * Returns the test root dir (parent of .tbd/).
 */
export async function createTempDocsDir(prefix = 'doc-test'): Promise<string> {
  const testDir = join(
    tmpdir(),
    `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
  );
  await mkdir(join(testDir, '.tbd', 'docs'), { recursive: true });
  return testDir;
}

/**
 * Populate a temp doc directory with fixture docs.
 * Copies from tests/fixtures/test-docs/ into the target .tbd/docs/ structure.
 */
export async function populateTestDocs(
  testDir: string,
  options?: {
    /** Which doc types to include (default: all) */
    types?: ('shortcuts' | 'guidelines' | 'templates' | 'references')[];
    /** Subdirectory under .tbd/docs/ to copy into (default: direct to type dirs) */
    subDir?: string;
  },
): Promise<void> {
  const types = options?.types ?? ['shortcuts', 'guidelines', 'templates', 'references'];
  const baseDir = options?.subDir
    ? join(testDir, '.tbd', 'docs', options.subDir)
    : join(testDir, '.tbd', 'docs');

  for (const type of types) {
    const srcDir = join(fixturesDir, type);
    const destDir = join(baseDir, type);
    await mkdir(destDir, { recursive: true });
    try {
      await cp(srcDir, destDir, { recursive: true });
    } catch {
      // Source may not exist for some types
    }
  }
}

/**
 * Create a mock config object for testing.
 */
export function createMockConfig(overrides?: {
  files?: Record<string, string>;
  lookupPath?: string[];
}): Record<string, unknown> {
  return {
    tbd_format: 'f03',
    tbd_version: '0.1.17',
    display: { id_prefix: 'test' },
    settings: { auto_sync: false, doc_auto_sync_hours: 24 },
    docs_cache: {
      files: overrides?.files ?? {},
      lookup_path: overrides?.lookupPath ?? ['.tbd/docs/sys/shortcuts', '.tbd/docs/tbd/shortcuts'],
    },
  };
}

/**
 * Clean up a temp directory.
 */
export async function cleanupTempDir(testDir: string): Promise<void> {
  await rm(testDir, { recursive: true, force: true });
}

/**
 * Create a local bare git repo for RepoCache testing.
 * Returns the path to the bare repo.
 */
export async function createTestBareRepo(files: Record<string, string>): Promise<string> {
  const repoDir = join(
    tmpdir(),
    `test-repo-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
  );
  await mkdir(repoDir, { recursive: true });

  // Initialize a normal repo, add files, then clone to bare
  const workDir = join(
    tmpdir(),
    `test-repo-work-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
  );
  await mkdir(workDir, { recursive: true });

  await execFileAsync('git', ['init', '-b', 'main', workDir]);
  await execFileAsync('git', ['-C', workDir, 'config', 'user.email', 'test@test.com']);
  await execFileAsync('git', ['-C', workDir, 'config', 'user.name', 'Test']);
  await execFileAsync('git', ['-C', workDir, 'config', 'commit.gpgsign', 'false']);

  // Write files
  for (const [filePath, content] of Object.entries(files)) {
    const fullPath = join(workDir, filePath);
    await mkdir(dirname(fullPath), { recursive: true });
    await writeFile(fullPath, content);
  }

  await execFileAsync('git', ['-C', workDir, 'add', '-A']);
  await execFileAsync('git', ['-C', workDir, 'commit', '-m', 'Initial commit']);

  // Clone to bare
  await execFileAsync('git', ['clone', '--bare', workDir, repoDir]);

  // Clean up work dir
  await rm(workDir, { recursive: true, force: true });

  return repoDir;
}
