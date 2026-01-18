#!/usr/bin/env node
/* global process */

/**
 * Cross-platform script to copy docs for build.
 * Copies tbd-docs.md, tbd-design.md, tbd-prime.md, and README.md to src/docs (prebuild) and dist/docs (postbuild).
 */

import { mkdirSync, copyFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, '..');
const repoRoot = join(root, '..', '..');

const phase = process.argv[2] || 'prebuild';

if (phase === 'prebuild') {
  const srcDocs = join(root, 'src', 'docs');
  mkdirSync(srcDocs, { recursive: true });
  copyFileSync(join(repoRoot, 'docs', 'tbd-docs.md'), join(srcDocs, 'tbd-docs.md'));
  copyFileSync(join(repoRoot, 'docs', 'tbd-design.md'), join(srcDocs, 'tbd-design.md'));
  copyFileSync(join(repoRoot, 'docs', 'tbd-prime.md'), join(srcDocs, 'tbd-prime.md'));
  copyFileSync(join(repoRoot, 'README.md'), join(srcDocs, 'README.md'));
} else if (phase === 'postbuild') {
  const distDocs = join(root, 'dist', 'docs');
  mkdirSync(distDocs, { recursive: true });
  copyFileSync(join(root, 'src', 'docs', 'tbd-docs.md'), join(distDocs, 'tbd-docs.md'));
  copyFileSync(join(root, 'src', 'docs', 'tbd-design.md'), join(distDocs, 'tbd-design.md'));
  copyFileSync(join(root, 'src', 'docs', 'tbd-prime.md'), join(distDocs, 'tbd-prime.md'));
  copyFileSync(join(root, 'src', 'docs', 'README.md'), join(distDocs, 'README.md'));
  copyFileSync(join(root, 'dist', 'bin.mjs'), join(root, 'dist', 'tbd'));
}
