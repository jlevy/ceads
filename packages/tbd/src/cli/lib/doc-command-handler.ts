/**
 * Shared base class for document listing/lookup commands.
 *
 * Used by shortcuts, guidelines, and templates commands to provide
 * consistent behavior for --list, fuzzy search, and exact match.
 */

import type { Command } from 'commander';
import pc from 'picocolors';

import { BaseCommand } from './base-command.js';
import { GUIDELINES_AGENT_HEADER } from './doc-prompts.js';
import { requireInit } from './errors.js';
import { DocCache, SCORE_PREFIX_MATCH } from '../../file/doc-cache.js';
import { addDoc, type DocType } from '../../file/doc-add.js';
import { truncate } from '../../lib/truncate.js';
import { formatDocSize } from '../../lib/format-utils.js';
import { getTerminalWidth } from './output.js';

/**
 * Configuration for a doc command handler.
 */
export interface DocCommandConfig {
  /** Display name for the doc type (e.g., "shortcut", "guideline", "template") */
  typeName: string;
  /** Plural display name (e.g., "shortcuts", "guidelines", "templates") */
  typeNamePlural: string;
  /** Paths to search for documents (relative to tbd root) */
  paths: string[];
  /** Names to exclude from listings (e.g., system docs) */
  excludeFromList?: string[];
  /** Content to show when no query is provided (optional) */
  noQueryDocName?: string;
  /** The doc type for --add operations */
  docType: DocType;
}

/**
 * Common options for doc commands.
 */
export interface DocCommandOptions {
  list?: boolean;
  all?: boolean;
  refresh?: boolean;
  quiet?: boolean;
  add?: string;
  name?: string;
}

/**
 * Base handler for document commands (shortcuts, guidelines, templates).
 *
 * Provides shared functionality for:
 * - Listing documents with --list
 * - Exact name lookup
 * - Fuzzy search
 * - Wrapped description output
 */
export abstract class DocCommandHandler extends BaseCommand {
  protected cache: DocCache | null = null;
  protected tbdRoot = '';

  constructor(
    command: Command,
    protected readonly config: DocCommandConfig,
  ) {
    super(command);
  }

  /**
   * Initialize the doc cache. Must be called before other operations.
   */
  protected async initCache(): Promise<void> {
    this.tbdRoot = await requireInit();
    this.cache = new DocCache(this.config.paths, this.tbdRoot);
    await this.cache.load({ quiet: this.ctx.quiet });
  }

  /**
   * Handle --list mode: show all available documents.
   */
  protected async handleList(includeAll?: boolean): Promise<void> {
    if (!this.cache) throw new Error('Cache not initialized');

    const docs = this.cache.list(includeAll);

    if (this.ctx.json) {
      this.output.data(
        docs.map((d) => ({
          name: d.name,
          title: d.frontmatter?.title,
          description: d.frontmatter?.description,
          path: d.path,
          sourceDir: d.sourceDir,
          sizeBytes: d.sizeBytes,
          approxTokens: d.approxTokens,
          shadowed: this.cache!.isShadowed(d),
        })),
      );
      return;
    }

    if (docs.length === 0) {
      console.log(`No ${this.config.typeNamePlural} found.`);
      console.log(`Run \`tbd setup --auto\` to install built-in ${this.config.typeNamePlural}.`);
      return;
    }

    const maxWidth = getTerminalWidth();

    for (const doc of docs) {
      const shadowed = this.cache.isShadowed(doc);
      const name = doc.name;
      const title = doc.frontmatter?.title;
      const description = doc.frontmatter?.description ?? this.extractFallbackText(doc.content);

      if (shadowed) {
        // Muted style for shadowed entries
        const line = `${name} (${doc.sourceDir}) [shadowed]`;
        console.log(pc.dim(truncate(line, maxWidth)));
      } else {
        // Line 1: name (bold) + size/token info (dimmed)
        const sizeInfo = formatDocSize(doc.sizeBytes, doc.approxTokens);
        console.log(`${pc.bold(name)} ${pc.dim(sizeInfo)}`);

        // Line 2+: Indented "Title: Description"
        const hasFrontmatter = title ?? doc.frontmatter?.description;
        const content =
          title && description ? `${title}: ${description}` : (title ?? description ?? '');
        if (content) {
          this.printWrappedDescription(content, maxWidth, !hasFrontmatter);
        }
      }
    }
  }

  /**
   * Handle no query: show explanation + help.
   */
  protected async handleNoQuery(): Promise<void> {
    if (!this.cache) throw new Error('Cache not initialized');

    // Try to find the explanation doc if configured
    if (this.config.noQueryDocName) {
      const explanation = this.cache.get(this.config.noQueryDocName);
      if (explanation) {
        console.log(explanation.doc.content);
        return;
      }
    }

    // Fallback explanation
    const { typeName, typeNamePlural } = this.config;
    console.log(`tbd ${typeNamePlural} - Find and output ${typeNamePlural}`);
    console.log('');
    console.log('Usage:');
    console.log(`  tbd ${typeNamePlural} <name>           Find ${typeName} by exact name`);
    console.log(`  tbd ${typeNamePlural} <description>    Find ${typeName} by fuzzy match`);
    console.log(`  tbd ${typeNamePlural} --list           List all available ${typeNamePlural}`);
    console.log(`  tbd ${typeNamePlural} --list --all     Include shadowed ${typeNamePlural}`);
    console.log('');
    console.log(
      `No ${typeNamePlural} found. Run \`tbd setup --auto\` to install built-in ${typeNamePlural}.`,
    );
  }

  /**
   * Get the agent instruction header for the doc type.
   * Returns undefined if no header should be shown.
   */
  protected getAgentHeader(): string | undefined {
    if (this.config.typeName === 'guideline') {
      return GUIDELINES_AGENT_HEADER;
    }
    // Templates and other types don't need a header
    return undefined;
  }

  /**
   * Handle query: exact match first, then fuzzy.
   */
  protected async handleQuery(query: string): Promise<void> {
    if (!this.cache) throw new Error('Cache not initialized');

    // Try exact match first
    const exactMatch = this.cache.get(query);
    if (exactMatch) {
      if (this.ctx.json) {
        this.output.data({
          name: exactMatch.doc.name,
          title: exactMatch.doc.frontmatter?.title,
          score: exactMatch.score,
          content: exactMatch.doc.content,
        });
      } else {
        const header = this.getAgentHeader();
        if (header) {
          console.log(header + '\n');
        }
        console.log(exactMatch.doc.content);
      }
      return;
    }

    // Fuzzy match
    const matches = this.cache.search(query, 5);
    if (matches.length === 0) {
      console.log(`No ${this.config.typeName} found matching: ${query}`);
      console.log(
        `Run \`tbd ${this.config.typeNamePlural} --list\` to see available ${this.config.typeNamePlural}.`,
      );
      return;
    }

    const best = matches[0]!;
    // Use PREFIX_MATCH (0.9) as threshold for high confidence
    if (best.score < SCORE_PREFIX_MATCH) {
      // Low confidence - show suggestions instead
      console.log(`No exact match for "${query}". Did you mean:`);
      for (const m of matches) {
        const name = m.doc.frontmatter?.title ?? m.doc.name;
        console.log(`  ${name} ${pc.dim(`(score: ${m.score.toFixed(2)})`)}`);
      }
      return;
    }

    // Good fuzzy match - output it
    if (this.ctx.json) {
      this.output.data({
        name: best.doc.name,
        title: best.doc.frontmatter?.title,
        score: best.score,
        content: best.doc.content,
      });
    } else {
      const header = this.getAgentHeader();
      if (header) {
        console.log(header + '\n');
      }
      console.log(best.doc.content);
    }
  }

  /**
   * Handle --add mode: add an external document by URL.
   */
  protected async handleAdd(url: string, name: string): Promise<void> {
    if (!this.tbdRoot) {
      this.tbdRoot = await requireInit();
    }

    const { typeName, docType } = this.config;

    console.log(`Adding ${typeName}: ${name}`);
    console.log(`  URL: ${url}`);

    const result = await addDoc(this.tbdRoot, { url, name, docType });

    if (result.usedGhCli) {
      console.log(pc.dim('  (fetched via gh CLI due to direct access restriction)'));
    }

    console.log(pc.green(`  Added to ${result.destPath}`));
    console.log(pc.green(`  Config updated with source: ${result.rawUrl}`));
    console.log('');
    console.log(`Run \`tbd ${this.config.typeNamePlural} --list\` to verify.`);
  }

  /**
   * Extract fallback text from content when no frontmatter description exists.
   */
  protected extractFallbackText(content: string): string | undefined {
    // Strip YAML frontmatter if present
    let text = content;
    if (text.startsWith('---')) {
      const endIndex = text.indexOf('---', 3);
      if (endIndex !== -1) {
        text = text.slice(endIndex + 3);
      }
    }

    // Strip markdown headers (# Title -> Title)
    text = text.replace(/^#+\s*/gm, '');
    // Strip bold/italic markers
    text = text.replace(/\*\*|__|\*|_/g, '');
    // Strip code blocks
    text = text.replace(/```[\s\S]*?```/g, '');
    // Strip inline code
    text = text.replace(/`[^`]+`/g, '');
    // Strip blockquotes
    text = text.replace(/^>\s*/gm, '');

    // Condense all whitespace to single spaces and trim
    text = text.replace(/\s+/g, ' ').trim();

    // Return first chunk of text (up to ~200 chars for reasonable fallback)
    if (text.length === 0) return undefined;
    return text.slice(0, 200);
  }

  /**
   * Print description indented, wrapped across lines.
   */
  protected printWrappedDescription(text: string, maxWidth: number, shouldTruncate: boolean): void {
    const indent = '   ';
    const availableWidth = maxWidth - indent.length;

    if (text.length <= availableWidth) {
      console.log(`${indent}${text}`);
      return;
    }

    if (shouldTruncate) {
      // Truncate to two lines max (for fallback body text)
      const firstLine = this.wrapAtWord(text, availableWidth);
      const remainder = text.slice(firstLine.length).trimStart();
      console.log(`${indent}${firstLine}`);
      if (remainder) {
        console.log(`${indent}${truncate(remainder, availableWidth)}`);
      }
    } else {
      // Wrap all lines without truncation (for title/description)
      let remaining = text;
      while (remaining.length > 0) {
        if (remaining.length <= availableWidth) {
          console.log(`${indent}${remaining}`);
          break;
        }
        const line = this.wrapAtWord(remaining, availableWidth);
        console.log(`${indent}${line}`);
        remaining = remaining.slice(line.length).trimStart();
      }
    }
  }

  /**
   * Wrap text at word boundary to fit within maxWidth.
   */
  protected wrapAtWord(text: string, maxWidth: number): string {
    if (text.length <= maxWidth) return text;
    const lastSpace = text.lastIndexOf(' ', maxWidth);
    if (lastSpace > 0) {
      return text.slice(0, lastSpace);
    }
    return text.slice(0, maxWidth);
  }
}
