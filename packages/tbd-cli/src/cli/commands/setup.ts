/**
 * `tbd setup` - Configure tbd integration with editors and tools.
 *
 * Subcommands:
 * - `tbd setup claude` - Configure Claude Code hooks
 * - `tbd setup cursor` - Create Cursor IDE rules file
 * - `tbd setup codex` - Create/update AGENTS.md for Codex
 *
 * See: tbd-design-v3.md §6.4.2 Claude Code Integration
 */

import { Command } from 'commander';
import { readFile, mkdir, access, rm } from 'node:fs/promises';
import { join, dirname } from 'node:path';
import { homedir } from 'node:os';
import { writeFile } from 'atomically';

import { BaseCommand } from '../lib/baseCommand.js';

interface SetupClaudeOptions {
  check?: boolean;
  remove?: boolean;
}

interface SetupCursorOptions {
  check?: boolean;
  remove?: boolean;
}

interface SetupCodexOptions {
  check?: boolean;
  remove?: boolean;
}

/**
 * Claude Code hooks configuration
 */
const CLAUDE_HOOKS = {
  hooks: {
    SessionStart: [
      {
        matcher: '',
        hooks: [{ type: 'command', command: 'tbd prime' }],
      },
    ],
    PreCompact: [
      {
        matcher: '',
        hooks: [{ type: 'command', command: 'tbd prime' }],
      },
    ],
  },
};

/**
 * Cursor IDE rules content
 */
const CURSOR_RULES_CONTENT = `# Tbd Issue Tracker Integration

This project uses tbd for git-native issue tracking.

## Issue Tracking Workflow

- Check \`tbd ready\` for available work at session start
- Track strategic work with \`tbd create\`
- Close completed work with \`tbd close <id>\`
- Run \`tbd sync\` before session end

## Core Commands

- \`tbd ready\` - Show issues ready to work (no blockers)
- \`tbd list --status open\` - All open issues
- \`tbd show <id>\` - Issue details with dependencies
- \`tbd create "title" --type task\` - Create new issue
- \`tbd update <id> --status in_progress\` - Claim work
- \`tbd close <id>\` - Mark complete
- \`tbd sync\` - Sync with git remote

## Session Close Protocol

Before saying "done", run:
1. git status
2. git add <files>
3. tbd sync
4. git commit -m "..."
5. tbd sync
6. git push

For more info: \`tbd docs\`
`;

/**
 * AGENTS.md integration markers and content for Codex/Factory.ai
 */
const CODEX_BEGIN_MARKER = '<!-- BEGIN TBD INTEGRATION -->';
const CODEX_END_MARKER = '<!-- END TBD INTEGRATION -->';

const CODEX_TBD_SECTION = `<!-- BEGIN TBD INTEGRATION -->
## Issue Tracking with tbd

**IMPORTANT**: This project uses **tbd** for ALL issue tracking. Do NOT use markdown TODOs, task lists, or other tracking methods.

### Why tbd?

- Git-native: Issues stored as Markdown files on a sync branch
- Dependency-aware: Track blockers and relationships between issues
- Agent-optimized: JSON output, ready work detection
- Prevents duplicate tracking systems and confusion

### Quick Start

**Check for ready work:**

\`\`\`bash
tbd ready --json
\`\`\`

**Create new issues:**

\`\`\`bash
tbd create "Issue title" --description "Detailed context" --type task --priority 1 --json
\`\`\`

**Claim and update:**

\`\`\`bash
tbd update bd-42 --status in_progress --json
\`\`\`

**Complete work:**

\`\`\`bash
tbd close bd-42 --reason "Completed" --json
\`\`\`

### Workflow for AI Agents

1. **Check ready work**: \`tbd ready\` shows unblocked issues
2. **Claim your task**: \`tbd update <id> --status in_progress\`
3. **Work on it**: Implement, test, document
4. **Complete**: \`tbd close <id> --reason "Done"\`
5. **Sync**: \`tbd sync\` to push changes

### Important Rules

- ✅ Use tbd for ALL task tracking
- ✅ Always use \`--json\` flag for programmatic use
- ✅ Check \`tbd ready\` before asking "what should I work on?"
- ❌ Do NOT create markdown TODO lists
- ❌ Do NOT use external issue trackers

For more details: \`tbd docs\`

<!-- END TBD INTEGRATION -->
`;

const CODEX_NEW_AGENTS_FILE = `# Project Instructions for AI Agents

This file provides instructions and context for AI coding agents working on this project.

${CODEX_TBD_SECTION}

## Build & Test

_Add your build and test commands here_

\`\`\`bash
# Example:
# npm install
# npm test
\`\`\`

## Architecture Overview

_Add a brief overview of your project architecture_

## Conventions & Patterns

_Add your project-specific conventions here_
`;

class SetupClaudeHandler extends BaseCommand {
  async run(options: SetupClaudeOptions): Promise<void> {
    const settingsPath = join(homedir(), '.claude', 'settings.json');

    if (options.check) {
      await this.checkClaudeSetup(settingsPath);
      return;
    }

    if (options.remove) {
      await this.removeClaudeHooks(settingsPath);
      return;
    }

    await this.installClaudeHooks(settingsPath);
  }

  private async checkClaudeSetup(settingsPath: string): Promise<void> {
    try {
      await access(settingsPath);
      const content = await readFile(settingsPath, 'utf-8');
      const settings = JSON.parse(content) as Record<string, unknown>;

      const hooks = settings.hooks as Record<string, unknown> | undefined;
      if (!hooks) {
        this.output.info('Claude Code hooks not configured');
        this.output.data({ installed: false });
        return;
      }

      // Check for tbd hooks
      const sessionStart = hooks.SessionStart as { hooks?: { command?: string }[] }[];
      const preCompact = hooks.PreCompact as { hooks?: { command?: string }[] }[];

      const hasSessionStartHook = sessionStart?.some((h) =>
        h.hooks?.some((hook) => hook.command?.includes('tbd prime')),
      );
      const hasPreCompactHook = preCompact?.some((h) =>
        h.hooks?.some((hook) => hook.command?.includes('tbd prime')),
      );

      if (hasSessionStartHook && hasPreCompactHook) {
        this.output.success('Claude Code hooks installed');
        this.output.data({ installed: true, sessionStart: true, preCompact: true });
      } else {
        this.output.warn('Claude Code hooks partially configured');
        this.output.data({
          installed: false,
          sessionStart: hasSessionStartHook,
          preCompact: hasPreCompactHook,
        });
      }
    } catch {
      this.output.info('Claude Code settings not found');
      this.output.data({ installed: false, settingsExists: false });
    }
  }

  private async removeClaudeHooks(settingsPath: string): Promise<void> {
    try {
      await access(settingsPath);
      const content = await readFile(settingsPath, 'utf-8');
      const settings = JSON.parse(content) as Record<string, unknown>;

      if (!settings.hooks) {
        this.output.info('No hooks to remove');
        return;
      }

      const hooks = settings.hooks as Record<string, unknown>;

      // Remove tbd hooks from SessionStart and PreCompact
      const filterHooks = (arr: { hooks?: { command?: string }[] }[] | undefined) => {
        if (!arr) return undefined;
        return arr.filter((h) => !h.hooks?.some((hook) => hook.command?.includes('tbd prime')));
      };

      const sessionStart = filterHooks(hooks.SessionStart as { hooks?: { command?: string }[] }[]);
      const preCompact = filterHooks(hooks.PreCompact as { hooks?: { command?: string }[] }[]);

      if (sessionStart?.length === 0) delete hooks.SessionStart;
      else if (sessionStart) hooks.SessionStart = sessionStart;

      if (preCompact?.length === 0) delete hooks.PreCompact;
      else if (preCompact) hooks.PreCompact = preCompact;

      if (Object.keys(hooks).length === 0) {
        delete settings.hooks;
      }

      await writeFile(settingsPath, JSON.stringify(settings, null, 2) + '\n');
      this.output.success('Removed tbd hooks from Claude Code');
    } catch {
      this.output.info('Claude Code settings not found');
    }
  }

  private async installClaudeHooks(settingsPath: string): Promise<void> {
    if (this.checkDryRun('Would install Claude Code hooks', { path: settingsPath })) {
      return;
    }

    try {
      // Ensure directory exists
      await mkdir(dirname(settingsPath), { recursive: true });

      // Load existing settings or create new
      let settings: Record<string, unknown> = {};
      try {
        await access(settingsPath);
        const content = await readFile(settingsPath, 'utf-8');
        settings = JSON.parse(content) as Record<string, unknown>;
      } catch {
        // File doesn't exist, start fresh
      }

      // Merge hooks
      const existingHooks = (settings.hooks as Record<string, unknown>) || {};
      settings.hooks = {
        ...existingHooks,
        ...CLAUDE_HOOKS.hooks,
      };

      await writeFile(settingsPath, JSON.stringify(settings, null, 2) + '\n');
      this.output.success('Installed tbd hooks for Claude Code');
      this.output.info('');
      this.output.info('Hooks added:');
      this.output.info('  - SessionStart: runs `tbd prime` at session start');
      this.output.info('  - PreCompact: runs `tbd prime` before context compaction');
      this.output.info('');
      this.output.info('Use `tbd setup claude --check` to verify installation');
    } catch (error) {
      this.output.error(`Failed to install hooks: ${(error as Error).message}`);
    }
  }
}

class SetupCursorHandler extends BaseCommand {
  async run(options: SetupCursorOptions): Promise<void> {
    const cwd = process.cwd();
    const rulesPath = join(cwd, '.cursor', 'rules', 'tbd.mdc');

    if (options.check) {
      await this.checkCursorSetup(rulesPath);
      return;
    }

    if (options.remove) {
      await this.removeCursorRules(rulesPath);
      return;
    }

    await this.installCursorRules(rulesPath);
  }

  private async checkCursorSetup(rulesPath: string): Promise<void> {
    try {
      await access(rulesPath);
      this.output.success('Cursor rules file exists');
      this.output.data({ installed: true, path: rulesPath });
    } catch {
      this.output.info('Cursor rules file not found');
      this.output.data({ installed: false });
    }
  }

  private async removeCursorRules(rulesPath: string): Promise<void> {
    try {
      await rm(rulesPath);
      this.output.success('Removed Cursor tbd rules file');
    } catch {
      this.output.info('Cursor rules file not found');
    }
  }

  private async installCursorRules(rulesPath: string): Promise<void> {
    if (this.checkDryRun('Would create Cursor rules file', { path: rulesPath })) {
      return;
    }

    try {
      // Ensure directory exists
      await mkdir(dirname(rulesPath), { recursive: true });

      await writeFile(rulesPath, CURSOR_RULES_CONTENT);
      this.output.success('Created Cursor rules file');
      this.output.info(`  ${rulesPath}`);
      this.output.info('');
      this.output.info('Cursor will now see tbd workflow instructions.');
      this.output.info('Use `tbd setup cursor --check` to verify installation');
    } catch (error) {
      this.output.error(`Failed to create rules file: ${(error as Error).message}`);
    }
  }
}

class SetupCodexHandler extends BaseCommand {
  async run(options: SetupCodexOptions): Promise<void> {
    const cwd = process.cwd();
    const agentsPath = join(cwd, 'AGENTS.md');

    if (options.check) {
      await this.checkCodexSetup(agentsPath);
      return;
    }

    if (options.remove) {
      await this.removeCodexSection(agentsPath);
      return;
    }

    await this.installCodexSection(agentsPath);
  }

  private async checkCodexSetup(agentsPath: string): Promise<void> {
    try {
      await access(agentsPath);
      const content = await readFile(agentsPath, 'utf-8');

      if (content.includes(CODEX_BEGIN_MARKER)) {
        this.output.success('AGENTS.md with tbd section found');
        this.output.data({ installed: true, path: agentsPath, hasTbdSection: true });
      } else {
        this.output.warn('AGENTS.md exists but no tbd section found');
        this.output.info('  Run: tbd setup codex (to add tbd section)');
        this.output.data({ installed: false, path: agentsPath, hasTbdSection: false });
      }
    } catch {
      this.output.info('AGENTS.md not found');
      this.output.info('  Run: tbd setup codex');
      this.output.data({ installed: false });
    }
  }

  private async removeCodexSection(agentsPath: string): Promise<void> {
    try {
      await access(agentsPath);
      const content = await readFile(agentsPath, 'utf-8');

      if (!content.includes(CODEX_BEGIN_MARKER)) {
        this.output.info('No tbd section found in AGENTS.md');
        return;
      }

      const newContent = this.removeTbdSection(content);
      const trimmed = newContent.trim();

      if (trimmed === '' || trimmed === '# Project Instructions for AI Agents') {
        // File is empty or only has the default header, remove it
        await rm(agentsPath);
        this.output.success('Removed AGENTS.md (file was empty after removing tbd section)');
      } else {
        await writeFile(agentsPath, newContent);
        this.output.success('Removed tbd section from AGENTS.md');
      }
    } catch {
      this.output.info('AGENTS.md not found');
    }
  }

  private async installCodexSection(agentsPath: string): Promise<void> {
    if (this.checkDryRun('Would create/update AGENTS.md', { path: agentsPath })) {
      return;
    }

    try {
      let existingContent = '';
      try {
        await access(agentsPath);
        existingContent = await readFile(agentsPath, 'utf-8');
      } catch {
        // File doesn't exist
      }

      let newContent: string;

      if (existingContent) {
        if (existingContent.includes(CODEX_BEGIN_MARKER)) {
          // Update existing section
          newContent = this.updateTbdSection(existingContent);
          await writeFile(agentsPath, newContent);
          this.output.success('Updated existing tbd section in AGENTS.md');
        } else {
          // Append section to existing file
          newContent = existingContent + '\n\n' + CODEX_TBD_SECTION;
          await writeFile(agentsPath, newContent);
          this.output.success('Added tbd section to existing AGENTS.md');
        }
      } else {
        // Create new file
        await writeFile(agentsPath, CODEX_NEW_AGENTS_FILE);
        this.output.success('Created new AGENTS.md with tbd integration');
      }

      this.output.info(`  File: ${agentsPath}`);
      this.output.info('');
      this.output.info('Codex and other AGENTS.md-compatible tools will automatically');
      this.output.info('read this file on session start.');
      this.output.info('');
      this.output.info('Use `tbd setup codex --check` to verify installation');
    } catch (error) {
      this.output.error(`Failed to update AGENTS.md: ${(error as Error).message}`);
    }
  }

  private updateTbdSection(content: string): string {
    const startIdx = content.indexOf(CODEX_BEGIN_MARKER);
    const endIdx = content.indexOf(CODEX_END_MARKER);

    if (startIdx === -1 || endIdx === -1 || startIdx > endIdx) {
      // Markers not found or invalid, append instead
      return content + '\n\n' + CODEX_TBD_SECTION;
    }

    // Find the end of the end marker line
    let endOfEndMarker = endIdx + CODEX_END_MARKER.length;
    const nextNewline = content.indexOf('\n', endOfEndMarker);
    if (nextNewline !== -1) {
      endOfEndMarker = nextNewline + 1;
    }

    return content.slice(0, startIdx) + CODEX_TBD_SECTION + content.slice(endOfEndMarker);
  }

  private removeTbdSection(content: string): string {
    const startIdx = content.indexOf(CODEX_BEGIN_MARKER);
    const endIdx = content.indexOf(CODEX_END_MARKER);

    if (startIdx === -1 || endIdx === -1 || startIdx > endIdx) {
      return content;
    }

    // Find the end of the end marker line
    let endOfEndMarker = endIdx + CODEX_END_MARKER.length;
    const nextNewline = content.indexOf('\n', endOfEndMarker);
    if (nextNewline !== -1) {
      endOfEndMarker = nextNewline + 1;
    }

    // Also remove leading blank lines before the section
    let trimStart = startIdx;
    while (trimStart > 0 && (content[trimStart - 1] === '\n' || content[trimStart - 1] === '\r')) {
      trimStart--;
    }

    return content.slice(0, trimStart) + content.slice(endOfEndMarker);
  }
}

// Create subcommands
const claudeCommand = new Command('claude')
  .description('Configure Claude Code hooks for tbd integration')
  .option('--check', 'Verify installation status')
  .option('--remove', 'Remove tbd hooks')
  .action(async (options, command) => {
    const handler = new SetupClaudeHandler(command);
    await handler.run(options);
  });

const cursorCommand = new Command('cursor')
  .description('Create Cursor IDE rules file for tbd integration')
  .option('--check', 'Verify installation status')
  .option('--remove', 'Remove tbd rules file')
  .action(async (options, command) => {
    const handler = new SetupCursorHandler(command);
    await handler.run(options);
  });

const codexCommand = new Command('codex')
  .description('Create/update AGENTS.md for Codex and compatible tools')
  .option('--check', 'Verify installation status')
  .option('--remove', 'Remove tbd section from AGENTS.md')
  .action(async (options, command) => {
    const handler = new SetupCodexHandler(command);
    await handler.run(options);
  });

// Main setup command
export const setupCommand = new Command('setup')
  .description('Configure tbd integration with editors and tools')
  .addCommand(claudeCommand)
  .addCommand(cursorCommand)
  .addCommand(codexCommand);
