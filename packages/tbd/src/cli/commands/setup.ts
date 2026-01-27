/**
 * `tbd setup` - Configure tbd integration with editors and tools.
 *
 * Options:
 * - `tbd setup --auto` - Non-interactive setup (for agents/scripts)
 * - `tbd setup --interactive` - Interactive setup with prompts (for humans)
 * - `tbd setup --from-beads` - Migrate from Beads to tbd
 *
 * See: tbd-design.md §6.4.2 Claude Code Integration
 */

import { Command } from 'commander';
import { readFile, mkdir, access, rm, rename, chmod, readdir } from 'node:fs/promises';
import { spawnSync } from 'node:child_process';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { homedir } from 'node:os';
import { writeFile } from 'atomically';

import { BaseCommand } from '../lib/base-command.js';
import { CLIError } from '../lib/errors.js';
import { loadSkillContent } from './prime.js';
import { stripFrontmatter, insertAfterFrontmatter } from '../../utils/markdown-utils.js';
import { pathExists } from '../../utils/file-utils.js';
import { ensureGitignorePatterns } from '../../utils/gitignore-utils.js';
import { type DiagnosticResult, renderDiagnostics } from '../lib/diagnostics.js';
import { isValidPrefix, getBeadsPrefix } from '../lib/prefix-detection.js';
import {
  initConfig,
  isInitialized,
  readConfig,
  readConfigWithMigration,
  findTbdRoot,
  writeConfig,
  updateLocalState,
  markWelcomeSeen,
} from '../../file/config.js';
import {
  DocSync,
  generateDefaultDocCacheConfig,
  mergeDocCacheConfig,
} from '../../file/doc-sync.js';
import { VERSION } from '../lib/version.js';
import {
  TBD_DIR,
  TBD_DOCS_DIR,
  WORKTREE_DIR_NAME,
  DATA_SYNC_DIR_NAME,
  DEFAULT_SHORTCUT_PATHS,
  TBD_SHORTCUTS_SYSTEM,
  TBD_SHORTCUTS_STANDARD,
  TBD_GUIDELINES_DIR,
  TBD_TEMPLATES_DIR,
} from '../../lib/paths.js';
import { initWorktree, isInGitRepo } from '../../file/git.js';
import { DocCache, generateShortcutDirectory } from '../../file/doc-cache.js';

/**
 * Get the shortcut directory content for appending to installed skill files.
 * Always generates on-the-fly from installed shortcuts.
 *
 * @param quiet - If true, suppress auto-sync output (default: false)
 */
async function getShortcutDirectory(quiet = false): Promise<string | null> {
  const cwd = process.cwd();

  // Try to find tbd root (may not be initialized)
  const tbdRoot = await findTbdRoot(cwd);
  if (!tbdRoot) {
    return null;
  }

  // Generate on-the-fly from installed shortcuts
  const cache = new DocCache(DEFAULT_SHORTCUT_PATHS, tbdRoot);
  await cache.load({ quiet });
  const docs = cache.list();

  // If no docs loaded, skip directory
  if (docs.length === 0) {
    return null;
  }

  return generateShortcutDirectory(docs);
}

/**
 * Get the tbd section content for AGENTS.md (Codex integration).
 * Loads from SKILL.md, strips frontmatter, and wraps in TBD INTEGRATION markers.
 *
 * @param quiet - If true, suppress auto-sync output (default: false)
 */
async function getCodexTbdSection(quiet = false): Promise<string> {
  const skillContent = await loadSkillContent();
  let content = stripFrontmatter(skillContent);
  const directory = await getShortcutDirectory(quiet);
  if (directory) {
    content = content.trimEnd() + '\n\n' + directory + '\n';
  }
  return `<!-- BEGIN TBD INTEGRATION -->\n${content}<!-- END TBD INTEGRATION -->\n`;
}

interface SetupClaudeOptions {
  check?: boolean;
  remove?: boolean;
}

interface SetupCodexOptions {
  check?: boolean;
  remove?: boolean;
}

/**
 * Global script to ensure tbd CLI is installed and run tbd prime.
 * Installed to ~/.claude/scripts/tbd-session.sh
 * Runs on SessionStart and PreCompact to ensure tbd is available and provide orientation.
 *
 * Usage:
 *   tbd-session.sh           # Ensure tbd + run tbd prime
 *   tbd-session.sh --brief   # Ensure tbd + run tbd prime --brief (for PreCompact)
 */
const TBD_SESSION_SCRIPT = `#!/bin/bash
# Ensure tbd CLI is installed and run tbd prime for Claude Code sessions
# Installed by: tbd setup --auto
# This script runs on SessionStart and PreCompact

# Add common binary locations to PATH (persists for entire script)
export PATH="$HOME/.local/bin:$HOME/bin:/usr/local/bin:$PATH"

# Function to ensure tbd is available
ensure_tbd() {
    # Check if tbd is already installed
    if command -v tbd &> /dev/null; then
        return 0
    fi

    echo "[tbd] CLI not found, installing..."

    # Try npm first (most common for Node.js tools)
    if command -v npm &> /dev/null; then
        echo "[tbd] Installing via npm..."
        npm install -g tbd-git 2>/dev/null || {
            # If global install fails (permissions), try local install
            echo "[tbd] Global npm install failed, trying user install..."
            mkdir -p ~/.local/bin
            npm install --prefix ~/.local tbd-git
            # Create symlink if needed
            if [ -f ~/.local/node_modules/.bin/tbd ]; then
                ln -sf ~/.local/node_modules/.bin/tbd ~/.local/bin/tbd
            fi
        }
    elif command -v pnpm &> /dev/null; then
        echo "[tbd] Installing via pnpm..."
        pnpm add -g tbd-git
    elif command -v yarn &> /dev/null; then
        echo "[tbd] Installing via yarn..."
        yarn global add tbd-git
    else
        echo "[tbd] ERROR: No package manager found (npm, pnpm, or yarn required)"
        echo "[tbd] Please install Node.js and npm, then run: npm install -g tbd-git"
        return 1
    fi

    # Verify installation
    if command -v tbd &> /dev/null; then
        echo "[tbd] Successfully installed to $(which tbd)"
        return 0
    else
        echo "[tbd] WARNING: tbd installed but not found in PATH"
        echo "[tbd] Checking common locations..."
        # Try to find and add to path
        for dir in ~/.local/bin ~/.local/node_modules/.bin /usr/local/bin; do
            if [ -x "$dir/tbd" ]; then
                export PATH="$dir:$PATH"
                echo "[tbd] Found at $dir/tbd"
                return 0
            fi
        done
        echo "[tbd] Could not locate tbd after installation"
        return 1
    fi
}

# Main
ensure_tbd || exit 1

# Run tbd prime with any passed arguments (e.g., --brief for PreCompact)
tbd prime "$@"
`;

/**
 * Claude Code global hooks configuration (installed to ~/.claude/settings.json)
 * Uses tbd-session.sh which ensures tbd is installed and runs tbd prime with correct PATH.
 */
const CLAUDE_GLOBAL_HOOKS = {
  hooks: {
    SessionStart: [
      {
        matcher: '',
        hooks: [{ type: 'command', command: '$HOME/.claude/scripts/tbd-session.sh' }],
      },
    ],
    PreCompact: [
      {
        matcher: '',
        hooks: [{ type: 'command', command: '$HOME/.claude/scripts/tbd-session.sh --brief' }],
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

/**
 * SessionStart hook entry for the gh CLI ensure script.
 * Installed to project-local .claude/settings.json when use_gh_cli is true.
 */
const GH_CLI_HOOK_ENTRY = {
  matcher: '',
  hooks: [{ type: 'command', command: 'bash .claude/scripts/ensure-gh-cli.sh', timeout: 120 }],
};

/**
 * Command string used to identify the gh CLI hook entry in settings.json.
 */
const GH_CLI_HOOK_COMMAND_PATTERN = 'ensure-gh-cli';

/**
 * Load a bundled script from dist/docs/install/ (or dev fallback).
 * Used to read real .sh files that are copied into the npm package at build time.
 */
async function loadBundledScript(name: string): Promise<string> {
  const __filename = fileURLToPath(import.meta.url);
  const __dirname = dirname(__filename);
  // Flat bundle: dist/docs/install/<name> (tsdown produces flat dist/)
  const flatBundlePath = join(__dirname, 'docs', 'install', name);
  // Nested bundle: dist/cli/commands/../../docs/install/<name>
  const nestedBundlePath = join(__dirname, '..', 'docs', 'install', name);
  // Dev fallback: packages/tbd/docs/install/<name>
  const devPath = join(__dirname, '..', '..', '..', 'docs', 'install', name);
  for (const p of [flatBundlePath, nestedBundlePath, devPath]) {
    try {
      return await readFile(p, 'utf-8');
    } catch {
      continue;
    }
  }
  throw new Error(`Bundled script not found: ${name}`);
}

/**
 * AGENTS.md integration markers for Codex/Factory.ai
 * Content is now generated dynamically from SKILL.md via getCodexTbdSection()
 */
const CODEX_BEGIN_MARKER = '<!-- BEGIN TBD INTEGRATION -->';
const CODEX_END_MARKER = '<!-- END TBD INTEGRATION -->';

/**
 * Generate a new AGENTS.md file with tbd integration.
 *
 * @param quiet - If true, suppress auto-sync output (default: false)
 */
async function getCodexNewAgentsFile(quiet = false): Promise<string> {
  const tbdSection = await getCodexTbdSection(quiet);
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

/**
 * Legacy script patterns to clean up from .claude/scripts/
 * These were used in older versions of tbd before hooks moved to `tbd prime`
 */
const LEGACY_TBD_SCRIPTS = ['setup-tbd.sh', 'ensure-tbd-cli.sh', 'ensure-tbd.sh', 'tbd-setup.sh'];

/**
 * Patterns to identify legacy tbd hooks that should be removed.
 * These patterns match old-style commands that are no longer used.
 */
const LEGACY_TBD_HOOK_PATTERNS = [
  /\.claude\/scripts\/.*tbd/i, // Any tbd-related script in .claude/scripts/
  /tbd\s+setup\s+claude/i, // Old command: tbd setup claude
  /setup-tbd\.sh/i, // Old script name
  /ensure-tbd/i, // Old script names
];

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
    let globalScriptInstalled = false;
    let projectHooksInstalled = false;
    let skillInstalled = false;
    let sessionStartHook = false;
    let preCompactHook = false;
    let postToolUseHook = false;
    let hookScriptInstalled = false;

    // Check for global tbd-session.sh script
    const tbdSessionScript = join(homedir(), '.claude', 'scripts', 'tbd-session.sh');
    try {
      await access(tbdSessionScript);
      globalScriptInstalled = true;
    } catch {
      // Script doesn't exist
    }

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
          h.hooks?.some(
            (hook) =>
              (hook.command?.includes('tbd prime') ?? false) ||
              (hook.command?.includes('tbd-session.sh') ?? false) ||
              (hook.command?.includes('ensure-tbd-cli.sh') ?? false),
          ),
        );
        preCompactHook = preCompact?.some((h) =>
          h.hooks?.some((hook) => hook.command?.includes('tbd prime')),
        );

        globalHooksInstalled = sessionStartHook && preCompactHook && globalScriptInstalled;
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
        suggestion: 'Run: tbd setup --auto',
      });
    } else {
      diagnostics.push({
        name: 'Global hooks',
        status: 'warn',
        message: 'not configured',
        path: settingsPath.replace(homedir(), '~'),
        suggestion: 'Run: tbd setup --auto',
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
        suggestion: 'Run: tbd setup --auto',
      });
    } else {
      diagnostics.push({
        name: 'Project hooks',
        status: 'warn',
        message: 'not configured',
        path: projectSettingsRelPath,
        suggestion: 'Run: tbd setup --auto',
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
        suggestion: 'Run: tbd setup --auto',
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
    let removedGlobalScript = false;
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
        // Matches both old 'tbd prime' only and new 'tbd-session.sh'
        const filterHooks = (arr: { hooks?: { command?: string }[] }[] | undefined) => {
          if (!arr) return undefined;
          return arr.filter(
            (h) =>
              !h.hooks?.some(
                (hook) =>
                  (hook.command?.includes('tbd prime') ?? false) ||
                  (hook.command?.includes('tbd-session.sh') ?? false) ||
                  (hook.command?.includes('ensure-tbd-cli.sh') ?? false),
              ),
          );
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

    // Remove global tbd scripts (both new and legacy)
    const tbdSessionScript = join(homedir(), '.claude', 'scripts', 'tbd-session.sh');
    const legacyTbdScript = join(homedir(), '.claude', 'scripts', 'ensure-tbd-cli.sh');
    try {
      await rm(tbdSessionScript);
      removedGlobalScript = true;
    } catch {
      // Script doesn't exist
    }
    try {
      await rm(legacyTbdScript);
      removedGlobalScript = true;
    } catch {
      // Script doesn't exist
    }

    // Remove skill file from project
    try {
      await rm(skillPath);
      removedSkill = true;
    } catch {
      // Skill file doesn't exist
    }

    // Report what was removed
    if (removedGlobalHooks || removedGlobalScript) {
      this.output.success('Removed global hooks and script from Claude Code');
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

    const cwd = process.cwd();
    const projectClaudeDir = join(cwd, '.claude');
    const projectSettingsPath = join(projectClaudeDir, 'settings.json');

    // Check if project has .claude/ directory - if so, install hooks there
    let hasProjectClaude = false;
    try {
      await access(projectClaudeDir);
      hasProjectClaude = true;
    } catch {
      // Project doesn't have .claude/ directory
    }

    try {
      // Note: Legacy script/hook cleanup is now done in SetupAutoHandler.run()
      // before any integration-specific setup runs. This ensures cleanup happens
      // regardless of which coding agents are detected.

      // Determine where to install session hooks and script
      // If project has .claude/, install there; otherwise use global ~/.claude/
      const targetSettingsPath = hasProjectClaude ? projectSettingsPath : settingsPath;
      const targetScriptsDir = hasProjectClaude
        ? join(projectClaudeDir, 'scripts')
        : join(homedir(), '.claude', 'scripts');

      // Install session hooks (SessionStart, PreCompact)
      await mkdir(dirname(targetSettingsPath), { recursive: true });

      let settings: Record<string, unknown> = {};
      try {
        await access(targetSettingsPath);
        const content = await readFile(targetSettingsPath, 'utf-8');
        settings = JSON.parse(content) as Record<string, unknown>;
      } catch {
        // File doesn't exist, start fresh
      }

      // Merge hooks properly - append new hooks to existing arrays rather than overwriting
      const existingHooks = (settings.hooks as Record<string, unknown[]>) || {};
      const newHooks = CLAUDE_GLOBAL_HOOKS.hooks as Record<string, unknown[]>;
      const mergedHooks: Record<string, unknown[]> = { ...existingHooks };

      for (const [hookType, hookEntries] of Object.entries(newHooks)) {
        if (mergedHooks[hookType]) {
          // Filter out any existing tbd-session.sh hooks before adding new ones
          const filtered = (mergedHooks[hookType] as { hooks?: { command?: string }[] }[]).filter(
            (entry) => !entry.hooks?.some((h) => h.command?.includes('tbd-session.sh')),
          );
          mergedHooks[hookType] = [...filtered, ...hookEntries];
        } else {
          mergedHooks[hookType] = hookEntries;
        }
      }
      settings.hooks = mergedHooks;

      await writeFile(targetSettingsPath, JSON.stringify(settings, null, 2) + '\n');
      this.output.success(
        hasProjectClaude
          ? 'Installed session hooks to project .claude/settings.json'
          : 'Installed global hooks for Claude Code',
      );

      // Install tbd-session.sh script
      await mkdir(targetScriptsDir, { recursive: true });

      // Main script: tbd-session.sh (ensures tbd + runs prime)
      const tbdSessionScript = join(targetScriptsDir, 'tbd-session.sh');
      await writeFile(tbdSessionScript, TBD_SESSION_SCRIPT);
      await chmod(tbdSessionScript, 0o755);

      // Clean up legacy scripts from the target location
      const legacyScripts = ['ensure-tbd-cli.sh', 'setup-tbd.sh', 'ensure-tbd.sh'];
      for (const script of legacyScripts) {
        try {
          await rm(join(targetScriptsDir, script));
        } catch {
          // Script doesn't exist, ignore
        }
      }

      this.output.success(
        hasProjectClaude
          ? 'Installed tbd session script to project .claude/scripts/'
          : 'Installed global tbd session script',
      );

      // Install project-local PostToolUse hooks in .claude/settings.json
      const hookScriptPath = join(projectClaudeDir, 'hooks', 'tbd-closing-reminder.sh');

      // Read existing project settings if present (may already have session hooks if hasProjectClaude)
      let projectSettings: Record<string, unknown> = {};
      try {
        await access(projectSettingsPath);
        const content = await readFile(projectSettingsPath, 'utf-8');
        projectSettings = JSON.parse(content) as Record<string, unknown>;
        // Backup existing settings (only if we haven't already written to it)
        if (!hasProjectClaude) {
          await writeFile(projectSettingsPath + '.bak', content);
        }
      } catch {
        // File doesn't exist, start fresh
      }

      // Merge project hooks (preserving existing hooks including session hooks if added above)
      const existingProjectHooks = (projectSettings.hooks as Record<string, unknown>) || {};
      projectSettings.hooks = {
        ...existingProjectHooks,
        ...CLAUDE_PROJECT_HOOKS.hooks,
      };

      // Manage gh CLI SessionStart hook based on use_gh_cli config setting
      const useGhCli = await this.getUseGhCliSetting();
      const projectMergedHooks = projectSettings.hooks as Record<string, unknown>;
      let sessionStartEntries =
        (projectMergedHooks.SessionStart as Record<string, unknown>[]) || [];

      if (useGhCli) {
        // Add gh CLI hook if not already present
        const hasGhCliHook = sessionStartEntries.some((h: Record<string, unknown>) =>
          (h.hooks as { command?: string }[])?.some((hook) =>
            hook.command?.includes(GH_CLI_HOOK_COMMAND_PATTERN),
          ),
        );
        if (!hasGhCliHook) {
          sessionStartEntries = [...sessionStartEntries, GH_CLI_HOOK_ENTRY];
        }

        // Install the script file
        const ghScriptsDir = join(cwd, '.claude', 'scripts');
        await mkdir(ghScriptsDir, { recursive: true });
        const ghScriptPath = join(ghScriptsDir, 'ensure-gh-cli.sh');
        const ghScriptContent = await loadBundledScript('ensure-gh-cli.sh');
        await writeFile(ghScriptPath, ghScriptContent);
        await chmod(ghScriptPath, 0o755);
        this.output.success('Installed gh CLI setup script');
      } else {
        // Remove gh CLI hook entries
        sessionStartEntries = sessionStartEntries.filter(
          (h: Record<string, unknown>) =>
            !(h.hooks as { command?: string }[])?.some((hook) =>
              hook.command?.includes(GH_CLI_HOOK_COMMAND_PATTERN),
            ),
        );

        // Remove the script file
        const ghScriptPath = join(cwd, '.claude', 'scripts', 'ensure-gh-cli.sh');
        try {
          await rm(ghScriptPath);
          this.output.success('Removed gh CLI setup script');
        } catch {
          // Script doesn't exist, ignore
        }
      }

      if (sessionStartEntries.length > 0) {
        projectMergedHooks.SessionStart = sessionStartEntries;
      } else {
        delete projectMergedHooks.SessionStart;
      }

      await mkdir(dirname(projectSettingsPath), { recursive: true });
      await writeFile(projectSettingsPath, JSON.stringify(projectSettings, null, 2) + '\n');
      this.output.success('Installed project hooks');

      // Add .claude/.gitignore to ignore backup files
      // NOTE: Pattern re-addition is intentional - see comment in initializeTbd
      const claudeGitignorePath = join(cwd, '.claude', '.gitignore');
      const claudeGitignoreResult = await ensureGitignorePatterns(claudeGitignorePath, [
        '# Backup files',
        '*.bak',
      ]);
      if (claudeGitignoreResult.created) {
        this.output.success('Created .claude/.gitignore');
      } else if (claudeGitignoreResult.added.length > 0) {
        this.output.success('Updated .claude/.gitignore');
      }
      // else: file is up-to-date, no message needed

      // Install hook script
      await mkdir(dirname(hookScriptPath), { recursive: true });
      await writeFile(hookScriptPath, TBD_CLOSE_PROTOCOL_SCRIPT);
      await chmod(hookScriptPath, 0o755);
      this.output.success('Installed sync reminder hook script');

      // Install skill file in project (with shortcut directory appended)
      await mkdir(dirname(skillPath), { recursive: true });
      let skillContent = await loadSkillContent();
      const directory = await getShortcutDirectory(this.ctx.quiet);
      if (directory) {
        skillContent = skillContent.trimEnd() + '\n\n' + directory;
      }
      // Insert DO NOT EDIT marker after frontmatter (formatted to match flowmark output)
      const markerComment =
        "<!-- DO NOT EDIT: Generated by tbd setup.\nRun 'tbd setup' to update.\n-->";
      skillContent = insertAfterFrontmatter(skillContent, markerComment);
      // Ensure file ends with newline
      skillContent = skillContent.trimEnd() + '\n';
      await writeFile(skillPath, skillContent);
      this.output.success('Installed skill file');
      this.output.info(`  ${skillPath}`);

      this.output.info('');
      this.output.info('What was installed:');
      if (hasProjectClaude) {
        this.output.info(
          '  - Session hooks: SessionStart and PreCompact run `tbd prime` (project-level)',
        );
        this.output.info('  - Session script: .claude/scripts/tbd-session.sh');
      } else {
        this.output.info('  - Global hooks: SessionStart and PreCompact run `tbd prime`');
        this.output.info('  - Global script: ~/.claude/scripts/tbd-session.sh');
      }
      this.output.info('  - Project hooks: PostToolUse reminds about `tbd sync` after git push');
      this.output.info('  - Project skill: .claude/skills/tbd/SKILL.md');
    } catch (error) {
      throw new CLIError(`Failed to install: ${(error as Error).message}`);
    }
  }

  /**
   * Read the use_gh_cli setting from config. Defaults to true if not set or if
   * tbd is not yet initialized (so fresh setup installs gh CLI by default).
   */
  private async getUseGhCliSetting(): Promise<boolean> {
    try {
      const tbdRoot = await findTbdRoot(process.cwd());
      if (!tbdRoot) return true;
      const config = await readConfig(tbdRoot);
      return config.settings.use_gh_cli ?? true;
    } catch {
      return true;
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
          suggestion: 'Run: tbd setup --auto',
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
        suggestion: 'Run: tbd setup --auto',
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

      const tbdSection = await getCodexTbdSection(this.ctx.quiet);

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
        const newAgentsFile = await getCodexNewAgentsFile(this.ctx.quiet);
        await writeFile(agentsPath, newAgentsFile);
        this.output.success('Created new AGENTS.md with tbd integration');
      }

      this.output.info(`  File: ${agentsPath}`);
      this.output.info('');
      this.output.info('Codex and other AGENTS.md-compatible tools will automatically');
      this.output.info('read this file on session start.');
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

// ============================================================================
// Setup Default Handler (for --auto and --interactive modes)
// ============================================================================

interface SetupDefaultOptions {
  auto?: boolean;
  interactive?: boolean;
  fromBeads?: boolean;
  prefix?: string;
  ghCli?: boolean; // Commander sets to false when --no-gh-cli is passed
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
      throw new CLIError('Not a git repository. Run `git init` first.');
    }

    // Check current state
    const hasTbd = await isInitialized(cwd);
    const hasBeads = await pathExists(join(cwd, '.beads'));

    // Validate --from-beads flag requires .beads/ directory
    if (options.fromBeads && !hasBeads) {
      throw new CLIError(
        'The --from-beads flag requires a .beads/ directory to migrate from.\n' +
          'For fresh setup, use: tbd setup --auto --prefix=<name>',
      );
    }

    console.log('Checking repository...');
    console.log(`  ${colors.success('✓')} Git repository detected`);

    if (hasTbd) {
      // Already initialized flow - check for migrations
      const { config, migrated, changes } = await readConfigWithMigration(cwd);
      console.log(`  ${colors.success('✓')} tbd initialized (prefix: ${config.display.id_prefix})`);

      // Apply --no-gh-cli flag to config if specified
      let needsConfigWrite = migrated;
      if (options.ghCli === false && config.settings.use_gh_cli !== false) {
        config.settings.use_gh_cli = false;
        needsConfigWrite = true;
      }

      // Persist config if migrated or --no-gh-cli was applied
      if (needsConfigWrite) {
        await writeConfig(cwd, config);
        if (migrated) {
          console.log(`  ${colors.success('✓')} Config migrated to latest format`);
          for (const change of changes) {
            console.log(`      ${colors.dim(change)}`);
          }
        }
        if (options.ghCli === false) {
          console.log(`  ${colors.success('✓')} Disabled gh CLI auto-setup`);
        }
      }

      console.log('');
      await this.handleAlreadyInitialized(cwd, isAutoMode);
    } else if ((hasBeads || options.fromBeads) && !options.prefix) {
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

    // Get prefix from beads config or use provided --prefix
    const beadsPrefix = await getBeadsPrefix(cwd);
    const prefix = options.prefix ?? beadsPrefix;

    if (!prefix) {
      throw new CLIError(
        'Could not read prefix from beads config.\n' +
          'Please specify a prefix (2-4 letters recommended):\n' +
          '  tbd setup --auto --prefix=tbd',
      );
    }

    if (!isValidPrefix(prefix)) {
      throw new CLIError(
        'Invalid prefix format.\n' +
          'Prefix must be 1-10 lowercase alphanumeric characters, starting with a letter.\n' +
          'Recommended: 2-4 letters for clear, readable issue IDs.\n' +
          'Please specify a valid prefix:\n' +
          '  tbd setup --auto --prefix=tbd',
      );
    }

    // Initialize tbd first
    await this.initializeTbd(cwd, prefix);

    // Apply --no-gh-cli flag to newly created config
    if (options.ghCli === false) {
      const config = await readConfig(cwd);
      config.settings.use_gh_cli = false;
      await writeConfig(cwd, config);
      console.log(`  ${colors.success('✓')} Disabled gh CLI auto-setup`);
    }

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

    this.showWhatsNext(colors);

    // Show dashboard after setup
    spawnSync('tbd', ['prime'], { stdio: 'inherit' });

    // Mark welcome as seen since the user got the full onboarding experience
    try {
      await markWelcomeSeen(cwd);
    } catch {
      // Non-critical: don't fail setup if state write fails
    }
  }

  private async handleFreshSetup(
    cwd: string,
    isAutoMode: boolean,
    options: SetupDefaultOptions,
  ): Promise<void> {
    const colors = this.output.getColors();

    // Require --prefix for fresh setup (no auto-detection)
    const prefix = options.prefix;

    if (!prefix) {
      throw new CLIError(
        '--prefix is required for tbd setup --auto\n\n' +
          'The --prefix flag specifies your project name for issue IDs.\n' +
          'Use a short 2-4 letter prefix so issue IDs stand out clearly.\n\n' +
          'Example:\n' +
          '  tbd setup --auto --prefix=tbd    # Issues: tbd-a1b2\n' +
          '  tbd setup --auto --prefix=myp    # Issues: myp-c3d4\n\n' +
          'Note: If migrating from beads, the prefix is automatically read from your beads config.',
      );
    }

    if (!isValidPrefix(prefix)) {
      throw new CLIError(
        'Invalid prefix format.\n' +
          'Prefix must be 1-10 lowercase alphanumeric characters, starting with a letter.\n' +
          'Recommended: 2-4 letters for clear, readable issue IDs.\n\n' +
          'Example:\n' +
          '  tbd setup --auto --prefix=tbd',
      );
    }

    console.log(`Initializing with prefix "${prefix}"...`);

    await this.initializeTbd(cwd, prefix);

    // Apply --no-gh-cli flag to newly created config
    if (options.ghCli === false) {
      const config = await readConfig(cwd);
      config.settings.use_gh_cli = false;
      await writeConfig(cwd, config);
      console.log(`  ${colors.success('✓')} Disabled gh CLI auto-setup`);
    }

    console.log('');
    console.log('Configuring integrations...');

    // Configure integrations
    const autoHandler = new SetupAutoHandler(this.cmd);
    await autoHandler.run();

    console.log('');
    console.log(colors.success('Setup complete!'));

    this.showWhatsNext(colors);

    // Show dashboard after setup
    spawnSync('tbd', ['prime'], { stdio: 'inherit' });

    // Mark welcome as seen since the user got the full onboarding experience
    try {
      await markWelcomeSeen(cwd);
    } catch {
      // Non-critical: don't fail setup if state write fails
    }
  }

  /**
   * Show "What's Next" guidance after setup completion.
   * Framed as what users can SAY to get help, not as CLI commands to run.
   */
  private showWhatsNext(colors: ReturnType<typeof this.output.getColors>): void {
    console.log('');
    console.log(colors.bold("WHAT'S NEXT"));
    console.log('');
    console.log('  Try saying things like:');
    console.log('    "There\'s a bug where ..."       → Creates and tracks a bug');
    console.log('    "Let\'s plan a new feature"      → Walks through a planning spec');
    console.log('    "Let\'s work on current issues"  → Shows ready issues to tackle');
    console.log('    "Commit this code"               → Reviews and commits properly');
    console.log('    "Review for best practices"      → Code review with guidelines');
    console.log('');
  }

  private async initializeTbd(cwd: string, prefix: string): Promise<void> {
    const colors = this.output.getColors();

    // 1. Create .tbd/ directory with config.yml
    await initConfig(cwd, VERSION, prefix);
    console.log(`  ${colors.success('✓')} Created .tbd/config.yml`);

    // 2. Create/update .tbd/.gitignore (idempotent)
    // NOTE: Pattern re-addition is intentional - these are tool-managed files
    // that are regenerated from the npm package on every setup. If a user removes
    // a pattern, we re-add it because tracking these directories in git would
    // cause noise on every tbd upgrade.
    const tbdGitignoreResult = await ensureGitignorePatterns(join(cwd, TBD_DIR, '.gitignore'), [
      '# Synced documentation cache (regenerated by tbd docs --refresh)',
      'docs/',
      '',
      '# Hidden worktree for tbd-sync branch',
      `${WORKTREE_DIR_NAME}/`,
      '',
      '# Data sync directory (only exists in worktree)',
      `${DATA_SYNC_DIR_NAME}/`,
      '',
      '# Local state',
      'state.yml',
      '',
      '# Temporary files',
      '*.tmp',
      '*.temp',
    ]);
    if (tbdGitignoreResult.created) {
      console.log(`  ${colors.success('✓')} Created .tbd/.gitignore`);
    } else if (tbdGitignoreResult.added.length > 0) {
      console.log(`  ${colors.success('✓')} Updated .tbd/.gitignore`);
    }
    // else: file is up-to-date, no message needed

    // 3. Initialize worktree for sync branch
    try {
      await initWorktree(cwd);
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

  /**
   * Clean up legacy scripts from project .claude/scripts/ directory.
   * This runs during any setup, regardless of whether Claude Code is detected,
   * since we want to clean up old project-level scripts that are no longer needed.
   */
  private async cleanupLegacyProjectScripts(cwd: string): Promise<string[]> {
    const scriptsDir = join(cwd, '.claude', 'scripts');
    const scriptsRemoved: string[] = [];

    try {
      await access(scriptsDir);
      const entries = await readdir(scriptsDir, { withFileTypes: true });

      for (const entry of entries) {
        if (entry.isFile()) {
          const filename = entry.name;
          // Check against known legacy script names
          if (LEGACY_TBD_SCRIPTS.includes(filename)) {
            try {
              await rm(join(scriptsDir, filename));
              scriptsRemoved.push(filename);
            } catch {
              // Ignore removal errors
            }
          }
        }
      }
    } catch {
      // Scripts directory doesn't exist, nothing to clean
    }

    return scriptsRemoved;
  }

  /**
   * Filter out hook entries that match legacy tbd patterns from project settings.
   */
  private filterLegacyHooks(
    hookList: { hooks?: { command?: string }[] }[],
  ): { hooks?: { command?: string }[] }[] {
    return hookList.filter((entry) => {
      // Check if any hook command matches legacy patterns
      const hasLegacyCommand = entry.hooks?.some((hook) => {
        if (!hook.command) return false;
        return LEGACY_TBD_HOOK_PATTERNS.some((pattern) => pattern.test(hook.command!));
      });
      // Keep entries that DON'T have legacy commands
      return !hasLegacyCommand;
    });
  }

  /**
   * Clean up legacy hooks from project .claude/settings.json.
   * This runs during any setup, regardless of whether Claude Code is detected.
   */
  private async cleanupLegacyProjectHooks(cwd: string): Promise<number> {
    const projectSettingsPath = join(cwd, '.claude', 'settings.json');
    let hooksRemoved = 0;

    try {
      await access(projectSettingsPath);
      const content = await readFile(projectSettingsPath, 'utf-8');
      const settings = JSON.parse(content) as Record<string, unknown>;

      if (settings.hooks) {
        const hooks = settings.hooks as Record<string, unknown>;
        let modified = false;

        for (const hookType of ['SessionStart', 'PreCompact', 'PostToolUse']) {
          if (hooks[hookType]) {
            const hookList = hooks[hookType] as { hooks?: { command?: string }[] }[];
            const filtered = this.filterLegacyHooks(hookList);
            if (filtered.length !== hookList.length) {
              hooksRemoved += hookList.length - filtered.length;
              hooks[hookType] = filtered.length > 0 ? filtered : undefined;
              if (!hooks[hookType]) delete hooks[hookType];
              modified = true;
            }
          }
        }

        if (modified) {
          if (Object.keys(hooks).length === 0) {
            delete settings.hooks;
          }
          await writeFile(projectSettingsPath, JSON.stringify(settings, null, 2) + '\n');
        }
      }
    } catch {
      // Project settings file doesn't exist, nothing to clean
    }

    return hooksRemoved;
  }

  async run(): Promise<void> {
    const colors = this.output.getColors();
    const cwd = process.cwd();
    const results: AutoSetupResult[] = [];

    // Clean up legacy project-level scripts and hooks FIRST,
    // regardless of whether any coding agent is detected.
    // This ensures old tbd scripts are removed even if user switches tools.
    const scriptsRemoved = await this.cleanupLegacyProjectScripts(cwd);
    const hooksRemoved = await this.cleanupLegacyProjectHooks(cwd);
    if (scriptsRemoved.length > 0 || hooksRemoved > 0) {
      const parts = [];
      if (scriptsRemoved.length > 0) parts.push(`${scriptsRemoved.length} script(s)`);
      if (hooksRemoved > 0) parts.push(`${hooksRemoved} hook(s)`);
      console.log(colors.dim(`Cleaned up legacy ${parts.join(' and ')}`));
    }

    // Sync docs using DocSync
    await this.syncDocs(cwd);

    // Detect and set up Claude Code
    const claudeResult = await this.setupClaudeIfDetected(cwd);
    results.push(claudeResult);

    // Detect and set up Codex/AGENTS.md (also used by Cursor since v1.6)
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
      console.log(
        'Install a coding agent (Claude Code, Codex, or any AGENTS.md-compatible tool) and re-run:',
      );
      console.log('  tbd setup --auto');
    }
  }

  /**
   * Sync docs using DocSync.
   * Merges default bundled docs with user's doc_cache config, then syncs.
   * This ensures new bundled docs from tbd updates are added while
   * preserving user's custom sources and overrides.
   */
  private async syncDocs(cwd: string): Promise<void> {
    const colors = this.output.getColors();

    // Read config
    const config = await readConfig(cwd);

    // Merge user's config with defaults (ensures new bundled docs are added)
    const defaults = await generateDefaultDocCacheConfig();
    const currentFiles = config.docs_cache?.files;
    const filesConfig = mergeDocCacheConfig(currentFiles, defaults);

    // Check if config changed (new defaults added)
    const configUpdated =
      !currentFiles ||
      Object.keys(filesConfig).length !== Object.keys(currentFiles).length ||
      Object.keys(filesConfig).some((k) => currentFiles?.[k] !== filesConfig[k]);

    if (configUpdated) {
      config.docs_cache = {
        lookup_path: config.docs_cache?.lookup_path ?? [
          '.tbd/docs/shortcuts/system',
          '.tbd/docs/shortcuts/standard',
        ],
        files: filesConfig,
      };
    }

    // Ensure docs directories exist
    await mkdir(join(cwd, TBD_SHORTCUTS_SYSTEM), { recursive: true });
    await mkdir(join(cwd, TBD_SHORTCUTS_STANDARD), { recursive: true });
    await mkdir(join(cwd, TBD_GUIDELINES_DIR), { recursive: true });
    await mkdir(join(cwd, TBD_TEMPLATES_DIR), { recursive: true });

    // Sync docs
    const sync = new DocSync(cwd, filesConfig);
    const result = await sync.sync();

    // Update last sync time
    await updateLocalState(cwd, {
      last_doc_sync_at: new Date().toISOString(),
    });

    // Write updated config if docs_cache.files was generated
    if (configUpdated) {
      await writeConfig(cwd, config);
      console.log(colors.dim('Generated docs_cache config'));
    }

    // Report sync results
    const total = result.added.length + result.updated.length;
    if (total > 0) {
      console.log(colors.dim(`Synced ${total} doc(s) to ${TBD_DOCS_DIR}/`));
    }
    if (result.removed.length > 0) {
      console.log(colors.dim(`Removed ${result.removed.length} outdated doc(s)`));
    }
    if (result.errors.length > 0) {
      for (const { path, error } of result.errors) {
        console.log(colors.warn(`Warning: ${path}: ${error}`));
      }
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
            // Note: We still run the handler to update the skill file content
            // even if hooks are already installed. This ensures users get the
            // latest skill file when running `tbd setup --auto`.
          }
        }
      }

      // Install/update Claude Code setup (always runs to update skill file)
      const handler = new SetupClaudeHandler(this.cmd);
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
        // Note: We still run the handler to update the AGENTS.md content
        // even if tbd section exists. This ensures users get the latest
        // content when running `tbd setup --auto`.
      }
    }

    try {
      // Install/update Codex AGENTS.md (always runs to update content)
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
  .option('--prefix <name>', 'Project prefix for issue IDs (required for fresh setup)')
  .option('--no-gh-cli', 'Disable automatic GitHub CLI installation hook')
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
    console.log('Usage: tbd setup [options]');
    console.log('');
    console.log('Initialize tbd and configure agent integrations.');
    console.log('');
    console.log('Modes (one required):');
    console.log(
      '  --auto              Non-interactive mode with smart defaults (for agents/scripts)',
    );
    console.log('  --interactive       Interactive mode with prompts (for humans)');
    console.log('  --from-beads        Migrate from Beads to tbd (implies --auto)');
    console.log('');
    console.log('Options:');
    console.log('  --prefix <name>     Project prefix for issue IDs (e.g., "tbd", "myapp")');
    console.log('  --no-gh-cli         Disable automatic GitHub CLI installation hook');
    console.log('');
    console.log('Examples:');
    console.log('  tbd setup --auto --prefix=tbd   # Full automatic setup with prefix');
    console.log('  tbd setup --from-beads          # Migrate from Beads (uses beads prefix)');
    console.log('  tbd setup --interactive         # Interactive setup with prompts');
    console.log('');
    console.log('For surgical initialization without integrations, see: tbd init --help');
  });
