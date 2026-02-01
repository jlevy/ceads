/**
 * Centralized path constants and utilities for coding agent integrations.
 *
 * IMPORTANT: All tbd integration files (hooks, settings, skills) are installed
 * to PROJECT-LOCAL directories (.claude/, AGENTS.md) ONLY. We do NOT install to
 * global/user directories (~/.claude/).
 *
 * This file defines all path constants in one place to:
 * 1. Ensure consistency across the codebase
 * 2. Make the project-local policy explicit and auditable
 * 3. Simplify future changes to path conventions
 */

import { join } from 'node:path';
import { homedir } from 'node:os';

// =============================================================================
// Claude Code Integration Paths (project-local)
// =============================================================================

/**
 * Relative path to Claude Code settings file from project root.
 * This is where hooks are configured.
 */
export const CLAUDE_SETTINGS_REL = '.claude/settings.json';

/**
 * Relative path to Claude Code directory from project root.
 */
export const CLAUDE_DIR_REL = '.claude';

/**
 * Relative path to Claude Code scripts directory from project root.
 */
export const CLAUDE_SCRIPTS_DIR_REL = '.claude/scripts';

/**
 * Relative path to Claude Code hooks directory from project root.
 */
export const CLAUDE_HOOKS_DIR_REL = '.claude/hooks';

/**
 * Relative path to tbd skill file from project root.
 */
export const CLAUDE_SKILL_REL = '.claude/skills/tbd/SKILL.md';

/**
 * Relative path to tbd session script from project root.
 */
export const TBD_SESSION_SCRIPT_REL = '.claude/scripts/tbd-session.sh';

/**
 * Relative path to tbd closing reminder hook script from project root.
 */
export const TBD_CLOSING_REMINDER_REL = '.claude/hooks/tbd-closing-reminder.sh';

/**
 * Relative path to gh CLI ensure script from project root.
 */
export const GH_CLI_SCRIPT_REL = '.claude/scripts/ensure-gh-cli.sh';

// =============================================================================
// Codex / AGENTS.md Integration Paths (project-local)
// =============================================================================

/**
 * Relative path to AGENTS.md file from project root.
 * Used by Codex, Factory.ai, Cursor (v1.6+), and other compatible tools.
 */
export const AGENTS_MD_REL = 'AGENTS.md';

// =============================================================================
// Global Paths (for detection only - NOT for installation)
// =============================================================================

/**
 * Global Claude Code directory in user's home.
 * Used ONLY for detecting if Claude Code is installed (for agent detection).
 * All installations are project-local.
 */
export const GLOBAL_CLAUDE_DIR = join(homedir(), '.claude');

// =============================================================================
// Path Resolution Utilities
// =============================================================================

/**
 * Get project-local Claude Code paths.
 *
 * @param projectRoot - The project root directory (containing .tbd/)
 * @returns Object with all Claude Code paths resolved to absolute paths
 */
export function getClaudePaths(projectRoot: string) {
  return {
    /** .claude/ directory */
    dir: join(projectRoot, CLAUDE_DIR_REL),
    /** .claude/settings.json */
    settings: join(projectRoot, CLAUDE_SETTINGS_REL),
    /** .claude/scripts/ directory */
    scriptsDir: join(projectRoot, CLAUDE_SCRIPTS_DIR_REL),
    /** .claude/hooks/ directory */
    hooksDir: join(projectRoot, CLAUDE_HOOKS_DIR_REL),
    /** .claude/skills/tbd/SKILL.md */
    skill: join(projectRoot, CLAUDE_SKILL_REL),
    /** .claude/scripts/tbd-session.sh */
    sessionScript: join(projectRoot, TBD_SESSION_SCRIPT_REL),
    /** .claude/hooks/tbd-closing-reminder.sh */
    closingReminder: join(projectRoot, TBD_CLOSING_REMINDER_REL),
    /** .claude/scripts/ensure-gh-cli.sh */
    ghCliScript: join(projectRoot, GH_CLI_SCRIPT_REL),
  };
}

/**
 * Get project-local Codex/AGENTS.md path.
 *
 * @param projectRoot - The project root directory
 * @returns Absolute path to AGENTS.md
 */
export function getAgentsMdPath(projectRoot: string): string {
  return join(projectRoot, AGENTS_MD_REL);
}

// =============================================================================
// Display Paths (for user-facing output)
// =============================================================================

/**
 * Display path for Claude Code settings in status/doctor output.
 */
export const CLAUDE_SETTINGS_DISPLAY = './.claude/settings.json';

/**
 * Display path for AGENTS.md in status/doctor output.
 */
export const AGENTS_MD_DISPLAY = './AGENTS.md';
