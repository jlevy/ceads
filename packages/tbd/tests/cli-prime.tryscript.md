---
sandbox: true
env:
  NO_COLOR: '1'
  FORCE_COLOR: '0'
path:
  - ../dist
timeout: 30000
patterns:
  ULID: '[0-9a-z]{26}'
  SHORTID: '[0-9a-z]{4,5}'
  TIMESTAMP: "\\d{4}-\\d{2}-\\d{2}T\\d{2}:\\d{2}:\\d{2}(\\.\\d+)?Z"
---
# tbd CLI: Prime Command

Tests for the `tbd prime` command which outputs workflow context for AI agents.

* * *

## Prime in Uninitialized Directory

# Test: Prime outside tbd project shows setup instructions

When not in a tbd project, prime should show setup instructions to guide users.

```console
$ git init --initial-branch=main
Initialized empty Git repository in [..]
? 0
```

```console
$ tbd prime
tbd v[..]

--- PROJECT NOT INITIALIZED ---
✗ Not initialized in this repository

To set up tbd in this project:

  tbd setup --auto              # Non-interactive (for agents)
  tbd setup --interactive       # Interactive (for humans)

After setup, run 'tbd' again to see project status.

For CLI reference: tbd --help
? 0
```

# Test: Prime outside tbd project produces output (dashboard)

```console
$ tbd prime | wc -l | tr -d ' '
[..]
? 0
```

* * *

## Prime in Initialized Project

# Test: Initialize tbd for remaining tests

```console
$ git config user.email "test@example.com"
? 0
```

```console
$ git config user.name "Test User"
? 0
```

```console
$ git config commit.gpgsign false
? 0
```

```console
$ echo "# Test repo" > README.md && git add README.md && git commit -m "Initial commit"
[main (root-commit) [..]] Initial commit
 1 file changed, 1 insertion(+)
 create mode 100644 README.md
? 0
```

```console
$ tbd init --prefix=test --quiet
? 0
```

# Test: Prime outputs dashboard in initialized project

```console
$ tbd prime | head -1
tbd v[..]
? 0
```

# Test: Prime dashboard contains installation section

```console
$ tbd prime | grep -c "INSTALLATION"
1
? 0
```

# Test: Prime dashboard contains project status section

```console
$ tbd prime | grep -c "PROJECT STATUS"
1
? 0
```

# Test: Prime dashboard contains workflow rules section

```console
$ tbd prime | grep -c "WORKFLOW RULES"
1
? 0
```

# Test: Prime dashboard contains quick reference section

```console
$ tbd prime | grep -c "QUICK REFERENCE"
1
? 0
```

# Test: Prime --full outputs full SKILL.md content

```console
$ tbd prime --full | head -1
# tbd Workflow Context
? 0
```

# Test: Prime --full contains Context Recovery

```console
$ tbd prime --full | grep -c "Context Recovery"
1
? 0
```

* * *

## Prime with --export Flag

# Test: Prime --export outputs default dashboard

The --export flag outputs the default dashboard content, ignoring any custom PRIME.md.

```console
$ tbd prime --export | head -1
tbd v[..]
? 0
```

* * *

## Prime with Custom PRIME.md Override

# Test: Create custom PRIME.md override

```console
$ echo '# Custom Prime Content' > .tbd/PRIME.md && echo '' >> .tbd/PRIME.md && echo 'This is a custom prime message for this project.' >> .tbd/PRIME.md
? 0
```

# Test: Prime uses custom PRIME.md when present

```console
$ tbd prime | head -1
# Custom Prime Content
? 0
```

# Test: Prime --export ignores custom PRIME.md and shows default dashboard

```console
$ tbd prime --export | head -1
tbd v[..]
? 0
```

* * *

## Prime Help

# Test: Prime --help shows options

```console
$ tbd prime --help
Usage: tbd prime [options]

Show dashboard and workflow context (default when running `tbd`)

Options:
  --export           Output default content (ignores PRIME.md override)
  --brief            Output minimal context (~200 tokens) for constrained
                     contexts
  --full             Output full SKILL.md content (for agents needing complete
                     docs)
  -h, --help         display help for command

Global Options:
  --version          Show version number
  --dry-run          Show what would be done without making changes
  --verbose          Enable verbose output
  --quiet            Suppress non-essential output
  --json             Output as JSON
  --color <when>     Colorize output: auto, always, never (default: "auto")
  --non-interactive  Disable all prompts, fail if input required
  --yes              Assume yes to confirmation prompts
  --no-sync          Skip automatic sync after write operations
  --debug            Show internal IDs alongside public IDs for debugging

Getting Started:
  npm install -g tbd-git@latest && tbd setup --auto

  This initializes tbd and configures your coding agents automatically.
  For interactive setup: tbd setup --interactive
  For manual control: tbd init --help

For more on tbd, see: https://github.com/jlevy/tbd
? 0
```
