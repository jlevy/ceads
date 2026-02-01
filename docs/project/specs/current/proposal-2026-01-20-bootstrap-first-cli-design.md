# tbd CLI UX: Prime-First Design

## Summary

Make `tbd prime` the default no-args experience.
Running `tbd` with no arguments shows installation health, project status, and quick
start guide.
Rename current `prime` to `tbd skill` which outputs the AI agent skill file.
Remove standalone `tbd help` in favor of standard `--help` flags.

## Design Principles

1. **Zero-friction onboarding**: `tbd` alone gives complete orientation
2. **Obvious default**: `tbd` = `tbd prime` = “prime yourself on this project”
3. **Consistent help patterns**: Use `--help` flags like standard CLIs
4. **Skill files are explicit**: `tbd skill` outputs installable skill content

## Command Hierarchy

### `tbd` (no arguments) = `tbd prime`

Running `tbd` with no arguments is equivalent to `tbd prime`. This shows:

```
tbd v1.2.3

--- INSTALLATION ---
✓ tbd installed (v1.2.3)
✓ Initialized in this repo
✓ Hooks installed
i Update available: v1.2.4 (npm install -g get-tbd@latest)

--- PROJECT STATUS ---
Repository: ai-trade-arena
Sync: ✓ Up to date with remote

Issues:
  3 open (1 in_progress, 2 ready)
  0 blocked
  12 closed this week

--- QUICK START ---
tbd ready              Show issues ready to work
tbd show <id>          View issue details
tbd create "title"     Create new issue
tbd close <id>         Mark issue complete
tbd sync               Sync with remote

--- SETUP ---
tbd setup claude       Install Claude Code hooks + skill
tbd setup cursor       Create Cursor IDE rules
tbd setup codex        Create/update AGENTS.md

For AI agent instructions: tbd skill
For CLI reference: tbd --help
For command help: tbd <command> --help
```

**Composition**: `prime` internally aggregates:

- Version/installation check
- `tbd status --brief` (project health + issue counts)
- Inline quick start guide
- Setup commands for different environments
- Pointers to `skill` and `--help`

### `tbd prime` (not initialized)

When tbd is installed globally but not initialized in the current project:

```
tbd v1.2.3

--- PROJECT NOT INITIALIZED ---
✗ Not initialized in this repository

To set up tbd in this project:

  tbd init                    # Initialize issue tracking

Then install agent integration:

  tbd setup claude            # Install Claude Code hooks + skill
  tbd setup cursor            # Create Cursor IDE rules
  tbd setup codex             # Create/update AGENTS.md

After setup, run 'tbd' again to see project status.

For CLI reference: tbd --help
```

### `tbd prime` (initialized but skill not installed)

When tbd is initialized but agent integration hasn’t been set up:

```
tbd v1.2.3

--- INSTALLATION ---
✓ tbd installed (v1.2.3)

--- PROJECT ---
✓ Initialized in this repo
✗ No skill file installed

--- SETUP RECOMMENDED ---
Install agent integration for your environment:

  tbd setup claude            # Install Claude Code hooks + skill
  tbd setup cursor            # Create Cursor IDE rules
  tbd setup codex             # Create/update AGENTS.md

--- ISSUES ---
  0 open
  0 blocked

For CLI reference: tbd --help
```

This ensures users always know their next step, whether they need to initialize, install
the skill, or are fully set up.

### `tbd prime`

Explicit invocation.
Same output as `tbd` with no args.

**Flags:**

- `tbd prime --brief` - Compact output with condensed skill instructions (see below)

### `tbd prime --brief`

Compact version suitable for context priming.
Includes condensed skill instructions:

```
tbd v1.2.3 | ✓ Installed | ✓ Synced | 3 open (1 in_progress) | 0 blocked

Quick commands: tbd ready | tbd show <id> | tbd create "title" | tbd close <id> | tbd sync

Core rules:
- Track all task work as issues using tbd
- Run tbd sync at session end
- Check tbd ready for available work

Essential: tbd ready (find work) | tbd create (new issue) | tbd close (complete) | tbd sync (push)
```

This is the same content as `tbd skill --brief`, ensuring consistency.

### `tbd skill`

Outputs full AI agent skill instructions.
This is what gets installed to `.claude/skills/tbd/skill.md` or similar locations.

```
tbd skill         # Output full skill.md content
tbd skill --brief # Output condensed instructions (same as prime --brief skill section)
```

**File mapping:**

- `tbd skill` → outputs content of bundled `skill.md`
- `tbd skill --brief` → outputs condensed instructions (matches `prime --brief`)
- `tbd setup claude` → copies skill content to `.claude/skills/tbd/skill.md`

### `tbd status`

Full status showing installation, project setup, sync state, and issue counts:

```
--- INSTALLATION ---
✓ tbd installed (v1.2.3)
✓ Global hooks configured
i Update available: v1.2.4 (npm install -g get-tbd@latest)

--- PROJECT ---
✓ Initialized in this repo
✓ Project hooks installed
✓ Skill file installed (.claude/skills/tbd/skill.md)

--- SYNC ---
✓ Up to date with remote
  Last sync: 2 minutes ago

--- ISSUES ---
  3 open (1 in_progress, 2 ready)
  0 blocked
  12 closed this week
```

**Flags:**

- `tbd status --installation` - Installation and setup only (global + user level)
- `tbd status --project` - Project-specific only (project setup, sync state, issue
  tallies)
- `tbd status --brief` - Compact summary

### `tbd status --installation`

Just installation health (useful for CI/scripts):

```
✓ tbd installed (v1.2.3)
✓ Global hooks configured
i Update available: v1.2.4
```

### `tbd status --project`

Project-specific status:

```
Repository: ai-trade-arena
✓ Initialized | ✓ Hooks | ✓ Skill file

Sync: ✓ Up to date (2 min ago)

Issues:
  3 open (1 in_progress, 2 ready)
  0 blocked
  12 closed
```

### `tbd doctor`

Comprehensive diagnostic that includes everything from `tbd status` plus additional
checks and suggestions for common issues:

```
tbd v1.2.3

--- INSTALLATION ---
✓ tbd installed (v1.2.3)
✓ Global hooks configured
i Update available: v1.2.4 (npm install -g get-tbd@latest)

--- PROJECT ---
✓ Initialized in this repo
✓ Project hooks installed
✓ Skill file installed (.claude/skills/tbd/skill.md)

--- SYNC ---
✓ Up to date with remote
  Last sync: 2 minutes ago

--- ISSUES ---
  3 open (1 in_progress, 2 ready)
  0 blocked
  12 closed this week

--- DIAGNOSTICS ---
✓ Git remote configured
✓ .tbd directory in .gitignore
✓ No orphaned issues
✓ No circular dependencies

--- SUGGESTIONS ---
i Consider closing stale issues: ar-abc (open 14 days)
i 2 issues have no assignee
```

`tbd doctor` is the go-to command for troubleshooting.
It subsumes `tbd status` and adds:
- Git configuration checks
- Orphaned/stale issue detection
- Circular dependency detection
- Actionable suggestions for common problems

### `tbd --help`

Standard CLI help. Focused command reference:

```
tbd - Lightweight git-native issue tracking

Usage: tbd [command] [options]

Commands:
  prime            Project orientation (default when no args)
  status           Full health check (--installation, --project, --brief)
  skill            Output AI agent skill file

  list [filters]   List issues (--status, --type, --priority)
  ready            Show unblocked issues ready to work
  blocked          Show blocked issues
  show <id>        Show issue details

  create <title>   Create new issue
  update <id>      Update issue fields
  close <id>       Close an issue
  dep add <a> <b>  Add dependency (a depends on b)

  sync             Sync with git remote
  stats            Aggregate statistics
  doctor           Diagnose problems

  setup <target>   Install hooks/skills (claude, cursor, codex)

Global Options:
  --json           Output as JSON
  --help           Show help for command
  --version        Show version

Examples:
  tbd                                    # Project orientation (same as prime)
  tbd create "Fix bug" --type bug        # Create bug issue
  tbd update ar-123 --status in_progress # Start working on issue
  tbd skill > skill.md                   # Export skill file
```

### `tbd <command> --help`

Per-command help. Example for `tbd create --help`:

```
tbd create - Create a new issue

Usage: tbd create <title> [options]

Arguments:
  title              Issue title (required)

Options:
  --type <type>      Issue type: task, bug, feature, epic (default: task)
  --priority <p>     Priority: P0-P4 (default: P2)
  --assignee <user>  Assign to user
  --body <text>      Issue description
  --json             Output created issue as JSON

Examples:
  tbd create "Fix login bug" --type bug --priority P1
  tbd create "Add dark mode" --type feature
```

## Removed: `tbd help`

The standalone `tbd help` command is removed.
Help is accessed via:

- `tbd --help` - Full CLI reference
- `tbd <command> --help` - Command-specific help
- `tbd prime` - Includes pointers to help

This follows standard CLI conventions (git, npm, docker, etc.).

## Implementation Notes

### No-args detection

```typescript
// In CLI entry point
if (process.argv.length === 2) {
  // No command provided, run prime
  return commands.prime({});
}
```

### `skill` command

```typescript
async function skill(options: { brief?: boolean }) {
  const filename = options.brief ? 'skill-brief.md' : 'skill.md';
  const content = await readBundledFile(filename);
  console.log(content);
}
```

### Bundled skill files

The tbd package includes:

- `skill.md` - Full AI agent instructions
- `skill-brief.md` - Condensed instructions

These are maintained in the tbd repo and bundled with the npm package.

### Migration from `tbd help`

- Remove `help` from command list
- Add deprecation warning if `tbd help` is invoked: “Use ‘tbd --help’ instead”
- Remove warning after one minor version

### Migration from old `tbd prime`

- Old `prime` behavior (full context dump) moves to `tbd skill`
- New `prime` is the dashboard
- Add note in changelog

## Skill File Updates

The skill file instructs agents to run `tbd` on `/tbd` invocation:

```markdown
## On Skill Invocation

When `/tbd` is invoked, run:

tbd

This shows installation status, project overview, and quick start guide.
```

## Summary Table

| Command | Purpose |
| --- | --- |
| `tbd` | Prime (installation + status + quick start) |
| `tbd prime` | Same as above, explicit |
| `tbd prime --brief` | Compact status + condensed skill instructions |
| `tbd skill` | Full AI agent skill instructions |
| `tbd skill --brief` | Condensed instructions (same as prime --brief) |
| `tbd status` | Full status (installation + project + sync + issues) |
| `tbd status --installation` | Installation health only (CI/scripts) |
| `tbd status --project` | Project setup + sync + issue tallies |
| `tbd status --brief` | Compact status |
| `tbd doctor` | Status + diagnostics + suggestions (troubleshooting) |
| `tbd --help` | CLI reference |
| `tbd <cmd> --help` | Command-specific help |
| ~~`tbd help`~~ | Removed (use `--help`) |

## Naming Rationale

- **`prime`** = “prime yourself on this project” - get oriented, see status + quick
  start
- **`skill`** = outputs the skill file for AI agents - explicit, file-focused
- **`status`** = comprehensive health check (installation + project + sync + issues)
  - `--installation` = global/user-level setup only
  - `--project` = project-specific (setup, sync, issues)
- **`--help`** = standard CLI convention for command reference
- **`--brief` consistency** = `prime --brief` and `skill --brief` share the same
  condensed skill content, so users get consistent output regardless of which they use
