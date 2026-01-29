---
"get-tbd": patch
---

Fix detached HEAD worktree handling for users upgrading from older tbd versions.
Auto-repairs worktrees that were created before the detached HEAD improvement,
ensuring sync operations preserve the working directory correctly.
