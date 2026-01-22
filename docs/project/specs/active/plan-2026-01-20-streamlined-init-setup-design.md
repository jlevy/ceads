# Plan Spec: Streamlined Init, Setup, Prime, and Skill Commands

## Purpose

Design a cleaner, more intuitive CLI experience for tbd that works seamlessly for both
humans and AI agents.
This spec covers:

1. **Onboarding flow** - Setting up new repos, migrating from beads, joining existing
   projects
2. **Prime-first design** - Making `tbd` with no args the orientation dashboard
3. **Skill command** - Explicit command for AI agent skill file output
4. **Help modernization** - Standard `--help` flags instead of separate `help` command

## Background

tbd currently has multiple setup-related commands that overlap in confusing ways:

- `tbd init --prefix=<name>` - Initializes tbd repo, then auto-calls `setup auto`
- `tbd setup` - Parent command that shows subcommands but does nothing by itself
- `tbd setup auto` - Auto-detects and configures editor integrations
- `tbd import --from-beads` - Auto-initializes + imports from beads

This creates confusion: Should users run `init` or `setup` or `import`? The answer
depends on their situation, but the commands don’t guide them.

## Summary of Task

### Part 1: Onboarding

Unify the onboarding experience around a single entry point: **`tbd setup`**

This one command handles all scenarios:

1. New repo → initialize + configure integrations
2. Existing tbd repo → check/update integrations
3. Beads migration → import + initialize + configure
4. Agents → non-interactive mode with sensible defaults

### Part 2: Prime-First Design

Make `tbd` (no args) the orientation dashboard:

- **`tbd`** = **`tbd prime`** = Dashboard showing installation, status, quick start
- **`tbd skill`** = Outputs full AI agent skill file (what `prime` used to do)
- **`tbd --help`** = CLI reference (replaces standalone `help` command)

This creates a clear mental model:
- `prime` = “prime yourself on this project” (get oriented)
- `skill` = “output the skill file” (for AI agents)

## Current State Analysis

### Current Command Structure

```
tbd                           # Shows --help
tbd init --prefix=<name>      # Initialize repo (prefix REQUIRED)
  └── auto-calls: tbd setup auto
  └── auto-calls: tbd status
tbd setup                     # Shows subcommands only (does nothing)
  tbd setup auto              # Detect + configure integrations
  tbd setup claude            # Claude Code hooks + skill
  tbd setup cursor            # Cursor IDE rules
  tbd setup codex             # AGENTS.md
  tbd setup beads --disable   # Disable Beads
tbd import --from-beads       # Auto-initializes + imports
tbd import <file>             # Import from exported file
```

### Problems with Current Design

| Issue | Why It's Confusing |
| --- | --- |
| Three entry points | `init`, `setup`, or `import --from-beads`? |
| `init` requires `--prefix` | New users don't know what to put |
| `init` calls `setup auto` | Setup is a subset of init? Backwards. |
| `setup` alone does nothing | Users expect "setup" to set things up |
| `import --from-beads` auto-inits | Hidden initialization, inconsistent with `init` |
| Beads detection not automatic | User must know to run `import --from-beads` |

### User Journeys (Current)

| Journey | Current Commands | Issues |
| --- | --- | --- |
| New repo | `tbd init --prefix=x` | Must know prefix upfront |
| Has beads | `tbd import --from-beads` | Different command than new repo |
| Joining tbd repo | `tbd setup auto` | Different from init flow |
| Agent automation | `tbd init --prefix=x` | Must provide prefix |

## Stage 1: Planning Stage

### Design Philosophy

**Two-tier command structure:**

1. **`tbd setup`** - High-level “just make it work” entry point
2. **`tbd init`** - Low-level surgical initialization

```
tbd setup                    # Friendly: init (if needed) + integrations
tbd init                     # Surgical: just create .tbd/, nothing else
```

This mirrors patterns like `npm init` (surgical) vs setup wizards, or `git init` vs
GitHub’s “create repository” flow.

**Key principle:** `tbd setup` calls `tbd init` internally, but `tbd init` never calls
`tbd setup`. The surgical path is always available.

### Proposed Command Structure

```
tbd                           # Runs tbd prime (dashboard)

# High-level entry point (recommended for most users)
tbd setup                     # Shows help, requires --interactive or --auto
tbd setup --interactive       # Interactive mode (for humans who want to understand)
tbd setup --auto              # Non-interactive mode (for agents/scripts)
  --from-beads                # Migrate from beads (can also auto-detect)
  --prefix=<name>             # Override auto-detected prefix
  tbd setup claude            # Just Claude integration (non-interactive)
  tbd setup cursor            # Just Cursor integration (non-interactive)
  tbd setup codex             # Just AGENTS.md (non-interactive)
  tbd setup check             # Check all integration status (non-interactive)

# Low-level surgical commands
tbd init [options]            # Just create .tbd/, no integrations
  --prefix=<name>             # Project prefix for issue IDs (REQUIRED)
tbd import <file>             # Import from exported JSONL file
```

**Key design decision:** `tbd setup` with no flags shows help and exits.
This prevents agents from accidentally running interactive mode.
Users must explicitly choose `--interactive` or `--auto`.

### Command Relationship

```
┌─────────────────────────────────────────────────────────────────┐
│ tbd setup                                                       │
│   ├── Detects state (no .tbd? has .beads? already init?)       │
│   ├── Calls tbd init internally if needed                       │
│   └── Configures integrations (Claude, Cursor, etc.)           │
└─────────────────────────────────────────────────────────────────┘
                              │
                              │ calls internally
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│ tbd init                                                        │
│   ├── Creates .tbd/config.yml                                  │
│   ├── Creates .tbd/.gitignore                                  │
│   ├── Initializes sync branch                                  │
│   └── Does NOT configure integrations                          │
└─────────────────────────────────────────────────────────────────┘
```

### Command Changes (No Deprecations)

This is a new tool - we’re designing it correctly from the start, not maintaining
backward compatibility with confusing patterns.

| Command | New Behavior |
| --- | --- |
| `tbd init` | Surgical init only (no longer calls setup auto) |
| `tbd init --prefix=x` | Prefix REQUIRED (no auto-detect for surgical init) |
| `tbd setup` | Shows help, requires `--interactive` or `--auto` flag |
| `tbd setup --interactive` | Interactive mode for humans (explains + confirms each step) |
| `tbd setup --auto` | Non-interactive mode for agents (all defaults, no prompts) |
| `tbd setup auto` | **Removed** - use `tbd setup --auto` instead |
| `tbd import --from-beads` | **Removed** - use `tbd setup --from-beads` instead |
| `tbd setup beads --disable` | **Removed** - integrated into `--from-beads` flow |

### User Journeys (New)

| Journey | Command | What Happens |
| --- | --- | --- |
| New repo (human) | `tbd setup --interactive` | Auto-detect prefix → confirm → init → integrations |
| New repo (surgical) | `tbd init --prefix=x` | Explicit prefix → init only |
| Has beads (human) | `tbd setup --interactive` | Detect beads → offer migration → init → integrations |
| Joining tbd repo | `tbd setup --interactive` | Detect .tbd → check/update integrations (no prefix needed) |
| Agent automation | `tbd setup --auto` | All defaults, no prompts |
| Explicit beads | `tbd setup --from-beads` | Force beads migration flow (non-interactive) |
| Script/CI init | `tbd init --prefix=x` | Just create .tbd/ with explicit prefix |
| Global setup only | `tbd setup --interactive` (outside repo) | Warning, global config only |

### Detailed Behavior Specifications

#### 1. Help Footer & README

**The one-liner for README and top-level help:**

```
npm install -g tbd-git@latest && tbd setup --auto
```

**Help footer for `tbd`, `tbd --help`, `tbd readme`, `tbd docs`:**

```
Getting Started:
  npm install -g tbd-git@latest && tbd setup --auto

  This initializes tbd and configures your coding agents automatically.
  For interactive setup: tbd setup --interactive
  For manual control: tbd init --help
```

**Help for `tbd setup --help`:**

```
Usage: tbd setup [options] [command]

Full setup: initialize tbd (if needed) and configure agent integrations.

IMPORTANT: You must specify a mode flag OR a subcommand.

Modes:
  --auto              Non-interactive mode with smart defaults (for agents/scripts)
  --interactive       Interactive mode with prompts (for humans)

Options:
  --from-beads        Migrate from Beads to tbd (non-interactive)
  --prefix <name>     Override auto-detected project prefix

Commands:
  claude              Configure Claude Code integration only (non-interactive)
  cursor              Configure Cursor IDE integration only (non-interactive)
  codex               Configure AGENTS.md only (non-interactive)
  check               Check status of all integrations

Examples:
  tbd setup --auto              # Recommended: full automatic setup (for agents)
  tbd setup --interactive       # Interactive setup with prompts (for humans)
  tbd setup claude              # Add just Claude integration
  tbd setup --from-beads        # Migrate from Beads (non-interactive)

For surgical initialization without integrations, see: tbd init --help
```

**Help for `tbd init --help`:**

```
Usage: tbd init --prefix=<name>

Surgical initialization: create .tbd/ directory only, no integrations.

Use this when you need precise control over the setup process, such as in
CI pipelines or scripts where integrations are configured separately.

Options:
  --prefix <name>     Project prefix for issue IDs (REQUIRED)

Examples:
  tbd init --prefix=myapp   # Initialize with specific prefix

For automatic prefix detection, use: tbd setup --auto
```

#### 2. `tbd setup` Decision Tree

```
tbd setup
  │
  ├─► Is this a git repo?
  │     NO → Error: "Not a git repository. Run `git init` first."
  │
  ├─► Is .tbd/ present?
  │     YES → Go to "Already Initialized" flow
  │
  ├─► Is .beads/ present?
  │     YES → Go to "Beads Migration" flow
  │
  └─► Go to "Fresh Setup" flow
```

#### 3. Fresh Setup Flow (no .tbd/, no .beads/)

This is the interactive flow (`--interactive`). For non-interactive, see section 6
(`--auto` mode).

```
$ tbd setup --interactive

tbd: Git-native issue tracking for AI agents and humans

I'll help you set up tbd in this repository. Here's what I'll do:

  1. Initialize tbd tracking (.tbd/ directory)
  2. Auto-detect your project prefix from git remote
  3. Configure detected integrations (Claude Code, Cursor, etc.)

? Proceed with setup? (Y/n)

Checking repository...
  ✓ Git repository detected
  ✗ tbd not initialized

Detecting project prefix...
  Repository: github.com/jlevy/tbd → "tbd"

? Use prefix "tbd" for issue IDs (e.g., tbd-a7k2)? (Y/n)

Initializing tbd...
  ✓ Created .tbd/config.yml
  ✓ Created .tbd/.gitignore
  ✓ Initialized sync branch

Configuring integrations...
  Claude Code detected.
  ? Install hooks and skill file? (Y/n)
  ✓ Claude Code - Installed hooks and skill
  - Cursor IDE - Not detected (skipped)
  - AGENTS.md - Not detected (skipped)

Setup complete! Next steps:
  1. git add .tbd/ .claude/ && git commit -m "Initialize tbd"
  2. tbd create "My first issue" --type=task
  3. tbd ready   # See available work
```

#### 4. Beads Migration Flow (.beads/ detected)

```
$ tbd setup --interactive

tbd: Git-native issue tracking for AI agents and humans

Checking repository...
  ✓ Git repository detected
  ✗ tbd not initialized
  ! Beads detected (.beads/ directory found)

? Migrate from Beads to tbd? This will:
  • Import all beads issues to tbd
  • Preserve issue IDs and relationships
  • Disable beads (move to .beads-disabled/)
  (Y/n)

Importing from Beads...
  ✓ Found 47 issues in .beads/
  ✓ Imported 47 issues (prefix: proj)
  ✓ Disabled beads (moved to .beads-disabled/)

Configuring integrations...
  ✓ Claude Code - Installed hooks and skill

Setup complete! Next steps:
  1. git add .tbd/ .claude/ .beads-disabled/ && git commit -m "Migrate to tbd"
  2. tbd list   # See your imported issues
```

If user declines migration:

```
? Migrate from Beads to tbd? (Y/n) n

To set up tbd alongside beads (not recommended):
  tbd setup --interactive --prefix=<name>

To migrate later:
  tbd setup --from-beads
```

#### 5. Already Initialized Flow (.tbd/ exists)

```
$ tbd setup --interactive

tbd: Git-native issue tracking for AI agents and humans

Checking repository...
  ✓ Git repository detected
  ✓ tbd initialized (prefix: tbd, 12 issues)

Checking integrations...
  ✓ Claude Code - Configured
  - Cursor IDE - Not detected
  - AGENTS.md - Not detected

All set! Run `tbd status` for details.
```

If integrations need updating:

```
Checking integrations...
  ! Claude Code - Skill file outdated (v0.1.2 → v0.1.4)

? Update Claude Code skill file? (Y/n)
  ✓ Updated skill file
```

#### 6. Interactive vs Non-Interactive Mode

**`tbd setup` (no flags) - Shows Help:**

Running `tbd setup` without flags shows help and exits.
This prevents agents from accidentally running interactive mode.

```
$ tbd setup

Usage: tbd setup [options] [command]

You must specify a mode:
  --auto              Non-interactive mode (for agents/scripts)
  --interactive       Interactive mode (for humans)

Or run a specific subcommand:
  tbd setup claude    Add Claude integration only
  tbd setup cursor    Add Cursor integration only
  tbd setup check     Check integration status

Examples:
  tbd setup --auto              # Recommended for agents
  tbd setup --interactive       # For humans who want to understand each step
```

**`tbd setup --interactive` (interactive mode):**

The `--interactive` flag runs setup interactively.
It explains what it will do and asks for confirmation at each step.
This is the recommended mode for humans who want to understand and control the setup
process.

```
$ tbd setup --interactive

tbd: Git-native issue tracking for AI agents and humans

I'll help you set up tbd in this repository. Here's what I'll do:

  1. Initialize tbd tracking (.tbd/ directory)
  2. Auto-detect your project prefix from git remote
  3. Configure Claude Code integration (hooks + skill file)

? Proceed with setup? (Y/n)

Detecting project prefix...
  Repository: github.com/jlevy/myapp → "myapp"

? Use prefix "myapp" for issue IDs (e.g., myapp-a7k2)? (Y/n)

Initializing tbd...
  ✓ Created .tbd/config.yml
  ✓ Created .tbd/.gitignore
  ✓ Initialized sync branch

Configuring integrations...
  Claude Code detected.
  ? Install hooks and skill file? (Y/n)
  ✓ Claude Code - Installed hooks and skill

Setup complete! Next steps:
  1. git add .tbd/ .claude/ && git commit -m "Initialize tbd"
  2. tbd create "My first issue" --type=task
```

**`tbd setup --auto` (non-interactive mode):**

The `--auto` flag runs setup non-interactively with sensible defaults.
This is what agents should use - no prompts, no confirmations.

```
$ tbd setup --auto

tbd: Git-native issue tracking for AI agents and humans

Checking repository...
  ✓ Git repository detected
  ✗ tbd not initialized

Initializing with auto-detected prefix "myapp"...
  ✓ Created .tbd/config.yml
  ✓ Initialized sync branch

Configuring integrations...
  ✓ Claude Code - Installed hooks and skill

Setup complete!
  Run: git add .tbd/ .claude/ && git commit -m "Initialize tbd"
```

**Key differences:**

| Behavior | `tbd setup` | `tbd setup --interactive` | `tbd setup --auto` |
| --- | --- | --- | --- |
| Action | Shows help | Full interactive setup | Full automatic setup |
| Explains what it will do | N/A | Yes, upfront | No |
| Confirms before proceeding | N/A | Yes | No |
| Confirms prefix | N/A | Yes (prompt) | No (auto-accept) |
| Confirms each integration | N/A | Yes (prompt) | No (auto-install) |
| Beads migration | N/A | Prompts | Auto-migrates |
| Recommended for | N/A | Humans | Agents/scripts |

**With beads detected in auto mode:**

```
$ tbd setup --auto

Checking repository...
  ✓ Git repository detected
  ! Beads detected - auto-migrating

Importing from Beads...
  ✓ Imported 47 issues
  ✓ Disabled beads

Setup complete!
```

#### 7. Explicit Beads Migration (`--from-beads`)

The `--from-beads` flag is **non-interactive** - it forces beads migration without
prompting.

```
$ tbd setup --from-beads

Importing from Beads...
  ✓ Found 47 issues in .beads/
  ✓ Imported 47 issues (prefix: proj)
  ✓ Disabled beads (moved to .beads-disabled/)

Configuring integrations...
  ✓ Claude Code - Installed hooks and skill

Setup complete!
```

### Command Mode Summary

**IMPORTANT FOR SKILL FILES:** Agents should ALWAYS use `--auto` flag.

| Command | Mode | Who Uses It |
| --- | --- | --- |
| `tbd setup` | **Shows help** | Prevents accidental interactive mode |
| `tbd setup --interactive` | Interactive | Humans who want to understand each step |
| `tbd setup --auto` | Non-interactive | Agents, scripts, CI/CD |
| `tbd setup --from-beads` | Non-interactive | Agents migrating from beads |
| `tbd setup claude` | Non-interactive | Adding specific integration |
| `tbd setup cursor` | Non-interactive | Adding specific integration |
| `tbd init --prefix=X` | Non-interactive | Scripts needing surgical init |

**Key design decision:** `tbd setup` with no flags shows help and exits.
This prevents agents from accidentally running interactive mode.

**For SKILL.md and agent instructions:**
- Always recommend `tbd setup --auto` for agents
- `tbd setup` (no args) shows help, NOT interactive mode
- `tbd setup --interactive` is for humans who want step-by-step confirmation
- Agents should ALWAYS run `tbd setup --auto`

### Complete Scenario Matrix for `tbd setup`

This section details every possible scenario and the exact prompts/behavior for each.

#### Context Detection Matrix

| In Git Repo? | Has .tbd/? | Has .beads/? | Scenario |
| --- | --- | --- | --- |
| No | N/A | N/A | Global-only setup |
| Yes | No | No | Fresh setup |
| Yes | No | Yes | Beads migration |
| Yes | Yes | No | Already initialized |
| Yes | Yes | Yes | Already initialized (beads ignored) |

* * *

#### Scenario A: Outside Git Repository (Global-Only Setup)

**Detection:** Not in a git repository (no `.git/` found)

**Interactive mode (`tbd setup --interactive`):**

```
$ tbd setup --interactive

Warning: Not in a git repository.

I can only perform global setup (user-level configuration).
Repository initialization will be skipped.

This will:
  1. Install tbd skill file to ~/.claude/skills/tbd/
  2. Configure global Claude Code settings

? Proceed with global-only setup? (Y/n)

Performing global setup...
  ✓ Installed global Claude Code skill

Global setup complete!

To set up tbd in a specific repository:
  1. cd /path/to/your/repo
  2. tbd setup --auto
```

**Auto mode (`tbd setup --auto`):**

```
$ tbd setup --auto

Warning: Not in a git repository. Performing global-only setup.

Performing global setup...
  ✓ Installed global Claude Code skill

Global setup complete!
To initialize a repository, run 'tbd setup --interactive' from within a git repo.
```

* * *

#### Scenario B: Fresh Setup (Git repo, no .tbd/, no .beads/)

**Detection:** In git repo, no `.tbd/` directory, no `.beads/` directory

**Interactive prompts:**

| Prompt | Default | Purpose |
| --- | --- | --- |
| "Proceed with setup?" | Y | Confirm user wants to set up tbd |
| "Use prefix 'X'?" | Y | Confirm auto-detected prefix |
| "Install Claude Code integration?" | Y | Confirm hook + skill installation |
| "Install Cursor integration?" | Y (if detected) | Confirm Cursor rules |

**Interactive mode (`tbd setup --interactive`):**

```
$ tbd setup --interactive

tbd: Git-native issue tracking for AI agents and humans

I'll help you set up tbd in this repository. Here's what I'll do:

  1. Initialize tbd tracking (.tbd/ directory)
  2. Auto-detect your project prefix from git remote
  3. Configure detected integrations

? Proceed with setup? (Y/n)

Detecting project prefix...
  Repository: github.com/jlevy/myapp → "myapp"

? Use prefix "myapp" for issue IDs (e.g., myapp-a7k2)? (Y/n)

Initializing tbd...
  ✓ Created .tbd/config.yml
  ✓ Created .tbd/.gitignore
  ✓ Initialized sync branch

Checking for integrations...
  Claude Code detected.
  ? Install hooks and skill file? (Y/n)
  ✓ Installed Claude Code integration

  Cursor IDE detected.
  ? Install tbd rules? (Y/n)
  ✓ Installed Cursor rules

Setup complete! Next steps:
  1. git add .tbd/ .claude/ && git commit -m "Initialize tbd"
  2. tbd create "My first issue" --type=task
```

**Auto mode (`tbd setup --auto`):**

```
$ tbd setup --auto

tbd: Git-native issue tracking for AI agents and humans

Checking repository...
  ✓ Git repository detected
  ✗ tbd not initialized

Initializing with auto-detected prefix "myapp"...
  ✓ Created .tbd/config.yml
  ✓ Created .tbd/.gitignore
  ✓ Initialized sync branch

Configuring integrations...
  ✓ Claude Code - Installed hooks and skill
  ✓ Cursor IDE - Installed rules

Setup complete!
  Run: git add .tbd/ .claude/ .cursor/ && git commit -m "Initialize tbd"
```

**Auto mode when prefix cannot be detected:**

```
$ tbd setup --auto

Error: Could not auto-detect project prefix.
No git remote found and directory name is not a valid prefix.

Please specify a prefix:
  tbd setup --auto --prefix=myapp
```

* * *

#### Scenario C: Beads Migration (Git repo, no .tbd/, has .beads/)

**Detection:** In git repo, no `.tbd/` directory, has `.beads/` directory

**Interactive prompts:**

| Prompt | Default | Purpose |
| --- | --- | --- |
| "Migrate from Beads?" | Y | Confirm migration |
| "Use prefix 'X'?" | Y | Confirm prefix (from beads or auto-detect) |
| "Install integrations?" | Y | Confirm integration setup |

**Interactive mode (`tbd setup --interactive`):**

```
$ tbd setup --interactive

tbd: Git-native issue tracking for AI agents and humans

Checking repository...
  ✓ Git repository detected
  ✗ tbd not initialized
  ! Beads detected (.beads/ directory found)

Beads migration will:
  • Import all beads issues to tbd
  • Preserve issue IDs and relationships
  • Disable beads (move to .beads-disabled/)

? Migrate from Beads to tbd? (Y/n)

Importing from Beads...
  ✓ Found 47 issues in .beads/
  ✓ Detected prefix "proj" from beads config

? Use prefix "proj" for issue IDs? (Y/n)

  ✓ Imported 47 issues
  ✓ Disabled beads (moved to .beads-disabled/)

Checking for integrations...
  Claude Code detected.
  ? Install hooks and skill file? (Y/n)
  ✓ Installed Claude Code integration

Setup complete! Next steps:
  1. git add .tbd/ .claude/ .beads-disabled/ && git commit -m "Migrate to tbd"
  2. tbd list   # See your imported issues
```

**If user declines migration:**

```
? Migrate from Beads to tbd? (Y/n) n

Migration declined.

To set up tbd alongside beads (not recommended):
  tbd setup --prefix=<name>

To migrate later:
  tbd setup --from-beads
```

**Auto mode (`tbd setup --auto`):**

```
$ tbd setup --auto

tbd: Git-native issue tracking for AI agents and humans

Checking repository...
  ✓ Git repository detected
  ! Beads detected - auto-migrating

Importing from Beads...
  ✓ Found 47 issues in .beads/
  ✓ Imported 47 issues (prefix: proj)
  ✓ Disabled beads (moved to .beads-disabled/)

Configuring integrations...
  ✓ Claude Code - Installed hooks and skill

Setup complete!
  Run: git add .tbd/ .claude/ .beads-disabled/ && git commit -m "Migrate to tbd"
```

* * *

#### Scenario D: Already Initialized (Git repo, has .tbd/)

**Detection:** In git repo, has `.tbd/` directory

**Interactive prompts:**

| Prompt | Default | Purpose |
| --- | --- | --- |
| "Update integration?" | Y | If integration is outdated |

**Interactive mode (`tbd setup --interactive`):**

```
$ tbd setup --interactive

tbd: Git-native issue tracking for AI agents and humans

Checking repository...
  ✓ Git repository detected
  ✓ tbd initialized (prefix: myapp, 12 issues)

Checking integrations...
  ✓ Claude Code - Configured
  - Cursor IDE - Not detected
  - AGENTS.md - Not detected

All set! Run `tbd status` for details.
```

**If integration needs updating:**

```
$ tbd setup --interactive

Checking repository...
  ✓ Git repository detected
  ✓ tbd initialized (prefix: myapp, 12 issues)

Checking integrations...
  ! Claude Code - Skill file outdated (v0.1.2 → v0.1.4)

? Update Claude Code skill file? (Y/n)
  ✓ Updated skill file

All integrations up to date!
```

**Auto mode (`tbd setup --auto`):**

```
$ tbd setup --auto

Checking repository...
  ✓ Git repository detected
  ✓ tbd initialized (prefix: myapp, 12 issues)

Checking integrations...
  ✓ Claude Code - Up to date
  - Cursor IDE - Not detected

All set!
```

**Auto mode with outdated integration:**

```
$ tbd setup --auto

Checking repository...
  ✓ Git repository detected
  ✓ tbd initialized (prefix: myapp)

Updating integrations...
  ✓ Claude Code - Updated skill file (v0.1.2 → v0.1.4)

All set!
```

* * *

### Summary: Interactive Prompts Reference

| Scenario | Prompts in Interactive Mode | Behavior in Auto Mode |
| --- | --- | --- |
| **Outside git repo** | "Proceed with global-only setup?" (Y) | Warn, proceed with global setup |
| **Fresh setup** | "Proceed?" (Y), "Use prefix X?" (Y), "Install X integration?" (Y) | Auto-detect prefix, install all integrations |
| **Beads migration** | "Migrate from Beads?" (Y), "Use prefix X?" (Y), "Install X?" (Y) | Auto-migrate, use beads prefix |
| **Already initialized** | "Update X integration?" (Y) only if outdated | Auto-update outdated integrations |
| **Prefix not detectable** | "Enter prefix:" (required) | Error with instructions |

* * *

### Integration Upgrade Behavior

When running `tbd setup` on an already-initialized repository, the command should
**always check for and apply integration updates**. This ensures users get fixes and
improvements when they upgrade tbd.

**Upgrade scenarios:**

| Integration | Upgrade Trigger | What Gets Updated |
| --- | --- | --- |
| Claude Code | Skill file content changed | `.claude/skills/tbd/SKILL.md` |
| Claude Code | Hook config improved | `.claude/settings.json` (merges, doesn't overwrite) |
| Cursor IDE | MDC content or format changed | `.cursor/rules/tbd.mdc` |
| AGENTS.md | Content changed | `AGENTS.md` (tbd section only) |

**Version tracking:** Each integration file should include a version comment that allows
`tbd setup` to detect when an update is needed:

```markdown
<!-- tbd-version: 0.1.5 -->
```

**Upgrade flow (`tbd setup --auto`):**
1. Check each installed integration’s version against current tbd version
2. If outdated, automatically update the file
3. Report what was updated

**Interactive upgrade flow (`tbd setup --interactive`):**
1. Check each installed integration’s version
2. If outdated, prompt user: “Update X? (Y/n)”
3. Default is Y (upgrade)

**Important:** The `--auto` flag should always apply updates without prompting.
This ensures CI/CD pipelines and agents always have the latest integration files.

* * *

#### 8. Surgical Init (`tbd init`)

For scripts or CI pipelines that need precise control over .tbd/ creation.

**Successful initialization:**

```
$ tbd init --prefix=myapp

Initialized tbd repository (prefix: myapp)
  ✓ Created .tbd/config.yml
  ✓ Created .tbd/.gitignore
  ✓ Initialized sync branch

Next steps:
  git add .tbd/ && git commit -m "Initialize tbd"
  tbd setup --auto   # Optional: configure agent integrations
```

**Error: No prefix provided:**

```
$ tbd init

Error: --prefix is required for tbd init

Example:
  tbd init --prefix=myapp

For automatic prefix detection, use: tbd setup --auto
```

**Error: Not in a git repository:**

```
$ tbd init --prefix=myapp

Error: Not a git repository.

tbd init requires a git repository. Either:
  1. Run 'git init' first to create a repository
  2. Navigate to an existing git repository
```

**Already initialized (no prefix provided) - no-op:**

```
$ tbd init --prefix=myapp    # First time: initializes
$ tbd init --prefix=myapp    # Second time: already initialized

Already initialized (prefix: myapp). Nothing to do.
```

**Already initialized with different prefix - update with warning:**

```
$ tbd init --prefix=myapp    # First time: initializes with myapp
$ tbd init --prefix=newapp   # Different prefix provided

Warning: Updating prefix from "myapp" to "newapp".
Existing issue IDs (myapp-xxxx) will remain unchanged.
New issues will use prefix "newapp".

  ✓ Updated .tbd/config.yml (prefix: newapp)

Note: Consider renaming existing issue IDs for consistency.
```

**Key difference from current `tbd init`:** No longer auto-calls `tbd setup auto`. It’s
purely surgical now.

### Prefix Auto-Detection Algorithm

```typescript
function autoDetectPrefix(): string {
  // 1. If beads exists, extract from beads config
  const beadsPrefix = getBeadsPrefix();
  if (beadsPrefix && isValidPrefix(beadsPrefix)) return beadsPrefix;

  // 2. Try git remote URL
  const remote = getGitRemoteUrl();
  if (remote) {
    // github.com/jlevy/tbd → "tbd"
    // git@github.com:jlevy/my-app.git → "myapp" (normalized)
    const repoName = extractRepoName(remote);
    const normalized = normalizePrefix(repoName);
    if (isValidPrefix(normalized)) return normalized;
  }

  // 3. Fall back to directory name
  const dirName = path.basename(process.cwd());
  const normalized = normalizePrefix(dirName);
  if (isValidPrefix(normalized)) return normalized;

  // 4. Ultimate fallback
  return "proj";
}

function normalizePrefix(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9]/g, '').slice(0, 8);
}

function isValidPrefix(s: string): boolean {
  // 2-8 lowercase alphanumeric chars, starting with letter
  return /^[a-z][a-z0-9]{1,7}$/.test(s);
}
```

### Prefix Requirements and Detection

**Key distinction:** `tbd init` is surgical and requires explicit `--prefix`.
`tbd setup` is smart and can reuse existing configuration.

#### `tbd init` (surgical)

`--prefix` is **ALWAYS required** for `tbd init`:

```bash
tbd init --prefix=myapp     # OK: explicit prefix
tbd init                    # ERROR: --prefix is required
```

Error message:
```
Error: --prefix is required for tbd init

Example:
  tbd init --prefix=myapp

For automatic prefix detection, use: tbd setup --auto
```

This keeps `init` predictable and explicit - no magic, no guessing.

#### `tbd setup` (smart)

`--prefix` is **optional** for `tbd setup` - it depends on context:

| Scenario | Behavior |
| --- | --- |
| Already configured (has .tbd/config.yml) | Uses existing prefix from config, no `--prefix` needed |
| Not configured, in GitHub repo | Auto-detect from remote URL, confirm with user |
| Not configured, `--auto` mode | Auto-detect prefix, no confirmation |
| Not configured, no auto-detect possible | Error: must specify `--prefix` |

**Already configured:**
```bash
$ tbd setup
# Uses prefix from .tbd/config.yml, just checks/updates integrations
```

**Not configured, needs prefix:**
```bash
$ tbd setup
# Auto-detects prefix from git remote, prompts to confirm

$ tbd setup --auto
# Auto-detects prefix, no prompts

$ tbd setup --prefix=myapp
# Uses specified prefix, no auto-detection
```

**Error when prefix required but not provided:**
```
Error: This repository is not configured for tbd.

To set up tbd:
  tbd setup --prefix=<name>   # Specify your project prefix
  tbd setup --auto            # Auto-detect prefix from git remote

For surgical initialization, use: tbd init --prefix=<name>
```

#### Outside a Git Repository

When running `tbd setup` or `tbd init` outside a git repository:

**For `tbd setup`:**
```
Warning: Not in a git repository.

Only performing global setup:
  ✓ Installed global Claude Code skill
  ✓ Updated user-level configuration

Note: Repository initialization skipped.
To set up tbd in a specific repository:
  1. cd /path/to/your/repo
  2. tbd setup --auto
```

**For `tbd init`:**
```
Error: Not a git repository.

tbd init requires a git repository. Either:
  1. Run 'git init' first to create a repository
  2. Navigate to an existing git repository
```

### Edge Cases

| Scenario | Behavior |
| --- | --- |
| Not a git repo (`tbd init`) | Error with suggestion to run `git init` |
| Not a git repo (`tbd setup`) | Warning, global-only setup, instructs user to run in repo |
| No remote, weird dir name | Prompt for prefix (or error in `--auto` mode) |
| Beads + already has .tbd/ | Skip migration, just check integrations |
| `--from-beads` but no .beads/ | Error: "No .beads/ directory found" |
| CI environment (no TTY) | Auto-detect non-interactive, use defaults |

### Clean Command Model (No Deprecations)

This is a new tool. We remove confusing patterns entirely rather than deprecating them.

**Removed commands:**

- `tbd setup auto` → Use `tbd setup --auto` (flag, not subcommand)
- `tbd import --from-beads` → Use `tbd setup --from-beads`
- `tbd setup beads --disable` → Integrated into `--from-beads` flow

**Clean two-tier model:**

| Tier | Command | Purpose |
| --- | --- | --- |
| High-level | `tbd setup --auto` | **Recommended**: full automatic setup (for agents) |
| High-level | `tbd setup --interactive` | Interactive setup with prompts (for humans) |
| High-level | `tbd setup` | Shows help (requires flag or subcommand) |
| High-level | `tbd setup claude` | Add specific integration |
| Low-level | `tbd init` | Surgical: just create .tbd/ |

**When to use `tbd init` (surgical):**

- CI pipelines where integrations are configured separately
- Scripts that need predictable, minimal behavior
- Users who want explicit control over each step
- Testing and development workflows

Example surgical workflow:

```bash
# CI script that sets up tbd without agent integrations
tbd init --prefix=myapp
git add .tbd/
git commit -m "Initialize tbd"

# Later, add integrations as needed:
tbd setup claude
```

## Stage 2: Architecture Stage

### Files to Modify

| File | Changes |
| --- | --- |
| `commands/setup.ts` | Add default handler, beads detection, full setup flow |
| `commands/init.ts` | Remove `setup auto` call, add prefix auto-detection, make surgical |
| `commands/import.ts` | Add deprecation notice for `--from-beads` |
| `cli/cli.ts` | Update help footer |
| `lib/prefix-detection.ts` | New file for prefix auto-detection |
| `SKILL.md` | Update to mention `tbd setup` as entry point |
| `docs/tbd-design.md` | Update §6.4 Installation section |

### Integration File Formats

Each integration has specific file format requirements.
These must be correct for the integration to work properly.

#### Claude Code Integration

**Files created:**
- `.claude/settings.json` - Hook configuration
- `.claude/skills/tbd/SKILL.md` - Skill file (plain markdown)

**Hook configuration format:**
```json
{
  "hooks": {
    "SessionStart": [{ "matcher": "", "hooks": [{ "type": "command", "command": "tbd prime" }] }],
    "PreCompact": [{ "matcher": "", "hooks": [{ "type": "command", "command": "tbd prime" }] }]
  }
}
```

**Skill file:** Plain markdown, copied from `docs/skill.md`.

#### Cursor IDE Integration

**Files created:**
- `.cursor/rules/tbd.mdc` - MDC rules file

**IMPORTANT (fixes #23):** Cursor MDC files MUST have YAML frontmatter to be recognized.
Without frontmatter, Cursor will not activate the rules.

**Source file:** `packages/tbd/src/docs/CURSOR.mdc`

This file contains the complete MDC content with proper frontmatter.
The content after the frontmatter should be the same as SKILL.md (or a cursor-specific
variant if needed).

**Implementation note:** The frontmatter must NOT be hardcoded in TypeScript.
All content should be stored in content files (`src/docs/`) and loaded at runtime.
This keeps content maintainable and avoids mixing prose with code.

**Required MDC format:**
```markdown
---
description: Lightweight git-native issue tracking. Invoke when user mentions tbd, beads, tasks, issues, or bugs.
alwaysApply: false
---

# tbd Workflow

[Rest of skill content from SKILL.md...]
```

**Frontmatter fields:**
- `description`: Brief description for Cursor’s rule selector (required)
- `alwaysApply`: Whether to always include in context (default: false)
- `globs`: Optional file patterns to auto-apply (e.g., `[".tbd/**"]`)

#### AGENTS.md Integration

**Files created:**
- `AGENTS.md` - Plain markdown file at repo root

**Format:** Plain markdown, similar to SKILL.md but adapted for generic agents.
No frontmatter required.

### New Module: prefix-detection.ts

```typescript
// packages/tbd/src/cli/lib/prefix-detection.ts
export function autoDetectPrefix(): string;
export function normalizePrefix(s: string): string;
export function isValidPrefix(s: string): boolean;
export function extractRepoNameFromRemote(url: string): string | null;
export function getBeadsPrefix(): string | null;
```

### Setup Handler Flow

```typescript
class SetupDefaultHandler extends BaseCommand {
  async run(options: SetupOptions): Promise<void> {
    // 1. Check git repo
    if (!isGitRepo()) throw new CLIError("Not a git repository");

    // 2. Detect state
    const hasTbd = await isInitialized();
    const hasBeads = await hasBeadsDirectory();

    // 3. Route to appropriate flow
    if (hasTbd) {
      await this.handleAlreadyInitialized(options);
    } else if (hasBeads && !options.skipBeadsMigration) {
      await this.handleBeadsMigration(options);
    } else {
      await this.handleFreshSetup(options);
    }
  }
}
```

## Stage 3: Implementation

### Phase 1: Prefix Auto-Detection

- [x] Create `lib/prefix-detection.ts` with auto-detection logic
- [x] Add tests for various remote URL formats
- [x] Add beads prefix extraction

### Phase 2: Setup Default Handler

- [x] Create SetupDefaultHandler class in setup.ts
- [x] Implement fresh setup flow
- [x] Implement already-initialized flow
- [x] Implement `--auto` non-interactive mode
- [x] Add `--init-only` flag
- [x] Add `--prefix` override flag

### Phase 3: Beads Migration Integration

- [x] Move beads import logic into setup flow
- [x] Auto-detect .beads/ and prompt for migration
- [x] Add `--from-beads` flag for explicit migration
- [x] Integrate beads disable into migration flow

### Phase 4: Command Cleanup

- [x] Update `tbd init` to NOT call `setup auto` (make it surgical)
- [x] Update `tbd init` to REQUIRE `--prefix` (no auto-detection for surgical init)
- [x] Add `tbd init` error handling for already-initialized repos (see spec)
- [x] Remove `tbd setup auto` subcommand (use `--auto` flag instead)
- [x] Remove `tbd import --from-beads` (use `tbd setup --from-beads`)
- [x] Remove `tbd setup beads --disable` (folded into migration flow)

### Phase 4.5: Integration File Format Fixes

- [x] Create `src/docs/CURSOR.mdc` with proper MDC frontmatter (fixes #23)
- [x] Update `getCursorRulesContent()` to load from CURSOR.mdc file
- [x] Ensure all integration content is in `src/docs/` files, NOT hardcoded in
  TypeScript
- [x] Ensure Claude Code skill file uses correct markdown format
- [x] Add tests for integration file format correctness
- [x] Ensure `tbd setup` upgrades existing integrations with corrected formats

### Phase 5: Documentation & Help

- [x] Update help footer in cli.ts with one-liner
- [x] Add help text for `tbd setup --help` showing surgical option
- [x] Add help text for `tbd init --help` explaining when to use it
- [ ] Update design doc §6.4 - partial, main docs updated
- [x] Update README with prominent one-liner:
  `npm install -g tbd-git@latest && tbd setup --auto`

### Phase 6: Prime-First Implementation

- [x] Create `tbd skill` command that outputs SKILL.md content
- [x] Add `--brief` flag to `tbd skill` for condensed output
- [x] Refactor `tbd prime` to output dashboard instead of skill content
- [x] Add `--brief` flag to `tbd prime` for compact status
- [x] Make `tbd` (no args) run `tbd prime`
- [ ] Remove `tbd help` command (show deprecation warning pointing to `--help`) - no
  separate help command exists

### Phase 7: Agent Messaging Consistency

- [x] Update SKILL.md context recovery to reference `tbd skill` (not `tbd prime`)
- [x] Have `tbd setup --auto` output dashboard after setup completes
- [x] Update hooks to call `tbd prime` (dynamic context recovery)
- [x] Ensure all SKILL.md copies are in sync:
  - `packages/tbd/src/docs/SKILL.md` (source of truth)
  - `docs/SKILL.md` (repo-level copy for reference)
- [x] Test the full agent flow:
  1. Agent reads SKILL.md → runs `tbd setup --auto`
  2. Setup completes → outputs dashboard
  3. Next session → hook calls `tbd prime` → full workflow context

### Phase 8: Testing

- [x] Unit tests for prefix auto-detection
- [x] Integration tests for all setup flows
- [ ] Golden tests for output formats - basic tests added
- [x] Test removed commands show helpful error with correct alternative

## Open Questions (Resolved)

1. ~~Should we keep `tbd init`?~~ → **Yes, as the surgical option (not deprecated)**
2. ~~What about backward compatibility?~~ → Not a primary concern per user request
3. ~~Should beads migration be automatic?~~ → Yes in `--auto` mode, prompt in
   `--interactive`
4. ~~Should `tbd setup` run without args?~~ → **No, shows help.
   Must use `--interactive` or `--auto` to prevent agents accidentally running
   interactive mode.**
5. ~~Should `tbd init` still call `setup auto`?~~ → **No, that was confusing.
   Init is now purely surgical.**

## Design Summary

| Command | Purpose | Integrations? |
| --- | --- | --- |
| `tbd setup` | Shows help (requires flag) | N/A |
| `tbd setup --interactive` | Interactive for humans | Yes (auto-detect) |
| `tbd setup --auto` | Non-interactive for agents | Yes (auto-detect) |
| `tbd init` | Surgical repo initialization | No |
| `tbd setup claude` | Add specific integration | Just Claude |

**Mental model:** Think of `tbd setup --auto` like “npm create” (full setup) and
`tbd init` like “npm init” (minimal, predictable).
The `--interactive` flag is for humans who want step-by-step confirmation.

## Prime-First Design

### Core Concept

Running `tbd` with no arguments shows a dashboard that orients users to the project.
This replaces showing help text.

```
tbd                    # Runs tbd prime (dashboard)
tbd prime              # Same as above, explicit
tbd skill              # Output full skill file (for AI agents)
tbd --help             # CLI reference
```

### `tbd` / `tbd prime` Output (Initialized)

`tbd prime` is THE context recovery command for agents.
It outputs dashboard + condensed workflow rules.
This is what hooks call.

```
tbd v1.2.3

--- INSTALLATION ---
✓ tbd installed (v1.2.3)
✓ Initialized in this repo
✓ Hooks installed

--- PROJECT STATUS ---
Repository: ai-trade-arena
Sync: ✓ Up to date with remote
Issues: 3 open (1 in_progress) | 0 blocked

--- WORKFLOW RULES ---
- Track all task work as issues using tbd
- Check tbd ready for available work
- Run tbd sync at session end

--- QUICK REFERENCE ---
tbd ready              Show issues ready to work
tbd show <id>          View issue details
tbd create "title"     Create new issue
tbd close <id>         Mark issue complete
tbd sync               Sync with remote

For full documentation: tbd skill
For CLI reference: tbd --help
```

### `tbd prime` Output (Not Initialized)

```
tbd v1.2.3

--- PROJECT NOT INITIALIZED ---
✗ Not initialized in this repository

To set up tbd in this project:

  tbd setup --auto              # Non-interactive (for agents)
  tbd setup --interactive       # Interactive (for humans)

After setup, run 'tbd' again to see project status.

For CLI reference: tbd --help
```

### `tbd skill`

Outputs the full AI agent skill file (SKILL.md).
This is the complete reference with all workflow patterns, examples, and command
documentation.

```bash
tbd skill              # Output full SKILL.md content
tbd skill --brief      # Output just the condensed workflow rules (subset of prime)
```

**Relationship between commands:**

```
┌─────────────────────────────────────────────────────────────┐
│ tbd prime (context recovery)                                │
│ ┌─────────────────────────────────────────────────────────┐ │
│ │ Dashboard: installation, project status, issue counts  │ │
│ └─────────────────────────────────────────────────────────┘ │
│ ┌─────────────────────────────────────────────────────────┐ │
│ │ tbd skill --brief: condensed workflow rules            │ │
│ └─────────────────────────────────────────────────────────┘ │
│ ┌─────────────────────────────────────────────────────────┐ │
│ │ Quick reference: common commands                        │ │
│ └─────────────────────────────────────────────────────────┘ │
│ Footer: "For full documentation: tbd skill"                 │
└─────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────┐
│ tbd skill (full reference = SKILL.md)                       │
│ - Complete workflow patterns with examples                  │
│ - All command documentation                                 │
│ - Session protocols                                         │
│ - Mentions "tbd prime" for quick context recovery           │
└─────────────────────────────────────────────────────────────┘
```

**Static vs Dynamic:**
- `tbd skill` = **STATIC** - outputs bundled file content, same every time
- `tbd prime` = **DYNAMIC** - queries real-time status, issue counts, sync state

**Source files:**
- `docs/skill.md` → Full skill documentation (source of truth)
- `docs/skill-brief.md` → Condensed workflow rules (subset)

**Dual-purpose content:** Both skill files serve two audiences:
1. **Agent instructions** - Technical guidance on how to use tbd commands
2. **User communication** - How agents should help users understand tbd’s value

**When user invokes `/tbd`:** The agent should NOT just output technical instructions.
Instead, it should explain the VALUE of using tbd with Claude Code:
- What problems tbd solves (tracking work, planning tasks, managing dependencies)
- How tbd helps with AI-assisted development
- Suggestions for how the user can leverage tbd (e.g., “I can help you plan this feature
  by breaking it into tracked issues”, “Let me check what tasks are ready to work on”)

The skill content should:
- Give agents all essential commands and workflow patterns (for agent’s internal use)
- Encourage agents to proactively suggest tbd usage for planning and tracking
- Help agents communicate tbd’s value proposition to users
- Guide agents on answering user questions about tbd functionality

**Command → file mapping:**
- `tbd skill` → outputs `docs/skill.md` (static)
- `tbd skill --brief` → outputs `docs/skill-brief.md` (static)
- `tbd prime` → dynamic dashboard + `docs/skill-brief.md` content + quick reference
- `tbd setup claude` → copies `docs/skill.md` to `.claude/skills/tbd/SKILL.md`

**Note:** SKILL.md installed by `tbd setup claude` is identical to `docs/skill.md`.

### `tbd status`

Full status showing installation, project setup, sync state, and issue counts:

```
--- INSTALLATION ---
✓ tbd installed (v1.2.3)
✓ Global hooks configured
i Update available: v1.2.4 (npm install -g tbd-git@latest)

--- PROJECT ---
✓ Initialized in this repo
✓ Project hooks installed
✓ Skill file installed (.claude/skills/tbd/SKILL.md)

--- SYNC ---
✓ Up to date with remote
  Last sync: 2 minutes ago

--- ISSUES ---
  3 open (1 in_progress, 2 ready)
  0 blocked
  12 closed this week
```

**Flags:**
- `tbd status --installation` - Installation health only (global + user level)
- `tbd status --project` - Project-specific only (setup, sync, issues)
- `tbd status --brief` - Compact summary

### `tbd doctor`

Comprehensive diagnostic that includes everything from `tbd status` plus additional
checks and suggestions:

- Git configuration checks
- Orphaned/stale issue detection
- Circular dependency detection
- Actionable suggestions for common problems

### `tbd --help`

Standard CLI help. The standalone `tbd help` command is removed in favor of:

- `tbd --help` - Full CLI reference
- `tbd <command> --help` - Command-specific help
- `tbd prime` - Includes pointers to help

This follows standard CLI conventions (git, npm, docker, etc.).

### Command Summary Table

| Command | Purpose |
| --- | --- |
| `tbd` | Context recovery (same as `tbd prime`) |
| `tbd prime` | Dashboard + condensed skill + quick reference (hooks call this) |
| `tbd skill` | Full SKILL.md output (complete reference) |
| `tbd skill --brief` | Just the condensed workflow rules (subset of prime) |
| `tbd status` | Full health check (install + project + sync + issues) |
| `tbd status --installation` | Global/user-level only |
| `tbd status --project` | Project-specific only |
| `tbd status --brief` | Compact status |
| `tbd doctor` | Status + diagnostics + suggestions |
| `tbd --help` | CLI reference |
| `tbd <cmd> --help` | Command-specific help |
| ~~`tbd help`~~ | Removed (use `--help`) |

## Agent Messaging Consistency

### The Three Agent States

When an AI agent encounters tbd, it’s in one of three states:

| State | How Agent Gets Context | Entry Point |
| --- | --- | --- |
| **Not installed** | Reads SKILL.md from skill/rules file | `tbd setup --auto` |
| **Installed, new session** | SessionStart hook calls `tbd prime` | Automatic |
| **Mid-session, after compaction** | PreCompact hook calls `tbd prime` | Automatic |

### Messaging Flow

```
┌─────────────────────────────────────────────────────────────────────────┐
│ Agent sees SKILL.md (via Claude skill, Cursor rules, AGENTS.md)         │
│                                                                         │
│ SKILL.md says:                                                          │
│   npm install -g tbd-git@latest && tbd setup --auto                     │
└─────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────┐
│ Agent runs: tbd setup --auto                                            │
│                                                                         │
│ Output:                                                                 │
│   ✓ Initialized tbd (prefix: myapp)                                     │
│   ✓ Configured Claude Code                                              │
│                                                                         │
│ Then automatically outputs dashboard (tbd prime):                       │
│   ─────────────────────────────────────────────────                     │
│   --- PROJECT STATUS ---                                                │
│   [Dashboard with status + quick start + pointer to tbd skill]          │
└─────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────┐
│ Subsequent sessions: SessionStart hook runs `tbd prime`                 │
│ After compaction: PreCompact hook runs `tbd prime`                      │
│                                                                         │
│ Dynamic dashboard + condensed rules, ensuring context is available      │
└─────────────────────────────────────────────────────────────────────────┘
```

### Content Consistency Requirements

All three sources MUST contain identical workflow instructions:

1. **SKILL.md** - Bundled with tbd, installed to `.claude/skills/tbd/SKILL.md`
2. **`tbd skill` output** - Outputs SKILL.md content
3. **Cursor rules / AGENTS.md** - Also derived from SKILL.md

**Single source of truth:** `packages/tbd/src/docs/SKILL.md`

### SKILL.md Updates Required

The Installation and Context Recovery sections in SKILL.md must be updated:

````markdown
## Installation

If `tbd` is not installed, install and set up in one command:

```bash
npm install -g tbd-git@latest && tbd setup --auto
````

This initializes tbd and configures your coding agent automatically.

`tbd` provides lightweight, git-native task and issue tracking using beads, which are
just lightweight issues managed from the CLI.

> **Context Recovery**: Run `tbd prime` after compaction, clear, or new session.
> Hooks auto-call this in Claude Code when .tbd/ detected.
````

### `tbd setup --auto` Output Behavior

When `tbd setup --auto` completes successfully:

1. Print setup summary (what was initialized/configured)
2. Print separator line
3. Output dashboard (`tbd prime`) automatically

This gives the agent orientation (status + quick start) after setup. The agent
already has SKILL.md in its context from the skill file, so the dashboard
confirms success and shows next steps.

**Implementation:** Call `runPrime()` at the end of SetupDefaultHandler when
`--auto` flag is used.

### `tbd prime` Behavior (CHANGED)

New behavior - **DYNAMIC** context recovery command:
- Outputs dashboard with installation status, project status (real-time)
- Includes condensed workflow rules from `docs/skill-brief.md`
- Includes quick command reference
- Points to `tbd skill` for full documentation
- Silent exit if not in a tbd project (exit 0, no output)
- **This is what hooks call for context recovery**

### `tbd skill` Behavior (NEW)

New command - **STATIC** skill file output:
- Outputs full `docs/skill.md` content (same as installed SKILL.md)
- Supports `--brief` flag to output `docs/skill-brief.md` (condensed rules only)
- Used for reference, installation, or when agent needs full documentation

### Hook Configuration

The hooks installed by `tbd setup claude` call `tbd prime`:

```json
{
  "hooks": {
    "SessionStart": [{ "matcher": "", "hooks": [{ "type": "command", "command": "tbd prime" }] }],
    "PreCompact": [{ "matcher": "", "hooks": [{ "type": "command", "command": "tbd prime" }] }]
  }
}
````

This ensures agents always have dynamic context (status + condensed rules) at session
start and after compaction.
