/**
 * CLI binary entry point.
 * This file should be minimal - just imports and runs the CLI.
 */

// Handle EPIPE errors gracefully when output is piped to commands like `head`
process.stdout.on('error', (err: NodeJS.ErrnoException) => {
  if (err.code === 'EPIPE') {
    process.exit(0);
  }
  throw err;
});

import { runCli } from './cli.js';

void runCli();
