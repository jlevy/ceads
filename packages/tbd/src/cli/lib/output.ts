/**
 * OutputManager for dual-mode output (text + JSON).
 *
 * See: research-modern-typescript-cli-patterns.md#4-dual-output-mode-text--json
 */

import pc from 'picocolors';
import type { Command } from 'commander';
import { marked } from 'marked';
import { markedTerminal } from 'marked-terminal';

import type { CommandContext, ColorOption } from './context.js';
import { shouldColorize } from './context.js';

/**
 * Standard icons for CLI output. Use these constants instead of hardcoded characters.
 *
 * Message icons (prefix messages with these):
 * - SUCCESS_ICON: ✓ for completed operations
 * - ERROR_ICON: ✗ for failures
 * - WARN_ICON: ⚠ for warnings
 * - NOTICE_ICON: • for notices/bullets
 *
 * Status icons (show issue status):
 * - OPEN_ICON: ○ for open issues
 * - IN_PROGRESS_ICON: ◐ for in-progress issues
 * - BLOCKED_ICON: ● for blocked issues
 * - CLOSED_ICON: ✓ for closed issues (same as SUCCESS_ICON)
 */

/**
 * Format a section heading - ALL CAPS for consistent CLI output.
 * Per arch-cli-interface-design-system.md, section headings should be
 * ALL CAPS, bold, followed by blank line before content.
 *
 * @param text - The heading text to format
 * @returns Uppercase heading string
 */
export function formatHeading(text: string): string {
  return text.toUpperCase();
}

export const ICONS = {
  // Message icons
  SUCCESS: '✓', // U+2713
  ERROR: '✗', // U+2717
  WARN: '⚠', // U+26A0
  NOTICE: '•', // U+2022

  // Status icons
  OPEN: '○', // U+25CB
  IN_PROGRESS: '◐', // U+25D0
  BLOCKED: '●', // U+25CF
  CLOSED: '✓', // U+2713 (same as SUCCESS)
  DEFERRED: '○', // U+25CB (same as OPEN)
} as const;

/**
 * Pre-parse argv to determine color setting before Commander parses options.
 * This is needed because help output happens before full option parsing.
 */
export function getColorOptionFromArgv(): ColorOption {
  const colorArg = process.argv.find((arg) => arg.startsWith('--color='));
  if (colorArg) {
    const value = colorArg.split('=')[1];
    if (value === 'always' || value === 'never' || value === 'auto') {
      return value;
    }
  }
  // Check for --color followed by value
  const colorIdx = process.argv.indexOf('--color');
  if (colorIdx !== -1 && process.argv[colorIdx + 1]) {
    const value = process.argv[colorIdx + 1];
    if (value === 'always' || value === 'never' || value === 'auto') {
      return value;
    }
  }
  return 'auto';
}

/**
 * Maximum width for help text and formatted output. We cap at 88 characters
 * for readability, but use narrower if the terminal is smaller.
 */
export const MAX_HELP_WIDTH = 88;

/**
 * Get terminal width capped at MAX_HELP_WIDTH.
 * Use this for all formatted CLI output to ensure consistent width handling.
 */
export function getTerminalWidth(): number {
  return Math.min(MAX_HELP_WIDTH, process.stdout.columns ?? 80);
}

/**
 * Create colored help configuration for Commander.js.
 * Uses Commander's built-in configureHelp() style functions (requires v14+).
 *
 * @param colorOption - Color option to determine if colors should be enabled
 * @returns Help configuration object for program.configureHelp()
 */
export function createColoredHelpConfig(colorOption: ColorOption = 'auto') {
  const colors = pc.createColors(shouldColorize(colorOption));

  return {
    helpWidth: getTerminalWidth(),
    styleTitle: (str: string) => colors.bold(colors.cyan(str)),
    styleCommandText: (str: string) => colors.green(str),
    styleOptionText: (str: string) => colors.yellow(str),
    showGlobalOptions: true,
  };
}

/**
 * Create the help epilog text with color.
 * Includes "Getting Started" section per spec.
 *
 * @param colorOption - Color option to determine if colors should be enabled
 * @returns Colored epilog string
 */
export function createHelpEpilog(colorOption: ColorOption = 'auto'): string {
  const colors = pc.createColors(shouldColorize(colorOption));
  const lines = [
    colors.bold('Getting Started:'),
    `  ${colors.green('npm install -g tbd-git@latest && tbd setup --auto --prefix=<name>')}`,
    '',
    '  This initializes tbd and configures your coding agents automatically.',
    `  For interactive setup: ${colors.dim('tbd setup --interactive')}`,
    `  For manual control: ${colors.dim('tbd init --help')}`,
    '',
    colors.bold('Orientation:'),
    `  For workflow guidance, run: ${colors.green('tbd prime')}`,
    '',
    colors.blue('For more on tbd, see: https://github.com/jlevy/tbd'),
  ];
  return lines.join('\n');
}

/**
 * Configure Commander.js with colored help text.
 * Call this on the program before adding commands.
 */
export function configureColoredHelp(program: Command): Command {
  const colorOption = getColorOptionFromArgv();
  return program.configureHelp(createColoredHelpConfig(colorOption));
}

/**
 * Color utilities with conditional colorization.
 *
 * Uses picocolors' createColors() for manual color support control,
 * which is the recommended approach per picocolors documentation.
 * This allows --color=always to work even when stdout is not a TTY.
 */
export function createColors(colorOption: ColorOption) {
  const enabled = shouldColorize(colorOption);

  // Use picocolors' createColors() for proper manual control
  // This overrides picocolors' automatic TTY detection
  const colors = pc.createColors(enabled);

  return {
    // Status colors
    success: colors.green,
    error: colors.red,
    warn: colors.yellow,
    info: colors.blue,

    // Text formatting
    bold: colors.bold,
    dim: colors.dim,
    italic: colors.italic,
    underline: colors.underline,

    // Semantic colors
    id: colors.cyan,
    label: colors.magenta,
    path: colors.blue,
  };
}

/**
 * Render Markdown to colorized terminal output.
 *
 * Uses marked-terminal for colorized output when colors are enabled,
 * falls back to plain Markdown when colors are disabled or piped.
 * Respects the --color option and TTY detection.
 *
 * @param content - Markdown string to render
 * @param colorOption - Color option to determine if colors should be enabled
 * @returns Rendered string (colorized or plain)
 */
export function renderMarkdown(content: string, colorOption: ColorOption = 'auto'): string {
  const useColors = shouldColorize(colorOption);

  if (!useColors) {
    // Return plain markdown when colors are disabled
    return content;
  }

  // Configure marked with terminal renderer for this parse
  // Note: @types/marked-terminal is outdated; markedTerminal returns MarkedExtension in v7+
  // but types still claim it returns TerminalRenderer. Cast to work around this.
  marked.use(
    markedTerminal({
      width: getTerminalWidth(),
      reflowText: true,
    }) as unknown as Parameters<typeof marked.use>[0],
  );

  // marked.parse returns string with sync renderer
  return marked.parse(content) as string;
}

/**
 * Spinner interface for progress indication.
 */
export interface Spinner {
  message(msg: string): void;
  stop(msg?: string): void;
}

/**
 * No-op spinner for non-TTY or quiet mode.
 */
const noopSpinner: Spinner = {
  message: () => {},
  stop: () => {},
};

/**
 * OutputManager handles all CLI output with format switching.
 */
export class OutputManager {
  private ctx: CommandContext;
  private colors: ReturnType<typeof createColors>;

  constructor(ctx: CommandContext) {
    this.ctx = ctx;
    this.colors = createColors(ctx.color);
  }

  /**
   * Output structured data - always goes to stdout.
   * In JSON mode, outputs JSON. In text mode, calls the formatter.
   */
  data<T>(data: T, textFormatter?: (data: T) => void): void {
    if (this.ctx.json) {
      console.log(JSON.stringify(data, null, 2));
    } else if (textFormatter) {
      textFormatter(data);
    }
  }

  /**
   * Output success message - text mode only, stdout.
   * Suppressed by --quiet and --json.
   */
  success(message: string): void {
    if (!this.ctx.json && !this.ctx.quiet) {
      console.log(this.colors.success(`${ICONS.SUCCESS} ${message}`));
    }
  }

  /**
   * Output notice message - noteworthy events during normal operation.
   * Blue bullet, shown at default level. Suppressed by --quiet and --json.
   */
  notice(message: string): void {
    if (!this.ctx.json && !this.ctx.quiet) {
      console.log(this.colors.info(`${ICONS.NOTICE} ${message}`));
    }
  }

  /**
   * Output info message - operational progress.
   * Requires --verbose or --debug. Suppressed by --json.
   */
  info(message: string): void {
    if (!this.ctx.json && (this.ctx.verbose || this.ctx.debug)) {
      console.error(this.colors.dim(message));
    }
  }

  /**
   * Output warning - issues that didn't stop operation.
   * Yellow warning icon, stderr. Suppressed by --quiet.
   */
  warn(message: string): void {
    if (this.ctx.json) {
      console.error(JSON.stringify({ warning: message }));
    } else if (!this.ctx.quiet) {
      console.error(this.colors.warn(`${ICONS.WARN} ${message}`));
    }
  }

  /**
   * Output error - failures that stop operation.
   * Red X icon, always shown (even in --quiet), stderr.
   */
  error(message: string, err?: Error): void {
    if (this.ctx.json) {
      console.error(JSON.stringify({ error: message, details: err?.message }));
    } else {
      console.error(this.colors.error(`${ICONS.ERROR} ${message}`));
      if (this.ctx.verbose && err?.stack) {
        console.error(this.colors.dim(err.stack));
      }
    }
  }

  /**
   * Output command being executed - shows external commands.
   * Requires --verbose or --debug. Suppressed by --json.
   */
  command(cmd: string, args?: string[]): void {
    if (!this.ctx.json && (this.ctx.verbose || this.ctx.debug)) {
      const fullCmd = args ? `${cmd} ${args.join(' ')}` : cmd;
      console.error(this.colors.dim(`> ${fullCmd}`));
    }
  }

  /**
   * Output debug message - internal state for troubleshooting.
   * Requires --debug only (not --verbose). Suppressed by --json.
   */
  debug(message: string): void {
    if (this.ctx.debug && !this.ctx.json) {
      console.error(this.colors.dim(`[debug] ${message}`));
    }
  }

  /**
   * Output dry-run indication.
   */
  dryRun(message: string, details?: object): void {
    if (this.ctx.json) {
      console.log(JSON.stringify({ dryRun: true, action: message, ...details }));
    } else {
      console.log(this.colors.warn(`[DRY-RUN] ${message}`));
      if (details && (this.ctx.verbose || this.ctx.debug)) {
        console.log(this.colors.dim(JSON.stringify(details, null, 2)));
      }
    }
  }

  /**
   * Output a table with headers and rows.
   * Headers are dimmed. Rows are formatted with consistent column widths.
   * Suppressed in JSON mode.
   *
   * @param headers - Array of column headers with widths
   * @param rows - Array of row data arrays (each row = array of strings)
   */
  table(
    headers: { label: string; width: number }[],
    rows: (string | { value: string; color?: (s: string) => string })[][],
  ): void {
    if (this.ctx.json) return;

    // Output header row
    const headerLine = headers.map((h) => h.label.padEnd(h.width)).join('');
    console.log(this.colors.dim(headerLine));

    // Output data rows
    for (const row of rows) {
      const cells = row.map((cell, i) => {
        const width = headers[i]?.width ?? 0;
        if (typeof cell === 'string') {
          return cell.padEnd(width);
        }
        // Cell with custom color
        const paddedValue = cell.value.padEnd(width);
        return cell.color ? cell.color(paddedValue) : paddedValue;
      });
      console.log(cells.join(''));
    }
  }

  /**
   * Output a bulleted list.
   * Uses NOTICE icon (•) as bullet. Suppressed in JSON mode.
   *
   * @param items - Array of items to list
   * @param options - Optional indent level (default 0)
   */
  list(items: string[], options?: { indent?: number }): void {
    if (this.ctx.json) return;

    const indent = '  '.repeat(options?.indent ?? 0);
    for (const item of items) {
      console.log(`${indent}${ICONS.NOTICE} ${item}`);
    }
  }

  /**
   * Output a count summary in standard format.
   * Format: "N item(s)" with dim color. Suppressed in JSON mode.
   *
   * @param count - The count to display
   * @param singular - Singular form of the item (e.g., "issue")
   * @param plural - Optional plural form (defaults to singular + "s")
   */
  count(count: number, singular: string, plural?: string): void {
    if (this.ctx.json) return;

    const pluralForm = plural ?? `${singular}s`;
    const label = count === 1 ? singular : pluralForm;
    console.log(this.colors.dim(`${count} ${label}`));
  }

  /**
   * Create a spinner for progress indication.
   * Returns no-op in JSON/quiet mode or non-TTY.
   */
  spinner(message: string): Spinner {
    // Never show spinners in JSON mode, quiet mode, or non-TTY
    if (this.ctx.json || this.ctx.quiet || !process.stderr.isTTY) {
      return noopSpinner;
    }

    // Simple inline spinner (no external dependency for now)
    let frame = 0;
    const frames = ['⠋', '⠙', '⠹', '⠸', '⠼', '⠴', '⠦', '⠧', '⠇', '⠏'];
    let currentMessage = message;

    const spinnerColor = this.colors.info;
    const write = () => {
      process.stderr.write(`\r${spinnerColor(frames[frame] ?? '⠋')} ${currentMessage}`);
      frame = (frame + 1) % frames.length;
    };

    write();
    const interval = setInterval(write, 80);

    return {
      message: (msg: string) => {
        currentMessage = msg;
      },
      stop: (msg?: string) => {
        clearInterval(interval);
        process.stderr.write('\r' + ' '.repeat(currentMessage.length + 3) + '\r');
        if (msg) {
          console.error(msg);
        }
      },
    };
  }

  /**
   * Get colors instance for direct use.
   */
  getColors() {
    return this.colors;
  }

  /**
   * Check if quiet mode is enabled.
   */
  isQuiet(): boolean {
    return this.ctx.quiet;
  }
}
