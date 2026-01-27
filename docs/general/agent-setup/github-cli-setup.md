# GitHub CLI Setup

The GitHub CLI (`gh`) is essential for agent-based development workflows including
creating pull requests, managing issues, and interacting with GitHub’s API.

## Quick Check

```bash
gh --version && gh auth status
```

If `gh` is available and authenticated, you’re ready to go.

## Installation

**Installation is automatic.** When you run `tbd setup`, it installs an
`ensure-gh-cli.sh` script to `.claude/scripts/` and a corresponding SessionStart hook in
`.claude/settings.json`. This hook runs on every Claude Code session start and installs
`gh` to `~/.local/bin` if it isn’t already available.

No manual installation required.

### Disabling Automatic Installation

To disable the automatic gh CLI hook, use either method:

- **At setup time**: `tbd setup --auto --no-gh-cli`
- **In config**: Set `use_gh_cli: false` in `.tbd/config.yml` under `settings:`, then
  re-run `tbd setup --auto`

When disabled, `tbd setup` will remove the `ensure-gh-cli.sh` script and its
SessionStart hook entry.

For manual installation or troubleshooting, see the
[GitHub CLI installation docs](https://github.com/cli/cli#installation).

## Setting Up GH_TOKEN

Authentication requires the `GH_TOKEN` environment variable.
This must be set **before** starting your agent session.

### Step 1: Create a Personal Access Token

Go to [GitHub Settings > Tokens](https://github.com/settings/tokens) and create a token:

**Option A: Fine-Grained Token (Recommended for security)**
- Click “Generate new token” > “Fine-grained token”
- Set an expiration date
- Select specific repositories (or all)
- Grant permissions:
  - **Contents**: Read and write (for pushing code)
  - **Pull requests**: Read and write (for creating PRs)
  - **Issues**: Read and write (optional, for issue management)
  - **Workflows**: Read and write (optional, for CI/CD)

**Option B: Classic Token (Required for GraphQL API / cross-org access)**
- Click “Generate new token” > “Classic”
- Select scopes: `repo`, `workflow`, `read:org`

**When to use which:**
- Fine-grained tokens are more secure but don’t support GraphQL API
- Use classic tokens if you need cross-organization access or GraphQL operations

### Step 2: Set Environment Variables

Set these variables in your environment:

```
GH_TOKEN=ghp_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
GH_PROMPT_DISABLED=1
```

**Where to set them depends on your environment:**

| Environment | Where to Configure |
| --- | --- |
| **Claude Code Cloud** | Project settings > Environment variables in the web UI |
| **Claude Code CLI (local)** | Shell profile: `~/.zshrc`, `~/.bashrc`, or `~/.profile` |
| **Other agents** | Their respective environment configuration |

**Example for shell profile (~~/.zshrc or ~~/.bashrc):**

```bash
# GitHub CLI for agent workflows
export GH_TOKEN="ghp_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx"
export GH_PROMPT_DISABLED=1
```

Then reload: `source ~/.zshrc`

## Usage

**Important**: Always specify `-R owner/repo` since git remotes may use a proxy (needed
for Claude Code Cloud).

```bash
# List PRs
gh pr list -R owner/repo --json number,title,state

# View/update PR
gh pr view 123 -R owner/repo
gh pr comment 123 -R owner/repo --body "Comment text"

# Create PR
gh pr create -R owner/repo --title "Title" --body "Description"

# Issues
gh issue list -R owner/repo
gh issue create -R owner/repo --title "Title" --body "Body"

# API (for advanced operations)
gh api repos/owner/repo/pulls/123/comments
```

## Troubleshooting

**“gh: command not found”**
- The session hook should auto-install `gh`. If it didn’t run, check
  `.claude/settings.json`
- Ensure `~/.local/bin` is in your PATH

**“GH_TOKEN not set”**
- Set the environment variable as described above
- For Claude Code Cloud, check project environment settings

**“Bad credentials” or authentication failed**
- Token may be expired - generate a new one
- Token may lack required permissions - check scopes
- For fine-grained tokens, ensure the repository is included

**“Resource not accessible by personal access token”**
- Fine-grained tokens can’t access GraphQL API - use a classic token
- Fine-grained tokens must explicitly include each repository
