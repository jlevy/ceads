# Research Brief: CLI as Agent Skill - Best Practices for TypeScript CLIs in Claude Code

**Last Updated**: 2026-01-26

**Status**: Complete (Second Revision)

**Related**:

- [tbd Design Doc](../../tbd-design.md)
- [Streamlined Init/Setup Spec](../specs/active/plan-2026-01-20-streamlined-init-setup-design.md)
- [Agent Orientation Experience Spec](../specs/active/plan-2026-01-25-agent-orientation-experience.md)
- [Unix Philosophy for Agents](./research-unix-philosophy-for-agents.md)

* * *

## Executive Summary

This research brief documents best practices for building TypeScript CLI applications
that function as powerful skills within Claude Code and potentially other AI coding
agents. The patterns are derived from the `tbd` CLI implementation, which serves as a
reference architecture for agent-integrated command-line tools.

The core insight is that a CLI can be much more than a command executor—it can be a
**dynamic skill module** that provides context management, self-documentation, and
seamless integration with multiple AI agents through a single npm package.

A second key insight is that CLIs can serve as **knowledge libraries**—bundling
guidelines, shortcuts, and templates that agents can query on-demand to improve the
quality of their work.
This transforms the CLI from a tool the agent tells users about into a resource the
agent uses to better serve users.

**Research Questions**:

1. What architectural patterns make a CLI work well as an agent skill?

2. How should CLIs handle context management for agents with limited context windows?

3. What setup flows work best for both human users and AI agents?

4. How can a single CLI integrate with multiple agent platforms (Claude, Cursor, Codex)?

5. How can CLIs provide reusable knowledge (guidelines, workflows, templates) that
   agents can leverage to improve work quality?

6. What mental model should agents have when using CLI tools—messenger or partner?

7. How should skill descriptions be optimized for reliable activation?

8. What role does MCP play alongside CLI-as-skill patterns?

* * *

## Research Methodology

### Approach

Analysis of the `tbd` CLI implementation, iterative development through PR review, and
testing with Claude Code in real-world scenarios.
Patterns were validated through CI testing and actual agent usage.

### Sources

- tbd source code (`packages/tbd/src/cli/`)
- Claude Code skill documentation (https://code.claude.com/docs/en/skills)
- Agent Skills open standard (https://agentskills.io)
- Cursor IDE MDC format specification
- OpenAI Codex AGENTS.md convention
- Community best practices (meta_skill repository, gists)
- MCP protocol documentation and engineering blogs

* * *

## Research Findings

### 1. CLI as Skill Architecture

#### 1.1 Bundled Documentation Pattern

**Status**: ✅ Complete

**Details**:

- Bundle documentation files (`SKILL.md`, `README.md`, docs) into the CLI distribution
- Use a `dist/docs/` directory alongside the bundled CLI
- Implement fallback loading: bundled → development source → repo-level docs
- This ensures the CLI is self-contained and works in any environment

**Implementation Pattern**:

```typescript
function getDocPath(filename: string): string {
  const __dirname = dirname(fileURLToPath(import.meta.url));
  return join(__dirname, 'docs', filename);
}

async function loadDocContent(filename: string): Promise<string> {
  // Try bundled location first
  try {
    return await readFile(getDocPath(filename), 'utf-8');
  } catch {
    // Fallback chain: dev path → repo path → error
  }
}
```

**Assessment**: Essential pattern.
Self-contained CLIs work in sandboxed environments, containers, and CI where external
files may not be accessible.

* * *

#### 1.2 Multi-Agent Integration Files

**Status**: ✅ Complete

**Details**:

Each agent platform has different file format requirements:

| Agent | File | Format | Location |
| --- | --- | --- | --- |
| Claude Code | SKILL.md | YAML frontmatter + Markdown | `.claude/skills/tbd/` |
| Cursor IDE | CURSOR.mdc | MDC frontmatter + Markdown | `.cursor/rules/` |
| Codex | AGENTS.md | HTML markers + Markdown | repo root |

**SKILL.md Format** (Claude Code):
```yaml
---
name: tbd
description: Lightweight, git-native issue tracking...
allowed-tools: Bash(tbd:*), Read, Write
---
# tbd Workflow
...
```

**CURSOR.mdc Format** (Cursor IDE):
```yaml
---
description: tbd workflow rules for git-native issue tracking...
alwaysApply: false
---
# tbd Workflow
...
```

**AGENTS.md Format** (Codex):
```markdown
<!-- BEGIN TBD INTEGRATION -->
# tbd Workflow
...
<!-- END TBD INTEGRATION -->
```

**Assessment**: Use markers/frontmatter appropriate to each platform.
Store source files in `src/docs/` and bundle them for distribution.

* * *

### 2. Context Management Commands

#### 2.1 Prime Command Pattern

**Status**: ✅ Complete

**Details**:

The `prime` command is the key context management primitive.
It outputs contextual information appropriate to the current state:

- **Initialized repo**: Dashboard with status, rules, quick reference
- **Not initialized**: Setup instructions
- **Beads detected**: Migration warning

**Key Features**:

- Called automatically via hooks at session start and before context compaction
- `--brief` flag for constrained contexts (~200 tokens)
- `--full` flag for complete skill documentation
- Custom override via `.tbd/PRIME.md` file
- Default when running CLI with no command (`tbd` runs `tbd prime`)

**Dashboard Output Structure**:
```
tbd v0.1.4

--- INSTALLATION ---
✓ tbd installed (v0.1.4)
✓ Initialized in this repo
✓ Hooks installed

--- PROJECT STATUS ---
Repository: proj
Issues: 3 open (1 in_progress) | 1 blocked

--- WORKFLOW RULES ---
- Track all task work as issues using tbd
- Check `tbd ready` for available work
- Run `tbd sync` at session end

--- QUICK REFERENCE ---
tbd ready              Show issues ready to work
tbd show <id>          View issue details
...
```

**Assessment**: The prime pattern is highly effective.
Agents get context-appropriate information without overwhelming their context window.

* * *

#### 2.2 Skill Command Pattern

**Status**: ✅ Complete

**Details**:

The `skill` command outputs the full SKILL.md content for agents that need complete
documentation. Separate from `prime` to allow different context strategies:

- `tbd prime` → Dashboard (default, compact)
- `tbd skill` → Full documentation
- `tbd skill --brief` → Condensed rules only

**Assessment**: Separating dashboard from full skill content allows agents to request
the appropriate level of detail based on their needs.

* * *

#### 2.3 Context Recovery Pattern

**Status**: ✅ Complete

**Details**:

Include explicit context recovery instructions in all documentation:

```markdown
> **Context Recovery**: Run `tbd prime` after compaction, clear, or new session.
> Hooks auto-call this in Claude Code when .tbd/ detected.
```

This ensures agents know how to restore context after context window events.

* * *

#### 2.4 Progressive Disclosure Architecture

**Status**: ✅ Complete

**Details**:

The most important concept for building agent-integrated CLIs is **Progressive
Disclosure**—showing just enough information to help agents decide what to do next, then
revealing more details as needed.
This minimizes token overhead while maintaining full capability.

**Three-Level Architecture**:

| Level | Content | Token Budget | When Loaded |
| --- | --- | --- | --- |
| Level 1 | Metadata only (name + description) | ~100 tokens | Always in system prompt |
| Level 2 | SKILL.md body | ~1,500-5,000 tokens | On skill trigger |
| Level 3 | Bundled resources (scripts, references) | Unlimited | As-needed |

**Implementation Pattern**:

```
SKILL.md (Level 2)
├── Overview and navigation (~500 lines max)
├── References to supporting files
└── Key instructions

reference.md (Level 3)
├── Detailed API documentation
├── Loaded only when agent reads it
└── Can be arbitrarily large

scripts/ (Level 3)
├── Executable code
├── Runs outside context window
└── Only output enters context
```

**Key Constraints**:

- Keep SKILL.md under 500 lines
- Reference files should stay one level deep from SKILL.md
- Avoid chains like SKILL.md → advanced.md → details.md
- Scripts execute outside context; only output uses tokens

**Assessment**: Progressive disclosure is the foundational pattern for context-efficient
agent integration.
Every token competes with conversation history—add only what the agent
doesn’t already know.

* * *

#### 2.5 Description Optimization Pattern

**Status**: ✅ Complete

**Details**:

Skill activation relies on **pure LLM reasoning**, not keyword matching or embeddings.
Description quality directly impacts activation reliability.

**Activation Success Rates** (from testing across 200+ prompts):

| Approach | Success Rate |
| --- | --- |
| Basic descriptions | ~20% |
| Optimized descriptions | ~50% |
| Optimized + evaluation hooks | ~84% |
| Optimized + examples | ~90% |

**The Two-Part Rule**: Every description must answer:

1. **What does it do?** (capabilities)
2. **When to use it?** (activation triggers)

**Anti-Pattern**:
```yaml
description: Helps with documents
```

**Preferred Pattern**:
```yaml
description: >
  Analyze Excel spreadsheets, create pivot tables, and export data.
  Use when analyzing .xlsx files, working with tabular data, or
  when the user mentions spreadsheets or Excel.
```

**Writing Guidelines**:

- Use third person always ("Processes files" not “I can help you”)
- Include explicit trigger phrases reflecting user language
- Be specific with keywords users would naturally say
- State both capabilities AND activation conditions
- Match terminology to how users describe their needs

**Assessment**: Description optimization is high-leverage—a properly crafted description
can quadruple activation reliability.
This is pure LLM reasoning, so semantic clarity matters more than keyword density.

* * *

### 3. Self-Documenting CLI Pattern

#### 3.1 Documentation Commands

**Status**: ✅ Complete

**Details**:

Implement multiple documentation access points:

| Command | Purpose | Source |
| --- | --- | --- |
| `tbd readme` | GitHub landing page | README.md |
| `tbd docs [topic]` | CLI reference | tbd-docs.md |
| `tbd design [topic]` | Architecture docs | tbd-design.md |
| `tbd skill` | Agent skill file | SKILL.md |
| `tbd closing` | Session protocol | tbd-closing.md |

**Features**:

- `--list` flag to show available sections
- Section filtering by topic/slug
- Markdown rendering with terminal colorization
- Same content accessible in CLI as on GitHub

**Assessment**: Self-documenting CLIs reduce dependency on external documentation and
work better in sandboxed environments.

* * *

#### 3.2 Help Epilog Pattern

**Status**: ✅ Complete

**Details**:

The help output should include a “Getting Started” section:

```
Getting Started:
  npm install -g get-tbd@latest && tbd setup --auto

  This initializes tbd and configures your coding agents automatically.
  For interactive setup: tbd setup --interactive
  For manual control: tbd init --help

For more on tbd, see: https://github.com/jlevy/tbd
```

**Implementation**:

```typescript
export function createHelpEpilog(colorOption: ColorOption = 'auto'): string {
  const colors = pc.createColors(shouldColorize(colorOption));
  const lines = [
    colors.bold('Getting Started:'),
    `  ${colors.green('npm install -g get-tbd@latest && tbd setup --auto')}`,
    '',
    '  This initializes tbd and configures your coding agents automatically.',
    `  For interactive setup: ${colors.dim('tbd setup --interactive')}`,
    `  For manual control: ${colors.dim('tbd init --help')}`,
    '',
    colors.blue('For more on tbd, see: https://github.com/jlevy/tbd'),
  ];
  return lines.join('\n');
}
```

**Assessment**: The one-liner installation command is critical for agent usability.
Agents can copy-paste directly from help output.

* * *

### 4. Setup Flow Patterns

#### 4.1 Two-Tier Command Structure

**Status**: ✅ Complete

**Details**:

Implement two levels of setup commands:

| Command | Purpose | Audience |
| --- | --- | --- |
| `tbd setup --auto` | Full setup with auto-detection | Agents, scripts |
| `tbd setup --interactive` | Prompted setup | Humans |
| `tbd init --prefix=X` | Surgical initialization only | Advanced users |

**Decision Tree**:

```
setup --auto:
  1. Not in git repo → Error with guidance
  2. Has .tbd/ → Check/update integrations
  3. Has .beads/ → Migration flow
  4. Fresh repo → Initialize + configure integrations
```

**Assessment**: The two-tier structure allows both “just make it work” (setup) and “I
know what I’m doing” (init) approaches.

* * *

#### 4.2 Mode Flags Pattern

**Status**: ✅ Complete

**Details**:

Always require explicit mode selection for setup commands:

```bash
tbd setup              # Shows help, requires mode flag
tbd setup --auto       # Non-interactive (for agents)
tbd setup --interactive # Interactive (for humans)
```

**Why This Matters**:

- Prevents agents from getting stuck in interactive prompts
- Ensures humans get guided experience when they want it
- Explicit is better than implicit for setup operations

**Agent Instructions**:

```markdown
**IMPORTANT FOR AGENTS:** Always use `--auto` flag.
The command `tbd setup` without flags shows help and requires a mode flag.
Use `--interactive` for humans, `--auto` for agents.
Agents should ALWAYS run `tbd setup --auto`.
```

* * *

#### 4.3 Auto-Detection Pattern

**Status**: ✅ Complete

**Details**:

Implement automatic detection for common configuration:

1. **Prefix Detection**: Extract from git remote URL
   ```typescript
   function extractRepoNameFromRemote(url: string): string | null {
     // git@github.com:user/repo-name.git → repo-name
     // https://github.com/user/repo-name → repo-name
   }
   ```

2. **Agent Detection**: Check for agent indicators
   ```typescript
   // Claude Code: ~/.claude/ directory or CLAUDE_* env vars
   const hasClaudeDir = await pathExists(join(homedir(), '.claude'));
   const hasClaudeEnv = Object.keys(process.env).some(k => k.startsWith('CLAUDE_'));
   
   // Cursor IDE: .cursor/ directory in project
   const cursorDir = join(cwd, '.cursor');
   
   // Codex: existing AGENTS.md or CODEX_* env vars
   const hasAgentsMd = await pathExists(join(cwd, 'AGENTS.md'));
   ```

**Assessment**: Auto-detection eliminates configuration burden for the common case while
still allowing explicit overrides (`--prefix=X`).

* * *

### 5. Agent Integration Patterns

#### 5.1 Claude Code Hooks

**Status**: ✅ Complete

**Details**:

Configure Claude Code hooks for automatic context management:

**Global Hooks** (`~/.claude/settings.json`):
```json
{
  "hooks": {
    "SessionStart": [{
      "matcher": "",
      "hooks": [{ "type": "command", "command": "tbd prime" }]
    }],
    "PreCompact": [{
      "matcher": "",
      "hooks": [{ "type": "command", "command": "tbd prime" }]
    }]
  }
}
```

**Project Hooks** (`.claude/settings.json`):
```json
{
  "hooks": {
    "PostToolUse": [{
      "matcher": "Bash",
      "hooks": [{
        "type": "command",
        "command": "\"$CLAUDE_PROJECT_DIR\"/.claude/hooks/tbd-closing-reminder.sh"
      }]
    }]
  }
}
```

**Hook Script** (`.claude/hooks/tbd-closing-reminder.sh`):
```bash
#!/bin/bash
input=$(cat)
command=$(echo "$input" | jq -r '.tool_input.command // empty')

if [[ "$command" == git\ push* ]] || [[ "$command" == *"&& git push"* ]]; then
  if [ -d ".tbd" ]; then
    tbd closing
  fi
fi
exit 0
```

**Assessment**: Hooks ensure agents always have context without manual intervention.
The PostToolUse hook prevents premature session completion.

* * *

#### 5.2 Skill File Installation

**Status**: ✅ Complete

**Details**:

Install skill file to Claude Code’s skill directory:

```typescript
const skillPath = join(cwd, '.claude', 'skills', 'tbd', 'SKILL.md');
await mkdir(dirname(skillPath), { recursive: true });
const skillContent = await loadSkillContent();
await writeFile(skillPath, skillContent);
```

The skill file includes:
- YAML frontmatter with `name`, `description`, `allowed-tools`
- Complete workflow documentation
- Session closing protocol
- Command reference

**Assessment**: Skills become available to Claude Code automatically when the directory
structure is correct.

* * *

### 6. Output Modes Pattern

#### 6.1 Machine-Readable Output

**Status**: ✅ Complete

**Details**:

Implement consistent output mode flags:

| Flag | Purpose | Example |
| --- | --- | --- |
| `--json` | JSON output for parsing | `tbd list --json \| jq '.issues'` |
| `--quiet` | Suppress non-essential output | `tbd init --quiet` |
| `--verbose` | Debug information | `tbd sync --verbose` |
| `--color <when>` | Color control | `--color never` for CI |

**Implementation Pattern**:

```typescript
this.output.data(
  { installed: true, path: settingsPath },  // JSON structure
  () => {
    // Human-readable rendering
    console.log('✓ Installed successfully');
  }
);
```

**Assessment**: The `output.data()` pattern allows single code path for both modes.

* * *

### 7. Agent-Friendly Design Principles

#### 7.1 Clear Error Messages with Next Steps

**Status**: ✅ Complete

**Details**:

Always provide actionable guidance in error messages:

```typescript
throw new ValidationError(
  'The --prefix option is required\n\n' +
  'Usage: tbd init --prefix=<name>\n\n' +
  'The prefix is used for display IDs (e.g., proj-a7k2, myapp-b3m9)\n' +
  'Choose a short, memorable prefix for your project.\n\n' +
  'For automatic prefix detection, use: tbd setup --auto'
);
```

* * *

#### 7.2 Deprecation with Migration Guidance

**Status**: ✅ Complete

**Details**:

When deprecating commands, keep them functional but add clear migration guidance:

```typescript
console.log('Note: --from-beads is deprecated.');
console.log('Use: tbd setup --from-beads');
console.log('');
// Continue executing the deprecated path
```

* * *

#### 7.3 Session Closing Protocol

**Status**: ✅ Complete

**Details**:

Define explicit session completion requirements:

```markdown
# SESSION CLOSING PROTOCOL

**CRITICAL**: Before saying "done" or "complete", you MUST run this checklist:

[ ] 1. Stage and commit: git add + git commit
[ ] 2. Push to remote: git push
[ ] 3. Start CI watch (BLOCKS until done): gh pr checks <PR> --watch 2>&1
[ ] 4. While CI runs: tbd close/update <id> for issues worked on
[ ] 5. While CI runs: tbd sync
[ ] 6. Return to step 3 and CONFIRM CI passed
[ ] 7. If CI failed: fix, re-push, restart from step 3
```

**Assessment**: Explicit checklists prevent agents from prematurely declaring
completion.

* * *

### 8. Agent Mental Model Patterns

#### 8.1 Agent as Partner, Not Messenger

**Status**: ✅ Complete

**Details**:

The fundamental mental model shift for agent-integrated CLIs is from:
> “Here are commands you can tell the user about”

To:
> “Here’s how this tool helps you (the agent) serve the user better”

This means the CLI should explain its **value proposition** in terms of what problems it
solves, not just command syntax.
The agent should understand *why* to use the tool and *when* to reach for it
proactively.

**Implementation Pattern**:

Structure skill file orientation around capabilities, not commands:

```markdown
## What This Tool Does

1. **Issue Tracking**: Track tasks, bugs, features. Never lose discovered work.
2. **Coding Guidelines**: Best practices the agent can pull in when relevant.
3. **Workflow Shortcuts**: Pre-built processes for common tasks.
4. **Templates**: Starting points for common document types.

## How to Use It to Help Users

- User describes a bug → create an issue
- User wants a feature → create a plan spec, then break into issues
- Starting a session → check for available work
- Completing work → close issues with clear reasons
```

**Assessment**: When agents understand the tool’s value proposition, they use it
proactively rather than just relaying commands to users.
The tool becomes a capability amplifier rather than a command reference.

* * *

#### 8.2 Informational Commands Pattern

**Status**: ✅ Complete

**Details**:

A key architectural pattern is the distinction between **action commands** and
**informational commands**:

| Type | Purpose | Example |
| --- | --- | --- |
| Action commands | Perform operations | `create`, `close`, `sync` |
| Informational commands | Output guidance for the agent to follow | `shortcut`, `guidelines`, `template` |

Informational commands don’t perform actions—they display instructions, best practices,
or templates that tell the agent *how* to do something well.
The agent reads the output and follows the guidance.

**Key Principle**: When unsure how to best accomplish a task, agents should run the
relevant informational command first.
These commands provide:

- Quality guidelines that improve outcomes
- Time-saving tips and patterns
- Step-by-step processes that avoid mistakes
- Best practices specific to the task

**Example Flow**:

```
User: "Build a TypeScript CLI tool"

Agent thinks: "I should check for relevant guidelines"
Agent runs: tbd guidelines typescript-cli-tool-rules
Agent receives: Comprehensive guidance on Commander.js patterns, color handling,
                output formatting, error handling...
Agent uses: This guidance while implementing the CLI
```

**Assessment**: This pattern lets CLIs serve as on-demand knowledge bases.
The CLI bundles hard-won knowledge that agents can query contextually, dramatically
improving output quality without increasing the agent’s base training.

* * *

#### 8.3 Resource Library Pattern

**Status**: ✅ Complete

**Details**:

Beyond core functionality, agent-integrated CLIs can bundle **resource libraries**—
collections of guidelines, shortcuts, and templates that agents access on-demand.

**Resource Types**:

| Resource | Purpose | Access Pattern |
| --- | --- | --- |
| Guidelines | Best practices for specific domains | `cli guidelines <name>` |
| Shortcuts | Step-by-step workflow instructions | `cli shortcut <name>` |
| Templates | Document starting points | `cli template <name>` |

**Guidelines** encode domain expertise:
- Language-specific rules (TypeScript, Python)
- Testing patterns (TDD, golden testing)
- Architecture patterns (monorepos, CLI tools)

**Shortcuts** encode workflows:
- Planning processes (write spec → break into issues → implement)
- Shipping processes (commit → PR → validate)
- Review processes (code review checklists)

**Templates** provide structure:
- Planning specs for features
- Research briefs for investigations
- Architecture docs for designs

**Implementation Pattern**:

```typescript
// Resource loading with bundled fallback
async function loadResource(type: 'guideline' | 'shortcut' | 'template', name: string) {
  const bundledPath = join(__dirname, 'resources', type, `${name}.md`);
  const content = await readFile(bundledPath, 'utf-8');
  return content;
}

// List available resources
async function listResources(type: string) {
  const dir = join(__dirname, 'resources', type);
  const files = await readdir(dir);
  return files.filter(f => f.endsWith('.md')).map(f => f.replace('.md', ''));
}
```

**Benefits**:

1. **Self-contained**: Resources ship with the CLI, no external dependencies
2. **Versionable**: Resource improvements ship with CLI updates
3. **Discoverable**: `--list` flags help agents find available resources
4. **Contextual**: Agents query relevant resources just-in-time

**Assessment**: Resource libraries transform CLIs from single-purpose tools into
comprehensive development assistants.
The CLI becomes a curated knowledge base that agents leverage to produce higher-quality
work.

* * *

#### 8.4 Resource Directory Pattern

**Status**: ✅ Complete

**Details**:

When documenting available resources (shortcuts, guidelines, templates), show the **full
command to run**, not just the resource name.
This removes friction for agents.

**Anti-pattern** (name only):
```markdown
## Available Shortcuts
- commit-code
- create-or-update-pr-simple
- new-plan-spec
```

**Preferred pattern** (full command):
```markdown
## Available Shortcuts

| Command | Purpose | Description |
|---------|---------|-------------|
| `tbd shortcut commit-code` | Commit Code | How to run pre-commit checks and commit |
| `tbd shortcut create-or-update-pr-simple` | Create PR | How to create a pull request |
| `tbd shortcut new-plan-spec` | Plan Feature | How to create a planning specification |
```

**Why This Matters**:

- Agents can copy/run commands directly
- No ambiguity about command syntax
- Self-documenting—clear what each command does
- Reduces cognitive load for agents parsing documentation

**Assessment**: Small formatting changes in documentation significantly impact agent
usability. Always optimize for copy-paste execution.

* * *

#### 8.5 Category Organization Pattern

**Status**: ✅ Complete

**Details**:

Organize resources by **purpose or workflow phase**, not alphabetically.
This helps agents find relevant resources based on what they’re trying to accomplish.

**Shortcut Categories** (by workflow phase):

| Category | Resources | When to Use |
| --- | --- | --- |
| Planning | `new-plan-spec`, `new-research-brief`, `new-architecture-doc` | Starting new work |
| Implementation | `implement-beads`, `new-implementation-beads-from-spec` | Building features |
| Quality | `new-validation-plan`, `precommit-process`, `review-code-*` | Ensuring quality |
| Shipping | `commit-code`, `create-pr-*` | Delivering work |

**Guideline Categories** (by domain):

| Category | Resources | When to Use |
| --- | --- | --- |
| TypeScript | `typescript-rules`, `typescript-cli-tool-rules`, `typescript-monorepo-patterns` | TS development |
| Python | `python-rules`, `python-cli-patterns` | Python development |
| Testing | `general-tdd-guidelines`, `general-testing-rules`, `golden-testing-guidelines` | Writing tests |
| General | `general-coding-rules`, `general-comment-rules`, `backward-compatibility-rules` | Any development |

**Implementation**:

```bash
# Category filtering
tbd shortcut --category planning
tbd guidelines --category typescript
```

**Assessment**: Category organization transforms flat resource lists into navigable
knowledge structures.
Agents can quickly locate resources relevant to their current task phase.

* * *

#### 8.6 Value-First Orientation Pattern

**Status**: ✅ Complete

**Details**:

Skill files should lead with **value proposition**, not installation instructions.
Agents need to understand *why* to use a tool before *how*.

**Anti-pattern** (installation-first):
```markdown
# mytool

## Installation
npm install -g mytool

## Commands
mytool init
mytool do-thing
...
```

**Preferred pattern** (value-first):
```markdown
# mytool Agent Orientation

## What mytool Is

mytool helps you (the agent) help users by providing:

1. **Capability A**: Description of what it enables
2. **Capability B**: Description of what it enables
3. **Capability C**: Description of what it enables

## How to Use mytool to Help Users

- User wants X → use capability A
- User wants Y → use capability B
- User mentions Z → proactively suggest capability C

## Installation (if needed)

...
```

**Assessment**: Value-first orientation enables agents to make intelligent decisions
about when and how to use tools.
Installation is only relevant if the tool isn’t already set up.

* * *

### 9. Setup Flow Refinements

#### 9.1 Never Guess User Preferences

**Status**: ✅ Complete

**Details**:

For configuration values that are matters of user taste (not technical requirements),
**never guess or auto-detect**. Always ask the user.

**Examples of preference values**:
- Project prefixes/abbreviations (e.g., “myapp” vs “ma” vs “cool”)
- Naming conventions
- Style choices

**Why This Matters**:

The prefix appears in every issue ID and becomes part of the project’s vocabulary.
Auto-detecting from repo name might produce something the user dislikes.
Better to ask once than to have wrong values everywhere.

**Agent Prompt Template**:
```
"I'll set up [tool] for this project.
What prefix would you like for issue IDs?
This is typically a short name (2-4 letters) derived from your project name.
For example, a project called 'my-cool-app' might use 'mca' or 'cool'.
Issues will appear as `<prefix>-a1b2`."
```

**Implementation**:
- `setup --interactive`: Prompts for preferences
- `setup --auto --prefix=X`: Requires explicit preference values
- Never silently infer preference values

**Assessment**: Respecting user preferences builds trust.
A tool that imposes choices feels presumptuous; a tool that asks feels collaborative.

* * *

#### 9.2 Multi-Contributor Setup Flow

**Status**: ✅ Complete

**Details**:

CLI setup must handle both **initial setup** and **joining existing projects**
gracefully. This is critical for team workflows.

**States to detect**:

| State | Detection | Setup Behavior |
| --- | --- | --- |
| Fresh project | No `.tbd/`, no `.beads/` | Full init, `--prefix` required |
| Migration | Has `.beads/`, no `.tbd/` | Migrate, use existing prefix |
| Joining project | Has `.tbd/` | Configure local hooks only, no prefix needed |

**First contributor flow**:
```bash
npm install -g get-tbd@latest
tbd setup --auto --prefix=myproject
git add .tbd/ .claude/ && git commit -m "Initialize tbd"
git push
```

**Subsequent contributor flow**:
```bash
git clone <repo>  # .tbd/ comes with repo
npm install -g get-tbd@latest
tbd setup --auto  # Detects existing config, just sets up hooks
```

**Key Behaviors**:
- `setup --auto` on initialized project should NOT require `--prefix`
- Should skip initialization, just configure local integrations
- Should output status showing project is ready

**Assessment**: Smooth multi-contributor onboarding is essential for team adoption.
The second contributor’s experience should be nearly instant.

* * *

### 10. Orientation Hierarchy Pattern

#### 10.1 Two-Level Orientation

**Status**: ✅ Complete

**Details**:

Provide exactly two levels of orientation: **full** (default) and **brief**. Avoid three
or more levels which create confusion about which to use.

| Command | Lines | When to Use |
| --- | --- | --- |
| `cli prime` | ~200 | Session start, full orientation needed |
| `cli prime --brief` | ~35 | Context recovery, constrained situations |

**Full orientation includes**:
- Dynamic status (installation state, project state, issue counts)
- Static content (value proposition, workflow rules, all commands)
- Resource directory (shortcuts, guidelines, templates)

**Brief orientation includes**:
- Condensed status
- Core workflow rules only
- Quick reference (most common commands)
- Session closing checklist

**Relationship to skill file**:
- `cli skill` outputs static content only (for file installation)
- `cli prime` = dynamic status + skill content
- `cli prime --brief` = condensed status + `cli skill --brief`

**Assessment**: Two levels is the right granularity.
Full for comprehensive understanding, brief for context recovery.
More levels create decision paralysis.

* * *

### 11. Dynamic Generation Patterns

#### 11.1 On-the-Fly Resource Directory Generation

**Status**: ✅ Complete

**Details**:

Rather than maintaining static resource directories that can become stale, generate them
dynamically at runtime from installed documents.

**Implementation Pattern**:

```typescript
async function generateShortcutDirectory(): Promise<string> {
  const shortcuts = await docCache.listDocuments('shortcuts');
  const rows = shortcuts.map(doc => {
    const meta = doc.frontmatter;
    return `| ${doc.name} | ${meta.title} | ${meta.description} |`;
  });
  return [
    '## Available Shortcuts',
    '',
    '| Name | Title | Description |',
    '| --- | --- | --- |',
    ...rows
  ].join('\n');
}
```

**Benefits**:

- Always current with installed resources
- No manual synchronization required
- Supports project-level overrides automatically
- Can be injected into skill output dynamically

**Marker Pattern for Incremental Updates**:

```markdown
<!-- BEGIN SHORTCUT DIRECTORY -->

| Name | Title | Description |
| --- | --- | --- |
| commit-code | Commit Code | Run pre-commit checks... |

<!-- END SHORTCUT DIRECTORY -->
```

Markers enable selective updates without regenerating entire documents.

* * *

#### 11.2 DocCache Shadowing Pattern

**Status**: ✅ Complete

**Details**:

Implement path-ordered document loading that allows project-level resources to shadow
(override) built-in resources, similar to how shell `$PATH` works.

**Loading Order** (earlier paths take precedence):

1. Project-level: `.tbd/docs/shortcuts/`
2. User-level: `~/.tbd/docs/shortcuts/`
3. Built-in: Bundled with CLI

**Implementation Pattern**:

```typescript
class DocCache {
  private paths: string[];  // Ordered by priority

  async loadDocument(name: string): Promise<Document | null> {
    for (const basePath of this.paths) {
      const doc = await this.tryLoad(join(basePath, name));
      if (doc) return doc;  // First match wins
    }
    return null;
  }
}
```

**Use Cases**:

- Project-specific guidelines that override defaults
- Custom shortcuts for specialized workflows
- Organization-wide standards distributed separately

**Assessment**: Shadowing enables customization without forking while maintaining
sensible defaults for new projects.

* * *

#### 11.3 Custom Prime Override Pattern

**Status**: ✅ Complete

**Details**:

Allow projects to customize their orientation output via a `.tbd/PRIME.md` override
file. When present, this file is used instead of the default prime output.

**Use Cases**:

- Projects with specialized workflows
- Enterprise deployments with custom guidance
- Educational projects with learning-focused orientation

**Implementation**:

```typescript
async function getPrimeContent(): Promise<string> {
  const customPath = join(cwd, '.tbd', 'PRIME.md');
  if (await pathExists(customPath)) {
    return readFile(customPath, 'utf-8');
  }
  return generateDefaultPrime();
}
```

**Assessment**: Custom overrides respect project autonomy while maintaining sensible
defaults.

* * *

### 12. MCP Integration Patterns

#### 12.1 MCP vs CLI-as-Skill

**Status**: ✅ Research Complete

**Details**:

MCP (Model Context Protocol) and CLI-as-Skill are complementary approaches, not
competitors. Understanding when to use each is critical.

| Aspect | CLI-as-Skill | MCP Server |
| --- | --- | --- |
| **Deployment** | npm install | Separate process |
| **Integration** | SKILL.md + hooks | MCP protocol |
| **Context** | Skill content in prompt | Tool calls |
| **State** | Stateless (per-command) | Can maintain state |
| **Scope** | Single CLI capabilities | Ecosystem of servers |
| **Complexity** | Lower | Higher |

**When to Use CLI-as-Skill**:

- Self-contained functionality
- Workflow guidance and documentation
- Resource libraries (guidelines, templates)
- Simple tool integration
- Quick setup requirements

**When to Use MCP**:

- Persistent connections (databases, APIs)
- Stateful operations
- Cross-tool orchestration
- Real-time data streaming
- Complex tool ecosystems

**Hybrid Pattern** (tbd approach):

```
CLI-as-Skill (primary)
├── Issue tracking commands
├── Resource libraries (shortcuts, guidelines)
├── Setup and configuration
└── Context management (prime, skill)

MCP (future consideration)
├── Real-time sync status
├── Cross-repo issue queries
├── Integration with external trackers
```

**Assessment**: Most CLIs should start with the skill pattern for simplicity.
Add MCP when you need persistent connections, real-time updates, or complex tool
ecosystems.

* * *

#### 12.2 Agent Skills Open Standard

**Status**: ✅ Complete

**Details**:

Claude Code skills follow the [Agent Skills](https://agentskills.io) open standard,
which works across multiple AI tools.
This enables portable skill definitions.

**Standard Features**:

- YAML frontmatter for metadata
- Markdown content for instructions
- Directory structure for supporting files
- Consistent activation patterns

**Claude Code Extensions**:

- `context: fork` for subagent execution
- `agent` field for subagent type selection
- `hooks` field for lifecycle automation
- `allowed-tools` for permission scoping
- Dynamic context injection via `!`command\`\`

**Monorepo Support**:

Claude Code automatically discovers skills from nested `.claude/skills/` directories:

```
packages/
├── frontend/
│   └── .claude/skills/     # Frontend-specific skills
├── backend/
│   └── .claude/skills/     # Backend-specific skills
└── .claude/skills/         # Shared skills
```

**Assessment**: Building on the open standard ensures portability while Claude Code
extensions enable advanced patterns when needed.

* * *

### 13. Hook Script Patterns

#### 13.1 PostToolUse Hook with JSON Parsing

**Status**: ✅ Complete

**Details**:

PostToolUse hooks receive JSON input describing the tool invocation.
Use bash scripts with jq to parse and conditionally respond.

**Hook Configuration** (`.claude/settings.json`):

```json
{
  "hooks": {
    "PostToolUse": [{
      "matcher": "Bash",
      "hooks": [{
        "type": "command",
        "command": "\"$CLAUDE_PROJECT_DIR\"/.claude/hooks/tbd-closing-reminder.sh"
      }]
    }]
  }
}
```

**Hook Script Pattern**:

```bash
#!/bin/bash
input=$(cat)
command=$(echo "$input" | jq -r '.tool_input.command // empty')

# Trigger on specific patterns
if [[ "$command" == git\ push* ]] || [[ "$command" == *"&& git push"* ]]; then
  if [ -d ".tbd" ]; then
    tbd closing
  fi
fi
exit 0
```

**Key Patterns**:

- Read input from stdin (JSON)
- Use jq to extract relevant fields
- Pattern match on command content
- Exit 0 to allow tool to proceed
- Exit non-zero to block with message

**Assessment**: PostToolUse hooks enable contextual reminders without interrupting
workflow. The git push detection pattern prevents premature session completion.

* * *

### 14. Invocation Control Patterns

#### 14.1 User vs Model Invocation

**Status**: ✅ Complete

**Details**:

Claude Code provides fine-grained control over who can invoke a skill:

| Frontmatter | User Can Invoke | Model Can Invoke | Use Case |
| --- | --- | --- | --- |
| (default) | Yes | Yes | General skills |
| `disable-model-invocation: true` | Yes | No | Workflows with side effects |
| `user-invocable: false` | No | Yes | Background knowledge |

**Examples**:

```yaml
# User-only: deployment workflow
---
name: deploy
description: Deploy application to production
disable-model-invocation: true
---
```

```yaml
# Model-only: background context
---
name: legacy-system-context
description: How the legacy billing system works
user-invocable: false
---
```

**Assessment**: Invocation control prevents unintended side effects while enabling
contextual knowledge injection.

* * *

#### 14.2 Argument Passing Pattern

**Status**: ✅ Complete

**Details**:

Skills can accept arguments via the `$ARGUMENTS` placeholder:

```yaml
---
name: fix-issue
description: Fix a GitHub issue by number
argument-hint: "[issue-number]"
---

Fix GitHub issue $ARGUMENTS following our coding standards.

1. Read the issue description
2. Understand requirements
3. Implement the fix
4. Write tests
5. Create a commit
```

**Invocation**: `/fix-issue 123` → “Fix GitHub issue 123 following our coding
standards.”

**Auto-Append Behavior**: If `$ARGUMENTS` is not in the content, arguments are
automatically appended as `ARGUMENTS: <value>`.

* * *

### 15. Visual Output Patterns

#### 15.1 Bundled Script Execution

**Status**: 🔬 Experimental

**Details**:

Skills can bundle scripts that generate visual output (HTML, SVG) which opens in the
user’s browser. This extends CLI capabilities beyond text.

**Use Cases**:

- Codebase visualization (tree maps, dependency graphs)
- Test coverage reports
- API documentation
- Database schema diagrams

**Pattern**:

```
skill-name/
├── SKILL.md
└── scripts/
    └── visualize.py   # Generates HTML, opens in browser
```

**SKILL.md**:

````yaml
---
name: codebase-visualizer
description: Generate interactive visualization of project structure
allowed-tools: Bash(python:*)
---

Run visualization:
```bash
python ~/.claude/skills/codebase-visualizer/scripts/visualize.py .
````
```

**Assessment**: Bundled scripts enable sophisticated visual output while keeping the
skill self-contained. Use sparingly—most CLI interactions should be text-based.

* * *

## Best Practices Summary

### Architecture

1. **Bundle documentation with CLI**: Self-contained packages work in all environments
2. **Implement fallback loading**: Support both bundled and development modes
3. **Use platform-appropriate formats**: SKILL.md for Claude, MDC for Cursor, markers
   for AGENTS.md
4. **Follow Agent Skills open standard**: Ensures portability across AI tools

### Context Management

5. **Implement a `prime` command**: Dashboard at session start, brief mode for
   constrained contexts
6. **Separate skill from dashboard**: Different verbosity levels for different needs
7. **Include context recovery instructions**: Agents need to know how to restore context
8. **Two-level orientation only**: Full (default) and brief—avoid more granularity
9. **Use progressive disclosure**: Level 1 (metadata) → Level 2 (skill body) → Level 3
   (resources)
10. **Keep SKILL.md under 500 lines**: Move detailed content to reference files

### Description Optimization

11. **Use the two-part rule**: What does it do? + When to use it?
12. **Write in third person**: "Processes files" not "I can help you"
13. **Include explicit trigger phrases**: Match how users naturally describe needs
14. **Test activation across prompts**: Descriptions can quadruple activation reliability

### Self-Documentation

15. **Provide documentation commands**: `readme`, `docs`, `design` as built-in commands
16. **Include Getting Started in help epilog**: One-liner must be easily accessible
17. **Use Markdown with terminal rendering**: Same content works in CLI and GitHub

### Setup Flows

18. **Two-tier command structure**: High-level (`setup`) and surgical (`init`)
19. **Require explicit mode flags**: `--auto` for agents, `--interactive` for humans
20. **Never guess user preferences**: For taste-based config (prefixes), always ask
21. **Support multi-contributor onboarding**: Detect already-initialized projects

### Agent Integration

22. **Install hooks programmatically**: SessionStart, PreCompact, PostToolUse
23. **Use skill directories**: `.claude/skills/`, `.cursor/rules/`
24. **Support multiple agents**: Single CLI, multiple integration points
25. **Use invocation control**: `disable-model-invocation` for side-effect workflows

### Output

26. **Implement `--json` for all commands**: Machine-readable output is essential
27. **Use `output.data()` pattern**: Single code path for JSON and human output
28. **Provide `--quiet` mode**: For scripted usage without noise

### Error Handling

29. **Include next steps in errors**: Actionable guidance, not just error messages
30. **Graceful deprecation**: Keep old commands working with migration guidance
31. **Explicit completion protocols**: Checklists prevent premature completion

### Agent Mental Model

32. **Design for agent-as-partner**: Help agents serve users, not relay commands
33. **Lead with value proposition**: Explain *why* before *how*
34. **Distinguish action from informational commands**: Some commands teach, not do

### Resource Libraries

35. **Bundle guidelines, shortcuts, templates**: Ship curated knowledge with CLI
36. **Show full commands in directories**: `cli shortcut X`, not just `X`
37. **Organize resources by purpose**: Categories by workflow phase or domain
38. **Enable on-demand knowledge queries**: Agents pull in relevant resources JIT
39. **Implement shadowing for customization**: Project-level overrides without forking
40. **Generate directories dynamically**: Avoid stale documentation

* * *

## Open Research Questions

### Resolved Questions

1. ~~**Cross-agent skill synchronization**: How to keep skills in sync across Claude,
   Cursor, Codex when formats differ?~~
   → **Resolved**: Use Agent Skills open standard as base, with platform-specific
   extensions. Generate platform files from single source during build.

2. ~~**Context budget optimization**: What's the optimal token budget for different
   context window sizes?~~
   → **Resolved**: Progressive disclosure architecture. Level 1 (~100 tokens) always,
   Level 2 (~1,500-5,000 tokens) on trigger, Level 3 as-needed. Keep SKILL.md under 500
   lines.

### Active Questions

3. **Hook composition**: How should multiple CLIs with hooks interact? What happens when
   two tools both want SessionStart hooks? Priority rules? Composition patterns?

4. **Resource library curation**: What's the right balance between comprehensive
   resources and overwhelming agents with options? Empirical data needed on optimal
   resource count.

5. **Proactive resource suggestion**: Should CLIs suggest relevant resources based on
   context (e.g., "you're writing TypeScript, consider `guidelines typescript-rules`")?
   Risk of noise vs. benefit of guidance.

6. **Cross-CLI resource sharing**: Could multiple CLIs share a common resource library
   format, enabling ecosystem-wide best practices? Agent Skills standard is a starting
   point but doesn't cover resource libraries.

7. **MCP vs Skill boundary**: When should a CLI add MCP server capabilities vs. staying
   pure skill-based? What's the complexity threshold? Need heuristics for deciding.

8. **Activation testing methodology**: How to systematically test skill activation
   reliability? Need standardized test prompts and measurement approach.

9. **Nested skill discovery**: In monorepos with nested `.claude/skills/` directories,
   what are the precedence rules? How to handle conflicts between package-level and
   root-level skills?

10. **Visual output patterns**: When are bundled scripts that generate HTML appropriate?
    Risk of over-engineering vs. value of visualization. Need guidelines.

11. **GitHub MCP Registry integration**: Should CLIs register as MCP servers in addition
    to skills? How to balance npm distribution with MCP registry discovery?

12. **Agent-to-agent handoff**: When a skill runs in a subagent (`context: fork`), how
    should results be communicated back? Summarization strategies? Token budgets for
    handoff?

* * *

## Recommendations

### Summary

Build CLIs as self-contained skill modules that can be installed via npm and
automatically integrate with multiple AI coding agents.
The key patterns are: bundled documentation, prime-first context management, two-tier
setup flows, multi-agent integration files, and resource libraries (guidelines,
shortcuts, templates).

The critical mental model shift: design CLIs to help agents serve users better, not just
to relay commands. This means leading with value proposition, bundling reusable
knowledge, and distinguishing action commands from informational commands.

### Recommended Approach

1. **Start with SKILL.md**: Define the agent-facing documentation first, leading with
   value proposition. Use the two-part description rule.
2. **Apply progressive disclosure**: Keep SKILL.md under 500 lines, reference supporting
   files for detailed content
3. **Implement `prime` and `skill` commands**: Context management is foundational
4. **Build two-tier setup**: `setup --auto` for agents, surgical `init` for advanced
   users
5. **Add hooks installation**: Automatic context injection via SessionStart/PreCompact
6. **Bundle resource libraries**: Guidelines, shortcuts, and templates as informational
   commands with dynamic directory generation
7. **Organize resources by purpose**: Categories help agents find relevant knowledge
8. **Support JSON output**: Every command should have `--json` mode
9. **Test activation reliability**: Use 10+ representative prompts to verify descriptions
   trigger correctly
10. **Implement shadowing**: Allow project-level overrides without forking

### Alternative Approaches

- **MCP-based integration**: For persistent connections, real-time updates, or complex
  tool ecosystems, add MCP server capabilities alongside skill integration
- **Remote skill hosting**: For frequently updated skills, consider remote loading
- **Agent-specific packages**: For platforms with unique requirements, separate packages
- **Hybrid CLI+MCP**: Use skills for documentation and workflows, MCP for stateful
  operations

* * *

## References

### Official Documentation

- Claude Code Skills Documentation: https://code.claude.com/docs/en/skills
- Agent Skills Open Standard: https://agentskills.io
- Cursor IDE MDC Format: https://cursor.sh/docs/rules

### Community Resources

- Claude Skills Best Practices:
  https://github.com/Dicklesworthstone/meta_skill/blob/main/BEST_PRACTICES_FOR_WRITING_AND_USING_SKILLS_MD_FILES.md
- Claude Code Skills Guide (Gist):
  https://gist.github.com/mellanon/50816550ecb5f3b239aa77eef7b8ed8d
- Awesome Claude Skills: https://github.com/travisvn/awesome-claude-skills

### MCP Resources

- Anthropic MCP Engineering Blog: https://www.anthropic.com/engineering/code-execution-with-mcp
- MCP Agent Frameworks Comparison: https://clickhouse.com/blog/how-to-build-ai-agents-mcp-12-frameworks
- GitHub MCP Registry: https://github.com/modelcontextprotocol

### Implementation References

- Commander.js: https://github.com/tj/commander.js
- tbd Source Code: https://github.com/jlevy/tbd

* * *

## Appendices

### Appendix A: File Structure for Agent-Integrated CLI
```
packages/tbd/ ├── src/ │ ├── cli/ │ │ ├── commands/ │ │ │ ├── prime.ts # Context
management (dashboard + orientation) │ │ │ ├── skill.ts # Skill output (static content)
│ │ │ ├── setup.ts # Agent integration (hooks, skill files) │ │ │ ├── init.ts # Surgical
init (prefix, config) │ │ │ ├── docs.ts # Documentation (CLI reference) │ │ │ ├──
readme.ts # README display │ │ │ ├── closing.ts # Session protocol reminder │ │ │ ├──
shortcut.ts # Workflow shortcuts (informational) │ │ │ ├── guidelines.ts # Coding
guidelines (informational) │ │ │ └── template.ts # Document templates (informational) │
│ ├── lib/ │ │ │ ├── output.ts # Output modes, colors, help epilog │ │ │ ├──
base-command.ts │ │ │ ├── doc-cache.ts # Path-ordered doc loading with shadowing │ │ │
└── errors.ts # Structured error types │ │ └── cli.ts # Program setup, default command │
└── docs/ │ ├── SKILL.md # Claude Code skill (<500 lines) │ ├── SKILL-brief.md #
Condensed skill for context recovery │ ├── CURSOR.mdc # Cursor IDE rules │ ├──
tbd-docs.md # CLI reference │ ├── tbd-closing.md # Session protocol │ ├── shortcuts/ #
Workflow instruction files │ │ ├── commit-code.md │ │ ├── new-plan-spec.md │ │ └── ... │
├── guidelines/ # Coding best practice files │ │ ├── typescript-rules.md │ │ ├──
general-tdd-guidelines.md │ │ └── ... │ └── templates/ # Document template files │ ├──
template-plan-spec.md │ └── ... ├── dist/ │ ├── bin.mjs # Bundled CLI │ └── docs/ #
Bundled documentation (all resources) │ ├── SKILL.md │ ├── SKILL-brief.md │ ├──
CURSOR.mdc │ ├── README.md │ ├── shortcuts/ │ ├── guidelines/ │ ├── templates/ │ └── ...
└── package.json

# Project-level installation (shadowing support)

.tbd/ ├── docs/ │ ├── shortcuts/ │ │ └── custom-workflow.md # Project-specific shortcuts
│ └── guidelines/ │ └── project-rules.md # Project-specific guidelines ├── PRIME.md #
Optional: custom prime override └── ...

# Claude Code integration

.claude/ ├── skills/ │ └── tbd/ │ └── SKILL.md # Installed by `tbd setup` ├── hooks/ │
└── tbd-closing-reminder.sh # PostToolUse hook script └── settings.json # Hook
configuration
```

### Appendix B: Integration Checklist for New CLIs

**Agent Integration Files**
- [ ] SKILL.md with YAML frontmatter (name, description, allowed-tools)
- [ ] CURSOR.mdc with MDC frontmatter (description, alwaysApply)
- [ ] AGENTS.md section with HTML markers
- [ ] Follow Agent Skills open standard for portability

**Description Quality**
- [ ] Two-part description: capabilities + activation triggers
- [ ] Third-person language only
- [ ] Explicit trigger phrases matching user language
- [ ] Test activation across 10+ representative prompts

**Context Management**
- [ ] `prime` command with dashboard and brief modes (two levels only)
- [ ] `skill` command for full documentation output
- [ ] Value-first orientation in skill file (why before how)
- [ ] Context recovery instructions in all docs
- [ ] Session closing protocol checklist
- [ ] SKILL.md under 500 lines (progressive disclosure)
- [ ] Support for custom prime override (`.tbd/PRIME.md` or equivalent)

**Setup Flow**
- [ ] `setup --auto` for agent-friendly installation
- [ ] `init --prefix` for surgical initialization
- [ ] Multi-contributor detection (skip init if already configured)
- [ ] Never auto-detect user preferences (ask for prefix, etc.)

**Hooks**
- [ ] SessionStart hook to call `prime`
- [ ] PreCompact hook to call `prime`
- [ ] PostToolUse hook for session completion reminders
- [ ] Hook scripts with JSON parsing for conditional triggers

**Invocation Control**
- [ ] Identify skills that should be user-only (`disable-model-invocation: true`)
- [ ] Identify background knowledge skills (`user-invocable: false`)
- [ ] Use `argument-hint` for skills that accept arguments

**Self-Documentation**
- [ ] Help epilog with one-liner installation command
- [ ] Documentation commands (`readme`, `docs`)
- [ ] `--json` flag on all commands

**Resource Libraries (Informational Commands)**
- [ ] `shortcut` command with `--list` and category filtering
- [ ] `guidelines` command with `--list` and category filtering
- [ ] `template` command with `--list`
- [ ] Resources organized by purpose/workflow phase
- [ ] Resource directories generated dynamically (not static)
- [ ] Resources bundled with CLI distribution
- [ ] Shadowing support for project-level overrides
```
