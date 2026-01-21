#!/usr/bin/env node
/* global process */

/**
 * Cross-platform script to copy docs for build.
 * Copies documentation files to src/docs (prebuild) and dist/docs (postbuild).
 * Uses atomic writes to prevent partial/corrupted files if process crashes.
 */

import { mkdirSync, readFileSync, statSync, chmodSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { writeFile } from 'atomically';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, '..');
const repoRoot = join(root, '..', '..');

/**
 * Documentation files to copy during build.
 * Format: { src: path relative to repoRoot, dest: filename }
 */
const DOCS_FILES = [
  { src: 'docs/tbd-docs.md', dest: 'tbd-docs.md' },
  { src: 'docs/tbd-design.md', dest: 'tbd-design.md' },
  { src: 'docs/tbd-closing.md', dest: 'tbd-closing.md' },
  { src: 'docs/SKILL.md', dest: 'SKILL.md' },
  { src: 'docs/skill-brief.md', dest: 'skill-brief.md' },
  { src: 'docs/CURSOR.mdc', dest: 'CURSOR.mdc' },
  { src: 'README.md', dest: 'README.md' },
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

const phase = process.argv[2] || 'prebuild';

if (phase === 'prebuild') {
  const srcDocs = join(root, 'src', 'docs');
  mkdirSync(srcDocs, { recursive: true });

  // Copy docs to src/docs for TypeScript compilation (atomic writes)
  for (const file of DOCS_FILES) {
    await atomicCopy(join(repoRoot, file.src), join(srcDocs, file.dest));
  }

  // Copy README to package root for npm publishing (atomic write)
  await atomicCopy(join(repoRoot, 'README.md'), join(root, 'README.md'));
} else if (phase === 'postbuild') {
  const srcDocs = join(root, 'src', 'docs');
  const distDocs = join(root, 'dist', 'docs');
  mkdirSync(distDocs, { recursive: true });

  // Copy docs from src/docs to dist/docs for bundled CLI (atomic writes)
  for (const file of DOCS_FILES) {
    await atomicCopy(join(srcDocs, file.dest), join(distDocs, file.dest));
  }

  // Copy bin.mjs to tbd for shebang-based execution (atomic write, preserve execute permission)
  await atomicCopy(join(root, 'dist', 'bin.mjs'), join(root, 'dist', 'tbd'), true);
}
