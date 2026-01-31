---
title: Review GitHub PR
description: Review a pull request and optionally add comments or create fix beads
author: Joshua Levy (github.com/jlevy) with LLM assistance
---
We track work as beads using tbd.
Run `tbd` for more on using tbd and current status.

Instructions:

Create a to-do list with the following items then perform all of them:

1. **GitHub CLI setup:**
   - Verify: `gh auth status` (if issues, run `tbd shortcut setup-github-cli`)
   - Get repo:
     `REPO=$(git remote get-url origin | sed -E 's#.*/git/##; s#.*github.com[:/]##; s#\.git$##')`
   - Use `--repo $REPO` on all gh commands (required for Claude Code Cloud)

2. **Get the PR to review:**
   - If the user provided a PR number or URL, extract the PR number
   - If not specified, ask the user which PR to review
   - Run:
     `gh pr view <PR_NUMBER> --repo $REPO --json number,title,body,author,url,files`

3. **Fetch and analyze the PR changes:**
   - Get the diff: `gh pr diff <PR_NUMBER> --repo $REPO`
   - Get the list of files changed: `gh pr view <PR_NUMBER> --repo $REPO --json files`
   - Review the commits: `gh pr view <PR_NUMBER> --repo $REPO --json commits`

4. **Review for code quality:**
   - Run `tbd guidelines typescript-rules` or `tbd guidelines python-rules` as
     appropriate
   - Run `tbd guidelines general-coding-rules` for general rules
   - Check for:
     - [ ] Types properly defined (no unnecessary `any`)
     - [ ] Error handling is appropriate
     - [ ] No unused imports or variables
     - [ ] Functions are small and focused
     - [ ] Names are descriptive and consistent
     - [ ] Comments explain “why” not “what”
     - [ ] No code duplication
     - [ ] No hardcoded secrets or credentials
     - [ ] Input validation where needed

5. **Check documentation and specs:**
   - Verify any related specs in `docs/project/specs/active/` are in sync
   - Check that `docs/development.md` is updated if needed
   - Review any architecture docs in `docs/project/architecture/` if affected

6. **Check CI status:**
   - Run: `gh pr checks <PR_NUMBER> --repo $REPO`
   - Note any failing or pending checks

7. **Compile the review:** Write a structured review with:
   - **Summary**: Brief assessment of the PR (1-2 sentences)
   - **Strengths**: What’s done well (if any)
   - **Issues**: Problems found with file:line references and suggested fixes
   - **Suggestions**: Optional improvements (not blockers)
   - **CI Status**: Current state of checks

8. **Present review to user and ask for action:** Show the review and ask the user:
   - **Add as PR comment**: Post the review as a comment on the PR
   - **Create fix beads**: Create tbd beads for issues found and begin fixing
   - **Just show me**: No action needed, review is informational only

9. **Take the requested action:**
   - If adding as comment:
     `gh pr review <PR_NUMBER> --repo $REPO --comment --body "<review>"`
   - If creating fix beads: Create a bead for each issue using
     `tbd create "..." --type bug` Then follow `tbd shortcut implement-beads` to fix
     them
