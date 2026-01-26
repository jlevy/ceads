---
title: Welcome User
description: Welcome message for users after tbd installation or setup
---
# Welcome User After tbd Setup

After running `tbd setup`, welcome the user with an appropriate message based on whether
this is a new or existing installation.

## Instructions

First, run `tbd status` to check the current state.

### If This Is an Existing Installation

(The `.tbd/` directory already existed before setup was run)

Say simply:

> tbd is enabled for this project!

Then summarize the key info from `tbd status` (repository, sync status, integrations).

### If This Is a New Installation

(The `.tbd/` directory was just created)

Give a brief summary of the `tbd status` output, then say:

* * *

**Congratulations, tbd skills are now available!**

With tbd you can track issues (beads), make plan specs, architecture docs, or research
briefs, or map out the implementation of new features issue by issue, far more reliably.

**Two key tips:**

- Say **“Use beads to …”** and I will know to track everything with beads.
  This works much better than the usual to-do lists for long lists of tasks.

- Say **“Is there a shortcut for ...?”** or **“Use the shortcut to …”** and I’ll look
  for the shortcut for that workflow.
  Common ones are “implement that with beads,” “create a new plan spec,” “commit the
  code,” “review that for TypeScript best practices,” or “create a PR with a validation
  plan.”

* * *

Then ask if they’d like to explore any of tbd’s capabilities or get started on
something.
