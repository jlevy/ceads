# tbd Workflow Rules (Brief)

## Core Workflow

Track all task work as issues using tbd:

```bash
tbd ready              # Show issues ready to work
tbd show <id>          # View issue details
tbd create "title"     # Create new issue
tbd close <id>         # Mark issue complete
tbd sync               # Sync with remote
```

## Session Protocol

**Before ending ANY session:**

1. Stage and commit: `git add . && git commit`
2. Push to remote: `git push`
3. Watch CI: `gh pr checks <PR> --watch 2>&1`
4. Update issues: `tbd close/update <id>` for work completed
5. Sync issues: `tbd sync`
6. Confirm CI passed before declaring “done”

## Key Principles

- Check `tbd ready` for available work before starting
- Update issue status when you begin work: `tbd update <id> --status=in_progress`
- Always close issues with a reason: `tbd close <id> --reason="Completed in PR #123"`
- Run `tbd sync` at session end to push changes
