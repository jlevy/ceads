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
import { readFile, mkdir, access, rm, rename, readdir, stat, chmod } from 'node:fs/promises';
import { execSync } from 'node:child_process';
import { join, dirname } from 'node:path';
import { homedir } from 'node:os';
import { writeFile } from 'atomically';

import { BaseCommand } from '../lib/baseCommand.js';
import { CLIError } from '../lib/errors.js';
import { loadSkillContent } from './prime.js';
import { stripFrontmatter } from '../../utils/markdownUtils.js';
import { type DiagnosticResult, renderDiagnostics } from '../lib/diagnostics.js';

/**
 * Get the tbd section content for AGENTS.md (Codex integration).
 * Loads from SKILL.md, strips frontmatter, and wraps in TBD INTEGRATION markers.
 */
async function getCodexTbdSection(): Promise<string> {
  const skillContent = await loadSkillContent();
  const content = stripFrontmatter(skillContent);
  return `<!-- BEGIN TBD INTEGRATION -->\n${content}<!-- END TBD INTEGRATION -->\n`;
}

/**
 * Get the Cursor rules content from SKILL.md.
 * Strips the skill frontmatter (content is used as-is for .mdc files).
 */
async function getCursorRulesContent(): Promise<string> {
  const skillContent = await loadSkillContent();
  return stripFrontmatter(skillContent);
}

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
 * Claude Code global hooks configuration (installed to ~/.claude/settings.json)
 */
const CLAUDE_GLOBAL_HOOKS = {
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
 * Claude Code project-local hooks configuration (installed to .claude/settings.json)
 * PostToolUse hook reminds about tbd sync after git push
 */
const CLAUDE_PROJECT_HOOKS = {
  hooks: {
    PostToolUse: [
      {
        matcher: 'Bash',
        hooks: [
          {
            type: 'command',
            command: '"$CLAUDE_PROJECT_DIR"/.claude/hooks/tbd-closing-reminder.sh',
          },
        ],
      },
    ],
  },
};

/**
 * Script to remind about close protocol after git push
 */
const TBD_CLOSE_PROTOCOL_SCRIPT = `#!/bin/bash
# Remind about close protocol after git push
# Installed by: tbd setup claude

input=$(cat)
command=$(echo "$input" | jq -r '.tool_input.command // empty')

# Check if this is a git push command and .tbd exists
if [[ "$command" == git\\ push* ]] || [[ "$command" == *"&& git push"* ]] || [[ "$command" == *"; git push"* ]]; then
  if [ -d ".tbd" ]; then
    tbd closing
  fi
fi

exit 0
`;

// Cursor rules content is now generated dynamically from SKILL.md via getCursorRulesContent()

/**
 * AGENTS.md integration markers for Codex/Factory.ai
 * Content is now generated dynamically from SKILL.md via getCodexTbdSection()
 */
const CODEX_BEGIN_MARKER = '<!-- BEGIN TBD INTEGRATION -->';
const CODEX_END_MARKER = '<!-- END TBD INTEGRATION -->';

/**
 * Generate a new AGENTS.md file with tbd integration.
 */
async function getCodexNewAgentsFile(): Promise<string> {
  const tbdSection = await getCodexTbdSection();
  return `# Project Instructions for AI Agents

This file provides instructions and context for AI coding agents working on this project.

${tbdSection}
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
}

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
    const cwd = process.cwd();
    let globalHooksInstalled = false;
    let projectHooksInstalled = false;
    let skillInstalled = false;
    let sessionStartHook = false;
    let preCompactHook = false;
    let postToolUseHook = false;
    let hookScriptInstalled = false;

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

        globalHooksInstalled = sessionStartHook && preCompactHook;
      }
    } catch {
      // Settings file doesn't exist
    }

    // Check project-local hooks
    const projectSettingsPath = join(cwd, '.claude', 'settings.json');
    const hookScriptPath = join(cwd, '.claude', 'hooks', 'tbd-closing-reminder.sh');

    try {
      await access(projectSettingsPath);
      const content = await readFile(projectSettingsPath, 'utf-8');
      const settings = JSON.parse(content) as Record<string, unknown>;

      const hooks = settings.hooks as Record<string, unknown> | undefined;
      if (hooks) {
        const postToolUse = hooks.PostToolUse as { hooks?: { command?: string }[] }[];
        postToolUseHook = postToolUse?.some((h) =>
          h.hooks?.some((hook) => hook.command?.includes('tbd-closing-reminder')),
        );
      }
    } catch {
      // Project settings file doesn't exist
    }

    try {
      await access(hookScriptPath);
      hookScriptInstalled = true;
    } catch {
      // Hook script doesn't exist
    }

    projectHooksInstalled = postToolUseHook && hookScriptInstalled;

    // Check skill file in project
    try {
      await access(skillPath);
      skillInstalled = true;
    } catch {
      // Skill file doesn't exist
    }

    // Report status
    const fullyInstalled = globalHooksInstalled && projectHooksInstalled && skillInstalled;

    // Build diagnostic results for text output
    const diagnostics: DiagnosticResult[] = [];

    // Global hooks diagnostic
    if (globalHooksInstalled) {
      diagnostics.push({
        name: 'Global hooks',
        status: 'ok',
        message: 'SessionStart, PreCompact',
        path: settingsPath.replace(homedir(), '~'),
      });
    } else if (sessionStartHook || preCompactHook) {
      diagnostics.push({
        name: 'Global hooks',
        status: 'warn',
        message: 'partially configured',
        path: settingsPath.replace(homedir(), '~'),
        suggestion: 'Run: tbd setup claude',
      });
    } else {
      diagnostics.push({
        name: 'Global hooks',
        status: 'warn',
        message: 'not configured',
        path: settingsPath.replace(homedir(), '~'),
        suggestion: 'Run: tbd setup claude',
      });
    }

    // Project hooks diagnostic
    const projectSettingsRelPath = '.claude/settings.json';
    if (projectHooksInstalled) {
      diagnostics.push({
        name: 'Project hooks',
        status: 'ok',
        message: 'PostToolUse sync reminder',
        path: projectSettingsRelPath,
      });
    } else if (postToolUseHook || hookScriptInstalled) {
      diagnostics.push({
        name: 'Project hooks',
        status: 'warn',
        message: 'partially configured',
        path: projectSettingsRelPath,
        suggestion: 'Run: tbd setup claude',
      });
    } else {
      diagnostics.push({
        name: 'Project hooks',
        status: 'warn',
        message: 'not configured',
        path: projectSettingsRelPath,
        suggestion: 'Run: tbd setup claude',
      });
    }

    // Skill file diagnostic
    const skillRelPath = '.claude/skills/tbd/SKILL.md';
    if (skillInstalled) {
      diagnostics.push({
        name: 'Skill file',
        status: 'ok',
        path: skillRelPath,
      });
    } else {
      diagnostics.push({
        name: 'Skill file',
        status: 'warn',
        message: 'not found',
        path: skillRelPath,
        suggestion: 'Run: tbd setup claude',
      });
    }

    this.output.data(
      {
        installed: fullyInstalled,
        globalHooks: {
          installed: globalHooksInstalled,
          sessionStart: sessionStartHook,
          preCompact: preCompactHook,
          path: settingsPath,
        },
        projectHooks: {
          installed: projectHooksInstalled,
          postToolUse: postToolUseHook,
          hookScript: hookScriptInstalled,
          path: projectSettingsPath,
        },
        skill: { installed: skillInstalled, path: skillPath },
      },
      () => {
        const colors = this.output.getColors();
        renderDiagnostics(diagnostics, colors);
      },
    );
  }

  private async removeClaudeSetup(settingsPath: string, skillPath: string): Promise<void> {
    const cwd = process.cwd();
    let removedGlobalHooks = false;
    let removedProjectHooks = false;
    let removedHookScript = false;
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
        removedGlobalHooks = true;
      }
    } catch {
      // Settings file doesn't exist
    }

    // Remove project-local hooks
    const projectSettingsPath = join(cwd, '.claude', 'settings.json');
    const hookScriptPath = join(cwd, '.claude', 'hooks', 'tbd-closing-reminder.sh');

    try {
      await access(projectSettingsPath);
      const content = await readFile(projectSettingsPath, 'utf-8');
      const settings = JSON.parse(content) as Record<string, unknown>;

      if (settings.hooks) {
        const hooks = settings.hooks as Record<string, unknown>;

        // Remove tbd PostToolUse hooks
        const filterPostToolUse = (arr: { hooks?: { command?: string }[] }[] | undefined) => {
          if (!arr) return undefined;
          return arr.filter(
            (h) => !h.hooks?.some((hook) => hook.command?.includes('tbd-closing-reminder')),
          );
        };

        const postToolUse = filterPostToolUse(
          hooks.PostToolUse as { hooks?: { command?: string }[] }[],
        );

        if (postToolUse?.length === 0) delete hooks.PostToolUse;
        else if (postToolUse) hooks.PostToolUse = postToolUse;

        if (Object.keys(hooks).length === 0) {
          delete settings.hooks;
        }

        // If settings is now empty (only had hooks), we could remove the file
        // but it's safer to keep it with empty object
        await writeFile(projectSettingsPath, JSON.stringify(settings, null, 2) + '\n');
        removedProjectHooks = true;
      }
    } catch {
      // Project settings file doesn't exist
    }

    // Remove hook script
    try {
      await rm(hookScriptPath);
      removedHookScript = true;
    } catch {
      // Hook script doesn't exist
    }

    // Remove skill file from project
    try {
      await rm(skillPath);
      removedSkill = true;
    } catch {
      // Skill file doesn't exist
    }

    // Report what was removed
    if (removedGlobalHooks) {
      this.output.success('Removed global hooks from Claude Code');
    } else {
      this.output.info('No global hooks to remove');
    }

    if (removedProjectHooks || removedHookScript) {
      this.output.success('Removed project hooks and script');
    } else {
      this.output.info('No project hooks to remove');
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
        ...CLAUDE_GLOBAL_HOOKS.hooks,
      };

      await writeFile(settingsPath, JSON.stringify(settings, null, 2) + '\n');
      this.output.success('Installed global hooks for Claude Code');

      // Install project-local hooks in .claude/settings.json
      const cwd = process.cwd();
      const projectSettingsPath = join(cwd, '.claude', 'settings.json');
      const hookScriptPath = join(cwd, '.claude', 'hooks', 'tbd-closing-reminder.sh');

      // Read existing project settings if present
      let projectSettings: Record<string, unknown> = {};
      try {
        await access(projectSettingsPath);
        const content = await readFile(projectSettingsPath, 'utf-8');
        projectSettings = JSON.parse(content) as Record<string, unknown>;
        // Backup existing settings
        await writeFile(projectSettingsPath + '.bak', content);
      } catch {
        // File doesn't exist, start fresh
      }

      // Merge project hooks
      const existingProjectHooks = (projectSettings.hooks as Record<string, unknown>) || {};
      projectSettings.hooks = {
        ...existingProjectHooks,
        ...CLAUDE_PROJECT_HOOKS.hooks,
      };

      await mkdir(dirname(projectSettingsPath), { recursive: true });
      await writeFile(projectSettingsPath, JSON.stringify(projectSettings, null, 2) + '\n');
      this.output.success('Installed project hooks');

      // Install hook script
      await mkdir(dirname(hookScriptPath), { recursive: true });
      await writeFile(hookScriptPath, TBD_CLOSE_PROTOCOL_SCRIPT);
      await chmod(hookScriptPath, 0o755);
      this.output.success('Installed sync reminder hook script');

      // Install skill file in project
      await mkdir(dirname(skillPath), { recursive: true });
      const skillContent = await loadSkillContent();
      await writeFile(skillPath, skillContent);
      this.output.success('Installed skill file');
      this.output.info(`  ${skillPath}`);

      this.output.info('');
      this.output.info('What was installed:');
      this.output.info('  - Global hooks: SessionStart and PreCompact run `tbd prime`');
      this.output.info('  - Project hooks: PostToolUse reminds about `tbd sync` after git push');
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
    const rulesRelPath = '.cursor/rules/tbd.mdc';
    try {
      await access(rulesPath);
      const diagnostic: DiagnosticResult = {
        name: 'Cursor rules file',
        status: 'ok',
        path: rulesRelPath,
      };
      this.output.data({ installed: true, path: rulesPath }, () => {
        const colors = this.output.getColors();
        renderDiagnostics([diagnostic], colors);
      });
    } catch {
      const diagnostic: DiagnosticResult = {
        name: 'Cursor rules file',
        status: 'warn',
        message: 'not found',
        path: rulesRelPath,
        suggestion: 'Run: tbd setup cursor',
      };
      this.output.data({ installed: false, expectedPath: rulesPath }, () => {
        const colors = this.output.getColors();
        renderDiagnostics([diagnostic], colors);
      });
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

      const rulesContent = await getCursorRulesContent();
      await writeFile(rulesPath, rulesContent);
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
    const agentsRelPath = './AGENTS.md';
    try {
      await access(agentsPath);
      const content = await readFile(agentsPath, 'utf-8');

      if (content.includes(CODEX_BEGIN_MARKER)) {
        const diagnostic: DiagnosticResult = {
          name: 'AGENTS.md',
          status: 'ok',
          message: 'tbd section found',
          path: agentsRelPath,
        };
        this.output.data({ installed: true, path: agentsPath, hastbdSection: true }, () => {
          const colors = this.output.getColors();
          renderDiagnostics([diagnostic], colors);
        });
      } else {
        const diagnostic: DiagnosticResult = {
          name: 'AGENTS.md',
          status: 'warn',
          message: 'exists but no tbd section',
          path: agentsRelPath,
          suggestion: 'Run: tbd setup codex',
        };
        this.output.data({ installed: false, path: agentsPath, hastbdSection: false }, () => {
          const colors = this.output.getColors();
          renderDiagnostics([diagnostic], colors);
        });
      }
    } catch {
      const diagnostic: DiagnosticResult = {
        name: 'AGENTS.md',
        status: 'warn',
        message: 'not found',
        path: agentsRelPath,
        suggestion: 'Run: tbd setup codex',
      };
      this.output.data({ installed: false, expectedPath: agentsPath }, () => {
        const colors = this.output.getColors();
        renderDiagnostics([diagnostic], colors);
      });
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

      const tbdSection = await getCodexTbdSection();

      if (existingContent) {
        if (existingContent.includes(CODEX_BEGIN_MARKER)) {
          // Update existing section
          newContent = this.updatetbdSection(existingContent, tbdSection);
          await writeFile(agentsPath, newContent);
          this.output.success('Updated existing tbd section in AGENTS.md');
        } else {
          // Append section to existing file
          newContent = existingContent + '\n\n' + tbdSection;
          await writeFile(agentsPath, newContent);
          this.output.success('Added tbd section to existing AGENTS.md');
        }
      } else {
        // Create new file
        const newAgentsFile = await getCodexNewAgentsFile();
        await writeFile(agentsPath, newAgentsFile);
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

  private updatetbdSection(content: string, tbdSection: string): string {
    const startIdx = content.indexOf(CODEX_BEGIN_MARKER);
    const endIdx = content.indexOf(CODEX_END_MARKER);

    if (startIdx === -1 || endIdx === -1 || startIdx > endIdx) {
      // Markers not found or invalid, append instead
      return content + '\n\n' + tbdSection;
    }

    // Find the end of the end marker line
    let endOfEndMarker = endIdx + CODEX_END_MARKER.length;
    const nextNewline = content.indexOf('\n', endOfEndMarker);
    if (nextNewline !== -1) {
      endOfEndMarker = nextNewline + 1;
    }

    return content.slice(0, startIdx) + tbdSection + content.slice(endOfEndMarker);
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
  .description('Configure Claude Code (skill and hooks)')
  .option('--check', 'Verify installation status')
  .option('--remove', 'Remove tbd hooks')
  .action(async (options, command) => {
    const handler = new SetupClaudeHandler(command);
    await handler.run(options);
  });

const cursorCommand = new Command('cursor')
  .description('Configure Cursor IDE (rules file)')
  .option('--check', 'Verify installation status')
  .option('--remove', 'Remove tbd rules file')
  .action(async (options, command) => {
    const handler = new SetupCursorHandler(command);
    await handler.run(options);
  });

const codexCommand = new Command('codex')
  .description('Configure Codex and compatible tools (AGENTS.md)')
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
  .description('Disable Beads so you only use tbd')
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

// ============================================================================
// Auto Setup Command
// ============================================================================

interface AutoSetupResult {
  name: string;
  detected: boolean;
  installed: boolean;
  alreadyInstalled: boolean;
  error?: string;
}

class SetupAutoHandler extends BaseCommand {
  private cmd: Command;

  constructor(command: Command) {
    super(command);
    this.cmd = command;
  }

  async run(): Promise<void> {
    const colors = this.output.getColors();
    const cwd = process.cwd();
    const results: AutoSetupResult[] = [];

    // Detect and set up Claude Code
    const claudeResult = await this.setupClaudeIfDetected(cwd);
    results.push(claudeResult);

    // Detect and set up Cursor
    const cursorResult = await this.setupCursorIfDetected(cwd);
    results.push(cursorResult);

    // Detect and set up Codex
    const codexResult = await this.setupCodexIfDetected(cwd);
    results.push(codexResult);

    // Report results
    const installed = results.filter((r) => r.installed && !r.alreadyInstalled);
    const alreadyInstalled = results.filter((r) => r.alreadyInstalled);
    const skipped = results.filter((r) => !r.detected);

    if (installed.length > 0) {
      console.log(colors.bold('Configured integrations:'));
      for (const r of installed) {
        console.log(`  ${colors.success('✓')} ${r.name}`);
      }
    }

    if (alreadyInstalled.length > 0) {
      console.log(colors.dim('Already configured:'));
      for (const r of alreadyInstalled) {
        console.log(`  ${colors.dim('✓')} ${r.name}`);
      }
    }

    if (skipped.length > 0 && (installed.length > 0 || alreadyInstalled.length > 0)) {
      console.log(colors.dim('Not detected (skipped):'));
      for (const r of skipped) {
        console.log(`  ${colors.dim('-')} ${r.name}`);
      }
    }

    if (installed.length === 0 && alreadyInstalled.length === 0) {
      console.log(colors.dim('No coding agents detected.'));
      console.log('');
      console.log('To manually configure:');
      console.log('  tbd setup claude   # Claude Code hooks');
      console.log('  tbd setup cursor   # Cursor IDE rules');
      console.log('  tbd setup codex    # AGENTS.md for Codex');
    }
  }

  private async setupClaudeIfDetected(cwd: string): Promise<AutoSetupResult> {
    const result: AutoSetupResult = {
      name: 'Claude Code',
      detected: false,
      installed: false,
      alreadyInstalled: false,
    };

    // Detect Claude Code: check for ~/.claude/ directory or CLAUDE_* env vars
    const claudeDir = join(homedir(), '.claude');
    const hasClaudeDir = await this.pathExists(claudeDir);
    const hasClaudeEnv = Object.keys(process.env).some((k) => k.startsWith('CLAUDE_'));

    if (!hasClaudeDir && !hasClaudeEnv) {
      return result;
    }

    result.detected = true;

    // Check if already installed
    const settingsPath = join(claudeDir, 'settings.json');
    const skillPath = join(cwd, '.claude', 'skills', 'tbd', 'SKILL.md');

    try {
      // Check for existing tbd hooks in global settings
      if (await this.pathExists(settingsPath)) {
        const content = await readFile(settingsPath, 'utf-8');
        const settings = JSON.parse(content) as Record<string, unknown>;
        const hooks = settings.hooks as Record<string, unknown> | undefined;
        if (hooks) {
          const sessionStart = hooks.SessionStart as { hooks?: { command?: string }[] }[];
          const hasTbdHook = sessionStart?.some((h) =>
            h.hooks?.some((hook) => hook.command?.includes('tbd prime')),
          );
          if (hasTbdHook && (await this.pathExists(skillPath))) {
            result.alreadyInstalled = true;
            result.installed = true;
            return result;
          }
        }
      }

      // Install Claude Code setup
      const handler = new SetupClaudeHandler(this.cmd);
      await handler.run({});
      result.installed = true;
    } catch (error) {
      result.error = (error as Error).message;
    }

    return result;
  }

  private async setupCursorIfDetected(cwd: string): Promise<AutoSetupResult> {
    const result: AutoSetupResult = {
      name: 'Cursor IDE',
      detected: false,
      installed: false,
      alreadyInstalled: false,
    };

    // Detect Cursor: check for .cursor/ directory
    const cursorDir = join(cwd, '.cursor');
    if (!(await this.pathExists(cursorDir))) {
      return result;
    }

    result.detected = true;

    // Check if already installed
    const rulesPath = join(cwd, '.cursor', 'rules', 'tbd.mdc');
    if (await this.pathExists(rulesPath)) {
      result.alreadyInstalled = true;
      result.installed = true;
      return result;
    }

    try {
      const handler = new SetupCursorHandler(this.cmd);
      await handler.run({});
      result.installed = true;
    } catch (error) {
      result.error = (error as Error).message;
    }

    return result;
  }

  private async setupCodexIfDetected(cwd: string): Promise<AutoSetupResult> {
    const result: AutoSetupResult = {
      name: 'Codex/AGENTS.md',
      detected: false,
      installed: false,
      alreadyInstalled: false,
    };

    // Detect Codex: check for existing AGENTS.md or CODEX_* env vars
    const agentsPath = join(cwd, 'AGENTS.md');
    const hasAgentsMd = await this.pathExists(agentsPath);
    const hasCodexEnv = Object.keys(process.env).some((k) => k.startsWith('CODEX_'));

    if (!hasAgentsMd && !hasCodexEnv) {
      return result;
    }

    result.detected = true;

    // Check if already has tbd section
    if (hasAgentsMd) {
      const content = await readFile(agentsPath, 'utf-8');
      if (content.includes('BEGIN TBD INTEGRATION')) {
        result.alreadyInstalled = true;
        result.installed = true;
        return result;
      }
    }

    try {
      const handler = new SetupCodexHandler(this.cmd);
      await handler.run({});
      result.installed = true;
    } catch (error) {
      result.error = (error as Error).message;
    }

    return result;
  }

  private async pathExists(path: string): Promise<boolean> {
    try {
      await access(path);
      return true;
    } catch {
      return false;
    }
  }
}

const autoCommand = new Command('auto')
  .description('Auto-detect and configure integrations (Claude, Cursor, Codex)')
  .action(async (_options, command) => {
    const handler = new SetupAutoHandler(command);
    await handler.run();
  });

// Main setup command
export const setupCommand = new Command('setup')
  .description('Configure tbd integration with editors and tools')
  .addCommand(autoCommand)
  .addCommand(claudeCommand)
  .addCommand(cursorCommand)
  .addCommand(codexCommand)
  .addCommand(beadsCommand);
