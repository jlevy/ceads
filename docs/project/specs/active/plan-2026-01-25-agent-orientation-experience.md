# Plan Spec: Agent Orientation and Onboarding Experience

**Date:** 2026-01-25 **Author:** Claude **Status:** Draft

## Overview

Design a comprehensive orientation and onboarding experience for tbd that enables AI
agents to understand the tool holistically, install it correctly, and use it effectively
to help users achieve their goals.
The experience should work end-to-end from initial discovery through full productive
use.

**Key insight:** The agent should not just read instructions and tell the user to use
the tool. Instead, the agent should understand tbd’s value proposition, internalize its
capabilities, and proactively use tbd to help users achieve objectives like tracking
work, planning features, following best practices, and managing development workflows.

## Goals

- **Zero-friction onboarding**: An agent should be able to install tbd, run `tbd` with
  no args, and receive complete orientation for both installation and usage
- **Agent-first orientation**: Provide agents with a clear mental model of *why* tbd
  exists and *how* it helps users, not just command syntax
- **Comprehensive documentation access**: Make all documentation (shortcuts, guidelines,
  templates, design docs) easily discoverable through organized help
- **Support all user scenarios**: Handle new projects, existing beads migration, and
  joining existing tbd projects gracefully
- **Value communication**: Enable agents to explain tbd’s benefits to users who may not
  understand what the tool does

## Non-Goals

- Redesigning the core issue tracking functionality (that’s stable)
- Building a GUI or web interface
- Supporting non-AI-agent workflows as the primary use case
- Extensive customization of documentation format per IDE

## Background

### Current State

tbd currently has:
- **Installation**: `npm install -g tbd-git@latest && tbd setup --auto --prefix=<name>`
- **Prime command**: `tbd` (no args) outputs a dashboard with status and quick reference
- **Skill file**: Full agent instructions available via `tbd skill`
- **Documentation commands**: `tbd docs`, `tbd shortcut`, `tbd guidelines`,
  `tbd template`, `tbd design`
- **Help**: `tbd --help` shows all commands

### What’s Working

1. The prime command provides good session-start context
2. The skill file covers core workflow well
3. Shortcuts, guidelines, and templates are useful resources
4. Setup flow handles most scenarios

### Gaps Identified

1. **No high-level orientation**: The skill file jumps into commands without explaining
   *why* an agent would use tbd or what user problems it solves
2. **Fragmented documentation**: Docs are spread across multiple commands (`docs`,
   `shortcut`, `guidelines`, `template`, `design`) without a unified discovery mechanism
3. **Agent-as-messenger problem**: Current instructions risk the agent just telling
   users “run this command” rather than using tbd proactively to help
4. **No value proposition**: Nothing explains the categories of help tbd provides
5. **Help not hierarchical**: Current help is a flat list; no organization by purpose

## Design

### Core Philosophy: Agent as Partner, Not Messenger

The fundamental shift is from:
> “Here are commands you can tell the user about”

To:
> “Here’s how tbd helps you (the agent) serve the user better”

The agent should understand that tbd provides capabilities in these categories:

#### 1. Issue Tracking (Core)

**What it is**: Lightweight git-native task and issue tracking (beads)

**How it helps the agent serve the user**:
- Track discovered work, bugs, and future tasks without losing them
- Plan complex features by breaking them into trackable issues
- Maintain continuity across sessions (issues persist in git)
- Communicate progress clearly (status updates, closing with reasons)

**When the agent should use it**:
- User mentions a bug → create an issue
- User describes a feature → plan it as issues with dependencies
- Starting a session → check `tbd ready` for available work
- Completing work → close issues with clear reasons
- Discovering follow-up work → create new issues

#### 2. Coding Guidelines and Best Practices

**What it is**: A library of guidelines for writing better code

**How it helps the agent serve the user**:
- Pull in relevant guidelines when working in specific domains
- Apply consistent best practices (TDD, TypeScript rules, testing patterns)
- Avoid common pitfalls documented in guidelines

**When the agent should use it**:
- Writing TypeScript CLI code → `tbd guidelines typescript-cli-tool-rules`
- Writing tests → `tbd guidelines general-tdd-guidelines`

#### 3. Spec-Driven Workflows

**What it is**: A methodology for planning features through specs, then implementing
them systematically using issues to track each part.

**How it helps the agent serve the user**:
- Structure complex work before diving into code
- Create planning specs that capture requirements and design decisions
- Break specs into trackable issues (beads) with dependencies
- Implement systematically, closing issues as each part is completed
- Maintain clear documentation of what was built and why

**The spec-driven workflow**:
1. **Plan**: Create a planning spec (`tbd shortcut new-plan-spec`)
2. **Break down**: Convert spec into implementation issues
   (`tbd shortcut new-implementation-beads-from-spec`)
3. **Implement**: Work through issues systematically (`tbd shortcut implement-beads`)
4. **Validate**: Create validation plan, run tests (`tbd shortcut new-validation-plan`)
5. **Ship**: Commit, create PR, get it merged (`tbd shortcut commit-code`,
   `tbd shortcut create-or-update-pr-with-validation-plan`)

**When the agent should use it**:
- User describes a non-trivial feature → suggest creating a plan spec first
- Working on something with multiple steps → break into issues
- Need to communicate the plan → write a spec
- Implementing from a spec → use `implement-beads` shortcut

#### 4. Convenience Shortcuts

**What it is**: Pre-built processes for common development tasks that streamline
repetitive workflows.

**How it helps the agent serve the user**:
- Follow consistent processes without reinventing the wheel
- Reduce mistakes by using validated workflows
- Save time on routine tasks

**Available shortcuts by category**:

| Category | Shortcuts | Purpose |
| --- | --- | --- |
| **Planning** | `new-plan-spec`, `new-research-brief`, `new-architecture-doc` | Structure thinking before coding |
| **Issue Creation** | `new-implementation-beads-from-spec` | Break plans into trackable work |
| **Implementation** | `implement-beads` | Execute planned work with TDD |
| **Validation** | `new-validation-plan`, `precommit-process` | Ensure quality before shipping |
| **Shipping** | `commit-code`, `create-or-update-pr-simple`, `create-or-update-pr-with-validation-plan` | Ship code professionally |
| **Review** | `review-code-typescript`, `review-code-python` | Apply code review best practices |

**When the agent should use shortcuts**:
- Ready to commit → `tbd shortcut commit-code`
- Need to create a PR → `tbd shortcut create-or-update-pr-simple`
- Reviewing code → `tbd shortcut review-code-typescript`

### Proposed Information Architecture

#### Command Hierarchy for Orientation

The key insight is that `tbd` (no args) = `tbd prime` is THE primary orientation
command. It should give complete orientation for both agents and humans in one place.

**Two levels only:**

```
┌─────────────────────────────────────────────────────────────────────────────┐
│ tbd / tbd prime (no args)                                                   │
│ THE primary orientation command (~200 lines, full orientation)              │
│                                                                             │
│ DYNAMIC content:                                                            │
│ • Installation status (is tbd installed? initialized? hooks configured?)    │
│ • Project status (issue counts, what's ready, what's blocked)               │
│                                                                             │
│ STATIC content (from tbd skill):                                            │
│ • Full SKILL.md content                                                     │
│ • Value proposition (what tbd is, four capabilities)                        │
│ • Setup rules (including prefix rule)                                       │
│ • Core workflow rules and session protocol                                  │
│ • All commands with examples                                                │
│ • Shortcut directory                                                        │
│                                                                             │
│ Points to: tbd --help (CLI reference)                                       │
└─────────────────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────────────────┐
│ tbd prime --brief                                                           │
│ Abbreviated orientation (~35 lines)                                         │
│                                                                             │
│ DYNAMIC content:                                                            │
│ • Installation status                                                       │
│ • Project status (condensed)                                                │
│                                                                             │
│ STATIC content (from tbd skill --brief):                                    │
│ • Condensed workflow rules                                                  │
│ • Core commands quick reference                                             │
│ • Session closing checklist                                                 │
│                                                                             │
│ Points to: tbd prime for full orientation                                   │
└─────────────────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────────────────┐
│ tbd skill                                                                   │
│ STATIC skill file content (for .claude/skills/, Cursor rules, etc.)         │
│                                                                             │
│ • Full SKILL.md content (~200 lines)                                        │
│ • This is what gets checked into repos for agents to read statically        │
│ • Same static content used by tbd prime                                     │
└─────────────────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────────────────┐
│ tbd skill --brief                                                           │
│ Condensed workflow rules (~35 lines)                                        │
│                                                                             │
│ • Used by tbd prime --brief for its static content                          │
│ • Core workflow, session protocol, key principles                           │
└─────────────────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────────────────┐
│ tbd --help                                                                  │
│ Standard CLI help (command list, flags)                                     │
│                                                                             │
│ • Standard --help behavior like any CLI tool                                │
│ • EPILOGUE: "Run 'tbd prime' for orientation and workflow guidance"         │
└─────────────────────────────────────────────────────────────────────────────┘
```

**Key relationships:**
- `tbd` = `tbd prime` (same command)
- `tbd prime` uses `tbd skill` content + dynamic status (full orientation)
- `tbd prime --brief` uses `tbd skill --brief` content + condensed dynamic status
- `tbd skill` is purely static (for file installation)

#### IMPORTANT: Informational Commands

**Many tbd commands are purely informational.** They don’t perform actions - they
display instructions, guidelines, or templates that tell the agent *how* to do something
well.

| Command | What It Does |
| --- | --- |
| `tbd prime` | Displays orientation and workflow guidance |
| `tbd shortcut <name>` | Displays step-by-step instructions for a task |
| `tbd guidelines <name>` | Displays coding best practices and patterns |
| `tbd template <name>` | Displays a document template to use |

**Key principle for agents:** When unsure how to best accomplish a task, **always run
the relevant informational command first**. These commands provide:
- Quality guidelines that improve outcomes
- Time-saving tips and patterns
- Step-by-step processes that avoid mistakes
- Best practices specific to the task

**Example:** Before writing a TypeScript CLI tool, run
`tbd guidelines typescript-cli-tool-rules` to get comprehensive guidance on Commander.js
patterns, color handling, output formatting, and more.
This takes seconds but dramatically improves the quality of the result.

**When in doubt, query tbd first.** The informational commands are free to run and often
contain hard-won knowledge that prevents common mistakes.

#### Documentation Commands

```
tbd docs
├── tbd docs --all (NEW - comprehensive doc listing)
├── tbd docs <topic> (existing - specific section)
└── Topics organized by purpose (NEW)

tbd shortcut
├── tbd shortcut --list (existing)
├── tbd shortcut --category planning|implementation|shipping (NEW)
└── tbd shortcut <name> (existing)

tbd guidelines
├── tbd guidelines --list (existing)
├── tbd guidelines --category typescript|python|testing (NEW)
└── tbd guidelines <name> (existing)

tbd template
├── tbd template --list (existing)
└── tbd template <name> (existing)
```

### Component 1: Prime Command Design

#### Current State (for reference)

| Command | Lines | Purpose |
| --- | --- | --- |
| `tbd prime` | 25 | Dashboard + quick reference |
| `tbd prime --brief` | 21 | Minimal quick reference |
| `tbd prime --full` | ~200 | Full SKILL.md content |
| `tbd skill` | 209 | Static SKILL.md |
| `tbd skill --brief` | 35 | Condensed workflow rules |

#### Desired State (Two Levels)

| Command | Lines | Purpose |
| --- | --- | --- |
| `tbd prime` | ~200 | **Full orientation** with complete skill content |
| `tbd prime --brief` | ~35 | Abbreviated orientation for constrained situations |
| `tbd skill` | ~200 | Static skill file (for installation to .claude/skills/) |
| `tbd skill --brief` | ~35 | Condensed rules (used by prime --brief) |

**Note:** We use a two-level hierarchy rather than three.
`tbd prime` now provides the full orientation by default, with `--brief` as the only
flag for abbreviated output.

#### Prime Output Structure (Initialized Project)

The `tbd` / `tbd prime` output includes full skill content plus dynamic status:

```
tbd v0.1.5

=== INSTALLATION ===
✓ tbd installed (v0.1.5)
✓ Initialized in this repo (prefix: myapp)
✓ Hooks installed

=== PROJECT STATUS ===
Repository: my-cool-app
Issues: 12 open (2 in_progress) | 3 blocked
Ready to work: 7 issues

[Full SKILL.md content follows, including:]
- Agent orientation and value proposition
- Setup rules (prefix handling)
- Core workflow rules
- Session closing protocol
- All commands with examples
- Shortcut directory

For CLI reference: tbd --help
```

#### Prime --brief Output Structure

The abbreviated version for constrained situations:

```
tbd v0.1.5

=== INSTALLATION ===
✓ tbd installed (v0.1.5)
✓ Initialized (prefix: myapp)
✓ Hooks installed

=== PROJECT STATUS ===
Issues: 12 open (2 in_progress) | 3 blocked

=== CORE WORKFLOW ===
- Track all task work as issues using tbd
- Check `tbd ready` for available work
- Run `tbd sync` at session end

=== QUICK REFERENCE ===
tbd ready              Show issues ready to work
tbd show <id>          View issue details
tbd create "title"     Create new issue
tbd close <id>         Mark issue complete
tbd sync               Sync with remote

=== SESSION CLOSING (REQUIRED) ===
1. git add + git commit
2. git push
3. gh pr checks <PR> --watch  # WAIT for completion
4. tbd close/update <id>
5. tbd sync

For full orientation: tbd prime
For CLI reference: tbd --help
```

#### Prime Output (Not Initialized)

```
tbd v0.1.5

=== NOT INITIALIZED ===
✗ tbd not initialized in this repository

=== WHAT tbd IS ===
tbd is an AI-agent-optimized issue tracker and workflow assistant providing:
1. Issue Tracking - Track tasks, bugs, features as git-native "beads"
2. Coding Guidelines - Best practices for TypeScript, Python, testing
3. Spec-Driven Workflows - Write specs, then implement using issues to track each part
4. Convenience Shortcuts - Pre-built processes for common tasks (commit, PR, review)

=== SETUP ===
To set up tbd in this project:

  tbd setup --auto --prefix=<name>   # For agents (requires prefix)
  tbd setup --interactive            # For humans (prompts for prefix)

CRITICAL: Never guess a prefix. Always ask the user what prefix they want.

After setup, run 'tbd' again to see project status and workflow guidance.

For CLI reference: tbd --help
```

#### tbd --help Epilogue

The standard `tbd --help` output should end with:

```
...existing help content...

Getting Started:
  npm install -g tbd-git@latest && tbd setup --auto --prefix=<name>

For orientation and workflow guidance, run: tbd prime
For more on tbd, see: https://github.com/jlevy/tbd
```

**Current behavior** (good, keep it):
```
tbd v0.1.5

--- PROJECT NOT INITIALIZED ---
✗ Not initialized in this repository

To set up tbd in this project:
  tbd setup --auto --prefix=<name>   # Non-interactive (for agents)
  tbd setup --interactive            # Interactive (for humans)

After setup, run 'tbd' again to see project status.
```

### Component 2: Enhanced Skill File Orientation Section

Add a new section at the top of SKILL.md (before the current installation section):

```markdown
# tbd Agent Orientation

## What tbd Is

tbd is an AI-agent-optimized issue tracker and development workflow assistant. It helps
you (the agent) help users by providing:

1. **Issue Tracking**: Track tasks, bugs, and features as lightweight "beads" stored in
   git. Never lose discovered work; maintain continuity across sessions.

2. **Coding Guidelines**: A library of best practices for TypeScript, Python, testing,
   and more. Pull them in when relevant to apply consistent quality.

3. **Spec-Driven Workflows**: Write planning specs for features, then break them into
   trackable issues and implement systematically. This is the recommended way to handle
   non-trivial features.

4. **Convenience Shortcuts**: Pre-built processes for common tasks like committing code,
   creating PRs, and reviewing code. Use them to work consistently.

## How to Use tbd to Help Users

**Don't just tell users about commands.** Use tbd proactively:

- User describes a bug → `tbd create "Bug: ..." --type=bug`
- User wants a feature → Create a plan spec, then break into issues
- Starting a session → Check `tbd ready` for available work
- Completing work → `tbd close <id>` with clear reason
- User asks what tbd does → Explain the four capabilities above

## Setup Rules

**CRITICAL: Never guess or invent a prefix.** When setting up tbd in a fresh project:
- Always ask the user what prefix they want for issue IDs
- The prefix is a matter of taste (e.g., 'myapp', 'proj', 'mca')
- Only after user confirms: `tbd setup --auto --prefix=<user-chosen-prefix>`

For existing tbd projects (`.tbd/` exists): just run `tbd setup --auto` (no prefix needed).

## Capability Examples

| User Need | Command to Run | Notes |
|-----------|----------------|-------|
| "I found a bug" | `tbd create "..." --type=bug` | Creates an issue |
| "Let's plan this feature" | `tbd shortcut new-plan-spec` | *Outputs instructions* |
| "What should I work on?" | `tbd ready` | Lists ready issues |
| "Build a new TypeScript CLI app" | `tbd guidelines typescript-cli-tool-rules` | *Outputs instructions* |
| "Set up a TypeScript monorepo" | `tbd guidelines typescript-monorepo-patterns` | *Outputs instructions* |
| "Add golden/snapshot tests" | `tbd guidelines golden-testing-guidelines` | *Outputs instructions* |
| "Review the TypeScript code" | `tbd guidelines typescript-rules` | *Outputs instructions* |
| "Ready to commit" | `tbd shortcut commit-code` | *Outputs instructions* |

*Outputs instructions* = This command displays guidance the agent should read and follow.
It doesn't perform the action itself - it tells the agent HOW to do it well.
```

#### Resource Directory Format in SKILL.md

The SKILL.md file should include directories for shortcuts, guidelines, and templates
that show the **exact command to run**. This makes it immediately obvious to agents how
to access each resource.

**Key design principle:** Show the full command, not just the name.
Agents should be able to copy/run the command directly.

```markdown
# tbd Shortcuts, Guidelines, and Templates

Run these commands to get instructions for common tasks and best practices.
These are **informational commands** - they display guidance the agent should follow.

## Shortcuts (Workflow Instructions)

| Command | Purpose | Description |
|---------|---------|-------------|
| `tbd shortcut commit-code` | Commit Code | How to run pre-commit checks, review changes, and commit |
| `tbd shortcut create-or-update-pr-simple` | Create PR | How to create or update a pull request |
| `tbd shortcut create-or-update-pr-with-validation-plan` | Create PR with Tests | How to create PR with detailed validation plan |
| `tbd shortcut implement-beads` | Implement Issues | How to implement issues from a spec with TDD |
| `tbd shortcut new-plan-spec` | Plan Feature | How to create a feature planning specification |
| `tbd shortcut new-research-brief` | Research Topic | How to create a research document |
| `tbd shortcut new-architecture-doc` | Design Architecture | How to create an architecture document |
| `tbd shortcut new-implementation-beads-from-spec` | Create Issues | How to break a spec into implementation issues |
| `tbd shortcut new-validation-plan` | Validation Plan | How to create a test/validation plan |
| `tbd shortcut precommit-process` | Pre-Commit | Full pre-commit checklist |
| `tbd shortcut review-code-typescript` | Review TypeScript | How to review TypeScript code |
| `tbd shortcut review-code-python` | Review Python | How to review Python code |

## Guidelines (Coding Best Practices)

| Command | Purpose | Description |
|---------|---------|-------------|
| `tbd guidelines typescript-rules` | TypeScript | TypeScript coding rules and best practices |
| `tbd guidelines typescript-cli-tool-rules` | TypeScript CLI | Rules for CLI tools with Commander.js |
| `tbd guidelines typescript-monorepo-patterns` | TypeScript Monorepo | Monorepo architecture patterns |
| `tbd guidelines python-rules` | Python | Python coding rules and best practices |
| `tbd guidelines python-cli-patterns` | Python CLI | Python CLI application patterns |
| `tbd guidelines general-tdd-guidelines` | TDD | Test-Driven Development methodology |
| `tbd guidelines general-testing-rules` | Testing | Rules for writing effective tests |
| `tbd guidelines golden-testing-guidelines` | Golden Tests | Golden/snapshot testing guidelines |
| `tbd guidelines general-coding-rules` | General Coding | Constants, magic numbers, practices |
| `tbd guidelines general-comment-rules` | Comments | Clean, maintainable comment rules |
| `tbd guidelines backward-compatibility-rules` | Compatibility | Backward compatibility guidelines |

## Templates (Document Templates)

| Command | Purpose | Description |
|---------|---------|-------------|
| `tbd template plan-spec` | Plan Spec | Template for feature planning documents |
| `tbd template architecture-doc` | Architecture | Template for architecture documents |
| `tbd template research-brief` | Research | Template for research documents |
```

### Component 3: Unified Documentation Command

Add a new `--all` flag to `tbd docs` that provides a comprehensive listing:

```bash
$ tbd docs --all

=== tbd Documentation ===

GETTING STARTED
  tbd                      Dashboard and quick start
  tbd skill                Full agent instructions
  tbd setup --help         Installation options

CLI REFERENCE
  tbd docs                 CLI documentation by topic
  tbd docs commands        All commands reference
  tbd --help               Quick command list

DEVELOPMENT WORKFLOWS (Shortcuts)
  Planning:
    new-plan-spec          Create feature planning document
    new-research-brief       Research a topic or technology
    new-architecture-doc   Design system architecture

  Implementation:
    new-implementation-beads-from-spec   Break plan into issues
    implement-beads        Implement issues with TDD

  Quality:
    new-validation-plan    Create test/validation plan
    precommit-process      Full pre-commit checklist
    review-code-typescript TypeScript code review
    review-code-python     Python code review

  Shipping:
    commit-code            Commit with proper process
    create-or-update-pr-simple           Simple PR
    create-or-update-pr-with-validation-plan  PR with test plan

CODING GUIDELINES
  General:
    general-coding-rules   Constants, magic numbers, practices
    general-testing-rules  Minimal effective tests
    general-tdd-guidelines Test-driven development

  TypeScript:
    typescript-rules       TypeScript best practices
    typescript-cli-tool-rules  CLI tools with Commander
    typescript-monorepo-patterns  Monorepo architecture

  Python:
    python-rules           Python best practices
    python-cli-patterns    CLI application patterns

TEMPLATES
  plan-spec               Feature planning document
  architecture            System/component design
  research-brief          Research document

DESIGN DOCS
  tbd design --list       Technical design documentation

Use: tbd shortcut <name>, tbd guidelines <name>, tbd template <name>
```

### Component 4: Category Filtering for Documentation

Add `--category` flags to filter documentation commands:

```bash
tbd shortcut --category planning
tbd shortcut --category implementation
tbd shortcut --category quality
tbd shortcut --category shipping

tbd guidelines --category typescript
tbd guidelines --category python
tbd guidelines --category testing
tbd guidelines --category general
```

### Component 5: First-Run Experience Improvements

When `tbd setup --auto` completes, output should include:

1. Setup confirmation
2. Dashboard (current behavior)
3. **NEW**: Brief orientation message pointing to next steps

```
Setup complete!

=== What's Next ===

tbd is ready. Here's how I can help:

• Track issues:     tbd create "title" --type=task|bug|feature
• Find work:        tbd ready
• Plan features:    tbd shortcut new-plan-spec
• Get guidelines:   tbd guidelines --list

Run 'tbd skill' for full documentation.
```

### Component 6: Prefix Handling Rules

**CRITICAL RULE: Never guess or invent a prefix.
Always get explicit user confirmation.**

The prefix determines how issue IDs appear (e.g., `myapp-a1b2`). This is a matter of
user preference and project identity.
Agents must:

1. **For fresh projects**: Always ask the user what prefix they want before running
   setup
2. **For beads migration**: The prefix comes from the existing beads config (no need to
   ask)
3. **For existing tbd projects**: The prefix is already configured (no need to ask)

**Agent prompt template for fresh projects**:
> "I’ll set up tbd for issue tracking.
> What prefix would you like for issue IDs?
> This is typically a short name (2-4 letters) derived from your project name.
> For example, a project called ‘my-cool-app’ might use ‘mca’ or ‘cool’.
> Issues will appear as `<prefix>-a1b2`."

**Why this matters**: The prefix appears in every issue ID and becomes part of the
project’s vocabulary.
Users should consciously choose it, not have it imposed.

### Component 7: Multi-Contributor Workflow Support

tbd is often used by teams where one person sets up the project and others join later.
The setup flow must handle this gracefully:

**Project setup (first contributor)**:
```
npm install -g tbd-git@latest
tbd setup --auto --prefix=myproject
git add .tbd/ .claude/ && git commit -m "Initialize tbd"
git push
```

**Joining project (subsequent contributors)**:
```
git clone <repo>  # .tbd/ directory comes with repo
npm install -g tbd-git@latest  # If not already installed
tbd setup --auto  # No --prefix needed! Reads from existing config
```

**Key design requirement**: `tbd setup --auto` must detect these states:

| State | Behavior |
| --- | --- |
| No `.tbd/`, no `.beads/` | Fresh setup, `--prefix` required |
| No `.tbd/`, has `.beads/` | Beads migration, uses beads prefix |
| Has `.tbd/` | Configure local integrations only, no `--prefix` needed |

This means a second contributor can simply run `tbd setup --auto` and everything works -
they don’t need to know the project prefix or any other configuration details.

## User Scenarios and Flows

### Scenario A: Brand New Project (Agent-Assisted Setup)

**User**: “Set up this new project for development”

**Context**: Fresh project, no `.tbd/` or `.beads/` directory.
The agent needs to set up tbd but must ask the user for their preferred prefix.

**Agent actions**:
1. Check if git repo exists, if not `git init`
2. Check if `.tbd/` exists - if not, **ask the user for their preferred prefix**
3. Once prefix is provided: `tbd setup --auto --prefix=<user-chosen-prefix>`
4. Commit the tbd configuration

**Critical**: The prefix is a matter of user taste.
The agent should NOT guess or auto-detect - always ask.
Suggested prompt:

> "I’ll set up tbd for issue tracking.
> What prefix would you like for issue IDs?
> This is typically a short name (2-4 letters) like ‘myapp’ or ‘proj’.
> Issues will be named like `myapp-a1b2`."

**What agent says after setup**: “I’ve set up tbd with prefix ‘X’ for issue tracking.
I can now help you plan features, track bugs, and manage your development workflow.
What would you like to work on first?”

### Scenario A2: Brand New Project (User Self-Setup)

**User**: Installs tbd themselves and runs `tbd setup --interactive`

**Context**: User ran `npm install -g tbd-git@latest` and then `tbd setup --interactive`
directly, without agent involvement.

**tbd behavior**:
1. Detect fresh project (no `.tbd/`)
2. Prompt user for prefix interactively
3. Initialize and configure integrations
4. Output dashboard + “What’s Next”

**This should just work** - the interactive mode handles prefix collection naturally.

### Scenario B: Existing Beads Project

**User**: Opens a project with `.beads/` directory

**Agent actions**:
1. Detect beads presence
2. Run `tbd setup --from-beads` (auto-migrates)
3. Verify migration completed
4. Check `tbd ready` for existing work

**What agent says**: “I’ve migrated your existing beads to tbd.
You have X issues, Y of which are ready to work on.
Would you like me to continue with one of them?”

### Scenario C: Second Contributor Joining Project (tbd not installed)

**User**: Clones a repo that already has `.tbd/` but doesn’t have tbd installed locally

**Context**: Another team member set up tbd in this project.
The `.tbd/` directory exists in the repo, but this user has never installed tbd on their
machine.

**Agent actions**:
1. Detect `.tbd/` directory exists (project already uses tbd)
2. Check if `tbd` command is available
3. If not installed: `npm install -g tbd-git@latest`
4. Run `tbd setup --auto` (detects already initialized, just configures local hooks)
5. Check `tbd ready` for available work

**What agent says**: “This project uses tbd for issue tracking.
I’ve installed tbd and configured it for your environment.
There are X issues ready to work on.
Would you like me to show you what’s available?”

**Key behavior**: `tbd setup --auto` on an already-initialized project should:
- Skip initialization (already done)
- Configure local agent integrations (hooks, skill file)
- NOT require `--prefix` (reads from existing config)
- Output the dashboard showing project status

### Scenario C2: Second Contributor Joining Project (tbd already installed)

**User**: Clones a repo that already has `.tbd/` and has tbd installed globally

**Context**: User already has tbd from another project, now joining a new one.

**Agent actions**:
1. Detect `.tbd/` directory exists
2. Run `tbd setup --auto` (configures local hooks if needed)
3. Check `tbd ready` for available work

**What agent says**: “This project uses tbd for issue tracking.
There are X issues ready to work on.
Would you like me to show you what’s available?”

**Key behavior**: Should be nearly instant - just verify hooks are configured and show
status.

### Scenario D: User Doesn’t Know What tbd Is

**User**: “What is tbd?”

**Agent explains** (using the orientation content):

"tbd is a development assistant that helps us work together more effectively.
It does four things:

1. **Tracks work**: Any bugs, features, or tasks we discover get saved as ‘issues’ in
   your git repo. This means we won’t lose track of things between sessions.

2. **Provides guidelines**: I can pull in best practices for TypeScript, Python,
   testing, and other topics to write better code.

3. **Supports spec-driven development**: I can help you write planning specs for
   features, then break them into trackable issues and implement them systematically.

4. **Offers convenience shortcuts**: For common tasks like committing code, creating
   PRs, or reviewing code, I have pre-built processes to follow.

Would you like me to set it up for this project?"

### Scenario E: Mid-Session Context Recovery

**Hook calls `tbd prime --brief`** (for context recovery, use brief to save tokens)

**Agent receives**: Condensed dashboard with status + core workflow rules + quick
reference

**Agent understands**: Current project state, open issues, workflow rules to follow

**Note**: For mid-session context recovery, `tbd prime --brief` is preferred to minimize
token usage while still providing essential workflow guidance.

## Current vs Desired Behavior Matrix

| Aspect | Current | Desired |
| --- | --- | --- |
| `tbd` / `tbd prime` | 25 lines, dashboard only | ~200 lines, full orientation (skill content) |
| `tbd prime --brief` | 21 lines, minimal | ~35 lines, abbreviated orientation |
| Value proposition | Not explained | Clear in prime and skill orientation |
| Setup rules (prefix) | Not mentioned | Prominently stated: never guess prefix |
| Documentation discovery | Fragmented commands | Unified `tbd docs --all` |
| First-run guidance | Dashboard only | Dashboard + orientation + "what's next" |
| Shortcut organization | Flat list | Categorized by workflow phase |
| Guideline organization | Flat list | Categorized by language/topic |
| Agent mental model | Command executor | Partner using tool to help user |
| `tbd --help` | No orientation pointer | Epilogue points to `tbd prime` |

## Implementation Plan

### Phase 1: Prime Command Enhancement (Core)

This is the most important phase - making `tbd` / `tbd prime` the complete orientation.

- [ ] Expand `tbd prime` to include full SKILL.md content (~200 lines):
  - [ ] Dynamic: installation status, project status, issue counts
  - [ ] Static: Full skill file content (value proposition, workflow rules, all
    commands)
- [ ] Simplify to two levels: `tbd prime` (full) and `tbd prime --brief` (abbreviated)
- [ ] Remove `tbd prime --full` flag (no longer needed, `tbd prime` is now full)
- [ ] Update `tbd prime --brief` to use `tbd skill --brief` content
- [ ] Update `tbd prime` for uninitialized repos to include value proposition
- [ ] Update `tbd --help` epilogue to point to `tbd prime` for orientation

### Phase 2: Skill File Orientation Enhancement

- [ ] Add “Agent Orientation” section to top of SKILL.md
- [ ] Include value proposition and mental model guidance
- [ ] Add “How to Use tbd to Help Users” section
- [ ] Add setup rules (prefix rule) prominently
- [ ] Add quick capability reference table
- [ ] Update resource directories to show full commands:
  - [ ] Shortcuts table: `tbd shortcut <name>` | Purpose | Description
  - [ ] Guidelines table: `tbd guidelines <name>` | Purpose | Description
  - [ ] Templates table: `tbd template <name>` | Purpose | Description
- [ ] Update SKILL.md copies (src/docs/, .claude/skills/)

### Phase 3: Documentation Command Enhancements

- [ ] Add `tbd docs --all` comprehensive listing
- [ ] Organize docs output by purpose (getting started, workflows, guidelines)
- [ ] Add `--category` flag to `tbd shortcut`
- [ ] Add `--category` flag to `tbd guidelines`
- [ ] Update help text to reference new options

### Phase 4: Setup Experience Enhancement

- [ ] Add “What’s Next” section to post-setup output
- [ ] Ensure all scenarios (new, beads, existing) have appropriate guidance
- [ ] Ensure setup outputs prime content after completion
- [ ] Add brief orientation message after setup

### Phase 5: Help Organization

- [ ] Review and organize `tbd --help` output by purpose
- [ ] Add epilogue: “Run ‘tbd prime’ for orientation and workflow guidance”
- [ ] Ensure consistent documentation pointers across all commands

## Testing Strategy

### Manual Testing Scenarios

1. **Fresh install**: Clone repo, run `tbd setup --auto --prefix=test`, verify output
2. **Beads migration**: Test with `.beads/` present, verify migration and orientation
3. **Second contributor (tbd not installed)**: Clone repo with `.tbd/`, install tbd, run
   `tbd setup --auto` (no prefix), verify it configures hooks without re-initializing
4. **Second contributor (tbd installed)**: Clone repo with `.tbd/`, run
   `tbd setup --auto`, verify fast path that just checks hooks
5. **Documentation discovery**: Test `tbd docs --all` output
6. **Category filtering**: Test shortcut/guideline category flags

### Golden Tests

- Add golden tests for:
  - `tbd docs --all` output format
  - Post-setup “What’s Next” message
  - Updated prime output for uninitialized repos

## Open Questions

1. **Category names**: What are the best category names for shortcuts and guidelines?
   - Proposed for shortcuts: planning, implementation, quality, shipping
   - Proposed for guidelines: typescript, python, testing, general

2. **Orientation length**: How much orientation is too much in the skill file?
   - Proposed: Keep it to ~50 lines max, with pointers to more detail

3. **Interactive vs auto setup messaging**: Should the messaging differ significantly?
   - Proposed: Yes, interactive can be more verbose; auto should be concise

4. **Shortcut auto-suggestions**: Should tbd suggest relevant shortcuts based on
   context?
   - Deferred: This could be a future enhancement

5. **Guidelines gap**: ~~RESOLVED~~ - All guidelines exist in bundled docs and are
   installed via `tbd setup --auto`. The 15 available guidelines include all those
   referenced in the spec plus additional ones (convex-rules,
   general-eng-assistant-rules, general-style-rules, etc.).

6. **Shortcut naming inconsistencies**: ~~RESOLVED~~ - Renamed shortcuts to match spec:
   - `create-pr-simple` → `create-or-update-pr-simple`
   - `new-research-brief` → `new-research-brief`
   - There are 25 shortcuts in the codebase (spec showed subset of key shortcuts).

7. **Template naming**: ~~RESOLVED~~ - The `tbd template` command correctly maps
   user-facing names (`plan-spec`, `architecture`, `research-brief`) to underlying files
   (`template-plan-spec.md`, etc.). The spec uses the correct user-facing names.

8. **Prefix requirement in setup**: ~~RESOLVED~~ - Updated SKILL.md files to clearly
   emphasize that `--prefix` is REQUIRED for fresh projects and agents must ask users
   for their preferred prefix.
   Added clear instructions for the three scenarios: fresh projects, existing tbd
   projects, and beads migrations.

## References

- [plan-2026-01-20-streamlined-init-setup-design.md](plan-2026-01-20-streamlined-init-setup-design.md)
  \- Previous setup flow design
- [.claude/skills/tbd/SKILL.md](../../../.claude/skills/tbd/SKILL.md) - Current skill
  file
- [tbd --help output](#) - Current help structure
