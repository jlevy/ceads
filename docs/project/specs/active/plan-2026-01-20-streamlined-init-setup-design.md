# Plan Spec: Streamlined Init/Setup Design

## Purpose

Design a cleaner, more intuitive onboarding flow for tbd that works seamlessly for both
humans and AI agents, whether setting up a brand new repo, migrating from beads, or
joining an existing tbd project.

## Background

tbd currently has multiple setup-related commands that overlap in confusing ways:

- `tbd init --prefix=<name>` - Initializes tbd repo, then auto-calls `setup auto`
- `tbd setup` - Parent command that shows subcommands but does nothing by itself
- `tbd setup auto` - Auto-detects and configures editor integrations
- `tbd import --from-beads` - Auto-initializes + imports from beads

This creates confusion: Should users run `init` or `setup` or `import`? The answer
depends on their situation, but the commands don’t guide them.

## Summary of Task

Unify the onboarding experience around a single entry point: **`tbd setup`**

This one command handles all scenarios:

1. New repo → initialize + configure integrations
2. Existing tbd repo → check/update integrations
3. Beads migration → import + initialize + configure
4. Agents → non-interactive mode with sensible defaults

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

**One command to rule them all: `tbd setup`**

```
tbd setup                    # Does the right thing based on context
```

- Detects current state (no tbd?
  has beads? already initialized?)
- Handles all scenarios with smart defaults
- Interactive by default, `--auto` for agents
- Subcommands for surgical operations

### Proposed Command Structure

```
tbd                           # Shows --help with "Run: tbd setup" guidance
tbd setup [options]           # THE primary entry point
  --auto                      # Non-interactive mode (for agents/scripts)
  --from-beads                # Migrate from beads (can also auto-detect)
  --prefix=<name>             # Override auto-detected prefix
  --init-only                 # Just initialize, skip integrations
  tbd setup claude            # Just Claude integration
  tbd setup cursor            # Just Cursor integration
  tbd setup codex             # Just AGENTS.md
  tbd setup check             # Check all integration status (new)
tbd import <file>             # Import from exported JSONL file (rare)
```

### Deprecated Commands

| Command | Replacement |
| --- | --- |
| `tbd init` | `tbd setup` or `tbd setup --init-only` |
| `tbd init --prefix=x` | `tbd setup --prefix=x` |
| `tbd setup auto` | `tbd setup` (it's the default now) |
| `tbd import --from-beads` | `tbd setup --from-beads` or auto-detected |
| `tbd setup beads --disable` | Part of `tbd setup --from-beads` flow |

### User Journeys (New)

| Journey | Command | What Happens |
| --- | --- | --- |
| New repo | `tbd setup` | Auto-detect prefix → init → integrations |
| Has beads | `tbd setup` | Detect beads → offer migration → init → integrations |
| Joining tbd repo | `tbd setup` | Detect .tbd → check/update integrations |
| Agent automation | `tbd setup --auto` | All defaults, no prompts |
| Explicit beads | `tbd setup --from-beads` | Force beads migration flow |
| Script init only | `tbd setup --init-only` | Just create .tbd/, no integrations |

### Detailed Behavior Specifications

#### 1. Help Footer

Add to bottom of `tbd --help`:

```
Getting Started:
  New to tbd? Run:  npm install -g tbd-git && tbd setup

  This will guide you through setup and configure your coding agents.
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

```
$ tbd setup

tbd: Git-native issue tracking for AI agents and humans

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
$ tbd setup

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
  tbd setup --prefix=<name>

To migrate later:
  tbd setup --from-beads
```

#### 5. Already Initialized Flow (.tbd/ exists)

```
$ tbd setup

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

#### 6. Non-Interactive Mode (`--auto`)

```
$ tbd setup --auto

tbd: Git-native issue tracking for AI agents and humans

Checking repository...
  ✓ Git repository detected
  ✗ tbd not initialized

Initializing with auto-detected prefix "tbd"...
  ✓ Created .tbd/config.yml
  ✓ Initialized sync branch

Configuring integrations...
  ✓ Claude Code - Installed hooks and skill

Setup complete!
  Run: git add .tbd/ .claude/ && git commit -m "Initialize tbd"
```

With beads detected in auto mode:

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

```
$ tbd setup --from-beads

# Same as beads migration flow, but skips the "Migrate?" prompt
```

#### 8. Init Only (`--init-only`)

For scripts that just need .tbd/ created:

```
$ tbd setup --init-only

Initialized tbd repository (prefix: tbd)
  Run `tbd setup` to configure integrations
```

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

### Edge Cases

| Scenario | Behavior |
| --- | --- |
| Not a git repo | Error with suggestion to run `git init` |
| No remote, weird dir name | Use "proj" as fallback |
| Beads + already has .tbd/ | Skip migration, just check integrations |
| `--from-beads` but no .beads/ | Error: "No .beads/ directory found" |
| CI environment (no TTY) | Auto-detect non-interactive, use defaults |

### What Happens to Old Commands?

| Old Command | New Behavior |
| --- | --- |
| `tbd init` | Works, but prints deprecation notice pointing to `tbd setup` |
| `tbd init --prefix=x` | Works, prints deprecation notice |
| `tbd setup auto` | Works, prints deprecation notice |
| `tbd import --from-beads` | Works, prints deprecation notice |
| `tbd setup beads --disable` | Removed (integrated into migration flow) |

Deprecation message example:

```
$ tbd init --prefix=myapp

Note: `tbd init` is deprecated. Use `tbd setup` instead.

Initialized tbd repository...
```

## Stage 2: Architecture Stage

### Files to Modify

| File | Changes |
| --- | --- |
| `commands/setup.ts` | Add default handler, beads detection, full setup flow |
| `commands/init.ts` | Add deprecation notice, keep working for compatibility |
| `commands/import.ts` | Add deprecation notice for `--from-beads` |
| `cli/cli.ts` | Update help footer |
| `lib/prefix-detection.ts` | New file for prefix auto-detection |
| `SKILL.md` | Update to mention `tbd setup` as entry point |
| `docs/tbd-design.md` | Update §6.4 Installation section |

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

- [ ] Create `lib/prefix-detection.ts` with auto-detection logic
- [ ] Add tests for various remote URL formats
- [ ] Add beads prefix extraction

### Phase 2: Setup Default Handler

- [ ] Create SetupDefaultHandler class in setup.ts
- [ ] Implement fresh setup flow
- [ ] Implement already-initialized flow
- [ ] Implement `--auto` non-interactive mode
- [ ] Add `--init-only` flag
- [ ] Add `--prefix` override flag

### Phase 3: Beads Migration Integration

- [ ] Move beads import logic into setup flow
- [ ] Auto-detect .beads/ and prompt for migration
- [ ] Add `--from-beads` flag for explicit migration
- [ ] Integrate beads disable into migration flow

### Phase 4: Deprecation Notices

- [ ] Add deprecation notice to `tbd init`
- [ ] Add deprecation notice to `tbd setup auto`
- [ ] Add deprecation notice to `tbd import --from-beads`
- [ ] Remove `tbd setup beads --disable` (folded into migration)

### Phase 5: Documentation & Help

- [ ] Update help footer in cli.ts
- [ ] Update SKILL.md to reference `tbd setup`
- [ ] Update design doc §6.4
- [ ] Update README if exists

### Phase 6: Testing

- [ ] Unit tests for prefix auto-detection
- [ ] Integration tests for all setup flows
- [ ] Golden tests for output formats
- [ ] Test deprecation notice display

## Open Questions (Resolved)

1. ~~Should we keep `tbd init`?~~ → Yes, with deprecation notice for compatibility
2. ~~What about backward compatibility?~~ → Not a concern per user request
3. ~~Should beads migration be automatic?~~ → Yes in `--auto` mode, prompt otherwise
4. ~~Should `tbd setup` run without args?~~ → Yes, it’s the primary entry point now
