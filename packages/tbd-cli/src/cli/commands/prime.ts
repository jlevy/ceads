/**
 * `tbd prime` - Output workflow context for AI agents.
 *
 * Designed to be called by hooks at session start and before context compaction
 * to ensure agents remember the tbd workflow.
 *
 * See: tbd-design-v3.md §6.4.3 The tbd prime Command
 */

import { Command } from 'commander';
import { readFile, access } from 'node:fs/promises';
import { join } from 'node:path';

import { BaseCommand } from '../lib/baseCommand.js';
import { isInitialized } from '../../file/config.js';

interface PrimeOptions {
  export?: boolean;
}

/**
 * Prime output (~1-2k tokens, full command reference)
 */
const PRIME_OUTPUT = `# tbd Workflow Context

> **Context Recovery**: Run \`tbd prime\` after compaction, clear, or new session
> Hooks auto-call this in Claude Code when .tbd/ detected

# 🚨 SESSION CLOSE PROTOCOL 🚨

**CRITICAL**: Before saying "done" or "complete", you MUST run this checklist:

[ ] 1. git status              (check what changed)
[ ] 2. git add <files>         (stage code changes)
[ ] 3. tbd sync                (commit tbd changes)
[ ] 4. git commit -m "..."     (commit code)
[ ] 5. tbd sync                (commit any new tbd changes)
[ ] 6. git push                (push to remote)

**NEVER skip this.** Work is not done until pushed.

## Core Rules
- Track strategic work in tbd (multi-session, dependencies, discovered work)
- Use \`tbd create\` for issues, TodoWrite for simple single-session execution
- When in doubt, prefer tbd—persistence you don't need beats lost context
- Git workflow: run \`tbd sync\` at session end
- Session management: check \`tbd ready\` for available work

## Essential Commands

### Finding Work
- \`tbd ready\` - Show issues ready to work (no blockers)
- \`tbd list --status open\` - All open issues
- \`tbd list --status in_progress\` - Your active work
- \`tbd show <id>\` - Detailed issue view with dependencies

### Creating & Updating
- \`tbd create "title" --type task|bug|feature --priority 2\` - New issue
  - Priority: 0-4 (0=critical, 2=medium, 4=backlog)
- \`tbd update <id> --status in_progress\` - Claim work
- \`tbd update <id> --assignee username\` - Assign to someone
- \`tbd close <id>\` - Mark complete
- \`tbd close <id> --reason "explanation"\` - Close with reason

### Dependencies & Blocking
- \`tbd dep add <issue> <depends-on>\` - Add dependency
- \`tbd blocked\` - Show all blocked issues
- \`tbd show <id>\` - See what's blocking/blocked by this issue

### Sync & Collaboration
- \`tbd sync\` - Sync with git remote (run at session end)
- \`tbd sync --status\` - Check sync status without syncing

### Project Health
- \`tbd stats\` - Project statistics (open/closed/blocked counts)
- \`tbd doctor\` - Check for issues (sync problems, health checks)

## Common Workflows

**Starting work:**
tbd ready           # Find available work
tbd show <id>       # Review issue details
tbd update <id> --status in_progress  # Claim it

**Completing work:**
tbd close <id>      # Mark complete
tbd sync            # Push to remote

**Creating dependent work:**
tbd create "Implement feature X" --type feature
tbd create "Write tests for X" --type task
tbd dep add <tests-id> <feature-id>  # Tests depend on feature
`;

class PrimeHandler extends BaseCommand {
  async run(options: PrimeOptions): Promise<void> {
    const cwd = process.cwd();

    // Silent exit if not in a tbd project
    if (!(await isInitialized(cwd))) {
      // Exit silently with code 0 (no output, no error)
      return;
    }

    // Check for custom override file
    const customPrimePath = join(cwd, '.tbd', 'PRIME.md');

    // If --export, always show default content
    if (!options.export) {
      try {
        await access(customPrimePath);
        const customContent = await readFile(customPrimePath, 'utf-8');
        console.log(customContent);
        return;
      } catch {
        // No custom file, use default
      }
    }

    // Output default prime content
    console.log(PRIME_OUTPUT);
  }
}

export const primeCommand = new Command('prime')
  .description('Output workflow context for AI agents')
  .option('--export', 'Output default content (ignores PRIME.md override)')
  .action(async (options, command) => {
    const handler = new PrimeHandler(command);
    await handler.run(options);
  });
