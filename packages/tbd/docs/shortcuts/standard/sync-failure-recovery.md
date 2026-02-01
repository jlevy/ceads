---
title: Sync Failure Recovery
description: Handle tbd sync failures by saving to workspace and recovering later
category: session
author: Joshua Levy (github.com/jlevy) with LLM assistance
---
When `tbd sync` fails to push (e.g., network errors, permission issues, branch
restrictions), use this workflow to preserve and recover issue data.

## When Sync Fails

```bash
# Save unsynced changes to the outbox
tbd save --outbox

# Commit the outbox to your working branch
git add .tbd/workspaces
git commit -m "tbd: save outbox"
git push
```

## Later, When Sync Works

In a new session or environment where sync works:

```bash
# Import from outbox (clears outbox on success)
tbd import --outbox

# Sync to push changes
tbd sync
```

## More Information

For detailed troubleshooting, workspace usage, and diagnostic commands, see:

```bash
tbd guidelines sync-troubleshooting
```
