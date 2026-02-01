---
title: Review GitHub PR
description: Review a GitHub pull request with follow-up actions (comment, fix, CI check)
category: review
author: Joshua Levy (github.com/jlevy) with LLM assistance
---
This shortcut reviews a **GitHub pull request** and handles GitHub-specific follow-ups
like commenting on the PR, checking CI status, and pushing fixes.

For reviewing **local changes** (uncommitted or branch work) without GitHub integration,
use `tbd shortcut review-code` directly.

## Instructions

Create a to-do list with the following items then perform all of them:

1. **GitHub CLI setup:**
   - Verify: `gh auth status`
   - If issues, run `tbd shortcut setup-github-cli`
   - Get repo:
     `REPO=$(git remote get-url origin | sed -E 's#.*/git/##; s#.*github.com[:/]##; s#\.git$##')`
   - Use `--repo $REPO` on all gh commands

2. **Get the PR to review:**
   - If the user provided a PR number or URL, extract the PR number
   - If not specified, ask the user which PR to review
   - Get PR info:
     `gh pr view <PR_NUMBER> --repo $REPO --json number,title,body,author,url,headRefName`

3. **Check CI status:**
   - Run: `gh pr checks <PR_NUMBER> --repo $REPO`
   - Note any failing or pending checks

4. **Perform code review:**
   - Run `tbd shortcut review-code` using the **GitHub PR** scope
   - The diff is obtained via: `gh pr diff <PR_NUMBER> --repo $REPO`

5. **Compile full review:** Combine the code review findings with GitHub-specific info:

   - **Summary**: Brief assessment (1-2 sentences)
   - **Strengths**: What’s done well (if any)
   - **Issues**: Problems found with `file:line` references and suggested fixes
   - **Suggestions**: Optional improvements (not blockers)
   - **CI Status**: Current state of checks (passing/failing/pending)

6. **Determine next action:**
   - If the user already specified what to do (e.g., “review and comment”, “review and
     fix”), follow those instructions
   - Otherwise, present the review and ask the user:
     - **Add as PR comment**: Post the review as a comment on the PR
     - **Create fix beads**: Create tbd beads for issues found and begin fixing
     - **Report only**: Just output the review (no action)

7. **Take the requested action:**

   - **If adding as comment:**
     ```bash
     gh pr review <PR_NUMBER> --repo $REPO --comment --body "<review>"
     ```

   - **If creating fix beads:**
     - Create a bead for each issue: `tbd create "Fix: ..." --type bug`
     - Check out the PR branch if not already on it:
       `gh pr checkout <PR_NUMBER> --repo $REPO`
     - Follow `tbd shortcut implement-beads` to fix issues
     - Push changes and update the PR

   - **If report only:**
     - Output the review
     - No further action needed
