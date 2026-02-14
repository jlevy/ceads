#!/usr/bin/env node
/* global process */

/**
 * Cross-platform script to copy and compose docs for build.
 *
 * Source files live in packages/tbd/docs/ (lowercase filenames):
 * - docs/tbd-docs.md, docs/tbd-design.md, etc. - packaged documentation
 * - docs/install/ - header files for composing skill files
 * - docs/shortcuts/ - system and standard shortcuts
 *
 * During build:
 * - prebuild: Copy README.md to package root for npm publishing
 * - postbuild: Copy source docs to dist/docs/ and compose SKILL.md
 *
 * Note: SKILL.md is composed here for `tbd prime --full`. The full skill
 * file with shortcuts is dynamically generated at `tbd setup` time.
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
// Prefix-based layout: sys/ for system shortcuts, tbd/ for standard docs
const DOCS_DIR = join(root, 'docs');
const INSTALL_DIR = join(DOCS_DIR, 'install');
const SYS_SHORTCUTS_DIR = join(DOCS_DIR, 'sys', 'shortcuts');

/**
 * Packaged documentation files (in packages/tbd/docs/).
 */
const PACKAGED_DOCS = ['tbd-docs.md', 'tbd-design.md', 'tbd-closing.md', 'tbd-prime.md'];

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

  // Compose SKILL.md from header + skill-baseline.md (needed by tbd prime --full)
  // Note: The full skill file with shortcuts is dynamically generated at setup time.
  // This is a minimal version without shortcuts for prime --full output.
  const claudeHeader = readFileSync(join(INSTALL_DIR, 'claude-header.md'), 'utf-8');
  const skillContent = readFileSync(join(SYS_SHORTCUTS_DIR, 'skill-baseline.md'), 'utf-8');
  await writeFile(join(distDocs, 'SKILL.md'), claudeHeader + skillContent);

  // Copy skill-brief.md from sys/shortcuts to dist/docs
  // (needed by `tbd skill --brief` command)
  await atomicCopy(join(SYS_SHORTCUTS_DIR, 'skill-brief.md'), join(distDocs, 'skill-brief.md'));

  // Copy README.md to dist/docs
  await atomicCopy(join(root, 'README.md'), join(distDocs, 'README.md'));

  // Copy prefix-based doc directories to dist/docs for bundled CLI
  // These are used by `tbd setup` to copy built-in docs to user's project
  await copyDir(join(DOCS_DIR, 'sys'), join(distDocs, 'sys'));
  await copyDir(join(DOCS_DIR, 'tbd'), join(distDocs, 'tbd'));

  // Copy install directory to dist/docs (headers for composing skill files)
  await copyDir(INSTALL_DIR, join(distDocs, 'install'));

  // Copy bin.mjs to tbd for shebang-based execution (atomic write, preserve execute permission)
  await atomicCopy(join(root, 'dist', 'bin.mjs'), join(root, 'dist', 'tbd'), true);
}
