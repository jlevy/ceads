import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['tests/**/*.test.ts'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'json-summary', 'lcov', 'html'],
      reportsDirectory: 'coverage',
      include: ['src/**/*.ts'],
      exclude: ['src/**/*.d.ts'],
      // Note: test:coverage merges vitest coverage with tryscript CLI coverage
      // using --merge-lcov and --coverage-monocart for accurate line counts.
    },
  },
});
