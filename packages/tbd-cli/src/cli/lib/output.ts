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
 * Maximum width for help text. We cap at 88 characters for readability,
 * but use narrower if the terminal is smaller.
 */
export const MAX_HELP_WIDTH = 88;

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
    helpWidth: Math.min(MAX_HELP_WIDTH, process.stdout.columns || 80),
    styleTitle: (str: string) => colors.bold(colors.cyan(str)),
    styleCommandText: (str: string) => colors.green(str),
    styleOptionText: (str: string) => colors.yellow(str),
    showGlobalOptions: true,
  };
}

/**
 * Create the help epilog text with color.
 *
 * @param colorOption - Color option to determine if colors should be enabled
 * @returns Colored epilog string
 */
export function createHelpEpilog(colorOption: ColorOption = 'auto'): string {
  const colors = pc.createColors(shouldColorize(colorOption));
  return colors.blue('For more on tbd, see: https://github.com/jlevy/tbd');
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
      width: Math.min(MAX_HELP_WIDTH, process.stdout.columns || 80),
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
   */
  success(message: string): void {
    if (!this.ctx.json && !this.ctx.quiet) {
      console.log(this.colors.success(`✓ ${message}`));
    }
  }

  /**
   * Output info message - text mode only, stdout.
   */
  info(message: string): void {
    if (!this.ctx.json && !this.ctx.quiet) {
      console.log(this.colors.info(message));
    }
  }

  /**
   * Output warning - always stderr, always shown.
   */
  warn(message: string): void {
    if (this.ctx.json) {
      console.error(JSON.stringify({ warning: message }));
    } else {
      console.error(this.colors.warn(`⚠ ${message}`));
    }
  }

  /**
   * Output error - always stderr, always shown.
   */
  error(message: string, err?: Error): void {
    if (this.ctx.json) {
      console.error(JSON.stringify({ error: message, details: err?.message }));
    } else {
      console.error(this.colors.error(`✗ ${message}`));
      if (this.ctx.verbose && err?.stack) {
        console.error(this.colors.dim(err.stack));
      }
    }
  }

  /**
   * Output verbose/debug message - only in verbose mode, stderr.
   */
  debug(message: string): void {
    if (this.ctx.verbose && !this.ctx.json) {
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
      if (details && this.ctx.verbose) {
        console.log(this.colors.dim(JSON.stringify(details, null, 2)));
      }
    }
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
}
