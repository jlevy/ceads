/**
 * CLI version detection
 *
 * Priority:
 * 1. Build-time injected __TBD_VERSION__ (production builds)
 * 2. TBD_DEV_VERSION env var (dev mode, set by pnpm tbd script)
 * 3. package.json version (fallback)
 *
 * No git dependency at runtime - git version is computed at build time
 * or by the dev script wrapper.
 */

import { createRequire } from 'node:module';

import { VERSION as BUILD_VERSION } from '../../index.js';

/**
 * Get the CLI version.
 */
function getVersion(): string {
  // 1. Build-time injected version (production)
  if (BUILD_VERSION !== 'development') {
    return BUILD_VERSION;
  }

  // 2. Dev mode env var (set by pnpm tbd script)
  if (process.env.TBD_DEV_VERSION) {
    return process.env.TBD_DEV_VERSION;
  }

  // 3. Fallback to package.json version
  const require = createRequire(import.meta.url);
  const pkg = require('../../../package.json') as { version: string };
  return pkg.version;
}

/**
 * CLI version - use this instead of importing VERSION directly from index.ts
 */
export const VERSION = getVersion();
