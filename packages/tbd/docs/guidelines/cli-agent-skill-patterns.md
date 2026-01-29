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

## Key Insights

1. **CLI as Dynamic Skill Module**: CLIs can provide context management,
   self-documentation, and multi-agent integration through a single npm package.

2. **CLI as Knowledge Library**: Bundle guidelines, shortcuts, and templates that agents
   can query on-demand to improve work quality.
   This transforms the CLI from a tool the agent tells users about into a resource the
   agent uses to better serve users.

3. **Context Injection Loop**: A recursive architecture where skill documentation
   references commands, those commands output more context, and that context references
   further commands. This creates a self-directing knowledge system where agents get
   progressively smarter as they work.

4. **Task Management Integration**: CLIs that help agents track work across sessions,
   discover available tasks, and enforce session boundaries lead to more reliable
   agentic workflows.

* * *

## 1. CLI as Skill Architecture

### 1.1 Bundled Documentation Pattern

- **Bundle documentation files with CLI**: Include `SKILL.md`, `README.md`, and docs in
  the CLI distribution.

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
- Default when running CLI with no command (`mycli` runs `mycli prime`)

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
- commit-code
- create-or-update-pr-simple
- new-plan-spec
```

**Preferred pattern** (full command):

```markdown
## Available Shortcuts

| Command | Purpose | Description |
|---------|---------|-------------|
| `mycli shortcut commit-code` | Commit Code | How to run pre-commit checks and commit |
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

### 5.3 Never Guess User Preferences

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

### 8.1 On-the-Fly Resource Directory Generation

Rather than maintaining static resource directories that can become stale, generate them
dynamically at runtime from installed documents.

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
2. **Implement fallback loading**: Support both bundled and development modes
3. **Use platform-appropriate formats**: SKILL.md for Claude, MDC for Cursor, markers
   for AGENTS.md

### Context Management

4. **Implement a `prime` command**: Dashboard at session start, brief mode for
   constrained contexts
5. **Separate skill from dashboard**: Different verbosity levels for different needs
6. **Include context recovery instructions**: Agents need to know how to restore context
7. **Two-level orientation only**: Full (default) and brief—avoid more granularity
8. **Use progressive disclosure**: Level 1 (metadata) → Level 2 (skill body) → Level 3
   (resources)
9. **Keep SKILL.md under 500 lines**: Move detailed content to reference files

### Description Optimization

10. **Use the two-part rule**: What does it do?
    + When to use it?
11. **Write in third person**: “Processes files” not “I can help you”
12. **Include explicit trigger phrases**: Match how users naturally describe needs

### Self-Documentation

13. **Provide documentation commands**: `readme`, `docs`, `design` as built-in commands
14. **Include Getting Started in help epilog**: One-liner must be easily accessible

### Setup Flows

15. **Two-tier command structure**: High-level (`setup`) and surgical (`init`)
16. **Require explicit mode flags**: `--auto` for agents, `--interactive` for humans
17. **Never guess user preferences**: For taste-based config (prefixes), always ask

### Agent Integration

18. **Install hooks programmatically**: SessionStart, PreCompact, PostToolUse
19. **Use skill directories**: `.claude/skills/`, `.cursor/rules/`
20. **Support multiple agents**: Single CLI, multiple integration points

### Output

21. **Implement `--json` for all commands**: Machine-readable output is essential
22. **Use `output.data()` pattern**: Single code path for JSON and human output
23. **Provide `--quiet` mode**: For scripted usage without noise

### Error Handling

24. **Include next steps in errors**: Actionable guidance, not just error messages
25. **Graceful deprecation**: Keep old commands working with migration guidance
26. **Explicit completion protocols**: Checklists prevent premature completion

### Agent Mental Model

27. **Design for agent-as-partner**: Help agents serve users, not relay commands
28. **Lead with value proposition**: Explain *why* before *how*
29. **Distinguish action from informational commands**: Some commands teach, not do

### Resource Libraries

30. **Bundle guidelines, shortcuts, templates**: Ship curated knowledge with CLI
31. **Show full commands in directories**: `cli shortcut X`, not just `X`
32. **Organize resources by purpose**: Categories by workflow phase or domain
33. **Enable on-demand knowledge queries**: Agents pull in relevant resources JIT
34. **Implement shadowing for customization**: Project-level overrides without forking
35. **Generate directories dynamically**: Avoid stale documentation

### Context Injection

36. **Design self-reinforcing context chains**: SKILL.md → guidelines → actions
37. **Reference commands explicitly**: Always `cli command arg`, never vague prose
38. **Limit chain depth to 3**: Avoid deep reference chains that confuse agents
39. **Make every layer actionable**: Each context injection should lead to actions

### Task Management

40. **Choose appropriate tracking strategy**: Ephemeral, session-local, or persistent
41. **Implement work discovery**: `ready` or `next` commands for session start
42. **Add session boundary enforcement**: Remind agents to sync/close at session end
43. **Consider tbd integration**: For persistent multi-session task tracking

* * *

## Integration Checklist for New CLIs

**Agent Integration Files**

- [ ] SKILL.md with YAML frontmatter (name, description, allowed-tools)
- [ ] CURSOR.mdc with MDC frontmatter (description, alwaysApply)
- [ ] AGENTS.md section with HTML markers

**Description Quality**

- [ ] Two-part description: capabilities + activation triggers
- [ ] Third-person language only
- [ ] Explicit trigger phrases matching user language

**Context Management**

- [ ] `prime` command with dashboard and brief modes (two levels only)
- [ ] `skill` command for full documentation output
- [ ] Value-first orientation in skill file (why before how)
- [ ] Context recovery instructions in all docs
- [ ] Session closing protocol checklist
- [ ] SKILL.md under 500 lines (progressive disclosure)

**Setup Flow**

- [ ] `setup --auto` for agent-friendly installation
- [ ] `init --prefix` for surgical initialization
- [ ] Multi-contributor detection (skip init if already configured)

**Hooks**

- [ ] SessionStart hook to call `prime`
- [ ] PreCompact hook to call `prime`
- [ ] PostToolUse hook for session completion reminders

**Self-Documentation**

- [ ] Help epilog with one-liner installation command
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
- For monorepo setup, see `tbd guidelines typescript-monorepo-patterns`
