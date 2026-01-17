import { defineConfig } from 'tsdown';

// Import git version detection from shared script (not distributed with package)
import { getGitVersion } from './scripts/git-version.mjs';

const version = getGitVersion();

// Common options for ESM-only build
const commonOptions = {
  format: ['esm'] as 'esm'[],
  platform: 'node' as const,
  target: 'node20' as const,
  sourcemap: true,
  dts: true,
  define: {
    __TBD_VERSION__: JSON.stringify(version),
  },
};

export default defineConfig([
  // Library entry points
  {
    ...commonOptions,
    entry: {
      index: 'src/index.ts',
      cli: 'src/cli/cli.ts',
    },
    clean: true,
  },
  // CLI binary - ESM entry (used by bootstrap)
  {
    ...commonOptions,
    entry: { bin: 'src/cli/bin.ts' },
    banner: '#!/usr/bin/env node',
    clean: false,
  },
  // CLI bootstrap - CJS entry that enables compile cache before loading ESM
  {
    format: ['cjs'] as 'cjs'[],
    platform: 'node' as const,
    target: 'node20' as const,
    sourcemap: true,
    dts: false,
    entry: { 'bin-bootstrap': 'src/cli/bin-bootstrap.cjs' },
    banner: '#!/usr/bin/env node',
    clean: false,
  },
]);
