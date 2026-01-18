/**
 * Shared diagnostic output utilities for consistent diagnostic messages
 * across doctor, setup --check, and status commands.
 *
 * See: plan-2026-01-17-cli-output-design-system.md
 */

import { ICONS } from './output.js';

/**
 * Result of a diagnostic check. Used by doctor, setup --check, and status commands
 * to report configuration and health status.
 *
 * @property name - Display name of the check (e.g., "Config file", "Git version")
 * @property status - Check result: ok (pass), warn (non-blocking issue), error (failure)
 * @property message - Optional message with additional context (e.g., version number, count)
 * @property path - Optional file/directory path being checked
 * @property details - Optional list of specific items when issues found (e.g., orphaned deps)
 * @property fixable - Whether the issue can be auto-fixed (shown as [fixable] suffix)
 * @property suggestion - Optional actionable fix suggestion (e.g., "Run: tbd setup claude")
 */
export interface DiagnosticResult {
  name: string;
  status: 'ok' | 'warn' | 'error';
  message?: string;
  path?: string;
  details?: string[];
  fixable?: boolean;
  suggestion?: string;
}

/**
 * Color function type for consistent coloring across the module.
 */
type ColorFn = (text: string) => string;

/**
 * Colors interface matching createColors() return type.
 */
interface Colors {
  success: ColorFn;
  error: ColorFn;
  warn: ColorFn;
  dim: ColorFn;
}

/**
 * Render a single diagnostic result to console.
 *
 * Format examples:
 * - ✓ Config file (.tbd/config.yml)
 * - ⚠ Dependencies - 2 orphaned reference(s) [fixable]
 *     tbd-abc1 -> tbd-xyz9 (missing)
 *     tbd-def2 -> tbd-uvw8 (missing)
 * - ✗ Issue validity - 2 invalid issue(s) (.tbd/issues)
 *     tbd-aaa1: missing required field 'title'
 *     Run: tbd doctor --fix
 *
 * @param result - The diagnostic result to render
 * @param colors - Color functions from createColors()
 */
export function renderDiagnostic(result: DiagnosticResult, colors: Colors): void {
  // Build the main line
  let line = '';

  // Icon based on status
  const icon =
    result.status === 'ok'
      ? colors.success(ICONS.SUCCESS)
      : result.status === 'warn'
        ? colors.warn(ICONS.WARN)
        : colors.error(ICONS.ERROR);

  line += `${icon} ${result.name}`;

  // Message after dash
  if (result.message) {
    line += ` - ${result.message}`;
  }

  // Path in parentheses
  if (result.path) {
    line += ` ${colors.dim(`(${result.path})`)}`;
  }

  // Fixable suffix (only for non-ok)
  if (result.fixable && result.status !== 'ok') {
    line += ` ${colors.dim('[fixable]')}`;
  }

  console.log(line);

  // Details (only for non-ok status)
  if (result.details && result.details.length > 0 && result.status !== 'ok') {
    for (const detail of result.details) {
      console.log(`    ${colors.dim(detail)}`);
    }
  }

  // Suggestion (only for non-ok status)
  if (result.suggestion && result.status !== 'ok') {
    console.log(`    ${colors.dim(result.suggestion)}`);
  }
}

/**
 * Render multiple diagnostic results.
 *
 * @param results - Array of diagnostic results to render
 * @param colors - Color functions from createColors()
 */
export function renderDiagnostics(results: DiagnosticResult[], colors: Colors): void {
  for (const result of results) {
    renderDiagnostic(result, colors);
  }
}
