---
title: TypeScript Code Coverage
description: Best practices for code coverage in TypeScript with Vitest and v8 provider
author: Joshua Levy (github.com/jlevy) with LLM assistance
---
# Code Coverage Best Practices for TypeScript with Vitest

## Coverage Metrics

### Essential Metrics

- **Statements**: Percentage of statements executed
- **Branches**: Percentage of conditional branches taken
- **Functions**: Percentage of functions called
- **Lines**: Percentage of lines executed

### Recommended Thresholds

| Metric | Starting | Target | Notes |
| --- | --- | --- | --- |
| Statements | 70% | 80-90% | Catch untested code paths |
| Branches | 65% | 75-85% | Critical for TypeScript with union types |
| Functions | 70% | 80-90% | Ensure all exported APIs are tested |
| Lines | 70% | 80-90% | General code execution coverage |

### Why Branch Coverage Matters for TypeScript

Branch coverage is especially important in TypeScript due to:

- Union types (`string | null`)
- Optional chaining (`obj?.prop`)
- Conditional types
- Type guards
- Nullish coalescing (`??`)

Low branch coverage often indicates untested error paths and edge cases.

## Coverage Configuration

### Include/Exclude Patterns

**Always Exclude:**

- Generated files (`**/_generated/**`, `**/*.generated.ts`)
- Type definitions (`**/*.d.ts`)
- Test files themselves (`**/*.test.ts`, `**/__tests__/**`)
- Config files (`**/*.config.ts`, `**/vitest.setup.ts`)
- Build outputs (`**/dist/**`, `**/node_modules/**`)
- Migration files (if not testing migrations)
- Mocks and fixtures (`**/__mocks__/**`, `**/__fixtures__/**`)

**Include:**

- Source code directories (`src/**/*.ts`, `lib/**/*.ts`)
- Exclude test files from coverage calculation

### Reporter Configuration

| Reporter | Purpose |
| --- | --- |
| `text` | Terminal output for CI/quick checks |
| `text-summary` | Brief summary in terminal |
| `html` | Detailed visual reports for local dev |
| `json` | Machine-readable for CI/CD integration |
| `json-summary` | Machine-readable summary for PR annotations |
| `lcov` | Standard format for Codecov/Coveralls |

## Vitest Configuration

### Installation

```bash
pnpm add -D vitest @vitest/coverage-v8
```

### Example Configuration

```typescript
// vitest.config.ts
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    coverage: {
      provider: 'v8',
      reporter: ['text', 'text-summary', 'html', 'json', 'json-summary', 'lcov'],
      reportsDirectory: './coverage',
      exclude: [
        '**/_generated/**',
        '**/*.d.ts',
        '**/*.test.ts',
        '**/*.spec.ts',
        '**/__tests__/**',
        '**/tests/**',
        '**/__mocks__/**',
        '**/*.config.*',
        '**/vitest.setup.ts',
        '**/dist/**',
        '**/node_modules/**',
      ],
      include: ['src/**/*.ts', 'lib/**/*.ts'],
      thresholds: {
        statements: 70,
        branches: 65,
        functions: 70,
        lines: 70,
      },
      perFile: true,
    },
  },
});
```

### Package.json Scripts

```json
{
  "scripts": {
    "test": "vitest run",
    "test:watch": "vitest",
    "test:coverage": "vitest run --coverage",
    "test:coverage:watch": "vitest --coverage",
    "test:coverage:html": "vitest run --coverage && open coverage/index.html"
  }
}
```

## CI/CD Integration

### GitHub Actions Example

```yaml
- name: Run tests with coverage
  run: npm run test:coverage

- name: Upload coverage to Codecov
  uses: codecov/codecov-action@v4
  with:
    files: ./coverage/lcov.info
    fail_ci_if_error: true
```

Vitest automatically fails when thresholds are not met if configured.

## Prioritization Guidelines

### High Priority (Always Cover)

- Public API functions and methods
- Error handling paths
- Business logic and domain rules
- Security-related code
- Data validation

### Medium Priority

- Internal utilities used by multiple modules
- Configuration parsing
- Logging and monitoring code

### Lower Priority

- One-time migration scripts
- Debug utilities (development only)
- Generated code (exclude entirely)

## Common Pitfalls

- **Don’t aim for 100%**: Diminishing returns; 80-90% is usually sufficient
- **Don’t test implementation details**: Focus on public APIs and behavior
- **Don’t ignore branch coverage**: TypeScript’s type system creates many branches
- **Don’t exclude too much**: Be selective about exclusions
