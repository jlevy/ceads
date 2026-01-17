/* global process, console */
/**
 * Git-based version detection for build and dev scripts.
 *
 * Usage:
 *   node scripts/git-version.mjs          # prints version to stdout
 *   import { getGitVersion } from './scripts/git-version.mjs'  # programmatic
 *
 * Format: X.Y.Z-dev.N.hash
 * - On tag: "1.2.3"
 * - After tag: "1.2.4-dev.12.a1b2c3d" (bumped patch + commits + hash)
 * - Dirty: "1.2.4-dev.12.a1b2c3d-dirty"
 * - No tags: "0.1.0-dev.42.a1b2c3d" (package.json version + total commits + hash)
 */

import { execSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const pkgPath = join(__dirname, '../package.json');
const pkg = JSON.parse(readFileSync(pkgPath, 'utf-8'));

function git(args) {
  return execSync(`git ${args}`, { encoding: 'utf-8', stdio: ['ignore', 'pipe', 'ignore'] }).trim();
}

function isDirty() {
  try {
    git('diff --quiet');
    git('diff --cached --quiet');
    return false;
  } catch {
    return true;
  }
}

export function getGitVersion() {
  // Try tag-based version first
  try {
    const tag = git('describe --tags --abbrev=0');
    const tagVersion = tag.replace(/^v/, '');
    const [major, minor, patch] = tagVersion.split('.').map(Number);
    const commitsSinceTag = parseInt(git(`rev-list ${tag}..HEAD --count`), 10);
    const hash = git('rev-parse --short=7 HEAD');
    const dirty = isDirty();

    if (commitsSinceTag === 0 && !dirty) {
      return tagVersion;
    }

    const bumpedPatch = (patch ?? 0) + 1;
    const suffix = dirty ? `${hash}-dirty` : hash;
    return `${major}.${minor}.${bumpedPatch}-dev.${commitsSinceTag}.${suffix}`;
  } catch {
    // No tags - use package.json version with total commit count
    try {
      const totalCommits = parseInt(git('rev-list --count HEAD'), 10);
      const hash = git('rev-parse --short=7 HEAD');
      const dirty = isDirty();
      const suffix = dirty ? `${hash}-dirty` : hash;
      return `${pkg.version}-dev.${totalCommits}.${suffix}`;
    } catch {
      // Not a git repo
      return pkg.version;
    }
  }
}

// When run directly, print version to stdout
if (process.argv[1] === fileURLToPath(import.meta.url)) {
  console.log(getGitVersion());
}
