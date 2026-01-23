#!/usr/bin/env node
/* global process */

/**
 * Cross-platform script to copy and compose docs for build.
 *
 * Source files live in packages/tbd/docs/ (lowercase filenames):
 * - docs/tbd-docs.md, docs/tbd-design.md, etc. - packaged documentation
 * - docs/install/ - header files for composing SKILL.md and CURSOR.mdc
 * - docs/shortcuts/ - system and standard shortcuts
 *
 * During build:
 * - prebuild: Copy README.md to package root for npm publishing
 * - postbuild: Compose and copy all docs to dist/docs/ for bundled CLI
 *
 * Uses atomic writes to prevent partial/corrupted files if process crashes.
 */

import { mkdirSync, readFileSync, readdirSync, statSync, chmodSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { writeFile } from 'atomically';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, '..');
const repoRoot = join(root, '..', '..');

// Source documentation directory (packages/tbd/docs/)
const DOCS_DIR = join(root, 'docs');
const INSTALL_DIR = join(DOCS_DIR, 'install');
const SHORTCUTS_DIR = join(DOCS_DIR, 'shortcuts');
const SHORTCUTS_SYSTEM_DIR = join(SHORTCUTS_DIR, 'system');

/**
 * Packaged documentation files (in packages/tbd/docs/).
 */
const PACKAGED_DOCS = [
  'tbd-docs.md',
  'tbd-design.md',
  'tbd-closing.md',
  'tbd-prime.md',
];

/**
 * Composed documentation files (header + shared content).
 * Format: { header: absolute path to header file, content: absolute path to content file, dest: output filename }
 */
const COMPOSED_FILES = [
  { header: join(INSTALL_DIR, 'claude-header.md'), content: join(SHORTCUTS_SYSTEM_DIR, 'skill.md'), dest: 'SKILL.md' },
  { header: join(INSTALL_DIR, 'cursor-header.md'), content: join(SHORTCUTS_SYSTEM_DIR, 'skill.md'), dest: 'CURSOR.mdc' },
];

/**
 * Atomically copy a file by reading content and writing via atomically library.
 * @param {string} src - Source file path
 * @param {string} dest - Destination file path
 * @param {boolean} preserveMode - If true, preserves source file's mode (permissions)
 */
async function atomicCopy(src, dest, preserveMode = false) {
  const content = readFileSync(src);
  await writeFile(dest, content);
  if (preserveMode) {
    const srcStat = statSync(src);
    chmodSync(dest, srcStat.mode);
  }
}

/**
 * Compose a file from header + content and write atomically.
 * @param {string} headerPath - Path to header file (contains frontmatter + intro)
 * @param {string} contentPath - Path to shared content file
 * @param {string} destPath - Destination file path
 */
async function composeFile(headerPath, contentPath, destPath) {
  const header = readFileSync(headerPath, 'utf-8');
  const content = readFileSync(contentPath, 'utf-8');
  await writeFile(destPath, header + content);
}

/**
 * Recursively copy a directory using atomic writes.
 * @param {string} srcDir - Source directory path
 * @param {string} destDir - Destination directory path
 */
async function copyDir(srcDir, destDir) {
  mkdirSync(destDir, { recursive: true });
  const entries = readdirSync(srcDir, { withFileTypes: true });
  for (const entry of entries) {
    const srcPath = join(srcDir, entry.name);
    const destPath = join(destDir, entry.name);
    if (entry.isDirectory()) {
      await copyDir(srcPath, destPath);
    } else {
      await atomicCopy(srcPath, destPath);
    }
  }
}

const phase = process.argv[2] || 'prebuild';

if (phase === 'prebuild') {
  // Copy README to package root for npm publishing
  await atomicCopy(join(repoRoot, 'README.md'), join(root, 'README.md'));
} else if (phase === 'postbuild') {
  const distDocs = join(root, 'dist', 'docs');
  mkdirSync(distDocs, { recursive: true });

  // Copy packaged docs from docs/ to dist/docs/
  for (const filename of PACKAGED_DOCS) {
    const src = join(DOCS_DIR, filename);
    if (existsSync(src)) {
      await atomicCopy(src, join(distDocs, filename));
    }
  }

  // Compose SKILL.md and CURSOR.mdc directly to dist/docs
  for (const file of COMPOSED_FILES) {
    await composeFile(
      file.header,
      file.content,
      join(distDocs, file.dest),
    );
  }

  // Copy skill-brief.md from shortcuts/system to dist/docs
  // (needed by `tbd skill --brief` command)
  await atomicCopy(join(SHORTCUTS_SYSTEM_DIR, 'skill-brief.md'), join(distDocs, 'skill-brief.md'));

  // Copy README.md to dist/docs
  await atomicCopy(join(root, 'README.md'), join(distDocs, 'README.md'));

  // Copy shortcuts directories to dist/docs for bundled CLI
  // These are used by `tbd setup` to copy built-in docs to user's project
  await copyDir(SHORTCUTS_DIR, join(distDocs, 'shortcuts'));

  // Copy install directory to dist/docs (headers for composing skill files)
  await copyDir(INSTALL_DIR, join(distDocs, 'install'));

  // Copy bin.mjs to tbd for shebang-based execution (atomic write, preserve execute permission)
  await atomicCopy(join(root, 'dist', 'bin.mjs'), join(root, 'dist', 'tbd'), true);
}
