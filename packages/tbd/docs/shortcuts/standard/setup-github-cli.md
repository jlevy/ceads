---
title: Setup GitHub CLI
description: Ensure GitHub CLI (gh) is installed and working
category: session
author: Joshua Levy (github.com/jlevy) with LLM assistance
---
The GitHub CLI (`gh`) is required for PR and issue operations.

**In most cases, gh is already available** - tbd installs a SessionStart hook that
auto-installs gh on every session.

## Sanity Check (Do This First)

**Important:** Don’t assume gh works just because `command -v gh` succeeds.
On Claude Code Cloud, pre-installed gh may be outdated, broken, or incompatible.
Always verify:

```bash
# The real test: does gh actually work AND is it authenticated?
gh auth status
```

**Expected output:** Shows “Logged in to github.com” with your account.

If this fails for any reason, follow the steps below.

## Corner Cases You May Encounter

1. **gh exists but is broken**: `gh --version` or `gh auth status` fails with errors
   - Solution: Reinstall via ensure script (installs fresh copy to ~/.local/bin)

2. **gh exists but wrong version**: Very old gh may lack required features
   - Solution: Reinstall via ensure script

3. **gh works but not authenticated**: `GH_TOKEN` not set or invalid
   - Solution: Set `GH_TOKEN` environment variable before starting session

4. **PATH issues**: gh installed but not in PATH
   - Solution: Ensure `~/.local/bin` is in PATH, or use full path

## Installation

1. **Run the ensure script:**
   ```bash
   bash .claude/scripts/ensure-gh-cli.sh
   ```
   This script installs gh to `~/.local/bin` and checks authentication.

2. **If the script doesn’t exist:** Run `tbd setup --auto` to reinstall tbd hooks, which
   includes the gh CLI script.

3. **Manual installation (fallback):**
   ```bash
   # macOS
   brew install gh
   
   # Linux (Debian/Ubuntu)
   curl -fsSL https://cli.github.com/packages/githubcli-archive-keyring.gpg | sudo dd of=/usr/share/keyrings/githubcli-archive-keyring.gpg
   echo "deb [arch=$(dpkg --print-architecture) signed-by=/usr/share/keyrings/githubcli-archive-keyring.gpg] https://cli.github.com/packages stable main" | sudo tee /etc/apt/sources.list.d/github-cli.list > /dev/null
   sudo apt update && sudo apt install gh
   ```

## Authentication

Set `GH_TOKEN` environment variable with a GitHub personal access token **before**
starting the session.
See `docs/general/agent-setup/github-cli-setup.md` for token creation instructions.

## Quick Reference

| Problem | Solution |
| --- | --- |
| `gh: command not found` | Run ensure script or add ~/.local/bin to PATH |
| `gh --version` fails | gh is broken, reinstall via ensure script |
| `gh auth status` shows errors | GH_TOKEN not set or invalid |
| `Bad credentials` | Token expired or lacks permissions |
| `Resource not accessible` | Token lacks required scopes (need repo, workflow) |
