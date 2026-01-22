/**
 * `tbd setup` - Configure tbd integration with editors and tools.
 *
 * Subcommands:
 * - `tbd setup claude` - Configure Claude Code hooks
 * - `tbd setup cursor` - Create Cursor IDE rules file
 * - `tbd setup codex` - Create/update AGENTS.md for Codex
 *
 * See: tbd-design.md §6.4.2 Claude Code Integration
 */

import { Command } from 'commander';
import { readFile, mkdir, access, rm, rename, chmod } from 'node:fs/promises';
import { spawnSync } from 'node:child_process';
import { join, dirname } from 'node:path';
import { homedir } from 'node:os';
import { writeFile } from 'atomically';

import { BaseCommand } from '../lib/base-command.js';
import { CLIError } from '../lib/errors.js';
import { loadSkillContent } from './prime.js';
import { stripFrontmatter } from '../../utils/markdown-utils.js';
import { pathExists } from '../../utils/file-utils.js';
import { type DiagnosticResult, renderDiagnostics } from '../lib/diagnostics.js';
import { fileURLToPath } from 'node:url';
import { autoDetectPrefix, isValidPrefix, getBeadsPrefix } from '../lib/prefix-detection.js';
import { initConfig, isInitialized, readConfig } from '../../file/config.js';
import { VERSION } from '../lib/version.js';
import { TBD_DIR, WORKTREE_DIR_NAME, DATA_SYNC_DIR_NAME } from '../../lib/paths.js';
import { initWorktree, isInGitRepo } from '../../file/git.js';

/**
 * Get the path to the bundled CURSOR.mdc file.
 */
function getCursorPath(): string {
  const __filename = fileURLToPath(import.meta.url);
  const __dirname = dirname(__filename);
  // When bundled, runs from dist/bin.mjs or dist/cli.mjs
  // Docs are at dist/docs/CURSOR.mdc (same level as the bundle)
  return join(__dirname, 'docs', 'CURSOR.mdc');
}

/**
 * Load the Cursor rules content from the bundled CURSOR.mdc file with fallbacks.
 * Unlike SKILL.md, CURSOR.mdc includes its own frontmatter which is required for Cursor.
 */
async function loadCursorContent(): Promise<string> {
  // Try bundled location first
  try {
    return await readFile(getCursorPath(), 'utf-8');
  } catch {
    // Fallback: try to read from source location during development
  }

  // Fallback for development without bundle
  try {
    const __filename = fileURLToPath(import.meta.url);
    const __dirname = dirname(__filename);
    const devPath = join(__dirname, '..', '..', 'docs', 'CURSOR.mdc');
    return await readFile(devPath, 'utf-8');
  } catch {
    // Fallback: try repo-level docs
  }

  // Last fallback: repo-level docs
  try {
    const __filename = fileURLToPath(import.meta.url);
    const __dirname = dirname(__filename);
    const repoPath = join(__dirname, '..', '..', '..', '..', '..', 'docs', 'SKILL.md');
    // Fall back to SKILL.md if CURSOR.mdc not found (strips frontmatter)
    const content = await readFile(repoPath, 'utf-8');
    return stripFrontmatter(content);
  } catch {
    throw new Error('CURSOR.mdc content file not found. Please rebuild the CLI.');
  }
}

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
 * Get the Cursor rules content from CURSOR.mdc.
 * CURSOR.mdc has its own MDC-specific frontmatter which is required for Cursor to recognize the file.
 */
async function getCursorRulesContent(): Promise<string> {
  return loadCursorContent();
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
// Setup Default Handler (for --auto and --interactive modes)
// ============================================================================

interface SetupDefaultOptions {
  auto?: boolean;
  interactive?: boolean;
  fromBeads?: boolean;
  prefix?: string;
}

/**
 * Default handler for `tbd setup` with --auto or --interactive flags.
 *
 * This implements the unified onboarding flow:
 * - `tbd setup --auto`: Non-interactive setup with smart defaults (for agents)
 * - `tbd setup --interactive`: Interactive setup with prompts (for humans)
 *
 * Decision tree:
 * 1. Not in git repo → Error (git init first)
 * 2. Has .tbd/ → Already initialized, check/update integrations
 * 3. Has .beads/ → Beads migration flow
 * 4. Fresh repo → Initialize + configure integrations
 */
class SetupDefaultHandler extends BaseCommand {
  private cmd: Command;

  constructor(command: Command) {
    super(command);
    this.cmd = command;
  }

  async run(options: SetupDefaultOptions): Promise<void> {
    const colors = this.output.getColors();
    const cwd = process.cwd();

    // Determine mode
    const isAutoMode = options.auto === true;
    // Note: options.interactive will be used when we add interactive prompts

    // Header
    console.log(colors.bold('tbd: Git-native issue tracking for AI agents and humans'));
    console.log('');

    // Check if in git repo
    const inGitRepo = await isInGitRepo(cwd);
    if (!inGitRepo) {
      console.log(colors.warn('Error: Not a git repository.'));
      console.log('');
      console.log('tbd requires a git repository. Run `git init` first.');
      process.exit(1);
    }

    // Check current state
    const hasTbd = await isInitialized(cwd);
    const hasBeads = await pathExists(join(cwd, '.beads'));

    console.log('Checking repository...');
    console.log(`  ${colors.success('✓')} Git repository detected`);

    if (hasTbd) {
      // Already initialized flow
      const config = await readConfig(cwd);
      console.log(`  ${colors.success('✓')} tbd initialized (prefix: ${config.display.id_prefix})`);
      console.log('');
      await this.handleAlreadyInitialized(cwd, isAutoMode);
    } else if (hasBeads && !options.prefix) {
      // Beads migration flow (unless prefix override given)
      console.log(`  ${colors.dim('✗')} tbd not initialized`);
      console.log(`  ${colors.warn('!')} Beads detected (.beads/ directory found)`);
      console.log('');
      await this.handleBeadsMigration(cwd, isAutoMode, options);
    } else {
      // Fresh setup flow
      console.log(`  ${colors.dim('✗')} tbd not initialized`);
      console.log('');
      await this.handleFreshSetup(cwd, isAutoMode, options);
    }
  }

  private async handleAlreadyInitialized(_cwd: string, _isAutoMode: boolean): Promise<void> {
    const colors = this.output.getColors();

    console.log('Checking integrations...');

    // Use SetupAutoHandler to configure integrations
    const autoHandler = new SetupAutoHandler(this.cmd);
    await autoHandler.run();

    console.log('');
    console.log(colors.success('All set!'));
  }

  private async handleBeadsMigration(
    cwd: string,
    isAutoMode: boolean,
    options: SetupDefaultOptions,
  ): Promise<void> {
    const colors = this.output.getColors();

    if (isAutoMode) {
      console.log(`  ${colors.warn('!')} Beads detected - auto-migrating`);
      console.log('');
    }

    // Get prefix from beads config or auto-detect
    const beadsPrefix = await getBeadsPrefix(cwd);
    const prefix = options.prefix ?? beadsPrefix ?? (await autoDetectPrefix(cwd));

    if (!isValidPrefix(prefix)) {
      console.log(colors.warn('Error: Could not determine a valid prefix.'));
      console.log('');
      console.log('Please specify a prefix:');
      console.log('  tbd setup --auto --prefix=myapp');
      process.exit(1);
    }

    // Initialize tbd first
    await this.initializeTbd(cwd, prefix);

    // Import beads issues from the JSONL file
    console.log('Importing from Beads...');
    const beadsDir = join(cwd, '.beads');
    const jsonlPath = join(beadsDir, 'issues.jsonl');

    try {
      await access(jsonlPath);
      // Import directly from the JSONL file (tbd is already initialized)
      const result = spawnSync('tbd', ['import', jsonlPath, '--verbose'], {
        cwd,
        stdio: 'inherit',
      });
      if (result.status !== 0) {
        console.log(colors.warn('Warning: Some issues may not have imported correctly'));
      }
    } catch {
      console.log(colors.dim('  No issues.jsonl found - skipping import'));
    }

    // Disable beads
    await this.disableBeads(cwd);

    console.log('');
    console.log('Configuring integrations...');

    // Configure integrations
    const autoHandler = new SetupAutoHandler(this.cmd);
    await autoHandler.run();

    console.log('');
    console.log(colors.success('Setup complete!'));
    console.log('');

    // Show dashboard after setup
    spawnSync('tbd', ['prime'], { stdio: 'inherit' });
  }

  private async handleFreshSetup(
    cwd: string,
    isAutoMode: boolean,
    options: SetupDefaultOptions,
  ): Promise<void> {
    const colors = this.output.getColors();

    // Auto-detect or use provided prefix
    const prefix = options.prefix ?? (await autoDetectPrefix(cwd));

    if (!isValidPrefix(prefix)) {
      console.log(colors.warn('Error: Could not auto-detect project prefix.'));
      console.log('No git remote found and directory name is not a valid prefix.');
      console.log('');
      console.log('Please specify a prefix:');
      console.log('  tbd setup --auto --prefix=myapp');
      process.exit(1);
    }

    console.log(`Initializing with auto-detected prefix "${prefix}"...`);

    await this.initializeTbd(cwd, prefix);

    console.log('');
    console.log('Configuring integrations...');

    // Configure integrations
    const autoHandler = new SetupAutoHandler(this.cmd);
    await autoHandler.run();

    console.log('');
    console.log(colors.success('Setup complete!'));
    console.log('');

    // Show dashboard after setup
    spawnSync('tbd', ['prime'], { stdio: 'inherit' });
  }

  private async initializeTbd(cwd: string, prefix: string): Promise<void> {
    const colors = this.output.getColors();

    // 1. Create .tbd/ directory with config.yml
    await initConfig(cwd, VERSION, prefix);
    console.log(`  ${colors.success('✓')} Created .tbd/config.yml`);

    // 2. Create .tbd/.gitignore
    const gitignoreContent = [
      '# Local cache (not shared)',
      'cache/',
      '',
      '# Hidden worktree for tbd-sync branch',
      `${WORKTREE_DIR_NAME}/`,
      '',
      '# Data sync directory (only exists in worktree)',
      `${DATA_SYNC_DIR_NAME}/`,
      '',
      '# Temporary files',
      '*.tmp',
      '*.temp',
      '',
    ].join('\n');

    const gitignorePath = join(cwd, TBD_DIR, '.gitignore');
    await writeFile(gitignorePath, gitignoreContent);
    console.log(`  ${colors.success('✓')} Created .tbd/.gitignore`);

    // 3. Initialize worktree for sync branch
    try {
      await initWorktree(cwd, 'tbd-sync', 'origin');
      console.log(`  ${colors.success('✓')} Initialized sync branch`);
    } catch {
      // Non-fatal - sync will work, just not optimally
      console.log(`  ${colors.dim('○')} Sync branch will be created on first sync`);
    }
  }

  private async disableBeads(cwd: string): Promise<void> {
    const colors = this.output.getColors();

    // Move .beads to .beads-disabled
    const beadsDir = join(cwd, '.beads');
    const disabledDir = join(cwd, '.beads-disabled');

    try {
      await rename(beadsDir, disabledDir);
      console.log(`  ${colors.success('✓')} Disabled beads (moved to .beads-disabled/)`);
    } catch {
      console.log(`  ${colors.dim('○')} Could not move .beads directory`);
    }
  }
}

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
    const hasClaudeDir = await pathExists(claudeDir);
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
      if (await pathExists(settingsPath)) {
        const content = await readFile(settingsPath, 'utf-8');
        const settings = JSON.parse(content) as Record<string, unknown>;
        const hooks = settings.hooks as Record<string, unknown> | undefined;
        if (hooks) {
          const sessionStart = hooks.SessionStart as { hooks?: { command?: string }[] }[];
          const hasTbdHook = sessionStart?.some((h) =>
            h.hooks?.some((hook) => hook.command?.includes('tbd prime')),
          );
          if (hasTbdHook && (await pathExists(skillPath))) {
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
    if (!(await pathExists(cursorDir))) {
      return result;
    }

    result.detected = true;

    // Check if already installed
    const rulesPath = join(cwd, '.cursor', 'rules', 'tbd.mdc');
    if (await pathExists(rulesPath)) {
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
    const hasAgentsMd = await pathExists(agentsPath);
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
}

// Main setup command
export const setupCommand = new Command('setup')
  .description('Configure tbd integration with editors and tools')
  .option('--auto', 'Non-interactive mode with smart defaults (for agents/scripts)')
  .option('--interactive', 'Interactive mode with prompts (for humans)')
  .option('--from-beads', 'Migrate from Beads to tbd')
  .option('--prefix <name>', 'Override auto-detected project prefix')
  .addCommand(claudeCommand)
  .addCommand(cursorCommand)
  .addCommand(codexCommand)
  .action(async (options: SetupDefaultOptions, command) => {
    // If --auto or --interactive flag is set, run the default handler
    if (options.auto || options.interactive) {
      const handler = new SetupDefaultHandler(command);
      await handler.run(options);
      return;
    }

    // If --from-beads is set without --auto/--interactive, treat as --auto
    if (options.fromBeads) {
      const handler = new SetupDefaultHandler(command);
      await handler.run({ ...options, auto: true });
      return;
    }

    // No flags provided - show help
    console.log('Usage: tbd setup [options] [command]');
    console.log('');
    console.log('Full setup: initialize tbd (if needed) and configure agent integrations.');
    console.log('');
    console.log('IMPORTANT: You must specify a mode flag OR a subcommand.');
    console.log('');
    console.log('Modes:');
    console.log(
      '  --auto              Non-interactive mode with smart defaults (for agents/scripts)',
    );
    console.log('  --interactive       Interactive mode with prompts (for humans)');
    console.log('');
    console.log('Options:');
    console.log('  --from-beads        Migrate from Beads to tbd (non-interactive)');
    console.log('  --prefix <name>     Override auto-detected project prefix');
    console.log('');
    console.log('Commands:');
    console.log('  claude              Configure Claude Code integration only');
    console.log('  cursor              Configure Cursor IDE integration only');
    console.log('  codex               Configure AGENTS.md only');
    console.log('');
    console.log('Examples:');
    console.log('  tbd setup --auto              # Recommended: full automatic setup (for agents)');
    console.log('  tbd setup --interactive       # Interactive setup with prompts (for humans)');
    console.log('  tbd setup claude              # Add just Claude integration');
    console.log('  tbd setup --from-beads        # Migrate from Beads');
    console.log('');
    console.log('For surgical initialization without integrations, see: tbd init --help');
  });
