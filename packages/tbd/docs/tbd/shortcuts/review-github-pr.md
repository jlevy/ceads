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

5. **Check documentation consistency:**
   - Review any specs referenced by the PR in `docs/project/specs/active/`
   - Check if `docs/development.md` needs updates for behavioral changes
   - Check if architecture docs in `docs/project/architecture/` need updates
   - Note any documentation that is out of sync with the code changes

6. **Review existing PR comments:**
   - Get PR comments: `gh pr view <PR_NUMBER> --repo $REPO --comments`
   - For review comments: `gh api repos/{owner}/{repo}/pulls/<PR_NUMBER>/comments`
   - Note any unresolved comments or requested changes

7. **Compile full review:** Combine the code review findings with GitHub-specific info:

   - **Summary**: Brief assessment (1-2 sentences)
   - **Strengths**: What’s done well (if any)
   - **Issues**: Problems found with `file:line` references and suggested fixes
   - **Documentation gaps**: Specs or docs that need updating
   - **Unresolved comments**: Any PR comments still needing attention
   - **Suggestions**: Optional improvements (not blockers)
   - **CI Status**: Current state of checks (passing/failing/pending)

8. **Determine next action:**
   - If the user already specified what to do (e.g., “review and comment”, “review and
     fix”), follow those instructions
   - Otherwise, present the review and ask the user:
     - **Add as PR comment**: Post the review as a comment on the PR
     - **Fix with beads**: Create tbd beads for every issue and systematically fix them
     - **Report only**: Just output the review (no action)

9. **Take the requested action:**

   ### If adding as comment:

   ```bash
   gh pr review <PR_NUMBER> --repo $REPO --comment --body "<review>"
   ```

   ### If fixing with beads (comprehensive tracking):

   This approach ensures **every issue is tracked** and nothing is lost:

   a. **Create a parent bead** for the PR review:
   ```bash
   tbd create "Review PR #<NUMBER>: <title>" --type task --priority P1
   ```

   b. **Create child beads for EVERY issue found:**
   ```bash
   tbd create "<issue description>" --type bug --parent <parent-bead-id>
   ```

   Categories to track as beads:
   - Code issues (bugs, antipatterns, missing error handling)
   - Test gaps (missing tests, inadequate coverage)
   - Documentation gaps (specs out of sync, missing updates)
   - CI failures (each failing check)
   - Unresolved PR comments

   Each bead description should include:
   - File and line number (e.g., `src/foo.ts:42`)
   - Brief description of the issue
   - Reference to the PR (e.g., `(PR #123)`)

   c. **Check out the PR branch:**
   ```bash
   gh pr checkout <PR_NUMBER> --repo $REPO
   ```

   d. **Fix issues systematically:**
   - Mark the parent bead as in_progress: `tbd update <id> --status in_progress`
   - Work through each child bead in order:
     - Mark as in_progress before starting
     - Follow `tbd guidelines general-tdd-guidelines` for code fixes
     - Run tests after each fix
     - Mark as closed when complete: `tbd close <id>`
   - Commit fixes with conventional commit messages

   e. **Verify CI passes:**
   - Push changes: `git push`
   - Wait for CI: `gh pr checks <PR_NUMBER> --repo $REPO --watch 2>&1`
   - **IMPORTANT**: Wait for the final summary—don’t stop at early “passing” output
   - If CI fails: create a bead for the failure, fix it, restart this step

   f. **Update PR description** to reflect what was fixed:
   ```bash
   gh pr edit <PR_NUMBER> --repo $REPO --body "..."
   ```

   g. **Close the parent bead:**
   ```bash
   tbd close <parent-bead-id> --reason "PR review complete, all issues resolved"
   tbd sync
   ```

   ### If report only:

   - Output the review
   - No further action needed

10. **Report to user:**
    - Summarize what was reviewed (and fixed, if applicable)
    - List any beads created (if fixing with beads)
    - Confirm CI status
    - Provide the PR URL
