/**
 * `tbd setup` - Configure tbd integration with editors and tools.
 *
 * Subcommands:
 * - `tbd setup claude` - Configure Claude Code hooks
 * - `tbd setup cursor` - Create Cursor IDE rules file
 * - `tbd setup codex` - Create/update AGENTS.md for Codex
 *
 * See: tbd-design-spec.md §6.4.2 Claude Code Integration
 */

import { Command } from 'commander';
import { readFile, mkdir, access, rm, rename, readdir, stat } from 'node:fs/promises';
import { execSync } from 'node:child_process';
import { join, dirname } from 'node:path';
import { homedir } from 'node:os';
import { writeFile } from 'atomically';

import { BaseCommand } from '../lib/baseCommand.js';
import { CLIError } from '../lib/errors.js';
import { loadPrimeContent } from './prime.js';

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
 * YAML frontmatter for the Claude Code skill file.
 */
const SKILL_FRONTMATTER = `---
name: tbd
description: Git-native issue tracking for AI agents. Use for creating, updating, and tracking issues with dependencies. Invoke when user mentions tbd, issues, tasks, or asks about project work.
allowed-tools: Bash(tbd:*), Read, Write
---
`;

/**
 * Generate Claude Code skill file content.
 * Loads the prime content and prepends the skill YAML frontmatter.
 */
async function generateSkillContent(): Promise<string> {
  const primeContent = await loadPrimeContent();
  return SKILL_FRONTMATTER + primeContent;
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
const CURSOR_RULES_CONTENT = `# tbd Issue Tracker Integration

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
tbd update <id> --status in_progress --json
\`\`\`

**Complete work:**

\`\`\`bash
tbd close <id> --reason "Completed" --json
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
    const cwd = process.cwd();
    const skillPath = join(cwd, '.claude', 'skills', 'tbd', 'SKILL.md');

    if (options.check) {
      await this.checkClaudeSetup(settingsPath, skillPath);
      return;
    }

    if (options.remove) {
      await this.removeClaudeSetup(settingsPath, skillPath);
      return;
    }

    await this.installClaudeSetup(settingsPath, skillPath);
  }

  private async checkClaudeSetup(settingsPath: string, skillPath: string): Promise<void> {
    let hooksInstalled = false;
    let skillInstalled = false;
    let sessionStartHook = false;
    let preCompactHook = false;

    // Check hooks in global settings
    try {
      await access(settingsPath);
      const content = await readFile(settingsPath, 'utf-8');
      const settings = JSON.parse(content) as Record<string, unknown>;

      const hooks = settings.hooks as Record<string, unknown> | undefined;
      if (hooks) {
        const sessionStart = hooks.SessionStart as { hooks?: { command?: string }[] }[];
        const preCompact = hooks.PreCompact as { hooks?: { command?: string }[] }[];

        sessionStartHook = sessionStart?.some((h) =>
          h.hooks?.some((hook) => hook.command?.includes('tbd prime')),
        );
        preCompactHook = preCompact?.some((h) =>
          h.hooks?.some((hook) => hook.command?.includes('tbd prime')),
        );

        hooksInstalled = sessionStartHook && preCompactHook;
      }
    } catch {
      // Settings file doesn't exist
    }

    // Check skill file in project
    try {
      await access(skillPath);
      skillInstalled = true;
    } catch {
      // Skill file doesn't exist
    }

    // Report status
    const fullyInstalled = hooksInstalled && skillInstalled;

    this.output.data(
      {
        installed: fullyInstalled,
        hooks: {
          installed: hooksInstalled,
          sessionStart: sessionStartHook,
          preCompact: preCompactHook,
        },
        skill: { installed: skillInstalled, path: skillPath },
      },
      () => {
        if (hooksInstalled) {
          this.output.success('Claude Code hooks installed');
        } else if (sessionStartHook || preCompactHook) {
          this.output.warn('Claude Code hooks partially configured');
        } else {
          this.output.info('Claude Code hooks not configured');
        }

        if (skillInstalled) {
          this.output.success('Skill file installed');
        } else {
          this.output.info('Skill file not found');
        }
      },
    );
  }

  private async removeClaudeSetup(settingsPath: string, skillPath: string): Promise<void> {
    let removedHooks = false;
    let removedSkill = false;

    // Remove hooks from global settings
    try {
      await access(settingsPath);
      const content = await readFile(settingsPath, 'utf-8');
      const settings = JSON.parse(content) as Record<string, unknown>;

      if (settings.hooks) {
        const hooks = settings.hooks as Record<string, unknown>;

        // Remove tbd hooks from SessionStart and PreCompact
        const filterHooks = (arr: { hooks?: { command?: string }[] }[] | undefined) => {
          if (!arr) return undefined;
          return arr.filter((h) => !h.hooks?.some((hook) => hook.command?.includes('tbd prime')));
        };

        const sessionStart = filterHooks(
          hooks.SessionStart as { hooks?: { command?: string }[] }[],
        );
        const preCompact = filterHooks(hooks.PreCompact as { hooks?: { command?: string }[] }[]);

        if (sessionStart?.length === 0) delete hooks.SessionStart;
        else if (sessionStart) hooks.SessionStart = sessionStart;

        if (preCompact?.length === 0) delete hooks.PreCompact;
        else if (preCompact) hooks.PreCompact = preCompact;

        if (Object.keys(hooks).length === 0) {
          delete settings.hooks;
        }

        await writeFile(settingsPath, JSON.stringify(settings, null, 2) + '\n');
        removedHooks = true;
      }
    } catch {
      // Settings file doesn't exist
    }

    // Remove skill file from project
    try {
      await rm(skillPath);
      removedSkill = true;
    } catch {
      // Skill file doesn't exist
    }

    // Report what was removed
    if (removedHooks) {
      this.output.success('Removed tbd hooks from Claude Code');
    } else {
      this.output.info('No hooks to remove');
    }

    if (removedSkill) {
      this.output.success('Removed skill file');
    } else {
      this.output.info('No skill file to remove');
    }
  }

  private async installClaudeSetup(settingsPath: string, skillPath: string): Promise<void> {
    if (
      this.checkDryRun('Would install Claude Code hooks and skill file', {
        settingsPath,
        skillPath,
      })
    ) {
      return;
    }

    try {
      // Install hooks in global settings
      await mkdir(dirname(settingsPath), { recursive: true });

      let settings: Record<string, unknown> = {};
      try {
        await access(settingsPath);
        const content = await readFile(settingsPath, 'utf-8');
        settings = JSON.parse(content) as Record<string, unknown>;
      } catch {
        // File doesn't exist, start fresh
      }

      const existingHooks = (settings.hooks as Record<string, unknown>) || {};
      settings.hooks = {
        ...existingHooks,
        ...CLAUDE_HOOKS.hooks,
      };

      await writeFile(settingsPath, JSON.stringify(settings, null, 2) + '\n');
      this.output.success('Installed tbd hooks for Claude Code');

      // Install skill file in project
      await mkdir(dirname(skillPath), { recursive: true });
      const skillContent = await generateSkillContent();
      await writeFile(skillPath, skillContent);
      this.output.success('Installed skill file');
      this.output.info(`  ${skillPath}`);

      this.output.info('');
      this.output.info('What was installed:');
      this.output.info('  - Global hooks: SessionStart and PreCompact run `tbd prime`');
      this.output.info('  - Project skill: .claude/skills/tbd/SKILL.md');
      this.output.info('');
      this.output.info('Use `tbd setup claude --check` to verify installation');
    } catch (error) {
      throw new CLIError(`Failed to install: ${(error as Error).message}`);
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
      throw new CLIError(`Failed to create rules file: ${(error as Error).message}`);
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
        this.output.data({ installed: true, path: agentsPath, hastbdSection: true });
      } else {
        this.output.warn('AGENTS.md exists but no tbd section found');
        this.output.info('  Run: tbd setup codex (to add tbd section)');
        this.output.data({ installed: false, path: agentsPath, hastbdSection: false });
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

      const newContent = this.removetbdSection(content);
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
          newContent = this.updatetbdSection(existingContent);
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
      throw new CLIError(`Failed to update AGENTS.md: ${(error as Error).message}`);
    }
  }

  private updatetbdSection(content: string): string {
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

  private removetbdSection(content: string): string {
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

// ============================================================================
// Beads Migration Command
// ============================================================================

interface SetupBeadsOptions {
  confirm?: boolean;
}

// Markers for AGENTS.md beads section
const BEADS_BEGIN_MARKER = '<!-- BEGIN BEADS INTEGRATION -->';
const BEADS_END_MARKER = '<!-- END BEADS INTEGRATION -->';

interface BeadsDisableItem {
  source: string;
  destination: string;
  description: string;
  type: 'directory' | 'file' | 'config-hooks';
  exists: boolean;
  details?: string;
}

class SetupBeadsHandler extends BaseCommand {
  async run(options: SetupBeadsOptions): Promise<void> {
    const colors = this.output.getColors();
    const cwd = process.cwd();
    const disabledDir = join(cwd, '.beads-disabled');

    // Collect all items that could be disabled
    const items: BeadsDisableItem[] = [];

    // 1. Check .beads/ directory
    const beadsDir = join(cwd, '.beads');
    const beadsDirExists = await this.pathExists(beadsDir);
    if (beadsDirExists) {
      const stats = await this.getDirectoryStats(beadsDir);
      items.push({
        source: '.beads/',
        destination: '.beads-disabled/.beads/',
        description: 'Beads data directory',
        type: 'directory',
        exists: true,
        details: `${stats.files} files`,
      });
    }

    // 2. Check .beads-hooks/ directory
    const beadsHooksDir = join(cwd, '.beads-hooks');
    const beadsHooksDirExists = await this.pathExists(beadsHooksDir);
    if (beadsHooksDirExists) {
      const stats = await this.getDirectoryStats(beadsHooksDir);
      items.push({
        source: '.beads-hooks/',
        destination: '.beads-disabled/.beads-hooks/',
        description: 'Beads git hooks',
        type: 'directory',
        exists: true,
        details: `${stats.files} files`,
      });
    }

    // 3. Check .cursor/rules/beads.mdc
    const cursorBeadsFile = join(cwd, '.cursor', 'rules', 'beads.mdc');
    const cursorBeadsExists = await this.pathExists(cursorBeadsFile);
    if (cursorBeadsExists) {
      items.push({
        source: '.cursor/rules/beads.mdc',
        destination: '.beads-disabled/.cursor/rules/beads.mdc',
        description: 'Cursor IDE Beads rules',
        type: 'file',
        exists: true,
      });
    }

    // 4. Check .claude/settings.local.json for bd hooks
    const claudeLocalSettings = join(cwd, '.claude', 'settings.local.json');
    const claudeHooksInfo = await this.checkClaudeLocalHooks(claudeLocalSettings);
    if (claudeHooksInfo.hasBeadsHooks) {
      items.push({
        source: '.claude/settings.local.json',
        destination: '.beads-disabled/.claude/settings.local.json',
        description: 'Claude Code project hooks with bd commands',
        type: 'config-hooks',
        exists: true,
        details: claudeHooksInfo.hookCount + ' bd hook(s)',
      });
    }

    // 5. Check AGENTS.md for beads section
    const agentsMd = join(cwd, 'AGENTS.md');
    const agentsMdInfo = await this.checkAgentsMdBeads(agentsMd);
    if (agentsMdInfo.hasBeadsSection) {
      items.push({
        source: 'AGENTS.md',
        destination: '.beads-disabled/AGENTS.md',
        description: 'AGENTS.md with Beads section',
        type: 'file',
        exists: true,
        details: 'contains beads integration markers',
      });
    }

    // 6. Check .gitattributes for beads merge driver config
    const gitattributes = join(cwd, '.gitattributes');
    const gitattributesInfo = await this.checkGitattributesBeads(gitattributes);
    if (gitattributesInfo.hasBeadsLines) {
      items.push({
        source: '.gitattributes',
        destination: '.beads-disabled/.gitattributes',
        description: '.gitattributes with Beads merge driver',
        type: 'config-hooks',
        exists: true,
        details: `${gitattributesInfo.lineCount} beads-related line(s)`,
      });
    }

    // Nothing to disable?
    if (items.length === 0) {
      this.output.info('No Beads files found to disable.');
      return;
    }

    // Show what will be moved
    console.log(colors.bold('The following Beads files will be moved to .beads-disabled/:'));
    console.log('');
    for (const item of items) {
      const details = item.details ? colors.dim(` (${item.details})`) : '';
      console.log(`  ${colors.warn(item.source)} → ${colors.dim(item.destination)}${details}`);
      console.log(`    ${colors.dim(item.description)}`);
    }
    console.log('');

    if (!options.confirm) {
      console.log(`This preserves all Beads data for potential rollback.`);
      console.log('');
      console.log(`To confirm, run: ${colors.dim('tbd setup beads --disable --confirm')}`);
      console.log('');
      console.log(colors.dim('After disabling Beads, run:'));
      console.log(colors.dim('  tbd setup claude   # Install tbd hooks'));
      console.log(colors.dim('  tbd setup cursor   # Install tbd Cursor rules (optional)'));
      console.log(colors.dim('  tbd setup codex    # Update AGENTS.md for tbd (optional)'));
      return;
    }

    // Check dry-run
    if (
      this.checkDryRun('Would disable Beads and move files', { items: items.map((i) => i.source) })
    ) {
      return;
    }

    // Perform the disable
    this.output.info('Disabling Beads...');

    // Stop the Beads daemon first (if running)
    try {
      const result = execSync('bd daemon stop', {
        encoding: 'utf-8',
        stdio: ['pipe', 'pipe', 'pipe'],
        timeout: 5000,
      });
      // Check if daemon was actually stopped
      if (result.includes('stopped') || result.includes('Stopped')) {
        console.log(`  ${colors.success('✓')} Stopped Beads daemon`);
      } else {
        console.log(`  ${colors.dim('○')} Beads daemon was not running`);
      }
    } catch (error) {
      const errorMessage = (error as { message?: string }).message ?? '';
      if (errorMessage.includes('not running') || errorMessage.includes('No daemon')) {
        console.log(`  ${colors.dim('○')} Beads daemon was not running`);
      } else if (errorMessage.includes('command not found') || errorMessage.includes('ENOENT')) {
        console.log(`  ${colors.dim('○')} bd command not available (skipping daemon stop)`);
      } else {
        console.log(
          `  ${colors.warn('⚠')} Could not stop Beads daemon: ${errorMessage.split('\n')[0]}`,
        );
      }
    }

    // Create .beads-disabled/ directory
    await mkdir(disabledDir, { recursive: true });

    // Track successful operations for RESTORE.md
    const completed: { source: string; destination: string; action: string; restoreCmd: string }[] =
      [];

    for (const item of items) {
      const sourcePath = join(cwd, item.source);
      const destPath = join(cwd, item.destination);

      try {
        if (item.type === 'directory') {
          // Ensure destination parent directory exists for rename
          await mkdir(dirname(destPath), { recursive: true });
          // Move directory
          await rename(sourcePath, destPath);
          console.log(`  ${colors.success('✓')} Moved ${item.source}`);
          completed.push({
            source: item.source,
            destination: item.destination,
            action: 'moved directory',
            restoreCmd: `mv ${item.destination} ${item.source}`,
          });
        } else if (item.type === 'file') {
          // Backup file using atomically (creates parent dirs automatically)
          const content = await readFile(sourcePath, 'utf-8');
          await writeFile(destPath, content);

          if (item.source === 'AGENTS.md') {
            // Remove beads section from AGENTS.md
            await this.removeBeadsSectionFromAgentsMd(agentsMd);
            console.log(
              `  ${colors.success('✓')} Backed up and removed Beads section from ${item.source}`,
            );
            completed.push({
              source: item.source,
              destination: item.destination,
              action: 'backed up original, removed Beads section from current',
              restoreCmd: `cp ${item.destination} ${item.source}`,
            });
          } else {
            // Move file (after backup)
            await rm(sourcePath);
            console.log(`  ${colors.success('✓')} Moved ${item.source}`);
            completed.push({
              source: item.source,
              destination: item.destination,
              action: 'moved file',
              restoreCmd: `mv ${item.destination} ${item.source}`,
            });
          }
        } else if (item.type === 'config-hooks') {
          // Backup file using atomically (creates parent dirs automatically)
          const content = await readFile(sourcePath, 'utf-8');
          await writeFile(destPath, content);

          if (item.source === '.claude/settings.local.json') {
            // Remove bd hooks from local settings
            await this.removeBeadsHooksFromClaudeSettings(claudeLocalSettings);
            console.log(
              `  ${colors.success('✓')} Backed up and removed bd hooks from ${item.source}`,
            );
            completed.push({
              source: item.source,
              destination: item.destination,
              action: 'backed up original, removed bd hooks from current',
              restoreCmd: `cp ${item.destination} ${item.source}`,
            });
          } else if (item.source === '.gitattributes') {
            // Remove beads lines from .gitattributes
            await this.removeBeadsLinesFromGitattributes(gitattributes);
            console.log(
              `  ${colors.success('✓')} Backed up and removed beads lines from ${item.source}`,
            );
            completed.push({
              source: item.source,
              destination: item.destination,
              action: 'backed up original, removed beads merge driver lines',
              restoreCmd: `cp ${item.destination} ${item.source}`,
            });
          }
        }
      } catch (error) {
        console.log(
          `  ${colors.warn('⚠')} Could not process ${item.source}: ${(error as Error).message}`,
        );
      }
    }

    // Write RESTORE.md with clear restore instructions
    if (completed.length > 0) {
      const restoreMd = this.generateRestoreMd(completed);
      const restorePath = join(disabledDir, 'RESTORE.md');
      await writeFile(restorePath, restoreMd);
      console.log(`  ${colors.success('✓')} Created RESTORE.md with rollback instructions`);
    }

    console.log('');
    this.output.success('Beads has been disabled.');
    console.log('');
    console.log('All Beads files have been moved to .beads-disabled/');
    console.log(colors.dim('See .beads-disabled/RESTORE.md for rollback instructions.'));
    console.log('');
    console.log(colors.dim('Next steps:'));
    console.log(colors.dim('  tbd setup claude   # Install tbd hooks'));
    console.log(colors.dim('  tbd setup cursor   # Install tbd Cursor rules (optional)'));
    console.log(colors.dim('  tbd setup codex    # Update AGENTS.md for tbd (optional)'));
  }

  private async pathExists(path: string): Promise<boolean> {
    try {
      await access(path);
      return true;
    } catch {
      return false;
    }
  }

  private async getDirectoryStats(dirPath: string): Promise<{ files: number; size: number }> {
    let files = 0;
    let size = 0;

    const walk = async (dir: string): Promise<void> => {
      try {
        const entries = await readdir(dir, { withFileTypes: true });
        for (const entry of entries) {
          const fullPath = join(dir, entry.name);
          if (entry.isDirectory()) {
            await walk(fullPath);
          } else {
            files++;
            try {
              const stats = await stat(fullPath);
              size += stats.size;
            } catch {
              // Ignore stat errors
            }
          }
        }
      } catch {
        // Ignore errors
      }
    };

    await walk(dirPath);
    return { files, size };
  }

  private async checkClaudeLocalHooks(
    settingsPath: string,
  ): Promise<{ hasBeadsHooks: boolean; hookCount: number }> {
    try {
      await access(settingsPath);
      const content = await readFile(settingsPath, 'utf-8');
      const settings = JSON.parse(content) as Record<string, unknown>;

      const hooks = settings.hooks as Record<string, unknown[]> | undefined;
      if (!hooks) {
        return { hasBeadsHooks: false, hookCount: 0 };
      }

      let hookCount = 0;
      for (const hookType of Object.keys(hooks)) {
        const hookArray = hooks[hookType] as { hooks?: { command?: string }[] }[];
        for (const hookEntry of hookArray) {
          if (hookEntry.hooks) {
            for (const hook of hookEntry.hooks) {
              if (
                hook.command &&
                (hook.command.includes('bd ') || hook.command.includes('bd prime'))
              ) {
                hookCount++;
              }
            }
          }
        }
      }

      return { hasBeadsHooks: hookCount > 0, hookCount };
    } catch {
      return { hasBeadsHooks: false, hookCount: 0 };
    }
  }

  private async removeBeadsHooksFromClaudeSettings(settingsPath: string): Promise<void> {
    const content = await readFile(settingsPath, 'utf-8');
    const settings = JSON.parse(content) as Record<string, unknown>;

    const hooks = settings.hooks as Record<string, unknown[]> | undefined;
    if (!hooks) return;

    // Filter out bd hooks from each hook type
    for (const hookType of Object.keys(hooks)) {
      const hookArray = hooks[hookType] as {
        matcher?: string;
        hooks?: { type?: string; command?: string }[];
      }[];
      hooks[hookType] = hookArray
        .map((entry) => {
          if (!entry.hooks) return entry;
          entry.hooks = entry.hooks.filter(
            (hook) =>
              !hook.command ||
              (!hook.command.includes('bd ') && !hook.command.includes('bd prime')),
          );
          return entry;
        })
        .filter((entry) => !entry.hooks || entry.hooks.length > 0);

      if (hooks[hookType].length === 0) {
        delete hooks[hookType];
      }
    }

    if (Object.keys(hooks).length === 0) {
      delete settings.hooks;
    }

    await writeFile(settingsPath, JSON.stringify(settings, null, 2) + '\n');
  }

  private async checkAgentsMdBeads(agentsMdPath: string): Promise<{ hasBeadsSection: boolean }> {
    try {
      await access(agentsMdPath);
      const content = await readFile(agentsMdPath, 'utf-8');
      return { hasBeadsSection: content.includes(BEADS_BEGIN_MARKER) };
    } catch {
      return { hasBeadsSection: false };
    }
  }

  private async checkGitattributesBeads(
    gitattributesPath: string,
  ): Promise<{ hasBeadsLines: boolean; lineCount: number }> {
    try {
      await access(gitattributesPath);
      const content = await readFile(gitattributesPath, 'utf-8');
      const lines = content.split('\n');
      const beadsLines = lines.filter((line) => this.isBeadsGitattributeLine(line));
      return { hasBeadsLines: beadsLines.length > 0, lineCount: beadsLines.length };
    } catch {
      return { hasBeadsLines: false, lineCount: 0 };
    }
  }

  /**
   * Check if a .gitattributes line is beads-related.
   * Matches lines containing:
   * - merge=beads (merge driver)
   * - .beads/ (beads directory patterns)
   * - References to beads files
   */
  private isBeadsGitattributeLine(line: string): boolean {
    const trimmed = line.trim();
    // Skip empty lines and comments
    if (!trimmed || trimmed.startsWith('#')) {
      return false;
    }
    // Check for beads-related patterns
    return (
      trimmed.includes('merge=beads') ||
      trimmed.includes('.beads/') ||
      trimmed.includes('.beads ') ||
      trimmed.startsWith('.beads')
    );
  }

  private async removeBeadsLinesFromGitattributes(gitattributesPath: string): Promise<void> {
    const content = await readFile(gitattributesPath, 'utf-8');
    const lines = content.split('\n');

    // Filter out beads-related lines, but keep comments that precede non-beads lines
    const result: string[] = [];
    let pendingComments: string[] = [];

    for (const line of lines) {
      const trimmed = line.trim();

      if (!trimmed || trimmed.startsWith('#')) {
        // Collect comments/empty lines
        pendingComments.push(line);
      } else if (this.isBeadsGitattributeLine(line)) {
        // Beads line - discard it and any preceding comments that were about beads
        // Check if pending comments mention beads
        const nonBeadsComments = pendingComments.filter(
          (c) =>
            !c.toLowerCase().includes('beads') &&
            !c.toLowerCase().includes('bd merge') &&
            !c.toLowerCase().includes('merge driver'),
        );
        result.push(...nonBeadsComments);
        pendingComments = [];
      } else {
        // Non-beads content line - keep it and any pending comments
        result.push(...pendingComments);
        result.push(line);
        pendingComments = [];
      }
    }

    // Add any trailing comments/empty lines that aren't beads-related
    const nonBeadsTrailing = pendingComments.filter(
      (c) =>
        !c.toLowerCase().includes('beads') &&
        !c.toLowerCase().includes('bd merge') &&
        !c.toLowerCase().includes('merge driver'),
    );
    result.push(...nonBeadsTrailing);

    const newContent = result.join('\n');

    // If file is now empty (only whitespace), we could delete it
    // but it's safer to leave it with just whitespace
    await writeFile(gitattributesPath, newContent);
  }

  private async removeBeadsSectionFromAgentsMd(agentsMdPath: string): Promise<void> {
    const content = await readFile(agentsMdPath, 'utf-8');

    const startIdx = content.indexOf(BEADS_BEGIN_MARKER);
    const endIdx = content.indexOf(BEADS_END_MARKER);

    if (startIdx === -1 || endIdx === -1 || startIdx > endIdx) {
      return; // No valid markers found
    }

    // Find the end of the end marker line
    let endOfEndMarker = endIdx + BEADS_END_MARKER.length;
    const nextNewline = content.indexOf('\n', endOfEndMarker);
    if (nextNewline !== -1) {
      endOfEndMarker = nextNewline + 1;
    }

    // Also remove leading blank lines before the section
    let trimStart = startIdx;
    while (trimStart > 0 && (content[trimStart - 1] === '\n' || content[trimStart - 1] === '\r')) {
      trimStart--;
    }

    const newContent = content.slice(0, trimStart) + content.slice(endOfEndMarker);

    // If file is now empty or just whitespace, leave it as is (don't delete)
    await writeFile(agentsMdPath, newContent);
  }

  private generateRestoreMd(
    completed: { source: string; destination: string; action: string; restoreCmd: string }[],
  ): string {
    const timestamp = new Date().toISOString();
    const lines: string[] = [
      '# Beads Restore Instructions',
      '',
      `Beads was disabled on: ${timestamp}`,
      '',
      '## What Was Changed',
      '',
      '| Original Location | Backup Location | Action |',
      '|-------------------|-----------------|--------|',
    ];

    for (const item of completed) {
      lines.push(`| \`${item.source}\` | \`${item.destination}\` | ${item.action} |`);
    }

    lines.push('');
    lines.push('## To Restore Beads');
    lines.push('');
    lines.push('Run the following commands from your project root:');
    lines.push('');
    lines.push('```bash');

    for (const item of completed) {
      lines.push(`# Restore ${item.source}`);
      lines.push(item.restoreCmd);
      lines.push('');
    }

    lines.push('# Optionally remove this backup directory');
    lines.push('rm -rf .beads-disabled/');
    lines.push('```');
    lines.push('');
    lines.push('## Notes');
    lines.push('');
    lines.push('- For files that had content removed (AGENTS.md, .claude/settings.local.json),');
    lines.push('  restoring will overwrite current content with the backed-up version.');
    lines.push('- If you have made changes to these files since disabling Beads,');
    lines.push('  you may need to manually merge the Beads content back in.');
    lines.push('- After restoring, you may need to restart the Beads daemon: `bd daemon start`');
    lines.push('');

    return lines.join('\n');
  }
}

interface SetupBeadsCommandOptions {
  disable?: boolean;
  confirm?: boolean;
}

const beadsCommand = new Command('beads')
  .description('Disable Beads and migrate to tbd')
  .option('--disable', 'Disable Beads and move files to .beads-disabled/')
  .option('--confirm', 'Confirm the operation (required to proceed)')
  .action(async (options: SetupBeadsCommandOptions, command) => {
    if (options.disable) {
      const handler = new SetupBeadsHandler(command);
      await handler.run(options);
    } else {
      // Show usage if --disable not specified
      console.log('Usage: tbd setup beads --disable [--confirm]');
      console.log('');
      console.log('Options:');
      console.log('  --disable   Disable Beads and move files to .beads-disabled/');
      console.log('  --confirm   Confirm the operation (required to proceed)');
      console.log('');
      console.log('This command helps migrate from Beads to tbd by safely');
      console.log('moving Beads configuration files to a backup directory.');
    }
  });

// Main setup command
export const setupCommand = new Command('setup')
  .description('Configure tbd integration with editors and tools')
  .addCommand(claudeCommand)
  .addCommand(cursorCommand)
  .addCommand(codexCommand)
  .addCommand(beadsCommand);
