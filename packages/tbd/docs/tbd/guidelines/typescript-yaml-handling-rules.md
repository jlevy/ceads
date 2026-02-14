---
title: TypeScript YAML Handling Rules
description: Best practices for parsing and serializing YAML in TypeScript
author: Joshua Levy (github.com/jlevy) with LLM assistance
globs: "*.ts"
---
# TypeScript YAML Handling Rules

These guidelines ensure consistent, safe, and readable YAML handling across TypeScript
codebases. YAML is deceptively tricky—inconsistent quoting, serialization differences,
and lack of validation cause subtle bugs.

## Use the Right Package

- **Use `yaml` (v2.x)**, not `js-yaml`. The `yaml` package has better TypeScript
  support, more control over output formatting, and proper handling of edge cases.

  ```ts
  // Good
  import { parse, stringify } from 'yaml';
  
  // Avoid
  import yaml from 'js-yaml';
  ```

## Centralize Serialization Options

- **Externalize settings to a central file** instead of scattering `stringify()` calls
  with ad-hoc options throughout the codebase.

  ```ts
  // lib/settings.ts
  export const DEFAULT_YAML_LINE_WIDTH = 88;
  
  // Readable YAML output:
  // - No forced quoting (YAML only quotes when necessary)
  // - Line wrapping at 88 chars for readability
  // - Sorted keys for deterministic diffs
  export const YAML_STRINGIFY_OPTIONS = {
    lineWidth: DEFAULT_YAML_LINE_WIDTH,
    defaultStringType: 'PLAIN',
    defaultKeyType: 'PLAIN',
    sortMapEntries: true,
  } as const;
  ```

- **Use the centralized options** wherever you serialize YAML:

  ```ts
  // serialize.ts
  import { stringify } from 'yaml';
  import { YAML_STRINGIFY_OPTIONS } from '../lib/settings.js';
  
  const yamlStr = stringify(frontmatterObj, YAML_STRINGIFY_OPTIONS);
  ```

- **Optionally create wrapper functions** for additional convenience:

  ```ts
  // utils/yaml-utils.ts
  import { stringify } from 'yaml';
  import { YAML_STRINGIFY_OPTIONS } from '../lib/settings.js';
  
  export function stringifyYaml(data: unknown, options?: object): string {
    return stringify(data, { ...YAML_STRINGIFY_OPTIONS, ...options });
  }
  ```

## Recommended Defaults

These defaults produce clean, readable YAML without unnecessary quoting:

| Option | Value | Rationale |
| --- | --- | --- |
| `lineWidth` | 88 | Line wrapping for readability (matches Black formatter) |
| `defaultStringType` | `'PLAIN'` | No quotes unless necessary (e.g., special chars, colons) |
| `defaultKeyType` | `'PLAIN'` | Unquoted keys: `name:` not `"name":` |
| `sortMapEntries` | `true` | Deterministic output for clean diffs |

The key insight: YAML is designed to be human-readable.
Forcing quotes everywhere (e.g., `"value"` instead of `value`) defeats this purpose.
Use `PLAIN` types to let YAML quote only when semantically required.

## Validate with Zod

- **Always validate parsed YAML** with a Zod schema.
  Raw `parse()` returns `unknown` and provides no guarantees about structure.

  ```ts
  // Good
  import { z } from 'zod';
  import { parse } from 'yaml';
  
  const ConfigSchema = z.object({
    name: z.string(),
    version: z.string(),
  });
  
  const rawData = parse(content);
  const result = ConfigSchema.safeParse(rawData);
  if (!result.success) {
    throw new Error(`Invalid config: ${result.error.message}`);
  }
  const config = result.data; // Typed and validated
  
  // Avoid
  const config = parse(content) as Config; // Type assertion with no runtime validation
  ```

## Handle Merge Conflicts

- **Check for git merge conflict markers** before parsing user-editable files.
  Conflict markers cause cryptic YAML parse errors.

  ```ts
  export function parseYamlWithConflictDetection<T>(content: string, filePath?: string): T {
    if (/^<<<<<<< /m.test(content) || /^=======/m.test(content) || /^>>>>>>> /m.test(content)) {
      throw new MergeConflictError(
        `File contains unresolved git merge conflict markers`,
        filePath
      );
    }
    return parse(content) as T;
  }
  ```

## Common Antipatterns

### Antipattern: Manual String Building

```ts
// Bad: Manual YAML string construction
const yaml = `name: ${name}\nversion: ${version}`;

// Good: Use stringify()
const yaml = stringifyYaml({ name, version });
```

### Antipattern: Inconsistent Quoting

```ts
// Bad: Inconsistent options across codebase
stringify(data1, { lineWidth: 80 });
stringify(data2, { lineWidth: 100, defaultStringType: 'QUOTE_DOUBLE' });
stringify(data3); // No options

// Good: Use centralized wrapper
stringifyYaml(data1);
stringifyYaml(data2);
stringifyYaml(data3);
```

### Antipattern: Unvalidated Parsing

```ts
// Bad: Type assertion without validation
const config = parse(content) as Config;

// Good: Runtime validation
const config = ConfigSchema.parse(parse(content));
```

### Antipattern: Using gray-matter Directly for Serialization

```ts
// Bad: gray-matter.stringify() has limited formatting control
import matter from 'gray-matter';
const output = matter.stringify(body, frontmatter);

// Good: Use gray-matter for parsing, yaml package for serialization
import matter from 'gray-matter';
import { stringifyYaml } from './yaml-utils.js';

const { data, content } = matter(input);
const output = `---\n${stringifyYaml(data)}---\n\n${content}`;
```

## Testing YAML Output

- **Don’t rely on key order in tests** when using `sortMapEntries: true`. Keys are
  sorted alphabetically.

  ```ts
  // Fragile: Depends on key order
  expect(yaml).toMatch(/^---\nname: foo\nversion: 1/);
  
  // Robust: Tests presence, not order
  expect(yaml).toContain('name: foo');
  expect(yaml).toContain('version: 1');
  ```

## Related Guidelines

- For general TypeScript rules, see `tbd guidelines typescript-rules`
- For error handling patterns, see `tbd guidelines error-handling-rules`
