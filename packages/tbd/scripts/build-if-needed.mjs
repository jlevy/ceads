#!/usr/bin/env node
/* global process, console */
/**
 * Incremental build script - only builds if sources have changed.
 *
 * Compares mtimes of source files vs dist/bin.mjs to determine if rebuild is needed.
 * This allows pre-push hooks and CI to always call build without unnecessary overhead.
 *
 * Usage: node scripts/build-if-needed.mjs [--force]
 *
 * Exit codes:
 *   0 - Build skipped (already up-to-date) or build succeeded
 *   1 - Build failed
 *
 * WHEN TO USE THIS SCRIPT:
 * - Single-package repos or small monorepos without dedicated task orchestration
 * - Pre-push hooks where you want to skip unnecessary builds
 * - Local development where you want fast feedback
 *
 * WHEN NOT TO USE THIS SCRIPT:
 * - If using Turborepo or Nx: These tools provide superior content-addressed caching,
 *   remote caching for teams, and dependency graph awareness. Remove this script and
 *   use their built-in caching instead (e.g., `turbo build`).
 * - If mtime-based detection causes issues: Git operations (checkout, rebase) can
 *   reset file mtimes, causing false positives or negatives. Turborepo's content
 *   hashing is more reliable.
 *
 * See: docs/general/research/current/research-modern-typescript-monorepo-patterns.md
 */

import { execSync } from 'node:child_process';
import { stat, readdir } from 'node:fs/promises';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const packageDir = dirname(__dirname);

const BUILD_TARGET = join(packageDir, 'dist', 'bin.mjs');
const SOURCE_DIRS = [join(packageDir, 'src')];
const SOURCE_EXTENSIONS = ['.ts', '.tsx', '.mts', '.cts', '.js', '.mjs', '.cjs'];

// Config files that affect build output
const CONFIG_FILES = [
  join(packageDir, 'tsdown.config.ts'),
  join(packageDir, 'tsconfig.json'),
  join(packageDir, 'package.json'),
];

/**
 * Get mtime of a file, or 0 if it doesn't exist.
 */
async function getMtime(filePath) {
  try {
    const stats = await stat(filePath);
    return stats.mtimeMs;
  } catch {
    return 0;
  }
}

/**
 * Recursively get all source files in a directory.
 */
async function getSourceFiles(dir) {
  const files = [];

  async function scan(currentDir) {
    try {
      const entries = await readdir(currentDir, { withFileTypes: true });
      for (const entry of entries) {
        const fullPath = join(currentDir, entry.name);
        if (entry.isDirectory()) {
          await scan(fullPath);
        } else if (entry.isFile() && SOURCE_EXTENSIONS.some((ext) => entry.name.endsWith(ext))) {
          files.push(fullPath);
        }
      }
    } catch {
      // Directory doesn't exist or not readable
    }
  }

  await scan(dir);
  return files;
}

/**
 * Check if build is needed by comparing source mtimes to target mtime.
 */
async function isBuildNeeded() {
  const targetMtime = await getMtime(BUILD_TARGET);

  // If target doesn't exist, build is needed
  if (targetMtime === 0) {
    return { needed: true, reason: 'dist/bin.mjs does not exist' };
  }

  // Check config files
  for (const configFile of CONFIG_FILES) {
    const configMtime = await getMtime(configFile);
    if (configMtime > targetMtime) {
      return { needed: true, reason: `${configFile} is newer than build output` };
    }
  }

  // Check all source files
  for (const dir of SOURCE_DIRS) {
    const sourceFiles = await getSourceFiles(dir);
    for (const sourceFile of sourceFiles) {
      const sourceMtime = await getMtime(sourceFile);
      if (sourceMtime > targetMtime) {
        const relativePath = sourceFile.replace(packageDir + '/', '');
        return { needed: true, reason: `${relativePath} is newer than build output` };
      }
    }
  }

  return { needed: false };
}

async function main() {
  const forceFlag = process.argv.includes('--force');

  if (forceFlag) {
    console.log('Build forced with --force flag');
  } else {
    const { needed, reason } = await isBuildNeeded();

    if (!needed) {
      console.log('Build up-to-date, skipping');
      process.exit(0);
    }

    console.log(`Build needed: ${reason}`);
  }

  console.log('Running build...');
  try {
    execSync('pnpm build', {
      cwd: packageDir,
      stdio: 'inherit',
    });
    console.log('Build completed');
  } catch {
    console.error('Build failed');
    process.exit(1);
  }
}

main();
