/**
 * Global settings and configuration constants.
 *
 * Centralized location for project-wide defaults that may need tuning.
 * These are compile-time constants, not runtime configuration.
 */

import type { DocumentOptions, SchemaOptions, ToStringOptions } from 'yaml';

// =============================================================================
// YAML Formatting
// =============================================================================

/**
 * Default line width for YAML serialization.
 * 88 characters is a good balance between readability and avoiding excessive wrapping.
 * (Matches Python's Black formatter default.)
 */
export const YAML_LINE_WIDTH = 88;

/**
 * Default string type for YAML serialization.
 * 'PLAIN' means no forced quoting - YAML only quotes when necessary.
 */
export const YAML_DEFAULT_STRING_TYPE = 'PLAIN' as const;

/**
 * Default key type for YAML serialization.
 * 'PLAIN' means object keys are unquoted unless required.
 */
export const YAML_DEFAULT_KEY_TYPE = 'PLAIN' as const;

/**
 * Combined options type for YAML stringify.
 */
export type YamlStringifyOptions = DocumentOptions & SchemaOptions & ToStringOptions;

/**
 * Default YAML serialization options for readable output.
 *
 * Design principles:
 * - No forced quoting: YAML only quotes when necessary for special characters
 * - Reasonable line wrapping: 88 chars prevents overly long lines
 * - Plain keys: No unnecessary quotes around object keys
 * - Sorted keys: Deterministic output for diffs and version control
 */
export const YAML_STRINGIFY_OPTIONS: YamlStringifyOptions = {
  lineWidth: YAML_LINE_WIDTH,
  defaultStringType: YAML_DEFAULT_STRING_TYPE,
  defaultKeyType: YAML_DEFAULT_KEY_TYPE,
  sortMapEntries: true,
};

/**
 * YAML serialization options for compact output (e.g., frontmatter).
 * Uses lineWidth: 0 to prevent wrapping within values.
 */
export const YAML_STRINGIFY_OPTIONS_COMPACT: YamlStringifyOptions = {
  lineWidth: 0, // No wrapping
  defaultStringType: YAML_DEFAULT_STRING_TYPE,
  defaultKeyType: YAML_DEFAULT_KEY_TYPE,
  sortMapEntries: true,
};

// =============================================================================
// Text Formatting
// =============================================================================

/**
 * Default line width for text output (terminal, markdown).
 * Same as YAML for consistency.
 */
export const TEXT_LINE_WIDTH = 88;
