/* global __dirname */
/**
 * CLI bootstrap entry point (CommonJS).
 *
 * This file MUST be CommonJS so it executes before any ESM module loading.
 * It enables Node's compile cache for faster subsequent runs, then loads the real CLI.
 *
 * Why CJS? ESM static imports are resolved before module code runs, so calling
 * enableCompileCache() in an ESM file is "too late" - the heavy deps are already
 * being parsed. A CJS bootstrap lets us enable caching BEFORE the ESM import.
 */
'use strict';

const path = require('node:path');
const { pathToFileURL } = require('node:url');

// Enable compile cache BEFORE loading any ESM modules.
// This caches compiled bytecode on disk for faster subsequent runs.
// Available in Node 22.8.0+, gracefully ignored in older versions.
try {
  const mod = require('node:module');
  if (typeof mod.enableCompileCache === 'function') {
    mod.enableCompileCache();
  }
} catch {
  // Silently ignore - caching is an optimization, not required.
}

// Load the bundled CLI binary (ESM with all deps bundled for fast startup).
// bin.mjs runs runCli() as a side effect when imported.
const binPath = path.join(__dirname, 'bin.mjs');
import(pathToFileURL(binPath).href);
