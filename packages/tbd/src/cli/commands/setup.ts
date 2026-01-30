/**
 * `tbd setup` - Configure tbd integration with editors and tools.
 *
 * Requires a git repository. All setup artifacts (.tbd/, .claude/) are placed
 * at the git root, adjacent to .git/. Installation is always project-local —
 * there is no global/user-level install.
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
  markWelcomeSeen,
} from '../../file/config.js';
import { syncDocsWithDefaults } from '../../file/doc-sync.js';
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
import { initWorktree, isInGitRepo, findGitRoot, checkWorktreeHealth } from '../../file/git.js';
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
 * Script to ensure tbd CLI is installed and run tbd prime.
 * Installed to project .claude/scripts/tbd-session.sh.
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

# Get npm global bin directory (if npm is available)
NPM_GLOBAL_BIN=""
if command -v npm &> /dev/null; then
    NPM_PREFIX=$(npm config get prefix 2>/dev/null)
    if [ -n "$NPM_PREFIX" ] && [ -d "$NPM_PREFIX/bin" ]; then
        NPM_GLOBAL_BIN="$NPM_PREFIX/bin"
    fi
fi

# Add common binary locations to PATH (persists for entire script)
# Include npm global bin if found
export PATH="$NPM_GLOBAL_BIN:$HOME/.local/bin:$HOME/bin:/usr/local/bin:$PATH"

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
        npm install -g get-tbd 2>/dev/null || {
            # If global install fails (permissions), try local install
            echo "[tbd] Global npm install failed, trying user install..."
            mkdir -p ~/.local/bin
            npm install --prefix ~/.local get-tbd
            # Create symlink if needed
            if [ -f ~/.local/node_modules/.bin/tbd ]; then
                ln -sf ~/.local/node_modules/.bin/tbd ~/.local/bin/tbd
            fi
        }
    elif command -v pnpm &> /dev/null; then
        echo "[tbd] Installing via pnpm..."
        pnpm add -g get-tbd
    elif command -v yarn &> /dev/null; then
        echo "[tbd] Installing via yarn..."
        yarn global add get-tbd
    else
        echo "[tbd] ERROR: No package manager found (npm, pnpm, or yarn required)"
        echo "[tbd] Please install Node.js and npm, then run: npm install -g get-tbd"
        return 1
    fi

    # Verify installation
    if command -v tbd &> /dev/null; then
        echo "[tbd] Successfully installed to $(which tbd)"
        return 0
    else
        echo "[tbd] WARNING: tbd installed but not found in PATH"
        echo "[tbd] Checking common locations..."
        # Try to find and add to path (include npm global bin)
        for dir in "$NPM_GLOBAL_BIN" ~/.local/bin ~/.local/node_modules/.bin /usr/local/bin; do
            if [ -n "$dir" ] && [ -x "$dir/tbd" ]; then
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
 * Claude Code session hooks configuration.
 * Always uses project-relative paths so hooks work in any environment
 * (local dev, Claude Code Cloud, etc.).
 */
const CLAUDE_SESSION_HOOKS = {
  hooks: {
    SessionStart: [
      {
        matcher: '',
        hooks: [{ type: 'command', command: 'bash .claude/scripts/tbd-session.sh' }],
      },
    ],
    PreCompact: [
      {
        matcher: '',
        hooks: [{ type: 'command', command: 'bash .claude/scripts/tbd-session.sh --brief' }],
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
  private projectDir: string | undefined;

  setProjectDir(dir: string): void {
    this.projectDir = dir;
  }

  async run(options: SetupClaudeOptions): Promise<void> {
    const settingsPath = join(homedir(), '.claude', 'settings.json');
    const cwd = this.projectDir ?? process.cwd();
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

  private async checkClaudeSetup(_settingsPath: string, skillPath: string): Promise<void> {
    const cwd = this.projectDir ?? process.cwd();
    let sessionScriptInstalled = false;
    let sessionStartHook = false;
    let preCompactHook = false;
    let postToolUseHook = false;
    let hookScriptInstalled = false;
    let skillInstalled = false;

    // All hooks and scripts are project-local in .claude/
    const projectSettingsPath = join(cwd, '.claude', 'settings.json');
    const sessionScript = join(cwd, '.claude', 'scripts', 'tbd-session.sh');
    const hookScriptPath = join(cwd, '.claude', 'hooks', 'tbd-closing-reminder.sh');

    // Check for tbd-session.sh script
    try {
      await access(sessionScript);
      sessionScriptInstalled = true;
    } catch {
      // Script doesn't exist
    }

    // Check hooks in project settings
    try {
      await access(projectSettingsPath);
      const content = await readFile(projectSettingsPath, 'utf-8');
      const settings = JSON.parse(content) as Record<string, unknown>;
      const hooks = settings.hooks as Record<string, unknown> | undefined;

      if (hooks) {
        const sessionStart = hooks.SessionStart as { hooks?: { command?: string }[] }[];
        const preCompact = hooks.PreCompact as { hooks?: { command?: string }[] }[];
        const postToolUse = hooks.PostToolUse as { hooks?: { command?: string }[] }[];

        sessionStartHook =
          sessionStart?.some((h) =>
            h.hooks?.some(
              (hook) =>
                (hook.command?.includes('tbd prime') ?? false) ||
                (hook.command?.includes('tbd-session.sh') ?? false),
            ),
          ) ?? false;

        preCompactHook =
          preCompact?.some((h) =>
            h.hooks?.some(
              (hook) =>
                (hook.command?.includes('tbd prime') ?? false) ||
                (hook.command?.includes('tbd-session.sh') ?? false),
            ),
          ) ?? false;

        postToolUseHook =
          postToolUse?.some((h) =>
            h.hooks?.some((hook) => hook.command?.includes('tbd-closing-reminder')),
          ) ?? false;
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

    const sessionHooksInstalled = sessionStartHook && preCompactHook && sessionScriptInstalled;
    const projectHooksInstalled = postToolUseHook && hookScriptInstalled;

    // Check skill file in project
    try {
      await access(skillPath);
      skillInstalled = true;
    } catch {
      // Skill file doesn't exist
    }

    const fullyInstalled = sessionHooksInstalled && projectHooksInstalled && skillInstalled;

    // Build diagnostic results for text output
    const diagnostics: DiagnosticResult[] = [];
    const settingsRelPath = '.claude/settings.json';

    // Session hooks diagnostic
    if (sessionHooksInstalled) {
      diagnostics.push({
        name: 'Session hooks',
        status: 'ok',
        message: 'SessionStart, PreCompact',
        path: settingsRelPath,
      });
    } else if (sessionStartHook || preCompactHook) {
      diagnostics.push({
        name: 'Session hooks',
        status: 'warn',
        message: 'partially configured',
        path: settingsRelPath,
        suggestion: 'Run: tbd setup --auto',
      });
    } else {
      diagnostics.push({
        name: 'Session hooks',
        status: 'warn',
        message: 'not configured',
        path: settingsRelPath,
        suggestion: 'Run: tbd setup --auto',
      });
    }

    // Project hooks diagnostic
    if (projectHooksInstalled) {
      diagnostics.push({
        name: 'Project hooks',
        status: 'ok',
        message: 'PostToolUse sync reminder',
        path: settingsRelPath,
      });
    } else if (postToolUseHook || hookScriptInstalled) {
      diagnostics.push({
        name: 'Project hooks',
        status: 'warn',
        message: 'partially configured',
        path: settingsRelPath,
        suggestion: 'Run: tbd setup --auto',
      });
    } else {
      diagnostics.push({
        name: 'Project hooks',
        status: 'warn',
        message: 'not configured',
        path: settingsRelPath,
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
        sessionHooks: {
          installed: sessionHooksInstalled,
          sessionStart: sessionStartHook,
          preCompact: preCompactHook,
          script: sessionScriptInstalled,
          path: projectSettingsPath,
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

  private async removeClaudeSetup(_settingsPath: string, skillPath: string): Promise<void> {
    const cwd = this.projectDir ?? process.cwd();
    let removedHooks = false;
    let removedScripts = false;
    let removedSkill = false;

    // Remove hooks from project .claude/settings.json
    const projectSettingsPath = join(cwd, '.claude', 'settings.json');
    const hookScriptPath = join(cwd, '.claude', 'hooks', 'tbd-closing-reminder.sh');

    try {
      await access(projectSettingsPath);
      const content = await readFile(projectSettingsPath, 'utf-8');
      const settings = JSON.parse(content) as Record<string, unknown>;

      if (settings.hooks) {
        const hooks = settings.hooks as Record<string, unknown>;

        // Remove all tbd hooks (SessionStart, PreCompact, PostToolUse)
        const filterTbdHooks = (arr: { hooks?: { command?: string }[] }[] | undefined) => {
          if (!arr) return undefined;
          return arr.filter(
            (h) =>
              !h.hooks?.some(
                (hook) =>
                  (hook.command?.includes('tbd-closing-reminder') ?? false) ||
                  (hook.command?.includes('tbd-session.sh') ?? false) ||
                  (hook.command?.includes('tbd prime') ?? false),
              ),
          );
        };

        for (const hookType of ['PostToolUse', 'SessionStart', 'PreCompact'] as const) {
          const filtered = filterTbdHooks(hooks[hookType] as { hooks?: { command?: string }[] }[]);
          if (filtered?.length === 0) delete hooks[hookType];
          else if (filtered) hooks[hookType] = filtered;
        }

        if (Object.keys(hooks).length === 0) {
          delete settings.hooks;
        }

        await writeFile(projectSettingsPath, JSON.stringify(settings, null, 2) + '\n');
        removedHooks = true;
      }
    } catch {
      // Project settings file doesn't exist
    }

    // Remove hook script
    try {
      await rm(hookScriptPath);
      removedHooks = true;
    } catch {
      // Hook script doesn't exist
    }

    // Remove tbd scripts from project (and legacy global locations for cleanup)
    const scriptsToRemove = [
      join(cwd, '.claude', 'scripts', 'tbd-session.sh'),
      // Legacy global locations - clean up from older installs
      join(homedir(), '.claude', 'scripts', 'tbd-session.sh'),
      join(homedir(), '.claude', 'scripts', 'ensure-tbd-cli.sh'),
    ];
    for (const script of scriptsToRemove) {
      try {
        await rm(script);
        removedScripts = true;
      } catch {
        // Script doesn't exist
      }
    }

    // Also clean up legacy hooks from global settings (from older installs)
    const globalSettingsPath = join(homedir(), '.claude', 'settings.json');
    try {
      await access(globalSettingsPath);
      const content = await readFile(globalSettingsPath, 'utf-8');
      const settings = JSON.parse(content) as Record<string, unknown>;

      if (settings.hooks) {
        const hooks = settings.hooks as Record<string, unknown>;
        const filterLegacy = (arr: { hooks?: { command?: string }[] }[] | undefined) => {
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

        let modified = false;
        for (const hookType of ['SessionStart', 'PreCompact'] as const) {
          if (hooks[hookType]) {
            const filtered = filterLegacy(hooks[hookType] as { hooks?: { command?: string }[] }[]);
            if (filtered?.length !== (hooks[hookType] as unknown[])?.length) {
              modified = true;
              if (filtered?.length === 0) delete hooks[hookType];
              else if (filtered) hooks[hookType] = filtered;
            }
          }
        }

        if (modified) {
          if (Object.keys(hooks).length === 0) delete settings.hooks;
          await writeFile(globalSettingsPath, JSON.stringify(settings, null, 2) + '\n');
          removedHooks = true;
        }
      }
    } catch {
      // Global settings file doesn't exist
    }

    // Remove skill file from project
    try {
      await rm(skillPath);
      removedSkill = true;
    } catch {
      // Skill file doesn't exist
    }

    // Report what was removed
    if (removedHooks || removedScripts) {
      this.output.success('Removed hooks and scripts');
    } else {
      this.output.info('No hooks to remove');
    }

    if (removedSkill) {
      this.output.success('Removed skill file');
    } else {
      this.output.info('No skill file to remove');
    }
  }

  private async installClaudeSetup(_settingsPath: string, skillPath: string): Promise<void> {
    if (
      this.checkDryRun('Would install Claude Code hooks and skill file', {
        settingsPath: _settingsPath,
        skillPath,
      })
    ) {
      return;
    }

    const cwd = this.projectDir ?? process.cwd();
    const projectClaudeDir = join(cwd, '.claude');
    const projectSettingsPath = join(projectClaudeDir, 'settings.json');
    const scriptsDir = join(projectClaudeDir, 'scripts');

    try {
      // Note: Legacy script/hook cleanup is now done in SetupAutoHandler.run()
      // before any integration-specific setup runs. This ensures cleanup happens
      // regardless of which coding agents are detected.

      // Always install to project .claude/ directory (create if needed).
      // This avoids confusion between global vs project-level settings and
      // ensures hooks work in any environment (local dev, Claude Code Cloud, etc.).
      await mkdir(projectClaudeDir, { recursive: true });

      // Read existing project settings
      let settings: Record<string, unknown> = {};
      try {
        await access(projectSettingsPath);
        const content = await readFile(projectSettingsPath, 'utf-8');
        settings = JSON.parse(content) as Record<string, unknown>;
      } catch {
        // File doesn't exist, start fresh
      }

      // Merge session hooks (SessionStart, PreCompact) - append without overwriting
      const existingHooks = (settings.hooks as Record<string, unknown[]>) || {};
      const newHooks = CLAUDE_SESSION_HOOKS.hooks as Record<string, unknown[]>;
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

      // Merge PostToolUse hooks
      const projectHooks = CLAUDE_PROJECT_HOOKS.hooks as Record<string, unknown[]>;
      for (const [hookType, hookEntries] of Object.entries(projectHooks)) {
        mergedHooks[hookType] ??= hookEntries;
      }

      settings.hooks = mergedHooks;

      // Manage gh CLI SessionStart hook based on use_gh_cli config setting
      const useGhCli = await this.getUseGhCliSetting();
      const finalHooks = settings.hooks as Record<string, unknown>;
      let sessionStartEntries = (finalHooks.SessionStart as Record<string, unknown>[]) || [];

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
        await mkdir(scriptsDir, { recursive: true });
        const ghScriptPath = join(scriptsDir, 'ensure-gh-cli.sh');
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
        const ghScriptPath = join(scriptsDir, 'ensure-gh-cli.sh');
        try {
          await rm(ghScriptPath);
          this.output.success('Removed gh CLI setup script');
        } catch {
          // Script doesn't exist, ignore
        }
      }

      if (sessionStartEntries.length > 0) {
        finalHooks.SessionStart = sessionStartEntries;
      } else {
        delete finalHooks.SessionStart;
      }

      // Write all hooks to project settings in a single write
      await writeFile(projectSettingsPath, JSON.stringify(settings, null, 2) + '\n');
      this.output.success('Installed hooks to .claude/settings.json');

      // Install tbd-session.sh script
      await mkdir(scriptsDir, { recursive: true });
      const tbdSessionScript = join(scriptsDir, 'tbd-session.sh');
      await writeFile(tbdSessionScript, TBD_SESSION_SCRIPT);
      await chmod(tbdSessionScript, 0o755);

      // Clean up legacy scripts
      const legacyScripts = ['ensure-tbd-cli.sh', 'setup-tbd.sh', 'ensure-tbd.sh'];
      for (const script of legacyScripts) {
        try {
          await rm(join(scriptsDir, script));
        } catch {
          // Script doesn't exist, ignore
        }
      }

      this.output.success('Installed tbd session script to .claude/scripts/');

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
      const hookScriptPath = join(projectClaudeDir, 'hooks', 'tbd-closing-reminder.sh');
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
      this.output.info('  - Session hooks: SessionStart and PreCompact run `tbd prime`');
      this.output.info('  - Session script: .claude/scripts/tbd-session.sh');
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
  private projectDir: string | undefined;

  setProjectDir(dir: string): void {
    this.projectDir = dir;
  }

  async run(options: SetupCodexOptions): Promise<void> {
    const cwd = this.projectDir ?? process.cwd();
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
 * 2. Resolve to git root → All paths relative to .git/ parent
 * 3. Has .tbd/ → Already initialized, check/update integrations
 * 4. Has .beads/ → Beads migration flow
 * 5. Fresh repo → Initialize + configure integrations
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

    // Check if in git repo and resolve to git root
    const inGitRepo = await isInGitRepo(cwd);
    if (!inGitRepo) {
      throw new CLIError('Not a git repository. Run `git init` first.');
    }

    // Resolve to git root so .tbd/ and .claude/ are always adjacent to .git/
    const gitRoot = await findGitRoot(cwd);
    if (!gitRoot) {
      throw new CLIError('Could not determine git repository root.');
    }

    // Use git root as the working directory for all setup operations
    const projectDir = gitRoot;

    // Check current state
    const hasTbd = await isInitialized(projectDir);
    const hasBeads = await pathExists(join(projectDir, '.beads'));

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
      const { config, migrated, changes } = await readConfigWithMigration(projectDir);
      console.log(`  ${colors.success('✓')} tbd initialized (prefix: ${config.display.id_prefix})`);

      // Apply --no-gh-cli flag to config if specified
      let needsConfigWrite = migrated;
      if (options.ghCli === false && config.settings.use_gh_cli !== false) {
        config.settings.use_gh_cli = false;
        needsConfigWrite = true;
      }

      // Persist config if migrated or --no-gh-cli was applied
      if (needsConfigWrite) {
        await writeConfig(projectDir, config);
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
      await this.handleAlreadyInitialized(projectDir, isAutoMode);
    } else if ((hasBeads || options.fromBeads) && !options.prefix) {
      // Beads migration flow (unless prefix override given)
      console.log(`  ${colors.dim('✗')} tbd not initialized`);
      console.log(`  ${colors.warn('!')} Beads detected (.beads/ directory found)`);
      console.log('');
      await this.handleBeadsMigration(projectDir, isAutoMode, options);
    } else {
      // Fresh setup flow
      console.log(`  ${colors.dim('✗')} tbd not initialized`);
      console.log('');
      await this.handleFreshSetup(projectDir, isAutoMode, options);
    }
  }

  private async handleAlreadyInitialized(projectDir: string, _isAutoMode: boolean): Promise<void> {
    const colors = this.output.getColors();

    // Ensure .tbd/.gitignore is up-to-date (may have new patterns from newer versions)
    const tbdGitignoreResult = await ensureGitignorePatterns(
      join(projectDir, TBD_DIR, '.gitignore'),
      [
        '# Synced documentation cache (regenerated by tbd sync --docs)',
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
        '# Migration backups (local only, not synced)',
        'backups/',
        '',
        '# Temporary files',
        '*.tmp',
        '*.temp',
      ],
    );
    if (tbdGitignoreResult.created) {
      console.log(`  ${colors.success('✓')} Created .tbd/.gitignore`);
    } else if (tbdGitignoreResult.added.length > 0) {
      console.log(`  ${colors.success('✓')} Updated .tbd/.gitignore with new patterns`);
    }

    console.log('Checking integrations...');

    // Use SetupAutoHandler to configure integrations
    const autoHandler = new SetupAutoHandler(this.cmd);
    await autoHandler.run(projectDir);

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
    await autoHandler.run(cwd);

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
    await autoHandler.run(cwd);

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
      '# Synced documentation cache (regenerated by tbd sync --docs)',
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
      '# Migration backups (local only, not synced)',
      'backups/',
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

      // Verify worktree health after creation (prevents silent failures)
      const health = await checkWorktreeHealth(cwd);
      if (health.valid) {
        console.log(`  ${colors.success('✓')} Initialized sync branch`);
      } else {
        console.log(
          `  ${colors.warn('!')} Sync branch created but verification failed (status: ${health.status})`,
        );
        console.log(`      Run 'tbd doctor' to diagnose`);
      }
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

  async run(projectDir?: string): Promise<void> {
    const colors = this.output.getColors();
    const cwd = projectDir ?? process.cwd();
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
   * Sync docs using syncDocsWithDefaults.
   * Uses the shared function that merges bundled defaults, prunes stale entries,
   * syncs files, and updates config.
   */
  private async syncDocs(cwd: string): Promise<void> {
    const colors = this.output.getColors();

    // Ensure docs directories exist
    await mkdir(join(cwd, TBD_SHORTCUTS_SYSTEM), { recursive: true });
    await mkdir(join(cwd, TBD_SHORTCUTS_STANDARD), { recursive: true });
    await mkdir(join(cwd, TBD_GUIDELINES_DIR), { recursive: true });
    await mkdir(join(cwd, TBD_TEMPLATES_DIR), { recursive: true });

    // Use shared sync function that handles:
    // - Merging bundled defaults with user config
    // - Pruning stale internal entries
    // - Syncing files to .tbd/docs/
    // - Writing config if changed
    // - Updating last_doc_sync_at in state
    const result = await syncDocsWithDefaults(cwd);

    // Report sync results
    if (result.configChanged) {
      console.log(colors.dim('Updated docs_cache config'));
    }

    const total = result.added.length + result.updated.length;
    if (total > 0) {
      console.log(colors.dim(`Synced ${total} doc(s) to ${TBD_DOCS_DIR}/`));
    }
    if (result.removed.length > 0) {
      console.log(colors.dim(`Removed ${result.removed.length} outdated doc(s)`));
    }
    if (result.pruned.length > 0) {
      console.log(colors.dim(`Pruned ${result.pruned.length} stale config entry/entries`));
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

    // Check if already installed (project-local settings)
    const projectSettingsPath = join(cwd, '.claude', 'settings.json');
    const skillPath = join(cwd, '.claude', 'skills', 'tbd', 'SKILL.md');

    try {
      if (await pathExists(projectSettingsPath)) {
        const content = await readFile(projectSettingsPath, 'utf-8');
        const settings = JSON.parse(content) as Record<string, unknown>;
        const hooks = settings.hooks as Record<string, unknown> | undefined;
        if (hooks) {
          const sessionStart = hooks.SessionStart as { hooks?: { command?: string }[] }[];
          const hasTbdHook = sessionStart?.some((h) =>
            h.hooks?.some(
              (hook) =>
                (hook.command?.includes('tbd prime') ?? false) ||
                (hook.command?.includes('tbd-session.sh') ?? false),
            ),
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
      handler.setProjectDir(cwd);
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
      handler.setProjectDir(cwd);
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
    console.log('Must be run inside a git repository. Installs .tbd/ and .claude/');
    console.log('at the git root (adjacent to .git/).');
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
