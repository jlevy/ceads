/**
 * OutputManager for dual-mode output (text + JSON).
 *
 * See: research-modern-typescript-cli-patterns.md#4-dual-output-mode-text--json
 */

import pc from 'picocolors';

import type { CommandContext, ColorOption } from './context.js';
import { shouldColorize } from './context.js';

/**
 * Color utilities with conditional colorization.
 */
export function createColors(colorOption: ColorOption) {
  const enabled = shouldColorize(colorOption);

  return {
    // Status colors
    success: (s: string) => (enabled ? pc.green(s) : s),
    error: (s: string) => (enabled ? pc.red(s) : s),
    warn: (s: string) => (enabled ? pc.yellow(s) : s),
    info: (s: string) => (enabled ? pc.blue(s) : s),

    // Text formatting
    bold: (s: string) => (enabled ? pc.bold(s) : s),
    dim: (s: string) => (enabled ? pc.dim(s) : s),
    italic: (s: string) => (enabled ? pc.italic(s) : s),
    underline: (s: string) => (enabled ? pc.underline(s) : s),

    // Semantic colors
    id: (s: string) => (enabled ? pc.cyan(s) : s),
    label: (s: string) => (enabled ? pc.magenta(s) : s),
    path: (s: string) => (enabled ? pc.blue(s) : s),
  };
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

    const write = () => {
      process.stderr.write(`\r${this.colors.info(frames[frame]!)} ${currentMessage}`);
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
