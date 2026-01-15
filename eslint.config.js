/**
 * ESLint flat config with type-aware rules.
 *
 * See: research-modern-typescript-monorepo-patterns.md Appendix C
 */

import js from '@eslint/js';
import tseslint from 'typescript-eslint';
import prettier from 'eslint-config-prettier';

// Apply type-checked configs only to TypeScript files
const typedRecommended = tseslint.configs.recommendedTypeChecked.map((cfg) => ({
  ...cfg,
  files: ['**/*.ts', '**/*.tsx'],
  languageOptions: {
    ...(cfg.languageOptions ?? {}),
    parserOptions: {
      ...(cfg.languageOptions?.parserOptions ?? {}),
      projectService: true,
      tsconfigRootDir: import.meta.dirname,
    },
  },
}));

const typedStylistic = tseslint.configs.stylisticTypeChecked.map((cfg) => ({
  ...cfg,
  files: ['**/*.ts', '**/*.tsx'],
  languageOptions: {
    ...(cfg.languageOptions ?? {}),
    parserOptions: {
      ...(cfg.languageOptions?.parserOptions ?? {}),
      projectService: true,
      tsconfigRootDir: import.meta.dirname,
    },
  },
}));

export default [
  // Global ignores
  {
    ignores: [
      '**/dist/**',
      '**/node_modules/**',
      '**/.pnpm-store/**',
      '**/coverage/**',
      '**/attic/**',
      'eslint.config.*',
    ],
  },

  // Base JS rules
  js.configs.recommended,

  // Type-aware TypeScript rules
  ...typedRecommended,
  ...typedStylistic,

  // TypeScript-specific rules
  {
    files: ['**/*.ts', '**/*.tsx'],
    rules: {
      // === Code Style ===
      // Enforce curly braces for all control statements (prevents bugs)
      curly: ['error', 'all'],
      // Consistent brace style: opening on same line, closing on new line
      'brace-style': ['error', '1tbs', { allowSingleLine: false }],

      // === Unused Variables ===
      // Allow underscore prefix for intentionally unused vars/args
      '@typescript-eslint/no-unused-vars': [
        'error',
        {
          argsIgnorePattern: '^_',
          varsIgnorePattern: '^_',
          caughtErrorsIgnorePattern: '^_',
        },
      ],

      // === Promise Safety (Critical for Node.js) ===
      // Catch unhandled promises (common source of silent failures)
      '@typescript-eslint/no-floating-promises': 'error',
      // Prevent passing promises where void is expected
      '@typescript-eslint/no-misused-promises': [
        'error',
        { checksVoidReturn: { attributes: false } },
      ],
      // Catch awaiting non-promise values
      '@typescript-eslint/await-thenable': 'error',
      // Prevent confusing void expressions in unexpected places
      '@typescript-eslint/no-confusing-void-expression': 'error',

      // === Type Import Consistency ===
      // Enforce `import type` for type-only imports (better tree-shaking)
      '@typescript-eslint/consistent-type-imports': [
        'error',
        {
          prefer: 'type-imports',
          fixStyle: 'separate-type-imports',
          disallowTypeAnnotations: true,
        },
      ],
      // Prevent side effects in type-only imports
      '@typescript-eslint/no-import-type-side-effects': 'error',

      // === Restricted Patterns ===
      // Forbid inline import() type expressions (prefer proper imports)
      'no-restricted-syntax': [
        'error',
        {
          selector: 'TSImportType',
          message:
            'Inline import() type expressions are not allowed. Use a proper import statement at the top of the file instead.',
        },
      ],
    },
  },

  // === File-Specific Overrides ===
  // Relax rules for test files where dynamic behavior is expected
  {
    files: ['**/*.test.ts', '**/*.spec.ts', '**/tests/**/*.ts'],
    rules: {
      '@typescript-eslint/no-explicit-any': 'off',
      '@typescript-eslint/no-unsafe-assignment': 'off',
      '@typescript-eslint/no-unsafe-member-access': 'off',
      '@typescript-eslint/no-unsafe-call': 'off',
    },
  },

  // Relax rules for scripts/tooling
  {
    files: ['**/scripts/**/*.ts'],
    rules: {
      '@typescript-eslint/no-explicit-any': 'off',
      'no-console': 'off',
    },
  },

  // Relax rules for CLI command stubs (not yet implemented)
  {
    files: ['**/cli/commands/**/*.ts', '**/cli/lib/**/*.ts'],
    rules: {
      // Commands are stubs with placeholder implementations
      '@typescript-eslint/require-await': 'off',
      '@typescript-eslint/no-unused-vars': [
        'error',
        { argsIgnorePattern: '^_|^options$|^id$|^query$' },
      ],
      // Commander.js action callbacks have loose types
      '@typescript-eslint/no-unsafe-argument': 'off',
      '@typescript-eslint/no-unsafe-assignment': 'off',
      '@typescript-eslint/no-empty-function': 'off',
    },
  },

  // Prettier config must be LAST to override conflicting rules
  prettier,
];
