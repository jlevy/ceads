#!/usr/bin/env node
/* global process */

/**
 * Cross-platform script to copy docs for build.
 * Copies tbd-docs.md to src/docs (prebuild) and dist/docs (postbuild).
 */

import { mkdirSync, copyFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, '..');

const phase = process.argv[2] || 'prebuild';

if (phase === 'prebuild') {
  const srcDocs = join(root, 'src', 'docs');
  mkdirSync(srcDocs, { recursive: true });
  copyFileSync(join(root, '..', '..', 'docs', 'tbd-docs.md'), join(srcDocs, 'tbd-docs.md'));
} else if (phase === 'postbuild') {
  const distDocs = join(root, 'dist', 'docs');
  mkdirSync(distDocs, { recursive: true });
  copyFileSync(join(root, 'src', 'docs', 'tbd-docs.md'), join(distDocs, 'tbd-docs.md'));
  copyFileSync(join(root, 'dist', 'bin.mjs'), join(root, 'dist', 'tbd'));
}
