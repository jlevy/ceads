---
title: CLI Agent Skill Patterns
description: Best practices for building TypeScript CLIs that function as agent skills in Claude Code and other AI coding agents
author: Joshua Levy (github.com/jlevy) with LLM assistance
---
# CLI Agent Skill Patterns

These patterns apply to building TypeScript CLI applications that function as powerful
skills within Claude Code and other AI coding agents.
The patterns are derived from the `tbd` CLI implementation, which serves as a reference
architecture for agent-integrated command-line tools.

The core insight is that a CLI can be much more than a command executor—it can be a
**dynamic skill module** that provides context management, self-documentation, and
seamless integration with multiple AI agents through a single npm package.

**When to use this guideline**: When building a CLI tool that should work well with AI
coding agents, when adding agent integration to an existing CLI, or when designing
context management for agent-aware applications.

## Key Patterns to Consider for CLIs

1. **CLI as Dynamic Skill Module:** CLIs can provide context management,
   self-documentation, and multi-agent integration through a single npm package.

2. **CLI as Knowledge Library:** Bundle guidelines, shortcuts, and templates that agents
   can query on-demand to improve work quality.
   This transforms the CLI from a tool the agent tells users about into a resource the
   agent uses to better serve users.

3. **Context Injection Loop:** A recursive architecture where skill documentation
   references commands, those commands output more context, and that context references
   further commands. This creates a self-directing knowledge system where agents get
   progressively smarter as they work.

4. **Task Management Integration:** CLIs that help agents track work across sessions,
   discover available tasks, and enforce session boundaries lead to more reliable
   agentic workflows.

* * *

## 1. CLI as Skill Architecture

### 1.1 Bundled Documentation Pattern

- **Bundle documentation files with CLI**: Include skill files, `README.md`, and docs in
  the CLI distribution.
  Maintain tiered skill files for different contexts:

| Tier | File | Tokens | Purpose |
| --- | --- | --- | --- |
| Full | `skill-baseline.md` | ~2000 | Default installation, full workflow guide |
| Brief | `skill-brief.md` | ~400 | Condensed version for `--brief` flag |

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

- **Use a `dist/docs/` directory**: Store bundled docs alongside the CLI for
  self-contained packages that work in sandboxed environments, containers, and CI.

- **Implement fallback loading**: Support bundled → development source → repo-level
  docs.

- **Provide a `skill` subcommand**: Output skill content to stdout so agents can inspect
  or pipe it. Support verbosity flags:
  ```bash
  mycli skill           # Full skill with dynamic content
  mycli skill --brief   # Condensed version (~400 tokens)
  ```

### 1.2 Multi-Agent Integration Files

Each agent platform has different file format requirements:

| Agent | File | Format | Location |
| --- | --- | --- | --- |
| Claude Code | SKILL.md | YAML frontmatter + Markdown | `.claude/skills/name/` |
| Cursor IDE | CURSOR.mdc | MDC frontmatter + Markdown | `.cursor/rules/` |
| Codex | AGENTS.md | HTML markers + Markdown | repo root |

**SKILL.md Format** (Claude Code):

```yaml
---
name: mycli
description: Lightweight, git-native issue tracking...
allowed-tools: Bash(mycli:*)
---
# mycli Workflow
...
```

**CURSOR.mdc Format** (Cursor IDE):

```yaml
---
description: mycli workflow rules for git-native issue tracking...
alwaysApply: false
---
# mycli Workflow
...
```

**AGENTS.md Format** (Codex):

```markdown
<!-- BEGIN MYCLI INTEGRATION -->
# mycli Workflow
...
<!-- END MYCLI INTEGRATION -->
```

* * *

## 2. Context Management Commands

### 2.1 Prime Command Pattern

The `prime` command is the key context management primitive.
It outputs contextual information appropriate to the current state:

- **Initialized repo**: Dashboard with status, rules, quick reference
- **Not initialized**: Setup instructions
- **Migration detected**: Migration warning and guidance

**Key Features**:

- Called automatically via hooks at session start and before context compaction
- `--brief` flag for constrained contexts (~200 tokens)
- `--full` flag for complete skill documentation
- Custom override via `.mycli/PRIME.md` file
- CLI with no args shows help with prominent prompt to run `mycli prime` for full
  context

**Relationship with `skill` Command**:

The `prime` and `skill` commands serve different purposes:

| Command | Purpose | When Called |
| --- | --- | --- |
| `mycli prime` | Dashboard + status + workflow rules | Session start, context compaction |
| `mycli skill` | Pure skill content (no status/dashboard) | Agent inspection, installation preview |

Use `prime` for context restoration with current state, `skill` for static skill
documentation.

**Dashboard Output Structure**:

```
mycli v1.0.0

--- INSTALLATION ---
✓ mycli installed (v1.0.0)
✓ Initialized in this repo
✓ Hooks installed

--- PROJECT STATUS ---
Repository: proj
Tasks: 3 open (1 in_progress) | 1 blocked

--- WORKFLOW RULES ---
- Track all task work using mycli
- Check `mycli ready` for available work
- Run `mycli sync` at session end

--- QUICK REFERENCE ---
mycli ready              Show tasks ready to work
mycli show <id>          View task details
...
```

### 2.2 Progressive Disclosure Architecture

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

**Key Constraints**:

- Keep SKILL.md under 500 lines
- Reference files should stay one level deep from SKILL.md
- Avoid chains like SKILL.md → advanced.md → details.md
- Scripts execute outside context; only output uses tokens

### 2.3 Description Optimization Pattern

Skill activation relies on **pure LLM reasoning**, not keyword matching or embeddings.
Description quality directly impacts activation reliability.

**Activation Reliability Data** (from real-world testing across 200+ prompts):

| Approach | Success Rate |
| --- | --- |
| No optimization / vague descriptions | ~20% |
| Optimized descriptions with "Use when..." | ~50% |
| Descriptions with concrete examples | 72-90% |
| Forced evaluation hooks | 80-84% |

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
- Include explicit “Use when …” triggers with concrete scenarios
- Be specific with keywords users would naturally say
- State both capabilities AND activation conditions
- Front-load the most important trigger keywords in the first 50 characters
  (descriptions may be truncated in large skill collections)

### 2.4 Description Length and Budget Constraints

Claude Code has a **cumulative character budget** for all skill descriptions combined.
Understanding these limits is critical for CLIs that install multiple skills.

**Hard Limits**:

| Constraint | Limit | Notes |
| --- | --- | --- |
| Individual description | 1,024 characters | Per-skill maximum |
| Skill name | 64 characters | Lowercase, numbers, hyphens only |
| SKILL.md body | ~500 lines | Soft limit; use supporting files for more |
| **Cumulative budget** | ~15,000-16,000 chars | For ALL skill descriptions combined |

**Per-Skill Overhead**: Each skill consumes ~109 characters of XML overhead (tags, name,
location) plus the description length.

**Truncation Behavior**: When the cumulative budget is exceeded, skills are hidden:

| Skills Installed | Skills Visible | Hidden |
| --- | --- | --- |
| 63 | 42 | 33% |
| 92 | 36 | 60% |

**No warning is shown** when skills are truncated.
Run `/context` to check for excluded skills.

**Description Length Guidelines by Collection Size**:

| Skill Collection Size | Recommended Description Length |
| --- | --- |
| < 40 skills | Up to 1,024 characters (full limit) |
| 40-60 skills | ≤150 characters |
| 60+ skills | ≤130 characters |

**Override**: Set `SLASH_COMMAND_TOOL_CHAR_BUDGET` environment variable to increase the
limit.

**Meta-Skill Pattern**: For CLIs with many resources (50+), use a single meta-skill that
exposes resources via CLI commands rather than individual skills.
This consumes only one description slot (~200 chars) instead of 50+ slots that would
exceed the budget. See
[Skills vs Meta-Skill Architecture Research](../../project/research/current/research-skills-vs-meta-skill-architecture.md).

### 2.5 Skill Command Architecture

Every agent-integrated CLI should have a `skill` subcommand that outputs skill content
to stdout.
This enables agents to inspect skill content, preview before installation, and
pipe to other commands.

**Basic Pattern**:

```bash
mycli skill           # Full skill content
mycli skill --brief   # Condensed version for constrained contexts
```

**Key Behaviors**:

- Outputs composed skill content (doesn’t just read a static file)
- Dynamically generates resource directories from available docs
- Supports verbosity flags for different contexts
- Can be piped to files or other commands

#### 2.5.1 Tiered Skill Files

Maintain two tiers of skill content for different contexts:

| Tier | File | Tokens | When Used |
| --- | --- | --- | --- |
| Full | `skill-baseline.md` | ~2000 | Default setup, `skill` command |
| Brief | `skill-brief.md` | ~400 | `skill --brief`, compacted contexts |

#### 2.5.2 Skill Composition Pattern

Compose full skill content from separate components:

```
┌─────────────────────────────────────┐
│ claude-header.md (YAML frontmatter) │
├─────────────────────────────────────┤
│ skill-baseline.md (workflow guide)  │
├─────────────────────────────────────┤
│ <!-- BEGIN SHORTCUT DIRECTORY -->   │
│ (dynamically generated tables)      │
│ <!-- END SHORTCUT DIRECTORY -->     │
└─────────────────────────────────────┘
```

**Benefits**:

- Header can be updated independently from content
- Dynamic sections stay current with available resources
- HTML comment markers enable partial updates without full regeneration

**Implementation Pattern**:

```typescript
async function composeFullSkill(): Promise<string> {
  // Load YAML header (Claude Code metadata)
  const header = await loadDocContent('install/claude-header.md');

  // Load base skill content
  const baseSkill = await loadDocContent('shortcuts/system/skill-baseline.md');

  // Generate dynamic resource directory
  const directory = await generateShortcutDirectory();

  // Compose: header + base + dynamic content
  let result = header + baseSkill;
  if (directory) {
    result = result.trimEnd() + '\n\n' + directory;
  }

  return result;
}
```

**Updatable Regions with HTML Markers**:

When installing skill files, use HTML comment markers to identify sections that can be
updated independently:

```markdown
<!-- BEGIN SHORTCUT DIRECTORY -->
## Available Shortcuts
...generated table...
<!-- END SHORTCUT DIRECTORY -->
```

This allows the CLI to update just the directory section when resources change, without
regenerating the entire skill file.

**“DO NOT EDIT” Markers**:

For generated skill files installed in `.claude/skills/`, insert a “DO NOT EDIT” marker
after the frontmatter to warn users:

```markdown
---
name: mycli
description: ...
---
<!-- DO NOT EDIT: Generated by mycli setup.
Run 'mycli setup' to update.
-->
# mycli Workflow
...
```

#### 2.5.3 File Management Patterns

**Critical Architecture Principle**: CLIs should version control **source files**, not
final installed files.
Different file types have different management patterns.

**File Ownership Summary**:

| File | Location | Managed By | User Editable? |
| --- | --- | --- | --- |
| **SKILL.md** | `.claude/skills/mycli/` | CLI (fully) | ❌ Never |
| **AGENTS.md** | Repo root | CLI + User (hybrid) | ✓ Outside markers |
| **CLAUDE.md** | Repo root | User (optional) | ✓ Fully |

**Pattern 1: SKILL.md (CLI-Managed Only)**

The SKILL.md file is **entirely managed by the CLI**. Neither users nor agents should
edit it directly—it will be overwritten on the next `setup` run.

```
project-root/.claude/skills/mycli/SKILL.md  # Generated, never edit
```

**How tbd implements this**:
- `tbd setup --auto` composes and installs `.claude/skills/tbd/SKILL.md`
- Inserts “DO NOT EDIT” marker after frontmatter
- Regenerates on each setup with latest CLI content + dynamic shortcut directory

**Pattern 2: AGENTS.md (Hybrid Management)**

The AGENTS.md file uses **HTML comment markers** to separate CLI-managed sections from
user-editable content.

```markdown
# My Project

User-written context here... ✓ User can edit

<!-- BEGIN MYCLI INTEGRATION -->
...CLI-generated content...
<!-- END MYCLI INTEGRATION -->

More user content... ✓ User can edit
```

**Marker-based updates**:
- CLI owns content **between markers** (`<!-- BEGIN ... -->` to `<!-- END ... -->`)
- User can freely edit content **outside markers**
- `mycli setup --auto` updates only the marked section, preserving user content

**How tbd implements this**:
```typescript
// Define marker boundaries
const BEGIN_MARKER = '<!-- BEGIN TBD INTEGRATION -->';
const END_MARKER = '<!-- END TBD INTEGRATION -->';

// Update only marked section
function updateSection(existingContent: string, newSection: string): string {
  const start = existingContent.indexOf(BEGIN_MARKER);
  const end = existingContent.indexOf(END_MARKER) + END_MARKER.length;
  return existingContent.slice(0, start) + newSection + existingContent.slice(end);
}
```

**Pattern 3: CLAUDE.md (Optional User File)**

CLAUDE.md is typically **user-managed** for project-specific instructions.
CLIs can support different approaches:

1. **Symlink to AGENTS.md** (recommended for identical content):
   ```bash
   ln -s AGENTS.md CLAUDE.md
   ```

2. **Copy of AGENTS.md** (for separate content):
   ```bash
   mycli setup --create-claude-md  # CLI creates initial copy
   ```

3. **Separate user-maintained file** (tbd’s approach):
   - CLI doesn’t manage it
   - Users create/maintain manually

**What to Version Control in Your CLI Package**:

```
packages/mycli/
├── docs/
│   ├── install/
│   │   └── claude-header.md       # ✓ YAML frontmatter source
│   └── shortcuts/system/
│       ├── skill-baseline.md      # ✓ Full skill source
│       └── skill-brief.md         # ✓ Brief skill source
└── dist/docs/
    └── SKILL.md                   # ✓ Bundled during build
```

**What NOT to Version in CLI Package**:

- ❌ `.claude/skills/mycli/SKILL.md` (installed per-project)
- ❌ `AGENTS.md` (created in user projects)
- ❌ `CLAUDE.md` (user-managed)

**User Project Structure** (after `mycli setup --auto`):

```
user-project/
├── .claude/skills/mycli/
│   └── SKILL.md               # CLI-managed, DO NOT EDIT
├── AGENTS.md                  # Hybrid: CLI section + user content
└── CLAUDE.md                  # Optional: User-managed or symlink
```

**Correct Workflows**:

```bash
# Setup in user project
npm install -g mycli@latest
cd /path/to/project
mycli setup --auto

# ✓ Users can edit AGENTS.md outside markers
vim AGENTS.md  # Edit user sections, avoid marked regions

# ✓ Update CLI-managed content by re-running setup
mycli setup --auto  # Idempotent, preserves user edits

# ❌ Don't edit CLI-managed files
vim .claude/skills/mycli/SKILL.md  # Will be overwritten!
```

**Key Principles**:

1. **Single Source of Truth**: Source files in CLI package are canonical
2. **Clear Ownership Boundaries**: Use markers and “DO NOT EDIT” warnings
3. **Preserve User Content**: Surgical updates to marked sections only
4. **Idempotent Setup**: Safe to run `setup --auto` multiple times
5. **Dynamic Per-Project Content**: Installed files may include project-specific
   additions

* * *

## 3. Context Injection Loop Pattern

One of the most powerful patterns in agent-integrated CLIs is the **context injection
loop**—a recursive architecture where skill documentation references commands, those
commands output more context, and that context references further commands.

**The Loop Structure**:

```
┌─────────────────────────────────────────────────────────────────────┐
│  SKILL.md (Level 2 - loaded on activation)                         │
│  ├── Describes capabilities and when to use them                   │
│  ├── References: "For TypeScript work, run `cli guidelines ts`"    │
│  └── References: "To plan features, run `cli shortcut new-plan`"   │
└─────────────────────────┬───────────────────────────────────────────┘
                          │ Agent runs referenced command
                          ▼
┌─────────────────────────────────────────────────────────────────────┐
│  Guidelines/Shortcuts (Level 3 - loaded on demand)                 │
│  ├── Domain-specific knowledge injected into context               │
│  ├── References: "Create issues with `cli create`"                 │
│  ├── References: "For testing patterns, see `cli guidelines tdd`"  │
│  └── References: "Use template: `cli template plan-spec`"          │
└─────────────────────────┬───────────────────────────────────────────┘
                          │ Agent follows instructions, may run more commands
                          ▼
┌─────────────────────────────────────────────────────────────────────┐
│  Action Commands or More Context                                    │
│  ├── Agent executes actions with full accumulated context          │
│  └── Or loads additional guidelines/templates as needed            │
└─────────────────────────────────────────────────────────────────────┘
```

**Key Properties**:

| Property | Description |
| --- | --- |
| **Self-directing** | Each context layer tells the agent what to do next |
| **Just-in-time** | Context loads only when relevant, preserving token budget |
| **Composable** | Guidelines can reference other guidelines |
| **Actionable** | Context always leads to concrete actions |

**Implementation Guidelines**:

1. **Every guideline should reference related guidelines**: If typescript-rules mentions
   testing, it should reference `cli guidelines testing-rules`

2. **Every shortcut should reference action commands**: Shortcuts are workflows—they
   must tell the agent which commands to run

3. **Limit chain depth to 3**: SKILL.md → Guideline → Sub-guideline is fine; deeper
   chains confuse agents

4. **Use consistent reference syntax**: Always `cli command arg` format, never prose
   like “you might want to check the testing guidelines”

**Anti-patterns**:

```markdown
# BAD: Vague reference
See the testing documentation for more details.

# GOOD: Explicit command reference
For testing patterns, run `mycli guidelines general-testing-rules`.
```

* * *

## 4. Agent Mental Model Patterns

### 4.1 Agent as Partner, Not Messenger

The fundamental mental model shift for agent-integrated CLIs is from:
> “Here are commands you can tell the user about”

To:
> “Here’s how this tool helps you (the agent) serve the user better”

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

### 4.2 Informational Commands Pattern

A key architectural pattern is the distinction between **action commands** and
**informational commands**:

| Type | Purpose | Example |
| --- | --- | --- |
| Action commands | Perform operations | `create`, `close`, `sync` |
| Informational commands | Output guidance for the agent to follow | `shortcut`, `guidelines`, `template` |

Informational commands don’t perform actions—they display instructions, best practices,
or templates that tell the agent *how* to do something well.
The agent reads the output and follows the guidance.

### 4.3 Resource Library Pattern

Beyond core functionality, agent-integrated CLIs can bundle **resource libraries**—
collections of guidelines, shortcuts, and templates that agents access on-demand.

**Resource Types**:

| Resource | Purpose | Access Pattern |
| --- | --- | --- |
| Guidelines | Best practices for specific domains | `cli guidelines <name>` |
| Shortcuts | Step-by-step workflow instructions | `cli shortcut <name>` |
| Templates | Document starting points | `cli template <name>` |

**Benefits**:

1. **Self-contained**: Resources ship with the CLI, no external dependencies
2. **Versionable**: Resource improvements ship with CLI updates
3. **Discoverable**: `--list` flags help agents find available resources
4. **Contextual**: Agents query relevant resources just-in-time

### 4.4 Resource Directory Pattern

When documenting available resources, show the **full command to run**, not just the
resource name. This removes friction for agents.

**Anti-pattern** (name only):

```markdown
## Available Shortcuts
- code-review-and-commit
- create-or-update-pr-simple
- new-plan-spec
```

**Preferred pattern** (full command):

```markdown
## Available Shortcuts

| Command | Purpose | Description |
|---------|---------|-------------|
| `mycli shortcut code-review-and-commit` | Commit Code | How to run pre-commit checks and commit |
| `mycli shortcut create-pr` | Create PR | How to create a pull request |
| `mycli shortcut new-plan-spec` | Plan Feature | How to create a planning specification |
```

* * *

## 5. Setup Flow Patterns

### 5.1 Two-Tier Command Structure

Implement two levels of setup commands:

| Command | Purpose | Audience |
| --- | --- | --- |
| `mycli setup --auto` | Full setup with auto-detection | Agents, scripts |
| `mycli setup --interactive` | Prompted setup | Humans |
| `mycli init --prefix=X` | Surgical initialization only | Advanced users |

### 5.2 Mode Flags Pattern

Always require explicit mode selection for setup commands:

```bash
mycli setup              # Shows help, requires mode flag
mycli setup --auto       # Non-interactive (for agents)
mycli setup --interactive # Interactive (for humans)
```

**Why This Matters**:

- Prevents agents from getting stuck in interactive prompts
- Ensures humans get guided experience when they want it
- Explicit is better than implicit for setup operations

### 5.3 Setup Idempotency Requirements

**Setup MUST be idempotent**—safe to run repeatedly without side effects or errors.
This is critical because:

- Agents may run setup multiple times to refresh configuration
- Users may run setup after CLI updates to get new features
- Setup may be called automatically via scripts or CI

**Idempotency Patterns**:

1. **Hook Deduplication**: When merging hooks into `.claude/settings.json`, filter out
   existing hooks before adding new ones:

   ```typescript
   // Filter out existing CLI hooks before merging
   const existingHooks = currentSettings.hooks.SessionStart || [];
   const filtered = existingHooks.filter(
     (entry) => !entry.hooks?.some((h) => h.command?.includes('mycli'))
   );
   mergedHooks.SessionStart = [...filtered, ...newHooks];
   ```

2. **Skill File Regeneration**: Always regenerate skill files with fresh content on each
   setup run. Don’t try to update in place—overwrite:

   ```typescript
   // Always regenerate skill file
   const skillContent = await composeFullSkill();
   await writeFile(skillPath, skillContent);  // Overwrite, don't append
   ```

3. **Legacy Cleanup**: Remove deprecated patterns on each run:

   ```typescript
   // Clean up old hook patterns
   const oldScripts = ['setup-mycli.sh', 'ensure-mycli.sh'];
   for (const script of oldScripts) {
     await rm(join(projectDir, '.claude/scripts', script)).catch(() => {});
   }
   ```

4. **Directory Creation**: Use `mkdir -p` style recursive creation that succeeds if
   directory already exists:

   ```typescript
   await mkdir(dirname(skillPath), { recursive: true });
   ```

**Testing Idempotency**:

Run setup twice and verify:
- No duplicate hooks in settings.json
- Skill file content is identical on both runs (except timestamps)
- No error messages about existing files/configs
- All features work correctly after both runs

### 5.4 Never Guess User Preferences

For configuration values that are matters of user taste (not technical requirements),
**never guess or auto-detect**. Always ask the user.

**Examples of preference values**:
- Project prefixes/abbreviations
- Naming conventions
- Style choices

* * *

## 6. Agent Integration Patterns

### 6.1 Claude Code Hooks

Configure Claude Code hooks for automatic context management:

**Global Hooks** (`~/.claude/settings.json`):

```json
{
  "hooks": {
    "SessionStart": [{
      "matcher": "",
      "hooks": [{ "type": "command", "command": "mycli prime" }]
    }],
    "PreCompact": [{
      "matcher": "",
      "hooks": [{ "type": "command", "command": "mycli prime" }]
    }]
  }
}
```

**Alternative PreCompact Hook Pattern (Optional)**:

For CLIs where token efficiency is critical, consider using `skill --brief` instead of
`prime` in the PreCompact hook:

```json
"PreCompact": [{
  "matcher": "",
  "hooks": [{ "type": "command", "command": "mycli skill --brief" }]
}]
```

**Tradeoffs**:
- ✓ More token-efficient (~~400 tokens vs ~~800-1200 for `prime`)
- ✓ Pure skill content without status/dashboard noise
- ✗ No project-specific status information before compaction
- ✗ Agent loses current state context

Use `skill --brief` when the condensed workflow rules are sufficient, or `prime` when
current project status is valuable for context restoration.

**Project Hooks** (`.claude/settings.json`):

```json
{
  "hooks": {
    "PostToolUse": [{
      "matcher": "Bash",
      "hooks": [{
        "type": "command",
        "command": "\"$CLAUDE_PROJECT_DIR\"/.claude/hooks/closing-reminder.sh"
      }]
    }]
  }
}
```

### 6.2 PostToolUse Hook with JSON Parsing

PostToolUse hooks receive JSON input describing the tool invocation.
Use bash scripts with jq to parse and conditionally respond.

```bash
#!/bin/bash
input=$(cat)
command=$(echo "$input" | jq -r '.tool_input.command // empty')

# Trigger on specific patterns
if [[ "$command" == git\ push* ]] || [[ "$command" == *"&& git push"* ]]; then
  if [ -d ".mycli" ]; then
    mycli closing
  fi
fi
exit 0
```

### 6.3 Help Structure for Agent Discovery

Agents need clear signals about how to get started with your CLI. Structure help output
to make setup commands and context restoration prominent.

**Pattern 1: Help Epilog with IMPORTANT Section**

Add prominent sections at the bottom of `--help` output:

```bash
$ mycli --help
Usage: mycli [options] [command]
...

IMPORTANT:
  Agents unfamiliar with mycli should run `mycli prime` for full context.

Getting Started:
  npm install -g mycli@latest && mycli setup --auto --prefix=<name>
```

**Implementation with Commander.js**:

```typescript
program
  .name('mycli')
  .description('Brief description')
  .addHelpText('after', `
IMPORTANT:
  Agents unfamiliar with mycli should run \`mycli prime\` for full context.

Getting Started:
  npm install -g mycli@latest && mycli setup --auto --prefix=<name>
`);
```

**Pattern 2: Context Recovery Prompt**

When the CLI runs without arguments, don’t just show help—prompt for context:

```bash
$ mycli
Usage: mycli [command] [options]
...
Tip: Run `mycli prime` to restore full workflow context.
```

**Pattern 3: Setup Command Prominence**

Ensure `setup` appears in a dedicated “Setup & Configuration” category in help output,
not buried in a long alphabetical list:

```
Setup & Configuration:
  init [options]         Initialize mycli in a repository
  setup [options]        Configure mycli integration with editors and tools
  config                 Manage configuration
```

**Why This Matters**:

- Agents often lose context after compaction or in new sessions
- Prominent `prime` references help agents restore workflow rules
- Clear setup commands help agents guide users through installation
- “IMPORTANT” section is scanned even when full help is ignored

* * *

## 7. Task Management Integration Patterns

### 7.1 Task Tracking Strategy Selection

Agent-integrated CLIs often need to track work across sessions.
The key architectural decision is **where task state lives** and **how complex the
tracking needs to be**.

**Three Strategies**:

| Strategy | State Location | Complexity | Use Case |
| --- | --- | --- | --- |
| **Ephemeral** | None | Minimal | Quick calculations, queries, one-shot tasks |
| **Session-local** | In-memory or temp file | Low | Multi-step tasks within a single session |
| **Persistent** | Git-tracked files | Medium-High | Multi-session projects, team collaboration |

**Decision Framework**:

```
Is the task done in one command?
  → Yes: Ephemeral (no tracking needed)
  → No: Does it span multiple sessions?
    → No: Session-local (agent's internal todo list)
    → Yes: Persistent (tbd integration or equivalent)
```

### 7.2 Agent-Aware Task Patterns

**Pattern 1: Auto-Discovery of Work**

Include a “what should I work on?”
command:

```bash
mycli ready          # Show tasks ready to work
mycli next           # Suggest the highest-priority task
```

**Pattern 2: Context-Preserving Task Creation**

When creating tasks from agent context, preserve relevant information:

```bash
mycli task create "Fix authentication bug" \
  --context "User reported login fails after password reset" \
  --related-files "src/auth/login.ts,src/auth/reset.ts"
```

**Pattern 3: Session Boundary Enforcement**

The CLI should remind agents to handle tasks at session end:

```markdown
## Session Closing Protocol

Before completing a session:
1. Close or update all tasks you worked on
2. Create tasks for any discovered work
3. Sync task state: `mycli sync`
```

* * *

## 8. Dynamic Generation Patterns

### 8.1 Dynamic Skill and Resource Directory Generation

Rather than maintaining static content that can become stale, generate skill files and
resource directories dynamically at runtime from source components and installed
documents.

**Pattern 1: Skill Composition from Multiple Sources**

Compose skill content from separate files for maintainability:

```typescript
async function composeFullSkill(): Promise<string> {
  // 1. Load YAML header (Claude Code metadata)
  const header = await loadDocContent('install/claude-header.md');

  // 2. Load base skill workflow content
  const baseSkill = await loadDocContent('shortcuts/system/skill-baseline.md');

  // 3. Generate dynamic resource directory from current docs
  const directory = await generateShortcutDirectory();

  // 4. Compose final skill: header + base + dynamic content
  let result = header + baseSkill;
  if (directory) {
    result = result.trimEnd() + '\n\n' + directory;
  }

  return result;
}
```

**Pattern 2: Resource Directory Generation**

Generate tables of available resources from loaded documents:

```typescript
async function generateShortcutDirectory(): Promise<string> {
  const shortcuts = await docCache.listDocuments('shortcuts');
  const rows = shortcuts.map(doc => {
    const meta = doc.frontmatter;
    return `| ${doc.name} | ${meta.title} | ${meta.description} |`;
  });

  // Wrap in HTML markers for incremental updates
  return [
    '<!-- BEGIN SHORTCUT DIRECTORY -->',
    '## Available Shortcuts',
    '',
    '| Name | Title | Description |',
    '| --- | --- | --- |',
    ...rows,
    '<!-- END SHORTCUT DIRECTORY -->'
  ].join('\n');
}
```

**Pattern 3: Incremental Updates with HTML Markers**

Use HTML comment markers to identify sections that can be updated independently:

```markdown
<!-- BEGIN SHORTCUT DIRECTORY -->
## Available Shortcuts
| Name | Description |
| --- | --- |
| code-review | Run pre-commit checks and commit |
| new-plan-spec | Create a planning specification |

<!-- END SHORTCUT DIRECTORY -->
```

This allows updating just the directory section when resources change, without
regenerating the entire skill file.

**Pattern 4: “DO NOT EDIT” Warnings**

For generated files installed in `.claude/skills/`, insert warnings after frontmatter:

```typescript
function insertDoNotEditMarker(content: string): string {
  const marker = `<!-- DO NOT EDIT: Generated by mycli setup.
Run 'mycli setup' to update.
-->`;

  // Insert after YAML frontmatter
  const lines = content.split('\n');
  const endOfFrontmatter = lines.findIndex((l, i) => i > 0 && l === '---');
  lines.splice(endOfFrontmatter + 1, 0, marker);
  return lines.join('\n');
}
```

**Benefits of Dynamic Generation**:

1. **Always Current**: Resource directories reflect actual available docs
2. **DRY Principle**: Single source of truth (frontmatter) drives multiple outputs
3. **Partial Updates**: HTML markers enable surgical updates to sections
4. **Version-Safe**: Content updates ship with CLI version updates

### 8.2 DocCache Shadowing Pattern

Implement path-ordered document loading that allows project-level resources to shadow
(override) built-in resources, similar to how shell `$PATH` works.

**Loading Order** (earlier paths take precedence):

1. Project-level: `.mycli/docs/shortcuts/`
2. User-level: `~/.mycli/docs/shortcuts/`
3. Built-in: Bundled with CLI

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

* * *

## 9. MCP Integration Patterns

MCP (Model Context Protocol) and CLI-as-Skill are complementary approaches.
Understanding when to use each is critical.

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

* * *

## Best Practices Summary

### Architecture

1. **Bundle documentation with CLI**: Self-contained packages work in all environments
2. **Maintain tiered skill files**: Full (baseline) and brief versions for different
   contexts
3. **Provide a `skill` subcommand**: Output skill content to stdout with `--brief` flag
4. **Implement fallback loading**: Support both bundled and development modes
5. **Use platform-appropriate formats**: SKILL.md for Claude, MDC for Cursor, markers
   for AGENTS.md

### Context Management

6. **Implement a `prime` command**: Dashboard at session start, brief mode for
   constrained contexts
7. **Implement a `skill` command**: Output pure skill content (no dashboard) for
   inspection and installation preview
8. **Separate skill from dashboard**: `prime` = status + context, `skill` = pure
   documentation
9. **Compose skills from multiple sources**: Header + baseline + dynamic directory
10. **Include context recovery instructions**: Agents need to know how to restore
    context
11. **Two-level orientation only**: Full (default) and brief—avoid more granularity
12. **Use progressive disclosure**: Level 1 (metadata) → Level 2 (skill body) → Level 3
    (resources)
13. **Keep SKILL.md under 500 lines**: Move detailed content to reference files

### Description Optimization

10. **Use the two-part rule**: What does it do?
    + When to use it?
11. **Write in third person**: “Processes files” not “I can help you”
12. **Include explicit trigger phrases**: Match how users naturally describe needs
13. **Front-load keywords**: Put most important triggers in first 50 characters
14. **Respect cumulative budget**: All descriptions share a ~15K character limit
15. **Use meta-skill pattern for 50+ resources**: One skill + CLI beats 50 individual
    skills

### Self-Documentation

14. **Provide documentation commands**: `readme`, `docs`, `design` as built-in commands
15. **Include Getting Started in help epilog**: One-liner must be easily accessible
16. **Add IMPORTANT section to help**: Prominently reference `prime` command for context
    restoration

### Setup Flows

17. **Two-tier command structure**: High-level (`setup`) and surgical (`init`)
18. **Require explicit mode flags**: `--auto` for agents, `--interactive` for humans
19. **Make setup idempotent**: Safe to run multiple times without errors or duplicates
20. **Deduplicate hooks on each run**: Filter existing hooks before merging new ones
21. **Regenerate skill files**: Always overwrite with fresh content, don’t try to update
    in place
22. **Clean up legacy patterns**: Remove deprecated files/configs on each setup run
23. **Never guess user preferences**: For taste-based config (prefixes), always ask

### Agent Integration

24. **Install hooks programmatically**: SessionStart, PreCompact, PostToolUse
25. **Use skill directories**: `.claude/skills/`, `.cursor/rules/`
26. **Support multiple agents**: Single CLI, multiple integration points
27. **Structure help for agent discovery**: IMPORTANT section, Getting Started
    one-liner, prominent setup commands

### Output

28. **Implement `--json` for all commands**: Machine-readable output is essential
29. **Use `output.data()` pattern**: Single code path for JSON and human output
30. **Provide `--quiet` mode**: For scripted usage without noise

### Error Handling

31. **Include next steps in errors**: Actionable guidance, not just error messages
32. **Graceful deprecation**: Keep old commands working with migration guidance
33. **Explicit completion protocols**: Checklists prevent premature completion

### Agent Mental Model

34. **Design for agent-as-partner**: Help agents serve users, not relay commands
35. **Lead with value proposition**: Explain *why* before *how*
36. **Distinguish action from informational commands**: Some commands teach, not do

### Resource Libraries

37. **Bundle guidelines, shortcuts, templates**: Ship curated knowledge with CLI
38. **Show full commands in directories**: `cli shortcut X`, not just `X`
39. **Organize resources by purpose**: Categories by workflow phase or domain
40. **Enable on-demand knowledge queries**: Agents pull in relevant resources JIT
41. **Implement shadowing for customization**: Project-level overrides without forking
42. **Generate directories dynamically**: Avoid stale documentation
43. **Use HTML markers for updatable sections**: Enable partial updates without full
    regeneration

### Context Injection

44. **Design self-reinforcing context chains**: SKILL.md → guidelines → actions
45. **Reference commands explicitly**: Always `cli command arg`, never vague prose
46. **Limit chain depth to 3**: Avoid deep reference chains that confuse agents
47. **Make every layer actionable**: Each context injection should lead to actions

### Task Management

48. **Choose appropriate tracking strategy**: Ephemeral, session-local, or persistent
49. **Implement work discovery**: `ready` or `next` commands for session start
50. **Add session boundary enforcement**: Remind agents to sync/close at session end
51. **Consider tbd integration**: For persistent multi-session task tracking

* * *

## Integration Checklist for New CLIs

**Agent Integration Files**

- [ ] SKILL.md with YAML frontmatter (name, description, allowed-tools)
- [ ] CURSOR.mdc with MDC frontmatter (description, alwaysApply)
- [ ] AGENTS.md section with HTML markers
- [ ] Tiered skill files: skill-baseline.md, skill-brief.md
- [ ] Separate header file: claude-header.md with YAML frontmatter

**Description Quality**

- [ ] Two-part description: capabilities + activation triggers
- [ ] Third-person language only
- [ ] Explicit “Use when …” trigger phrases matching user language
- [ ] Front-load important keywords in first 50 characters
- [ ] Description length appropriate for skill collection size (≤130 chars for 60+
  skills)

**Budget Management** (for CLIs installing multiple skills)

- [ ] Calculate cumulative description size (descriptions + ~109 chars overhead each)
- [ ] Verify total stays under 15K character budget
- [ ] Use meta-skill pattern if resources exceed 50
- [ ] Run `/context` to verify skills aren’t being truncated

**Context Management**

- [ ] `prime` command with dashboard and brief modes (two levels only)
- [ ] `skill` command for full documentation output with `--brief` flag
- [ ] Skill composition from header + baseline + dynamic directory
- [ ] HTML markers for updatable sections (<!-- BEGIN/END -->)
- [ ] “DO NOT EDIT” warnings in generated skill files
- [ ] Value-first orientation in skill file (why before how)
- [ ] Context recovery instructions in all docs
- [ ] Session closing protocol checklist
- [ ] SKILL.md under 500 lines (progressive disclosure)

**Setup Flow**

- [ ] `setup --auto` for agent-friendly installation
- [ ] `init --prefix` for surgical initialization
- [ ] Multi-contributor detection (skip init if already configured)
- [ ] Setup is idempotent (safe to run multiple times)
- [ ] Hook deduplication (filter existing before merging)
- [ ] Skill file regeneration (always overwrite, don’t update in place)
- [ ] Legacy pattern cleanup on each setup run

**Hooks**

- [ ] SessionStart hook to call `prime`
- [ ] PreCompact hook to call `prime`
- [ ] PostToolUse hook for session completion reminders

**Self-Documentation**

- [ ] Help epilog with “IMPORTANT” section referencing `prime`
- [ ] Help epilog with “Getting Started” one-liner installation command
- [ ] Setup command in dedicated “Setup & Configuration” category
- [ ] Context recovery prompt when CLI runs without args
- [ ] Documentation commands (`readme`, `docs`)
- [ ] `--json` flag on all commands

**Resource Libraries**

- [ ] `shortcut` command with `--list` and category filtering
- [ ] `guidelines` command with `--list` and category filtering
- [ ] `template` command with `--list`
- [ ] Resources organized by purpose/workflow phase
- [ ] Resource directories generated dynamically
- [ ] Shadowing support for project-level overrides

**Task Management**

- [ ] Decide tracking strategy: ephemeral, session-local, or persistent
- [ ] Implement work discovery command (`ready`, `next`)
- [ ] Add session closing reminders for task sync

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
- Skills Character Budget Research:
  https://github.com/anthropics/claude-code/issues/11045
- Skill Activation Reliability Testing:
  https://scottspence.com/posts/how-to-make-claude-code-skills-activate-reliably

### MCP Resources

- Anthropic MCP Engineering Blog:
  https://www.anthropic.com/engineering/code-execution-with-mcp
- MCP Agent Frameworks Comparison:
  https://clickhouse.com/blog/how-to-build-ai-agents-mcp-12-frameworks
- GitHub MCP Registry: https://github.com/modelcontextprotocol

### Implementation References

- Commander.js: https://github.com/tj/commander.js
- tbd Source Code: https://github.com/jlevy/tbd

## Related Guidelines

- For TypeScript CLI implementation details, see
  `tbd guidelines typescript-cli-tool-rules`
- For testing patterns, see `tbd guidelines general-testing-rules`
- For monorepo setup, see `tbd guidelines pnpm-monorepo-patterns` or
  `bun-monorepo-patterns`
